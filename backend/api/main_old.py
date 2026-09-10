"""
FastAPI Backend
Owner: Harsh (Backend / Integration Lead)

Serves fused alerts and vessel source-attribution results to the Next.js dashboard.
Run with: uvicorn api.main:app --reload --port 8000
Interactive docs at: http://localhost:8000/docs
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from fusion.fusion_engine import fuse, load_json, fuse_db
from fusion.source_attribution import score_candidates
from db.auth import create_user, verify_user
from db.connection import get_connection

app = FastAPI(title="Oil Spill Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Alert(BaseModel):
    vessel_id: str
    location: dict
    timestamp: str
    anomaly_type: str
    ais_confidence: float
    spill_confidence: Optional[float] = None
    combined_confidence: float
    status: str


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/signup")
def signup(payload: SignupRequest):
    try:
        create_user(payload.username, payload.email, payload.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Signup failed — username or email may already be taken")
    return {"message": "Signup successful"}


@app.post("/api/login")
def login(payload: LoginRequest):
    user_id = verify_user(payload.email, payload.password)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"message": "Login successful", "user_id": user_id}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/alerts", response_model=list[Alert])
def get_alerts():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT vessel_id, ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
               ts, anomaly_type, anomaly_score
        FROM ais_anomalies
    """)
    rows = cur.fetchall()

    ais_list = [
        {"vessel_id": r[0], "lon": r[1], "lat": r[2], "timestamp": str(r[3]), "anomaly_type": r[4], "anomaly_score": r[5]}
        for r in rows
    ]

    alerts = fuse_db(ais_list, cur)
    conn.close()
    return alerts


@app.get("/api/vessel/{vessel_id}")
def get_vessel(vessel_id: str):
    alerts = get_alerts()
    match = [a for a in alerts if a["vessel_id"] == vessel_id] if isinstance(alerts, list) else []
    if not match:
        raise HTTPException(status_code=404, detail=f"No alert found for {vessel_id}")
    return match[0]


@app.get("/api/source-attribution")
def get_source_attribution(spill_lat: float, spill_lon: float):
    """
    Given a spill location, score nearby candidate vessels (from the latest AIS anomalies)
    by likelihood of being the source.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT vessel_id, ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat, anomaly_score
        FROM ais_anomalies
    """)
    rows = cur.fetchall()
    conn.close()

    spill = {"lat": spill_lat, "lon": spill_lon}
    candidates = [
        {"vessel_id": r[0], "lat": r[2], "lon": r[1], "anomaly_score": r[3]}
        for r in rows
    ]

    return {"spill_location": spill, "candidates": score_candidates(spill, candidates)}

@app.get("/api/dashboard-summary")
def get_dashboard_summary():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(DISTINCT mmsi) FROM ais_positions")
    active_vessels = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT mmsi FROM ais_positions GROUP BY mmsi HAVING COUNT(*) > 1
        ) AS routed_vessels
    """)
    tracked_routes = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM sar_detections")
    detected_spills = cur.fetchone()[0]

    conn.close()

    return {
        "active_vessels": active_vessels,
        "tracked_routes": tracked_routes,
        "detected_spills": detected_spills,
    }
NAV_STATUS = {
    0: "Underway",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuvrability",
    4: "Constrained by draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Underway sailing",
}


@app.get("/api/vessel/{mmsi}/details")
def get_vessel_details(mmsi: str):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT ship_name, ship_type, sog, heading, draught, status
        FROM ais_positions
        WHERE mmsi = %s
        ORDER BY ts DESC
        LIMIT 1
    """, (mmsi,))
    row = cur.fetchone()
    conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail=f"No vessel found with mmsi {mmsi}")

    return {
        "mmsi": mmsi,
        "ship_name": row[0],
        "ship_type": row[1],
        "speed": row[2],
        "heading": row[3],
        "draft": row[4],
        "status": NAV_STATUS.get(row[5], "Unknown"),
    }


@app.get("/api/vessel/{mmsi}/track")
def get_vessel_track(mmsi: str):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat, ts
        FROM ais_positions
        WHERE mmsi = %s
        ORDER BY ts ASC
    """, (mmsi,))
    rows = cur.fetchall()
    conn.close()

    track = [
        {"lat": r[1], "lon": r[0], "timestamp": str(r[2])}
        for r in rows
    ]

    return {"mmsi": mmsi, "track": track}