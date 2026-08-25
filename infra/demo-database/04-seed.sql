-- =====================================================================
-- Carga inicial do banco demo.
--
-- ATENÇÃO: todos os dados são SINTÉTICOS, gerados de forma
-- determinística. Não provêm do INMET, da NASA, da NOAA nem de
-- qualquer serviço meteorológico. Não descrevem condições reais e não
-- devem ser usados para qualquer decisão operacional.
--
-- Idempotente: reexecutar não duplica registros.
-- Volume desta carga: 43.200 observações (90 estações x 20 dias x 24
-- horas), adequado ao desenvolvimento. Para cenários maiores, usar
-- scripts/generate-observations.sql.
-- =====================================================================

BEGIN;

-- Semente fixa: a mesma carga é reproduzida a cada execução.
SELECT setseed(0.42);

-- ---------------------------------------------------------------------
-- referencia.estados — 27 unidades federativas
-- ---------------------------------------------------------------------
INSERT INTO referencia.estados (sigla, nome) VALUES
  ('AC', 'Acre'),                ('AL', 'Alagoas'),
  ('AP', 'Amapá'),               ('AM', 'Amazonas'),
  ('BA', 'Bahia'),               ('CE', 'Ceará'),
  ('DF', 'Distrito Federal'),    ('ES', 'Espírito Santo'),
  ('GO', 'Goiás'),               ('MA', 'Maranhão'),
  ('MT', 'Mato Grosso'),         ('MS', 'Mato Grosso do Sul'),
  ('MG', 'Minas Gerais'),        ('PA', 'Pará'),
  ('PB', 'Paraíba'),             ('PR', 'Paraná'),
  ('PE', 'Pernambuco'),          ('PI', 'Piauí'),
  ('RJ', 'Rio de Janeiro'),      ('RN', 'Rio Grande do Norte'),
  ('RS', 'Rio Grande do Sul'),   ('RO', 'Rondônia'),
  ('RR', 'Roraima'),             ('SC', 'Santa Catarina'),
  ('SP', 'São Paulo'),           ('SE', 'Sergipe'),
  ('TO', 'Tocantins')
ON CONFLICT (sigla) DO NOTHING;

-- ---------------------------------------------------------------------
-- referencia.tipos_evento
-- ---------------------------------------------------------------------
INSERT INTO referencia.tipos_evento (codigo, nome, descricao) VALUES
  ('SECA', 'Seca',
   'Período prolongado de precipitação abaixo do esperado.'),
  ('ONDA_DE_CALOR', 'Onda de calor',
   'Sequência de dias com temperatura muito acima da média.'),
  ('CHUVA_INTENSA', 'Chuva intensa',
   'Precipitação de grande volume em curto intervalo.'),
  ('TEMPESTADE', 'Tempestade',
   'Chuva forte acompanhada de descargas elétricas e rajadas.'),
  ('INUNDACAO', 'Inundação',
   'Extravasamento de corpos d''água sobre áreas ocupadas.'),
  ('VENDAVAL', 'Vendaval',
   'Ventos de alta velocidade com potencial destrutivo.')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- referencia.municipios — 3 por estado, nomes sintéticos
--
-- Os nomes são fictícios e propositalmente genéricos, para deixar
-- evidente que não representam municípios reais.
-- ---------------------------------------------------------------------
INSERT INTO referencia.municipios
  (estado_id, nome, codigo_ibge, latitude, longitude)
SELECT
  uf.id,
  nome_base || ' ' || uf.sigla,
  -- Código sintético, sem correspondência com a tabela oficial do IBGE.
  lpad(uf.id::text, 2, '0') || lpad(n.ord::text, 5, '0'),
  ROUND((-33 + (uf.id * 1.7) + n.ord)::numeric, 6),
  ROUND((-72 + (uf.id * 1.1) + n.ord)::numeric, 6)
FROM referencia.estados uf
CROSS JOIN (
  VALUES ('Vila Nova', 1), ('Santa Clara', 2), ('Porto Sereno', 3)
) AS n(nome_base, ord)
ON CONFLICT (estado_id, nome) DO NOTHING;

-- ---------------------------------------------------------------------
-- referencia.estacoes
--
-- Uma estação por município, mais uma segunda estação nos nove
-- primeiros municípios, para exercitar a cardinalidade 1:N.
-- ---------------------------------------------------------------------
INSERT INTO referencia.estacoes
  (codigo, nome, municipio_id, latitude, longitude, altitude,
   ativa, instalada_em)
SELECT
  'EST-' || lpad(m.id::text, 5, '0') || '-' || s.sufixo,
  'Estação ' || m.nome || ' ' || s.sufixo,
  m.id,
  ROUND((m.latitude  + (s.desloc * 0.05))::numeric, 6),
  ROUND((m.longitude + (s.desloc * 0.05))::numeric, 6),
  ROUND((50 + ((m.id * 37) % 900))::numeric, 2),
  -- Uma estação a cada onze é marcada como inativa.
  (m.id % 11) <> 0,
  DATE '2015-01-01' + (((m.id * 13) % 2500))::int
