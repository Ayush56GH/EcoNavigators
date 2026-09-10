-- ============================================================
-- Oil Spill Detection System — Database Schema
-- Version: 2.0.0
-- Apply with: psql $DATABASE_URL < db/schema.sql
-- Requires: PostGIS extension
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── AIS Positions (raw vessel track points) ───────────────────
CREATE TABLE IF NOT EXISTS ais_positions (
    id          SERIAL PRIMARY KEY,
    mmsi        TEXT NOT NULL,
    imo         TEXT,
    ship_name   TEXT,
    ship_type   TEXT,
    location    GEOGRAPHY(Point, 4326) NOT NULL,
    sog         FLOAT,
    cog         FLOAT,
    heading     FLOAT,
    status      INTEGER,
    ts          TIMESTAMPTZ,
    destination TEXT,
    draught     FLOAT,
    source      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ais_positions_location ON ais_positions USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_ais_positions_mmsi     ON ais_positions (mmsi);
CREATE INDEX IF NOT EXISTS idx_ais_positions_ts       ON ais_positions (ts DESC);

-- ── AIS Anomalies (detected behavioral events) ───────────────
CREATE TABLE IF NOT EXISTS ais_anomalies (
    id            SERIAL PRIMARY KEY,
    vessel_id     TEXT NOT NULL,
    imo           TEXT,
    ts            TIMESTAMPTZ NOT NULL,
    location      GEOGRAPHY(Point, 4326) NOT NULL,
    anomaly_type  TEXT,
    anomaly_score FLOAT,
    sog           FLOAT,
    cog_delta     FLOAT,
    reasons       JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ais_anomalies_location    ON ais_anomalies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_ais_anomalies_vessel_id   ON ais_anomalies (vessel_id);
CREATE INDEX IF NOT EXISTS idx_ais_anomalies_ts          ON ais_anomalies (ts DESC);

-- ── SAR Detections ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sar_detections (
    id                       SERIAL PRIMARY KEY,
    scene_id                 TEXT NOT NULL,
    acquisition_time         TIMESTAMPTZ NOT NULL,
    aoi_location             GEOGRAPHY(Point, 4326) NOT NULL,
    -- Slick centroid — separate from vessel position
    slick_centroid           GEOGRAPHY(Point, 4326),
    slick_polygon            GEOGRAPHY(Polygon, 4326),
    spill_probability        FLOAT,
    segmentation_confidence  FLOAT,
    time_difference_minutes  FLOAT,
    association_status       TEXT,
    candidate_mmsi           TEXT,
    pipeline_state           TEXT,
    data_quality             TEXT DEFAULT 'DISPLAY_APPROX',
    analysis_json            JSONB,
    created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sar_detections_location  ON sar_detections USING GIST (aoi_location);
CREATE INDEX IF NOT EXISTS idx_sar_detections_mmsi      ON sar_detections (candidate_mmsi);
CREATE INDEX IF NOT EXISTS idx_sar_detections_time      ON sar_detections (acquisition_time DESC);

-- ── Alert Acknowledgements (persistent — survives server restart) ──
CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    id               SERIAL PRIMARY KEY,
    alert_id         TEXT NOT NULL UNIQUE,
    acknowledged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_ack_alert_id ON alert_acknowledgements (alert_id);

-- ── Spill Reports (manual user-submitted) ────────────────────
CREATE TABLE IF NOT EXISTS spill_reports (
    id                    SERIAL PRIMARY KEY,
    reporter_name         TEXT NOT NULL,
    contact_email         TEXT,
    location              GEOGRAPHY(Point, 4326),
    estimated_size_sq_km  FLOAT,
    spill_appearance      TEXT,
    notes                 TEXT,
    status                TEXT DEFAULT 'PENDING',
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'analyst',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Oil Spill Incidents (full pipeline results) ───────────────
CREATE TABLE IF NOT EXISTS oil_spill_incidents (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    vessel_mmsi     TEXT,
    pipeline_state  TEXT,
    final_verdict   TEXT,
    confidence      FLOAT,
    vessel_location GEOGRAPHY(Point, 4326),
    slick_centroid  GEOGRAPHY(Point, 4326),
    analysis_json   JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_mmsi   ON oil_spill_incidents (vessel_mmsi);
CREATE INDEX IF NOT EXISTS idx_incidents_state  ON oil_spill_incidents (pipeline_state);
CREATE INDEX IF NOT EXISTS idx_incidents_time   ON oil_spill_incidents (created_at DESC);
