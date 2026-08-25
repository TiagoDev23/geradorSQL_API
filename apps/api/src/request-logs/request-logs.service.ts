import { HttpException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';

/**
 * Registro técnico das execuções do runtime.
 *
 * O que é gravado é deliberadamente estreito: identificadores, status,
 * duração e contagem de linhas. Nada do que trafega — chave, parâmetros,
 * credenciais, SQL ou mensagem de erro — é persistido.
 */

export interface RequestLogEntry {
  endpointId: string;
  apiKeyId?: string;
  statusCode: number;
  durationMs: number;
  rowCount?: number;
  errorCode?: string;
}

const LOGS_PAGE_SIZE = 50;
const LOGS_MAX_PAGE_SIZE = 200;

const LOG_FIELDS = {
  id: true,
  endpointId: true,
  apiKeyId: true,
  statusCode: true,
  durationMs: true,
  rowCount: true,
  errorCode: true,
  createdAt: true,
} as const;

/**
 * Converte a exceção em um código curto e estável. Mensagens não são
 * usadas: podem conter valores vindos da requisição.
 */
export function toErrorCode(error: unknown): {
  statusCode: number;
  errorCode: string;
} {
  const statusCode = error instanceof HttpException ? error.getStatus() : 500;

  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    503: 'SERVICE_UNAVAILABLE',
  };

  return { statusCode, errorCode: codes[statusCode] ?? 'INTERNAL_ERROR' };
}

@Injectable()
export class RequestLogsService {
  private readonly logger = new Logger(RequestLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava o registro sem propagar falhas: a requisição já foi atendida,
   * e um problema no registro auxiliar não deve alterar a resposta.
   */
  async record(entry: RequestLogEntry): Promise<void> {
    try {
      await this.prisma.requestLog.create({
        data: {
          endpointId: entry.endpointId,
          statusCode: entry.statusCode,
          durationMs: entry.durationMs,

          ...(entry.apiKeyId !== undefined && { apiKeyId: entry.apiKeyId }),
          ...(entry.rowCount !== undefined && { rowCount: entry.rowCount }),
          ...(entry.errorCode !== undefined && { errorCode: entry.errorCode }),
        },
      });
    } catch (error) {
      // Só o motivo técnico vai para o log da aplicação, sem nada da
      // requisição original.
      this.logger.warn(
        `Não foi possível registrar a execução do endpoint ${entry.endpointId}: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }
  }

  /** Logs mais recentes do projeto, do mais novo para o mais antigo. */
  async findByProject(projectId: string, take?: number, skip?: number) {
    const limit = Math.min(take ?? LOGS_PAGE_SIZE, LOGS_MAX_PAGE_SIZE);

    return this.prisma.requestLog.findMany({
      where: { endpoint: { projectId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: skip ?? 0,
      select: LOG_FIELDS,
    });
  }

  /**
   * Métricas derivadas dos próprios logs, sem contadores mantidos em
   * paralelo, que poderiam divergir do histórico.
   */
  async metricsByProject(projectId: string) {
    const where = { endpoint: { projectId } };

    const [total, successful, aggregate] = await Promise.all([
      this.prisma.requestLog.count({ where }),
      this.prisma.requestLog.count({
        where: { ...where, statusCode: { lt: 400 } },
      }),
      this.prisma.requestLog.aggregate({
        where,
        _avg: { durationMs: true },
        _sum: { rowCount: true },
      }),
    ]);

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: total - successful,
      averageDurationMs:
        aggregate._avg.durationMs === null
          ? null
          : Math.round(aggregate._avg.durationMs),
      totalRows: aggregate._sum.rowCount ?? 0,
    };
  }
}
