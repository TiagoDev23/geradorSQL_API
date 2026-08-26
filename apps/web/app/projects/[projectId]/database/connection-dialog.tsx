"use client";

import { useState } from "react";

import * as connectionsApi from "@/lib/api/connections";
import type { DatabaseConnection, DatabaseSslMode } from "@/lib/api/types";
import { errorMessage } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormError } from "@/components/ui/states";

/**
 * Cadastro e edição de conexão.
 *
 * Na edição o campo de senha começa vazio e só é enviado quando
 * preenchido: o backend preserva a credencial atual quando `password`
 * é omitida. A senha cifrada nunca chega ao navegador.
 */
export function ConnectionDialog({
  open,
  projectId,
  connection,
  onClose,
  onSaved,
}: Props) {
  const editing = connection !== undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Editar conexão" : "Nova conexão"}
      description="As credenciais são cifradas pelo servidor antes de serem gravadas."
    >
      {/* O formulário só existe enquanto o diálogo está aberto: fechar e
          reabrir recomeça do registro atual, sem efeito de sincronização. */}
      <ConnectionForm
        projectId={projectId}
        connection={connection}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

interface Props {
  open: boolean;
  projectId: string;
  connection?: DatabaseConnection;
  onClose: () => void;
  onSaved: () => void;
}

function ConnectionForm({
  projectId,
  connection,
  onClose,
  onSaved,
}: Omit<Props, "open">) {
  const editing = connection !== undefined;

  const [form, setForm] = useState({
    name: connection?.name ?? "",
    host: connection?.host ?? "127.0.0.1",
    port: String(connection?.port ?? 5432),
    databaseName: connection?.databaseName ?? "",
    defaultSchema: connection?.defaultSchema ?? "public",
    username: connection?.username ?? "",
    password: "",
    sslMode: connection?.sslMode ?? ("DISABLE" as DatabaseSslMode),
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

    const payload = {
      name: form.name.trim(),
      host: form.host.trim(),
      port: Number(form.port),
      databaseName: form.databaseName.trim(),
      defaultSchema: form.defaultSchema.trim() || "public",
      username: form.username.trim(),
      sslMode: form.sslMode,
    };

    try {
      if (connection) {
        await connectionsApi.updateConnection(connection.id, {
          ...payload,
          ...(form.password && { password: form.password }),
        });
      } else {
        await connectionsApi.createConnection(projectId, {
          ...payload,
          password: form.password,
        });
      }

      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="connection-name" required>
        <Input
          id="connection-name"
          required
          minLength={2}
          maxLength={80}
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Host" htmlFor="connection-host" required>
          <Input
            id="connection-host"
            mono
            required
            value={form.host}
            onChange={(event) => update("host", event.target.value)}
          />
        </Field>

        <Field label="Porta" htmlFor="connection-port" required>
          <Input
            id="connection-port"
            mono
            type="number"
            min={1}
            max={65535}
            required
            value={form.port}
            onChange={(event) => update("port", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Banco" htmlFor="connection-database" required>
          <Input
            id="connection-database"
            mono
            required
            value={form.databaseName}
            onChange={(event) => update("databaseName", event.target.value)}
          />
        </Field>

        <Field label="Schema padrão" htmlFor="connection-schema">
          <Input
            id="connection-schema"
            mono
            value={form.defaultSchema}
            onChange={(event) => update("defaultSchema", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Usuário" htmlFor="connection-username" required>
          <Input
            id="connection-username"
            mono
            required
            value={form.username}
            onChange={(event) => update("username", event.target.value)}
          />
        </Field>

        <Field
          label="Senha"
          htmlFor="connection-password"
          required={!editing}
          hint={editing ? "Em branco mantém a senha atual." : undefined}
        >
          <Input
            id="connection-password"
            type="password"
            autoComplete="new-password"
            required={!editing}
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
          />
        </Field>
      </div>

      <Field label="SSL" htmlFor="connection-ssl">
        <Select
          id="connection-ssl"
          value={form.sslMode}
          onChange={(event) =>
            update("sslMode", event.target.value as DatabaseSslMode)
          }
        >
          <option value="DISABLE">Desabilitado</option>
          <option value="REQUIRE">Obrigatório</option>
        </Select>
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
