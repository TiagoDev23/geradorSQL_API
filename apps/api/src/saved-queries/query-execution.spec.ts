import { BadRequestException } from '@nestjs/common';
import type { Client, QueryResult } from 'pg';

import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { QueryParameterType } from '../generated/prisma/enums';
import { executeQuery, QueryExecutionRequest } from './query-execution';

/**
 * Executor compartilhado pela execução de teste de uma consulta salva e
 * pelo runtime dos endpoints publicados.
 *
 * O que importa aqui é o que sai daqui em direção ao driver: o texto
 * enviado ao PostgreSQL e o array de valores. Um valor recebido do
 * cliente jamais pode aparecer dentro do texto.
 */

const CONNECTION_ID = '11111111-1111-4111-8111-111111111111';

interface CapturadoPeloDriver {
  text: string;
  values: unknown[];
}

/**
 * Substitui o serviço de banco externo: nenhuma conexão é aberta, e a
 * consulta que seria enviada fica disponível para inspeção.
 */
function driverFalso(rows: Record<string, unknown>[] = []) {
  const capturado: CapturadoPeloDriver[] = [];

  const run = jest.fn(
    async (
      _connectionId: string,
      operation: (client: Client) => Promise<QueryResult>,
    ) => {
      const client = {
        query: (config: CapturadoPeloDriver) => {
          capturado.push(config);

          return Promise.resolve({
            rows,
            fields: Object.keys(rows[0] ?? {}).map((name) => ({
              name,
              dataTypeID: 25,
            })),
          });
        },
      } as unknown as Client;

      return operation(client);
    },
  );

  const externalDatabase = { run } as unknown as ExternalDatabaseService;

  return { externalDatabase, capturado, run };
}

function pedido(
  overrides: Partial<QueryExecutionRequest> = {},
): QueryExecutionRequest {
  return {
    sql: 'SELECT id, nome FROM produtos WHERE categoria = $1',
    connectionId: CONNECTION_ID,
    parameters: [
      {
        name: 'categoria',
        type: QueryParameterType.STRING,
        position: 1,
        required: true,
        defaultValue: null,
      },
    ],
    received: { categoria: 'bebidas' },
    maxRows: 100,
    ...overrides,
  };
}

