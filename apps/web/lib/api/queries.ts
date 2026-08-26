import { request } from "./client";
import type {
  QueryExecutionResult,
  QueryParameterInput,
  SavedQuery,
} from "./types";

export function listQueries(
  connectionId: string,
  signal?: AbortSignal,
): Promise<SavedQuery[]> {
  return request<SavedQuery[]>(`/connections/${connectionId}/queries`, {
    signal,
  });
}

export function getQuery(
  queryId: string,
  signal?: AbortSignal,
): Promise<SavedQuery> {
  return request<SavedQuery>(`/queries/${queryId}`, { signal });
}

export function createQuery(
  connectionId: string,
  input: {
    name: string;
    description?: string;
    sql: string;
    parameters?: QueryParameterInput[];
  },
): Promise<SavedQuery> {
  return request<SavedQuery>(`/connections/${connectionId}/queries`, {
    method: "POST",
    body: input,
  });
}

/** `parameters` informado substitui o conjunto inteiro — regra do backend. */
export function updateQuery(
  queryId: string,
  input: {
    name?: string;
    description?: string;
    sql?: string;
    parameters?: QueryParameterInput[];
  },
): Promise<SavedQuery> {
  return request<SavedQuery>(`/queries/${queryId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteQuery(queryId: string): Promise<{ message: string }> {
  return request(`/queries/${queryId}`, { method: "DELETE" });
}

/** Execução de teste; os valores vão no corpo, nunca concatenados ao SQL. */
export function executeQuery(
  queryId: string,
  input: { parameters?: Record<string, unknown>; maxRows?: number },
): Promise<QueryExecutionResult> {
  return request<QueryExecutionResult>(`/queries/${queryId}/execute`, {
    method: "POST",
    body: input,
  });
}
