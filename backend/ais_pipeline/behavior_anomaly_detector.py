"""
AIS Behavior Anomaly Detector & Gatekeeper
Owner: Harsh (Backend / Integration Lead)

Analyzes AIS vessel trajectories to detect behavioral indicators of maritime distress
or deliberate discharge (speed drops, erratic turns, loitering/drifting, AIS transponder gaps).

Enforces the core rule:
  ANOMALOUS VESSEL != OIL SPILL
  NORMAL VESSEL -> STOP IMMEDIATELY (no Copernicus satellite calls)
"""

import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from config import ais_cfg
from db.connection import get_connection


def _angular_diff(a: float, b: float) -> float:
    """Calculates minimal angular distance between two courses in degrees [0, 180]."""
    diff = abs(a - b) % 360
    return 360 - diff if diff > 180 else diff


class AISBehaviorAnomalyDetector:
    def __init__(
        self,
        speed_drop_threshold_knots: Optional[float] = None,
        cog_turn_threshold_deg: Optional[float] = None,
        gap_threshold_minutes: Optional[float] = None,
        anomaly_threshold_score: Optional[float] = None,
    ):
        self.speed_drop_threshold = (
            speed_drop_threshold_knots if speed_drop_threshold_knots is not None
            else ais_cfg.SPEED_DROP_THRESHOLD_KNOTS
        )
        self.cog_turn_threshold = (
            cog_turn_threshold_deg if cog_turn_threshold_deg is not None
            else ais_cfg.COG_TURN_THRESHOLD_DEG
        )
        self.gap_threshold = (
            gap_threshold_minutes if gap_threshold_minutes is not None
            else ais_cfg.GAP_THRESHOLD_MINUTES
        )
        self.anomaly_threshold = (
            anomaly_threshold_score if anomaly_threshold_score is not None
            else ais_cfg.ANOMALY_SCORE_THRESHOLD
        )

    def evaluate_track(self, positions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluates a chronological sequence of AIS points for behavioral anomalies.
        Each item in `positions` should contain: ts, lat, lon, sog, cog, (optional heading).
        """
        if not positions or len(positions) < 2:
            return {
                "anomalous": False,
                "anomaly_score": 0.0,
                "anomaly_type": "NORMAL",
                "reasons": ["Insufficient historical AIS positions (< 2 points) to detect anomalous behavior."],
                "metrics": {"total_points": len(positions) if positions else 0},
                "gatekeeper_decision": "STOP_NORMAL_VESSEL",
            }

        # Ensure sorted by timestamp
        def parse_ts(p):
            t = p.get("ts") or p.get("timestamp")
            if isinstance(t, str):
                try:
                    return datetime.fromisoformat(t.replace("Z", "+00:00"))
                except Exception:
                    return datetime.now(timezone.utc)
            elif isinstance(t, datetime):
                return t
            return datetime.now(timezone.utc)

        sorted_pts = sorted(positions, key=parse_ts)

        max_speed_drop = 0.0
        max_speed_drop_context = None
        max_cog_delta = 0.0
        max_cog_context = None
        max_time_gap_min = 0.0
        max_gap_context = None
        drifting_points = 0
        total_intervals = len(sorted_pts) - 1

        speeds = [float(p.get("sog", 0.0) or 0.0) for p in sorted_pts]
        courses = [float(p.get("cog", 0.0) or 0.0) for p in sorted_pts]

        for i in range(total_intervals):
            p1 = sorted_pts[i]
            p2 = sorted_pts[i + 1]

            t1 = parse_ts(p1)
            t2 = parse_ts(p2)
            gap_min = max(0.0, (t2 - t1).total_seconds() / 60.0)
            if gap_min > max_time_gap_min:
                max_time_gap_min = gap_min
                max_gap_context = (t1, t2, gap_min)

            sog1 = float(p1.get("sog", 0.0) or 0.0)
            sog2 = float(p2.get("sog", 0.0) or 0.0)
            drop = sog1 - sog2
            if drop > max_speed_drop:
                max_speed_drop = drop
                max_speed_drop_context = (sog1, sog2, t2)

            cog1 = float(p1.get("cog", 0.0) or 0.0)
            cog2 = float(p2.get("cog", 0.0) or 0.0)
            turn = _angular_diff(cog1, cog2)
            if turn > max_cog_delta:
                max_cog_delta = turn
                max_cog_context = (cog1, cog2, turn)

            if sog2 < 1.5:
                drifting_points += 1

        reasons = []
        scores = []

        # 1. Sudden speed drop component (weight 0.40)
        speed_score = min(max_speed_drop / 12.0, 1.0)
        scores.append(speed_score * 0.40)
        if max_speed_drop >= self.speed_drop_threshold:
            s1, s2, ts_drop = max_speed_drop_context
            ts_str = ts_drop.strftime('%H:%M:%S UTC') if hasattr(ts_drop, 'strftime') else str(ts_drop)
            reasons.append(
                f"Abrupt deceleration of {max_speed_drop:.1f} kt detected (from {s1:.1f} kt down to {s2:.1f} kt) "
                f"at {ts_str}."
            )

        # 2. Erratic course deviation component (weight 0.30)
        cog_score = min(max_cog_delta / 90.0, 1.0)
        scores.append(cog_score * 0.30)
        if max_cog_delta >= self.cog_turn_threshold:
            c1, c2, diff_turn = max_cog_context
            reasons.append(
                f"Erratic course change of {diff_turn:.1f}° detected (heading shifted from {c1:.1f}° to {c2:.1f}°)."
            )

        # 3. Transponder silence / signal gap component (weight 0.30)
        gap_score = min(max_time_gap_min / 120.0, 1.0)
        scores.append(gap_score * 0.30)
        if max_time_gap_min >= self.gap_threshold:
            reasons.append(
                f"AIS transponder dark interval of {max_time_gap_min:.0f} minutes without location broadcast."
            )

        # 4. Loitering/Drift consideration
        drift_ratio = drifting_points / max(1, total_intervals)
        if drift_ratio > 0.4 and speeds[-1] < 2.0:
            reasons.append(
                f"Vessel exhibiting prolonged low-speed drift/loitering ({drift_ratio*100:.0f}% of track under 2.0 kt)."
            )

        # 5. Draft drop consideration (abrupt ballast or liquid discharge >= 1.5m)
        max_draft_drop = 0.0
        drafts = [float(p["draught"]) for p in sorted_pts if p.get("draught") is not None]
        if len(drafts) >= 2:
            for d1, d2 in zip(drafts[:-1], drafts[1:]):
                if d1 - d2 > max_draft_drop:
                    max_draft_drop = d1 - d2
            if max_draft_drop >= 1.5:
                reasons.append(
                    f"Substantial draft decrease of {max_draft_drop:.1f} m detected (potential liquid cargo/ballast discharge)."
                )
                scores.append(0.35)

        total_score = round(sum(scores), 3)

        # Determine anomaly flag and type
        is_anomalous = total_score >= self.anomaly_threshold or len(reasons) > 0

        if not is_anomalous:
            anomaly_type = "NORMAL"
            reasons = ["Track shows steady commercial navigation within normal navigational limits."]
            gatekeeper = "STOP_NORMAL_VESSEL"
        else:
            gatekeeper = "PROCEED_TO_SATELLITE"
            if max_draft_drop >= 1.5:
                anomaly_type = "DRAUGHT_CHANGE"
            elif speed_score >= max(cog_score, gap_score):
                anomaly_type = "SPEED_CHANGE"
            elif cog_score >= max(speed_score, gap_score):
                anomaly_type = "ERRATIC_COURSE"
            elif gap_score >= max(speed_score, cog_score):
                anomaly_type = "SIGNAL_GAP"
            else:
                anomaly_type = "LOITERING_DRIFT"

        return {
            "anomalous": is_anomalous,
            "anomaly_score": total_score,
            "anomaly_type": anomaly_type,
            "reasons": reasons,
            "metrics": {
                "total_positions": len(sorted_pts),
                "max_speed_drop_knots": round(max_speed_drop, 2),
                "max_cog_delta_deg": round(max_cog_delta, 1),
                "max_time_gap_minutes": round(max_time_gap_min, 1),
                "avg_speed_knots": round(sum(speeds) / len(speeds), 2) if speeds else 0.0,
                "latest_speed_knots": round(speeds[-1], 2) if speeds else 0.0,
                "max_draft_drop_m": round(max_draft_drop, 2),
            },
            "gatekeeper_decision": gatekeeper,
        }

    def evaluate_mmsi(self, mmsi: str, cur=None, hours: int = 24) -> Dict[str, Any]:
        """
        Loads AIS positions for given MMSI from database and evaluates behavior.
        """
        close_cur = False
        conn = None
        if cur is None:
            conn = get_connection()
            cur = conn.cursor()
            close_cur = True

        try:
            cur.execute("""
                SELECT ts, ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                       sog, cog, heading, status, ship_name, imo, draught, ship_type
                FROM ais_positions
                WHERE mmsi = %s
                ORDER BY ts ASC
            """, (str(mmsi),))
            rows = cur.fetchall()

            if not rows:
                # Check ais_anomalies table for recorded historical anomalies
                cur.execute("""
                    SELECT anomaly_type, anomaly_score, ts
                    FROM ais_anomalies
                    WHERE vessel_id = %s OR vessel_id = %s
                    ORDER BY ts DESC LIMIT 1
                """, (str(mmsi), f"MMSI_{mmsi}"))
                ano_row = cur.fetchone()
                if ano_row:
                    return {
                        "mmsi": str(mmsi),
                        "ship_name": f"Vessel {mmsi}",
                        "imo": None,
                        "ship_type": "Commercial Vessel",
                        "anomalous": True,
                        "anomaly_score": round(float(ano_row[1]), 2),
                        "anomaly_type": ano_row[0],
                        "reasons": [f"Historically registered anomaly: {ano_row[0]} with score {float(ano_row[1]):.2f}."],
                        "metrics": {"total_positions": 0},
                        "gatekeeper_decision": "PROCEED_TO_SATELLITE",
                    }
                return {
                    "mmsi": str(mmsi),
                    "ship_name": f"Vessel {mmsi}",
                    "imo": None,
                    "ship_type": "Commercial Vessel",
                    "anomalous": False,
                    "anomaly_score": 0.0,
                    "anomaly_type": "NORMAL",
                    "reasons": ["No AIS tracking positions available in database for this vessel."],
                    "metrics": {"total_positions": 0},
                    "gatekeeper_decision": "STOP_NORMAL_VESSEL",
                }

            positions = [
                {
                    "ts": r[0],
                    "lon": float(r[1]) if r[1] is not None else 0.0,
                    "lat": float(r[2]) if r[2] is not None else 0.0,
                    "sog": float(r[3] or 0.0),
                    "cog": float(r[4] or 0.0),
                    "heading": float(r[5]) if r[5] is not None else None,
                    "status": r[6],
                    "ship_name": r[7],
                    "imo": str(r[8]) if r[8] and str(r[8]) != "UNKNOWN" and not str(r[8]).startswith("IMO-") else None,
                    "draught": float(r[9]) if len(r) > 9 and r[9] is not None else None,
                    "ship_type": r[10] if len(r) > 10 and r[10] else "Commercial Vessel",
                }
                for r in rows
            ]

            result = self.evaluate_track(positions)
            last_row = rows[-1]
            raw_imo = last_row[8] if len(last_row) > 8 else None
            clean_imo = str(raw_imo) if raw_imo and str(raw_imo) != "UNKNOWN" and not str(raw_imo).startswith("IMO-") else None
            raw_type = last_row[10] if len(last_row) > 10 else None

            result["mmsi"] = str(mmsi)
            result["ship_name"] = last_row[7] or f"Vessel {mmsi}"
            result["imo"] = clean_imo
            result["ship_type"] = raw_type or "Commercial Vessel"
            result["latest_location"] = {
                "lat": float(last_row[2]) if last_row[2] is not None else 0.0,
                "lon": float(last_row[1]) if last_row[1] is not None else 0.0,
            }
            result["latest_timestamp"] = last_row[0].isoformat() if hasattr(last_row[0], "isoformat") else str(last_row[0])
            return result

        finally:
            if close_cur:
                cur.close()
                if conn:
                    conn.close()


def gatekeep_anomaly(mmsi: str, cur=None) -> Dict[str, Any]:
    """Convenience entry point for the AIS anomaly gatekeeper."""
    detector = AISBehaviorAnomalyDetector()
    return detector.evaluate_mmsi(mmsi, cur=cur)
