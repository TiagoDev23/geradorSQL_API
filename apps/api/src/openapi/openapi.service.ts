import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { QueryParameterType } from '../generated/prisma/enums';

/**
 * Geração da especificação OpenAPI de um projeto.
 *
 * O documento é derivado inteiramente do que está cadastrado: projeto,
 * endpoints publicados, consultas e parâmetros. Nada aqui conhece um
 * endpoint específico, de modo que cadastrar um novo o faz aparecer na
 * próxima chamada, sem alterar código.
 *
 * O SQL não entra na especificação: ele continua apenas em SavedQuery.
 */

const OPENAPI_VERSION = '3.0.3';

/** Nome do esquema de segurança referenciado por cada operação. */
const SECURITY_SCHEME = 'ApiKeyAuth';

export interface SchemaObject {
  type: string;
  format?: string;
  items?: SchemaObject;
  additionalProperties?: boolean | SchemaObject;
  properties?: Record<string, SchemaObject>;
  description?: string;
  nullable?: boolean;
}

/**
 * Correspondência entre os tipos de parâmetro da plataforma e os tipos
 * do OpenAPI.
 */
const PARAMETER_SCHEMAS: Record<QueryParameterType, SchemaObject> = {
  [QueryParameterType.STRING]: { type: 'string' },
  [QueryParameterType.INTEGER]: { type: 'integer' },
  [QueryParameterType.FLOAT]: { type: 'number' },
  [QueryParameterType.BOOLEAN]: { type: 'boolean' },
  [QueryParameterType.DATE]: { type: 'string', format: 'date' },
  [QueryParameterType.DATETIME]: { type: 'string', format: 'date-time' },
  [QueryParameterType.UUID]: { type: 'string', format: 'uuid' },
};

@Injectable()
export class OpenapiService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        slug: true,
        description: true,

        endpoints: {
          // Somente o que o runtime executa de fato.
          where: { isPublished: true },
          orderBy: [{ version: 'asc' }, { slug: 'asc' }],
          select: {
            name: true,
            description: true,
            slug: true,
            version: true,
            maxRows: true,
            savedQuery: {
              select: {
                description: true,
                parameters: {
                  select: {
                    name: true,
                    description: true,
                    type: true,
                    required: true,
                    defaultValue: true,
                  },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    const paths: Record<string, unknown> = {};

    for (const endpoint of project.endpoints) {
      const path = `/runtime/${project.slug}/${endpoint.version}/${endpoint.slug}`;

      paths[path] = {
        get: this.buildOperation(project.slug, endpoint),
      };
    }

    return {
      openapi: OPENAPI_VERSION,

      info: {
        title: `${project.name} — endpoints publicados`,
        version: '1.0.0',
        description:
          project.description ??
          'Especificação gerada a partir dos endpoints publicados na plataforma.',
      },

      // Relativo ao host que serve a especificação, o que evita
      // depender de configuração de domínio.
      servers: [{ url: '/', description: 'Servidor atual' }],

      components: {
        securitySchemes: {
          [SECURITY_SCHEME]: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description:
              'Chave emitida pela plataforma para o projeto. Nenhuma chave real aparece nesta especificação.',
          },
        },

        schemas: {
          RuntimeResponse: this.runtimeResponseSchema(),
          ErrorResponse: this.errorResponseSchema(),
        },
      },

      // Todos os endpoints publicados exigem a chave.
      security: [{ [SECURITY_SCHEME]: [] }],

      paths,
    };
  }

  private buildOperation(
    projectSlug: string,
    endpoint: {
      name: string;
      description: string | null;
      slug: string;
      version: string;
      maxRows: number;
      savedQuery: {
        description: string | null;
        parameters: {
          name: string;
          description: string | null;
          type: QueryParameterType;
          required: boolean;
          defaultValue: string | null;
        }[];
      };
    },
  ) {
    return {
      // Identificador estável e único: a rota já é única pela
      // combinação de projeto, versão e slug.
      operationId:
        `${projectSlug}_${endpoint.version}_${endpoint.slug}`.replace(
          /-/g,
          '_',
        ),

      summary: endpoint.name,
      description:
        endpoint.description ?? endpoint.savedQuery.description ?? undefined,
      tags: [endpoint.version],

      parameters: endpoint.savedQuery.parameters.map((parameter) => ({
        name: parameter.name,
        in: 'query',
        required: parameter.required,
        description: parameter.description ?? undefined,

        schema: {
          ...PARAMETER_SCHEMAS[parameter.type],
          ...(parameter.defaultValue !== null && {
            default: parameter.defaultValue,
          }),
        },
      })),

      security: [{ [SECURITY_SCHEME]: [] }],

      responses: {
        '200': {
          description: `Resultado da consulta, limitado a ${endpoint.maxRows} registros.`,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RuntimeResponse' },
            },
          },
        },
        '400': {
          description: 'Parâmetro ausente ou de tipo inválido.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        '401': {
          description: 'API Key ausente, inválida, revogada ou expirada.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        '403': {
          description: 'API Key válida, mas de outro projeto.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        '404': {
          description: 'Endpoint não encontrado ou não publicado.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        '503': {
          description: 'Não foi possível consultar o banco de origem.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    };
  }

  /**
   * Reflete exatamente o que o runtime devolve hoje. As linhas ficam
   * como objetos genéricos: a consulta é um SELECT arbitrário, e inferir
   * suas colunas exigiria interpretar SQL.
   */
  private runtimeResponseSchema(): SchemaObject {
    return {
      type: 'object',
      properties: {
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              dataTypeId: {
                type: 'integer',
                description: 'OID do tipo da coluna no PostgreSQL.',
              },
            },
          },
        },
        rows: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        rowCount: { type: 'integer' },
        maxRows: { type: 'integer' },
        truncated: {
          type: 'boolean',
          description: 'Indica que o limite pode ter cortado registros.',
        },
        durationMs: { type: 'integer' },
      },
    };
  }

  private errorResponseSchema(): SchemaObject {
    return {
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        message: { type: 'string' },
        error: { type: 'string' },
      },
    };
  }
}
