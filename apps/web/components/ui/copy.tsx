"use client";

import { useEffect, useState } from "react";

import { Button } from "./button";
import { cx } from "./cx";

/**
 * Cópia para a área de transferência com confirmação no próprio botão,
 * em vez de uma notificação separada.
 */
export function CopyButton({
  value,
  label = "Copiar",
  size = "sm",
  variant = "secondary",
  className,
}: {
  value: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1800);

    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
    >
      {copied ? "Copiado" : label}
    </Button>
  );
}

/** Bloco de código somente leitura, com rolagem própria. */
export function CodeBlock({
  code,
  className,
  maxHeight = "max-h-[420px]",
}: {
  code: string;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <pre
      className={cx(
        "scroll-slim overflow-auto rounded-md border border-line bg-muted/60 p-3",
        "font-mono text-[12.5px] leading-6 text-ink",
        maxHeight,
        className,
      )}
    >
      {code}
    </pre>
  );
}
