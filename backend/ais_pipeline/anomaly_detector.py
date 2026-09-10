"""
AIS Anomaly Detection
Owner: ML Expert

Reads cleaned AIS track data and flags vessels showing distress-like behavior
using trained IsolationForest ML model.
Output matches docs/interface_contract.md -> ais_anomalies.json
"""
import os
import json
import joblib
import numpy as np
import pandas as pd

DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "ais_isolation_forest.pkl")


def load_ais_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["timestamp"])
    return df.sort_values(["mmsi", "timestamp"])


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["sog"] = df["sog"].fillna(0.0)
    df["cog"] = df["cog"].fillna(0.0)
    df["sog_delta"] = df.groupby("mmsi")["sog"].diff().abs().fillna(0.0)
    df["cog_delta"] = df.groupby("mmsi")["cog"].diff().abs().fillna(0.0)
    df["time_gap_min"] = (df.groupby("mmsi")["timestamp"].diff().dt.total_seconds() / 60.0).fillna(5.0)
    return df



def flag_anomalies(df: pd.DataFrame, model_path: str = DEFAULT_MODEL_PATH,
                   sog_delta_thresh=8.0, cog_delta_thresh=40.0, time_gap_thresh_min=60.0) -> pd.DataFrame:
    """
    Flags anomalies using trained Isolation Forest model.
    Falls back to heuristic thresholds if model artifact is unavailable.
    """
    df = df.copy()
    features = ["sog", "sog_delta", "cog_delta", "time_gap_min"]
    X = df[features].values

    if os.path.exists(model_path):
        try:
            model = joblib.load(model_path)
            # IsolationForest: -1 is anomaly, 1 is inlier
            preds = model.predict(X)
            df["is_anomaly"] = preds == -1

            # Continuous anomaly score: normalized from decision_function
            raw_scores = -model.decision_function(X)
            # Shift and scale to 0.0 - 1.0 range
            min_s, max_s = raw_scores.min(), raw_scores.max()
            denom = (max_s - min_s) if (max_s - min_s) > 1e-6 else 1.0
            norm_scores = (raw_scores - min_s) / denom
            df["anomaly_score"] = np.round(norm_scores, 2)
            print(f"[ML Anomaly Detector] Evaluated {len(df)} tracks with Isolation Forest. Found {df['is_anomaly'].sum()} anomalies.")
        except Exception as e:
            print(f"[ML Anomaly Detector] Warning: Failed to load IsolationForest ({e}), using heuristic fallback.")
            df["is_anomaly"] = (
                (df["sog_delta"] > sog_delta_thresh) |
                (df["cog_delta"] > cog_delta_thresh) |
                (df["time_gap_min"] > time_gap_thresh_min)
            )
            df["anomaly_score"] = np.clip(np.round((df["sog_delta"] / 20.0 + df["cog_delta"] / 90.0), 2), 0.0, 1.0)
    else:
        print("[ML Anomaly Detector] Model not found, using rule-based thresholding.")
        df["is_anomaly"] = (
            (df["sog_delta"] > sog_delta_thresh) |
            (df["cog_delta"] > cog_delta_thresh) |
            (df["time_gap_min"] > time_gap_thresh_min)
        )
        df["anomaly_score"] = np.clip(np.round((df["sog_delta"] / 20.0 + df["cog_delta"] / 90.0), 2), 0.0, 1.0)

    def label_type(row):
        if row["time_gap_min"] > time_gap_thresh_min:
            return "signal_gap"
        if row["sog_delta"] > sog_delta_thresh:
            return "sudden_speed_change"
        if row["cog_delta"] > cog_delta_thresh:
            return "erratic_course"
        return "behavioral_outlier"

    df["anomaly_type"] = df.apply(label_type, axis=1)
    return df[df["is_anomaly"]]


def export_alerts(df: pd.DataFrame, out_path: str) -> None:
    records = []
    for _, row in df.iterrows():
        records.append({
            "vessel_id": f"MMSI_{row['mmsi']}",
            "imo": row.get("imo", None),
            "timestamp": row["timestamp"].isoformat() if hasattr(row["timestamp"], "isoformat") else str(row["timestamp"]),
            "lat": row["lat"],
            "lon": row["lon"],
            "anomaly_type": row["anomaly_type"],
            "anomaly_score": float(row["anomaly_score"]),
            "sog": float(row["sog"]),
            "cog_delta": float(row["cog_delta"]),
        })
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(records, f, indent=2)
    print(f"Wrote {len(records)} anomaly records to {out_path}")


if __name__ == "__main__":
    sample_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "ais_sample.csv")
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "ais_anomalies.json")

    if os.path.exists(sample_path):
        raw = load_ais_data(sample_path)
        feats = compute_features(raw)
        anomalies = flag_anomalies(feats)
        export_alerts(anomalies, out_path)
    else:
        # Generate demo anomaly evaluation from database or synthetic track
        demo_tracks = pd.DataFrame([
            {"mmsi": "368091590", "imo": "9123456", "timestamp": "2026-08-20T14:30:00Z", "lat": 28.45, "lon": -89.12, "sog": 14.5, "cog": 180.0},
            {"mmsi": "368091590", "imo": "9123456", "timestamp": "2026-08-20T14:35:00Z", "lat": 28.45, "lon": -89.12, "sog": 1.2, "cog": 125.0},
            {"mmsi": "222222222", "imo": "9432810", "timestamp": "2026-08-20T15:00:00Z", "lat": 28.50, "lon": -89.05, "sog": 12.0, "cog": 90.0},
            {"mmsi": "222222222", "imo": "9432810", "timestamp": "2026-08-20T15:05:00Z", "lat": 28.50, "lon": -89.05, "sog": 11.8, "cog": 92.0},
        ])
        feats = compute_features(demo_tracks)
        anomalies = flag_anomalies(feats)
        export_alerts(anomalies, out_path)

