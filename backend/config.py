"""
config.py — Centralized configuration for the oil-spill detection system.

All thresholds and tuneable parameters live here.
Values are read from environment variables with safe defaults so the
system works out-of-the-box in development and is fully configurable
in production without code changes.
"""

from __future__ import annotations
import os
from enum import Enum


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_str(key: str, default: str) -> str:
    return os.environ.get(key, default)


# ──────────────────────────────────────────────────────────────
# Pipeline States
# ──────────────────────────────────────────────────────────────

class PipelineState(str, Enum):
    """Ordered states of the oil-spill detection pipeline."""
    # Canonical identify and deferred SAR states
    AIS_ANOMALY             = "AIS_ANOMALY"
    AIS_NORMAL              = "AIS_NORMAL"
    SAR_DEFERRED            = "SAR_DEFERRED"
    PENDING_SAR             = "PENDING_SAR"
    LOADING                 = "LOADING"
    # AIS stage
    AIS_ANOMALY_DETECTED    = "AIS_ANOMALY_DETECTED"
    AIS_NORMAL_VESSEL       = "AIS_NORMAL_VESSEL"
    # SAR acquisition stage
    SAR_SEARCHING           = "SAR_SEARCHING"
    NO_SATELLITE_ACQUISITION = "NO_SATELLITE_ACQUISITION"  # no data for event time
    SAR_ACQUIRED            = "SAR_ACQUIRED"
    SAR_DISPLAY_APPROX      = "SAR_DISPLAY_APPROX"         # JPEG fallback used
    # SAR processing stage
    SAR_PROCESSING          = "SAR_PROCESSING"
    SLICK_DETECTED          = "SLICK_DETECTED"
    NO_SLICK_DETECTED       = "NO_SLICK_DETECTED"
    LOOKALIKE_REJECTED      = "LOOKALIKE_REJECTED"
    # Fusion stage
    TEMPORAL_MISMATCH       = "TEMPORAL_MISMATCH"
    SPATIAL_MISMATCH        = "SPATIAL_MISMATCH"
    FUSION_PROBABLE         = "FUSION_PROBABLE"
    FUSION_CONFIRMED        = "FUSION_CONFIRMED"
    # Terminal states
    INCONCLUSIVE            = "INCONCLUSIVE"
    ERROR                   = "ERROR"


# ──────────────────────────────────────────────────────────────
# AIS Anomaly Detection
# ──────────────────────────────────────────────────────────────

class AISConfig:
    SPEED_DROP_THRESHOLD_KNOTS: float   = _env_float("AIS_SPEED_DROP_THRESHOLD", 6.0)
    COG_TURN_THRESHOLD_DEG: float       = _env_float("AIS_COG_TURN_THRESHOLD", 40.0)
    GAP_THRESHOLD_MINUTES: float        = _env_float("AIS_GAP_THRESHOLD_MINUTES", 45.0)
    ANOMALY_SCORE_THRESHOLD: float      = _env_float("AIS_ANOMALY_SCORE_THRESHOLD", 0.35)
    DRIFT_SOG_THRESHOLD_KNOTS: float    = _env_float("AIS_DRIFT_SOG_THRESHOLD", 1.5)


# ──────────────────────────────────────────────────────────────
# SAR Satellite / Copernicus
# ──────────────────────────────────────────────────────────────

class SARConfig:
    # Archive search window (how far back/forward to search for a SAR pass)
    SEARCH_WINDOW_HOURS: int            = _env_int("SAR_SEARCH_WINDOW_HOURS", 24)

    # Temporal association window — SAR passes OUTSIDE this window are
    # INCONCLUSIVE regardless of spatial match
    ASSOCIATION_WINDOW_MINUTES: float   = _env_float("SAR_ASSOCIATION_WINDOW_MINUTES", 120.0)

    # Scene buffer around the anomaly position
    SCENE_BUFFER_KM: float              = _env_float("SAR_SCENE_BUFFER_KM", 8.0)

    # UNet segmentation threshold
    SEGMENTATION_THRESHOLD: float       = _env_float("SAR_SEGMENTATION_THRESHOLD", 0.45)
    POSITIVE_CONFIDENCE_THRESHOLD: float = _env_float("SAR_POSITIVE_CONFIDENCE_THRESHOLD", 0.60)

    # Slick geometry filters
    MIN_SLICK_AREA_PX: int              = _env_int("SAR_MIN_SLICK_AREA_PX", 50)
    MIN_SLICK_AREA_KM2: float           = _env_float("SAR_MIN_SLICK_AREA_KM2", 0.05)
    MAX_SLICK_AREA_KM2: float           = _env_float("SAR_MAX_SLICK_AREA_KM2", 5000.0)

    # Look-alike rejection
    LOOKALIKE_CONTRAST_MIN: float       = _env_float("SAR_LOOKALIKE_CONTRAST_MIN", 0.12)
    LOOKALIKE_ROUNDNESS_MAX_AREA: int   = _env_int("SAR_LOOKALIKE_ROUNDNESS_MAX_AREA", 4000)

    # Image resolution
    IMAGE_WIDTH: int                    = _env_int("SAR_IMAGE_WIDTH", 512)
    IMAGE_HEIGHT: int                   = _env_int("SAR_IMAGE_HEIGHT", 512)

    # ── Standalone MiT-B2 + U-Net Configuration ──
    STANDALONE_MODEL_PATH: str          = _env_str(
        "SAR_MODEL_PATH",
        os.path.join(os.path.dirname(__file__), "models", "mit_b2_unet_best.pth"),
    )
    SAR_THRESHOLD: float                = _env_float("SAR_THRESHOLD", 0.50)
    MIN_OIL_AREA_PERCENT: float         = _env_float("MIN_OIL_AREA_PERCENT", 0.50)
    SAR_MIN_REGION_PIXELS: int          = _env_int("SAR_MIN_REGION_PIXELS", 10)
    SAR_MAX_UPLOAD_BYTES: int           = _env_int("SAR_MAX_UPLOAD_BYTES", 25 * 1024 * 1024)


# ──────────────────────────────────────────────────────────────
# AIS + SAR Fusion
# ──────────────────────────────────────────────────────────────

class FusionConfig:
    # Maximum spatial distance for association (km)
    MAX_DISTANCE_KM: float              = _env_float("MAX_FUSION_DISTANCE_KM", 25.0)
    STRONG_DISTANCE_KM: float           = _env_float("MAX_FUSION_STRONG_DISTANCE_KM", 8.0)

    # Maximum temporal gap for CONFIRMED association (minutes)
    MAX_TIME_MINUTES: float             = _env_float("MAX_FUSION_TIME_MINUTES", 120.0)


# ──────────────────────────────────────────────────────────────
# API / CORS
# ──────────────────────────────────────────────────────────────

class APIConfig:
    # Comma-separated list of allowed CORS origins
    # Override in production: CORS_ALLOWED_ORIGINS=https://yourdomain.com
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in _env_str("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]


# ──────────────────────────────────────────────────────────────
# Convenience re-exports
# ──────────────────────────────────────────────────────────────

ais_cfg     = AISConfig()
sar_cfg     = SARConfig()
fusion_cfg  = FusionConfig()
api_cfg     = APIConfig()
