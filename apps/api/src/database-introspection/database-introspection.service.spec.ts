import { NotFoundException } from '@nestjs/common';
import type { Client } from 'pg';

import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { DatabaseIntrospectionService } from './database-introspection.service';

const CONNECTION_ID = '22222222-2222-4222-8222-222222222222';

interface QueryCall {
  sql: string;
  params: unknown[];
}

/**
 * Simula o cliente `pg` devolvendo respostas por ordem de chamada e
 * registrando o SQL e os parâmetros recebidos.
 */
function buildClient(responses: unknown[][]) {
  const calls: QueryCall[] = [];
  let index = 0;

  const query = jest.fn((sql: string, params?: unknown[]) => {
    calls.push({ sql, params: params ?? [] });

    return Promise.resolve({ rows: responses[index++] ?? [] });
  });

  return { client: { query } as unknown as Client, calls };
}

function buildExternalDatabase(client: Client) {
  return {
    run: jest.fn(
      (
        _id: string,
        operation: (client: Client, info: unknown) => Promise<unknown>,
      ) =>
        operation(client, {
          id: CONNECTION_ID,
          defaultSchema: 'public',
        }),
    ),
  } as unknown as ExternalDatabaseService;
}

describe('DatabaseIntrospectionService', () => {
  describe('listSchemas', () => {
    it('exclui schemas internos do PostgreSQL na consulta', async () => {
      const { client, calls } = buildClient([
        [{ name: 'public', owner: 'gerador' }],
      ]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      const schemas = await service.listSchemas(CONNECTION_ID);

      expect(schemas).toEqual([{ name: 'public', owner: 'gerador' }]);
      expect(calls[0].sql).toContain("!~ '^pg_'");
      expect(calls[0].sql).toContain("<> 'information_schema'");
    });
  });

  describe('listTables', () => {
    it('passa o schema como parâmetro posicional, não concatenado', async () => {
      const { client, calls } = buildClient([[]]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      await service.listTables(CONNECTION_ID, "public'; DROP TABLE x;--");

      expect(calls[0].params).toEqual(["public'; DROP TABLE x;--"]);
      expect(calls[0].sql).not.toContain('DROP TABLE');
    });

    it('envia null quando nenhum schema é informado', async () => {
      const { client, calls } = buildClient([[]]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      await service.listTables(CONNECTION_ID);

      expect(calls[0].params).toEqual([null]);
    });
  });

  describe('describeTable', () => {
    it('rejeita tabela inexistente', async () => {
      const { client } = buildClient([[]]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      await expect(
        service.describeTable(CONNECTION_ID, 'public', 'ausente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marca as colunas que compõem a chave primária', async () => {
      const { client } = buildClient([
        [{ schema: 'public', name: 'produtos', type: 'TABLE' }],
        [
          {
            name: 'id',
            position: 1,
            dataType: 'integer',
            nullable: false,
            defaultValue: null,
          },
          {
            name: 'nome',
            position: 2,
            dataType: 'text',
            nullable: true,
            defaultValue: null,
          },
        ],
        [{ name: 'produtos_pkey', column: 'id' }],
        [],
      ]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      const table = await service.describeTable(
        CONNECTION_ID,
        'public',
        'produtos',
      );

      expect(table.columns[0].isPrimaryKey).toBe(true);
      expect(table.columns[1].isPrimaryKey).toBe(false);
      expect(table.primaryKey).toEqual({
        name: 'produtos_pkey',
        columns: ['id'],
      });
    });

    it('devolve null quando a tabela não possui chave primária', async () => {
      const { client } = buildClient([
        [{ schema: 'public', name: 'log', type: 'TABLE' }],
        [],
        [],
        [],
      ]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      const table = await service.describeTable(CONNECTION_ID, 'public', 'log');

      expect(table.primaryKey).toBeNull();
      expect(table.foreignKeys).toEqual([]);
    });

    it('agrupa chave estrangeira composta em uma única relação', async () => {
      const { client } = buildClient([
        [{ schema: 'public', name: 'itens_pedido', type: 'TABLE' }],
        [],
        [],
        [
          {
            name: 'itens_pedido_produto_fkey',
            column: 'produto_id',
            referencedSchema: 'public',
            referencedTable: 'produtos',
            referencedColumn: 'id',
          },
          {
            name: 'itens_pedido_produto_fkey',
            column: 'loja_id',
            referencedSchema: 'public',
            referencedTable: 'produtos',
            referencedColumn: 'loja_id',
          },
          {
            name: 'itens_pedido_pedido_fkey',
            column: 'pedido_id',
            referencedSchema: 'public',
            referencedTable: 'pedidos',
            referencedColumn: 'id',
          },
        ],
      ]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      const table = await service.describeTable(
        CONNECTION_ID,
        'public',
        'itens_pedido',
      );

      expect(table.foreignKeys).toHaveLength(2);

      expect(table.foreignKeys[0]).toEqual({
        name: 'itens_pedido_produto_fkey',
        columns: ['produto_id', 'loja_id'],
        referencedSchema: 'public',
        referencedTable: 'produtos',
        referencedColumns: ['id', 'loja_id'],
      });

      expect(table.foreignKeys[1].columns).toEqual(['pedido_id']);
    });

    it('passa schema e tabela como parâmetros posicionais', async () => {
      const { client, calls } = buildClient([
        [{ schema: 'public', name: 'produtos', type: 'TABLE' }],
        [],
        [],
        [],
      ]);

      const service = new DatabaseIntrospectionService(
        buildExternalDatabase(client),
      );

      await service.describeTable(CONNECTION_ID, 'public', 'produtos');

      for (const call of calls) {
        expect(call.params).toEqual(['public', 'produtos']);
      }
    });
  });
});
