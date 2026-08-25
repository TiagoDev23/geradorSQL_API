import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Client } from 'pg';

import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { QueryParameterType } from '../generated/prisma/enums';
import { SavedQueriesService } from './saved-queries.service';

const CONNECTION_ID = '22222222-2222-4222-8222-222222222222';
const QUERY_ID = '33333333-3333-4333-8333-333333333333';

const SQL_SEM_PARAMETRO =
  'SELECT * FROM meteorologia.vw_observacoes_detalhadas ORDER BY observado_em DESC';

const SQL_COM_PARAMETRO =
  'SELECT * FROM meteorologia.observacoes WHERE estacao_id = $1';

function buildPrismaMock() {
  return {
    databaseConnection: { findUnique: jest.fn() },
    savedQuery: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    endpoint: { count: jest.fn() },
  };
}

interface PrismaCallArgs {
  data: Record<string, unknown>;
  select: Record<string, unknown>;
  where: Record<string, unknown>;
}

function firstCallArgs(mock: jest.Mock): PrismaCallArgs {
  const calls = mock.mock.calls as unknown as PrismaCallArgs[][];

  return calls[0][0];
}

describe('SavedQueriesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let externalDatabase: { run: jest.Mock };
  let service: SavedQueriesService;

  /** Estado de um cliente pg simulado, para conferir o encerramento. */
  let clientState: { queries: { text: string; values: unknown[] }[] };

  beforeEach(() => {
    prisma = buildPrismaMock();
    clientState = { queries: [] };

    // Reproduz o contrato do ExternalDatabaseService: executa a
    // operação e converte erro do PostgreSQL em resposta segura.
    externalDatabase = {
      run: jest.fn(
        async (
          _id: string,
          operation: (client: Client) => Promise<unknown>,
        ) => {
          const client = {
            query: jest.fn((config: { text: string; values: unknown[] }) => {
              clientState.queries.push(config);

              return Promise.resolve({
                rows: [{ id: 1 }],
                fields: [{ name: 'id', dataTypeID: 20 }],
              });
            }),
          } as unknown as Client;

          return operation(client);
        },
      ),
    };

    service = new SavedQueriesService(
      prisma as unknown as PrismaService,
      externalDatabase as unknown as ExternalDatabaseService,
    );

    prisma.databaseConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
    });

    prisma.savedQuery.findUnique.mockResolvedValue(null);
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.savedQuery.create.mockResolvedValue({ id: QUERY_ID });
    });

    it('cria consulta sem parâmetros', async () => {
      await service.create(CONNECTION_ID, {
        name: 'Últimas observações',
        sql: SQL_SEM_PARAMETRO,
      });

      const { data } = firstCallArgs(prisma.savedQuery.create);

      expect(data.name).toBe('Últimas observações');
      expect(data.connectionId).toBe(CONNECTION_ID);
    });

    it('cria consulta com parâmetros', async () => {
      await service.create(CONNECTION_ID, {
        name: 'Por estação',
        sql: SQL_COM_PARAMETRO,
        parameters: [
          {
            name: 'estacaoId',
            type: QueryParameterType.INTEGER,
            position: 1,
          },
        ],
      });

      expect(prisma.savedQuery.create).toHaveBeenCalled();
    });

    it('rejeita conexão inexistente', async () => {
      prisma.databaseConnection.findUnique.mockResolvedValue(null);

      await expect(
        service.create(CONNECTION_ID, {
          name: 'Qualquer',
          sql: SQL_SEM_PARAMETRO,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.savedQuery.create).not.toHaveBeenCalled();
    });

    it('rejeita nome já usado na mesma conexão', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue({ id: 'outra' });

      await expect(
        service.create(CONNECTION_ID, {
          name: 'Repetida',
          sql: SQL_SEM_PARAMETRO,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejeita comando de escrita', async () => {
      await expect(
        service.create(CONNECTION_ID, {
          name: 'Escrita',
          sql: 'DELETE FROM meteorologia.observacoes',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.savedQuery.create).not.toHaveBeenCalled();
    });

    it('rejeita marcador sem parâmetro declarado', async () => {
      await expect(
        service.create(CONNECTION_ID, {
          name: 'Sem declaração',
          sql: SQL_COM_PARAMETRO,
        }),
      ).rejects.toThrow(/\$1/);
    });

    it('rejeita parâmetro declarado sem marcador correspondente', async () => {
      await expect(
        service.create(CONNECTION_ID, {
          name: 'Sobrando',
          sql: SQL_SEM_PARAMETRO,
          parameters: [
            {
              name: 'naoUsado',
              type: QueryParameterType.STRING,
              position: 1,
            },
          ],
        }),
      ).rejects.toThrow(/posição 1/);
    });

    it('rejeita posições repetidas', async () => {
      await expect(
        service.create(CONNECTION_ID, {
          name: 'Duplicada',
          sql: SQL_COM_PARAMETRO,
          parameters: [
            { name: 'a', type: QueryParameterType.INTEGER, position: 1 },
            { name: 'b', type: QueryParameterType.INTEGER, position: 1 },
          ],
        }),
      ).rejects.toThrow(/mais de uma vez/);
    });
  });

  describe('findAllByConnection', () => {
    it('lista as consultas da conexão', async () => {
      prisma.savedQuery.findMany.mockResolvedValue([{ id: QUERY_ID }]);

      const resultado = await service.findAllByConnection(CONNECTION_ID);

      expect(resultado).toHaveLength(1);
    });

    it('rejeita conexão inexistente', async () => {
      prisma.databaseConnection.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllByConnection(CONNECTION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('rejeita consulta inexistente', async () => {
      await expect(service.findOne(QUERY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.savedQuery.findUnique.mockResolvedValue({
        id: QUERY_ID,
        connectionId: CONNECTION_ID,
        name: 'Original',
        sql: SQL_COM_PARAMETRO,
        parameters: [
          {
            name: 'estacaoId',
            type: QueryParameterType.INTEGER,
            position: 1,
            required: true,
            defaultValue: null,
            description: null,
          },
        ],
      });

      prisma.savedQuery.update.mockResolvedValue({ id: QUERY_ID });
    });

    it('atualiza apenas a descrição preservando os parâmetros', async () => {
      await service.update(QUERY_ID, { description: 'nova' });

      const { data } = firstCallArgs(prisma.savedQuery.update);

      expect(data.description).toBe('nova');
      expect(data).not.toHaveProperty('parameters');
    });

    it('substitui integralmente o conjunto de parâmetros', async () => {
      await service.update(QUERY_ID, {
        sql: 'SELECT * FROM t WHERE a = $1 AND b = $2',
        parameters: [
          { name: 'a', type: QueryParameterType.INTEGER, position: 1 },
          { name: 'b', type: QueryParameterType.STRING, position: 2 },
        ],
      });

      const { data } = firstCallArgs(prisma.savedQuery.update);
      const parameters = data.parameters as { deleteMany: unknown };

      expect(parameters.deleteMany).toEqual({});
    });

    it('rejeita novo SQL com comando de escrita', async () => {
      await expect(
        service.update(QUERY_ID, { sql: 'DROP TABLE referencia.estados' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita SQL cujos marcadores não batem com os parâmetros atuais', async () => {
      await expect(
        service.update(QUERY_ID, {
          sql: 'SELECT * FROM t WHERE a = $1 AND b = $2',
        }),
      ).rejects.toThrow(/\$2/);
    });

    it('rejeita consulta inexistente', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue(null);

      await expect(
        service.update(QUERY_ID, { description: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.savedQuery.findUnique.mockResolvedValue({
        id: QUERY_ID,
        connectionId: CONNECTION_ID,
        sql: SQL_SEM_PARAMETRO,
        parameters: [],
      });
    });

    it('remove quando não há endpoints associados', async () => {
      prisma.endpoint.count.mockResolvedValue(0);

      await service.remove(QUERY_ID);

      expect(prisma.savedQuery.delete).toHaveBeenCalledWith({
        where: { id: QUERY_ID },
      });
    });

    it('recusa a remoção quando há endpoints associados', async () => {
      prisma.endpoint.count.mockResolvedValue(1);

      await expect(service.remove(QUERY_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(prisma.savedQuery.delete).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    function mockQuery(sql: string, parameters: unknown[] = []) {
      prisma.savedQuery.findUnique.mockResolvedValue({
        id: QUERY_ID,
        connectionId: CONNECTION_ID,
        sql,
        parameters,
      });
    }

    it('executa consulta sem parâmetros', async () => {
      mockQuery(SQL_SEM_PARAMETRO);

      const resultado = await service.execute(QUERY_ID, {});

      expect(resultado.rowCount).toBe(1);
      expect(resultado.columns).toEqual([{ name: 'id', dataTypeId: 20 }]);
      expect(clientState.queries[0].values).toEqual([]);
    });

    it('envia os valores ao driver de forma parametrizada', async () => {
      mockQuery(SQL_COM_PARAMETRO, [
        {
          name: 'estacaoId',
          type: QueryParameterType.INTEGER,
          position: 1,
          required: true,
          defaultValue: null,
        },
      ]);

      await service.execute(QUERY_ID, { parameters: { estacaoId: '7' } });

      const enviado = clientState.queries[0];

      // O valor viaja separado do texto: nunca concatenado.
      expect(enviado.values).toEqual([7]);
      expect(enviado.text).not.toContain('7');
      expect(enviado.text).toContain('$1');
    });

    it('rejeita parâmetro obrigatório ausente antes de conectar', async () => {
      mockQuery(SQL_COM_PARAMETRO, [
        {
          name: 'estacaoId',
          type: QueryParameterType.INTEGER,
          position: 1,
          required: true,
          defaultValue: null,
        },
      ]);

      await expect(service.execute(QUERY_ID, {})).rejects.toThrow(
        /obrigatório/,
      );

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('rejeita parâmetro com tipo inválido antes de conectar', async () => {
      mockQuery(SQL_COM_PARAMETRO, [
        {
          name: 'estacaoId',
          type: QueryParameterType.INTEGER,
          position: 1,
          required: true,
          defaultValue: null,
        },
      ]);

      await expect(
        service.execute(QUERY_ID, { parameters: { estacaoId: 'abc' } }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('aplica limite de linhas envolvendo a consulta original', async () => {
      mockQuery(SQL_SEM_PARAMETRO);

      const resultado = await service.execute(QUERY_ID, { maxRows: 5 });

      expect(clientState.queries[0].text).toContain('LIMIT 5');
      expect(resultado.maxRows).toBe(5);
    });

    it('aplica limite padrão quando não informado', async () => {
      mockQuery(SQL_SEM_PARAMETRO);

      const resultado = await service.execute(QUERY_ID, {});

      expect(resultado.maxRows).toBe(100);
    });

    it('revalida o SQL gravado antes de executar', async () => {
      // Simula consulta gravada antes de uma regra de validação existir.
      mockQuery('DELETE FROM meteorologia.observacoes');

      await expect(service.execute(QUERY_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('propaga erro tratado do banco externo sem detalhe técnico', async () => {
      mockQuery(SQL_SEM_PARAMETRO);

      externalDatabase.run.mockRejectedValue(
        new ServiceUnavailableException(
          'Não foi possível consultar o banco informado.',
        ),
      );

      await expect(service.execute(QUERY_ID, {})).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('rejeita consulta inexistente', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue(null);

      await expect(service.execute(QUERY_ID, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
