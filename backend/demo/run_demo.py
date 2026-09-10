"""
Offline Demo Pipeline — Maritime Oil Spill Detection
=====================================================
Runs the complete detection pipeline WITHOUT external API credentials.
Uses synthetic SAR data and simulated AIS anomaly.

Usage
-----
    python demo/run_demo.py

This demo is suitable for:
  - SIH/hackathon presentations
  - CI/CD testing without credentials
  - Local development without Copernicus subscription

NOTICE: All data in this demo is SYNTHETIC. Results are for demonstration
        only and do not represent real vessel incidents or oil spills.
"""
import sys
import os
import json
import tempfile
import numpy as np
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sar_pipeline.sar_preprocessor import SARPreprocessor
from sar_pipeline.unet_model import VanillaUNet, save_checkpoint
from sar_pipeline.sar_unet_detector import SARUNetDetector
from config import PipelineState


SEP = "=" * 65


def print_section(title):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def generate_synthetic_sar_scene(has_spill: bool = True):
    """
    Generate a synthetic SAR scene as a numpy array (H, W, 3).
    Simulates the Copernicus JPEG output (R=VV, G=VH, B=ratio).

    SYNTHETIC DATA — not real Sentinel-1.
    """
    rng = np.random.RandomState(42)
    size = 512

    # Ocean background
    scene = np.zeros((size, size, 3), dtype=np.float32)
    # VV channel (R): ocean ~60-100 pixel brightness
    scene[:, :, 0] = rng.normal(75, 12, (size, size))
    # VH channel (G): ocean ~50-85 pixel brightness
    scene[:, :, 1] = rng.normal(65, 10, (size, size))
    # Ratio (B)
    scene[:, :, 2] = scene[:, :, 1] / (scene[:, :, 0] + 1e-5) * 200

    if has_spill:
        # Add dark elongated ellipse simulating oil slick
        cy, cx = 280, 290
        ry, rx = 60, 150
        Y, X = np.mgrid[:size, :size]
        # Rotated ellipse
        angle = 0.3
        cos_a, sin_a = np.cos(angle), np.sin(angle)
        Xr = cos_a * (X - cx) + sin_a * (Y - cy)
        Yr = -sin_a * (X - cx) + cos_a * (Y - cy)
        oil_region = ((Xr / rx) ** 2 + (Yr / ry) ** 2) <= 1
        # Oil reduces backscatter
        scene[:, :, 0][oil_region] *= 0.38
        scene[:, :, 1][oil_region] *= 0.32

    scene = np.clip(scene, 0, 255)
    return scene.astype(np.uint8)


