-- Serie I · Pregunta 4 — Modelo de datos mínimo de campo para PostgreSQL.
-- Objetivo: que el ingenio pueda auditar renovaciones, zonificar lotes y analizar variedades con sus propios datos.
-- Cada regla CHECK responde a un problema encontrado en el dataset de Louisiana (ver notebooks/01_campo_eda.ipynb):
--   números guardados como texto con coma decimal, unidades mezcladas entre años, duplicados, valores imposibles,
--   nombres de finca escritos de dos formas. Unidades métricas en todo el esquema.

CREATE TABLE finca (
    finca_id              TEXT PRIMARY KEY,                  -- código único; nunca el nombre escrito a mano
    nombre                TEXT NOT NULL,
    departamento          TEXT,
    altitud_msnm          NUMERIC(6,1) CHECK (altitud_msnm BETWEEN 0 AND 1500),
    estrato_altitudinal   TEXT CHECK (estrato_altitudinal IN ('litoral', 'bajo', 'medio', 'alto')),  -- CENGICAÑA: <40, 40-100, 100-300, >300 msnm
    distancia_ingenio_km  NUMERIC(6,1) CHECK (distancia_ingenio_km >= 0),
    latitud               NUMERIC(8,5),
    longitud              NUMERIC(8,5),
    propia                BOOLEAN                              -- finca propia o de proveedor
);

CREATE TABLE lote (
    lote_id               TEXT PRIMARY KEY,
    finca_id              TEXT NOT NULL REFERENCES finca,
    area_ha               NUMERIC(8,2) NOT NULL CHECK (area_ha > 0),
    grupo_suelo           TEXT,                                -- grupo de manejo de suelos (CENGICAÑA: 13 grupos)
    textura               TEXT,
    drenaje               TEXT CHECK (drenaje IN ('bueno', 'moderado', 'encharcable', 'excesivo')),
    riego                 TEXT CHECK (riego IN ('ninguno', 'gravedad', 'aspersion', 'goteo', 'pivote')),
    zona_manejo           TEXT,                                -- resultado de la zonificación (se recalcula)
    geometria_geojson     TEXT                                 -- polígono del lote
);

CREATE TABLE siembra (                                         -- cada renovación abre un ciclo nuevo
    siembra_id            BIGSERIAL PRIMARY KEY,
    lote_id               TEXT NOT NULL REFERENCES lote,
    fecha_siembra         DATE NOT NULL,
    variedad              TEXT NOT NULL,
    motivo                TEXT CHECK (motivo IN ('renovacion', 'area_nueva', 'resiembra_parcial')),
    UNIQUE (lote_id, fecha_siembra)
);

CREATE TABLE cosecha (                                         -- una fila por lote y corte
    cosecha_id            BIGSERIAL PRIMARY KEY,
    lote_id               TEXT NOT NULL REFERENCES lote,
    siembra_id            BIGINT NOT NULL REFERENCES siembra,  -- sin esto no se reconstruyen los ciclos
    zafra                 SMALLINT NOT NULL,                   -- año de inicio (2025 = zafra 2025/26)
    fecha_corte           DATE NOT NULL,
    corte                 SMALLINT NOT NULL CHECK (corte BETWEEN 0 AND 30),   -- 0 = plantía; hay lotes con muchas socas
    area_cosechada_ha     NUMERIC(8,2) NOT NULL CHECK (area_cosechada_ha > 0),
    toneladas_cana        NUMERIC(10,2) NOT NULL CHECK (toneladas_cana >= 0),
    tch                   NUMERIC(6,1) GENERATED ALWAYS AS (toneladas_cana / area_cosechada_ha) STORED,
    rendimiento_kg_t      NUMERIC(6,2) CHECK (rendimiento_kg_t BETWEEN 50 AND 200),  -- kg azúcar / t caña
    fibra_pct             NUMERIC(4,1) CHECK (fibra_pct BETWEEN 6 AND 22),
    edad_meses            NUMERIC(4,1) CHECK (edad_meses BETWEEN 6 AND 24),
    tercio_zafra          TEXT CHECK (tercio_zafra IN ('primero', 'segundo', 'tercero')),
    tipo_cosecha          TEXT CHECK (tipo_cosecha IN ('manual_quemada', 'manual_verde', 'mecanizada_quemada', 'mecanizada_verde')),
    madurante             BOOLEAN,
    UNIQUE (lote_id, zafra, corte)                             -- impide la doble captura
);

