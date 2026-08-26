"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "./api/client";

/**
 * Carregamento de um recurso da API.
 *
 * Uma abstração pequena, e não uma biblioteca de cache: cada página é
 * dona dos seus dados e nada precisa ser compartilhado entre rotas.
 *
 * `load` deve ser memoizado com `useCallback`; a identidade dessa
 * função é o que identifica o recurso pedido, e trocá-la recomeça o
 * carregamento.
 */

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Recarrega após uma mutação. */
  reload: () => void;
  /** Aplica localmente o resultado de uma mutação, sem nova requisição. */
  set: (value: T) => void;
}

type Loader<T> = (signal: AbortSignal) => Promise<T>;

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const PENDING = { data: null, loading: true, error: null };

export function useResource<T>(load: Loader<T>): Resource<T> {
  const [state, setState] = useState<State<T>>(PENDING);
  const [nonce, setNonce] = useState(0);

  // Ajuste de estado durante a renderização: pedir outro recurso
  // descarta o resultado do anterior antes de qualquer efeito rodar,
  // de modo que a tela nunca mostra o dado de outra rota.
  const [previous, setPrevious] = useState<Loader<T>>(() => load);

  if (previous !== load) {
    setPrevious(() => load);
    setState(PENDING);
  }

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setState({ data: value, loading: false, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({ data: null, loading: false, error: errorMessage(cause) });
        }
      });

    return () => controller.abort();
  }, [load, nonce]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setNonce((value) => value + 1);
  }, []);

  const set = useCallback((value: T) => {
    setState({ data: value, loading: false, error: null });
  }, []);

  return { ...state, reload, set };
}

/** Mensagem exibível; nunca o objeto de erro cru. */
export function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    return cause.message;
  }

  return "Ocorreu um erro inesperado.";
}
