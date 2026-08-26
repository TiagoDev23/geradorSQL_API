"use client";

import { useCallback, useState } from "react";

import * as openapiApi from "@/lib/api/openapi";
import type { OpenApiOperation } from "@/lib/api/types";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { CodeBlock, CopyButton } from "@/components/ui/copy";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

/**
 * Especificação OpenAPI do projeto, gerada pelo backend a partir dos
 * endpoints publicados.
 *
 * A tela apenas apresenta o documento. Nenhuma descrição é escrita
 * aqui: manter documentação paralela faria as duas divergirem.
 */
export default function OpenapiPage() {
  const { project } = useProject();
  const [tab, setTab] = useState<"resumo" | "json">("resumo");

  const document = useResource(
    useCallback(
      (signal: AbortSignal) => openapiApi.getOpenApi(project.id, signal),
      [project.id],
    ),
  );

  const json = document.data ? JSON.stringify(document.data, null, 2) : "";

  const operations = Object.entries(document.data?.paths ?? {}).map(
    ([path, methods]) => ({ path, operation: methods.get }),
  );

  return (
    <>
      <PageHeader
        title="OpenAPI"
        description={
          document.data
            ? `${document.data.openapi} · ${document.data.info.title}`
            : "Especificação dos endpoints publicados."
        }
        actions={
          document.data ? (
            <CopyButton value={json} label="Copiar JSON" size="md" />
          ) : null
        }
      />

      <div className="mt-5 flex gap-1 border-b border-line">
        {(["resumo", "json"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? "true" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors",
              tab === value
                ? "border-primary font-medium text-primary"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {value === "resumo" ? "Resumo" : "JSON"}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {document.loading ? (
          <Skeleton className="h-64 w-full" />
        ) : document.error ? (
          <ErrorState message={document.error} onRetry={document.reload} />
        ) : tab === "json" ? (
          <CodeBlock code={json} maxHeight="max-h-[70vh]" />
        ) : operations.length === 0 ? (
          <EmptyState
            title="Nenhum endpoint publicado."
            description="A especificação lista apenas endpoints em produção."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {operations.map(({ path, operation }) => (
              <OperationCard key={path} path={path} operation={operation} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OperationCard({
  path,
  operation,
}: {
  path: string;
  operation?: OpenApiOperation;
}) {
  if (!operation) {
    return null;
  }

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="neutral" className="font-mono">
          GET
        </Badge>

        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">
          {path}
        </code>

        <Badge tone="primary">x-api-key</Badge>
      </div>

      {operation.summary ? (
        <p className="mt-2 text-[13px] text-ink-muted">{operation.summary}</p>
      ) : null}

      {operation.parameters && operation.parameters.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {operation.parameters.map((parameter) => (
            <li
              key={parameter.name}
              className="flex flex-wrap items-baseline gap-2 text-[12.5px]"
            >
              <code className="font-mono text-ink">{parameter.name}</code>

              <span className="text-ink-muted">
                {parameter.schema.format ?? parameter.schema.type}
              </span>

              <span className="text-ink-subtle">
                {parameter.required ? "obrigatório" : "opcional"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {operation.responses ? (
        <p className="mt-3 font-mono text-[12px] text-ink-subtle">
          {Object.keys(operation.responses).join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
