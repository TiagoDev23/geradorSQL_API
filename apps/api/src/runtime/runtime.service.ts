import { Injectable, NotFoundException } from '@nestjs/common';

import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { executeQuery } from '../saved-queries/query-execution';

/**
 * Resolve endpoints publicados em tempo de requisição.
 *
 * O serviço é genérico por construção: não conhece nenhum endpoint,
 * tabela ou domínio em particular. Tudo o que precisa saber vem do banco
 * interno, de modo que cadastrar um endpoint novo o torna acessível
 * imediatamente, sem gerar arquivo nem recompilar a aplicação.
 */
@Injectable()
export class RuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly externalDatabase: ExternalDatabaseService,
  ) {}

  async execute(
    projectSlug: string,
    version: string,
    endpointSlug: string,
    received: Record<string, unknown>,
  ) {
    // Uma única consulta ao banco interno traz endpoint, consulta,
    // parâmetros e conexão. Os valores da URL viajam como parâmetros do
    // Prisma, nunca concatenados.
    const endpoint = await this.prisma.endpoint.findFirst({
      where: {
        slug: endpointSlug,
        version,
        isPublished: true,
        project: { slug: projectSlug },
      },

      select: {
        maxRows: true,
        savedQuery: {
          select: {
            sql: true,
            connectionId: true,
            parameters: {
              select: {
                name: true,
                type: true,
                position: true,
                required: true,
                defaultValue: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    // Projeto ausente, versão errada, endpoint inexistente e endpoint
    // não publicado resultam na mesma resposta: distinguir os casos
    // revelaria a existência de rotas ainda não publicadas.
    if (!endpoint) {
      throw new NotFoundException('Endpoint não encontrado.');
    }

    return executeQuery(this.externalDatabase, {
      sql: endpoint.savedQuery.sql,
      connectionId: endpoint.savedQuery.connectionId,
      parameters: endpoint.savedQuery.parameters,
      received,
      maxRows: endpoint.maxRows,
    });
  }
}
