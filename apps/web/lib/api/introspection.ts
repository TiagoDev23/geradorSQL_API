import { request } from "./client";
import type { SchemaSummary, TableDetail, TableSummary } from "./types";

export function listSchemas(
  connectionId: string,
  signal?: AbortSignal,
): Promise<SchemaSummary[]> {
  return request<SchemaSummary[]>(`/connections/${connectionId}/schemas`, {
    signal,
  });
}

export function listTables(
  connectionId: string,
  schema?: string,
  signal?: AbortSignal,
): Promise<TableSummary[]> {
  const query = schema ? `?schema=${encodeURIComponent(schema)}` : "";

  return request<TableSummary[]>(
    `/connections/${connectionId}/tables${query}`,
    { signal },
  );
}

export function describeTable(
  connectionId: string,
  schema: string,
  table: string,
  signal?: AbortSignal,
): Promise<TableDetail> {
  return request<TableDetail>(
    `/connections/${connectionId}/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`,
    { signal },
  );
}
