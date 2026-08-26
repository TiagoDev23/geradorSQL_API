import { request } from "./client";
import type {
  ConnectionTestResult,
  DatabaseConnection,
  DatabaseSslMode,
} from "./types";

/** A senha trafega em texto puro só na criação/atualização; o backend cifra. */
export interface ConnectionInput {
  name: string;
  host: string;
  port?: number;
  databaseName: string;
  defaultSchema?: string;
  username: string;
  password: string;
  sslMode?: DatabaseSslMode;
}

export function listConnections(
  projectId: string,
  signal?: AbortSignal,
): Promise<DatabaseConnection[]> {
  return request<DatabaseConnection[]>(`/projects/${projectId}/connections`, {
    signal,
  });
}

export function getConnection(
  connectionId: string,
  signal?: AbortSignal,
): Promise<DatabaseConnection> {
  return request<DatabaseConnection>(`/connections/${connectionId}`, {
    signal,
  });
}

export function createConnection(
  projectId: string,
  input: ConnectionInput,
): Promise<DatabaseConnection> {
  return request<DatabaseConnection>(`/projects/${projectId}/connections`, {
    method: "POST",
    body: input,
  });
}

/** `password` omitida preserva a credencial atual — comportamento do backend. */
export function updateConnection(
  connectionId: string,
  input: Partial<ConnectionInput>,
): Promise<DatabaseConnection> {
  return request<DatabaseConnection>(`/connections/${connectionId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteConnection(
  connectionId: string,
): Promise<{ message: string }> {
  return request(`/connections/${connectionId}`, { method: "DELETE" });
}

export function testConnection(
  connectionId: string,
): Promise<ConnectionTestResult> {
  return request<ConnectionTestResult>(`/connections/${connectionId}/test`, {
    method: "POST",
  });
}
