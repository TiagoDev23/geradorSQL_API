"use client";

import type { QueryExecutionResult } from "@/lib/api/types";
import { formatCell, formatDuration, formatNumber } from "@/lib/format";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

/**
 * Resultado de uma execução.
 *
 * As colunas vêm do próprio resultado, então a tabela é montada em
 * tempo de execução. O backend já limita as linhas por `maxRows`; a
 * interface apenas informa quando o corte pode ter escondido registros.
 */
export function ResultTable({ result }: { result: QueryExecutionResult }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
        <span className="font-medium text-ink">
          {formatNumber(result.rowCount)}{" "}
          {result.rowCount === 1 ? "registro" : "registros"}
        </span>

        <span>{formatDuration(result.durationMs)}</span>

        {result.truncated ? (
          <span className="text-warning">
            Exibindo os primeiros {formatNumber(result.maxRows)} registros.
          </span>
        ) : null}
      </p>

      {result.rowCount === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-muted">
          A consulta não retornou registros.
        </p>
      ) : (
        <TableFrame className="max-h-[420px] overflow-y-auto">
          <Table>
            <thead className="sticky top-0 bg-surface">
              <tr>
                {result.columns.map((column) => (
                  <Th key={column.name}>{column.name}</Th>
                ))}
              </tr>
            </thead>

            <tbody>
              {result.rows.map((row, index) => (
                <Tr key={index}>
                  {result.columns.map((column) => {
                    const cell = formatCell(row[column.name]);

                    return (
                      <Td key={column.name} mono>
                        <span
                          title={cell.text}
                          className={
                            cell.isNull
                              ? "text-ink-subtle italic"
                              : "block max-w-[280px] truncate"
                          }
                        >
                          {cell.text}
                        </span>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      )}
    </div>
  );
}
