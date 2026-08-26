"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { cx } from "./cx";

/**
 * Confirmação breve de uma ação concluída. Deliberadamente pobre: uma
 * linha, canto inferior, sem fila longa nem histórico.
 */

type Tone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  notify: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Tone = "success") => {
    const id = nextId++;

    setToasts((current) => [...current.slice(-2), { id, message, tone }]);

    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      3500,
    );
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              "rounded-md border px-3 py-2 text-[13px] shadow-sm",
              toast.tone === "success"
                ? "border-line bg-surface text-ink"
                : "border-danger/20 bg-danger-soft text-danger",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast precisa estar dentro de ToastProvider.");
  }

  return context;
}