describe('executeQuery', () => {
  describe('parametrização', () => {
    it('envia os valores separados do texto da consulta', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await executeQuery(externalDatabase, pedido());

      expect(capturado[0].values).toEqual(['bebidas']);
      expect(capturado[0].text).toContain('$1');
      expect(capturado[0].text).not.toContain('bebidas');
    });

    it('ordena os valores pela posição do marcador, não pela ordem recebida', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await executeQuery(
        externalDatabase,
        pedido({
          sql: 'SELECT * FROM leituras WHERE estacao = $1 AND ano = $2',
          parameters: [
            {
              name: 'ano',
              type: QueryParameterType.INTEGER,
              position: 2,
              required: true,
              defaultValue: null,
            },
            {
              name: 'estacao',
              type: QueryParameterType.STRING,
              position: 1,
              required: true,
              defaultValue: null,
            },
          ],
          received: { ano: '2026', estacao: 'sul' },
        }),
      );

      expect(capturado[0].values).toEqual(['sul', 2026]);
    });

    it.each([
      ["' OR 1=1 --", 'tautologia'],
      ['1; DROP TABLE produtos', 'comando encadeado'],
      ["abc'); DELETE FROM produtos; --", 'encerramento de literal'],
      ['*/ UPDATE produtos SET preco = 0 /*', 'fuga de comentário'],
    ])('trata %s apenas como valor (%s)', async (payload) => {
      const { externalDatabase, capturado } = driverFalso();

      await executeQuery(
        externalDatabase,
        pedido({ received: { categoria: payload } }),
      );

      const enviado = capturado[0];

      // O payload chega ao driver como valor e não aparece no texto:
      // o PostgreSQL nunca o interpreta como SQL.
      expect(enviado.values).toEqual([payload]);
      expect(enviado.text).not.toContain(payload);
      expect(enviado.text.toLowerCase()).not.toContain('drop');
      expect(enviado.text.toLowerCase()).not.toContain('delete');
      expect(enviado.text.toLowerCase()).not.toContain('update');
    });

    it('valor parecido com marcador não vira marcador', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await executeQuery(
        externalDatabase,
        pedido({ received: { categoria: '$1' } }),
      );

      // O texto continua com um único marcador, o da própria consulta,
      // e o valor recebido segue como dado.
      expect(capturado[0].text.match(/\$\d+/g)).toEqual(['$1']);
      expect(capturado[0].values).toEqual(['$1']);
    });

    it('recusa valor que não corresponde ao tipo declarado', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await expect(
        executeQuery(
          externalDatabase,
          pedido({
            sql: 'SELECT * FROM leituras WHERE estacao_id = $1',
            parameters: [
              {
                name: 'estacaoId',
                type: QueryParameterType.INTEGER,
                position: 1,
                required: true,
                defaultValue: null,
              },
            ],
            received: { estacaoId: '1 OR 1=1' },
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      // A conversão acontece antes de conectar: um valor inválido não
      // custa uma conexão ao banco do usuário.
      expect(capturado).toHaveLength(0);
    });

    it('recusa parâmetro obrigatório ausente antes de conectar', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await expect(
        executeQuery(externalDatabase, pedido({ received: {} })),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(capturado).toHaveLength(0);
    });
  });

  describe('escopo somente leitura', () => {
    it.each([
      'INSERT INTO produtos (nome) VALUES ($1)',
      'UPDATE produtos SET nome = $1',
      'DELETE FROM produtos WHERE id = $1',
      'DROP TABLE produtos',
      'ALTER TABLE produtos ADD COLUMN x int',
      'CREATE TABLE t (id int)',
      'TRUNCATE produtos',
      'SELECT 1; DROP TABLE produtos',
    ])('revalida e recusa %s no momento da execução', async (sql) => {
      const { externalDatabase, capturado } = driverFalso();

      await expect(
        executeQuery(
          externalDatabase,
          pedido({ sql, parameters: [], received: {} }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(capturado).toHaveLength(0);
    });
  });

  describe('limite de linhas', () => {
    it('aplica o limite envolvendo a consulta, sem reescrevê-la', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await executeQuery(externalDatabase, pedido({ maxRows: 250 }));

      expect(capturado[0].text).toContain('LIMIT 250');
      expect(capturado[0].text).toContain(
        'SELECT id, nome FROM produtos WHERE categoria = $1',
      );
    });

    it('sinaliza truncamento quando o resultado alcança o limite', async () => {
      const linhas = Array.from({ length: 3 }, (_, i) => ({ id: i }));
      const { externalDatabase } = driverFalso(linhas);

      const resultado = await executeQuery(
        externalDatabase,
        pedido({ maxRows: 3 }),
      );

      expect(resultado.rowCount).toBe(3);
      expect(resultado.maxRows).toBe(3);
      expect(resultado.truncated).toBe(true);
    });

    it('não sinaliza truncamento quando o resultado cabe no limite', async () => {
      const { externalDatabase } = driverFalso([{ id: 1 }]);

      const resultado = await executeQuery(
        externalDatabase,
        pedido({ maxRows: 100 }),
      );

      expect(resultado.rowCount).toBe(1);
      expect(resultado.truncated).toBe(false);
    });

    it('o limite vem da aplicação, nunca de texto do cliente', async () => {
      const { externalDatabase, capturado } = driverFalso();

      await executeQuery(
        externalDatabase,
        // Mesmo que um valor tente parecer parte do limite, ele segue
        // como parâmetro.
        pedido({ maxRows: 10, received: { categoria: '10; DROP TABLE x' } }),
      );

      expect(capturado[0].text).toMatch(/LIMIT 10$/);
    });
  });

  describe('resultado', () => {
    it('devolve colunas, contagem e duração', async () => {
      const { externalDatabase } = driverFalso([{ id: 1, nome: 'agua' }]);

      const resultado = await executeQuery(externalDatabase, pedido());

      expect(resultado.columns).toEqual([
        { name: 'id', dataTypeId: 25 },
        { name: 'nome', dataTypeId: 25 },
      ]);
      expect(resultado.rowCount).toBe(1);
      expect(resultado.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('executa contra a conexão da consulta', async () => {
      const { externalDatabase, run } = driverFalso();

      await executeQuery(externalDatabase, pedido());

      expect(run).toHaveBeenCalledWith(CONNECTION_ID, expect.any(Function));
    });
  });
});
