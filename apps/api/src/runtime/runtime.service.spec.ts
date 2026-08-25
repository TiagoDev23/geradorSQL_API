import { readFileSync } from 'fs';
import { join } from 'path';

import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Client } from 'pg';

import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { QueryParameterType } from '../generated/prisma/enums';
import { RuntimeService } from './runtime.service';

const PROJECT_SLUG = 'projeto-demo';
const CONNECTION_ID = '22222222-2222-4222-8222-222222222222';

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

describe('RuntimeService', () => {
  let prisma: { endpoint: { findFirst: jest.Mock } };
  let externalDatabase: { run: jest.Mock };
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

    service = new RuntimeService(
      prisma as unknown as PrismaService,
      externalDatabase as unknown as ExternalDatabaseService,
    );
  });

  function mockEndpoint(
    sql: string,
    parameters: ReturnType<typeof parametro>[] = [],
    maxRows = 1000,
  ) {
    prisma.endpoint.findFirst.mockResolvedValue({
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
        {},
      );

      expect(resultado.rowCount).toBe(1);
      expect(enviadas[0].values).toEqual([]);
    });

    it('filtra por projeto, versão, slug e estado de publicação', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v2', 'algum-slug', {});

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

      await service.execute(PROJECT_SLUG, 'v1', 'slug', {});

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
        service.execute(PROJECT_SLUG, 'v1', 'slug', {}),
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
      await service.execute(PROJECT_SLUG, 'v1', 'slug', { refId: '987654' });

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

      await service.execute(PROJECT_SLUG, 'v1', 'slug', {
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
        service.execute(PROJECT_SLUG, 'v1', 'slug', {}),
      ).rejects.toThrow(/obrigatório/);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('rejeita parâmetro de tipo inválido sem conectar', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', { refId: 'abc' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('ignora parâmetros da query string que não foram declarados', async () => {
      mockEndpoint(SQL_UM_PARAMETRO, [
        parametro('refId', QueryParameterType.INTEGER, 1),
      ]);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', {
        refId: '10',
        intruso: 'x',
      });

      expect(enviadas[0].values).toEqual([10]);
    });
  });

  describe('execução', () => {
    it('aplica o maxRows configurado no endpoint', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO, [], 25);

      const resultado = await service.execute(PROJECT_SLUG, 'v1', 'slug', {});

      expect(enviadas[0].text).toContain('LIMIT 25');
      expect(resultado.maxRows).toBe(25);
    });

    it('recusa consulta que deixou de ser somente leitura', async () => {
      mockEndpoint('DELETE FROM tabela');

      await expect(
        service.execute(PROJECT_SLUG, 'v1', 'slug', {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(externalDatabase.run).not.toHaveBeenCalled();
    });

    it('encerra a conexão em caso de sucesso', async () => {
      mockEndpoint(SQL_SEM_PARAMETRO);

      await service.execute(PROJECT_SLUG, 'v1', 'slug', {});

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
        service.execute(PROJECT_SLUG, 'v1', 'slug', {}),
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
        service.execute(PROJECT_SLUG, 'v1', 'slug', {}),
      ).rejects.toThrow('Não foi possível consultar o banco informado.');
    });
  });

  describe('generalidade', () => {
    it('não contém SQL nem conhecimento de domínio específico', () => {
      // As linhas de import contêm "from" e nomes de arquivo; só o
      // corpo do serviço interessa.
      const fonte = readFileSync(join(__dirname, 'runtime.service.ts'), 'utf8')
        .split(/\r?\n/)
        .filter((linha) => !linha.trimStart().startsWith('import'))
        .join(' ')
        .toLowerCase();

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
