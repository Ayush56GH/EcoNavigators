"""
MarineTraffic AIS client — fetches vessel positions and normalizes them into
our internal shape.
Owner: Harsh (Backend / Integration Lead)

SETUP (run locally, not in this sandbox — no internet access here):
    pip install requests python-dotenv
    Create a .env file in the project root with:
        MARINETRAFFIC_API_KEY=your_real_key_here

Note: MarineTraffic's exact URL structure/params depend on which API service
your account is provisioned for. Adjust BASE_URL/params to match your plan's
documentation if this doesn't match what your dashboard shows.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


class MarineTrafficClient:

    BASE_URL = "http://services.marinetraffic.com/api/exportvessels"

    def __init__(self):
        self.api_key = os.getenv("MARINETRAFFIC_API_KEY")
        if not self.api_key:
            raise RuntimeError("MARINETRAFFIC_API_KEY not found in .env")

    def get_vessels(self, timespan=10, min_lat=None, max_lat=None, min_lon=None, max_lon=None):
        url = (
            f"{self.BASE_URL}/"
            f"{self.api_key}/"
            f"msgtype:extended/"
            f"timespan:{timespan}/"
            f"protocol:json"
        )

        params = {}
        if min_lat is not None:
            params["minlat"] = min_lat
        if max_lat is not None:
            params["maxlat"] = max_lat
        if min_lon is not None:
            params["minlon"] = min_lon
        if max_lon is not None:
            params["maxlon"] = max_lon

        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        return self.normalize_response(response.json())

    def normalize_response(self, data):
        if isinstance(data, dict):
            if "DATA" in data:
                data = data["DATA"]
            elif "data" in data:
                data = data["data"]
            else:
                data = [data]

        vessels = []
        for row in data:
            vessel = {
                "mmsi": row.get("MMSI"),
                "imo": row.get("IMO"),
                "ship_name": row.get("SHIPNAME"),
                "ship_type": row.get("SHIPTYPE"),
                "latitude": self.to_float(row.get("LAT")),
                "longitude": self.to_float(row.get("LON")),
                "sog": self.to_float(row.get("SPEED")),
                "cog": self.to_float(row.get("COURSE")),
                "heading": self.to_float(row.get("HEADING")),
                "status": self.to_int(row.get("STATUS")),
                "timestamp": row.get("TIMESTAMP"),
                "destination": row.get("DESTINATION"),
                "draught": self.to_float(row.get("DRAUGHT")),
                "source": "marinetraffic",
            }
            if vessel["mmsi"] is None or vessel["latitude"] is None or vessel["longitude"] is None:
                continue
            vessels.append(vessel)
        return vessels

    @staticmethod
    def to_float(value):
        try:
            if value in (None, "", "null"):
                return None
            return float(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def to_int(value):
        try:
            if value in (None, "", "null"):
                return None
            return int(float(value))
        except (ValueError, TypeError):
            return None