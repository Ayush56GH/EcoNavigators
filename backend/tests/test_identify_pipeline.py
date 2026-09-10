import sys, os, math
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from api.main import app
from config import ais_cfg, PipelineState
from fusion.fusion_engine import fuse

client = TestClient(app)

def test_identify_creates_real_incident():
    resp = client.post("/api/v1/identify", json={"mmsi": "368091590"})
    assert resp.status_code == 200
    data = resp.json()
    assert "incidentId" in data
    assert data["incidentId"].startswith("INC-368091590-")
    assert data["mmsi"] == "368091590"
    assert "state" in data
    assert data["sar"]["status"] == "DEFERRED"
    assert "backtracking" in data
    assert data["backtracking"]["status"] == "READY"

def test_identify_does_not_fabricate_imo():
    resp = client.post("/api/v1/identify", json={"mmsi": "999999999"})
    assert resp.status_code == 200
    data = resp.json()
    vessel = data.get("vessel", {})
    # IMO must be None or real IMO, NEVER fabricated 'IMO-999999999' or '9999999'
    imo = vessel.get("imo")
    if imo is not None:
        assert not str(imo).startswith("IMO-")
        assert not str(imo).startswith("9999999")

def test_coordinate_zero_is_rejected_as_unobserved():
    resp = client.post("/api/v1/identify", json={
        "mmsi": "000000001",
        "lat": 0.0,
        "lon": 0.0
    })
    assert resp.status_code == 200
    data = resp.json()
    loc = data.get("location", {})
    # Per requirement 4 & D: 0,0 is not a valid vessel location and must remain invalid/null
    assert loc.get("lat") is None
    assert loc.get("lon") is None

def test_ais_threshold_comes_from_config():
    from ais_pipeline.behavior_anomaly_detector import AISBehaviorAnomalyDetector
    detector = AISBehaviorAnomalyDetector()
    assert detector.speed_drop_threshold == ais_cfg.SPEED_DROP_THRESHOLD_KNOTS
    assert detector.cog_turn_threshold == ais_cfg.COG_TURN_THRESHOLD_DEG
    assert detector.gap_threshold == ais_cfg.GAP_THRESHOLD_MINUTES
    assert detector.anomaly_threshold == ais_cfg.ANOMALY_SCORE_THRESHOLD

