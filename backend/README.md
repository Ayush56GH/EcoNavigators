# Automated Oil Spill Detection System

AIS anomaly detection + Satellite (SAR) confirmation, fused into a single alert pipeline,
served via a FastAPI backend to a Next.js dashboard.

## Team

| Role | Owns |
|---|---|
| ML Expert | AIS anomaly model (Isolation Forest), SAR spill classifier (Random Forest / CNN) |
| Cloud Expert | AIS + Sentinel-1 data ingestion, deployment infra, database |
| Web Dev Expert | Next.js dashboard, map + alert UI |
| Idea/Pitching | Narrative, slides, demo framing |
| **Harsh (Backend / Integration Lead)** | Fusion engine, vessel attribution, FastAPI endpoints, interface contracts, end-to-end testing, deployment |

## Setup

```bash
python3 -m venv venv
source venv/bin/activate       # on Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Run the API:
```bash
uvicorn api.main:app --reload --port 8000
```
Interactive docs: `http://localhost:8000/docs`

## Folder structure

```
oil-spill-detection/
├── ais_pipeline/        # AIS ingestion + anomaly detection (ML Expert)
├── sar_pipeline/         # SAR download + preprocessing + spill classification (ML Expert)
├── fusion/                # Fusion engine + vessel attribution (Harsh)
├── api/                   # FastAPI app, CORS, endpoints (Harsh)
├── data/
│   ├── raw/               # Untouched AIS CSVs, Sentinel-1 scenes
│   └── processed/         # Cleaned/feature-engineered outputs
├── notebooks/            # Exploration, model training (Colab/Jupyter)
├── models/                # Saved trained models (.pkl, .pt)
├── docs/                  # Interface contracts, case study notes, pitch material
└── requirements.txt
```

## Run order (module dependency)

1. **Cloud Expert**: pull AIS data into `data/raw/`, pull matching Sentinel-1 scene(s) into `data/raw/`.
2. **ML Expert**: run `ais_pipeline/` to produce anomaly flags → run `sar_pipeline/` to produce spill classification.
3. **Harsh**: run `fusion/fusion_engine.py` to combine both outputs, then serve them via `api/main.py`.
4. **Web Dev Expert**: Next.js app fetches from `http://localhost:8000/api/alerts` (see `docs/interface_contract.md` for the two integration patterns — direct fetch vs. Next.js API route proxy).

## Database

PostgreSQL + PostGIS. PostGIS handles geospatial queries (`ST_DWithin`, `ST_Distance`) natively —
used for matching ship positions to spill centroids within a radius, instead of hand-rolling
haversine distance in application code.

## Demo case study

Document the chosen backtested spill event (AIS anomaly + matching SAR coverage) in
`docs/case_study.md` before the build round starts.
