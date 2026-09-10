from connection import get_connection
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")

def load_json(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)


def init_db():
    conn=get_connection()
    cur=conn.cursor()
    records = load_json("ais_anomalies.json")

    for record in records:
        cur.execute("""
            INSERT INTO ais_anomalies (vessel_id, imo, ts, location, anomaly_type, anomaly_score, sog, cog_delta)
            VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s)
            ON CONFLICT (vessel_id, ts, anomaly_type) DO NOTHING
        """, (
            record["vessel_id"], record["imo"], record["timestamp"],
            record["lon"], record["lat"],
            record["anomaly_type"], record["anomaly_score"], record["sog"], record["cog_delta"]
        ))

    conn.commit()
    conn.close()


def seed_sar_detections():
    conn=get_connection()
    cur=conn.cursor()
    records = load_json("sar_detections.json")
    for record in records:

        cur.execute("""
            INSERT INTO sar_detections(scene_id, acquisition_time, aoi_location, spill_probability)
            VALUES(%s,%s,ST_SetSRID(ST_MakePoint(%s, %s),4326),%s)
""",(
    record["scene_id"], record["acquisition_time"],
        record["aoi_lon"], record["aoi_lat"], record["spill_probability"],

))
    conn.commit()
    conn.close()


def seed_ais_positions():
    conn=get_connection()
    cur=conn.cursor()
    records = load_json("ais_positions.json")
    for record in records:

        cur.execute("""
            INSERT INTO ais_positions
                (mmsi, imo, ship_name, ship_type, location, sog, cog, heading,
                 status, ts, destination, draught, source)
            VALUES
                (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s,
                 %s, %s, %s, %s, %s)
            ON CONFLICT (mmsi, ts, location) DO NOTHING
""", (
    record["mmsi"], record["imo"], record["ship_name"], record["ship_type"],
    record["lon"], record["lat"],
    record["sog"], record["cog"], record["heading"],
    record["status"], record["timestamp"], record["destination"],
    record["draught"], record["source"],
))

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    seed_sar_detections()
    seed_ais_positions()