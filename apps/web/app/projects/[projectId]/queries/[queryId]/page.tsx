"use client";

import { use, useCallback } from "react";

import * as connectionsApi from "@/lib/api/connections";
import * as queriesApi from "@/lib/api/queries";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { QueryWorkbench } from "../query-workbench";

export default function QueryPage({
  params,
}: PageProps<"/projects/[projectId]/queries/[queryId]">) {
  const { queryId } = use(params);
  const { project } = useProject();

  const data = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const [query, connections] = await Promise.all([
          queriesApi.getQuery(queryId, signal),
          connectionsApi.listConnections(project.id, signal),
        ]);

        return { query, connections };
      },
      [queryId, project.id],
    ),
  );

  if (data.loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.reload} />;
  }

  if (!data.data) {
    return null;
  }

  return (
    <QueryWorkbench
      // Recriar a tela ao trocar de consulta evita reaproveitar o estado
      // do formulário anterior.
      key={data.data.query.id}
      projectId={project.id}
      connections={data.data.connections}
      query={data.data.query}
    />
  );
}
