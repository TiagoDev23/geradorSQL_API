"use client";

import { useCallback, useEffect, useState } from "react";

import * as connectionsApi from "@/lib/api/connections";
import type { ConnectionTestResult, DatabaseConnection } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import { errorMessage, useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cx } from "@/components/ui/cx";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ConnectionDialog } from "./connection-dialog";
import { SchemaExplorer } from "./schema-explorer";

/**
 * Conexões do projeto e exploração da estrutura do banco escolhido.
 *
 * Nenhuma senha é carregada aqui: o backend não devolve credencial, e a
 * edição só envia senha quando o usuário digita uma nova.
 */
export default function DatabasePage() {
  const { project, reload: reloadProject } = useProject();
  const { notify } = useToast();

  const [editing, setEditing] = useState<DatabaseConnection | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<DatabaseConnection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<
    Record<
      string,
      { ok: true; data: ConnectionTestResult } | { ok: false; message: string }
    >
  >({});

  const connections = useResource(
    useCallback(
      (signal: AbortSignal) =>
        connectionsApi.listConnections(project.id, signal),
      [project.id],
    ),
  );

  // A primeira conexão vira o alvo do explorador, evitando um passo a
  // mais no caso comum de haver só uma.
  useEffect(() => {
    if (selected === null && connections.data && connections.data.length > 0) {
      setSelected(connections.data[0].id);
    }
  }, [connections.data, selected]);

  async function test(connection: DatabaseConnection) {
    setTesting(connection.id);

    try {
      const data = await connectionsApi.testConnection(connection.id);

      setResults((current) => ({
        ...current,
        [connection.id]: { ok: true, data },
      }));
    } catch (cause) {
      setResults((current) => ({
        ...current,
        [connection.id]: { ok: false, message: errorMessage(cause) },
      }));
    } finally {
      setTesting(null);
    }
  }

  function afterChange(message: string) {
    connections.reload();
    reloadProject();
    notify(message);
  }

  return (
    <>
      <PageHeader
        title="Banco de dados"
        description="Conexões PostgreSQL usadas pelas consultas deste projeto."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nova conexão
          </Button>
        }
      />

      <div className="mt-6">
        {connections.loading ? (
          <SkeletonRows rows={2} className="[&>*]:h-16" />
        ) : connections.error ? (
          <ErrorState
            message={connections.error}
            onRetry={connections.reload}
          />
        ) : connections.data && connections.data.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {connections.data.map((connection) => {
              const result = results[connection.id];

              return (
                <li
                  key={connection.id}
                  className={cx(
                    "px-4 py-3",
                    selected === connection.id && "bg-primary-soft/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelected(connection.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-ink">
                        {connection.name}
                      </span>

                      <span className="block truncate font-mono text-[12.5px] text-ink-muted">
                        {connection.username}@{connection.host}:
                        {connection.port}/{connection.databaseName}
                      </span>
                    </button>

                    <Badge
                      tone={
                        connection.sslMode === "REQUIRE" ? "primary" : "neutral"
                      }
                    >
                      SSL{" "}
                      {connection.sslMode === "REQUIRE"
                        ? "obrigatório"
                        : "desabilitado"}
                    </Badge>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        loading={testing === connection.id}
                        onClick={() => void test(connection)}
                      >
                        Testar
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(connection)}
                      >
                        Editar
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoving(connection)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>

                  {result ? (
                    <p
                      className={cx(
                        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]",
                        result.ok ? "text-success" : "text-danger",
                      )}
                    >
                      {result.ok ? (
                        <>
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-current"
                            />
                            Conexão estabelecida
                          </span>
                          <span className="text-ink-muted">
                            {shortVersion(result.data.serverVersion)}
                          </span>
                          <span className="text-ink-muted">
                            {formatDuration(result.data.durationMs)}
                          </span>
                        </>
                      ) : (
                        result.message
                      )}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma conexão configurada."
            description="Conecte um PostgreSQL para começar a explorar seus dados."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Criar conexão
              </Button>
            }
          />
        )}
      </div>

      {selected && connections.data?.some((item) => item.id === selected) ? (
        <SchemaExplorer connectionId={selected} />
      ) : null}

      <ConnectionDialog
        open={creating}
        projectId={project.id}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          afterChange("Conexão criada.");
        }}
      />

      <ConnectionDialog
        open={editing !== null}
        projectId={project.id}
        connection={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          afterChange("Conexão atualizada.");
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Excluir conexão"
        description={`A conexão "${removing?.name ?? ""}" será removida. Consultas salvas impedem a exclusão.`}
        confirmLabel="Excluir"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;

          await connectionsApi.deleteConnection(removing.id);

          if (selected === removing.id) {
            setSelected(null);
          }

          afterChange("Conexão removida.");
        }}
      />
    </>
  );
}

/** `version()` devolve uma linha longa; só o produto e a versão interessam. */
function shortVersion(value: string): string {
  const match = /^(PostgreSQL\s+[\d.]+)/.exec(value);

  return match ? match[1] : value.slice(0, 40);
}
