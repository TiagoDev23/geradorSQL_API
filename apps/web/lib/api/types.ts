/**
 * Contratos da API NestJS.
 *
 * Estes tipos espelham exatamente o que os services do backend
 * selecionam e devolvem. Campos sensíveis — `passwordEncrypted`,
 * `keyHash`, `passwordHash` — não existem nas respostas e por isso
 * também não existem aqui.
 */

export type DatabaseSslMode = "DISABLE" | "REQUIRE";

export type QueryParameterType =
  "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "DATE" | "DATETIME" | "UUID";

export const QUERY_PARAMETER_TYPES: QueryParameterType[] = [
  "STRING",
  "INTEGER",
  "FLOAT",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "UUID",
];

export interface User {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  accessToken: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /projects/:id` acrescenta as contagens do projeto. */
export interface ProjectDetail extends Project {
  _count: {
    connections: number;
    endpoints: number;
    apiKeys: number;
  };
}

export interface DatabaseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  databaseName: string;
  defaultSchema: string;
  username: string;
  sslMode: DatabaseSslMode;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTestResult {
  success: boolean;
  database: string;
  user: string;
  serverVersion: string;
  durationMs: number;
}

export interface SchemaSummary {
  name: string;
  owner: string;
}

export interface TableSummary {
  schema: string;
  name: string;
  type: string;
}

export interface ColumnDetail {
  name: string;
  position: number;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface ForeignKeyDetail {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
}

export interface TableDetail extends TableSummary {
  columns: ColumnDetail[];
  primaryKey: { name: string; columns: string[] } | null;
  foreignKeys: ForeignKeyDetail[];
}

export interface QueryParameter {
  id: string;
  name: string;
  description: string | null;
  type: QueryParameterType;
  position: number;
  required: boolean;
  defaultValue: string | null;
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string | null;
  sql: string;
  connectionId: string;
  createdAt: string;
  updatedAt: string;
  parameters: QueryParameter[];
}

/** Parâmetro enviado ao criar ou atualizar uma consulta. */
export interface QueryParameterInput {
  name: string;
  description?: string;
  type: QueryParameterType;
  position: number;
  required?: boolean;
  defaultValue?: string;
}

export interface QueryExecutionResult {
  columns: { name: string; dataTypeId: number }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  maxRows: number;
  truncated: boolean;
  durationMs: number;
}

export interface Endpoint {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  version: string;
  isPublished: boolean;
  publishedAt: string | null;
  maxRows: number;
  projectId: string;
  savedQueryId: string;
  createdAt: string;
  updatedAt: string;
  projectSlug: string;
  /** Caminho já montado pelo backend: `/runtime/{projeto}/{versao}/{slug}`. */
  runtimePath: string;
  savedQuery: {
    id: string;
    name: string;
    description: string | null;
    connectionId: string;
    parameters: {
      name: string;
      type: QueryParameterType;
      position: number;
      required: boolean;
      defaultValue: string | null;
    }[];
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  projectId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * A criação é o único momento em que o valor completo existe. Ele não
 * é persistido em lugar nenhum pela interface.
 */
export interface CreatedApiKey extends ApiKey {
  token: string;
  warning: string;
}

export interface RequestLog {
  id: string;
  endpointId: string;
  apiKeyId: string | null;
  statusCode: number;
  durationMs: number;
  rowCount: number | null;
  errorCode: string | null;
  createdAt: string;
}

export interface ProjectMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDurationMs: number | null;
  totalRows: number;
}

/** Subconjunto do documento OpenAPI que a interface realmente lê. */
export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  components?: {
    securitySchemes?: Record<
      string,
      { type: string; in?: string; name?: string; description?: string }
    >;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

export interface OpenApiOperation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: {
    name: string;
    in: string;
    required: boolean;
    description?: string;
    schema: { type: string; format?: string; default?: string };
  }[];
  responses?: Record<string, { description: string }>;
}
