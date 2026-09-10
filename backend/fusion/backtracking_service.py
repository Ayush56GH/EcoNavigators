"""
Forensic Backtracking & Lagrangian Hydrodynamic Reverse-Drift Modeling Engine
Owner: Harsh (Backend / Integration Lead)

Provides:
1. Multi-window historical AIS trajectory retrieval (1h, 6h, 12h, 24h)
2. Lagrangian particle reverse-drift modeling incorporating surface current and windage
3. Spatio-temporal candidate vessel intercept correlation and attribution ranking
"""

import os
import math
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from db.connection import get_connection

# ---------------------------------------------------------------------------
# Module-level SAR characterization cache
# Populated by sar_unet_detector.associate_and_decide() via the /oil-spill/analyze
# endpoint. Allows backtracking to use LIVE SAR metrics instead of simulated ones.
# ---------------------------------------------------------------------------
_sar_char_cache: Dict[str, Any] = {}


def update_sar_characterization_cache(char: Dict[str, Any]) -> None:
    """
    Called by main.py after a successful SAR detection to persist live metrics.
    DEFERRED: Currently unused in AIS-first incident flow to prevent cache leakage across incidents.
    """
    global _sar_char_cache
    _sar_char_cache = {
        "area_km2": char.get("area_km2"),
        "perimeter_km": char.get("perimeter_km"),
        "aspect_ratio": char.get("aspect_ratio"),
        "orientation_deg": char.get("orientation_deg"),
        "damping_contrast_db": char.get("damping_contrast_db"),
        "slick_type": char.get("slick_type", "MINERAL_OIL_SLICK"),
        "estimated_age_hours": char.get("estimated_age_hours"),
        "age_range_hours": char.get("age_range_hours"),
        "weathering_stage": char.get("weathering_stage"),
        "evaporation_fraction_pct": char.get("evaporation_fraction_pct"),
        "appearance_code": char.get("appearance_code"),
        "emulsification_risk": char.get("emulsification_risk"),
        "_source": "LIVE_SAR_DETECTION",
        "_cached_at": datetime.now(timezone.utc).isoformat(),
    }


def get_cached_sar_characterization() -> Optional[Dict[str, Any]]:
    """
    Returns the cached SAR characterization dict, or None if cache is empty.
    DEFERRED: Returns None for AIS-only incidents to prevent cross-incident state pollution.
    """
    return _sar_char_cache if _sar_char_cache else None




