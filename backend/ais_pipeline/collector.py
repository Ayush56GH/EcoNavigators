"""
Polls MarineTraffic on an interval and saves raw vessel positions into our
PostgreSQL/PostGIS ais_positions table.
Owner: Harsh (Backend / Integration Lead)

Pipeline this feeds into:
    MarineTraffic --> ais_positions (this script)
                          |
                          v
              anomaly_detector.py (ML teammate)
                          |
                          v
                   ais_anomalies (fusion input)

Run locally (needs real internet access + a running Postgres):
    python collector.py
"""
import sys
import time
import os

from marine_traffic import MarineTrafficClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "db"))
from connection import get_connection

TIMESPAN_MINUTES = 10
POLL_INTERVAL_SECONDS = 120


def save_vessel(cur, vessel: dict) -> None:
    lat = vessel.get("latitude")
    lon = vessel.get("longitude")
    # Validate coordinates: reject Null Island and out-of-range coordinates
    if lat is None or lon is None:
        return
    try:
        f_lat = float(lat)
        f_lon = float(lon)
    except (ValueError, TypeError):
        return
    if abs(f_lat) < 1e-6 and abs(f_lon) < 1e-6:
        return
    if not (-90.0 <= f_lat <= 90.0) or not (-180.0 <= f_lon <= 180.0):
        return

    cur.execute("""
        INSERT INTO ais_positions
            (mmsi, imo, ship_name, ship_type, location, sog, cog, heading,
             status, ts, destination, draught, source)
        VALUES
            (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s,
             %s, to_timestamp(%s), %s, %s, %s)
        ON CONFLICT (mmsi, ts, location) DO NOTHING
    """, (
        vessel["mmsi"], vessel["imo"], vessel["ship_name"], vessel["ship_type"],
        f_lon, f_lat,  # lon, lat order for ST_MakePoint
        vessel.get("sog"), vessel.get("cog"), vessel.get("heading"),
        vessel.get("status"), vessel.get("timestamp"), vessel.get("destination"),
        vessel.get("draught"), vessel.get("source"),
    ))


def main():
    print("=" * 70)
    print("MARINETRAFFIC AIS COLLECTOR (PostgreSQL/PostGIS)")
    print("=" * 70)

    client = MarineTrafficClient()
    conn = get_connection()
    cur = conn.cursor()

    print("\nConnected to PostgreSQL database.")
    print("\nStarting AIS collection...\n")

    while True:
        try:
            vessels = client.get_vessels(timespan=TIMESPAN_MINUTES)
            print(f"Received {len(vessels)} vessels")

            for vessel in vessels:
                save_vessel(cur, vessel)
                print(
                    f"MMSI={vessel['mmsi']} | {vessel.get('ship_name')} | "
                    f"LAT={vessel['latitude']:.5f} | LON={vessel['longitude']:.5f} | "
                    f"SOG={vessel.get('sog')} | COG={vessel.get('cog')}"
                )

            conn.commit()
            print(f"\nSaved {len(vessels)} AIS records.")
            print(f"Waiting {POLL_INTERVAL_SECONDS} seconds...\n")
            time.sleep(POLL_INTERVAL_SECONDS)

        except KeyboardInterrupt:
            print("\nStopping collector...")
            conn.close()
            break

        except Exception as e:
            print(f"\nERROR: {e}")
            conn.rollback()  # undo any partial/broken insert before retrying
            print("Retrying in 30 seconds...")
            time.sleep(30)


if __name__ == "__main__":
    main()