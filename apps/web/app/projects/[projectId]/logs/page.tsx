"use client";

import { useCallback, useMemo } from "react";

import * as endpointsApi from "@/lib/api/endpoints";
import * as logsApi from "@/lib/api/logs";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { useProject } from "@/lib/project-context";
import { useResource } from "@/lib/use-resource";
import { PageHeader } from "@/components/shell/page-header";
import { cx } from "@/components/ui/cx";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/ui/states";

const PAGE_SIZE = 100;

/**
 * Execuções do runtime. Os registros são técnicos por construção: o
 * backend não guarda parâmetros, chaves nem mensagens de erro.
 */
export default function LogsPage() {
  const { project } = useProject();

  const metrics = useResource(
    useCallback(
      (signal: AbortSignal) => logsApi.getMetrics(project.id, signal),
      [project.id],
    ),
  );

  const data = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const [logs, endpoints] = await Promise.all([
          logsApi.listLogs(project.id, { take: PAGE_SIZE }, signal),
          endpointsApi.listEndpoints(project.id, signal),
        ]);

        return { logs, endpoints };
      },
      [project.id],
    ),
  );

  // O log guarda o identificador do endpoint; o nome vem da listagem.
  const endpointNames = useMemo(() => {
    return new Map(
      (data.data?.endpoints ?? []).map((endpoint) => [
        endpoint.id,
        `${endpoint.version}/${endpoint.slug}`,
      ]),
    );
  }, [data.data]);

  return (
    <>
      <PageHeader
        title="Logs"
        description="Últimas execuções dos endpoints publicados."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total"
          value={
            metrics.loading
              ? "—"
              : formatNumber(metrics.data?.totalRequests ?? 0)
          }
        />

        <Stat
          label="Sucesso"
          value={
            metrics.loading
              ? "—"
              : formatNumber(metrics.data?.successfulRequests ?? 0)
          }
        />

        <Stat
          label="Falhas"
          value={
            metrics.loading
              ? "—"
              : formatNumber(metrics.data?.failedRequests ?? 0)
          }
        />

        <Stat
          label="Tempo médio"
          value={
            metrics.loading
              ? "—"
              : formatDuration(metrics.data?.averageDurationMs ?? null)
          }
        />
      </div>

      <div className="mt-6">
        {data.loading ? (
          <SkeletonRows rows={5} className="[&>*]:h-10" />
        ) : data.error ? (
          <ErrorState message={data.error} onRetry={data.reload} />
        ) : data.data && data.data.logs.length > 0 ? (
          <TableFrame>
            <Table>
              <thead>
                <tr>
                  <Th className="w-20">Status</Th>
                  <Th>Endpoint</Th>
                  <Th align="right">Duração</Th>
                  <Th align="right">Registros</Th>
                  <Th>Erro</Th>
                  <Th align="right">Data</Th>
                </tr>
              </thead>

              <tbody>
                {data.data.logs.map((log) => (
                  <Tr key={log.id}>
                    <Td>
                      <span
                        className={cx(
                          "font-mono text-[12.5px] font-medium tabular-nums",
                          statusColor(log.statusCode),
                        )}
                      >
                        {log.statusCode}
                      </span>
                    </Td>

                    <Td mono className="text-ink-muted">
                      {endpointNames.get(log.endpointId) ?? "—"}
                    </Td>

                    <Td align="right" className="text-ink-muted">
                      {formatDuration(log.durationMs)}
                    </Td>

                    <Td align="right" className="text-ink-muted">
                      {log.rowCount === null ? "—" : formatNumber(log.rowCount)}
                    </Td>

                    <Td mono className="text-ink-muted">
                      {log.errorCode ?? "—"}
                    </Td>

                    <Td align="right" className="text-ink-muted">
                      {formatDateTime(log.createdAt)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        ) : (
          <EmptyState
            title="Nenhuma requisição registrada."
            description="Os registros aparecem depois que um endpoint publicado é chamado."
          />
        )}
      </div>
    </>
  );
}

/** Cor discreta por faixa de status, sem saturação. */
function statusColor(status: number): string {
  if (status < 300) return "text-success";
  if (status < 500) return "text-warning";

  return "text-danger";
}
