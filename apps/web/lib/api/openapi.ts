import { request } from "./client";
import type { OpenApiDocument } from "./types";

export function getOpenApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<OpenApiDocument> {
  return request<OpenApiDocument>(`/projects/${projectId}/openapi`, { signal });
}