FROM (
  SELECT mu.*, row_number() OVER (ORDER BY mu.id) AS ordem
  FROM referencia.municipios mu
) m
JOIN LATERAL (
  VALUES ('A', 0), ('B', 1)
) AS s(sufixo, desloc)
  ON s.sufixo = 'A' OR m.ordem <= 9
ON CONFLICT (codigo) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- meteorologia.observacoes
--
-- Vinte dias de medições horárias para cada estação, o que resulta em
-- 90 x 20 x 24 = 43.200 registros na carga padrão. O valor de cada
-- grandeza combina um ciclo diário com uma variação por estação, de
-- modo que a série tenha forma plausível sem representar dado real.
-- Volumes maiores são responsabilidade de
-- scripts/generate-observations.sql, não deste arquivo.
-- ---------------------------------------------------------------------
BEGIN;

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
  -- Radiação apenas durante o dia.
  CASE
    WHEN EXTRACT(HOUR FROM t.momento) BETWEEN 6 AND 18
      THEN ROUND((800 * sin(pi() *
             (EXTRACT(HOUR FROM t.momento) - 6) / 12))::numeric, 2)
    ELSE 0
  END
FROM referencia.estacoes e
CROSS JOIN LATERAL generate_series(
  date_trunc('hour', now()) - INTERVAL '20 days',
  date_trunc('hour', now()) - INTERVAL '1 hour',
  INTERVAL '1 hour'
) AS t(momento)
CROSS JOIN LATERAL (
  SELECT
    -- Ciclo diário deslocado pela latitude da estação.
    ROUND((22 - (e.latitude / 8)
           + 6 * sin(pi() * (EXTRACT(HOUR FROM t.momento) - 9) / 12)
          )::numeric, 2) AS temp,
    ROUND((55 + 25 * cos(pi() * EXTRACT(HOUR FROM t.momento) / 12)
          )::numeric, 2) AS umid,
    -- Chuva esparsa: a maioria das horas não registra precipitação.
    CASE WHEN ((e.id * 31 + EXTRACT(DOY FROM t.momento)::int * 7
                + EXTRACT(HOUR FROM t.momento)::int) % 23) = 0
      THEN ROUND((((e.id * 11) % 40) + 1)::numeric, 2)
      ELSE 0
    END AS chuva,
    ROUND((3 + ((e.id + EXTRACT(HOUR FROM t.momento)::int) % 25)
          )::numeric, 2) AS vento
) AS base
ON CONFLICT (estacao_id, observado_em) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- meteorologia.resumos_diarios — agregação das observações acima
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO meteorologia.resumos_diarios (
  estacao_id, data, temperatura_minima, temperatura_maxima,
  temperatura_media, umidade_media, precipitacao_total,
  velocidade_media_vento, velocidade_maxima_vento
)
SELECT
  o.estacao_id,
  (o.observado_em AT TIME ZONE 'UTC')::date,
  ROUND(MIN(o.temperatura), 2),
  ROUND(MAX(o.temperatura), 2),
  ROUND(AVG(o.temperatura), 2),
  ROUND(AVG(o.umidade), 2),
  ROUND(SUM(o.precipitacao), 2),
  ROUND(AVG(o.velocidade_vento), 2),
  ROUND(MAX(o.velocidade_vento), 2)
FROM meteorologia.observacoes o
GROUP BY o.estacao_id, (o.observado_em AT TIME ZONE 'UTC')::date
-- DO UPDATE, e não DO NOTHING: ao ampliar a janela de observações o
-- resumo de um dia já existente precisa ser recalculado.
ON CONFLICT (estacao_id, data) DO UPDATE SET
  temperatura_minima      = EXCLUDED.temperatura_minima,
  temperatura_maxima      = EXCLUDED.temperatura_maxima,
  temperatura_media       = EXCLUDED.temperatura_media,
  umidade_media           = EXCLUDED.umidade_media,
  precipitacao_total      = EXCLUDED.precipitacao_total,
  velocidade_media_vento  = EXCLUDED.velocidade_media_vento,
  velocidade_maxima_vento = EXCLUDED.velocidade_maxima_vento;

COMMIT;

-- ---------------------------------------------------------------------
-- meteorologia.previsoes — cinco dias à frente para cada município
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO meteorologia.previsoes (
  municipio_id, gerada_em, prevista_para,
  temperatura_minima, temperatura_maxima, umidade,
  precipitacao_prevista, probabilidade_chuva, velocidade_vento
)
SELECT
  m.id,
  date_trunc('day', now()),
  date_trunc('day', now()) + (d.dia * INTERVAL '1 day'),
  ROUND((14 - (m.latitude / 10) + (d.dia % 3))::numeric, 2),
  ROUND((26 - (m.latitude / 10) + (d.dia % 4))::numeric, 2),
  ROUND((50 + ((m.id + d.dia * 7) % 45))::numeric, 2),
  ROUND((((m.id * 3 + d.dia) % 30))::numeric, 2),
  ROUND((((m.id * 13 + d.dia * 19) % 101))::numeric, 2),
  ROUND((5 + ((m.id + d.dia) % 20))::numeric, 2)
