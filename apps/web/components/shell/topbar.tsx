"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PRODUCT_NAME } from "@/lib/config";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * Barra superior: identidade do produto, contexto atual e a conta.
 * Nada além disso — atalhos pertencem às páginas.
 */
export function Topbar({ context }: { context?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);

    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const initial = (user?.name ?? user?.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
      <Link
        href="/projects"
        className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink"
      >
        <Mark />
        {PRODUCT_NAME}
      </Link>

      {context ? (
        <>
          <span aria-hidden className="text-ink-subtle">
            /
          </span>
          {context}
        </>
      ) : null}

      <div ref={menu} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-ink-muted transition-colors hover:bg-muted"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
            {initial}
          </span>

          <span className="hidden max-w-[180px] truncate sm:block">
            {user?.email ?? ""}
          </span>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 mt-1.5 w-56 rounded-md border border-line bg-surface py-1 shadow-lg shadow-ink/5"
          >
            <div className="border-b border-line px-3 py-2">
              <p className="truncate text-[13px] font-medium text-ink">
                {user?.name ?? "Conta"}
              </p>
              <p className="truncate text-[12px] text-ink-muted">
                {user?.email}
              </p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="w-full px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-muted"
            >
              Sair
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Marca simples: três nós ligados, do banco à rota publicada. */
function Mark() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="text-primary"
    >
      <path
        d="M3 5.5h5M10 9h5M3 12.5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="14.5" cy="5.5" r="1.6" fill="currentColor" />
      <circle cx="3.5" cy="9" r="1.6" fill="currentColor" />
      <circle cx="14.5" cy="12.5" r="1.6" fill="currentColor" />
    </svg>
  );
}
