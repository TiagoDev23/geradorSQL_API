import { ExternalDatabaseService } from '../database-connections/external-database.service';
import {
  buildParameterValues,
  ParameterDefinition,
} from './parameter-coercion';
import { assertReadOnlySelect } from './sql-validator';

/**
 * Execução de uma consulta parametrizada em banco externo.
 *
 * Vive fora dos services para ser compartilhada pela execução de teste
 * de uma consulta salva e pelo runtime que atende endpoints publicados:
 * as duas precisam exatamente das mesmas garantias de segurança, e
 * duplicá-las abriria espaço para divergirem.
 */

export interface QueryExecutionRequest {
  sql: string;
  connectionId: string;
  parameters: ParameterDefinition[];
  /** Valores recebidos, indexados pelo nome do parâmetro. */
  received: Record<string, unknown>;
  maxRows: number;
}

export interface QueryExecutionResult {
  columns: { name: string; dataTypeId: number }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  maxRows: number;
  truncated: boolean;
  durationMs: number;
}

/**
 * Aplica o limite envolvendo a consulta original, sem reescrevê-la. O
 * valor é um inteiro controlado pela aplicação, nunca texto do cliente.
 */
function wrapWithLimit(sql: string, maxRows: number): string {
  const withoutTrailing = sql.trim().replace(/;\s*$/, '');

  return `SELECT * FROM (\n${withoutTrailing}\n) AS consulta_limitada LIMIT ${maxRows}`;
}

export async function executeQuery(
  externalDatabase: ExternalDatabaseService,
  request: QueryExecutionRequest,
): Promise<QueryExecutionResult> {
  // Revalidação no momento da execução: o SQL foi validado ao ser
  // gravado, mas as regras podem ter mudado desde então.
  assertReadOnlySelect(request.sql);

  // Conversão antes de conectar: parâmetro inválido não deve custar uma
  // conexão ao banco do usuário.
  const values = buildParameterValues(request.parameters, request.received);

  const startedAt = Date.now();

  const result = await externalDatabase.run(
    request.connectionId,
    async (client) => {
      return client.query<Record<string, unknown>>({
        text: wrapWithLimit(request.sql, request.maxRows),
        values,
      });
    },
  );

  return {
    // dataTypeID é o OID do tipo no PostgreSQL; permite ao cliente
    // distinguir colunas sem inspecionar os valores.
    columns: (result.fields ?? []).map((field) => ({
      name: field.name,
      dataTypeId: field.dataTypeID,
    })),
    rows: result.rows,
    rowCount: result.rows.length,
    maxRows: request.maxRows,
    // Sinaliza que o corte pode ter escondido linhas adicionais.
    truncated: result.rows.length >= request.maxRows,
    durationMs: Date.now() - startedAt,
  };
}
