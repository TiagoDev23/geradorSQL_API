"use client";

import Link from "next/link";
import { use, useCallback, useMemo } from "react";

import * as projectsApi from "@/lib/api/projects";
import { ProjectProvider } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { AppShell } from "@/components/shell/app-shell";
import { ProjectNav } from "@/components/shell/project-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

/**
 * Ambiente do projeto: navegação lateral fixa e o projeto carregado uma
 * única vez para as páginas da seção.
 */
export default function ProjectLayout({
  params,
  children,
}: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = use(params);

  const project = useResource(
    useCallback(
      (signal: AbortSignal) => projectsApi.getProject(projectId, signal),
      [projectId],
    ),
  );

  const value = useMemo(
    () =>
      project.data ? { project: project.data, reload: project.reload } : null,
    [project.data, project.reload],
  );

  return (
    <AppShell
      sidebar={<ProjectNav projectId={projectId} />}
      context={
        project.data ? (
          <Link
            href={`/projects/${projectId}`}
            className="truncate text-[14px] font-medium text-ink"
          >
            {project.data.name}
          </Link>
        ) : (
          <Skeleton className="h-4 w-28" />
        )
      }
    >
      {project.error ? (
        <ErrorState message={project.error} onRetry={project.reload} />
      ) : value ? (
        <ProjectProvider value={value}>{children}</ProjectProvider>
      ) : (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </AppShell>
  );
}
