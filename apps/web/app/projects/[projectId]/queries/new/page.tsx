"use client";

import { useCallback } from "react";

import * as connectionsApi from "@/lib/api/connections";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { QueryWorkbench } from "../query-workbench";

/** Criação de consulta: a conexão de destino é escolhida aqui. */
export default function NewQueryPage() {
  const { project } = useProject();

  const connections = useResource(
    useCallback(
      (signal: AbortSignal) =>
        connectionsApi.listConnections(project.id, signal),
      [project.id],
    ),
  );

  if (connections.loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (connections.error) {
    return (
      <ErrorState message={connections.error} onRetry={connections.reload} />
    );
  }

  return (
    <QueryWorkbench
      projectId={project.id}
      connections={connections.data ?? []}
    />
  );
}
