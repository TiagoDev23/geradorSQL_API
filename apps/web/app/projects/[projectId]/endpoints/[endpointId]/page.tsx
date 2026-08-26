"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useState } from "react";

import * as endpointsApi from "@/lib/api/endpoints";
import { API_BASE_URL } from "@/lib/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import { errorMessage, useResource } from "@/lib/use-resource";
import { EndpointDialog } from "@/components/endpoint-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CodeBlock, CopyButton } from "@/components/ui/copy";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { ErrorState, FormError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/**
 * Detalhe do endpoint. A URL é o elemento central da tela: é ela que o
 * consumidor da API vai usar.
 */
export default function EndpointPage({
  params,
}: PageProps<"/projects/[projectId]/endpoints/[endpointId]">) {
  const { endpointId } = use(params);
  const { project, reload: reloadProject } = useProject();
  const router = useRouter();
  const { notify } = useToast();

  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const endpoint = useResource(
    useCallback(
      (signal: AbortSignal) => endpointsApi.getEndpoint(endpointId, signal),
      [endpointId],
    ),
  );

  if (endpoint.loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (endpoint.error) {
    return <ErrorState message={endpoint.error} onRetry={endpoint.reload} />;
  }

  if (!endpoint.data) {
    return null;
  }

  const current = endpoint.data;
  const base = `/projects/${project.id}`;
  const url = `${API_BASE_URL}${current.runtimePath}`;

  async function togglePublication() {
    setBusy(true);
    setActionError(null);

    try {
      const updated = current.isPublished
        ? await endpointsApi.unpublishEndpoint(current.id)
        : await endpointsApi.publishEndpoint(current.id);

      endpoint.set(updated);
      reloadProject();
      notify(
        updated.isPublished ? "Endpoint publicado." : "Endpoint despublicado.",
      );
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={current.name}
        description={
          <Link href={`${base}/endpoints`} className="text-primary">
            ← Endpoints
          </Link>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setRemoving(true)}>
              Excluir
            </Button>

            <Button onClick={() => setEditing(true)}>Editar</Button>

            <Button
              variant={current.isPublished ? "secondary" : "primary"}
              loading={busy}
              onClick={() => void togglePublication()}
            >
              {current.isPublished ? "Despublicar" : "Publicar"}
            </Button>
          </>
        }
      />

      <div className="mt-6 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral" className="font-mono">
            GET
          </Badge>

          <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">
            {url}
          </code>

          <CopyButton value={url} label="Copiar URL" />
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[12px] text-ink-muted">Status</dt>
            <dd className="mt-1">
              {current.isPublished ? (
                <Badge tone="success" dot>
                  Publicado
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Rascunho
                </Badge>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[12px] text-ink-muted">Autenticação</dt>
            <dd className="mt-1 font-mono text-[12.5px] text-ink">x-api-key</dd>
          </div>

          <div>
            <dt className="text-[12px] text-ink-muted">Limite</dt>
            <dd className="mt-1 text-ink tabular-nums">
              {formatNumber(current.maxRows)} registros
            </dd>
          </div>

          <div>
            <dt className="text-[12px] text-ink-muted">Publicado em</dt>
            <dd className="mt-1 text-ink">
              {formatDateTime(current.publishedAt)}
            </dd>
          </div>
        </dl>
      </div>

      {actionError ? (
        <div className="mt-4">
          <FormError message={actionError} />
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
          Consulta
        </h2>

        <Link
          href={`${base}/queries/${current.savedQueryId}`}
          className="mt-2 inline-block text-sm text-primary"
        >
          {current.savedQuery.name}
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
          Parâmetros
        </h2>

        <div className="mt-3">
          {current.savedQuery.parameters.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              A consulta não recebe parâmetros.
            </p>
          ) : (
            <TableFrame>
              <Table>
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>Tipo</Th>
                    <Th>Obrigatório</Th>
                    <Th>Padrão</Th>
                  </tr>
                </thead>

                <tbody>
                  {current.savedQuery.parameters.map((parameter) => (
                    <Tr key={parameter.name}>
                      <Td mono>{parameter.name}</Td>

                      <Td className="text-ink-muted">
                        {parameter.type.toLowerCase()}
                      </Td>

                      <Td className="text-ink-muted">
                        {parameter.required ? "sim" : "não"}
                      </Td>

                      <Td mono className="text-ink-muted">
                        {parameter.defaultValue ?? "—"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
            Exemplo
          </h2>

          <CopyButton value={exampleFor(url, current.savedQuery.parameters)} />
        </div>

        <CodeBlock code={exampleFor(url, current.savedQuery.parameters)} />
      </section>

      <EndpointDialog
        open={editing}
        projectId={project.id}
        endpoint={current}
        savedQueryId={current.savedQueryId}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setEditing(false);
          endpoint.set(updated);
          notify("Endpoint atualizado.");
        }}
      />

      <ConfirmDialog
        open={removing}
        title="Excluir endpoint"
        description="Endpoints publicados precisam ser despublicados antes."
        confirmLabel="Excluir"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await endpointsApi.deleteEndpoint(current.id);

          reloadProject();
          notify("Endpoint removido.");
          router.replace(`${base}/endpoints`);
        }}
      />
    </>
  );
}

/**
 * Exemplo de chamada. A chave aparece como marcador: nenhuma API Key
 * real é exibida aqui.
 */
function exampleFor(
  url: string,
  parameters: { name: string; type: string; required: boolean }[],
): string {
  const query = parameters
    .map((parameter) => `${parameter.name}=${placeholder(parameter.type)}`)
    .join("&");

  return [
    `curl "${url}${query ? `?${query}` : ""}" \\`,
    '  -H "x-api-key: SUA_API_KEY"',
  ].join("\n");
}

function placeholder(type: string): string {
  switch (type) {
    case "INTEGER":
      return "1";
    case "FLOAT":
      return "1.5";
    case "BOOLEAN":
      return "true";
    case "DATE":
      return "2026-01-01";
    case "DATETIME":
      return "2026-01-01T00:00:00Z";
    case "UUID":
      return "00000000-0000-4000-8000-000000000000";
    default:
      return "valor";
  }
}
