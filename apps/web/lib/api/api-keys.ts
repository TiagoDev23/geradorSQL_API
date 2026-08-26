import { request } from "./client";
import type { ApiKey, CreatedApiKey } from "./types";

export function listApiKeys(
  projectId: string,
  signal?: AbortSignal,
): Promise<ApiKey[]> {
  return request<ApiKey[]>(`/projects/${projectId}/api-keys`, { signal });
}

/**
 * Único ponto em que o valor completo da chave chega ao navegador. Ele
 * é mostrado uma vez e não é gravado em lugar nenhum.
 */
export function createApiKey(
  projectId: string,
  input: { name: string; expiresAt?: string },
): Promise<CreatedApiKey> {
  return request<CreatedApiKey>(`/projects/${projectId}/api-keys`, {
    method: "POST",
    body: input,
  });
}

export function revokeApiKey(apiKeyId: string): Promise<ApiKey> {
  return request<ApiKey>(`/api-keys/${apiKeyId}/revoke`, { method: "POST" });
}

export function deleteApiKey(apiKeyId: string): Promise<{ message: string }> {
  return request(`/api-keys/${apiKeyId}`, { method: "DELETE" });
}
