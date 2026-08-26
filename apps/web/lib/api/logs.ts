import { request } from "./client";
import type { ProjectMetrics, RequestLog } from "./types";

export function listLogs(
  projectId: string,
  options: { take?: number; skip?: number } = {},
  signal?: AbortSignal,
): Promise<RequestLog[]> {
  const query = new URLSearchParams();

  if (options.take !== undefined) query.set("take", String(options.take));
  if (options.skip !== undefined) query.set("skip", String(options.skip));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return request<RequestLog[]>(`/projects/${projectId}/logs${suffix}`, {
    signal,
  });
}

export function getMetrics(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectMetrics> {
  return request<ProjectMetrics>(`/projects/${projectId}/metrics`, { signal });
}
