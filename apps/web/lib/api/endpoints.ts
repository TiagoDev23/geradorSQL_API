import { request } from "./client";
import type { Endpoint } from "./types";

export function listEndpoints(
  projectId: string,
  signal?: AbortSignal,
): Promise<Endpoint[]> {
  return request<Endpoint[]>(`/projects/${projectId}/endpoints`, { signal });
}

export function getEndpoint(
  endpointId: string,
  signal?: AbortSignal,
): Promise<Endpoint> {
  return request<Endpoint>(`/endpoints/${endpointId}`, { signal });
}

export function createEndpoint(
  projectId: string,
  input: {
    name: string;
    description?: string;
    slug?: string;
    version?: string;
    maxRows?: number;
    savedQueryId: string;
  },
): Promise<Endpoint> {
  return request<Endpoint>(`/projects/${projectId}/endpoints`, {
    method: "POST",
    body: input,
  });
}

export function updateEndpoint(
  endpointId: string,
  input: {
    name?: string;
    description?: string;
    slug?: string;
    version?: string;
    maxRows?: number;
    savedQueryId?: string;
  },
): Promise<Endpoint> {
  return request<Endpoint>(`/endpoints/${endpointId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteEndpoint(
  endpointId: string,
): Promise<{ message: string }> {
  return request(`/endpoints/${endpointId}`, { method: "DELETE" });
}

export function publishEndpoint(endpointId: string): Promise<Endpoint> {
  return request<Endpoint>(`/endpoints/${endpointId}/publish`, {
    method: "POST",
  });
}

export function unpublishEndpoint(endpointId: string): Promise<Endpoint> {
  return request<Endpoint>(`/endpoints/${endpointId}/unpublish`, {
    method: "POST",
  });
}
