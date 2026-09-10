-- Migration 004: Incident Deduplication and Event Key Unique Constraint
-- Ensures strict idempotency for incident creation based on (MMSI, Event Timestamp, Anomaly Type)
-- Replaces (0.0, 0.0) coordinates with NULL
-- Preserves canonical incident IDs (prioritizing INC-368091590-732E59F6 and INC-368091590-8B0923AC)

-- 1. Add event_key and anomaly_type columns if not present
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS event_key TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS anomaly_type TEXT DEFAULT 'NORMAL';

-- 2. Clean up any 0,0 Null Island coordinates to NULL
UPDATE incidents
SET latitude = NULL, longitude = NULL
WHERE (latitude = 0.0 AND longitude = 0.0)
   OR (ABS(latitude) < 1e-6 AND ABS(longitude) < 1e-6);

-- 3. Populate anomaly_type for existing records based on state/anomaly_detected
UPDATE incidents
SET anomaly_type = CASE
    WHEN state = 'AIS_ANOMALY' OR anomaly_detected = TRUE THEN 'AIS_ANOMALY'
    ELSE 'NORMAL'
END
WHERE anomaly_type IS NULL OR anomaly_type = 'NORMAL';

-- 4. Deduplicate existing rows:
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT ON (mmsi, date_trunc('second', timestamp AT TIME ZONE 'UTC'))
            FIRST_VALUE(id) OVER w_canonical AS canonical_id,
            FIRST_VALUE(latitude) OVER w_coords AS best_lat,
            FIRST_VALUE(longitude) OVER w_coords AS best_lon
        FROM incidents
        WINDOW 
            w_canonical AS (
                PARTITION BY mmsi, date_trunc('second', timestamp AT TIME ZONE 'UTC')
                ORDER BY
                    CASE
                        WHEN id = 'INC-368091590-732E59F6' THEN 0
                        WHEN id = 'INC-368091590-8B0923AC' THEN 0
                        WHEN latitude IS NOT NULL AND latitude != 0.0 AND longitude IS NOT NULL AND longitude != 0.0 THEN 1
                        ELSE 2
                    END,
                    created_at ASC
            ),
            w_coords AS (
                PARTITION BY mmsi, date_trunc('second', timestamp AT TIME ZONE 'UTC')
                ORDER BY
                    CASE WHEN latitude IS NOT NULL AND latitude != 0.0 THEN 0 ELSE 1 END,
                    created_at ASC
            )
    LOOP
        IF r.best_lat IS NOT NULL THEN
            UPDATE incidents
            SET latitude = r.best_lat, longitude = r.best_lon
            WHERE id = r.canonical_id AND (latitude IS NULL OR latitude = 0.0);
        END IF;
    END LOOP;

    -- Delete all duplicate non-canonical rows
    DELETE FROM incidents
    WHERE id NOT IN (
        SELECT DISTINCT ON (mmsi, date_trunc('second', timestamp AT TIME ZONE 'UTC')) id
        FROM incidents
        ORDER BY 
            mmsi, 
            date_trunc('second', timestamp AT TIME ZONE 'UTC'),
            CASE
                WHEN id = 'INC-368091590-732E59F6' THEN 0
                WHEN id = 'INC-368091590-8B0923AC' THEN 0
                WHEN latitude IS NOT NULL AND latitude != 0.0 AND longitude IS NOT NULL AND longitude != 0.0 THEN 1
                ELSE 2
            END,
            created_at ASC
    );
END $$;

-- 5. Backfill deterministic event_key for all canonical rows
UPDATE incidents
SET event_key = mmsi || '_' || to_char(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '_' || COALESCE(anomaly_type, 'NORMAL')
WHERE event_key IS NULL;

-- 6. Enforce NOT NULL on event_key and add UNIQUE constraint / index
ALTER TABLE incidents ALTER COLUMN event_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_event_key ON incidents (event_key);
