"""
Copernicus Satellite Imagery Service
=====================================
Fetches Sentinel-1 SAR and Sentinel-2 optical imagery from the
Copernicus Data Space Ecosystem (CDSE) Sentinel Hub Process API.

FIXES applied vs prior version
-------------------------------
* REMOVED: year-mutation bug (dt.replace(year=2024)).
  If Copernicus returns no data for the requested date, the caller
  receives NO_SATELLITE_ACQUISITION — never silently modified timestamps.
* Credentials read exclusively from environment — no hardcoded fallbacks.
* Temporal window is configurable and defaults to 24 h search window.
* Returns separate display JPEG and raw metadata.
"""

from __future__ import annotations

import os
import time
import math
import json
import base64
import logging
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ── Credentials — ONLY from environment, never hardcoded ─────────────────────
COPERNICUS_CLIENT_ID     = os.environ.get("COPERNICUS_CLIENT_ID", "")
COPERNICUS_CLIENT_SECRET = os.environ.get("COPERNICUS_CLIENT_SECRET", "")

if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
    logger.warning(
        "[Copernicus] COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET not set. "
        "Satellite fetch will fail. Set credentials in .env file."
    )

TOKEN_URL   = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"

# In-memory token cache
_cached_token:     Optional[str] = None
_token_expires_at: float = 0.0


# ── Authentication ────────────────────────────────────────────────────────────

def get_copernicus_token() -> str:
    global _cached_token, _token_expires_at

    if _cached_token and time.time() < (_token_expires_at - 60):
        return _cached_token

    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        raise RuntimeError(
            "Copernicus credentials not configured. "
            "Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in .env"
        )

    data = urllib.parse.urlencode({
        "client_id":     COPERNICUS_CLIENT_ID,
        "client_secret": COPERNICUS_CLIENT_SECRET,
        "grant_type":    "client_credentials",
    }).encode("utf-8")

    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body              = json.loads(resp.read().decode("utf-8"))
            _cached_token     = body["access_token"]
            expires_in        = body.get("expires_in", 1800)
            _token_expires_at = time.time() + expires_in
            logger.info("[Copernicus] Authenticated. Token valid %ds.", expires_in)
            return _cached_token
    except Exception as e:
        raise RuntimeError(f"Copernicus authentication failed: {e}") from e


# ── Geography ─────────────────────────────────────────────────────────────────

def calculate_bbox(lat: float, lon: float, buffer_km: float = 8.0) -> list:
    """Return [minLon, minLat, maxLon, maxLat] centered on (lat, lon)."""
    lat_delta = buffer_km / 111.0
    cos_lat   = math.cos(math.radians(lat))
    lon_delta = buffer_km / (111.0 * max(0.01, cos_lat))
    return [
        round(lon - lon_delta, 6),
        round(lat - lat_delta, 6),
        round(lon + lon_delta, 6),
        round(lat + lat_delta, 6),
    ]


# ── Timestamp handling ────────────────────────────────────────────────────────

def parse_timestamp(ts: Any) -> Optional[datetime]:
    """
    Parse a timestamp into a UTC-aware datetime.

    Returns None if the input cannot be parsed.

    NOTE: Timestamps are NEVER modified — no year mutation.
    If data is unavailable for the requested year, the caller
    receives NO_SATELLITE_ACQUISITION.
    """
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(ts, str):
        clean = ts.strip().replace("Z", "+00:00")
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(clean[:len(fmt) + 6], fmt)
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        try:
            dt = datetime.fromisoformat(clean)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    logger.warning("[Copernicus] Could not parse timestamp: %r", ts)
    return None


# ── Main fetch function ───────────────────────────────────────────────────────

