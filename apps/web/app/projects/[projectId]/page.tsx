"use client";

import Link from "next/link";
import { useCallback } from "react";

import * as connectionsApi from "@/lib/api/connections";
import * as endpointsApi from "@/lib/api/endpoints";
import * as logsApi from "@/lib/api/logs";
import * as queriesApi from "@/lib/api/queries";
import { formatNumber } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/states";
import { ProjectSettings } from "./project-settings";

/**
 * Visão geral: onde o projeto está e para onde ir agora. Só números que
 * o backend realmente fornece.
 */
export default function ProjectOverviewPage() {
  const { project, reload: reloadProject } = useProject();

  const endpoints = useResource(
    useCallback(
      (signal: AbortSignal) => endpointsApi.listEndpoints(project.id, signal),
      [project.id],
    ),
  );

  const metrics = useResource(
    useCallback(
      (signal: AbortSignal) => logsApi.getMetrics(project.id, signal),
      [project.id],
    ),
  );

  // A contagem de consultas não existe no projeto: elas pertencem às
  // conexões, e são somadas a partir delas.
  const queries = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const connections = await connectionsApi.listConnections(
          project.id,
          signal,
        );

        const perConnection = await Promise.all(
          connections.map((connection) =>
            queriesApi.listQueries(connection.id, signal),
          ),
        );

        return {
          connections,
          total: perConnection.reduce((sum, list) => sum + list.length, 0),
        };
      },
      [project.id],
    ),
  );

  const published = endpoints.data?.filter((item) => item.isPublished) ?? [];
  const hasConnection = (queries.data?.connections.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{project.slug}</span>

            {queries.loading ? null : hasConnection ? (
              <Badge tone="success" dot>
                Banco configurado
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                Sem banco
              </Badge>
            )}
          </span>
        }
        actions={<ProjectSettings project={project} onSaved={reloadProject} />}
      />

      {project.description ? (
        <p className="mt-3 max-w-2xl text-[13px] text-ink-muted">
          {project.description}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Conexões"
          value={formatNumber(project._count.connections)}
        />

        <Stat
          label="Consultas"
          value={queries.loading ? "—" : formatNumber(queries.data?.total ?? 0)}
        />

        <Stat
          label="Endpoints publicados"
          value={endpoints.loading ? "—" : formatNumber(published.length)}
          hint={
            endpoints.data
              ? `${formatNumber(endpoints.data.length)} no total`
              : undefined
          }
        />

        <Stat
          label="Requisições"
          value={
            metrics.loading
              ? "—"
              : formatNumber(metrics.data?.totalRequests ?? 0)
          }
          hint={
            metrics.data?.averageDurationMs !== null &&
            metrics.data?.averageDurationMs !== undefined
              ? `${formatNumber(metrics.data.averageDurationMs)} ms em média`
              : undefined
          }
        />
      </div>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
          Endpoints
        </h2>

        <div className="mt-3">
          {endpoints.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : published.length > 0 ? (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {published.slice(0, 6).map((endpoint) => (
                <li key={endpoint.id}>
                  <Link
                    href={`/projects/${project.id}/endpoints/${endpoint.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <Badge tone="neutral" className="font-mono">
                      GET
                    </Badge>

                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">
                      {endpoint.runtimePath}
                    </span>

                    <Badge tone="success" dot>
                      Publicado
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={
                hasConnection
                  ? "Nenhum endpoint publicado."
                  : "Conecte um PostgreSQL para começar."
              }
              action={
                <Link
                  href={
                    hasConnection
                      ? `/projects/${project.id}/endpoints`
                      : `/projects/${project.id}/database`
                  }
                  className="text-[13px] font-medium text-primary"
                >
                  {hasConnection ? "Ir para endpoints" : "Criar conexão"}
                </Link>
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
