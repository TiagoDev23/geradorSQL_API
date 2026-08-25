-- =====================================================================
-- Banco demo: Meteorologia e Impactos Climáticos
-- Banco: gerador_api_demo (PostgreSQL externo, acessado apenas por pg)
--
-- Script idempotente. Não contém DROP.
-- Executar antes de 02-indexes.sql, 03-views.sql e 04-seed.sql.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS referencia;
CREATE SCHEMA IF NOT EXISTS meteorologia;
CREATE SCHEMA IF NOT EXISTS impactos;

COMMENT ON SCHEMA referencia IS
  'Dados de referência: recortes geográficos, estações e domínios.';
COMMENT ON SCHEMA meteorologia IS
  'Séries temporais de observações, previsões e eventos climáticos.';
COMMENT ON SCHEMA impactos IS
  'Consequências socioeconômicas registradas para eventos climáticos.';

-- ---------------------------------------------------------------------
-- referencia.estados
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referencia.estados (
  id     SMALLSERIAL  PRIMARY KEY,
  sigla  CHAR(2)      NOT NULL UNIQUE,
  nome   VARCHAR(100) NOT NULL
);

COMMENT ON TABLE referencia.estados IS 'Unidades federativas.';

-- ---------------------------------------------------------------------
-- referencia.municipios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referencia.municipios (
  id          BIGSERIAL    PRIMARY KEY,
  estado_id   SMALLINT     NOT NULL,
  nome        VARCHAR(150) NOT NULL,
  codigo_ibge VARCHAR(10)  UNIQUE,
  latitude    NUMERIC(9, 6),
  longitude   NUMERIC(9, 6),

  CONSTRAINT municipios_estado_fkey
    FOREIGN KEY (estado_id) REFERENCES referencia.estados (id),

  -- Nomes de município se repetem entre estados, mas não dentro do
  -- mesmo estado. UNIQUE composto, não simples.
  CONSTRAINT municipios_estado_nome_key UNIQUE (estado_id, nome),

  CONSTRAINT municipios_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT municipios_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

COMMENT ON TABLE referencia.municipios IS
  'Municípios, vinculados a uma unidade federativa.';

-- ---------------------------------------------------------------------
-- referencia.estacoes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referencia.estacoes (
  id           BIGSERIAL     PRIMARY KEY,
  codigo       VARCHAR(30)   NOT NULL UNIQUE,
  nome         VARCHAR(150)  NOT NULL,
  municipio_id BIGINT        NOT NULL,
  latitude     NUMERIC(9, 6) NOT NULL,
  longitude    NUMERIC(9, 6) NOT NULL,
  altitude     NUMERIC(8, 2),
  ativa        BOOLEAN       NOT NULL DEFAULT true,
  instalada_em DATE,
  criado_em    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT estacoes_municipio_fkey
    FOREIGN KEY (municipio_id) REFERENCES referencia.municipios (id),

  CONSTRAINT estacoes_latitude_check
    CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT estacoes_longitude_check
    CHECK (longitude BETWEEN -180 AND 180)
);

COMMENT ON TABLE referencia.estacoes IS
  'Estações meteorológicas que produzem observações.';

-- ---------------------------------------------------------------------
-- referencia.tipos_evento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referencia.tipos_evento (
  id        SMALLSERIAL  PRIMARY KEY,
  codigo    VARCHAR(50)  NOT NULL UNIQUE,
  nome      VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT
);

COMMENT ON TABLE referencia.tipos_evento IS
  'Domínio dos tipos de evento climático.';

-- ---------------------------------------------------------------------
-- meteorologia.observacoes
--
-- Principal tabela de volume. Cresce continuamente, proporcional a
-- (número de estações) x (frequência de medição) x (tempo).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meteorologia.observacoes (
  id                  BIGSERIAL     PRIMARY KEY,
  estacao_id          BIGINT        NOT NULL,
  observado_em        TIMESTAMPTZ   NOT NULL,
  temperatura         NUMERIC(5, 2),
  temperatura_minima  NUMERIC(5, 2),
  temperatura_maxima  NUMERIC(5, 2),
  umidade             NUMERIC(5, 2),
  pressao_atmosferica NUMERIC(8, 2),
  precipitacao        NUMERIC(8, 2),
  velocidade_vento    NUMERIC(7, 2),
  direcao_vento       SMALLINT,
  radiacao_solar      NUMERIC(10, 2),
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT observacoes_estacao_fkey
    FOREIGN KEY (estacao_id) REFERENCES referencia.estacoes (id),

  -- Uma estação não produz duas medições para o mesmo instante.
  CONSTRAINT observacoes_estacao_observado_em_key
    UNIQUE (estacao_id, observado_em),

  CONSTRAINT observacoes_umidade_check
    CHECK (umidade IS NULL OR umidade BETWEEN 0 AND 100),
  CONSTRAINT observacoes_direcao_vento_check
    CHECK (direcao_vento IS NULL OR direcao_vento BETWEEN 0 AND 359),
  CONSTRAINT observacoes_precipitacao_check
    CHECK (precipitacao IS NULL OR precipitacao >= 0),
  CONSTRAINT observacoes_velocidade_vento_check
    CHECK (velocidade_vento IS NULL OR velocidade_vento >= 0),
  CONSTRAINT observacoes_radiacao_solar_check
    CHECK (radiacao_solar IS NULL OR radiacao_solar >= 0)
);

COMMENT ON TABLE meteorologia.observacoes IS
  'Medições instantâneas registradas por uma estação.';

-- ---------------------------------------------------------------------
-- meteorologia.previsoes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meteorologia.previsoes (
  id                    BIGSERIAL   PRIMARY KEY,
  municipio_id          BIGINT      NOT NULL,
  gerada_em             TIMESTAMPTZ NOT NULL,
  prevista_para         TIMESTAMPTZ NOT NULL,
  temperatura_minima    NUMERIC(5, 2),
  temperatura_maxima    NUMERIC(5, 2),
  umidade               NUMERIC(5, 2),
  precipitacao_prevista NUMERIC(8, 2),
  probabilidade_chuva   NUMERIC(5, 2),
  velocidade_vento      NUMERIC(7, 2),

  CONSTRAINT previsoes_municipio_fkey
    FOREIGN KEY (municipio_id) REFERENCES referencia.municipios (id),

  CONSTRAINT previsoes_municipio_gerada_prevista_key
    UNIQUE (municipio_id, gerada_em, prevista_para),

  CONSTRAINT previsoes_probabilidade_chuva_check
    CHECK (probabilidade_chuva IS NULL
           OR probabilidade_chuva BETWEEN 0 AND 100),
  CONSTRAINT previsoes_umidade_check
    CHECK (umidade IS NULL OR umidade BETWEEN 0 AND 100),
  CONSTRAINT previsoes_precipitacao_check
    CHECK (precipitacao_prevista IS NULL OR precipitacao_prevista >= 0),
  -- Uma previsão descreve um instante igual ou posterior à sua geração.
  CONSTRAINT previsoes_horizonte_check
    CHECK (prevista_para >= gerada_em)
);

COMMENT ON TABLE meteorologia.previsoes IS
  'Previsões emitidas para um município e um instante futuro.';

-- ---------------------------------------------------------------------
-- meteorologia.eventos_climaticos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meteorologia.eventos_climaticos (
  id                      BIGSERIAL   PRIMARY KEY,
  tipo_evento_id          SMALLINT    NOT NULL,
  municipio_id            BIGINT      NOT NULL,
  inicio_em               TIMESTAMPTZ NOT NULL,
  fim_em                  TIMESTAMPTZ,
  severidade              VARCHAR(20) NOT NULL,
  descricao               TEXT,
  temperatura_maxima      NUMERIC(5, 2),
  precipitacao_total      NUMERIC(10, 2),
  velocidade_maxima_vento NUMERIC(7, 2),
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT eventos_climaticos_tipo_fkey
    FOREIGN KEY (tipo_evento_id) REFERENCES referencia.tipos_evento (id),
  CONSTRAINT eventos_climaticos_municipio_fkey
    FOREIGN KEY (municipio_id) REFERENCES referencia.municipios (id),

  CONSTRAINT eventos_climaticos_severidade_check
    CHECK (severidade IN ('BAIXA', 'MODERADA', 'ALTA', 'EXTREMA')),
  -- fim_em nulo representa evento em curso.
  CONSTRAINT eventos_climaticos_periodo_check
    CHECK (fim_em IS NULL OR fim_em >= inicio_em),
  CONSTRAINT eventos_climaticos_precipitacao_check
    CHECK (precipitacao_total IS NULL OR precipitacao_total >= 0),
  CONSTRAINT eventos_climaticos_vento_check
    CHECK (velocidade_maxima_vento IS NULL
           OR velocidade_maxima_vento >= 0)
);

COMMENT ON TABLE meteorologia.eventos_climaticos IS
  'Ocorrências climáticas delimitadas no tempo e no espaço.';

-- ---------------------------------------------------------------------
-- meteorologia.resumos_diarios
--
-- Agregação diária por estação. A chave primária é composta: a
-- identidade da linha é o par (estação, dia), sem coluna sintética.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meteorologia.resumos_diarios (
  estacao_id              BIGINT      NOT NULL,
  data                    DATE        NOT NULL,
  temperatura_minima      NUMERIC(5, 2),
  temperatura_maxima      NUMERIC(5, 2),
  temperatura_media       NUMERIC(5, 2),
  umidade_media           NUMERIC(5, 2),
  precipitacao_total      NUMERIC(10, 2),
  velocidade_media_vento  NUMERIC(7, 2),
  velocidade_maxima_vento NUMERIC(7, 2),

  CONSTRAINT resumos_diarios_pkey PRIMARY KEY (estacao_id, data),

  CONSTRAINT resumos_diarios_estacao_fkey
    FOREIGN KEY (estacao_id) REFERENCES referencia.estacoes (id),

  CONSTRAINT resumos_diarios_umidade_check
    CHECK (umidade_media IS NULL OR umidade_media BETWEEN 0 AND 100),
  CONSTRAINT resumos_diarios_temperatura_check
    CHECK (temperatura_minima IS NULL
           OR temperatura_maxima IS NULL
           OR temperatura_maxima >= temperatura_minima)
);

COMMENT ON TABLE meteorologia.resumos_diarios IS
  'Agregação diária das observações de uma estação.';

-- ---------------------------------------------------------------------
-- impactos.impactos_climaticos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impactos.impactos_climaticos (
  id                    BIGSERIAL      PRIMARY KEY,
  evento_id             BIGINT         NOT NULL,
  municipio_id          BIGINT         NOT NULL,
  pessoas_afetadas      INTEGER,
  desalojados           INTEGER,
  desabrigados          INTEGER,
  area_agricola_afetada NUMERIC(14, 2),
  prejuizo_estimado     NUMERIC(16, 2),
  interrupcao_energia   BOOLEAN        NOT NULL DEFAULT false,
  interrupcao_agua      BOOLEAN        NOT NULL DEFAULT false,
  descricao             TEXT,
  registrado_em         TIMESTAMPTZ    NOT NULL DEFAULT now(),

  -- Chave estrangeira atravessando schemas.
  CONSTRAINT impactos_climaticos_evento_fkey
    FOREIGN KEY (evento_id)
    REFERENCES meteorologia.eventos_climaticos (id),
  CONSTRAINT impactos_climaticos_municipio_fkey
    FOREIGN KEY (municipio_id) REFERENCES referencia.municipios (id),

  CONSTRAINT impactos_climaticos_pessoas_check
    CHECK (pessoas_afetadas IS NULL OR pessoas_afetadas >= 0),
  CONSTRAINT impactos_climaticos_desalojados_check
    CHECK (desalojados IS NULL OR desalojados >= 0),
  CONSTRAINT impactos_climaticos_desabrigados_check
    CHECK (desabrigados IS NULL OR desabrigados >= 0),
  CONSTRAINT impactos_climaticos_area_check
    CHECK (area_agricola_afetada IS NULL OR area_agricola_afetada >= 0),
  CONSTRAINT impactos_climaticos_prejuizo_check
    CHECK (prejuizo_estimado IS NULL OR prejuizo_estimado >= 0)
);

COMMENT ON TABLE impactos.impactos_climaticos IS
  'Consequências registradas para um evento climático em um município.';
