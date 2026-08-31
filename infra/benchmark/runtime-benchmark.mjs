/**
 * Avaliação de desempenho do runtime.
 *
 * Mede o caminho completo de uma requisição publicada: resolução do
 * endpoint no banco interno, autenticação por API Key, execução da
 * consulta parametrizada no banco externo e registro do RequestLog.
 *
 * Os números obtidos descrevem o ambiente local em que o script rodou.
 * Não são capacidade de produção: a máquina de desenvolvimento hospeda,
 * ao mesmo tempo, o cliente, a API e os dois PostgreSQL.
 *
 * Uso:
 *   node infra/benchmark/runtime-benchmark.mjs \
 *     --url http://localhost:3001/runtime/projeto/v1/endpoint \
 *     --key gapi_... \
 *     --requests 200 --concurrency 10
 *
 * Nenhuma dependência externa: apenas o `fetch` do Node.
 */

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');

    if (key) {
      args[key] = argv[i + 1];
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));

const url = args.url;
const apiKey = args.key;
const total = Number(args.requests ?? 200);
const concurrency = Number(args.concurrency ?? 10);
const warmup = Number(args.warmup ?? 20);
const label = args.label ?? 'cenário';

if (!url || !apiKey) {
  console.error('Informe --url e --key.');
  process.exit(1);
}

async function once() {
  const startedAt = performance.now();

  const response = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const body = await response.json().catch(() => null);

  return {
    ms: performance.now() - startedAt,
    ok: response.ok,
    status: response.status,
    rowCount: body?.rowCount,
    maxRows: body?.maxRows,
    truncated: body?.truncated,
  };
}

/**
 * Mantém `concurrency` requisições em voo até completar `count`, o que
 * aproxima melhor um cliente real do que disparar tudo de uma vez.
 */
async function run(count) {
  const results = [];
  let started = 0;

  async function worker() {
    while (started < count) {
      started += 1;
      results.push(await once());
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, count) }, () => worker()),
  );

  return results;
}

function percentile(sorted, p) {
  if (sorted.length === 0) {
    return null;
  }

  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );

  return sorted[index];
}

// O primeiro acesso paga a abertura de conexões e o aquecimento dos
// caches do PostgreSQL; medir isso junto distorceria a média.
if (warmup > 0) {
  await run(warmup);
}

const startedAt = performance.now();
const results = await run(total);
const elapsedSeconds = (performance.now() - startedAt) / 1000;

const sucessos = results.filter((r) => r.ok);
const falhas = results.length - sucessos.length;
const tempos = sucessos.map((r) => r.ms).sort((a, b) => a - b);
const media = tempos.reduce((sum, ms) => sum + ms, 0) / (tempos.length || 1);

const amostra = sucessos[0] ?? {};
const round = (value) => (value === null ? null : Number(value.toFixed(1)));

console.log(
  JSON.stringify(
    {
      cenario: label,
      requisicoes: total,
      concorrencia: concurrency,
      sucessos: sucessos.length,
      falhas,
      statusDasFalhas: [...new Set(results.filter((r) => !r.ok).map((r) => r.status))],
      duracaoTotalS: Number(elapsedSeconds.toFixed(2)),
      throughputReqS: Number((total / elapsedSeconds).toFixed(1)),
      mediaMs: round(media),
      p50Ms: round(percentile(tempos, 50)),
      p95Ms: round(percentile(tempos, 95)),
      p99Ms: round(percentile(tempos, 99)),
      minMs: round(tempos[0] ?? null),
      maxMs: round(tempos[tempos.length - 1] ?? null),
      rowCount: amostra.rowCount,
      maxRows: amostra.maxRows,
      truncated: amostra.truncated,
    },
    null,
    2,
  ),
);
