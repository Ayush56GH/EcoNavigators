"""
Vessel Source Attribution
Owner: Harsh (Backend / Integration Lead)

When a spill has multiple nearby candidate vessels, estimate which one most likely
caused it, expressed as a percentage per candidate.

Simplified (Tier 2) version: score by distance from each candidate vessel's last known
AIS position to the spill centroid, weighted by elapsed time and anomaly score.
Full drift-model version (live current/wind data) is Tier 3 roadmap.
"""

import os
import sys
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fusion.fusion_engine import haversine_km



def gaussian_likelihood(distance_km: float, sigma_km: float = 8.0) -> float:
    """Closer vessels score higher; sigma controls how quickly likelihood falls off."""
    return math.exp(-(distance_km ** 2) / (2 * sigma_km ** 2))


def score_candidates(spill: dict, candidate_vessels: list,
                      anomaly_weight: float = 0.5, sigma_km: float = 8.0) -> list:
    """
    spill: {"lat": .., "lon": .., "timestamp": ..}
    candidate_vessels: [{"vessel_id": .., "lat": .., "lon": .., "anomaly_score": ..}, ...]
    Returns list of {"vessel_id": .., "probability_pct": ..} summing to 100.
    """
    raw_scores = []
    for v in candidate_vessels:
        dist = haversine_km(spill["lat"], spill["lon"], v["lat"], v["lon"])
        spatial_likelihood = gaussian_likelihood(dist, sigma_km)
        anomaly_score = v.get("anomaly_score", 0.0)
        score = spatial_likelihood * (1 + anomaly_weight * anomaly_score)
        raw_scores.append((v["vessel_id"], score))

    total = sum(s for _, s in raw_scores) or 1e-9
    return [
        {"vessel_id": vid, "probability_pct": round(score / total * 100)}
        for vid, score in sorted(raw_scores, key=lambda x: x[1], reverse=True)
    ]


if __name__ == "__main__":
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "db"))
    from connection import get_connection

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT vessel_id, ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat, anomaly_score
        FROM ais_anomalies
        LIMIT 5
    """)
    rows = cur.fetchall()
    conn.close()

    candidates = [
        {"vessel_id": r[0], "lat": r[2], "lon": r[1], "anomaly_score": r[3]}
        for r in rows
    ]

    spill = {"lat": candidates[0]["lat"], "lon": candidates[0]["lon"], "timestamp": "now"} if candidates else None

    if spill:
        result = score_candidates(spill, candidates)
        print(result)
    else:
        print("No AIS anomalies found in the database yet.")