"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as authApi from "../api/auth";
import type { AuthResult, User } from "../api/types";
import { clearToken, onSessionChange, readToken, writeToken } from "./session";

/**
 * Sessão do control plane.
 *
 * O estado global se limita ao usuário autenticado. Tudo mais pertence
 * a uma página e é buscado por ela.
 */

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: User | null;
  /** Guarda o token devolvido por login/cadastro e assume a sessão. */
  accept: (result: AuthResult) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Confirmação inicial: um token no navegador pode estar expirado, e
  // só o backend sabe disso. O `localStorage` não existe no servidor,
  // então a decisão só pode acontecer depois da montagem.
  useEffect(() => {
    const controller = new AbortController();

    async function confirm() {
      if (!readToken()) {
        setStatus("anonymous");

        return;
      }

      try {
        setUser(await authApi.me(controller.signal));
        setStatus("authenticated");
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        clearToken();
        setUser(null);
        setStatus("anonymous");
      }
    }

    void confirm();

    return () => controller.abort();
  }, []);

  // O cliente HTTP apaga o token ao receber 401; a sessão acompanha.
  useEffect(
    () =>
      onSessionChange(() => {
        if (!readToken()) {
          setUser(null);
          setStatus("anonymous");
        }
      }),
    [],
  );

  const accept = useCallback((result: AuthResult) => {
    writeToken(result.accessToken);
    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ status, user, accept, signOut }),
    [status, user, accept, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider.");
  }

  return context;
}
