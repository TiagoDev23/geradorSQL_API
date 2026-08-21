import { Injectable, NotFoundException } from '@nestjs/common';

import { ExternalDatabaseService } from '../database-connections/external-database.service';

/**
 * A introspecção é feita sob demanda, sem espelhar a estrutura do banco
 * do usuário no banco interno da plataforma. As consultas usam
 * `pg_catalog` em vez de `information_schema` porque precisam de
 * informação que o padrão não expõe de forma confiável: a ordem das
 * colunas em chaves compostas e o tipo formatado da coluna.
 *
 * Schema e tabela chegam sempre como parâmetros posicionais, nunca
 * concatenados ao SQL.
 */

const SCHEMAS_SQL = `
  SELECT
    n.nspname AS name,
    pg_catalog.pg_get_userbyid(n.nspowner) AS owner
  FROM pg_catalog.pg_namespace n
  WHERE n.nspname !~ '^pg_'
    AND n.nspname <> 'information_schema'
  ORDER BY n.nspname
`;

const TABLES_SQL = `
  SELECT
    n.nspname AS schema,
    c.relname AS name,
    CASE c.relkind
      WHEN 'r' THEN 'TABLE'
      WHEN 'p' THEN 'TABLE'
      WHEN 'v' THEN 'VIEW'
      WHEN 'm' THEN 'MATERIALIZED_VIEW'
    END AS type
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm')
    AND n.nspname !~ '^pg_'
    AND n.nspname <> 'information_schema'
    AND ($1::text IS NULL OR n.nspname = $1)
  ORDER BY n.nspname, c.relname
`;

const TABLE_SQL = `
  SELECT
    n.nspname AS schema,
    c.relname AS name,
    CASE c.relkind
      WHEN 'r' THEN 'TABLE'
      WHEN 'p' THEN 'TABLE'
      WHEN 'v' THEN 'VIEW'
      WHEN 'm' THEN 'MATERIALIZED_VIEW'
    END AS type
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm')
    AND n.nspname = $1
    AND c.relname = $2
`;

const COLUMNS_SQL = `
  SELECT
    a.attname AS name,
    a.attnum AS position,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS "dataType",
    NOT a.attnotnull AS nullable,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "defaultValue"
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef d
    ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = $1
    AND c.relname = $2
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum
`;

/**
 * `generate_subscripts` percorre `conkey` preservando a ordem das
 * colunas na chave, que é significativa em chaves compostas.
 */
const PRIMARY_KEY_SQL = `
  SELECT
    con.conname AS name,
    att.attname AS column
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL generate_subscripts(con.conkey, 1) AS s(i) ON TRUE
  JOIN pg_catalog.pg_attribute att
    ON att.attrelid = c.oid AND att.attnum = con.conkey[s.i]
  WHERE con.contype = 'p'
    AND n.nspname = $1
    AND c.relname = $2
  ORDER BY s.i
`;

const FOREIGN_KEYS_SQL = `
  SELECT
    con.conname AS name,
    att.attname AS column,
    fn.nspname AS "referencedSchema",
    fc.relname AS "referencedTable",
    fatt.attname AS "referencedColumn"
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_class fc ON fc.oid = con.confrelid
  JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
  JOIN LATERAL generate_subscripts(con.conkey, 1) AS s(i) ON TRUE
  JOIN pg_catalog.pg_attribute att
    ON att.attrelid = c.oid AND att.attnum = con.conkey[s.i]
  JOIN pg_catalog.pg_attribute fatt
    ON fatt.attrelid = fc.oid AND fatt.attnum = con.confkey[s.i]
  WHERE con.contype = 'f'
    AND n.nspname = $1
    AND c.relname = $2
  ORDER BY con.conname, s.i
`;

export interface SchemaSummary {
  name: string;
  owner: string;
}

export interface TableSummary {
  schema: string;
  name: string;
  type: string;
}

export interface ColumnDetail {
  name: string;
  position: number;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface ForeignKeyDetail {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
}

export interface TableDetail extends TableSummary {
  columns: ColumnDetail[];
  primaryKey: { name: string; columns: string[] } | null;
  foreignKeys: ForeignKeyDetail[];
}

interface PrimaryKeyRow {
  name: string;
  column: string;
}

interface ForeignKeyRow {
  name: string;
  column: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

@Injectable()
export class DatabaseIntrospectionService {
  constructor(private readonly externalDatabase: ExternalDatabaseService) {}

  async listSchemas(connectionId: string): Promise<SchemaSummary[]> {
    return this.externalDatabase.run(connectionId, async (client) => {
      const result = await client.query<SchemaSummary>(SCHEMAS_SQL);

      return result.rows;
    });
  }

  /**
   * Sem filtro explícito, lista todos os schemas visíveis. O
   * `defaultSchema` da conexão não é aplicado automaticamente para não
   * esconder estruturas que o usuário talvez queira consultar.
   */
  async listTables(
    connectionId: string,
    schema?: string,
  ): Promise<TableSummary[]> {
    return this.externalDatabase.run(connectionId, async (client) => {
      const result = await client.query<TableSummary>(TABLES_SQL, [
        schema ?? null,
      ]);

      return result.rows;
    });
  }

  async describeTable(
    connectionId: string,
    schema: string,
    table: string,
  ): Promise<TableDetail> {
    return this.externalDatabase.run(connectionId, async (client) => {
      const params = [schema, table];

      const tableResult = await client.query<TableSummary>(TABLE_SQL, params);

      const tableRow = tableResult.rows[0];

      if (!tableRow) {
        throw new NotFoundException(
          `Tabela "${schema}.${table}" não encontrada.`,
        );
      }

      const [columnsResult, primaryKeyResult, foreignKeysResult] =
        await Promise.all([
          client.query<Omit<ColumnDetail, 'isPrimaryKey'>>(COLUMNS_SQL, params),
          client.query<PrimaryKeyRow>(PRIMARY_KEY_SQL, params),
          client.query<ForeignKeyRow>(FOREIGN_KEYS_SQL, params),
        ]);

      const primaryKeyColumns = primaryKeyResult.rows.map((row) => row.column);

      return {
        ...tableRow,

        columns: columnsResult.rows.map((column) => ({
          ...column,
          isPrimaryKey: primaryKeyColumns.includes(column.name),
        })),

        primaryKey: primaryKeyResult.rows[0]
          ? {
              name: primaryKeyResult.rows[0].name,
              columns: primaryKeyColumns,
            }
          : null,

        foreignKeys: groupForeignKeys(foreignKeysResult.rows),
      };
    });
  }
}

/**
 * Cada linha do resultado representa uma coluna de uma constraint. As
 * linhas são agrupadas por nome da constraint para que chaves compostas
 * apareçam como uma única relação.
 */
function groupForeignKeys(rows: ForeignKeyRow[]): ForeignKeyDetail[] {
  const byName = new Map<string, ForeignKeyDetail>();

  for (const row of rows) {
    const existing = byName.get(row.name);

    if (existing) {
      existing.columns.push(row.column);
      existing.referencedColumns.push(row.referencedColumn);

      continue;
    }

    byName.set(row.name, {
      name: row.name,
      columns: [row.column],
      referencedSchema: row.referencedSchema,
      referencedTable: row.referencedTable,
      referencedColumns: [row.referencedColumn],
    });
  }

  return [...byName.values()];
}
