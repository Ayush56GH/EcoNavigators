# Interface Contract

Lock this schema before the build round starts so all four/five people can build in parallel
without blocking each other.

## 1. AIS pipeline output → `data/processed/ais_anomalies.json`

```json
[
  {
    "vessel_id": "MMSI_123456789",
    "imo": "IMO1234567",
    "timestamp": "2026-08-20T14:32:00Z",
    "lat": 28.45,
    "lon": -89.12,
    "anomaly_type": "sudden_stop",
    "anomaly_score": 0.82,
    "sog": 0.4,
    "cog_delta": 45.2
  }
]
```

## 2. SAR pipeline output → `data/processed/sar_detections.json`

```json
[
  {
    "scene_id": "S1A_IW_GRDH_...",
    "acquisition_time": "2026-08-20T14:40:00Z",
    "aoi_lat": 28.45,
    "aoi_lon": -89.12,
    "spill_probability": 0.77,
    "spill_polygon_geojson": { "...": "..." }
  }
]
```

## 3. Fusion output (final alert) → served via `GET /api/alerts`

```json
[
  {
    "vessel_id": "MMSI_123456789",
    "location": { "lat": 28.45, "lon": -89.12 },
    "timestamp": "2026-08-20T14:40:00Z",
    "anomaly_type": "sudden_stop",
    "ais_confidence": 0.82,
    "spill_confidence": 0.77,
    "combined_confidence": 0.80,
    "status": "ALERT"
  }
]
```

## 4. Vessel attribution output → served via `GET /api/source-attribution`

```json
{
  "spill_id": "SAR_S1A_SAMPLE_1",
  "candidates": [
    { "vessel_id": "MMSI_111", "probability_pct": 73 },
    { "vessel_id": "MMSI_222", "probability_pct": 27 }
  ]
}
```

## 5. Frontend integration pattern (Next.js)

Two valid options — confirm with Web Dev Expert which one is in use:

- **Direct fetch**: Next.js client component calls `http://<backend-url>/api/alerts` directly.
  Requires CORS configured on the FastAPI side (already done in `api/main.py`).
- **Proxy via Next.js API route**: Next.js server-side route calls the FastAPI backend
  server-to-server, browser only ever talks to Next.js. No CORS needed from FastAPI's side,
  but the backend's URL needs to be set as an environment variable in the Next.js app.

`dashboard` (Next.js) only ever needs `/api/alerts` and optionally `/api/source-attribution` —
it does not need to know about AIS or SAR internals.
