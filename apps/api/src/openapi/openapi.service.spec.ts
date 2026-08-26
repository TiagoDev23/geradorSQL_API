import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { QueryParameterType } from '../generated/prisma/enums';
import { OpenapiService } from './openapi.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

interface ParametroEsperado {
  name: string;
  in: string;
  required: boolean;
  schema: { type: string; format?: string; default?: string };
}

interface Operacao {
  operationId: string;
  summary: string;
  tags: string[];
  parameters: ParametroEsperado[];
  security: Record<string, unknown[]>[];
  responses: Record<string, unknown>;
}

function parametro(
  name: string,
  type: QueryParameterType,
  required = true,
  defaultValue: string | null = null,
) {
  return { name, description: null, type, required, defaultValue };
}

function endpoint(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Consulta de exemplo',
    description: null,
    slug: 'consulta-exemplo',
    version: 'v1',
    maxRows: 500,
    savedQuery: { description: null, parameters: [] },
    ...overrides,
  };
}

describe('OpenapiService', () => {
  let prisma: { project: { findUnique: jest.Mock } };
  let service: OpenapiService;

  beforeEach(() => {
    prisma = { project: { findUnique: jest.fn() } };
    service = new OpenapiService(prisma as unknown as PrismaService);
  });

  function mockProjeto(endpoints: ReturnType<typeof endpoint>[]) {
    prisma.project.findUnique.mockResolvedValue({
      name: 'Projeto Demo',
      slug: 'projeto-demo',
      description: null,
      endpoints,
    });
  }

  /** Operação GET do primeiro caminho gerado. */
  async function primeiraOperacao(
    endpoints: ReturnType<typeof endpoint>[],
  ): Promise<Operacao> {
    mockProjeto(endpoints);

    const spec = await service.generateForProject(PROJECT_ID);
    const caminho = Object.keys(spec.paths)[0];

    return (spec.paths[caminho] as { get: Operacao }).get;
  }

  describe('documento', () => {
    it('gera estrutura OpenAPI válida', async () => {
      mockProjeto([endpoint()]);

      const spec = await service.generateForProject(PROJECT_ID);

      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toContain('Projeto Demo');
      expect(spec.info.version).toBeDefined();
      expect(spec.servers).toHaveLength(1);
      expect(spec.paths).toBeDefined();
    });

    it('rejeita projeto inexistente', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.generateForProject(PROJECT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('gera documento vazio de paths quando não há endpoints publicados', async () => {
      mockProjeto([]);

      const spec = await service.generateForProject(PROJECT_ID);

      expect(Object.keys(spec.paths)).toHaveLength(0);
    });

    it('consulta apenas endpoints publicados', async () => {
      mockProjeto([endpoint()]);

      await service.generateForProject(PROJECT_ID);

      const args = prisma.project.findUnique.mock.calls[0] as unknown as [
        { select: { endpoints: { where: Record<string, unknown> } } },
      ];

      // O filtro vai para o banco: endpoint despublicado nem é lido.
      expect(args[0].select.endpoints.where).toEqual({ isPublished: true });
    });
  });

  describe('caminhos', () => {
    it('monta o caminho real do runtime', async () => {
      mockProjeto([endpoint({ slug: 'observacoes', version: 'v1' })]);

      const spec = await service.generateForProject(PROJECT_ID);

      expect(Object.keys(spec.paths)).toEqual([
        '/runtime/projeto-demo/v1/observacoes',
      ]);
    });

    it('gera um caminho por endpoint', async () => {
      mockProjeto([
        endpoint({ slug: 'primeiro' }),
        endpoint({ slug: 'segundo', version: 'v2' }),
      ]);

      const spec = await service.generateForProject(PROJECT_ID);

      expect(Object.keys(spec.paths)).toEqual([
        '/runtime/projeto-demo/v1/primeiro',
        '/runtime/projeto-demo/v2/segundo',
      ]);
    });

    it('reflete um endpoint acrescentado sem alterar código', async () => {
      // Primeira geração com um endpoint.
      mockProjeto([endpoint({ slug: 'primeiro' })]);

      const antes = await service.generateForProject(PROJECT_ID);

      expect(Object.keys(antes.paths)).toHaveLength(1);

      // Segunda geração após o cadastro de outro, sem nenhuma mudança
      // de código entre as duas chamadas.
      mockProjeto([
        endpoint({ slug: 'primeiro' }),
        endpoint({ slug: 'novo-endpoint' }),
      ]);

      const depois = await service.generateForProject(PROJECT_ID);

      expect(Object.keys(depois.paths)).toContain(
        '/runtime/projeto-demo/v1/novo-endpoint',
      );
    });

    it('usa o método GET e um operationId único', async () => {
      const operacao = await primeiraOperacao([
        endpoint({ slug: 'observacoes-estacao' }),
      ]);

      expect(operacao.operationId).toBe('projeto_demo_v1_observacoes_estacao');
      expect(operacao.summary).toBe('Consulta de exemplo');
      expect(operacao.tags).toEqual(['v1']);
    });
  });

  describe('parâmetros', () => {
    it.each([
      [QueryParameterType.STRING, 'string', undefined],
      [QueryParameterType.INTEGER, 'integer', undefined],
      [QueryParameterType.FLOAT, 'number', undefined],
      [QueryParameterType.BOOLEAN, 'boolean', undefined],
      [QueryParameterType.DATE, 'string', 'date'],
      [QueryParameterType.DATETIME, 'string', 'date-time'],
      [QueryParameterType.UUID, 'string', 'uuid'],
    ])('mapeia %s', async (tipo, esperado, formato) => {
      const operacao = await primeiraOperacao([
        endpoint({
          savedQuery: {
            description: null,
            parameters: [parametro('valor', tipo)],
          },
        }),
      ]);

      expect(operacao.parameters[0].schema.type).toBe(esperado);
      expect(operacao.parameters[0].schema.format).toBe(formato);
    });

    it('declara os parâmetros na query string', async () => {
      const operacao = await primeiraOperacao([
        endpoint({
          savedQuery: {
            description: null,
            parameters: [parametro('estacaoId', QueryParameterType.INTEGER)],
          },
        }),
      ]);

      expect(operacao.parameters[0]).toMatchObject({
        name: 'estacaoId',
        in: 'query',
        required: true,
        schema: { type: 'integer' },
      });
    });

    it('preserva a obrigatoriedade de cada parâmetro', async () => {
      const operacao = await primeiraOperacao([
        endpoint({
          savedQuery: {
            description: null,
            parameters: [
              parametro('obrigatorio', QueryParameterType.STRING, true),
              parametro('opcional', QueryParameterType.STRING, false),
            ],
          },
        }),
      ]);

      expect(operacao.parameters[0].required).toBe(true);
      expect(operacao.parameters[1].required).toBe(false);
    });

    it('inclui o valor padrão quando existe', async () => {
      const operacao = await primeiraOperacao([
        endpoint({
          savedQuery: {
            description: null,
            parameters: [
              parametro('limite', QueryParameterType.INTEGER, false, '10'),
            ],
          },
        }),
      ]);

      expect(operacao.parameters[0].schema.default).toBe('10');
    });

    it('gera lista vazia quando a consulta não tem parâmetros', async () => {
      const operacao = await primeiraOperacao([endpoint()]);

      expect(operacao.parameters).toEqual([]);
    });
  });

  describe('segurança', () => {
    it('declara o esquema x-api-key no cabeçalho', async () => {
      mockProjeto([endpoint()]);

      const spec = await service.generateForProject(PROJECT_ID);

      expect(spec.components.securitySchemes.ApiKeyAuth).toMatchObject({
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      });
    });

    it('cada operação referencia o esquema', async () => {
      const operacao = await primeiraOperacao([endpoint()]);

      expect(operacao.security).toEqual([{ ApiKeyAuth: [] }]);
    });
  });

  describe('respostas', () => {
    it('documenta os status que o runtime produz', async () => {
      const operacao = await primeiraOperacao([endpoint()]);

      expect(Object.keys(operacao.responses)).toEqual([
        '200',
        '400',
        '401',
        '403',
        '404',
        '503',
      ]);
    });

    it('registra o limite configurado no endpoint', async () => {
      const operacao = await primeiraOperacao([endpoint({ maxRows: 250 })]);

      expect(
        (operacao.responses['200'] as { description: string }).description,
      ).toContain('250');
    });
  });

  describe('dados sensíveis', () => {
    it('não inclui SQL, chave, hash ou credencial', async () => {
      mockProjeto([
        endpoint({
          savedQuery: {
            description: null,
            parameters: [parametro('estacaoId', QueryParameterType.INTEGER)],
          },
        }),
      ]);

      const spec = await service.generateForProject(PROJECT_ID);
      const documento = JSON.stringify(spec).toLowerCase();

      for (const proibido of [
        'select ',
        'keyhash',
        'passwordhash',
        'passwordencrypted',
        'gapi_',
        'connection_encryption_key',
        'jwt_secret',
      ]) {
        expect(documento).not.toContain(proibido);
      }
    });

    it('não seleciona o SQL da consulta ao consultar o banco', async () => {
      mockProjeto([endpoint()]);

      await service.generateForProject(PROJECT_ID);

      const args = prisma.project.findUnique.mock.calls[0] as unknown as [
        { select: Record<string, unknown> },
      ];

      expect(JSON.stringify(args[0].select)).not.toContain('"sql"');
    });
  });
});
