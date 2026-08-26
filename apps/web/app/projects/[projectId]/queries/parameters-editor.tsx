"use client";

import {
  QUERY_PARAMETER_TYPES,
  type QueryParameterInput,
  type QueryParameterType,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

/**
 * Parâmetros da consulta.
 *
 * A posição é o vínculo com o marcador do SQL: posição 1 alimenta `$1`.
 * O backend recusa a gravação quando marcadores e posições não batem,
 * e é ele quem decide — aqui a posição é apenas exibida e editada.
 */
export function ParametersEditor({
  parameters,
  onChange,
}: {
  parameters: QueryParameterInput[];
  onChange: (next: QueryParameterInput[]) => void;
}) {
  function update(index: number, patch: Partial<QueryParameterInput>) {
    onChange(
      parameters.map((parameter, current) =>
        current === index ? { ...parameter, ...patch } : parameter,
      ),
    );
  }

  function add() {
    const nextPosition =
      parameters.reduce((max, item) => Math.max(max, item.position), 0) + 1;

    onChange([
      ...parameters,
      { name: "", type: "STRING", position: nextPosition, required: true },
    ]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">
          Parâmetros
        </h2>

        <Button size="sm" onClick={add}>
          Adicionar
        </Button>
      </div>

      {parameters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-muted">
          Nenhum parâmetro. Use <span className="font-mono">$1</span> no SQL e
          declare o parâmetro correspondente.
        </p>
      ) : (
        <TableFrame>
          <Table>
            <thead>
              <tr>
                <Th className="w-16">Marcador</Th>
                <Th>Nome</Th>
                <Th className="w-36">Tipo</Th>
                <Th className="w-24">Obrigatório</Th>
                <Th>Padrão</Th>
                <Th className="w-10" />
              </tr>
            </thead>

            <tbody>
              {parameters.map((parameter, index) => (
                <Tr key={index}>
                  <Td>
                    <Input
                      mono
                      aria-label={`Posição do parâmetro ${index + 1}`}
                      type="number"
                      min={1}
                      max={100}
                      className="h-8 w-16"
                      value={parameter.position}
                      onChange={(event) =>
                        update(index, {
                          position: Number(event.target.value) || 1,
                        })
                      }
                    />
                  </Td>

                  <Td>
                    <Input
                      mono
                      aria-label={`Nome do parâmetro ${index + 1}`}
                      className="h-8"
                      maxLength={60}
                      placeholder="estacaoId"
                      value={parameter.name}
                      onChange={(event) =>
                        update(index, { name: event.target.value })
                      }
                    />
                  </Td>

                  <Td>
                    <Select
                      aria-label={`Tipo do parâmetro ${index + 1}`}
                      className="h-8"
                      value={parameter.type}
                      onChange={(event) =>
                        update(index, {
                          type: event.target.value as QueryParameterType,
                        })
                      }
                    >
                      {QUERY_PARAMETER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </Td>

                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Parâmetro ${index + 1} obrigatório`}
                      className="size-4 accent-[var(--primary)]"
                      checked={parameter.required !== false}
                      onChange={(event) =>
                        update(index, { required: event.target.checked })
                      }
                    />
                  </Td>

                  <Td>
                    <Input
                      mono
                      aria-label={`Valor padrão do parâmetro ${index + 1}`}
                      className="h-8"
                      maxLength={255}
                      value={parameter.defaultValue ?? ""}
                      onChange={(event) =>
                        update(index, {
                          defaultValue: event.target.value || undefined,
                        })
                      }
                    />
                  </Td>

                  <Td>
                    <button
                      type="button"
                      aria-label={`Remover parâmetro ${index + 1}`}
                      onClick={() =>
                        onChange(parameters.filter((_, i) => i !== index))
                      }
                      className="rounded px-1.5 py-0.5 text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      ×
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      )}
    </div>
  );
}
