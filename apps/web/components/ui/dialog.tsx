"use client";

import { useEffect, useId, useRef } from "react";

import { cx } from "./cx";

/**
 * Modal usado por todos os formulários curtos e confirmações da
 * aplicação. Substitui `window.confirm`, que não permite rótulo nem
 * tom próprios para ações destrutivas.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  width = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    // O primeiro controle recebe o foco para que o teclado continue
    // dentro do diálogo.
    panel.current
      ?.querySelector<HTMLElement>(
        "input, select, textarea, button:not([data-dismiss])",
      )
      ?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 p-4 pt-[10vh]">
      {/* Clique fora fecha; o botão abaixo mantém a ação acessível. */}
      <button
        type="button"
        aria-label="Fechar"
        data-dismiss
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "relative w-full rounded-lg border border-line bg-surface shadow-lg shadow-ink/5",
          widths[width],
        )}
      >
        <header className="border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-[15px] font-semibold text-ink">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
          ) : null}
        </header>

        {children ? <div className="px-5 py-4">{children}</div> : null}

        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-line bg-page/60 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
