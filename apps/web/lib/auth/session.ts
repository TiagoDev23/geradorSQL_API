/**
 * Guarda do token de acesso do control plane.
 *
 * O backend devolve o JWT no corpo da resposta e o espera no cabeçalho
 * `Authorization`, sem cookie nem refresh token. O armazenamento fica
 * no `localStorage` do navegador, que é o que essa arquitetura comporta.
 *
 * Aqui vive apenas o token da plataforma. API Keys de runtime nunca são
 * gravadas: são autenticações diferentes e não se misturam.
 */

const TOKEN_KEY = "apigen.access-token";

/** Notificado quando o token é definido ou apagado. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);

  listeners.forEach((listener) => listener());
}

export function clearToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);

  listeners.forEach((listener) => listener());
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
