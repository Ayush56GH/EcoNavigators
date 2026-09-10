-- 001_harden_schema.sql
-- Safe migration for AIS + SAR performance and relational linkage

-- 1. Accelerate historical trajectory lookups for backtracking
CREATE INDEX IF NOT EXISTS idx_ais_positions_mmsi_ts
ON ais_positions (mmsi, ts DESC);

CREATE INDEX IF NOT EXISTS idx_ais_positions_ts
ON ais_positions (ts DESC);

-- 2. Enhance sar_detections with explicit confidence, time delta, and association status
ALTER TABLE sar_detections
ADD COLUMN IF NOT EXISTS segmentation_confidence FLOAT;

ALTER TABLE sar_detections
ADD COLUMN IF NOT EXISTS time_difference_minutes FLOAT;

ALTER TABLE sar_detections
ADD COLUMN IF NOT EXISTS association_status TEXT;

ALTER TABLE sar_detections
ADD COLUMN IF NOT EXISTS candidate_mmsi TEXT;