def test_missing_sar_results_in_sar_deferred_state():
    resp = client.post("/api/v1/identify", json={"mmsi": "368091590"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["sar"]["status"] == "DEFERRED"
    assert "deferred" in data["sar"]["reason"].lower()

def test_temporal_mismatch_prevents_fusion_confirmation():
    ais = [{
        "vessel_id": "MMSI_123456789",
        "lat": 15.0,
        "lon": 85.0,
        "timestamp": "2026-08-20T12:00:00Z",
        "anomaly_type": "SPEED_CHANGE",
        "anomaly_score": 0.8,
    }]
    # SAR detection is 5 hours later (> 120 min window)
    sar = [{
        "aoi_lat": 15.01,
        "aoi_lon": 85.01,
        "acquisition_time": "2026-08-20T17:00:00Z",
        "spill_probability": 0.9,
    }]
    fused = fuse(ais, sar)
    assert len(fused) == 1
    # Because temporal mismatch (> 120min), status must be WATCH_NO_SAT_COVERAGE, NOT ALERT
    assert fused[0]["status"] == "WATCH_NO_SAT_COVERAGE"

def test_missing_spill_data_does_not_fallback_to_florida_coordinates():
    resp = client.get("/api/v1/backtracking/analysis?spill_id=NONEXISTENT_SPILL_9999")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "INCONCLUSIVE"
    # Never return hardcoded [25.7715, -80.1518]
    assert data.get("estimatedOriginPoint") is None


# ---------- 9 Comprehensive Regression & Persistence Tests ----------

def test_incidents_table_exists_in_migration():
    migration_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "migrations", "002_incidents_table.sql")
    assert os.path.exists(migration_path), "Migration 002_incidents_table.sql must exist"
    with open(migration_path, "r", encoding="utf-8-sig") as f:
        content = f.read()
    assert "CREATE TABLE IF NOT EXISTS incidents" in content
    for field in ["id", "mmsi", "timestamp", "latitude", "longitude", "state", "anomaly_detected", "anomaly_score", "sar_status", "created_at"]:
        assert field in content, f"Field {field} must be defined in incidents migration"


def test_identify_returns_real_timestamp():
    test_ts = "2026-07-15T10:30:00Z"
    resp = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": test_ts,
        "lat": 18.5,
        "lon": 72.8
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["timestamp"] == test_ts, "Identify must return the exact provided AIS event timestamp, not NOW()"


def test_get_incident_from_db_after_restart():
    from api.main import _incidents_store
    # Create an incident
    resp = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "lat": 18.5,
        "lon": 72.8,
        "timestamp": "2026-07-15T10:30:00Z"
    })
    assert resp.status_code == 200
    inc_id = resp.json()["incidentId"]

    # Clear in-memory cache to simulate full backend restart
    _incidents_store.clear()
    assert inc_id not in _incidents_store

    # GET /incidents/{id} must read directly from persistent DB table
    get_resp = client.get(f"/api/v1/incidents/{inc_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["incidentId"] == inc_id
    assert data["mmsi"] == "368091590"
    assert data["location"]["lat"] == 18.5
    assert data["location"]["lon"] == 72.8


def test_backtracking_accepts_incident_id():
    # Pass incidentId as query param
    resp = client.get("/api/v1/backtracking/analysis?incidentId=INC-NONEXISTENT-999")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("incidentId") == "INC-NONEXISTENT-999"
    assert data.get("status") == "INCONCLUSIVE"


def test_backtracking_loads_incident_coords():
    # Create an incident with known coordinates
    resp = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "lat": 28.5,
        "lon": -89.5,
        "timestamp": "2026-07-15T10:30:00Z"
    })
    assert resp.status_code == 200
    inc_id = resp.json()["incidentId"]

    # Run backtracking using incidentId
    bt_resp = client.get(f"/api/v1/backtracking/analysis?incidentId={inc_id}")
    assert bt_resp.status_code == 200
    bt_data = bt_resp.json()
    assert bt_data.get("incidentId") == inc_id
    # Backtracking must use incident coordinates
    drift = bt_data.get("driftTrajectory")
    assert drift is not None and len(drift) > 0
    # First point of backward trajectory starts at the incident observation position
    assert round(drift[0]["lat"], 1) == 28.5
    assert round(drift[0]["lon"], 1) == -89.5
    origin = bt_data.get("estimatedOriginPoint")
    assert origin is not None
    assert abs(origin[0] - 28.5) < 0.5
    assert abs(origin[1] - (-89.5)) < 0.5


def test_attribution_score_field():
    from fusion.backtracking_service import simulate_lagrangian_backtrack
    sim = simulate_lagrangian_backtrack(spill_lat=28.5, spill_lon=-89.5)
    candidates = sim.get("candidate_rankings", [])
    for c in candidates:
        assert "attribution_score" in c, "Candidate rankings must contain attribution_score field"
        assert isinstance(c["attribution_score"], (int, float))


def test_sar_cache_deferred():
    resp = client.get("/api/v1/backtracking/analysis")
    assert resp.status_code == 200
    data = resp.json()
    sar_char = data.get("spillCharacterization", {})
    assert sar_char.get("status") == "DEFERRED", "SAR characterization must be marked DEFERRED"
    assert sar_char.get("data_available") is False, "No fabricated SAR data should be present"


def test_get_incidents_list_from_db():
    from api.main import _incidents_store
    # Ensure at least one incident is created and persisted
    resp = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "lat": 18.5,
        "lon": 72.8
    })
    assert resp.status_code == 200
    inc_id = resp.json()["incidentId"]

    # Clear in-memory cache
    _incidents_store.clear()

    # GET /incidents must read from persistent DB
    list_resp = client.get("/api/v1/incidents")
    assert list_resp.status_code == 200
    incidents = list_resp.json()
    assert isinstance(incidents, list)
    incident_ids = [inc.get("incidentId") for inc in incidents]
    assert inc_id in incident_ids, "Persistent incident must be returned from DB even after memory clear"


