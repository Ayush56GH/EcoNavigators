"""
Tests for AIS + SAR spatial and temporal fusion.

CRITICAL requirements being tested:
  1. Temporal mismatch MUST return INCONCLUSIVE, never POSITIVE
  2. Spatial mismatch MUST return INCONCLUSIVE or NEGATIVE
  3. Both distance_km and time_difference_minutes are returned
  4. TEMPORAL_MISMATCH state returned when outside window
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta
import numpy as np
import pytest
from sar_pipeline.sar_unet_detector import SARUNetDetector, haversine_km


# ── Helper ────────────────────────────────────────────────────────────────────

def make_detector():
    return SARUNetDetector(
        model_path="NONEXISTENT_DO_NOT_LOAD",  # random weights (no .pt file)
        association_window_minutes=120.0,
        max_spatial_distance_km=25.0,
    )

def make_high_conf_slick(lat=25.77, lon=-80.15):
    """Simulate a high-confidence slick at a given geographic location."""
    return [{
        "label_id": 1,
        "area_px": 5000,
        "area_km2": 2.5,
        "perimeter_km": 8.2,
        "aspect_ratio": 4.2,
        "orientation_deg": 45.0,
        "damping_contrast_db": 7.5,
        "raw_model_probability": 0.82,
        "segmentation_confidence": 0.78,
        "lookalike_score": 0.05,
        "slick_type": "MINERAL_OIL_SLICK",
        "slick_centroid_px": {"x": 256, "y": 256},
        "slick_centroid_geo": {"lat": lat, "lon": lon},
        "slick_polygon_geojson": {
            "type": "Polygon",
            "coordinates": [[[lon-0.01, lat-0.01],[lon+0.01, lat-0.01],
                              [lon+0.01, lat+0.01],[lon-0.01, lat+0.01],
                              [lon-0.01, lat-0.01]]]
        },
        "age_estimation": {
            "estimated_age_hours": 3.5,
            "age_range_hours": [2.5, 4.8],
            "weathering_stage": "FRESH_DISCHARGE",
            "evaporation_fraction_pct": 20.0,
            "appearance_code": "Code 4",
            "emulsification_risk": "LOW",
        },
        "bbox_px": [200, 200, 312, 312],
    }]


BASE_LAT = 25.77
BASE_LON = -80.15
BASE_TS  = datetime(2026, 8, 20, 14, 35, 0, tzinfo=timezone.utc)


class TestTemporalFusion:

    def test_exact_match_can_be_positive(self):
        det = make_detector()
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(BASE_LAT, BASE_LON),
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS,  # exact match
            sat_available=True,
        )
        # With 0-min gap and nearby slick, should be POSITIVE
        assert result["verdict"] == "POSITIVE"
        assert result["time_difference_minutes"] == 0.0

    def test_30_min_gap_eligible(self):
        det = make_detector()
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(BASE_LAT, BASE_LON),
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS + timedelta(minutes=30),
            sat_available=True,
        )
        assert result["temporal_match"] == True
        assert result["time_difference_minutes"] == 30.0
        assert result["verdict"] in ("POSITIVE", "INCONCLUSIVE")

    def test_120_min_gap_at_boundary(self):
        det = make_detector()
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(BASE_LAT, BASE_LON),
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS + timedelta(minutes=120),
            sat_available=True,
        )
        assert result["temporal_match"] == True  # exactly at boundary = eligible
        assert result["time_difference_minutes"] == 120.0

    def test_121_min_gap_is_temporal_mismatch(self):
        """CRITICAL: 121 minutes MUST NOT produce POSITIVE."""
        det = make_detector()
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(BASE_LAT, BASE_LON),
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS + timedelta(minutes=121),
            sat_available=True,
        )
        assert result["verdict"] != "POSITIVE", (
            "TEMPORAL MISMATCH BUG: 121-min gap produced POSITIVE verdict"
        )
        assert result["temporal_match"] == False
        assert result["pipeline_state"] == "TEMPORAL_MISMATCH"

    def test_different_day_is_temporal_mismatch(self):
        """SAR from 3 days later MUST NEVER confirm a spill."""
        det = make_detector()
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(BASE_LAT, BASE_LON),
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS + timedelta(days=3),
            sat_available=True,
        )
        assert result["verdict"] != "POSITIVE"
        assert result["temporal_match"] == False
        assert result["time_difference_minutes"] == 3 * 24 * 60

    def test_no_satellite_returns_inconclusive(self):
        det = make_detector()
        result = det.associate_and_decide(
            slicks=[],
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=None,
            sat_available=False,
        )
        assert result["verdict"] == "INCONCLUSIVE"
        assert result["pipeline_state"] == "NO_SATELLITE_ACQUISITION"

    def test_empty_slicks_returns_negative(self):
        det = make_detector()
        result = det.associate_and_decide(
            slicks=[],
            vessel_mmsi="TEST_MMSI",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS,
            sat_available=True,
        )
        assert result["verdict"] == "NEGATIVE"
        assert result["slicks_detected"] == 0


class TestSpatialFusion:

    def test_nearby_slick_is_positive(self):
        det = make_detector()
        # Slick only 2 km from vessel
        slick_lat = BASE_LAT + 0.018  # ~2 km north
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(slick_lat, BASE_LON),
            vessel_mmsi="TEST",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS,
            sat_available=True,
        )
        assert result["distance_km"] < 5.0
        assert result["verdict"] == "POSITIVE"

    def test_distant_slick_not_confirmed(self):
        det = make_detector()
        # Slick 100 km away
        slick_lat = BASE_LAT + 0.9  # ~100 km
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(slick_lat, BASE_LON),
            vessel_mmsi="TEST",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS,
            sat_available=True,
        )
        assert result["verdict"] != "POSITIVE"
        assert result["spatial_match"] == False

    def test_vessel_and_slick_coords_are_separate_fields(self):
        """CRITICAL: vessel_location and slick_centroid must be separate fields."""
        det = make_detector()
        slick_lat = BASE_LAT + 0.018
        slick_lon = BASE_LON + 0.018
        result = det.associate_and_decide(
            slicks=make_high_conf_slick(slick_lat, slick_lon),
            vessel_mmsi="TEST",
            vessel_lat=BASE_LAT,
            vessel_lon=BASE_LON,
            vessel_ts=BASE_TS,
            sar_acq_ts=BASE_TS,
            sat_available=True,
        )
        assert "vessel_location" in result
        assert "slick_centroid" in result
        assert result["vessel_location"]["lat"] == BASE_LAT
        assert result["vessel_location"]["lon"] == BASE_LON
        assert result["slick_centroid"]["lat"] == slick_lat
        assert result["slick_centroid"]["lon"] == slick_lon
        # They MUST be different (this was the bug)
        assert result["vessel_location"] != result["slick_centroid"]


class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine_km(0, 0, 0, 0) == 0.0

    def test_equatorial_degree(self):
        # 1 degree of longitude at equator ≈ 111.32 km
        dist = haversine_km(0, 0, 0, 1)
        assert abs(dist - 111.32) < 1.0

    def test_symmetry(self):
        d1 = haversine_km(25.77, -80.15, 26.0, -80.0)
        d2 = haversine_km(26.0, -80.0, 25.77, -80.15)
        assert abs(d1 - d2) < 0.001
