"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import * as queriesApi from "@/lib/api/queries";
import type {
  DatabaseConnection,
  QueryExecutionResult,
  QueryParameterInput,
  SavedQuery,
} from "@/lib/api/types";
import { errorMessage } from "@/lib/use-resource";
import { EndpointDialog } from "@/components/endpoint-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { SqlEditor } from "@/components/sql-editor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ParametersEditor } from "./parameters-editor";
import { ResultTable } from "./result-table";

const DEFAULT_SQL = "SELECT\n  *\nFROM ";

/**
 * Edição de uma consulta: SQL, parâmetros e execução de teste.
 *
 * A mesma tela atende a criação e a edição. A conexão só é escolhida na
 * criação — o backend não permite mover uma consulta de conexão.
 */
export function QueryWorkbench({
  projectId,
  connections,
  query,
}: {
  projectId: string;
  connections: DatabaseConnection[];
  query?: SavedQuery;
}) {
  const router = useRouter();
  const { notify } = useToast();

  const [connectionId, setConnectionId] = useState(
    query?.connectionId ?? connections[0]?.id ?? "",
  );
  const [name, setName] = useState(query?.name ?? "");
  const [description, setDescription] = useState(query?.description ?? "");
  const [sql, setSql] = useState(query?.sql ?? DEFAULT_SQL);

  const [parameters, setParameters] = useState<QueryParameterInput[]>(
    (query?.parameters ?? []).map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      position: parameter.position,
      required: parameter.required,
      ...(parameter.defaultValue !== null && {
        defaultValue: parameter.defaultValue,
      }),
      ...(parameter.description !== null && {
        description: parameter.description,
      }),
    })),
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, string>>({});
  const [maxRows, setMaxRows] = useState("100");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryExecutionResult | null>(null);

  const [removing, setRemoving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  function payload() {
    return {
      name: name.trim(),
      description: description.trim(),
      sql: sql.trim(),
      parameters: parameters.map((parameter) => ({
        ...parameter,
        name: parameter.name.trim(),
      })),
    };
  }

  async function save() {
    setSaving(true);
    setSaveError(null);

    try {
      if (query) {
        await queriesApi.updateQuery(query.id, payload());

        notify("Consulta salva.");
        router.refresh();
      } else {
        const created = await queriesApi.createQuery(connectionId, payload());

        notify("Consulta criada.");
        router.replace(`/projects/${projectId}/queries/${created.id}`);
      }
    } catch (cause) {
      setSaveError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function execute() {
    if (!query) {
      return;
    }

    setRunning(true);
    setRunError(null);

    try {
      setResult(
        await queriesApi.executeQuery(query.id, {
          parameters: values,
          maxRows: Number(maxRows) || 100,
        }),
      );
    } catch (cause) {
      setResult(null);
      setRunError(errorMessage(cause));
    } finally {
      setRunning(false);
    }
  }

  const base = `/projects/${projectId}`;

  return (
    <>
      <PageHeader
        title={query ? query.name : "Nova consulta"}
        description={
          <Link href={`${base}/queries`} className="text-primary">
            ← Consultas
          </Link>
        }
        actions={
          <>
            {query ? (
              <>
                <Button variant="ghost" onClick={() => setRemoving(true)}>
                  Excluir
                </Button>

                <Button onClick={() => setPublishing(true)}>
                  Criar endpoint
                </Button>
              </>
            ) : null}

            <Button
              variant="primary"
              loading={saving}
              onClick={() => void save()}
            >
              Salvar
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="query-name" required>
          <Input
            id="query-name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Conexão"
          htmlFor="query-connection"
          hint={query ? "Definida na criação." : undefined}
        >
          <Select
            id="query-connection"
            disabled={Boolean(query)}
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
          >
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Descrição" htmlFor="query-description" className="mt-4">
        <Input
          id="query-description"
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
          SQL
        </h2>

        <SqlEditor value={sql} onChange={setSql} height="280px" />

        <p className="mt-1.5 text-[12px] text-ink-muted">
          Somente consultas de leitura. Use marcadores posicionais —{" "}
          <span className="font-mono">$1</span>,{" "}
          <span className="font-mono">$2</span> — para os parâmetros.
        </p>
      </div>

      <div className="mt-6">
        <ParametersEditor parameters={parameters} onChange={setParameters} />
      </div>

      {saveError ? (
        <div className="mt-4">
          <FormError message={saveError} />
        </div>
      ) : null}

      {query ? (
        <section className="mt-8 border-t border-line pt-6">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
            Executar
          </h2>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            {query.parameters.map((parameter) => (
              <Field
                key={parameter.id}
                label={parameter.name}
                htmlFor={`value-${parameter.id}`}
                required={parameter.required}
                className="w-48"
                hint={parameter.type.toLowerCase()}
              >
                <Input
                  id={`value-${parameter.id}`}
                  mono
                  className="h-8"
                  placeholder={parameter.defaultValue ?? ""}
                  value={values[parameter.name] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [parameter.name]: event.target.value,
                    }))
                  }
                />
              </Field>
            ))}

            <Field label="Limite" htmlFor="max-rows" className="w-28">
              <Input
                id="max-rows"
                mono
                type="number"
                min={1}
                max={1000}
                className="h-8"
                value={maxRows}
                onChange={(event) => setMaxRows(event.target.value)}
              />
            </Field>

            <Button
              variant="primary"
              size="sm"
              loading={running}
              onClick={() => void execute()}
            >
              Executar
            </Button>
          </div>

          {/* Os parâmetros exibidos vêm da versão salva: alterações não
              gravadas ainda não valem para a execução. */}
          {runError ? (
            <div className="mt-4">
              <FormError message={runError} />
            </div>
          ) : null}

          {result ? (
            <div className="mt-4">
              <ResultTable result={result} />
            </div>
          ) : null}
        </section>
      ) : null}

      {query ? (
        <>
          <EndpointDialog
            open={publishing}
            projectId={projectId}
            savedQueryId={query.id}
            defaultName={query.name}
            onClose={() => setPublishing(false)}
            onSaved={(endpoint) => {
              setPublishing(false);
              notify("Endpoint criado.");
              router.push(`${base}/endpoints/${endpoint.id}`);
            }}
          />

          <ConfirmDialog
            open={removing}
            title="Excluir consulta"
            description="Endpoints associados impedem a exclusão."
            confirmLabel="Excluir"
            onClose={() => setRemoving(false)}
            onConfirm={async () => {
              await queriesApi.deleteQuery(query.id);

              notify("Consulta removida.");
              router.replace(`${base}/queries`);
            }}
          />
        </>
      ) : null}
    </>
  );
}
