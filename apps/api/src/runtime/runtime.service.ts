import { Injectable, NotFoundException } from '@nestjs/common';

import { ApiKeysService } from '../api-keys/api-keys.service';
import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  RequestLogsService,
  toErrorCode,
} from '../request-logs/request-logs.service';
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
    private readonly apiKeys: ApiKeysService,
    private readonly requestLogs: RequestLogsService,
  ) {}

  async execute(
    projectSlug: string,
    version: string,
    endpointSlug: string,
    rawApiKey: string | undefined,
    received: Record<string, unknown>,
  ) {
    const startedAt = Date.now();

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
        id: true,
        projectId: true,
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
    //
    // Este é o único caminho sem registro: RequestLog exige um
    // endpointId, que aqui não existe.
    if (!endpoint) {
      throw new NotFoundException('Endpoint não encontrado.');
    }

    let apiKeyId: string | undefined;

    try {
      // A autenticação vem depois da resolução justamente para que a
      // falha possa ser registrada com o endpoint que se tentou acessar.
      const apiKey = await this.apiKeys.authenticate(
        rawApiKey,
        endpoint.projectId,
      );

      apiKeyId = apiKey.id;

      const result = await executeQuery(this.externalDatabase, {
        sql: endpoint.savedQuery.sql,
        connectionId: endpoint.savedQuery.connectionId,
        parameters: endpoint.savedQuery.parameters,
        received,
        maxRows: endpoint.maxRows,
      });

      await this.requestLogs.record({
        endpointId: endpoint.id,
        apiKeyId,
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        rowCount: result.rowCount,
      });

      return result;
    } catch (error) {
      const { statusCode, errorCode } = toErrorCode(error);

      await this.requestLogs.record({
        endpointId: endpoint.id,
        apiKeyId,
        statusCode,
        durationMs: Date.now() - startedAt,
        errorCode,
      });

      throw error;
    }
  }
}