def fetch_copernicus_satellite_image(
    lat: float,
    lon: float,
    timestamp: Any = None,
    satellite: str = "sentinel-1",
    buffer_km: float = 8.0,
    search_window_hours: int = 24,
    width: int = 512,
    height: int = 512,
) -> Dict[str, Any]:
    """
    Fetch satellite imagery from Copernicus Data Space.

    Parameters
    ----------
    lat, lon             : Coordinates of the anomalous vessel.
    timestamp            : AIS anomaly event time. Used as-is — NOT modified.
    satellite            : 'sentinel-1' (SAR) or 'sentinel-2' (optical).
    buffer_km            : Scene radius around vessel.
    search_window_hours  : Archive search window (±hours around timestamp).
                           Default 24 h.
    width, height        : Output image resolution in pixels.

    Returns
    -------
    dict with keys:
        success, satellite, satelliteType, center, bbox,
        timeRange, targetTimestamp, resolutionMetersPerPx,
        imageBase64, description, attribution
        Or raises RuntimeError with reason.

    Raises
    ------
    RuntimeError
        On HTTP error, authentication failure, or no data available.
        The message starts with "NO_SATELLITE_ACQUISITION:" when the
        Copernicus archive contains no data for the requested window —
        distinguishable from network/auth errors.
    """
    token = get_copernicus_token()
    bbox  = calculate_bbox(lat, lon, buffer_km)
    dt    = parse_timestamp(timestamp)

    # Build time window — search ± search_window_hours around the event
    if dt is not None:
        time_from = (dt - timedelta(hours=search_window_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        time_to   = (dt + timedelta(hours=search_window_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        target_ts_str = dt.isoformat()
    else:
        # No timestamp: search last 7 days
        now = datetime.now(tz=timezone.utc)
        time_from     = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        time_to       = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        target_ts_str = "UNKNOWN"

    is_sar = satellite.lower() in ("sentinel-1", "sar", "s1")

    if is_sar:
        sat_type = "sentinel-1-grd"
        sat_name = "Sentinel-1 SAR (Synthetic Aperture Radar)"
        desc = (
            "Radar backscatter. Oil films suppress capillary waves → dark areas. "
            "R=sqrt(VV), G=sqrt(VH)*2.5, B=VH/VV ratio."
        )
        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                },
                "data": [{
                    "type": sat_type,
                    "dataFilter": {
                        "timeRange":       {"from": time_from, "to": time_to},
                        "acquisitionMode": "IW",
                        "polarization":    "DV",
                    },
                }],
            },
            "output": {
                "width":     width,
                "height":    height,
                "responses": [{"identifier": "default", "format": {"type": "image/jpeg"}}],
            },
            "evalscript": """
            //VERSION=3
            function setup() {
                return { input: ["VV", "VH"], output: { bands: 3 } };
            }
            function evaluatePixel(s) {
                var vv    = Math.sqrt(Math.max(0, s.VV));
                var vh    = Math.sqrt(Math.max(0, s.VH)) * 2.5;
                var ratio = Math.min(1.0, vh / (vv + 0.001));
                return [
                    Math.min(1.0, vv * 2.2),
                    Math.min(1.0, vh * 2.5),
                    Math.min(1.0, ratio * 1.5)
                ];
            }
            """,
        }
    else:
        sat_type = "sentinel-2-l2a"
        sat_name = "Sentinel-2 Optical (MSI True Colour)"
        desc = "True-colour B04/B03/B02 composite."
        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                },
                "data": [{
                    "type": sat_type,
                    "dataFilter": {
                        "timeRange":      {"from": time_from, "to": time_to},
                        "maxCloudCoverage": 50,
                    },
                }],
            },
            "output": {
                "width":     width,
                "height":    height,
                "responses": [{"identifier": "default", "format": {"type": "image/jpeg"}}],
            },
            "evalscript": """
            //VERSION=3
            function setup() { return { input:["B04","B03","B02"], output:{bands:3} }; }
            function evaluatePixel(s) {
                return [Math.min(1,s.B04*2.8), Math.min(1,s.B03*2.8), Math.min(1,s.B02*2.8)];
            }
            """,
        }

    req = urllib.request.Request(
        PROCESS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
            "Accept":        "image/jpeg",
        },
    )

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            img_bytes = resp.read()
            elapsed   = round(time.time() - t0, 2)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        logger.error("[Copernicus] HTTP %d: %s", e.code, body[:300])
        if e.code == 400 and ("no data" in body.lower() or "empty" in body.lower()):
            raise RuntimeError(
                f"NO_SATELLITE_ACQUISITION: No Sentinel-1 data available for "
                f"bbox={bbox} timeRange={time_from}..{time_to}"
            )
        raise RuntimeError(f"Copernicus API HTTP {e.code}: {body[:150]}")
    except Exception as e:
        raise RuntimeError(f"Satellite fetch failed: {e}") from e

    # Sanity check — empty response means no data
    if len(img_bytes) < 1000:
        raise RuntimeError(
            f"NO_SATELLITE_ACQUISITION: Response too small ({len(img_bytes)} bytes). "
            f"Likely no Sentinel-1 acquisition for bbox={bbox} window={time_from}..{time_to}"
        )

    b64_str   = base64.b64encode(img_bytes).decode("utf-8")
    data_uri  = f"data:image/jpeg;base64,{b64_str}"
    res_m     = round((buffer_km * 2000.0) / width, 1)

    logger.info(
        "[Copernicus] %s fetched in %.2fs — %d bytes, %.1f m/px",
        sat_name, elapsed, len(img_bytes), res_m,
    )

    return {
        "success":               True,
        "satellite":             sat_name,
        "satelliteType":         "SAR" if is_sar else "OPTICAL",
        "data_type":             "DISPLAY_JPEG",   # explicit: not calibrated raster
        "center":                [lat, lon],
        "bbox":                  bbox,
        "timeRange":             {"from": time_from, "to": time_to},
        "targetTimestamp":       target_ts_str,
        "acquisition_elapsed_s": elapsed,
        "resolutionMetersPerPx": res_m,
        "dimensions":            {"width": width, "height": height},
        "imageBase64":           data_uri,
        "description":           desc,
        "attribution":           "Copernicus Sentinel Data — ESA / European Commission",
    }
