import { API_BASE_URL } from "../config";
import { clearToken, readToken } from "../auth/session";

/**
 * Camada única de acesso à API.
 *
 * Todos os módulos de `lib/api` passam por aqui, de modo que URL base,
 * cabeçalho de autenticação e formato de erro existam em um só lugar.
 */

/** Erro já traduzido para algo exibível ao usuário. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}

/** Corpo de erro padrão do NestJS. */
interface NestErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: "Sessão expirada. Entre novamente.",
  403: "Você não tem acesso a este recurso.",
  404: "Recurso não encontrado.",
  500: "Erro interno do servidor.",
};

/**
 * Extrai a mensagem segura devolvida pelo backend. O `ValidationPipe`
 * responde com um array de mensagens; a primeira já basta para orientar
 * a correção, e o restante seria ruído no formulário.
 */
function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const { message } = body as NestErrorBody;

    if (Array.isArray(message) && message.length > 0) {
      return message[0];
    }

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return FALLBACK_MESSAGES[status] ?? "Não foi possível concluir a operação.";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Rotas de login e cadastro não enviam token. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!options.anonymous) {
    const token = readToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      signal: options.signal,
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
    });
  } catch {
    // Falha de rede: o servidor não respondeu. Nenhum detalhe técnico
    // ajuda o usuário aqui.
    throw new ApiError(0, "Não foi possível contactar o servidor.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // Token ausente, inválido ou expirado: a sessão local não vale mais
    // nada e é descartada. A rota autenticada percebe e redireciona.
    if (response.status === 401 && !options.anonymous) {
      clearToken();
    }

    throw new ApiError(response.status, messageFrom(payload, response.status));
  }

  return payload as T;
}
