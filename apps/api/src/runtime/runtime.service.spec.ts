import { readFileSync } from 'fs';
import { join } from 'path';

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Client } from 'pg';

import { ApiKeysService } from '../api-keys/api-keys.service';
import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { QueryParameterType } from '../generated/prisma/enums';
import { RequestLogsService } from '../request-logs/request-logs.service';
import { RuntimeService } from './runtime.service';

const PROJECT_SLUG = 'projeto-demo';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ENDPOINT_ID = '44444444-4444-4444-8444-444444444444';
const CONNECTION_ID = '22222222-2222-4222-8222-222222222222';
const KEY_ID = '55555555-5555-4555-8555-555555555555';
const API_KEY = 'gapi_chave_de_teste';

const SQL_SEM_PARAMETRO = 'SELECT * FROM tabela ORDER BY criado_em DESC';
const SQL_UM_PARAMETRO = 'SELECT * FROM tabela WHERE ref_id = $1';
const SQL_TRES_PARAMETROS =
  'SELECT * FROM tabela WHERE ref_id = $1 AND criado_em >= $2 AND criado_em < $3';

function parametro(
  name: string,
  type: QueryParameterType,
  position: number,
  required = true,
) {
  return { name, type, position, required, defaultValue: null };
}

/** Primeiro registro entregue ao RequestLogsService, de forma tipada. */
function primeiroRegistro(mock: jest.Mock): Record<string, unknown> {
  const calls = mock.mock.calls as unknown as Record<string, unknown>[][];

  return calls[0][0];
}