def test_no_hardcoded_coords_in_identify():
    # Identify an unknown vessel without coordinates
    resp = client.post("/api/v1/identify", json={"mmsi": "000000001"})
    assert resp.status_code == 200
    data = resp.json()
    loc = data.get("location", {})
    # Coordinates must NEVER be Miami default (25.7715, -80.1518) or any other fabricated fallback
    lat = loc.get("lat")
    lon = loc.get("lon")
    if lat is not None:
        assert lat != 25.7715 and lat != 25.7704
    if lon is not None:
        assert lon != -80.1518 and lon != -80.1514


# ---------- Idempotency, Deduplication & Coordinate Tests ----------

def test_identify_idempotency_same_event():
    """
    Calling /identify repeatedly for the exact same event returns the existing canonical incidentId
    and does NOT create duplicate records in the incidents table.
    """
    from db.connection import get_connection
    payload = {
        "mmsi": "368091590",
        "timestamp": "2026-09-01T12:00:00Z",
        "lat": 18.52,
        "lon": 72.85
    }

    # First call creates incident
    resp1 = client.post("/api/v1/identify", json=payload)
    assert resp1.status_code == 200
    inc_id1 = resp1.json()["incidentId"]

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM incidents WHERE id = %s", (inc_id1,))
    count1 = cur.fetchone()[0]
    assert count1 == 1

    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = %s", ("368091590",))
    mmsi_count_before = cur.fetchone()[0]

    # Second call with same event details must return the EXACT same incidentId
    resp2 = client.post("/api/v1/identify", json=payload)
    assert resp2.status_code == 200
    inc_id2 = resp2.json()["incidentId"]
    assert inc_id2 == inc_id1, f"Repeated identify must return the same canonical incidentId, got {inc_id2} vs {inc_id1}"

    # Third call with slightly different time (< 10 min window) and near-identical coords (< 0.01 deg)
    payload_near = {
        "mmsi": "368091590",
        "timestamp": "2026-09-01T12:02:00Z",
        "lat": 18.5205,
        "lon": 72.8505
    }
    resp3 = client.post("/api/v1/identify", json=payload_near)
    assert resp3.status_code == 200
    assert resp3.json()["incidentId"] == inc_id1

    # Incidents table should not have grown
    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = %s", ("368091590",))
    mmsi_count_after = cur.fetchone()[0]
    assert mmsi_count_after == mmsi_count_before, "Repeated identify calls must not create duplicate records"
    conn.close()


def test_identify_different_event_creates_new_incident():
    """
    Events with significantly different timestamps or locations create separate incidents.
    """
    resp_event_a = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": "2026-01-01T00:00:00Z",
        "lat": 20.0,
        "lon": 70.0
    })
    resp_event_b = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": "2026-06-01T00:00:00Z",
        "lat": 25.0,
        "lon": 75.0
    })
    assert resp_event_a.status_code == 200
    assert resp_event_b.status_code == 200
    id_a = resp_event_a.json()["incidentId"]
    id_b = resp_event_b.json()["incidentId"]
    assert id_a != id_b, "Distinct events must produce distinct incident IDs"


def test_backtracking_rankings_at_most_one_per_mmsi():
    """
    Regardless of how many AIS position/anomaly rows exist, final backtracking
    rankings must contain at most ONE candidate per MMSI.
    """
    from fusion.backtracking_service import simulate_lagrangian_backtrack
    sim = simulate_lagrangian_backtrack(spill_lat=28.5, spill_lon=-89.5, simulation_hours=12)
    rankings = sim.get("candidate_rankings", [])
    mmsi_list = [c["mmsi"] for c in rankings]
    assert len(mmsi_list) == len(set(mmsi_list)), f"Duplicate MMSI found in candidate rankings: {mmsi_list}"


def test_zero_zero_coordinates_excluded_from_spatial_calculations():
    """
    haversine_km must reject 0.0, 0.0 and return infinity so 0,0 is not matched to spills or corridors.
    """
    from fusion.backtracking_service import haversine_km, is_valid_geo_coord
    assert is_valid_geo_coord(0.0, 0.0) is False
    assert is_valid_geo_coord(None, 10.0) is False
    assert is_valid_geo_coord(95.0, 50.0) is False  # lat > 90
    assert is_valid_geo_coord(25.0, 190.0) is False # lon > 180
    assert is_valid_geo_coord(28.5, -89.5) is True

    dist = haversine_km(0.0, 0.0, 28.5, -89.5)
    assert math.isinf(dist), "Distance with 0,0 coordinate must be infinite to exclude from spatial matching"


