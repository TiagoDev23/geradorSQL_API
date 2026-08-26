"use client";

import Link from "next/link";
import { useCallback } from "react";

import * as connectionsApi from "@/lib/api/connections";
import * as queriesApi from "@/lib/api/queries";
import type { SavedQuery } from "@/lib/api/types";
import { formatRelative } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

/**
 * Consultas do projeto.
 *
 * No backend uma consulta pertence a uma conexão, não ao projeto; a
 * listagem percorre as conexões e mostra a origem em cada linha.
 */
export default function QueriesPage() {
  const { project } = useProject();

  const data = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const connections = await connectionsApi.listConnections(
          project.id,
          signal,
        );

        const lists = await Promise.all(
          connections.map((connection) =>
            queriesApi.listQueries(connection.id, signal),
          ),
        );

        const named = new Map(
          connections.map((connection) => [connection.id, connection.name]),
        );

        const queries: (SavedQuery & { connectionName: string })[] = lists
          .flat()
          .map((query) => ({
            ...query,
            connectionName: named.get(query.connectionId) ?? "—",
          }));

        return { hasConnection: connections.length > 0, queries };
      },
      [project.id],
    ),
  );

  const base = `/projects/${project.id}`;

  return (
    <>
      <PageHeader
        title="Consultas"
        description="SELECTs parametrizados que podem virar endpoints."
        actions={
          data.data?.hasConnection ? (
            <Link href={`${base}/queries/new`}>
              <Button variant="primary">Nova consulta</Button>
            </Link>
          ) : null
        }
      />

      <div className="mt-6">
        {data.loading ? (
          <SkeletonRows rows={3} className="[&>*]:h-14" />
        ) : data.error ? (
          <ErrorState message={data.error} onRetry={data.reload} />
        ) : !data.data?.hasConnection ? (
          <EmptyState
            title="Nenhuma conexão configurada."
            description="Uma consulta pertence a uma conexão."
            action={
              <Link
                href={`${base}/database`}
                className="text-[13px] font-medium text-primary"
              >
                Criar conexão
              </Link>
            }
          />
        ) : data.data.queries.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {data.data.queries.map((query) => (
              <li key={query.id}>
                <Link
                  href={`${base}/queries/${query.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {query.name}
                    </span>

                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {query.connectionName}
                      {query.description ? ` · ${query.description}` : ""}
                    </span>
                  </span>

                  {query.parameters.length > 0 ? (
                    <Badge tone="neutral">
                      {query.parameters.length}{" "}
                      {query.parameters.length === 1
                        ? "parâmetro"
                        : "parâmetros"}
                    </Badge>
                  ) : null}

                  <span className="text-[12px] text-ink-subtle">
                    {formatRelative(query.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma consulta salva."
            action={
              <Link href={`${base}/queries/new`}>
                <Button variant="primary">Criar primeira consulta</Button>
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