def is_valid_geo_coord(lat: Any, lon: Any) -> bool:
    """
    Checks if a coordinate pair represents a valid, observed geographic location.
    Rejects:
    - None or NaN values
    - 0.0, 0.0 (Null Island / uninitialized GPS reset)
    - Latitude outside [-90.0, 90.0]
    - Longitude outside [-180.0, 180.0]
    """
    if lat is None or lon is None:
        return False
    try:
        f_lat = float(lat)
        f_lon = float(lon)
    except (ValueError, TypeError):
        return False
    if math.isnan(f_lat) or math.isnan(f_lon):
        return False
    if abs(f_lat) < 1e-6 and abs(f_lon) < 1e-6:
        return False
    if not (-90.0 <= f_lat <= 90.0) or not (-180.0 <= f_lon <= 180.0):
        return False
    return True


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes Great-Circle distance in km between two points.
    If either point has invalid/missing coordinates or is 0,0, returns infinity to exclude from spatial matching.
    """
    if not is_valid_geo_coord(lat1, lon1) or not is_valid_geo_coord(lat2, lon2):
        return float("inf")
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _parse_datetime(val: Any) -> datetime:
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def get_vessel_trajectory(mmsi: str, hours: int = 24, cur=None) -> Dict[str, Any]:
    """
    Retrieves chronological AIS trajectory for a vessel over a selectable window (1h, 6h, 12h, 24h).
    """
    close_cur = False
    conn = None
    if cur is None:
        conn = get_connection()
        cur = conn.cursor()
        close_cur = True

    try:
        # Determine latest timestamp for this vessel
        cur.execute("""
            SELECT ts FROM ais_positions WHERE mmsi = %s ORDER BY ts DESC LIMIT 1
        """, (str(mmsi),))
        latest_row = cur.fetchone()

        if not latest_row:
            return {
                "mmsi": str(mmsi),
                "ship_name": f"Vessel {mmsi}",
                "hours_window": hours,
                "positions_count": 0,
                "track": [],
            }

        latest_ts = latest_row[0]
        since_ts = latest_ts - timedelta(hours=hours)

        cur.execute("""
            SELECT ts, ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                   sog, cog, heading, status, ship_name, imo
            FROM ais_positions
            WHERE mmsi = %s AND ts >= %s
            ORDER BY ts ASC
        """, (str(mmsi), since_ts))
        rows = cur.fetchall()

        # If insufficient points in the requested time window, report INSUFFICIENT_DATA
        if len(rows) < 2:
            raw_imo = rows[-1][8] if rows else None
            clean_imo = str(raw_imo) if raw_imo and str(raw_imo) != "UNKNOWN" and not str(raw_imo).startswith("IMO-") else None
            return {
                "mmsi": str(mmsi),
                "ship_name": rows[-1][7] if rows and rows[-1][7] else f"Vessel {mmsi}",
                "imo": clean_imo,
                "hours_window": hours,
                "status": "INSUFFICIENT_DATA",
                "positions_count": len(rows),
                "track": [],
                "reason": f"Fewer than 2 AIS points recorded within the requested {hours}h window.",
            }

        track = [
            {
                "timestamp": r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0]),
                "lat": round(float(r[2]), 6),
                "lng": round(float(r[1]), 6),
                "lon": round(float(r[1]), 6),
                "speedKnots": round(float(r[3] or 0.0), 1),
                "sog": round(float(r[3] or 0.0), 1),
                "headingDeg": float(r[5]) if r[5] is not None and r[5] != 511 else 0.0,
                "heading": float(r[5]) if r[5] is not None and r[5] != 511 else None,
                "cog": round(float(r[4] or 0.0), 1),
                "status": r[6],
            }
            for r in rows
        ]

        raw_imo = rows[-1][8] if rows and rows[-1][8] else None
        clean_imo = str(raw_imo) if raw_imo and str(raw_imo) != "UNKNOWN" and not str(raw_imo).startswith("IMO-") else None

        return {
            "mmsi": str(mmsi),
            "ship_name": rows[-1][7] if rows and rows[-1][7] else f"Vessel {mmsi}",
            "imo": clean_imo,
            "hours_window": hours,
            "status": "AVAILABLE",
            "positions_count": len(track),
            "track": track,
        }

    finally:
        if close_cur:
            cur.close()
            if conn:
                conn.close()


def simulate_forward_drift(
    spill_lat: float,
    spill_lon: float,
    spill_ts: Any = None,
    forecast_hours: int = 48,
    u_drift: float = 0.0,
    v_drift: float = 0.0,
    step_minutes: int = 30,
    initial_area_km2: float = 3.2,
) -> List[Dict[str, Any]]:
    """
    Simulates forward Lagrangian drift trajectory and expanding surface dispersion
    into the future (+3h, +6h, +12h, +24h, +48h) for emergency containment & response.
    """
    t_start = _parse_datetime(spill_ts)
    total_steps = int((forecast_hours * 60) / step_minutes)
    forecast_points = []

    cur_lat = spill_lat
    cur_lon = spill_lon
    step_sec = step_minutes * 60.0
    m_per_deg_lat = 111320.0

    for step in range(total_steps + 1):
        elapsed_min = step * step_minutes
        t_step = t_start + timedelta(minutes=elapsed_min)
        elapsed_hours = elapsed_min / 60.0

        # Expanding turbulent dispersion radius (G.I. Taylor ocean diffusion model)
        uncertainty_km = round(0.5 + 0.42 * math.sqrt(max(0.1, elapsed_hours)), 2)
        # Fay spreading area expansion: A(t) = A_0 * (1 + 0.16 * t^0.75)
        dispersed_area_km2 = round(initial_area_km2 * (1.0 + 0.16 * (elapsed_hours ** 0.75)), 2)

        forecast_points.append({
            "step": step,
            "hours_ahead": round(elapsed_hours, 1),
            "minutes_ahead": elapsed_min,
            "timestamp": t_step.isoformat(),
            "lat": round(cur_lat, 6),
            "lon": round(cur_lon, 6),
            "uncertainty_radius_km": uncertainty_km,
            "estimated_dispersed_area_km2": dispersed_area_km2,
        })

        # Displace forward for next step
        m_per_deg_lon = m_per_deg_lat * math.cos(math.radians(cur_lat))
        cur_lat += (v_drift * step_sec) / m_per_deg_lat
        cur_lon += (u_drift * step_sec) / max(1.0, m_per_deg_lon)

    return forecast_points


def assess_coastal_landfall(
    forecast_points: List[Dict[str, Any]],
    spill_lat: float,
    spill_lon: float,
) -> Dict[str, Any]:
    """
    Evaluates coastline proximity, projected landfall location, ETA, and ecological vulnerability
    along the forward drift trajectory.
    """
    # Key coastal reference waypoints & marine sanctuaries (Florida, Gulf, Caribbean, and regional baselines)
    COASTAL_SECTORS = [
        {"name": "Biscayne National Park & Key Largo Marine Sanctuary", "lat": 25.45, "lon": -80.18, "vulnerability": "CRITICAL"},
        {"name": "Miami Beach & PortMiami Channel", "lat": 25.77, "lon": -80.13, "vulnerability": "HIGH"},
        {"name": "Fort Lauderdale Coastal Corridor", "lat": 26.12, "lon": -80.10, "vulnerability": "HIGH"},
        {"name": "Bimini Islands Marine Reserve (Bahamas)", "lat": 25.73, "lon": -79.30, "vulnerability": "HIGH"},
        {"name": "Florida Keys Coral Reef Protection Zone", "lat": 24.95, "lon": -80.45, "vulnerability": "CRITICAL"},
        {"name": "Gulf Coast Outer Shoals", "lat": 28.95, "lon": -89.30, "vulnerability": "HIGH"},
    ]

    min_dist_km = float("inf")
    closest_sector = None
    landfall_point = None
    landfall_eta_hours = None

    current_dist_to_coast = min(haversine_km(spill_lat, spill_lon, s["lat"], s["lon"]) for s in COASTAL_SECTORS)

    for pt in forecast_points:
        p_lat, p_lon = pt["lat"], pt["lon"]
        for sector in COASTAL_SECTORS:
            d = haversine_km(p_lat, p_lon, sector["lat"], sector["lon"])
            if d < min_dist_km:
                min_dist_km = d
                closest_sector = sector
                if d <= 12.0 and landfall_eta_hours is None and pt["hours_ahead"] > 0:
                    landfall_eta_hours = pt["hours_ahead"]
                    landfall_point = [pt["lat"], pt["lon"]]

    min_dist_km = round(min_dist_km, 1)
    current_dist_to_coast = round(current_dist_to_coast, 1)

    if min_dist_km <= 15.0 or (landfall_eta_hours is not None and landfall_eta_hours <= 24.0):
        vulnerability_level = "CRITICAL"
        status = "IMMINENT_LANDFALL_RISK"
        action_advisory = (
            f"URGENT: Forward drift projects slick approach to within {min_dist_km} km of "
            f"{closest_sector['name'] if closest_sector else 'coastline'} in ~{landfall_eta_hours or 18} hours. "
            "Immediate containment boom deployment and skimmer dispatch required."
        )
    elif min_dist_km <= 35.0:
        vulnerability_level = "HIGH"
        status = "COASTAL_MONITORING_ALERT"
        action_advisory = (
            f"ALERT: Trajectory trends towards {closest_sector['name'] if closest_sector else 'marine boundary'}. "
            f"Distance to sensitive shoreline: {min_dist_km} km. High-alert reconnaissance recommended."
        )
    elif min_dist_km <= 65.0:
        vulnerability_level = "MODERATE"
        status = "OFFSHORE_DRIFT"
        action_advisory = (
            f"Drift path maintaining offshore corridor ({min_dist_km} km to nearest shore). "
            "Continuous tracking active."
        )
    else:
        vulnerability_level = "LOW"
        status = "OPEN_SEA_DRIFT"
        action_advisory = "Spill drifting in open waters. No immediate coastline threat detected within 48h window."

    return {
        "status": status,
        "vulnerability_level": vulnerability_level,
        "current_distance_to_coast_km": current_dist_to_coast,
        "min_forecast_distance_km": min_dist_km,
        "nearest_sensitive_area": closest_sector["name"] if closest_sector else "Coastal Waters",
        "projected_landfall_point": landfall_point,
        "estimated_landfall_eta_hours": landfall_eta_hours,
        "action_advisory": action_advisory,
    }


def simulate_lagrangian_backtrack(
    spill_lat: float,
    spill_lon: float,
    spill_ts: Any = None,
    simulation_hours: int = 12,
    current_speed_knots: float = 0.8,
    current_dir_deg: float = 45.0,
    wind_speed_knots: float = 12.0,
    wind_dir_deg: float = 80.0,
    wind_drift_factor: float = 0.03,
    step_minutes: int = 15,   # 15-min steps → denser, more accurate trajectory
    cur=None,
) -> Dict[str, Any]:
    """
    Simulates Lagrangian reverse drift of an oil slick from current observed position
    backward in time to reconstruct the release point and correlate candidate vessels.
    """
    t_start = _parse_datetime(spill_ts)

    # 1. Convert current and wind vectors to m/s
    # Wind/Current directions: meteorological/oceanographic conventions (direction moving TO)
    rad_curr = math.radians(current_dir_deg)
    u_curr = (current_speed_knots * 0.514444) * math.sin(rad_curr)
    v_curr = (current_speed_knots * 0.514444) * math.cos(rad_curr)

    rad_wind = math.radians(wind_dir_deg)
    u_wind = (wind_speed_knots * 0.514444) * math.sin(rad_wind) * wind_drift_factor
    v_wind = (wind_speed_knots * 0.514444) * math.cos(rad_wind) * wind_drift_factor

    # Net forward surface drift velocity (m/s)
    u_drift = u_curr + u_wind
    v_drift = v_curr + v_wind

    # Reverse drift velocity (m/s)
    u_rev = -u_drift
    v_rev = -v_drift

    # 2. Step backward in time
    total_steps = int((simulation_hours * 60) / step_minutes)
    drift_points = []
    
    cur_lat = spill_lat
    cur_lon = spill_lon
    step_sec = step_minutes * 60.0

    # Metres per degree latitude ~ 111,320m
    m_per_deg_lat = 111320.0

    for step in range(total_steps + 1):
        elapsed_min = step * step_minutes
        t_step = t_start - timedelta(minutes=elapsed_min)

        # Turbulent spreading uncertainty radius (increases with sqrt of elapsed time)
        # r(t) = r0 + sigma * sqrt(t)
        uncertainty_km = round(0.5 + 0.35 * math.sqrt(max(1, elapsed_min / 60.0)), 2)

        drift_points.append({
            "step": step,
            "minutes_ago": elapsed_min,
            "timestamp": t_step.isoformat(),
            "lat": round(cur_lat, 6),
            "lon": round(cur_lon, 6),
            "uncertainty_radius_km": uncertainty_km,
        })

        # Displace backward for next step
        m_per_deg_lon = m_per_deg_lat * math.cos(math.radians(cur_lat))
        cur_lat += (v_rev * step_sec) / m_per_deg_lat
        cur_lon += (u_rev * step_sec) / max(1.0, m_per_deg_lon)

    estimated_origin = drift_points[-1]

    # 3. Intercept correlation against candidate vessels in database
    close_cur = False
    conn = None
    if cur is None:
        conn = get_connection()
        cur = conn.cursor()
        close_cur = True

    candidate_rankings = []
    origin_lat = estimated_origin["lat"]
    origin_lon = estimated_origin["lon"]

    try:
        # -----------------------------------------------------------------------
        # Query 1: vessels within 50 km of the spill OR origin point,
        # active in the ±(simulation_hours + 3) hour window around the event.
        # Uses ST_DWithin for efficient spatial filtering.
        # Retrieves ALL historical AIS positions in the window chronologically (ORDER BY p.mmsi, p.ts ASC).
        # -----------------------------------------------------------------------
        cur.execute("""
            SELECT
                p.mmsi,
                p.ship_name,
                p.ship_type,
                p.imo,
                ST_X(p.location::geometry)       AS lon,
                ST_Y(p.location::geometry)        AS lat,
                p.sog,
                p.cog,
                p.ts,
                COALESCE(a.anomaly_score, 0.0)    AS anomaly_score,
                COALESCE(a.anomaly_type, 'NORMAL') AS anomaly_type,
                ST_Distance(
                    p.location::geography,
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                ) / 1000.0  AS dist_to_spill_km
            FROM ais_positions p
            LEFT JOIN LATERAL (
                SELECT anomaly_score, anomaly_type
                FROM ais_anomalies
                WHERE vessel_id = p.mmsi OR vessel_id = CONCAT('MMSI_', p.mmsi)
                ORDER BY ts DESC LIMIT 1
            ) a ON TRUE
            WHERE
                p.ts BETWEEN %s AND %s
                AND (
                    ST_DWithin(
                        p.location::geography,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        50000   -- 50 km radius around spill
                    )
                    OR
                    ST_DWithin(
                        p.location::geography,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        50000   -- 50 km radius around estimated origin
                    )
                )
            ORDER BY p.mmsi, p.ts ASC
        """, (
            spill_lon, spill_lat,
            t_start - timedelta(hours=simulation_hours + 3),
            t_start + timedelta(hours=3),
            spill_lon, spill_lat,
            origin_lon, origin_lat,
        ))
        pos_rows = cur.fetchall()

        # Build vessel groups with all their positions for trajectory matching
        vessel_groups: Dict[str, Any] = {}
        for r in pos_rows:
            mmsi = str(r[0])
            raw_imo = r[3]
            clean_imo = str(raw_imo) if raw_imo and str(raw_imo) != "UNKNOWN" and not str(raw_imo).startswith("IMO-") else None
            p_lon = float(r[4])
            p_lat = float(r[5])
            if mmsi not in vessel_groups:
                vessel_groups[mmsi] = {
                    "mmsi":          mmsi,
                    "name":          r[1] or f"Vessel {mmsi}",
                    "type":          r[2] or "Commercial Vessel",
                    "imo":           clean_imo,
                    "anomaly_score": float(r[9]),
                    "anomaly_type":  r[10],
                    "positions":     [],
                    "dist_to_spill_km": float(r[11]),
                }
            if is_valid_geo_coord(p_lat, p_lon):
                vessel_groups[mmsi]["positions"].append({
                    "lon": p_lon,
                    "lat": p_lat,
                    "sog": float(r[6] or 0.0),
                    "cog": float(r[7] or 0.0),
                    "ts":  r[8],
                })

        # Score each vessel: correlate EVERY historical position against the backtracked trajectory
        # and select the CORRELATED AIS POSITION (the position with the strongest spatial relationship)
        for mmsi, vdata in vessel_groups.items():
            min_dist = float("inf")
            best_position = None

            for p in vdata["positions"]:
                for dp in drift_points:
                    d = haversine_km(p["lat"], p["lon"], dp["lat"], dp["lon"])
                    if d < min_dist:
                        min_dist = d
                        best_position = p

            if min_dist <= 50.0 and best_position is not None:
                # Gaussian proximity weight with sharper spatial discriminator (sigma = 2.5 km)
                spatial_weight = math.exp(-(min_dist ** 2) / (2 * (2.5 ** 2)))
                # Anomaly weighting: factor in anomaly score and suspicious maneuver types
                anomaly_type_weight = 1.0
                upper_anomaly_type = str(vdata.get("anomaly_type", "")).upper()
                if any(k in upper_anomaly_type for k in ["SPEED_CHANGE", "SPEED_DROP", "SUDDEN_SPEED"]):
                    anomaly_type_weight = 1.15
                elif any(k in upper_anomaly_type for k in ["TURNING", "ERRATIC_COURSE", "COURSE_DEVIATION"]):
                    anomaly_type_weight = 1.08
                elif "LOITERING" in upper_anomaly_type:
                    anomaly_type_weight = 1.05

                anomaly_factor = (0.5 + 0.5 * float(vdata["anomaly_score"])) * anomaly_type_weight
                raw_score = float(spatial_weight * anomaly_factor)

                pos_ts = best_position.get("ts")
                iso_ts = pos_ts.isoformat() if hasattr(pos_ts, "isoformat") else (str(pos_ts) if pos_ts is not None else None)

                candidate_rankings.append({
                    "mmsi":                        mmsi,
                    "name":                        vdata["name"],
                    "type":                        vdata["type"],
                    "imo":                         vdata["imo"],
                    "anomaly_score":               round(vdata["anomaly_score"], 3),
                    "anomaly_type":                vdata["anomaly_type"],
                    "min_distance_to_corridor_km": round(min_dist, 2),
                    "evidence_level":              "HIGH" if min_dist <= 15.0 and vdata["anomaly_score"] >= 0.4 else "MEDIUM",
                    "raw_score":                   raw_score,
                    "lat":                         best_position.get("lat"),
                    "lon":                         best_position.get("lon"),
                    "lng":                         best_position.get("lon"),
                    "positionTimestamp":           iso_ts,
                })

        # -----------------------------------------------------------------------
        # Query 2: If no spatial candidates found, fall back to anomalous vessels
        # but strictly mark as LOW_CONFIDENCE / INCONCLUSIVE without fake high rank
        # -----------------------------------------------------------------------
        if not candidate_rankings:
            cur.execute("""
                SELECT
                    a.vessel_id, a.anomaly_type, a.anomaly_score,
                    p.ship_name, p.ship_type, p.imo,
                    ST_X(p.location::geometry) AS lon,
                    ST_Y(p.location::geometry) AS lat,
                    p.ts
                FROM ais_anomalies a
                LEFT JOIN LATERAL (
                    SELECT ship_name, ship_type, imo, location, ts
                    FROM ais_positions
                    WHERE mmsi = a.vessel_id OR mmsi = REPLACE(a.vessel_id, 'MMSI_', '')
                    ORDER BY ts DESC LIMIT 1
                ) p ON TRUE
                WHERE a.anomaly_score >= 0.3
                ORDER BY a.anomaly_score DESC
                LIMIT 5
            """)
            fallback_rows = cur.fetchall()
            for row in fallback_rows:
                mmsi = str(row[0]).replace("MMSI_", "")
                raw_imo = row[5]
                clean_imo = str(raw_imo) if raw_imo and str(raw_imo) != "UNKNOWN" and not str(raw_imo).startswith("IMO-") else None
                vlat = float(row[7]) if row[7] is not None and is_valid_geo_coord(row[7], row[6]) else (spill_lat if is_valid_geo_coord(spill_lat, spill_lon) else None)
                vlon = float(row[6]) if row[6] is not None and is_valid_geo_coord(row[7], row[6]) else (spill_lon if is_valid_geo_coord(spill_lat, spill_lon) else None)
                
                dist_to_spill = haversine_km(vlat, vlon, spill_lat, spill_lon) if vlat is not None and vlon is not None else float("inf")
                is_spatially_close = dist_to_spill <= 50.0
                spatial_weight = math.exp(-(dist_to_spill ** 2) / (2 * (10.0 ** 2))) if is_spatially_close else 0.05
                
                anomaly_type_weight = 1.0
                fallback_type = str(row[1] or "").upper()
                if any(k in fallback_type for k in ["SPEED_CHANGE", "SPEED_DROP", "SUDDEN_SPEED"]):
                    anomaly_type_weight = 1.15
                elif any(k in fallback_type for k in ["TURNING", "ERRATIC_COURSE", "COURSE_DEVIATION"]):
                    anomaly_type_weight = 1.08
                elif "LOITERING" in fallback_type:
                    anomaly_type_weight = 1.05

                anomaly_factor = (0.5 + 0.5 * float(row[2])) * anomaly_type_weight
                raw_score = float(spatial_weight * anomaly_factor)

                fb_ts = row[8]
                fb_iso_ts = fb_ts.isoformat() if hasattr(fb_ts, "isoformat") else (str(fb_ts) if fb_ts is not None else None)

                candidate_rankings.append({
                    "mmsi":                        mmsi,
                    "name":                        row[3] or f"Vessel {mmsi}",
                    "type":                        row[4] or "Commercial Vessel",
                    "imo":                         clean_imo,
                    "anomaly_score":               round(float(row[2]), 3),
                    "anomaly_type":                row[1],
                    "min_distance_to_corridor_km": round(dist_to_spill, 2) if math.isfinite(dist_to_spill) else 999.0,
                    "evidence_level":              "LOW_CONFIDENCE" if not is_spatially_close else "MEDIUM",
                    "raw_score":                   raw_score,
                    "lat":                         vlat,
                    "lon":                         vlon,
                    "lng":                         vlon,
                    "positionTimestamp":           fb_iso_ts,
                })

    except Exception as e:
        print(f"[Backtracking] Candidate query error ({e}). Returning empty rankings.")
    finally:
        if close_cur:
            cur.close()
            if conn:
                conn.close()

    # Deduplicate candidate rankings strictly by MMSI before normalizing.
    # Group by MMSI and select the candidate record with the strongest evidence:
    # highest raw_score, highest valid anomaly_score, minimum distance to corridor.
    if candidate_rankings:
        grouped_candidates: Dict[str, Dict[str, Any]] = {}
        for c in candidate_rankings:
            m = str(c.get("mmsi", "")).strip()
            if not m:
                continue
            if m not in grouped_candidates:
                grouped_candidates[m] = c
            else:
                existing = grouped_candidates[m]
                # Compare by raw_score, then anomaly_score, then min_distance
                is_better = False
                c_raw = c.get("raw_score", 0.0)
                e_raw = existing.get("raw_score", 0.0)
                if c_raw > e_raw:
                    is_better = True
                elif math.isclose(c_raw, e_raw):
                    if c.get("anomaly_score", 0.0) > existing.get("anomaly_score", 0.0):
                        is_better = True
                    elif c.get("min_distance_to_corridor_km", float("inf")) < existing.get("min_distance_to_corridor_km", float("inf")):
                        is_better = True
                if is_better:
                    grouped_candidates[m] = c

        candidate_rankings = list(grouped_candidates.values())

    # Normalize candidate attribution scores:
    # Strongest candidate is near 100.0, weaker candidates receive progressively lower scores,
    # and all scores are preserved as floats with 1 decimal place.
    if candidate_rankings:
        candidate_rankings.sort(key=lambda c: c["raw_score"], reverse=True)
        candidate_rankings = candidate_rankings[:10]   # top 10 unique MMSI only
        max_raw = candidate_rankings[0]["raw_score"]
        if max_raw > 0:
            for c in candidate_rankings:
                norm_score = round((c["raw_score"] / max_raw) * 100.0, 1)
                c["attribution_score"] = norm_score
                c["probability_pct"] = norm_score  # backwards-compatible alias
        else:
            for c in candidate_rankings:
                c["attribution_score"] = 0.0
                c["probability_pct"] = 0.0

    # 4. Forward Drift Forecasting & Coastline Landfall Assessment
    forecast_points = simulate_forward_drift(
        spill_lat=spill_lat,
        spill_lon=spill_lon,
        spill_ts=t_start,
        forecast_hours=48,
        u_drift=u_drift,
        v_drift=v_drift,
        step_minutes=step_minutes,
        initial_area_km2=3.4,
    )

    coastal_impact = assess_coastal_landfall(
        forecast_points=forecast_points,
        spill_lat=spill_lat,
        spill_lon=spill_lon,
    )

    # 5. Oil Spill Geometric & Weathering Characterization
    # Since SAR is deferred, avoid fabricating unmeasured physical values or leaking cache
    spill_characterization = {
        "status": "DEFERRED",
        "data_available": False,
        "damping_contrast_db": None,
        "aspect_ratio": None,
        "orientation_deg": None,
        "area_km2": None,
        "perimeter_km": None,
        "estimated_age_hours": None,
        "weathering_stage": "NOT_AVAILABLE",
        "evaporation_fraction_pct": None,
        "appearance_code": "NOT_AVAILABLE",
        "emulsification_risk": "NOT_AVAILABLE",
        "_source": "SAR_DEFERRED",
    }

    return {
        "simulation_hours": simulation_hours,
        "step_minutes": step_minutes,
        "spill_location": {"lat": spill_lat, "lon": spill_lon},
        "spill_observed_time": t_start.isoformat(),
        "estimated_origin": {
            "lat": estimated_origin["lat"],
            "lon": estimated_origin["lon"],
            "estimated_release_time": estimated_origin["timestamp"],
            "hours_drifted": simulation_hours,
            "uncertainty_radius_km": estimated_origin["uncertainty_radius_km"],
        },
        "hydrodynamics": {
            "surface_current": {
                "speed_knots": current_speed_knots,
                "direction_deg": current_dir_deg,
                "u_ms": round(u_curr, 3),
                "v_ms": round(v_curr, 3),
            },
            "wind": {
                "speed_knots": wind_speed_knots,
                "direction_deg": wind_dir_deg,
                "drift_factor": wind_drift_factor,
            },
            "net_drift_vector": {
                "speed_knots": round(math.sqrt(u_drift**2 + v_drift**2) / 0.514444, 2),
                "direction_deg": round(math.degrees(math.atan2(u_drift, v_drift)) % 360, 1),
            },
        },
        "drift_trajectory": drift_points,
        "forecast_trajectory": forecast_points,
        "spill_characterization": spill_characterization,
        "coastal_impact": coastal_impact,
        "candidate_rankings": candidate_rankings,
    }


# Unified oceanographic drift analysis alias
simulate_drift_analysis = simulate_lagrangian_backtrack

