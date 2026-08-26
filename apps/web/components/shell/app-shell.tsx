"use client";

import { useState } from "react";

import { cx } from "@/components/ui/cx";
import { Topbar } from "./topbar";

/**
 * Moldura das páginas autenticadas.
 *
 * Sem `sidebar` a área ocupa a largura toda — é o caso da lista de
 * projetos, que ainda não tem contexto de projeto.
 */
export function AppShell({
  sidebar,
  context,
  children,
}: {
  sidebar?: React.ReactNode;
  context?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Em telas estreitas a navegação sai do fluxo e é aberta sob demanda.
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar
        context={
          sidebar ? (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label="Alternar navegação do projeto"
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-muted lg:hidden"
              >
                <svg aria-hidden width="16" height="16" viewBox="0 0 16 16">
                  <path
                    d="M2.5 4h11M2.5 8h11M2.5 12h11"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {context}
            </div>
          ) : (
            context
          )
        }
      />

      <div className="flex flex-1">
        {sidebar ? (
          <aside
            className={cx(
              "w-56 shrink-0 border-r border-line bg-surface",
              open ? "block" : "hidden lg:block",
            )}
          >
            <div className="sticky top-14">{sidebar}</div>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