FROM referencia.municipios m
CROSS JOIN generate_series(1, 5) AS d(dia)
ON CONFLICT (municipio_id, gerada_em, prevista_para) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- meteorologia.eventos_climaticos
--
-- Sem chave natural para conflito, a inserção só ocorre quando a
-- tabela está vazia, mantendo o script idempotente.
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO meteorologia.eventos_climaticos (
  tipo_evento_id, municipio_id, inicio_em, fim_em, severidade,
  descricao, temperatura_maxima, precipitacao_total,
  velocidade_maxima_vento
)
SELECT
  te.id,
  m.id,
  date_trunc('hour', now()) - ((m.id * 5 + te.id * 3) * INTERVAL '1 hour'),
  -- Um evento a cada sete permanece em curso: fim_em nulo.
  CASE WHEN ((m.id + te.id) % 7) = 0 THEN NULL
       ELSE date_trunc('hour', now())
            - ((m.id * 5 + te.id * 3) * INTERVAL '1 hour')
            + (((m.id + te.id) % 48 + 2) * INTERVAL '1 hour')
  END,
  -- m.ordem isolado garante a rotação pelas quatro severidades; somar
  -- te.ordem correlacionaria com o tipo e reduziria a variedade.
  (ARRAY['BAIXA', 'MODERADA', 'ALTA', 'EXTREMA'])
    [1 + (m.ordem % 4)::int],
  'Registro sintético de ' || te.nome || ' para demonstração.',
  ROUND((28 + ((m.id + te.id) % 15))::numeric, 2),
  ROUND((((m.id * 7 + te.id * 11) % 250))::numeric, 2),
  ROUND((20 + ((m.id * 3 + te.id) % 90))::numeric, 2)
FROM (
  SELECT mu.*, row_number() OVER (ORDER BY mu.id) AS ordem
  FROM referencia.municipios mu
) m
JOIN (
  SELECT tp.*, row_number() OVER (ORDER BY tp.id) AS ordem
  FROM referencia.tipos_evento tp
) te
  -- Distribui os tipos entre os municípios sem gerar o produto completo.
  ON (m.ordem % 6) + 1 = te.ordem
WHERE NOT EXISTS (
  SELECT 1 FROM meteorologia.eventos_climaticos
);

COMMIT;

-- ---------------------------------------------------------------------
-- impactos.impactos_climaticos
--
-- Eventos de severidade ALTA ou EXTREMA recebem dois registros de
-- impacto; os demais recebem um.
-- ---------------------------------------------------------------------
BEGIN;

INSERT INTO impactos.impactos_climaticos (
  evento_id, municipio_id, pessoas_afetadas, desalojados,
  desabrigados, area_agricola_afetada, prejuizo_estimado,
  interrupcao_energia, interrupcao_agua, descricao
)
SELECT
  ev.id,
  ev.municipio_id,
  ((ev.id * 137) % 5000) + r.ord * 50,
  ((ev.id * 41) % 400),
  ((ev.id * 23) % 150),
  ROUND((((ev.id * 97) % 12000))::numeric, 2),
  ROUND((((ev.id * 613) % 900000))::numeric, 2),
  (ev.id % 3) = 0,
  (ev.id % 5) = 0,
  'Impacto sintético associado ao evento ' || ev.id || '.'
FROM meteorologia.eventos_climaticos ev
JOIN LATERAL (
  VALUES (1), (2)
) AS r(ord)
  ON r.ord = 1
  OR ev.severidade IN ('ALTA', 'EXTREMA')
WHERE NOT EXISTS (
  SELECT 1 FROM impactos.impactos_climaticos
);

COMMIT;

-- ---------------------------------------------------------------------
-- Conferência rápida
-- ---------------------------------------------------------------------
SELECT 'estados'             AS tabela, COUNT(*) FROM referencia.estados
UNION ALL SELECT 'municipios',          COUNT(*) FROM referencia.municipios
UNION ALL SELECT 'estacoes',            COUNT(*) FROM referencia.estacoes
UNION ALL SELECT 'tipos_evento',        COUNT(*) FROM referencia.tipos_evento
UNION ALL SELECT 'observacoes',         COUNT(*) FROM meteorologia.observacoes
UNION ALL SELECT 'resumos_diarios',     COUNT(*) FROM meteorologia.resumos_diarios
UNION ALL SELECT 'previsoes',           COUNT(*) FROM meteorologia.previsoes
UNION ALL SELECT 'eventos_climaticos',  COUNT(*) FROM meteorologia.eventos_climaticos
UNION ALL SELECT 'impactos_climaticos', COUNT(*) FROM impactos.impactos_climaticos;
