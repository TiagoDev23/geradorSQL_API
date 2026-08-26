"use client";

import { useCallback, useMemo, useState } from "react";

import * as introspectionApi from "@/lib/api/introspection";
import { useResource } from "@/lib/use-resource";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/ui/states";

/**
 * Navegação da estrutura do banco externo.
 *
 * Só exibe o que a introspecção devolve. Não há diagrama nem
 * espelhamento da estrutura no banco interno: a consulta é feita sob
 * demanda, como no backend.
 */
export function SchemaExplorer({ connectionId }: { connectionId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    schema: string;
    table: string;
  } | null>(null);

  const schemas = useResource(
    useCallback(
      (signal: AbortSignal) =>
        introspectionApi.listSchemas(connectionId, signal),
      [connectionId],
    ),
  );

  // Uma única listagem de tabelas cobre todos os schemas; abrir um nó
  // vira filtro em memória em vez de nova ida ao banco.
  const tables = useResource(
    useCallback(
      (signal: AbortSignal) =>
        introspectionApi.listTables(connectionId, undefined, signal),
      [connectionId],
    ),
  );

  const bySchema = useMemo(() => {
    const grouped = new Map<string, { name: string; type: string }[]>();

    for (const table of tables.data ?? []) {
      const list = grouped.get(table.schema) ?? [];

      list.push({ name: table.name, type: table.type });
      grouped.set(table.schema, list);
    }

    return grouped;
  }, [tables.data]);

  return (
    <section className="mt-8">
      <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
        Estrutura
      </h2>

      <div className="mt-3 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="scroll-slim max-h-[520px] overflow-y-auto rounded-lg border border-line bg-surface p-2">
          {schemas.loading || tables.loading ? (
            <SkeletonRows rows={5} className="[&>*]:h-7" />
          ) : schemas.error ? (
            <ErrorState message={schemas.error} onRetry={schemas.reload} />
          ) : tables.error ? (
            <ErrorState message={tables.error} onRetry={tables.reload} />
          ) : (
            <ul>
              {(schemas.data ?? []).map((schema) => {
                const open = expanded === schema.name;
                const list = bySchema.get(schema.name) ?? [];

                return (
                  <li key={schema.name}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : schema.name)}
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-muted"
                    >
                      <span
                        aria-hidden
                        className={cx(
                          "text-ink-subtle transition-transform",
                          open && "rotate-90",
                        )}
                      >
                        ›
                      </span>

                      <span className="truncate font-mono">{schema.name}</span>

                      <span className="ml-auto text-[11px] text-ink-subtle tabular-nums">
                        {list.length}
                      </span>
                    </button>

                    {open ? (
                      <ul className="mb-1 ml-3 border-l border-line pl-2">
                        {list.length === 0 ? (
                          <li className="px-2 py-1.5 text-[12.5px] text-ink-subtle">
                            Sem tabelas.
                          </li>
                        ) : (
                          list.map((table) => {
                            const active =
                              selected?.schema === schema.name &&
                              selected.table === table.name;

                            return (
                              <li key={table.name}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelected({
                                      schema: schema.name,
                                      table: table.name,
                                    })
                                  }
                                  className={cx(
                                    "flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-[12.5px] transition-colors",
                                    active
                                      ? "bg-primary-soft text-primary"
                                      : "text-ink-muted hover:bg-muted hover:text-ink",
                                  )}
                                >
                                  <span className="truncate">{table.name}</span>

                                  {table.type !== "TABLE" ? (
                                    <span className="ml-auto shrink-0 text-[10px] text-ink-subtle uppercase">
                                      {table.type === "VIEW" ? "view" : "mat"}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <TableDetailPanel
            connectionId={connectionId}
            schema={selected.schema}
            table={selected.table}
          />
        ) : (
          <EmptyState
            title="Selecione uma tabela."
            description="As colunas, a chave primária e os relacionamentos aparecem aqui."
          />
        )}
      </div>
    </section>
  );
}

function TableDetailPanel({
  connectionId,
  schema,
  table,
}: {
  connectionId: string;
  schema: string;
  table: string;
}) {
  const detail = useResource(
    useCallback(
      (signal: AbortSignal) =>
        introspectionApi.describeTable(connectionId, schema, table, signal),
      [connectionId, schema, table],
    ),
  );

  if (detail.loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (detail.error) {
    return <ErrorState message={detail.error} onRetry={detail.reload} />;
  }

  if (!detail.data) {
    return null;
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm text-ink">
          {detail.data.schema}.{detail.data.name}
        </p>

        <Badge tone="neutral">{detail.data.type.toLowerCase()}</Badge>
      </div>

      <TableFrame>
        <Table>
          <thead>
            <tr>
              <Th>Coluna</Th>
              <Th>Tipo</Th>
              <Th>Nulo</Th>
              <Th>Padrão</Th>
            </tr>
          </thead>

          <tbody>
            {detail.data.columns.map((column) => (
              <Tr key={column.name}>
                <Td mono>
                  <span className="flex items-center gap-1.5">
                    {column.name}

                    {column.isPrimaryKey ? (
                      <span
                        title="Chave primária"
                        className="rounded bg-primary-soft px-1 text-[10px] font-semibold text-primary"
                      >
                        PK
                      </span>
                    ) : null}
                  </span>
                </Td>

                <Td mono className="text-ink-muted">
                  {column.dataType}
                </Td>

                <Td className="text-ink-muted">
                  {column.nullable ? "sim" : "não"}
                </Td>

                <Td mono className="max-w-[220px] truncate text-ink-muted">
                  {column.defaultValue ?? "—"}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableFrame>

      {detail.data.foreignKeys.length > 0 ? (
        <div className="mt-4">
          <p className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">
            Relacionamentos
          </p>

          <ul className="mt-2 flex flex-col gap-1">
            {detail.data.foreignKeys.map((key) => (
              <li
                key={key.name}
                className="font-mono text-[12.5px] text-ink-muted"
              >
                {key.columns.join(", ")}
                <span className="mx-1.5 text-ink-subtle">→</span>
                {key.referencedSchema}.{key.referencedTable}(
                {key.referencedColumns.join(", ")})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