def test_historical_positions_preserved():
    """
    Different timestamps for the same vessel are legitimate historical positions
    and must not be treated as duplicates.
    """
    from db.connection import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(DISTINCT ts)
        FROM ais_positions
        WHERE mmsi = '368091590'
    """)
    distinct_ts_count = cur.fetchone()[0]
    conn.close()
    assert distinct_ts_count > 1, "Historical timestamps for vessel must remain intact"


def test_attribution_scoring_distinct_and_normalized():
    """
    Candidate attribution scoring must not assign a flat constant score (e.g. 10).
    The top candidate must be near 100, weaker candidates progressively lower,
    and distinct candidates with different distances/evidence must have distinct scores.
    """
    from fastapi.testclient import TestClient
    from api.main import app
    client = TestClient(app)
    # Query backtracking analysis using an incident with multiple candidates
    res = client.get("/api/v1/backtracking/analysis?incidentId=INC-368091590-732E59F6")
    assert res.status_code == 200
    data = res.json()
    rankings = data.get("rankings", [])
    if rankings:
        # Top candidate must be near 100
        assert rankings[0]["attributionScore"] >= 90.0
        assert rankings[0]["associationScore"] == rankings[0]["attributionScore"]
        # Scores must not all be identical
        scores = [r["attributionScore"] for r in rankings]
        assert len(set(scores)) > 1, f"All candidates received identical scores: {scores}"
        assert all(isinstance(r["attributionScore"], (int, float)) for r in rankings)
        assert all(isinstance(r["associationScore"], (int, float)) for r in rankings)


# =====================================================================
# DEDICATED VERIFICATION SUITE: TESTS A THROUGH H
# =====================================================================

def test_A_repeated_identify_2026_09_05():
    """
    TEST A: Repeated Identify requests for MMSI 368091590 with timestamp 2026-09-05T10:39:33.846573+00:00:
    - Return the canonical ID INC-368091590-732E59F6
    - Database row count does not increase
    """
    from db.connection import get_connection
    payload = {
        "mmsi": "368091590",
        "timestamp": "2026-09-05T10:39:33.846573+00:00",
    }
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = '368091590'")
    count_before = cur.fetchone()[0]

    resp1 = client.post("/api/v1/identify", json=payload)
    assert resp1.status_code == 200
    id1 = resp1.json().get("incidentId")
    assert id1 == "INC-368091590-732E59F6"

    resp2 = client.post("/api/v1/identify", json=payload)
    assert resp2.status_code == 200
    id2 = resp2.json().get("incidentId")
    assert id2 == "INC-368091590-732E59F6"

    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = '368091590'")
    count_after = cur.fetchone()[0]
    conn.close()

    assert count_after == count_before, "DB row count must not increase on repeated identify"


def test_B_repeated_identify_2026_07_15():
    """
    TEST B: Repeated Identify requests for MMSI 368091590 with timestamp 2026-07-15T10:30:00+00:00:
    - Return the canonical ID INC-368091590-8B0923AC
    - Database row count does not increase
    """
    from db.connection import get_connection
    payload = {
        "mmsi": "368091590",
        "timestamp": "2026-07-15T10:30:00+00:00",
    }
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = '368091590'")
    count_before = cur.fetchone()[0]

    resp1 = client.post("/api/v1/identify", json=payload)
    assert resp1.status_code == 200
    id1 = resp1.json().get("incidentId")
    assert id1 == "INC-368091590-8B0923AC"

    resp2 = client.post("/api/v1/identify", json=payload)
    assert resp2.status_code == 200
    id2 = resp2.json().get("incidentId")
    assert id2 == "INC-368091590-8B0923AC"

    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = '368091590'")
    count_after = cur.fetchone()[0]
    conn.close()

    assert count_after == count_before, "DB row count must not increase on repeated identify"


def test_C_distinct_events_create_separate_incidents():
    """
    TEST C: Distinct events:
    - Two calls with significantly different timestamps or locations produce distinct incidentIds
    """
    resp_ev1 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": "2026-02-10T08:00:00Z",
        "lat": 12.5,
        "lon": 65.0
    })
    resp_ev2 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": "2026-03-10T08:00:00Z",
        "lat": 16.5,
        "lon": 69.0
    })
    assert resp_ev1.status_code == 200
    assert resp_ev2.status_code == 200
    id_1 = resp_ev1.json().get("incidentId")
    id_2 = resp_ev2.json().get("incidentId")
    assert id_1 != id_2, f"Distinct events must create separate incident IDs, got {id_1} and {id_2}"


# =====================================================================
# DEDICATED COORDINATE PERSISTENCE TESTS (REQUIREMENTS A THROUGH E)
# =====================================================================

def test_req_A_new_event_valid_coords_persisted():
    """
    Requirement A: New event + valid lat/lon -> incident contains coordinates.
    """
    ts = "2026-08-10T12:00:00Z"
    resp = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": 26.12,
        "lon": -80.14
    })
    assert resp.status_code == 200
    data = resp.json()
    inc_id = data.get("incidentId")
    assert round(data["location"]["lat"], 2) == 26.12
    assert round(data["location"]["lon"], 2) == -80.14

    # Verify in DB
    from db.connection import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT latitude, longitude FROM incidents WHERE id = %s", (inc_id,))
    row = cur.fetchone()
    conn.close()
    assert row is not None
    assert round(row[0], 2) == 26.12
    assert round(row[1], 2) == -80.14


def test_req_B_existing_event_null_coords_updated_by_valid():
    """
    Requirement B: Existing event with NULL coordinates + valid lat/lon -> same incidentId, coordinates become valid.
    """
    ts = "2026-08-11T12:00:00Z"
    # 1. Create event with no coordinates
    resp1 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
    })
    assert resp1.status_code == 200
    inc_id1 = resp1.json().get("incidentId")

    # 2. Call again with valid coordinates
    resp2 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": 27.5,
        "lon": -82.5
    })
    assert resp2.status_code == 200
    assert resp2.json().get("incidentId") == inc_id1, "Must return same canonical incidentId"
    loc2 = resp2.json().get("location", {})
    assert round(loc2.get("lat"), 1) == 27.5
    assert round(loc2.get("lon"), 1) == -82.5

    # Verify DB has updated coordinates
    from db.connection import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT latitude, longitude FROM incidents WHERE id = %s", (inc_id1,))
    row = cur.fetchone()
    conn.close()
    assert row is not None
    assert round(row[0], 1) == 27.5
    assert round(row[1], 1) == -82.5


def test_req_C_existing_event_valid_coords_remain_on_null():
    """
    Requirement C: Existing event with valid coordinates + NULL incoming coordinates -> valid coordinates remain unchanged.
    """
    ts = "2026-08-12T12:00:00Z"
    # 1. Create with valid coordinates
    resp1 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": 28.2,
        "lon": -88.4
    })
    assert resp1.status_code == 200
    inc_id1 = resp1.json().get("incidentId")

    # 2. Call again with NULL coordinates
    resp2 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": None,
        "lon": None
    })
    assert resp2.status_code == 200
    assert resp2.json().get("incidentId") == inc_id1
    loc2 = resp2.json().get("location", {})
    assert round(loc2.get("lat"), 1) == 28.2, "Valid coordinates must remain unchanged"
    assert round(loc2.get("lon"), 1) == -88.4, "Valid coordinates must remain unchanged"

    # Also test with 0,0 - valid coordinates must NOT be replaced with NULL
    resp3 = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": 0.0,
        "lon": 0.0
    })
    assert resp3.status_code == 200
    assert resp3.json().get("incidentId") == inc_id1
    loc3 = resp3.json().get("location", {})
    assert round(loc3.get("lat"), 1) == 28.2, "0,0 must not replace valid coordinates with NULL"
    assert round(loc3.get("lon"), 1) == -88.4


def test_req_D_zero_zero_coordinates_remain_invalid_null():
    """
    Requirement D: 0,0 -> coordinates remain invalid/null.
    """
    ts = "2026-08-13T12:00:00Z"
    resp = client.post("/api/v1/identify", json={
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": 0.0,
        "lon": 0.0
    })
    assert resp.status_code == 200
    data = resp.json()
    loc = data.get("location", {})
    assert loc.get("lat") is None, "0,0 coordinates must remain invalid/null"
    assert loc.get("lon") is None, "0,0 coordinates must remain invalid/null"

    # Verify in DB: NULL, not 0.0
    from db.connection import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT latitude, longitude FROM incidents WHERE id = %s", (data.get("incidentId"),))
    row = cur.fetchone()
    conn.close()
    assert row is not None
    assert row[0] is None
    assert row[1] is None


def test_req_E_repeating_same_event_same_id_and_coords():
    """
    Requirement E: Repeating the exact same event -> same incidentId and same coordinates.
    """
    ts = "2026-08-14T12:00:00Z"
    payload = {
        "mmsi": "368091590",
        "timestamp": ts,
        "lat": 29.1,
        "lon": -87.3
    }
    resp1 = client.post("/api/v1/identify", json=payload)
    assert resp1.status_code == 200
    id1 = resp1.json().get("incidentId")
    loc1 = resp1.json().get("location", {})

    resp2 = client.post("/api/v1/identify", json=payload)
    assert resp2.status_code == 200
    id2 = resp2.json().get("incidentId")
    loc2 = resp2.json().get("location", {})

    assert id1 == id2, "Same incidentId must be returned"
    assert loc1 == loc2, "Same coordinates must be returned"
    assert round(loc2["lat"], 1) == 29.1
    assert round(loc2["lon"], 1) == -87.3


def test_canonical_incident_732E59F6_shows_valid_coords():
    """
    The canonical incident INC-368091590-732E59F6 must show:
    lat = 25.7715133333333
    lon = -80.1518416666667
    in both GET /api/v1/incidents and GET /api/v1/incidents/:id,
    at the root level as well as within nested location.
    """
    # 1. GET /api/v1/incidents
    resp_list = client.get("/api/v1/incidents")
    assert resp_list.status_code == 200
    incidents = resp_list.json()
    inc_732 = next((i for i in incidents if i.get("incidentId") == "INC-368091590-732E59F6"), None)
    assert inc_732 is not None, "INC-368091590-732E59F6 must be in /api/v1/incidents"
    loc_list = inc_732.get("location", {})
    assert loc_list.get("lat") == 25.7715133333333, f"Expected lat 25.7715133333333, got {loc_list.get('lat')}"
    assert loc_list.get("lon") == -80.1518416666667, f"Expected lon -80.1518416666667, got {loc_list.get('lon')}"
    # Check root-level lat and lon as well
    assert inc_732.get("lat") == 25.7715133333333, f"Expected root lat 25.7715133333333, got {inc_732.get('lat')}"
    assert inc_732.get("lon") == -80.1518416666667, f"Expected root lon -80.1518416666667, got {inc_732.get('lon')}"

    # 2. GET /api/v1/incidents/INC-368091590-732E59F6
    resp_single = client.get("/api/v1/incidents/INC-368091590-732E59F6")
    assert resp_single.status_code == 200
    data_single = resp_single.json()
    loc_single = data_single.get("location", {})
    assert loc_single.get("lat") == 25.7715133333333
    assert loc_single.get("lon") == -80.1518416666667
    assert data_single.get("lat") == 25.7715133333333
    assert data_single.get("lon") == -80.1518416666667


def test_E_incidents_list_no_duplicates_for_events():
    """
    TEST E: GET /api/v1/incidents:
    - Exactly ONE record for the 2026-09-05 event
    - Exactly ONE record for the 2026-07-15 event
    - No duplicate incident records for identical event_keys
    """
    resp = client.get("/api/v1/incidents")
    assert resp.status_code == 200
    incidents = resp.json()
    assert isinstance(incidents, list)

    records_0905 = [
        inc for inc in incidents
        if inc.get("mmsi") == "368091590" and "2026-09-05" in str(inc.get("timestamp"))
    ]
    records_0715 = [
        inc for inc in incidents
        if inc.get("mmsi") == "368091590" and "2026-07-15" in str(inc.get("timestamp"))
    ]

    assert len(records_0905) == 1, f"Expected exactly 1 record for 2026-09-05 event, found {len(records_0905)}"
    assert records_0905[0].get("incidentId") == "INC-368091590-732E59F6"

    assert len(records_0715) == 1, f"Expected exactly 1 record for 2026-07-15 event, found {len(records_0715)}"
    assert records_0715[0].get("incidentId") == "INC-368091590-8B0923AC"


def test_F_concurrency_race_condition():
    """
    TEST F: Concurrency / Race Condition test:
    - Multiple simultaneous Identify requests for the same event
    - All return the same canonical incidentId
    - Only ONE row is created in the database
    """
    import concurrent.futures
    from db.connection import get_connection

    concurrent_ts = "2026-05-20T16:30:00Z"
    payload = {
        "mmsi": "368091590",
        "timestamp": concurrent_ts,
        "lat": 19.8,
        "lon": 71.5
    }

    def call_identify():
        c = TestClient(app)
        r = c.post("/api/v1/identify", json=payload)
        return r.status_code, r.json().get("incidentId")

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(call_identify) for _ in range(10)]
        results = [f.result() for f in futures]

    status_codes = [r[0] for r in results]
    incident_ids = [r[1] for r in results]

    assert all(sc == 200 for sc in status_codes), f"All concurrent requests must succeed: {status_codes}"
    assert len(set(incident_ids)) == 1, f"All concurrent requests must return the same ID, got {set(incident_ids)}"

    # Check DB has exactly 1 row for this event
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM incidents WHERE mmsi = '368091590' AND id = %s", (incident_ids[0],))
    cnt = cur.fetchone()[0]
    conn.close()
    assert cnt == 1, "Concurrency must produce exactly one incident record in the database"


def test_G_get_incident_by_id_both_canonical():
    """
    TEST G: GET /api/v1/incidents/:id:
    - Both canonical incidents can be retrieved by their exact ID
    """
    resp_0905 = client.get("/api/v1/incidents/INC-368091590-732E59F6")
    assert resp_0905.status_code == 200
    data_0905 = resp_0905.json()
    assert data_0905.get("incidentId") == "INC-368091590-732E59F6"
    assert data_0905.get("mmsi") == "368091590"

    resp_0715 = client.get("/api/v1/incidents/INC-368091590-8B0923AC")
    assert resp_0715.status_code == 200
    data_0715 = resp_0715.json()
    assert data_0715.get("incidentId") == "INC-368091590-8B0923AC"
    assert data_0715.get("mmsi") == "368091590"


def test_H_backtracking_with_canonical_incident():
    """
    TEST H: Backtracking:
    - GET /api/v1/backtracking/analysis?incidentId=INC-368091590-732E59F6 works
    - Backtracking loads real coordinates from the canonical incident
    """
    resp = client.get("/api/v1/backtracking/analysis?incidentId=INC-368091590-732E59F6")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("incidentId") == "INC-368091590-732E59F6"
    assert data.get("status") in ["ACTIVE", "READY", "COMPLETED", "IN_PROGRESS"] or "driftTrajectory" in data
    drift = data.get("driftTrajectory", [])
    assert len(drift) > 0, "Drift trajectory must be generated from incident coordinates"
    assert "lat" in drift[0] and "lon" in drift[0]


def test_backtracking_selects_correlated_historical_position_not_latest():
    """
    REGRESSION TEST:
    A candidate vessel moves along a trajectory over time:
    02:00 -> 18.20, 72.10
    04:00 -> 18.30, 72.00
    06:00 -> 18.40, 71.90 (closest to the backtracked reverse-drift trajectory)
    08:00 -> 18.50, 71.80
    10:00 -> 18.60, 71.70 (latest position)

    Assume the backtracked spill trajectory is closest to 18.40, 71.90 at 06:00.
    The candidate ranking MUST return the correlated position:
    lat ≈ 18.40, lon ≈ 71.90 with timestamp at 06:00,
    and NOT the latest position (18.60, 71.70).
    """
    from db.connection import get_connection
    from fusion.backtracking_service import simulate_lagrangian_backtrack

    test_mmsi = "998877665"
    base_time = datetime(2026, 9, 9, 6, 0, 0, tzinfo=timezone.utc)
    spill_lat = 18.41
    spill_lon = 71.91

    # Insert mock AIS positions into ais_positions
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM ais_positions WHERE mmsi = %s", (test_mmsi,))
        cur.execute("DELETE FROM ais_anomalies WHERE vessel_id = %s", (test_mmsi,))
        
        positions = [
            (base_time - timedelta(hours=4), 72.10, 18.20),  # 02:00
            (base_time - timedelta(hours=2), 72.00, 18.30),  # 04:00
            (base_time,                      71.90, 18.40),  # 06:00 -> Closest to spill
            (base_time + timedelta(hours=2), 71.80, 18.50),  # 08:00
            (base_time + timedelta(hours=4), 71.70, 18.60),  # 10:00 -> Latest
        ]
        
        for ts, lon, lat in positions:
            cur.execute("""
                INSERT INTO ais_positions (mmsi, ts, location, sog, cog, heading, status, ship_name)
                VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 12.0, 45.0, 45, 0, 'REGRESSION TESTER')
            """, (test_mmsi, ts, lon, lat))

        cur.execute("""
            INSERT INTO ais_anomalies (vessel_id, ts, location, anomaly_type, anomaly_score)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 'SPEED_CHANGE', 0.85)
        """, (test_mmsi, base_time, 71.90, 18.40))
        conn.commit()

        # Create an incident representing the oil spill event at (spill_lat, spill_lon) at 06:00
        test_inc_id = "INC-TEST-SPILL-001"
        cur.execute("DELETE FROM incidents WHERE id = %s", (test_inc_id,))
        cur.execute("""
            INSERT INTO incidents (id, mmsi, timestamp, latitude, longitude, state, anomaly_detected, anomaly_score, event_key)
            VALUES (%s, %s, %s, %s, %s, 'SPILL_OBSERVED', TRUE, 0.9, 'KEY-TEST-SPILL-001')
        """, (test_inc_id, "999999000", base_time, spill_lat, spill_lon))
        conn.commit()

        # Run backtracking simulation centered at (spill_lat, spill_lon) at base_time
        sim = simulate_lagrangian_backtrack(
            spill_lat=spill_lat,
            spill_lon=spill_lon,
            spill_ts=base_time,
            simulation_hours=6,
            cur=cur,
        )

        candidates = [c for c in sim.get("candidate_rankings", []) if c.get("mmsi") == test_mmsi]
        assert len(candidates) == 1, f"Expected candidate {test_mmsi} to be found"
        cand = candidates[0]

        # The correlated position must be near 18.40, 71.90 (at 06:00), NOT 18.60, 71.70 (at 10:00)
        assert abs(cand["lat"] - 18.40) < 0.05, f"Expected correlated lat near 18.40, got {cand['lat']}"
        assert abs(cand["lon"] - 71.90) < 0.05, f"Expected correlated lon near 71.90, got {cand['lon']}"
        assert abs(cand["lng"] - 71.90) < 0.05, f"Expected correlated lng near 71.90, got {cand['lng']}"
        
        # Position timestamp must correspond to the 06:00 observation
        assert cand.get("positionTimestamp") is not None
        assert "06:00:00" in str(cand["positionTimestamp"])

        # Also verify via API endpoint mapping using the incident
        api_resp = client.get(f"/api/v1/backtracking/analysis?incidentId={test_inc_id}&hours=6")
        assert api_resp.status_code == 200
        api_data = api_resp.json()
        api_candidates = [c for c in api_data.get("rankings", []) if c.get("mmsi") == test_mmsi]
        assert len(api_candidates) == 1
        api_cand = api_candidates[0]
        assert abs(api_cand["lat"] - 18.40) < 0.05, f"Expected API candidate lat near 18.40, got {api_cand['lat']}"
        assert abs(api_cand["lng"] - 71.90) < 0.05, f"Expected API candidate lng near 71.90, got {api_cand['lng']}"
        assert abs(api_cand["lon"] - 71.90) < 0.05, f"Expected API candidate lon near 71.90, got {api_cand['lon']}"
        assert "06:00:00" in str(api_cand.get("positionTimestamp"))

    finally:
        try:
            conn.rollback()
        except Exception:
            pass
        cur.execute("DELETE FROM ais_positions WHERE mmsi = %s", (test_mmsi,))
        cur.execute("DELETE FROM ais_anomalies WHERE vessel_id = %s", (test_mmsi,))
        cur.execute("DELETE FROM incidents WHERE id = 'INC-TEST-SPILL-001'")
        conn.commit()
        conn.close()





