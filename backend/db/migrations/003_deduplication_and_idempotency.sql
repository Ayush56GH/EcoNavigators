-- Migration 003: Deduplication and Idempotency Constraints
-- Prevents duplicate AIS positions and duplicate anomaly events without deleting historical tracks.
-- Accelerates deterministic incident idempotency lookups.

-- 1. Unique index on ais_positions: same vessel, same timestamp, same coordinate location
CREATE UNIQUE INDEX IF NOT EXISTS uq_ais_positions_mmsi_ts_loc
ON ais_positions (mmsi, ts, location);

-- 2. Unique index on ais_anomalies: same vessel, same timestamp, same anomaly type
CREATE UNIQUE INDEX IF NOT EXISTS uq_ais_anomalies_vessel_ts_type
ON ais_anomalies (vessel_id, ts, anomaly_type);

-- 3. Composite index on incidents to accelerate idempotency checks by MMSI and timestamp
CREATE INDEX IF NOT EXISTS idx_incidents_mmsi_ts
ON incidents (mmsi, timestamp DESC);