CREATE TABLE estacion (
    estacion_id           TEXT PRIMARY KEY,
    latitud               NUMERIC(8,5),
    longitud              NUMERIC(8,5),
    altitud_msnm          NUMERIC(6,1)
);

CREATE TABLE lote_estacion (                                   -- estación de referencia de cada lote (la más cercana o interpolada)
    lote_id               TEXT REFERENCES lote,
    estacion_id           TEXT REFERENCES estacion,
    peso                  NUMERIC(4,3) DEFAULT 1 CHECK (peso > 0 AND peso <= 1),
    PRIMARY KEY (lote_id, estacion_id)
);

CREATE TABLE clima_diario (
    estacion_id           TEXT REFERENCES estacion,
    fecha                 DATE,
    lluvia_mm             NUMERIC(6,1) CHECK (lluvia_mm >= 0),
    tmax_c                NUMERIC(4,1),
    tmin_c                NUMERIC(4,1),
    radiacion_mj_m2       NUMERIC(5,2),
    viento_km_h           NUMERIC(5,1),
    humedad_pct           NUMERIC(4,1) CHECK (humedad_pct BETWEEN 0 AND 100),
    PRIMARY KEY (estacion_id, fecha),
    CHECK (tmax_c >= tmin_c)
);

CREATE TABLE manejo (                                          -- fertilización, riego, madurante, control de plagas
    manejo_id             BIGSERIAL PRIMARY KEY,
    lote_id               TEXT NOT NULL REFERENCES lote,
    zafra                 SMALLINT NOT NULL,
    fecha                 DATE NOT NULL,
    tipo                  TEXT NOT NULL,
    producto              TEXT,
    dosis                 NUMERIC(10,3),
    unidad                TEXT
);

CREATE TABLE costo_lote (                                      -- para la economía de renovación por lote
    lote_id               TEXT REFERENCES lote,
    zafra                 SMALLINT,
    concepto              TEXT CHECK (concepto IN ('corte', 'alce', 'transporte', 'mantenimiento', 'renovacion', 'riego')),
    monto_usd             NUMERIC(12,2) CHECK (monto_usd >= 0),
    PRIMARY KEY (lote_id, zafra, concepto)
);

CREATE TABLE ensayo (                                          -- ensayos propios de variedades
    ensayo_id             TEXT PRIMARY KEY,
    finca_id              TEXT NOT NULL REFERENCES finca,
    lote_id               TEXT REFERENCES lote,
    cohorte               SMALLINT NOT NULL,                   -- año de siembra
    diseno                TEXT CHECK (diseno IN ('bloques_completos', 'alfa_latice', 'franjas_comerciales')),
    repeticiones          SMALLINT CHECK (repeticiones BETWEEN 1 AND 6)
);

CREATE TABLE parcela_ensayo (
    ensayo_id             TEXT REFERENCES ensayo,
    variedad              TEXT NOT NULL,
    es_testigo            BOOLEAN NOT NULL DEFAULT FALSE,
    repeticion            SMALLINT NOT NULL,
    corte                 SMALLINT NOT NULL CHECK (corte BETWEEN 0 AND 8),
    fecha_corte           DATE NOT NULL,
    area_parcela_m2       NUMERIC(8,1) CHECK (area_parcela_m2 > 0),
    tch                   NUMERIC(6,1) CHECK (tch BETWEEN 0 AND 400),
    rendimiento_kg_t      NUMERIC(6,2) CHECK (rendimiento_kg_t BETWEEN 50 AND 200),
    fibra_pct             NUMERIC(4,1) CHECK (fibra_pct BETWEEN 6 AND 22),
    tallos_por_m          NUMERIC(5,1),
    peso_tallo_kg         NUMERIC(5,2),
    floracion_pct         NUMERIC(4,1),
    roya_naranja_escala   SMALLINT CHECK (roya_naranja_escala BETWEEN 0 AND 9),
    PRIMARY KEY (ensayo_id, variedad, repeticion, corte)
);

-- Vista de ciclos: lo que usa campo_renovacion.reconstruir_ciclos
CREATE VIEW v_cosecha_ciclo AS
SELECT c.zafra, l.finca_id AS finca, c.lote_id AS lote, s.variedad, c.corte, c.tch, c.rendimiento_kg_t AS rendimiento,
       c.siembra_id AS ciclo, f.distancia_ingenio_km, f.estrato_altitudinal, l.grupo_suelo, l.drenaje
FROM cosecha c
JOIN siembra s USING (siembra_id)
JOIN lote l ON l.lote_id = c.lote_id
JOIN finca f ON f.finca_id = l.finca_id;
