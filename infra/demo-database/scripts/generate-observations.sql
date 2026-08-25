-- =====================================================================
-- Geração parametrizável de observações meteorológicas sintéticas.
--
-- Serve aos testes de volume: aumenta apenas meteorologia.observacoes,
-- sem alterar a estrutura nem as demais tabelas.
--
-- Parâmetros (psql -v):
--   dias      janela retroativa, em dias          (padrão: 1)
--   intervalo intervalo entre medições, em minutos (padrão: 60)
--   estacoes  quantidade de estações usadas        (padrão: todas)
--
-- O padrão é deliberadamente pequeno. Volumes grandes exigem parâmetro
-- explícito.
--
--   Registros gerados ≈ estações × dias × (1440 / intervalo)
--
-- Exemplos:
--   -- ~2 mil registros (padrão)
--   psql ... -f generate-observations.sql
--
--   -- ~100 mil registros
--   psql ... -v dias=46 -f generate-observations.sql
--
--   -- ~1 milhão de registros: verifique espaço em disco antes
--   psql ... -v dias=115 -v intervalo=15 -f generate-observations.sql
--
-- ATENÇÃO: execuções grandes levam tempo e ocupam disco. Rode em
-- incrementos e acompanhe o resultado antes de aumentar a escala.
-- Os dados continuam sendo SINTÉTICOS.
-- =====================================================================

\if :{?dias}
\else
  \set dias 1
\endif

\if :{?intervalo}
\else
  \set intervalo 60
\endif

\if :{?estacoes}
\else
  \set estacoes 0
\endif

\timing on

\echo 'Gerando observações sintéticas...'
\echo '  dias      :' :dias
\echo '  intervalo :' :intervalo 'minuto(s)'

INSERT INTO meteorologia.observacoes (
  estacao_id, observado_em, temperatura,
  temperatura_minima, temperatura_maxima, umidade,
  pressao_atmosferica, precipitacao, velocidade_vento,
  direcao_vento, radiacao_solar
)
SELECT
  e.id,
  t.momento,
  base.temp,
  ROUND(base.temp - 2.5, 2),
  ROUND(base.temp + 2.5, 2),
  base.umid,
  ROUND((1013 + ((e.id % 7) - 3) * 1.5)::numeric, 2),
  base.chuva,
  base.vento,
  ((e.id * 17 + EXTRACT(HOUR FROM t.momento)::int * 13) % 360),
  CASE
    WHEN EXTRACT(HOUR FROM t.momento) BETWEEN 6 AND 18
      THEN ROUND((800 * sin(pi() *
             (EXTRACT(HOUR FROM t.momento) - 6) / 12))::numeric, 2)
    ELSE 0
  END
FROM (
  SELECT id, latitude
  FROM referencia.estacoes
  ORDER BY id
  LIMIT CASE WHEN :estacoes > 0 THEN :estacoes ELSE NULL END
) e
CROSS JOIN LATERAL generate_series(
  date_trunc('hour', now()) - (:dias * INTERVAL '1 day'),
  date_trunc('hour', now()) - INTERVAL '1 minute',
  (:intervalo * INTERVAL '1 minute')
) AS t(momento)
CROSS JOIN LATERAL (
  SELECT
    ROUND((22 - (e.latitude / 8)
           + 6 * sin(pi() * (EXTRACT(HOUR FROM t.momento) - 9) / 12)
          )::numeric, 2) AS temp,
    ROUND((55 + 25 * cos(pi() * EXTRACT(HOUR FROM t.momento) / 12)
          )::numeric, 2) AS umid,
    CASE WHEN ((e.id * 31 + EXTRACT(DOY FROM t.momento)::int * 7
                + EXTRACT(HOUR FROM t.momento)::int) % 23) = 0
      THEN ROUND((((e.id * 11) % 40) + 1)::numeric, 2)
      ELSE 0
    END AS chuva,
    ROUND((3 + ((e.id + EXTRACT(HOUR FROM t.momento)::int) % 25)
          )::numeric, 2) AS vento
) AS base
-- Permite reexecutar e ampliar a janela sem violar o UNIQUE.
ON CONFLICT (estacao_id, observado_em) DO NOTHING;

\echo 'Total de observações na base:'
SELECT COUNT(*) AS observacoes FROM meteorologia.observacoes;

-- Após cargas grandes, atualizar as estatísticas do planejador.
ANALYZE meteorologia.observacoes;

\timing off
