<div align="center">

# 🌊 EcoNavigators
### Maritime Oil Spill Detection System

*AI-powered vessel anomaly detection • SAR satellite segmentation • forensic backtracking*

![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-2.14%20CPU-EE4C2C?logo=pytorch&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-FFD21E?logo=huggingface&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-14.2.7-black?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B%20%2B%20PostGIS-336791?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-88%20passed-brightgreen?logo=pytest)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## 📋 Table of Contents

- [Why EcoNavigators?](#-why-econavigators)
- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Running Tests](#-running-tests)
- [SAR Model Details](#-sar-model-details)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Known Limitations](#-known-limitations)
- [License](#-license)
- [Acknowledgements](#-acknowledgements)

---

## 🌍 Why EcoNavigators?

**Marine oil pollution is one of the most damaging and hard-to-detect environmental crimes.**

Each year, millions of litres of oil are illegally discharged into the ocean by vessels performing "bilge washing" — emptying oily ballast water at sea in the dead of night. By the time a spill is spotted by a patrol vessel or satellite, the polluter has long since sailed away.

Traditional detection relies on:
- Manual satellite image review (slow, expensive, expert-dependent)
- Random port inspections (low coverage)
- Tip-offs and aerial surveillance (reactive, not predictive)

**EcoNavigators addresses this by combining two independent intelligence streams:**

1. **Real-time AIS behavioural analysis** — flags vessels exhibiting loitering, speed anomalies, or route deviations near ecologically sensitive zones.
2. **Sentinel-1 SAR satellite segmentation** — a deep-learning model that identifies oil-like slick signatures from radar imagery within seconds.

Together they enable maritime authorities to **correlate a detected spill with a specific vessel** using forensic backtracking — turning satellite evidence into an actionable suspect list.

---

## 📌 Overview

**EcoNavigators** is a full-stack maritime intelligence platform with four integrated modules:

| Module | What it does |
|---|---|
| **AIS Anomaly Detection** | Ingests live AIS feeds, detects suspicious vessel behaviour with Isolation Forest ML |
| **SAR Oil Spill Detection** | Segments oil-like regions in Sentinel-1 SAR images using a trained MiT-B2 + U-Net model |
| **Backtracking Analysis** | Reverse-drifts a spill location through ocean currents to rank candidate vessels |
| **Incident Management** | Creates, deduplicates, and tracks oil-spill incidents with full audit trail |

---

## 🗺️ Architecture

```mermaid
flowchart TD
    A[AIS Stream\naisstream.io WebSocket] --> B[Anomaly Detector\nIsolation Forest ML]
    B --> C{Suspicious\nbehaviour?}
    C -- Yes --> D[Incident Creation\nIdempotent hash-based ID]
    C -- No --> E[Vessel Position Store\nPostgreSQL + PostGIS]

    F[SAR Image Upload\nSentinel-1 GeoTIFF/PNG] --> G[Preprocessing\n256x256 RGB float32]
    G --> H[MiT-B2 + U-Net\nPixel Segmentation]
    H --> I[Oil Region Analysis\nConnected Components]
    I --> J[Spill Registration\nlat/lon + coverage metrics]

    D --> K[Backtracking Engine\nReverse Ocean Drift Physics]
    J --> K
    E --> K
    K --> L[Candidate Vessel Ranking\nTrajectory Correlation Score]

    D --> M[Next.js 14 Dashboard]
    L --> M
    I --> M
    E --> M

    M --> N1[Live Vessel Map]
    M --> N2[SAR Analysis UI]
    M --> N3[Backtrack Map]
    M --> N4[Incident Table]
```

---

## ✨ Features

### 🛳️ AIS Vessel Tracking & Anomaly Detection
- Ingests real-time AIS position reports (MMSI, lat/lon, timestamp, speed, heading)
- Isolation Forest detects behavioural anomalies: speed changes, route deviations, loitering
- **Idempotent incident creation** — same AIS event always produces the same canonical `incidentId`
- Coordinate persistence: valid lat/lon are never overwritten with NULL; NULL records are backfilled on re-identification
- PostgreSQL + PostGIS persistence with in-memory deduplication cache

### 🛰️ SAR Oil Spill Detection (Standalone AI Module)
- Upload any **Sentinel-1 SAR GeoTIFF or PNG** image via drag-and-drop
- Pre-trained **MiT-B2 + U-Net** (val Dice: **0.84**, val IoU: **0.75**) performs pixel-level segmentation
- **7 quantitative metrics**: oil coverage %, detected pixels, region count, mean/max probability, confidence level
- **4 visualisations**: original image, probability heatmap (inferno colourmap), binary mask, overlay composite
- Configurable detection threshold (default `0.50`)

### 🔍 Backtracking & Forensic Analysis
- Reverse ocean drift physics from spill location back through time
- Correlates drifted waypoints against each vessel's **full historical AIS trajectory**
- Ranks candidate vessels by trajectory overlap score
- Displays each vessel's **correlated historical position** — the actual position at the relevant time, not just the latest ping

### 📋 Incident Management
- Full CRUD: list, inspect, update status, assign to officer, add investigation notes
- Hash-based deduplication prevents the same AIS event producing multiple incidents
- Full audit trail with timestamps and coordinate history

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Backend Language** | Python | 3.13 |
| **API Framework** | FastAPI + Uvicorn | 0.115 |
| **ML / Deep Learning** | PyTorch (CPU) | 2.14 |
| **Transformer Model** | HuggingFace Transformers | 5.x |
| **SAR Architecture** | MiT-B2 encoder + U-Net decoder | — |
| **Anomaly Detection** | scikit-learn Isolation Forest | — |
| **Image Processing** | Pillow, NumPy, SciPy | — |
| **Database** | PostgreSQL + PostGIS | 15+ |
| **DB Driver** | psycopg2-binary | — |
| **Frontend Framework** | Next.js (App Router) | 14.2.7 |
| **UI Library** | React + TypeScript | 18.3 / 5.5 |
| **Mapping** | Leaflet + react-leaflet | — |
| **Styling** | Tailwind CSS | — |
| **Testing** | pytest | 88 tests |

---

## 📁 Project Structure

```
EcoNavigators/
├── README.md
│
├── backend/
│   ├── api/
│   │   └── main.py                    # FastAPI app, all REST endpoints
│   ├── db/
│   │   ├── connection.py              # PostgreSQL connection pool
│   │   ├── models.py                  # ORM models
│   │   └── migrations/                # SQL migration scripts
│   ├── fusion/
│   │   ├── backtracking_service.py    # Drift physics + vessel ranking
│   │   └── anomaly_detector.py        # Isolation Forest pipeline
│   ├── sar_pipeline/
│   │   ├── mit_b2_unet.py             # MiT-B2 + U-Net architecture definition
│   │   └── sar_service.py             # Inference, metrics, visualisations
│   ├── models/
│   │   └── mit_b2_unet_best.pth       # Trained checkpoint (tracked via Git LFS)
│   ├── tests/
│   │   ├── test_fusion.py             # 13 backtracking tests
│   │   ├── test_identify_pipeline.py  # 36 AIS identify/incident tests
│   │   ├── test_model_loading.py      # 9 checkpoint loading tests
│   │   ├── test_preprocessing.py      # 10 image preprocessing tests
│   │   ├── test_sar_upload.py         # 9 SAR upload acceptance tests
│   │   └── test_timestamps.py         # 11 timestamp handling tests
│   ├── config.py                      # Environment-based configuration
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/(dashboard)/
│   │   │   ├── page.tsx               # Live vessel map
│   │   │   ├── incidents/             # Incident management
│   │   │   ├── backtracking/          # Forensic backtrack map
│   │   │   └── sar-detection/         # SAR upload & analysis page
│   │   ├── components/
│   │   │   ├── app-shell/Sidebar.tsx
│   │   │   ├── backtracking/BacktrackMap.tsx
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── sarService.ts          # SAR API client
│   │   │   └── adapters/backtrackAdapter.ts
│   │   └── types/
│   │       ├── sar.ts
│   │       └── backtracking.ts
│   ├── package.json
│   └── next.config.js
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Python | 3.11+ | 3.13 recommended |
| Node.js | 18+ | 20 LTS recommended |
| PostgreSQL | 15+ | Must have PostGIS extension |
| Git LFS | Any | Required for `.pth` model checkpoint |

> **GPU not required** — backend runs fully on CPU. Inference takes ~100–400 ms per SAR image.

---

### 1. Clone the Repository

```bash
# Install Git LFS first if you haven't already
git lfs install

git clone https://github.com/<your-username>/EcoNavigators.git
cd EcoNavigators
```

> ⚠️ **Important**: If you clone without Git LFS, the model checkpoint `backend/models/mit_b2_unet_best.pth` will be a pointer file and inference will fail. Always use `git lfs install` before cloning.

---

### 2. Set Up the Database

```bash
# Create the database
createdb oilspill_db

# Enable PostGIS extension
psql -d oilspill_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Run migrations
psql -U postgres -d oilspill_db -f backend/db/migrations/001_initial.sql
```

---

### 3. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Open .env and fill in your DATABASE_URL and AIS_API_KEY

# Verify model checkpoint loaded correctly
python -c "from sar_pipeline.mit_b2_unet import load_mit_b2_checkpoint; print('Checkpoint OK')"

# Start the backend server
uvicorn api.main:app --reload --port 8000
```

✅ API available at **http://localhost:8000**  
📖 Interactive docs at **http://localhost:8000/docs**

---

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

✅ Dashboard available at **http://localhost:3000**

---

## ⚙️ Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
# ── Database ─────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@localhost:5432/oilspill_db

# ── CORS ─────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:3000

# ── SAR Model ────────────────────────────────────────────────────
# Path to trained checkpoint (relative to backend/)
STANDALONE_MODEL_PATH=models/mit_b2_unet_best.pth

# Oil detection sigmoid threshold (0.0–1.0)
SAR_THRESHOLD=0.50

# Minimum oil area to trigger positive verdict (% of image)
MIN_OIL_AREA_PERCENT=0.50

# Minimum pixels for a valid connected oil region
SAR_MIN_REGION_PIXELS=10

# Maximum SAR image upload size in bytes (default = 25 MB)
SAR_MAX_UPLOAD_BYTES=26214400

# ── AIS Stream ───────────────────────────────────────────────────
AIS_STREAM_URL=wss://stream.aisstream.io/v0/stream
AIS_API_KEY=your_aisstream_api_key_here
```

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check — returns SAR model load status |
| `POST` | `/api/v1/identify` | Identify vessel from AIS event; returns canonical incident |
| `GET` | `/api/v1/incidents` | List all incidents |
| `GET` | `/api/v1/incidents/{id}` | Get full incident details |
| `PATCH` | `/api/v1/incidents/{id}` | Update status, assignee, or notes |
| `GET` | `/api/v1/vessels` | List all tracked vessels |
| `POST` | `/api/v1/spills` | Register a detected spill event |
| `GET` | `/api/v1/spills` | List all registered spills |
| `POST` | `/api/v1/spills/{id}/backtrack` | Run forensic backtracking analysis |
| `POST` | `/api/sar/analyze` | **SAR oil spill segmentation** (multipart upload) |

---

### SAR Analysis — Full Example

**Request:**
```bash
curl -X POST http://localhost:8000/api/sar/analyze \
  -F "file=@sentinel1_scene.png" \
  -F "threshold=0.50"
```

**Response:**
```json
{
  "verdict": "OIL-LIKE SPILL DETECTED",
  "oil_detected": true,
  "oil_area_percent": 12.4,
  "oil_pixel_count": 8143,
  "total_pixels": 65536,
  "region_count": 3,
  "mean_probability": 0.73,
  "max_probability": 0.98,
  "confidence": "HIGH",
  "threshold_used": 0.5,
  "visualizations": {
    "original":           "data:image/png;base64,...",
    "probability_heatmap":"data:image/png;base64,...",
    "binary_mask":        "data:image/png;base64,...",
    "overlay":            "data:image/png;base64,..."
  },
  "image_metadata": {
    "width": 256,
    "height": 256,
    "mode": "RGB",
    "file_size_bytes": 204800
  }
}
```

---

## 🧪 Running Tests

```bash
cd backend
.venv\Scripts\activate   # activate your venv

# Run full test suite
python -m pytest tests/ -v

# Run a specific module
python -m pytest tests/test_sar_upload.py -v          # SAR pipeline (9)
python -m pytest tests/test_identify_pipeline.py -v   # AIS identify (36)
python -m pytest tests/test_fusion.py -v              # Backtracking (13)
python -m pytest tests/test_model_loading.py -v       # Model loading (9)
python -m pytest tests/test_preprocessing.py -v       # Preprocessing (10)
python -m pytest tests/test_timestamps.py -v          # Timestamps (11)
```

### Results

```
tests/test_fusion.py              13 passed
tests/test_identify_pipeline.py   36 passed
tests/test_model_loading.py        9 passed
tests/test_preprocessing.py       10 passed
tests/test_sar_upload.py           9 passed
tests/test_timestamps.py          11 passed
──────────────────────────────────────────
TOTAL                             88 passed ✅
```

---

## 🤖 SAR Model Details

The SAR oil spill detection module uses a **MiT-B2 + U-Net** architecture trained on Sentinel-1 SAR imagery.

| Property | Value |
|---|---|
| **Architecture** | Mix Transformer B2 encoder + 4-stage U-Net decoder |
| **Checkpoint file** | `models/mit_b2_unet_best.pth` |
| **Checkpoint size** | ~400 MB (tracked via Git LFS) |
| **Best epoch** | 9 of 10 |
| **Validation Dice** | **0.8400** |
| **Validation IoU** | **0.7515** |
| **Validation Precision** | **0.8329** |
| **Validation Recall** | **0.8949** |
| **Input** | 256×256 RGB float32 normalised to [0, 1] |
| **Output** | 256×256 binary segmentation mask |
| **Pretrained encoder** | `nvidia/mit-b2` via HuggingFace |
| **Inference device** | CPU (auto-detected) |
| **Avg inference time** | ~100–400 ms on CPU |

### How inference works

```
SAR Image (any size)
      │
      ▼
Validation (ext, size, integrity)
      │
      ▼
Resize to 256×256 + convert to RGB float32 [0,1]
      │
      ▼
MiT-B2 Encoder → 4-stage U-Net Decoder → [1,1,256,256] logits
      │
      ▼
Sigmoid → probability map
      │
      ▼
Threshold @ 0.50 → binary mask
      │
      ▼
Connected component analysis (scipy.ndimage.label)
      │
      ▼
Metrics + 4 visualisations returned as base64 PNG
```

> ⚠️ **Disclaimer**: This model detects *oil-like SAR backscatter patterns*. A positive verdict does not constitute a legally confirmed oil spill. All results should be reviewed by a trained marine environmental analyst before operational use.

---

## 🗺️ Roadmap

| Status | Feature |
|---|---|
| ✅ | Real-time AIS anomaly detection |
| ✅ | SAR oil spill segmentation (MiT-B2 + U-Net) |
| ✅ | Forensic backtracking with trajectory correlation |
| ✅ | Idempotent incident management |
| 🔲 | Alert notifications (email / webhook) when incident created |
| 🔲 | Automated Sentinel-1 ingestion via Copernicus Data Space API |
| 🔲 | GPU inference support (CUDA / MPS) |
| 🔲 | Multi-spill correlation — link related incidents automatically |
| 🔲 | Export incident report as PDF |
| 🔲 | Role-based access control (analyst / admin / viewer) |
| 🔲 | Mobile-responsive dashboard |
| 🔲 | Historical replay mode for past AIS data |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** and ensure all tests pass: `python -m pytest tests/ -v`
4. **Add tests** for any new functionality
5. **Commit**: `git commit -m "feat: describe your change"`
6. **Push**: `git push origin feature/your-feature-name`
7. **Open a Pull Request** with a clear description

### Code Style
- Backend: follow PEP 8, add type hints to all new functions
- Frontend: TypeScript strict mode, no `any` types
- Tests: every new endpoint or service function should have a corresponding test

### Reporting Issues
Open a GitHub Issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Backend logs if relevant (`uvicorn` output)

---

## 🐛 Known Limitations

- **CPU-only inference**: No GPU acceleration — SAR inference takes ~100–400 ms per image on CPU.
- **SAR sensor specificity**: Model was trained on Sentinel-1 GRD imagery. Accuracy may vary on other SAR sensors.
- **AIS transponder gaps**: Vessels can disable AIS. Untracked vessels cannot be detected or backtracked.
- **Drift model simplification**: The backtracking reverse-drift uses a simplified surface current model; accuracy degrades beyond 72-hour windows.
- **No real-time satellite feed**: SAR images must be manually uploaded; automatic Copernicus ingestion is on the roadmap.

---

## 📜 License

Released under the **MIT License**. See [LICENSE](LICENSE) for full details.

---

## 👥 Contributors

| Name | Contribution |
|---|---|
| EcoNavigators Team | System architecture, backend API, frontend dashboard, test suite |
| Teammate | Trained MiT-B2 + U-Net SAR model checkpoint (`mit_b2_unet_best.pth`) |

---

## 🙏 Acknowledgements

- [Copernicus / ESA](https://www.copernicus.eu/) — Sentinel-1 C-band SAR satellite programme
- [NVIDIA Research](https://github.com/NVlabs/SegFormer) — Mix Transformer (MiT) encoder architecture
- [HuggingFace](https://huggingface.co/nvidia/mit-b2) — `nvidia/mit-b2` pretrained weights
- [AISstream.io](https://aisstream.io/) — Real-time global AIS vessel data WebSocket stream
- [Marine Pollution Bulletin](https://www.sciencedirect.com/journal/marine-pollution-bulletin) — Research basis for oil spill drift modelling

---

<div align="center">

*Built with ❤️ for cleaner oceans.*

**[Report a Bug](https://github.com/<your-username>/EcoNavigators/issues) · [Request a Feature](https://github.com/<your-username>/EcoNavigators/issues) · [View Docs](http://localhost:8000/docs)**

</div>