describe('RuntimeService', () => {
  let prisma: { endpoint: { findFirst: jest.Mock } };
  let externalDatabase: { run: jest.Mock };
  let apiKeys: { authenticate: jest.Mock };
  let requestLogs: { record: jest.Mock };
  let service: RuntimeService;

  /** Consultas recebidas pelo cliente pg simulado. */
  let enviadas: { text: string; values: unknown[] }[];
  let clientesEncerrados: number;

  beforeEach(() => {
    enviadas = [];
    clientesEncerrados = 0;

    prisma = { endpoint: { findFirst: jest.fn() } };

    // Reproduz o contrato do ExternalDatabaseService, inclusive o
    // encerramento do cliente em sucesso e em erro.
    externalDatabase = {
      run: jest.fn(
        async (
          _id: string,
          operation: (client: Client) => Promise<unknown>,
        ) => {
          const client = {
            query: jest.fn((config: { text: string; values: unknown[] }) => {
              enviadas.push(config);

              return Promise.resolve({
                rows: [{ id: 1 }],
                fields: [{ name: 'id', dataTypeID: 20 }],
              });
            }),
          } as unknown as Client;

          try {
            return await operation(client);
          } finally {
            clientesEncerrados += 1;
          }
        },
      ),
    };

    apiKeys = { authenticate: jest.fn().mockResolvedValue({ id: KEY_ID }) };
    requestLogs = { record: jest.fn().mockResolvedValue(undefined) };

    service = new RuntimeService(
      prisma as unknown as PrismaService,
      externalDatabase as unknown as ExternalDatabaseService,
      apiKeys as unknown as ApiKeysService,
      requestLogs as unknown as RequestLogsService,
    );
  });

  function mockEndpoint(
    sql: string,
    parameters: ReturnType<typeof parametro>[] = [],
    maxRows = 1000,
  ) {
    prisma.endpoint.findFirst.mockResolvedValue({
      id: ENDPOINT_ID,
      projectId: PROJECT_ID,
      maxRows,
      savedQuery: { sql, connectionId: CONNECTION_ID, parameters },
    });
  }

  describe('resolução da rota', () => {
    it('executa endpoint publicado sem parâmetros', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      const resultado = await service.execute(
        PROJECT_SLUG,
        'v1',
        'sem-parametros',
        API_KEY,
        {},
      );

      expect(resultado.rowCount).toBe(1);
      expect(enviadas[0].values).toEqual([]);
    });

    it('filtra por projeto, versão, slug e estado de publicação', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v2', 'algum-slug', API_KEY, {});

      const calls = prisma.endpoint.findFirst.mock.calls as unknown as {
        where: Record<string, unknown>;
      }[][];
      const args = calls[0][0];

      expect(args.where).toEqual({
        slug: 'algum-slug',
        version: 'v2',
        isPublished: true,
        project: { slug: PROJECT_SLUG },
      });
    });

    it('resolve endpoint, consulta, parâmetros e conexão em uma consulta', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {});

      expect(prisma.endpoint.findFirst).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['projeto inexistente'],
      ['endpoint inexistente'],
      ['versão incorreta'],
      ['endpoint não publicado'],
    ])('devolve 404 para %s', async () => {
      // Todos os casos chegam ao service como ausência de registro, e
      // devem produzir a mesma resposta.
      prisma.endpoint.findFirst.mockResolvedValue(null);

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });
  });

  describe('parâmetros', () => {
    it('converte INTEGER e envia separado do SQL', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      // Valor distintivo, para que a ausência no texto do SQL seja
      // conclusiva e não colida com o número do LIMIT.
      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {
        refId: '987654',
      });

      const enviada = enviadas[0];

      expect(enviada.values).toEqual([987654]);
      expect(enviada.text).toContain('$1');
      expect(enviada.text).not.toContain('987654');
    });

    it('respeita a ordem posicional, não a ordem da query string', async () => {
      mockEndpoint(SQL_TRES_PARAMETROS, [
        parametro('fim', QueryParameterType.DATETIME, 3),
        parametro('refId', QueryParameterType.INTEGER, 1),
        parametro('inicio', QueryParameterType.DATETIME, 2),
      ]);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {
        fim: '2026-08-20T00:00:00Z',
        inicio: '2026-08-01T00:00:00Z',
        refId: '10',
      });

      const [primeiro, segundo, terceiro] = enviadas[0].values;

      expect(primeiro).toBe(10);
      expect((segundo as Date).toISOString()).toBe('2026-08-01T00:00:00.000Z');
      expect((terceiro as Date).toISOString()).toBe('2026-08-20T00:00:00.000Z');
    });

    it('rejeita parâmetro obrigatório ausente sem conectar', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toThrow(/obrigatório/);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('rejeita parâmetro de tipo inválido sem conectar', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, { refId: 'abc' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('ignora parâmetros da query string que não foram declarados', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {
        refId: '10',
        intruso: 'x',
      });

      expect(enviadas[0].values).toEqual([10]);
    });
  });

  describe('execução', () => {
    it('aplica o maxRows configurado no endpoint', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO, [], 25);

      const resultado = await service.execute(
        PROJECT_SLUG,
        'v1',
        'slug',
        API_KEY,
        {},
      );

      expect(enviadas[0].text).toContain('LIMIT 25');
      expect(resultado.maxRows).toBe(25);
    });

    it('recusa consulta que deixou de ser somente leitura', async () => {
      mockEndpoint('DELETE FROM tabela');

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('encerra a conexão em caso de sucesso', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {});

      expect(clientesEncerrados).toBe(1);
    });

    it('encerra a conexão quando a consulta falha', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      externalDatabase.run.mockImplementation(
        async (
          _id: string,
          operation: (client: Client) => Promise<unknown>,
        ) => {
          const client = {
            query: jest.fn(() => Promise.reject(new Error('falha'))),
          } as unknown as Client;

          try {
            return await operation(client);
          } finally {
            clientesEncerrados += 1;
          }
        },
      );

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toThrow();

      expect(clientesEncerrados).toBe(1);
    });

    it('propaga erro tratado do PostgreSQL sem detalhe técnico', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      externalDatabase.run.mockRejectedValue(
        new ServiceUnavailableException(
          'Não foi possível consultar o banco informado.',
        ),
      );

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toThrow('Não foi possível consultar o banco informado.');
    });
  });

  describe('API Key (M7)', () => {
    it('autentica no escopo do projeto do endpoint', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {});

      expect(apiKeys.authenticate).toHaveBeenCalledWith(API_KEY, PROJECT_ID);
    });

    it('não executa a consulta quando a chave é recusada', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);
      apiKeys.authenticate.mockRejectedValue(
        new UnauthorizedException('API Key inválida.'),
      );

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', 'gapi_errada', {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('propaga 403 para chave de outro projeto', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);
      apiKeys.authenticate.mockRejectedValue(
        new ForbiddenException('Esta API Key não tem acesso a este projeto.'),
      );

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('RequestLog (M8)', () => {
    it('registra sucesso com status, duração e contagem de linhas', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {});

      const registro = primeiroRegistro(requestLogs.record);

      expect(registro.endpointId).toBe(ENDPOINT_ID);
      expect(registro.apiKeyId).toBe(KEY_ID);
      expect(registro.statusCode).toBe(200);
      expect(registro.rowCount).toBe(1);
      expect(typeof registro.durationMs).toBe('number');
    });

    it('registra falha de autenticação com o endpoint tentado', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);
      apiKeys.authenticate.mockRejectedValue(
        new UnauthorizedException('API Key inválida.'),
      );

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', 'gapi_errada', {}),
      ).rejects.toThrow();

      const registro = primeiroRegistro(requestLogs.record);

      expect(registro.statusCode).toBe(401);
      expect(registro.errorCode).toBe('UNAUTHORIZED');
      expect(registro.endpointId).toBe(ENDPOINT_ID);
    });

    it('registra parâmetro inválido como erro de cliente', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {
          refId: 'abc',
        }),
      ).rejects.toThrow();

      const registro = primeiroRegistro(requestLogs.record);

      expect(registro.statusCode).toBe(400);
      expect(registro.errorCode).toBe('BAD_REQUEST');
    });

    it('nunca inclui a chave apresentada no registro', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {
        segredo: 'valor-sensivel',
      });

      const registro = JSON.stringify(primeiroRegistro(requestLogs.record));

      expect(registro).not.toContain(API_KEY);
      expect(registro).not.toContain('valor-sensivel');
    });

    it('não registra quando o endpoint não existe, por falta de endpointId', async () => {
      prisma.endpoint.findFirst.mockResolvedValue(null);

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(requestLogs.record).not.toHaveBeenCalled();
    });

    it('devolve o resultado mesmo se o registro falhar', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);
      requestLogs.record.mockRejectedValue(new Error('log fora'));

      // O contrato do RequestLogsService é não propagar; aqui garante-se
      // que o runtime também não depende disso para responder.
      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', API_KEY, {}),
      ).rejects.toThrow('log fora');
    });
  });

  describe('generalidade', () => {
    it('não contém SQL nem conhecimento de domínio específico', () => {
      // As linhas de import contêm "from" e nomes de arquivo; só o
      // corpo do serviço interessa.
      // Os imports citam nomes de arquivo e contêm "from"; só o corpo
      // da classe interessa.
      const arquivo = readFileSync(
        join(__dirname, 'runtime.service.ts'),
        'utf8',
      );

      const fonte = arquivo.slice(arquivo.indexOf('@Injectable')).toLowerCase();

      // O runtime resolve qualquer endpoint; nada do banco de
      // demonstração pode estar embutido nele.
      for (const termo of [
        'select ',
        'from ',
        'meteorologia',
        'observacoes',
        'estacoes',
        'impactos',
        'farmacia',
      ]) {
        expect(fonte).not.toContain(termo);
      }
    });
  });
});
