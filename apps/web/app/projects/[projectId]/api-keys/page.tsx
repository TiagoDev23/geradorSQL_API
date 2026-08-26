"use client";

import { useCallback, useState } from "react";

import * as apiKeysApi from "@/lib/api/api-keys";
import type { ApiKey, CreatedApiKey } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import { errorMessage, useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState, ErrorState, FormError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/**
 * API Keys do projeto — a autenticação do runtime, distinta do JWT que
 * protege este painel.
 *
 * O valor completo da chave só existe na resposta da criação. Ele é
 * mostrado uma vez e não é gravado em lugar nenhum pela interface.
 */
export default function ApiKeysPage() {
  const { project, reload: reloadProject } = useProject();
  const { notify } = useToast();

  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const apiKeys = useResource(
    useCallback(
      (signal: AbortSignal) => apiKeysApi.listApiKeys(project.id, signal),
      [project.id],
    ),
  );

  return (
    <>
      <PageHeader
        title="API Keys"
        description="Enviadas no cabeçalho x-api-key ao chamar os endpoints."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Criar API Key
          </Button>
        }
      />

      <div className="mt-6">
        {apiKeys.loading ? (
          <SkeletonRows rows={2} className="[&>*]:h-12" />
        ) : apiKeys.error ? (
          <ErrorState message={apiKeys.error} onRetry={apiKeys.reload} />
        ) : apiKeys.data && apiKeys.data.length > 0 ? (
          <TableFrame>
            <Table>
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Prefixo</Th>
                  <Th>Criada em</Th>
                  <Th>Último uso</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>

              <tbody>
                {apiKeys.data.map((apiKey) => (
                  <Tr key={apiKey.id}>
                    <Td>{apiKey.name}</Td>

                    <Td mono className="text-ink-muted">
                      {apiKey.keyPrefix}…
                    </Td>

                    <Td className="text-ink-muted">
                      {formatDateTime(apiKey.createdAt)}
                    </Td>

                    <Td className="text-ink-muted">
                      {formatDateTime(apiKey.lastUsedAt)}
                    </Td>

                    <Td>{statusBadge(apiKey)}</Td>

                    <Td align="right">
                      {apiKey.revokedAt ? null : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRevoking(apiKey)}
                        >
                          Revogar
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        ) : (
          <EmptyState
            title="Nenhuma API Key."
            description="Os endpoints publicados exigem uma chave para responder."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Criar API Key
              </Button>
            }
          />
        )}
      </div>

      <CreateApiKeyDialog
        open={creating}
        projectId={project.id}
        onClose={() => setCreating(false)}
        onCreated={(apiKey) => {
          setCreating(false);
          setCreated(apiKey);
          apiKeys.reload();
          reloadProject();
        }}
      />

      <RevealDialog apiKey={created} onClose={() => setCreated(null)} />

      <ConfirmDialog
        open={revoking !== null}
        title="Revogar API Key"
        description={`A chave "${revoking?.name ?? ""}" deixará de ser aceita pelo runtime imediatamente.`}
        confirmLabel="Revogar"
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;

          await apiKeysApi.revokeApiKey(revoking.id);

          apiKeys.reload();
          notify("API Key revogada.");
        }}
      />
    </>
  );
}

function statusBadge(apiKey: ApiKey) {
  if (apiKey.revokedAt) {
    return <Badge tone="neutral">Revogada</Badge>;
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= Date.now()) {
    return <Badge tone="warning">Expirada</Badge>;
  }

  return (
    <Badge tone="success" dot>
      Ativa
    </Badge>
  );
}

function CreateApiKeyDialog({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (apiKey: CreatedApiKey) => void;
}) {
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      const apiKey = await apiKeysApi.createApiKey(projectId, {
        name: name.trim(),
        // O backend espera ISO 8601; o campo de data devolve AAAA-MM-DD.
        ...(expiresAt && {
          expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
        }),
      });

      setName("");
      setExpiresAt("");
      onCreated(apiKey);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Criar API Key" width="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome" htmlFor="api-key-name" required>
          <Input
            id="api-key-name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Integração interna"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Expira em"
          htmlFor="api-key-expires"
          hint="Em branco, a chave não expira."
        >
          <Input
            id="api-key-expires"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </Field>

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>

          <Button type="submit" variant="primary" loading={busy}>
            Criar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Exibição única do valor da chave. Ao fechar, o valor sai da memória
 * do componente e não há como recuperá-lo: o backend guarda apenas o
 * hash.
 */
function RevealDialog({
  apiKey,
  onClose,
}: {
  apiKey: CreatedApiKey | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={apiKey !== null}
      onClose={onClose}
      title="API Key criada"
      description="Esta chave será exibida apenas uma vez."
      width="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Entendi
        </Button>
      }
    >
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-muted/60 px-2.5 py-2 font-mono text-[12.5px] text-ink">
          {apiKey?.token}
        </code>

        <CopyButton value={apiKey?.token ?? ""} />
      </div>
    </Dialog>
  );
}
