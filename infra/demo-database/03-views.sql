-- =====================================================================
-- Views do banco demo.
--
-- Servem a dois propósitos: simplificar consultas de demonstração e
-- oferecer objetos do tipo VIEW para a introspecção distinguir de
-- tabelas físicas.
--
-- CREATE OR REPLACE mantém o script idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- meteorologia.vw_observacoes_detalhadas
--
-- Observação já resolvida na hierarquia estação → município → estado,
-- evitando repetir três JOINs em cada consulta de demonstração.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW meteorologia.vw_observacoes_detalhadas AS
SELECT
  o.id               AS observacao_id,
  o.observado_em,
  e.codigo           AS estacao_codigo,
  e.nome             AS estacao_nome,
  m.nome             AS municipio,
  uf.sigla           AS estado,
  o.temperatura,
  o.umidade,
  o.precipitacao,
  o.velocidade_vento
FROM meteorologia.observacoes o
JOIN referencia.estacoes  e  ON e.id  = o.estacao_id
JOIN referencia.municipios m ON m.id  = e.municipio_id
JOIN referencia.estados   uf ON uf.id = m.estado_id;

COMMENT ON VIEW meteorologia.vw_observacoes_detalhadas IS
  'Observações com estação, município e estado resolvidos.';

-- ---------------------------------------------------------------------
-- impactos.vw_resumo_eventos
--
-- Um evento pode ter vários impactos registrados. A view agrega esses
-- impactos por evento, devolvendo uma linha por evento.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW impactos.vw_resumo_eventos AS
SELECT
  ev.id                              AS evento_id,
  te.codigo                          AS tipo_codigo,
  te.nome                            AS tipo_nome,
  m.nome                             AS municipio,
  uf.sigla                           AS estado,
  ev.inicio_em,
  ev.fim_em,
  ev.severidade,
  ev.precipitacao_total,
  ev.velocidade_maxima_vento,
  COUNT(i.id)                        AS registros_impacto,
  COALESCE(SUM(i.pessoas_afetadas), 0)      AS pessoas_afetadas,
  COALESCE(SUM(i.desalojados), 0)           AS desalojados,
  COALESCE(SUM(i.desabrigados), 0)          AS desabrigados,
  COALESCE(SUM(i.area_agricola_afetada), 0) AS area_agricola_afetada,
  COALESCE(SUM(i.prejuizo_estimado), 0)     AS prejuizo_estimado
FROM meteorologia.eventos_climaticos ev
JOIN referencia.tipos_evento te ON te.id = ev.tipo_evento_id
JOIN referencia.municipios   m  ON m.id  = ev.municipio_id
JOIN referencia.estados      uf ON uf.id = m.estado_id
-- LEFT JOIN para que eventos sem impacto registrado apareçam com zero.
LEFT JOIN impactos.impactos_climaticos i ON i.evento_id = ev.id
GROUP BY
  ev.id, te.codigo, te.nome, m.nome, uf.sigla,
  ev.inicio_em, ev.fim_em, ev.severidade,
  ev.precipitacao_total, ev.velocidade_maxima_vento;

COMMENT ON VIEW impactos.vw_resumo_eventos IS
  'Um registro por evento climático, com impactos consolidados.';
