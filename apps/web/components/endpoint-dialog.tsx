"use client";

import { useState } from "react";

import * as endpointsApi from "@/lib/api/endpoints";
import type { Endpoint, SavedQuery } from "@/lib/api/types";
import { previewSlug } from "@/lib/format";
import { errorMessage } from "@/lib/use-resource";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { FormError } from "./ui/states";

interface Props {
  open: boolean;
  projectId: string;
  /** Consulta fixa: o diálogo foi aberto a partir dela. */
  savedQueryId?: string;
  /** Consultas disponíveis quando a origem ainda precisa ser escolhida. */
  queries?: SavedQuery[];
  endpoint?: Endpoint;
  defaultName?: string;
  onClose: () => void;
  onSaved: (endpoint: Endpoint) => void;
}

/**
 * Criação e edição de endpoint.
 *
 * O endpoint referencia uma consulta salva; o SQL não é copiado nem
 * exibido aqui. Usado tanto pela lista de endpoints quanto pela tela da
 * consulta, onde a consulta de origem já está definida.
 */
export function EndpointDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rest.endpoint ? "Editar endpoint" : "Novo endpoint"}
      description="O endpoint publica uma consulta salva; o SQL não é duplicado."
    >
      {/* O formulário existe apenas enquanto o diálogo está aberto, o que
          dispensa sincronizar o estado com as propriedades. */}
      <EndpointForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function EndpointForm({
  projectId,
  savedQueryId,
  queries,
  endpoint,
  defaultName,
  onClose,
  onSaved,
}: Omit<Props, "open">) {
  const [form, setForm] = useState({
    name: endpoint?.name ?? defaultName ?? "",
    slug: endpoint?.slug ?? "",
    version: endpoint?.version ?? "v1",
    maxRows: String(endpoint?.maxRows ?? 1000),
    description: endpoint?.description ?? "",
    savedQueryId:
      endpoint?.savedQueryId ?? savedQueryId ?? queries?.[0]?.id ?? "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    const common = {
      name: form.name.trim(),
      description: form.description.trim(),
      version: form.version.trim(),
      maxRows: Number(form.maxRows) || 1000,
      // O slug em branco é derivado do nome pelo backend.
      ...(form.slug.trim() && { slug: form.slug.trim() }),
    };

    try {
      const saved = endpoint
        ? await endpointsApi.updateEndpoint(endpoint.id, {
            ...common,
            savedQueryId: form.savedQueryId,
          })
        : await endpointsApi.createEndpoint(projectId, {
            ...common,
            savedQueryId: form.savedQueryId,
          });

      onSaved(saved);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const slugPreview = previewSlug(form.slug || form.name) || "…";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="endpoint-name" required>
        <Input
          id="endpoint-name"
          required
          minLength={2}
          maxLength={120}
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </Field>

      {savedQueryId ? null : (
        <Field label="Consulta" htmlFor="endpoint-query" required>
          <Select
            id="endpoint-query"
            required
            value={form.savedQueryId}
            onChange={(event) => update("savedQueryId", event.target.value)}
          >
            {(queries ?? []).map((query) => (
              <option key={query.id} value={query.id}>
                {query.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-[100px_1fr] gap-3">
        <Field label="Versão" htmlFor="endpoint-version">
          <Input
            id="endpoint-version"
            mono
            placeholder="v1"
            value={form.version}
            onChange={(event) => update("version", event.target.value)}
          />
        </Field>

        <Field label="Slug" htmlFor="endpoint-slug">
          <Input
            id="endpoint-slug"
            mono
            maxLength={80}
            placeholder={previewSlug(form.name)}
            value={form.slug}
            onChange={(event) => update("slug", event.target.value)}
          />
        </Field>
      </div>

      <p className="-mt-1 truncate font-mono text-[12px] text-ink-muted">
        /runtime/…/{form.version || "v1"}/{slugPreview}
      </p>

      <Field
        label="Limite de registros"
        htmlFor="endpoint-max-rows"
        hint="Teto aplicado pelo runtime a cada requisição."
      >
        <Input
          id="endpoint-max-rows"
          mono
          type="number"
          min={1}
          max={10000}
          value={form.maxRows}
          onChange={(event) => update("maxRows", event.target.value)}
        />
      </Field>

      <Field label="Descrição" htmlFor="endpoint-description">
        <Input
          id="endpoint-description"
          maxLength={500}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </Field>

      <FormError message={error} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>

        <Button type="submit" variant="primary" loading={busy}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
