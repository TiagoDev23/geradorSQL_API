"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import * as connectionsApi from "@/lib/api/connections";
import * as endpointsApi from "@/lib/api/endpoints";
import * as queriesApi from "@/lib/api/queries";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { EndpointDialog } from "@/components/endpoint-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export default function EndpointsPage() {
  const { project, reload: reloadProject } = useProject();
  const { notify } = useToast();

  const [creating, setCreating] = useState(false);

  const endpoints = useResource(
    useCallback(
      (signal: AbortSignal) => endpointsApi.listEndpoints(project.id, signal),
      [project.id],
    ),
  );

  // Consultas disponíveis para publicar; sem nenhuma, não há endpoint
  // possível.
  const queries = useResource(
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

        return lists.flat();
      },
      [project.id],
    ),
  );

  const base = `/projects/${project.id}`;
  const canCreate = (queries.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Endpoints"
        description="Rotas REST atendidas pelo runtime a partir das consultas."
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Novo endpoint
            </Button>
          ) : null
        }
      />

      <div className="mt-6">
        {endpoints.loading || queries.loading ? (
          <SkeletonRows rows={3} className="[&>*]:h-14" />
        ) : endpoints.error ? (
          <ErrorState message={endpoints.error} onRetry={endpoints.reload} />
        ) : !canCreate && (endpoints.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Nenhuma consulta salva."
            description="Um endpoint publica uma consulta existente."
            action={
              <Link
                href={`${base}/queries`}
                className="text-[13px] font-medium text-primary"
              >
                Criar consulta
              </Link>
            }
          />
        ) : endpoints.data && endpoints.data.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {endpoints.data.map((endpoint) => (
              <li key={endpoint.id}>
                <Link
                  href={`${base}/endpoints/${endpoint.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <Badge tone="neutral" className="font-mono">
                    GET
                  </Badge>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] text-ink">
                      {endpoint.runtimePath}
                    </span>

                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {endpoint.name}
                    </span>
                  </span>

                  {endpoint.isPublished ? (
                    <Badge tone="success" dot>
                      Publicado
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      Rascunho
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhum endpoint criado."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Criar endpoint
              </Button>
            }
          />
        )}
      </div>

      <EndpointDialog
        open={creating}
        projectId={project.id}
        queries={queries.data ?? []}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          endpoints.reload();
          reloadProject();
          notify("Endpoint criado.");
        }}
      />
    </>
  );
}