def run_demo():
    print_section("MARITIME OIL SPILL DETECTION — OFFLINE DEMO")
    print("  NOTICE: ALL DATA IS SYNTHETIC. NOT real vessel data or SAR imagery.")
    print(f"  Demo timestamp: {datetime.now(timezone.utc).isoformat()}")

    # ── 1. Simulated AIS anomaly ──────────────────────────────────────────────
    print_section("STAGE 1: Simulated AIS Anomaly Event")
    mmsi         = "DEMO_123456789"
    vessel_name  = "DEMO_VESSEL_ALPHA"
    vessel_lat   = 19.8500   # Arabian Sea / Gulf of Oman corridor
    vessel_lon   = 65.2300
    vessel_ts    = datetime(2026, 8, 20, 14, 35, 0, tzinfo=timezone.utc)

    print(f"  Vessel MMSI  : {mmsi}")
    print(f"  Vessel Name  : {vessel_name} [SYNTHETIC]")
    print(f"  Position     : lat={vessel_lat}, lon={vessel_lon}")
    print(f"  AIS timestamp: {vessel_ts.isoformat()}")
    print()
    print("  Anomaly indicators:")
    print("  - Speed drop: 12.3 kt -> 0.2 kt (drop=12.1 kt)  [SYNTHETIC]")
    print("  - COG change: 178 deg shift  [SYNTHETIC]")
    print("  - AIS gap: 95 minutes blackout  [SYNTHETIC]")
    print("  AIS anomaly score: 0.892")
    print("  => Gatekeeper: ANOMALOUS - proceeding to SAR analysis")

    # ── 2. Generate synthetic SAR scene ──────────────────────────────────────
    print_section("STAGE 2: Synthetic SAR Scene Generation")
    print("  [SYNTHETIC] Generating simulated Sentinel-1 dual-pol scene...")
    print("  (Real pipeline: fetch_copernicus_satellite_image() with credentials)")
    scene_rgb = generate_synthetic_sar_scene(has_spill=True)
    print(f"  Scene shape  : {scene_rgb.shape} (H, W, 3)  [SYNTHETIC]")
    print(f"  Channels     : R=VV-stretch, G=VH-stretch, B=VH/VV")
    print(f"  SAR timestamp: {vessel_ts.isoformat()} [SYNTHETIC - same as anomaly]")

    # Temporal check: synthetic SAR is 10 min after anomaly
    sar_ts = vessel_ts + timedelta(minutes=10)
    diff_min = abs((sar_ts - vessel_ts).total_seconds()) / 60
    print(f"  SAR acq time : {sar_ts.isoformat()} [SYNTHETIC]")
    print(f"  Time gap     : {diff_min:.0f} min (< 120 min threshold => ELIGIBLE)")

    # ── 3. Preprocessing ─────────────────────────────────────────────────────
    print_section("STAGE 3: SAR Preprocessing (SARPreprocessor v1)")
    prep = SARPreprocessor(target_size=512)
    tensor_arr = prep.preprocess_from_rgb_jpeg(scene_rgb.astype(np.float32))
    print(f"  Input shape  : {scene_rgb.shape}")
    print(f"  Output shape : {tensor_arr.shape}  (2-channel VV+VH)")
    print(f"  VV mean (norm): {tensor_arr[0].mean():.4f}")
    print(f"  VH mean (norm): {tensor_arr[1].mean():.4f}")
    print(f"  Preprocessing: {prep.VERSION}")
    print("  Normalization: dB-scale clipping (NO ImageNet normalization)")

    # ── 4. Model inference ───────────────────────────────────────────────────
    print_section("STAGE 4: VanillaUNet Inference")

    # Build and save a temp model with random weights for demo
    with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
        tmp_model_path = f.name

    demo_model = VanillaUNet(in_channels=2, base_features=32)
    save_checkpoint(demo_model, tmp_model_path)
    print(f"  Architecture : VanillaUNet (2-channel input, base_features=32)")
    print(f"  Weights      : RANDOM (demo only — not trained weights)")
    print(f"  Input tensor : (1, 2, 512, 512)")

    detector = SARUNetDetector(
        model_path=tmp_model_path,
        association_window_minutes=120.0,
        max_spatial_distance_km=25.0,
    )

    import torch
    tensor = torch.from_numpy(tensor_arr).unsqueeze(0)
    prob_map, mask = detector.segment(tensor)
    print(f"  Prob map max : {prob_map.max():.4f}")
    print(f"  Prob map mean: {prob_map.mean():.4f}")
    print(f"  Positive px  : {int(mask.sum())}")

    # ── 5. Slick extraction ──────────────────────────────────────────────────
    print_section("STAGE 5: Slick Extraction & Look-Alike Filtering")
    bbox = [vessel_lon - 0.08, vessel_lat - 0.08, vessel_lon + 0.08, vessel_lat + 0.08]
    slicks = detector.extract_slicks(prob_map, mask, pixel_res_meters=31.25, bbox=bbox)
    print(f"  Slicks found (post-filter): {len(slicks)}")
    if slicks:
        top = slicks[0]
        print(f"  Top slick:")
        print(f"    Area      : {top['area_km2']} km2")
        print(f"    Aspect    : {top['aspect_ratio']}")
        print(f"    Confidence: {top['segmentation_confidence']}")
        print(f"    Centroid  : lat={top['slick_centroid_geo']}")
        print(f"    Polygon   : {'valid' if top['slick_polygon_geojson'] else 'none'}")
    else:
        print("  No slicks passed look-alike filter (expected with random weights)")

    # ── 6. Fusion ────────────────────────────────────────────────────────────
    print_section("STAGE 6: AIS + SAR Spatial/Temporal Fusion")

    # Inject a synthetic high-confidence slick for demo
    demo_slicks = [{
        "area_km2": 3.2, "perimeter_km": 9.1, "aspect_ratio": 4.8,
        "orientation_deg": 38.0, "damping_contrast_db": 8.2,
        "raw_model_probability": 0.83, "segmentation_confidence": 0.76,
        "lookalike_score": 0.04, "slick_type": "MINERAL_OIL_SLICK",
        "slick_centroid_px": {"x": 290, "y": 280},
        "slick_centroid_geo": {"lat": vessel_lat + 0.02, "lon": vessel_lon + 0.02},
        "slick_polygon_geojson": {"type": "Polygon", "coordinates": [
            [[vessel_lon+0.01, vessel_lat+0.01],
             [vessel_lon+0.03, vessel_lat+0.01],
             [vessel_lon+0.03, vessel_lat+0.03],
             [vessel_lon+0.01, vessel_lat+0.03],
             [vessel_lon+0.01, vessel_lat+0.01]]
        ]},
        "age_estimation": {
            "estimated_age_hours": 2.8, "age_range_hours": [2.1, 3.8],
            "weathering_stage": "FRESH_DISCHARGE",
            "evaporation_fraction_pct": 18.5,
            "appearance_code": "Code 4: Continuous True Oil",
            "emulsification_risk": "LOW",
        },
        "bbox_px": [260, 250, 320, 310],
        "label_id": 1, "area_px": 6400,
    }]

    result = detector.associate_and_decide(
        slicks=demo_slicks,
        vessel_mmsi=mmsi,
        vessel_lat=vessel_lat,
        vessel_lon=vessel_lon,
        vessel_ts=vessel_ts,
        sar_acq_ts=sar_ts,
        sat_available=True,
        is_display_approx=True,
    )

    print(f"  Distance (vessel->slick): {result.get('distance_km', 'N/A')} km")
    print(f"  Time gap               : {result.get('time_difference_minutes', 'N/A')} min")
    print(f"  Spatial match          : {result.get('spatial_match')}")
    print(f"  Temporal match         : {result.get('temporal_match')}")
    print(f"  Pipeline state         : {result['pipeline_state']}")

    # ── 7. Final result ───────────────────────────────────────────────────────
    print_section("STAGE 7: Final Incident Report [SYNTHETIC DEMO]")
    print(f"  Vessel MMSI     : {mmsi}")
    print(f"  Vessel location : lat={vessel_lat}, lon={vessel_lon}")
    slick_c = result.get("slick_centroid") or {}
    print(f"  Slick centroid  : lat={slick_c.get('lat','N/A')}, lon={slick_c.get('lon','N/A')}")
    print(f"  VERDICT         : {result['verdict']}")
    print(f"  Confidence      : {result['confidence']}")
    print(f"  Pipeline state  : {result['pipeline_state']}")
    print(f"  Reason          : {result['reason']}")
    print()
    print("  [SYNTHETIC DEMO] Backtracking: Lagrangian drift simulation would run here.")
    print("  [SYNTHETIC DEMO] Risk assessment: coastal impact model would run here.")

    # ── Temporal mismatch demo ───────────────────────────────────────────────
    print_section("BONUS: Temporal Mismatch Demonstration")
    far_sar_ts = vessel_ts + timedelta(days=3)
    tmm = detector.associate_and_decide(
        slicks=demo_slicks,
        vessel_mmsi=mmsi,
        vessel_lat=vessel_lat,
        vessel_lon=vessel_lon,
        vessel_ts=vessel_ts,
        sar_acq_ts=far_sar_ts,
        sat_available=True,
    )
    print(f"  SAR timestamp  : {far_sar_ts.isoformat()} (3 days after anomaly)")
    print(f"  Time gap       : {tmm.get('time_difference_minutes')} min")
    print(f"  Verdict        : {tmm['verdict']} (MUST be INCONCLUSIVE)")
    print(f"  State          : {tmm['pipeline_state']} (MUST be TEMPORAL_MISMATCH)")
    assert tmm["verdict"] != "POSITIVE", "BUG: temporal mismatch produced POSITIVE!"
    assert tmm["pipeline_state"] == "TEMPORAL_MISMATCH"
    print("  PASS: Temporal mismatch correctly rejected")

    # Cleanup
    try:
        os.unlink(tmp_model_path)
    except Exception:
        pass

    print_section("DEMO COMPLETE")
    print("  All stages executed successfully.")
    print("  System is ready for real credentials and deployment.")
    print()
    print("  To run with real Copernicus data:")
    print("  1. Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in .env")
    print("  2. Restart the FastAPI server")
    print("  3. POST /api/v1/oil-spill/analyze with a real vessel MMSI")


if __name__ == "__main__":
    run_demo()
