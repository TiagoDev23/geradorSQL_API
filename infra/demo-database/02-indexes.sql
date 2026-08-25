-- =====================================================================
-- Índices do banco demo.
--
-- Critério: só existe índice para um padrão de acesso esperado. PK e
-- UNIQUE já criam índice próprio, portanto não são duplicados aqui.
-- Idempotente.
-- =====================================================================

-- referencia -----------------------------------------------------------

-- Listar municípios de um estado é a navegação básica da hierarquia.
CREATE INDEX IF NOT EXISTS municipios_estado_id_idx
  ON referencia.municipios (estado_id);

-- Localizar as estações de um município.
CREATE INDEX IF NOT EXISTS estacoes_municipio_id_idx
  ON referencia.estacoes (municipio_id);

-- Filtrar apenas estações em operação. Índice parcial: as inativas são
-- minoria e raramente consultadas.
CREATE INDEX IF NOT EXISTS estacoes_ativa_idx
  ON referencia.estacoes (ativa)
  WHERE ativa;

-- meteorologia ---------------------------------------------------------

-- Consulta dominante da base: janela temporal de uma estação
-- (WHERE estacao_id = $1 AND observado_em BETWEEN $2 AND $3).
-- Coberta pelo UNIQUE (estacao_id, observado_em), que já produz o
-- índice composto necessário — por isso nenhum índice equivalente é
-- criado aqui.

-- Recortes temporais sem filtro de estação, como "tudo que foi medido
-- em determinado período".
CREATE INDEX IF NOT EXISTS observacoes_observado_em_idx
  ON meteorologia.observacoes (observado_em);

-- Previsões vigentes de um município, ordenadas pelo instante previsto.
CREATE INDEX IF NOT EXISTS previsoes_municipio_prevista_para_idx
  ON meteorologia.previsoes (municipio_id, prevista_para);

-- Histórico de eventos de um município em ordem cronológica.
CREATE INDEX IF NOT EXISTS eventos_climaticos_municipio_inicio_idx
  ON meteorologia.eventos_climaticos (municipio_id, inicio_em);

-- Agregações por tipo de evento.
CREATE INDEX IF NOT EXISTS eventos_climaticos_tipo_evento_id_idx
  ON meteorologia.eventos_climaticos (tipo_evento_id);

-- Eventos ainda em curso. Índice parcial, pois é subconjunto pequeno.
CREATE INDEX IF NOT EXISTS eventos_climaticos_em_curso_idx
  ON meteorologia.eventos_climaticos (inicio_em)
  WHERE fim_em IS NULL;

-- A PK (estacao_id, data) atende a consulta por estação e por faixa de
-- datas de uma estação. Índice adicional apenas para varreduras por
-- data cobrindo todas as estações.
CREATE INDEX IF NOT EXISTS resumos_diarios_data_idx
  ON meteorologia.resumos_diarios (data);

-- impactos -------------------------------------------------------------

-- Recuperar os impactos de um evento é o acesso principal da tabela.
CREATE INDEX IF NOT EXISTS impactos_climaticos_evento_id_idx
  ON impactos.impactos_climaticos (evento_id);

-- Consolidar impactos por município, independentemente do evento.
CREATE INDEX IF NOT EXISTS impactos_climaticos_municipio_id_idx
  ON impactos.impactos_climaticos (municipio_id);
