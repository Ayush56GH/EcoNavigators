"""
Fusion Engine
Owner: Harsh (Backend / Integration Lead)

Combines AIS anomaly output + SAR detection output into a single ranked alert list.
Matches records by proximity in location and time.
"""
import json
from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timezone
from config import fusion_cfg


def parse_iso(ts_str):
    if isinstance(ts_str, datetime):
        return ts_str if ts_str.tzinfo else ts_str.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
    except Exception:
        return None


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def load_json(path: str) -> list:
    with open(path) as f:
        return json.load(f)


def fuse(ais_anomalies: list, sar_detections: list,
         max_distance_km: float = None, max_time_minutes: float = None) -> list:
    """
    For each AIS anomaly, find the nearest SAR detection within max_distance_km
    and within max_time_minutes. If found, produce a combined alert.
    If no SAR match or temporal mismatch, emit an unconfirmed / lower-confidence alert.
    """
    limit_dist = max_distance_km if max_distance_km is not None else fusion_cfg.MAX_DISTANCE_KM
    limit_time_sec = (max_time_minutes if max_time_minutes is not None else fusion_cfg.MAX_TIME_MINUTES) * 60.0

    alerts = []
    for ais in ais_anomalies:
        best_match = None
        best_dist = limit_dist
        t_ais = parse_iso(ais.get("timestamp"))

        for sar in sar_detections:
            dist = haversine_km(ais["lat"], ais["lon"], sar["aoi_lat"], sar["aoi_lon"])
            if dist <= best_dist:
                t_sar = parse_iso(sar.get("acquisition_time") or sar.get("timestamp"))
                if t_ais and t_sar:
                    delta_sec = abs((t_ais - t_sar).total_seconds())
                    if delta_sec > limit_time_sec:
                        continue  # Temporal mismatch: reject association
                best_dist = dist
                best_match = sar

        if best_match:
            combined = round(0.5 * ais["anomaly_score"] + 0.5 * best_match["spill_probability"], 2)
            status = "ALERT" if combined >= 0.6 else "WATCH"
        else:
            combined = round(ais["anomaly_score"] * 0.5, 2)
            status = "WATCH_NO_SAT_COVERAGE"

        alerts.append({
            "vessel_id": ais["vessel_id"],
            "location": {"lat": ais["lat"], "lon": ais["lon"]},
            "timestamp": ais["timestamp"],
            "anomaly_type": ais["anomaly_type"],
            "ais_confidence": ais["anomaly_score"],
            "spill_confidence": best_match["spill_probability"] if best_match else None,
            "combined_confidence": combined,
            "status": status,
        })

    return sorted(alerts, key=lambda a: a["combined_confidence"], reverse=True)


def export_alerts(alerts: list, out_path: str) -> None:
    with open(out_path, "w") as f:
        json.dump(alerts, f, indent=2)
    print(f"Wrote {len(alerts)} fused alerts to {out_path}")


def find_nearest_sar(ais_lon: float, ais_lat: float, cur, ais_ts=None, max_distance_km=None, max_time_min=None):
    """
    Requires BOTH spatial proximity AND temporal correlation before associating SAR detection.
    """
    max_dist_m = (max_distance_km if max_distance_km is not None else fusion_cfg.MAX_DISTANCE_KM) * 1000.0
    sql = """
    SELECT scene_id, spill_probability, acquisition_time,
           ST_Distance(aoi_location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS dist
    FROM sar_detections
    WHERE ST_DWithin(aoi_location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
    ORDER BY dist
    LIMIT 5;
    """
    cur.execute(sql, (ais_lon, ais_lat, ais_lon, ais_lat, max_dist_m))
    rows = cur.fetchall()
    if not rows:
        return None

    max_delta_sec = (max_time_min if max_time_min is not None else fusion_cfg.MAX_TIME_MINUTES) * 60.0
    target_dt = parse_iso(ais_ts)

    for r in rows:
        scene_id, spill_prob, acq_time, dist = r
        if target_dt and acq_time:
            sar_dt = parse_iso(acq_time)
            if sar_dt:
                delta_sec = abs((target_dt - sar_dt).total_seconds())
                if delta_sec <= max_delta_sec:
                    return scene_id, spill_prob, dist, delta_sec / 60.0
        elif not target_dt:
            return scene_id, spill_prob, dist, None

    return None


def fuse_db(ais_anomalies: list, cur) -> list:
    alerts = []
    for ais in ais_anomalies:
        result = find_nearest_sar(ais["lon"], ais["lat"], cur, ais_ts=ais.get("timestamp"))

        if result:
            scene_id, spill_probability, dist, delta_min = result
            combined = round(0.5 * ais["anomaly_score"] + 0.5 * spill_probability, 2)
            # Both spatial and temporal match required for ALERT confirmation
            status = "ALERT" if combined >= 0.6 and delta_min is not None else "WATCH"
        else:
            combined = round(ais["anomaly_score"] * 0.5, 2)
            status = "WATCH_NO_SAT_COVERAGE"

        alerts.append({
            "vessel_id": ais["vessel_id"],
            "location": {"lat": ais["lat"], "lon": ais["lon"]},
            "timestamp": ais["timestamp"],
            "anomaly_type": ais["anomaly_type"],
            "ais_confidence": ais["anomaly_score"],
            "spill_confidence": spill_probability if result else None,  
            "combined_confidence": combined,
            "status": status,
        })

    return sorted(alerts, key=lambda a: a["combined_confidence"], reverse=True)

if __name__ == "__main__":
    import os
    base = os.path.dirname(__file__)
    ais_path = os.path.join(base, "..", "data", "processed", "ais_anomalies.json")
    sar_path = os.path.join(base, "..", "data", "processed", "sar_detections.json")
    out_path = os.path.join(base, "..", "data", "processed", "alert.json")
    ais = load_json(ais_path)
    sar = load_json(sar_path)
    alerts = fuse(ais, sar)
    export_alerts(alerts, out_path)

