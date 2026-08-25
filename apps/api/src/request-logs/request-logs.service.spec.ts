import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { RequestLogsService, toErrorCode } from './request-logs.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ENDPOINT_ID = '44444444-4444-4444-8444-444444444444';
const KEY_ID = '55555555-5555-4555-8555-555555555555';

function buildPrismaMock() {
  return {
    requestLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };
}

interface PrismaCallArgs {
  data: Record<string, unknown>;
  where: Record<string, unknown>;
  take: number;
  skip: number;
  orderBy: Record<string, unknown>;
}

function firstCallArgs(mock: jest.Mock): PrismaCallArgs {
  const calls = mock.mock.calls as unknown as PrismaCallArgs[][];

  return calls[0][0];
}

describe('toErrorCode', () => {
  it.each([
    [new BadRequestException('x'), 400, 'BAD_REQUEST'],
    [new UnauthorizedException('x'), 401, 'UNAUTHORIZED'],
    [new ServiceUnavailableException('x'), 503, 'SERVICE_UNAVAILABLE'],
    [new Error('falha interna'), 500, 'INTERNAL_ERROR'],
  ])('mapeia %#', (error, statusCode, errorCode) => {
    expect(toErrorCode(error)).toEqual({ statusCode, errorCode });
  });

  it('usa código curto, sem a mensagem da exceção', () => {
    const resultado = toErrorCode(
      new BadRequestException('O parâmetro "estacaoId" é obrigatório.'),
    );

    expect(resultado.errorCode).toBe('BAD_REQUEST');
    expect(resultado.errorCode).not.toContain('estacaoId');
  });
});

describe('RequestLogsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: RequestLogsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new RequestLogsService(prisma as unknown as PrismaService);
    prisma.requestLog.create.mockResolvedValue({});
  });

  describe('record', () => {
    it('grava status, duração e contagem de linhas', async () => {
      await service.record({
        endpointId: ENDPOINT_ID,
        apiKeyId: KEY_ID,
        statusCode: 200,
        durationMs: 38,
        rowCount: 20,
      });

      const { data } = firstCallArgs(prisma.requestLog.create);

      expect(data).toEqual({
        endpointId: ENDPOINT_ID,
        apiKeyId: KEY_ID,
        statusCode: 200,
        durationMs: 38,
        rowCount: 20,
      });
    });

    it('grava erro com código curto e sem contagem de linhas', async () => {
      await service.record({
        endpointId: ENDPOINT_ID,
        statusCode: 401,
        durationMs: 5,
        errorCode: 'UNAUTHORIZED',
      });

      const { data } = firstCallArgs(prisma.requestLog.create);

      expect(data.errorCode).toBe('UNAUTHORIZED');
      expect(data).not.toHaveProperty('rowCount');
      expect(data).not.toHaveProperty('apiKeyId');
    });

    it('não persiste chave, credencial, parâmetros nem SQL', async () => {
      await service.record({
        endpointId: ENDPOINT_ID,
        apiKeyId: KEY_ID,
        statusCode: 200,
        durationMs: 10,
        rowCount: 1,
      });

      const { data } = firstCallArgs(prisma.requestLog.create);
      const gravado = JSON.stringify(data);

      for (const proibido of [
        'gapi_',
        'password',
        'sql',
        'select',
        'parameters',
        'token',
      ]) {
        expect(gravado.toLowerCase()).not.toContain(proibido);
      }

      // Apenas o identificador da chave, jamais o valor dela.
      expect(data.apiKeyId).toBe(KEY_ID);
    });

    it('não propaga falha de persistência', async () => {
      prisma.requestLog.create.mockRejectedValue(new Error('banco fora'));

      await expect(
        service.record({
          endpointId: ENDPOINT_ID,
          statusCode: 200,
          durationMs: 10,
        }),
      ).resolves.toBeUndefined();
    });

    it('não expõe dados da requisição ao falhar', async () => {
      const aviso = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => undefined);

      prisma.requestLog.create.mockRejectedValue(new Error('banco fora'));

      await service.record({
        endpointId: ENDPOINT_ID,
        apiKeyId: KEY_ID,
        statusCode: 200,
        durationMs: 10,
      });

      const mensagem = String(aviso.mock.calls[0][0]);

      expect(mensagem).toContain(ENDPOINT_ID);
      expect(mensagem).not.toContain(KEY_ID);

      aviso.mockRestore();
    });
  });

  describe('findByProject', () => {
    it('filtra pelo projeto e ordena do mais recente', async () => {
      prisma.requestLog.findMany.mockResolvedValue([]);

      await service.findByProject(PROJECT_ID);

      const args = firstCallArgs(prisma.requestLog.findMany);

      expect(args.where).toEqual({ endpoint: { projectId: PROJECT_ID } });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('limita a quantidade devolvida mesmo se pedirem mais', async () => {
      prisma.requestLog.findMany.mockResolvedValue([]);

      await service.findByProject(PROJECT_ID, 10000);

      expect(firstCallArgs(prisma.requestLog.findMany).take).toBe(200);
    });
  });

  describe('metricsByProject', () => {
    function mockMetrics(total: number, sucesso: number, media: number | null) {
      prisma.requestLog.count
        .mockResolvedValueOnce(total)
        .mockResolvedValueOnce(sucesso);

      prisma.requestLog.aggregate.mockResolvedValue({
        _avg: { durationMs: media },
        _sum: { rowCount: 120 },
      });
    }

    it('conta requisições e separa sucesso de erro', async () => {
      mockMetrics(10, 7, 41.6);

      const metricas = await service.metricsByProject(PROJECT_ID);

      expect(metricas.totalRequests).toBe(10);
      expect(metricas.successfulRequests).toBe(7);
      expect(metricas.failedRequests).toBe(3);
    });

    it('arredonda a duração média', async () => {
      mockMetrics(10, 10, 41.6);

      expect(
        (await service.metricsByProject(PROJECT_ID)).averageDurationMs,
      ).toBe(42);
    });

    it('devolve média nula quando não há registros', async () => {
      mockMetrics(0, 0, null);

      const metricas = await service.metricsByProject(PROJECT_ID);

      expect(metricas.totalRequests).toBe(0);
      expect(metricas.averageDurationMs).toBeNull();
    });

    it('considera sucesso apenas status abaixo de 400', async () => {
      mockMetrics(5, 5, 10);

      await service.metricsByProject(PROJECT_ID);

      const chamadas = prisma.requestLog.count.mock
        .calls as unknown as PrismaCallArgs[][];

      expect(chamadas[1][0].where).toEqual({
        endpoint: { projectId: PROJECT_ID },
        statusCode: { lt: 400 },
      });
    });
  });
});
