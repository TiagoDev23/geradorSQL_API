"use client";

import { sql, PostgreSQL } from "@codemirror/lang-sql";
import dynamic from "next/dynamic";
import { useMemo } from "react";

import { Skeleton } from "./ui/skeleton";

/**
 * Editor SQL.
 *
 * CodeMirror 6 em vez de Monaco: o wrapper oficial do Monaco carrega o
 * editor de uma CDN por padrão, o que introduziria dependência externa
 * em tempo de execução, e empacotá-lo exigiria configuração de bundler
 * bem maior do que este milestone justifica.
 *
 * A configuração é deliberadamente mínima — realce de sintaxe e
 * numeração de linhas. Não há autocomplete nem validação: quem valida o
 * SQL é o backend, e duplicar essa regra aqui abriria espaço para as
 * duas divergirem.
 */
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

export function SqlEditor({
  value,
  onChange,
  readOnly = false,
  height = "260px",
  ariaLabel = "Editor SQL",
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  ariaLabel?: string;
}) {
  const extensions = useMemo(() => [sql({ dialect: PostgreSQL })], []);

  return (
    <div
      aria-label={ariaLabel}
      className="sql-editor scroll-slim overflow-hidden rounded-md border border-line bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
    >
      <CodeMirror
        value={value}
        height={height}
        readOnly={readOnly}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
        }}
      />
    </div>
  );
}
