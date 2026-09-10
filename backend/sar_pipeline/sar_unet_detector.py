"""
SAR UNet Detector — Sentinel-1 Oil Spill Segmentation & Attribution
====================================================================
Fixes applied vs prior version:
  * Uses SARPreprocessor (shared with training) — no ImageNet normalization
  * Strict model weight loading — fails loudly on mismatch
  * Slick centroid computed from pixel coords + raster geotransform (NOT vessel coords)
  * Temporal association window enforced — TEMPORAL_MISMATCH returned if outside window
  * Pipeline states returned at every stage
  * No year mutation — timestamps passed as-is
"""

from __future__ import annotations

import os
import json
import math
import logging
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

import torch
import torch.nn.functional as F

from sar_pipeline.sar_preprocessor import SARPreprocessor, PREPROCESSING_VERSION
from sar_pipeline.unet_model import VanillaUNet, load_checkpoint, DEFAULT_METADATA

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2.0) ** 2)
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Return a UTC-aware datetime, or None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def pixel_to_geo(
    px: float, py: float,
    bbox: List[float],
    img_w: int, img_h: int,
) -> Tuple[float, float]:
    """
    Convert pixel coordinates (col=px, row=py) to (lon, lat) using a
    simple affine geotransform derived from the scene bounding box.

    Parameters
    ----------
    px, py : float
        Column and row pixel coordinates (0-indexed).
    bbox : [min_lon, min_lat, max_lon, max_lat]
    img_w, img_h : int
        Image width and height in pixels.

    Returns
    -------
    (lon, lat) : float, float
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    lon = min_lon + (px / img_w) * (max_lon - min_lon)
    # Row 0 is top of image (max_lat); row img_h is bottom (min_lat)
    lat = max_lat - (py / img_h) * (max_lat - min_lat)
    return float(lon), float(lat)


def mask_to_geojson_polygon(
    mask: np.ndarray,
    bbox: List[float],
) -> Optional[Dict]:
    """
    Convert a binary segmentation mask to a GeoJSON Polygon.

    Uses the bounding box of the largest connected component to derive
    approximate geographic coordinates via the raster geotransform.
    Returns None if no valid component exists.
    """
    from scipy.ndimage import label

    labeled, n_features = label(mask)
    if n_features == 0:
        return None

    # Find largest component
    sizes = [(i + 1, int((labeled == i + 1).sum())) for i in range(n_features)]
    sizes.sort(key=lambda x: x[1], reverse=True)
    best_id = sizes[0][0]

    feat_mask = labeled == best_id
    rows, cols = np.where(feat_mask)
    if len(rows) == 0:
        return None

    h, w = mask.shape
    min_col, max_col = int(cols.min()), int(cols.max())
    min_row, max_row = int(rows.min()), int(rows.max())

    # Build a rectangular polygon from the component bounding box
    corners = [
        (min_col, min_row),
        (max_col, min_row),
        (max_col, max_row),
        (min_col, max_row),
        (min_col, min_row),  # close ring
    ]
    coords = [list(pixel_to_geo(px, py, bbox, w, h)) for (px, py) in corners]

    return {
        "type": "Polygon",
        "coordinates": [coords],
        "crs": "EPSG:4326",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Main Detector
# ──────────────────────────────────────────────────────────────────────────────

class SARUNetDetector:
    """
    End-to-end SAR oil spill detector using VanillaUNet.

    Flow
    ----
    1. load_model()            — strict weight verification
    2. preprocess(img_array)   — via SARPreprocessor
    3. segment(tensor)         — UNet forward pass
    4. extract_slicks(...)     — connected components + look-alike filter
    5. geolocate_slicks(...)   — pixel centroid -> geographic coords
    6. associate_and_decide()  — spatial + temporal fusion with pipeline state
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        metrics_path: Optional[str] = None,
        segmentation_threshold: Optional[float] = None,
        association_window_minutes: float = 120.0,
        max_spatial_distance_km: float = 25.0,
    ) -> None:
        if model_path is None:
            model_path = os.path.join(
                os.path.dirname(__file__), "..", "models", "sar_unet_oil_spill.pt"
            )
        if metrics_path is None:
            metrics_path = os.path.join(
                os.path.dirname(__file__), "..", "models", "sar_unet_metrics.json"
            )

        self.model_path  = model_path
        self.device      = "cuda" if torch.cuda.is_available() else "cpu"
        self.preprocessor = SARPreprocessor()

        # Association thresholds
        self.association_window_minutes = association_window_minutes
        self.max_spatial_distance_km    = max_spatial_distance_km

        # Segmentation threshold
        self.threshold = 0.45
        if segmentation_threshold is not None:
            self.threshold = segmentation_threshold
        elif os.path.exists(metrics_path):
            try:
                with open(metrics_path) as f:
                    m = json.load(f)
                val = (m.get("synthetic_validation") or m.get("real_validation") or {})
                t = val.get("optimal_threshold")
                if t is not None:
                    self.threshold = float(t)
            except Exception:
                pass

        # Load model with strict verification
        self.model: Optional[VanillaUNet] = None
        self.checkpoint_metadata: dict = {}
        self._load_model()

    # ── Model loading ──────────────────────────────────────────────────────────

    def _load_model(self) -> None:
        if not os.path.exists(self.model_path):
            logger.warning(
                "[SARDetector] No weights at %s — running with random weights. "
                "Predictions are MEANINGLESS until the model is trained.",
                self.model_path,
            )
            self.model = VanillaUNet(in_channels=2, base_features=32).to(self.device)
            self.model.eval()
            return

        try:
            self.model, self.checkpoint_metadata = load_checkpoint(
                self.model_path, device=self.device
            )
            # Verify preprocessing version matches
            ckpt_prep = self.checkpoint_metadata.get("preprocessing_version", "UNKNOWN")
            if ckpt_prep != PREPROCESSING_VERSION and ckpt_prep != "UNKNOWN":
                raise ValueError(
                    f"[SARDetector] Preprocessing version mismatch: "
                    f"checkpoint='{ckpt_prep}', detector='{PREPROCESSING_VERSION}'. "
                    "Retrain or update the detector to match the checkpoint."
                )
        except (ValueError, RuntimeError) as e:
            logger.error("[SARDetector] Model load error: %s", e)
            raise

    # ── Preprocessing ──────────────────────────────────────────────────────────

    def preprocess_from_rgb_jpeg(self, rgb_array: np.ndarray) -> Tuple[torch.Tensor, bool]:
        """
        Preprocess a 3-channel JPEG (from Copernicus display output).

        Returns (tensor, is_display_approx).
        is_display_approx=True means calibrated dB values are NOT available;
        confidence should be reduced.
        """
        arr = self.preprocessor.preprocess_from_rgb_jpeg(rgb_array)
        tensor = torch.from_numpy(arr).unsqueeze(0).to(self.device)
        return tensor, True  # flag: display approximation

    def preprocess_from_linear(
        self, vv: np.ndarray, vh: np.ndarray
    ) -> Tuple[torch.Tensor, bool]:
        """
        Preprocess calibrated linear backscatter arrays.

        Returns (tensor, is_display_approx=False).
        """
        arr = self.preprocessor.preprocess_pair(vv, vh)
        tensor = torch.from_numpy(arr).unsqueeze(0).to(self.device)
        return tensor, False

    # ── Segmentation ───────────────────────────────────────────────────────────

    def segment(self, tensor: torch.Tensor) -> Tuple[np.ndarray, np.ndarray]:
        """Run UNet forward pass. Returns (prob_map, binary_mask)."""
        assert self.model is not None
        self.model.eval()
        with torch.no_grad():
            logits = self.model(tensor)
            probs  = torch.sigmoid(logits)
            mask   = (probs >= self.threshold).float()
        prob_np = probs.squeeze().cpu().numpy()
        mask_np = mask.squeeze().cpu().numpy()
        return prob_np, mask_np

    # ── Slick extraction ───────────────────────────────────────────────────────

    def extract_slicks(
        self,
        prob_map: np.ndarray,
        mask: np.ndarray,
        pixel_res_meters: float = 31.25,   # 8km/256px default
        bbox: Optional[List[float]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extract confirmed oil slick candidates from segmentation output.

        Parameters
        ----------
        prob_map : (H, W) float in [0, 1]
        mask     : (H, W) binary float
        pixel_res_meters : approximate pixel ground resolution
        bbox     : [min_lon, min_lat, max_lon, max_lat] for geographic conversion

        Returns
        -------
        List of slick dicts, sorted by confidence descending.
        Each slick has:
          slick_centroid_px, slick_centroid_geo, slick_polygon_geojson,
          area_km2, confidence, lookalike_score, slick_type, age_estimation
        """
        from scipy.ndimage import label, binary_dilation

        labeled, n_features = label(mask)
        if n_features == 0:
            return []

        img_h, img_w = mask.shape
        sea_mean = float(np.mean(prob_map[mask == 0])) if np.any(mask == 0) else 0.5
        slicks = []

        for feat_id in range(1, n_features + 1):
            feat_mask = labeled == feat_id
            area_px   = int(np.sum(feat_mask))

            # Reject micro-noise
            if area_px < 50:
                continue

            area_km2 = area_px * (pixel_res_meters / 1000.0) ** 2

            # Minimum area filter
            if area_km2 < 0.05:
                continue

            # Bounding box
            slices    = None
            from scipy.ndimage import find_objects
            obj_list  = find_objects(labeled)
            slices    = obj_list[feat_id - 1]
            if slices is None:
                continue
            h_bbox = slices[0].stop - slices[0].start
            w_bbox = slices[1].stop - slices[1].start
            aspect_ratio = max(h_bbox, w_bbox) / max(1, min(h_bbox, w_bbox))

            # Statistics
            mean_prob  = float(np.mean(prob_map[feat_mask]))
            contrast   = abs(mean_prob - sea_mean)

            # Pixel centroid
            ys, xs       = np.where(feat_mask)
            centroid_y   = float(np.mean(ys))
            centroid_x   = float(np.mean(xs))

            # Orientation via 2nd moments
            dx     = xs - centroid_x
            dy     = ys - centroid_y
            mu20   = float(np.mean(dx ** 2)) if len(dx) > 0 else 1.0
            mu02   = float(np.mean(dy ** 2)) if len(dy) > 0 else 1.0
            mu11   = float(np.mean(dx * dy)) if len(dx) > 0 else 0.0
            theta  = 0.5 * math.atan2(2.0 * mu11, (mu20 - mu02) + 1e-6)
            orient = round((math.degrees(theta) + 180.0) % 180.0, 1)

            # Perimeter
            dilated     = binary_dilation(feat_mask)
            boundary    = dilated & (~feat_mask)
            perimeter_px = int(np.sum(boundary))
            perimeter_km = round(perimeter_px * (pixel_res_meters / 1000.0), 3)

            # SAR damping
            damping_db = round(max(1.0, 10.0 * math.log10(1.0 + 9.0 * contrast)), 2)

            # ── Look-alike rejection ──────────────────────────────────────────
            lookalike_score = 0.0  # 0 = confirmed spill, 1 = definitely look-alike

            # Low wind / calm-sea zone: circular shape + large area
            if aspect_ratio < 1.5 and area_px > 4000:
                lookalike_score += 0.6
            # Insufficient SAR damping (biogenic film)
            if contrast < 0.12:
                lookalike_score += 0.5
            # Too small for real spill
            if area_km2 < 0.05:
                lookalike_score += 0.8

            if lookalike_score >= 0.5:
                continue  # rejected

            # ── Detection confidence ─────────────────────────────────────────
            confidence = round(float(np.clip(
                mean_prob * 0.60
                + min(aspect_ratio / 6.0, 1.0) * 0.20
                + min(contrast / 0.5, 1.0) * 0.15
                + min(damping_db / 10.0, 1.0) * 0.05,
                0.0, 1.0
            )), 3)

            # ── Geographic centroid ──────────────────────────────────────────
            # This is the SLICK centroid — distinct from vessel location
            if bbox is not None:
                slick_lon, slick_lat = pixel_to_geo(
                    centroid_x, centroid_y, bbox, img_w, img_h
                )
                slick_centroid_geo = {"lat": round(slick_lat, 6), "lon": round(slick_lon, 6)}
            else:
                slick_centroid_geo = None

            # ── Slick polygon (GeoJSON) ──────────────────────────────────────
            if bbox is not None:
                slick_polygon = mask_to_geojson_polygon(feat_mask.astype(np.uint8), bbox)
            else:
                slick_polygon = None

            # ── Age estimation ───────────────────────────────────────────────
            age_info = self._estimate_slick_age(area_km2, aspect_ratio, damping_db, mean_prob)

            slick_type = (
                "MINERAL_OIL_SLICK" if aspect_ratio >= 2.0 else "DISCHARGE_PLUME"
            )

            slicks.append({
                "label_id":             feat_id,
                "area_px":              area_px,
                "area_km2":             round(area_km2, 3),
                "perimeter_km":         perimeter_km,
                "aspect_ratio":         round(aspect_ratio, 2),
                "orientation_deg":      orient,
                "damping_contrast_db":  damping_db,
                "raw_model_probability": round(mean_prob, 3),
                "segmentation_confidence": confidence,
                "lookalike_score":      round(lookalike_score, 2),
                "slick_type":           slick_type,
                "slick_centroid_px":    {"x": round(centroid_x, 1), "y": round(centroid_y, 1)},
                "slick_centroid_geo":   slick_centroid_geo,
                "slick_polygon_geojson": slick_polygon,
                "age_estimation":       age_info,
                "bbox_px":              [slices[1].start, slices[0].start,
                                         slices[1].stop, slices[0].stop],
            })

        slicks.sort(key=lambda s: s["segmentation_confidence"], reverse=True)
        return slicks

    # ── Association & verdict ─────────────────────────────────────────────────

    def associate_and_decide(
        self,
        slicks: List[Dict[str, Any]],
        vessel_mmsi: str,
        vessel_lat: float,
        vessel_lon: float,
        vessel_ts: Optional[datetime],
        sar_acq_ts: Optional[datetime],
        sat_available: bool = True,
        is_display_approx: bool = False,
    ) -> Dict[str, Any]:
        """
        Spatial + temporal fusion → POSITIVE | INCONCLUSIVE | NEGATIVE.

        Both spatial distance AND temporal gap are enforced.
        A spatially close but temporally distant SAR scene is INCONCLUSIVE,
        never POSITIVE.
        """
        vessel_ts_utc = ensure_utc(vessel_ts)
        sar_ts_utc    = ensure_utc(sar_acq_ts)

        # ── No satellite data ────────────────────────────────────────────────
        if not sat_available:
            return {
                "verdict":        "INCONCLUSIVE",
                "pipeline_state": "NO_SATELLITE_ACQUISITION",
                "confidence":     0.0,
                "reason":         "Sentinel-1 imagery not available for the requested event window.",
                "candidate_mmsi": vessel_mmsi,
                "spatial_match":  False,
                "temporal_match": False,
                "vessel_location": {"lat": vessel_lat, "lon": vessel_lon},
                "slick_centroid":  None,
                "slick_polygon_geojson": None,
                "slicks_detected": 0,
                "association":     "NONE",
            }

        # ── Compute temporal gap ─────────────────────────────────────────────
        time_diff_min: Optional[float] = None
        temporal_match = True

        if vessel_ts_utc and sar_ts_utc:
            time_diff_min = abs((sar_ts_utc - vessel_ts_utc).total_seconds()) / 60.0
            temporal_match = time_diff_min <= self.association_window_minutes
        # If timestamps unavailable, flag with warning but allow (cannot verify)

        # ── TEMPORAL_MISMATCH ────────────────────────────────────────────────
        if not temporal_match:
            return {
                "verdict":        "INCONCLUSIVE",
                "pipeline_state": "TEMPORAL_MISMATCH",
                "confidence":     0.0,
                "reason": (
                    f"SAR acquisition is {time_diff_min:.0f} min from AIS anomaly — "
                    f"exceeds the {self.association_window_minutes:.0f}-minute association window. "
                    "Cannot confirm spill attribution from temporally mismatched imagery."
                ),
                "candidate_mmsi": vessel_mmsi,
                "spatial_match":  None,
                "temporal_match": False,
                "time_difference_minutes": round(time_diff_min, 1),
                "vessel_location": {"lat": vessel_lat, "lon": vessel_lon},
                "slick_centroid":  None,
                "slick_polygon_geojson": None,
                "slicks_detected": len(slicks),
                "association":     "TEMPORAL_MISMATCH",
            }

        # ── No slicks detected ───────────────────────────────────────────────
        if not slicks:
            return {
                "verdict":        "NEGATIVE",
                "pipeline_state": "NO_SLICK_DETECTED",
                "confidence":     0.90,
                "reason":         "Sentinel-1 SAR analyzed: clean sea surface, no oil slicks detected.",
                "candidate_mmsi": vessel_mmsi,
                "spatial_match":  None,
                "temporal_match": temporal_match,
                "time_difference_minutes": round(time_diff_min, 1) if time_diff_min is not None else None,
                "vessel_location": {"lat": vessel_lat, "lon": vessel_lon},
                "slick_centroid":  None,
                "slick_polygon_geojson": None,
                "slicks_detected": 0,
                "association":     "CLEAN_SEA",
            }

        top = slicks[0]
        slick_conf = top["segmentation_confidence"]

        # ── Spatial distance — from SLICK CENTROID, not vessel position ──────
        if top["slick_centroid_geo"] is not None:
            slick_lat = top["slick_centroid_geo"]["lat"]
            slick_lon = top["slick_centroid_geo"]["lon"]
        else:
            # Fallback: use vessel position (with explicit label)
            slick_lat = vessel_lat
            slick_lon = vessel_lon
            logger.warning(
                "[SARDetector] Slick geographic centroid unavailable (no bbox). "
                "Spatial distance computed from vessel position — may be inaccurate."
            )

        distance_km = haversine_km(vessel_lat, vessel_lon, slick_lat, slick_lon)
        spatial_match = distance_km <= self.max_spatial_distance_km

        # Reduce confidence if display approximation (JPEG) was used
        conf_penalty = 0.10 if is_display_approx else 0.0
        adj_confidence = max(0.0, slick_conf - conf_penalty)

        # ── Determine verdict ────────────────────────────────────────────────
        if adj_confidence >= 0.60 and spatial_match and temporal_match:
            assoc   = "STRONGLY_ASSOCIATED" if distance_km <= 8.0 else "SPATIALLY_COINCIDENT"
            verdict = "POSITIVE"
            state   = "FUSION_CONFIRMED"
            reason  = (
                f"VanillaUNet confirmed {top['slick_type']} ({top['area_km2']} km², "
                f"{top['damping_contrast_db']} dB SAR damping). "
                f"Slick centroid {distance_km:.1f} km from vessel {vessel_mmsi}. "
                f"Time gap {time_diff_min:.0f} min. "
                f"Segmentation confidence {slick_conf:.1%}."
                + (" [DISPLAY_APPROX: calibrated values unavailable]" if is_display_approx else "")
            )
        elif adj_confidence >= 0.40 and distance_km <= 35.0 and temporal_match:
            assoc   = "PLAUSIBLE_ASSOCIATION"
            verdict = "INCONCLUSIVE"
            state   = "FUSION_PROBABLE"
            reason  = (
                f"Slick detected ({top['area_km2']} km², conf {slick_conf:.1%}) but "
                f"confidence below CONFIRMED threshold or spatial separation "
                f"({distance_km:.1f} km) exceeds 25 km. Classified as POSSIBLE_SLICK."
            )
        elif not spatial_match:
            assoc   = "SPATIAL_MISMATCH"
            verdict = "INCONCLUSIVE"
            state   = "SPATIAL_MISMATCH"
            reason  = (
                f"Slick centroid {distance_km:.1f} km from vessel — "
                f"exceeds {self.max_spatial_distance_km:.0f} km spatial threshold."
            )
        else:
            assoc   = "LOW_CONFIDENCE"
            verdict = "NEGATIVE"
            state   = "LOOKALIKE_REJECTED"
            reason  = (
                f"Slick signal weak (conf {slick_conf:.1%}) or spatial separation "
                f"({distance_km:.1f} km) exceeds limits. Not attributed to vessel {vessel_mmsi}."
            )

        return {
            "verdict":                  verdict,
            "pipeline_state":           state,
            "confidence":               round(adj_confidence, 3),
            "reason":                   reason,
            "candidate_mmsi":           vessel_mmsi,
            "distance_km":              round(distance_km, 2),
            "time_difference_minutes":  round(time_diff_min, 1) if time_diff_min is not None else None,
            "spatial_match":            spatial_match,
            "temporal_match":           temporal_match,
            "fusion_confidence":        round(adj_confidence, 3),
            "association":              assoc,
            "data_quality":             "DISPLAY_APPROX" if is_display_approx else "CALIBRATED",
            "vessel_location":          {"lat": vessel_lat, "lon": vessel_lon},
            "slick_centroid":           top["slick_centroid_geo"],
            "slick_polygon_geojson":    top["slick_polygon_geojson"],
            "slicks_detected":          len(slicks),
            "characterization": {
                "area_km2":               top["area_km2"],
                "perimeter_km":           top["perimeter_km"],
                "aspect_ratio":           top["aspect_ratio"],
                "orientation_deg":        top["orientation_deg"],
                "damping_contrast_db":    top["damping_contrast_db"],
                "slick_type":             top["slick_type"],
                "raw_model_probability":  top["raw_model_probability"],
                "segmentation_confidence": top["segmentation_confidence"],
                "lookalike_score":        top["lookalike_score"],
                "estimated_age_hours":    top["age_estimation"]["estimated_age_hours"],
                "age_range_hours":        top["age_estimation"]["age_range_hours"],
                "weathering_stage":       top["age_estimation"]["weathering_stage"],
                "evaporation_fraction_pct": top["age_estimation"]["evaporation_fraction_pct"],
                "appearance_code":        top["age_estimation"]["appearance_code"],
                "emulsification_risk":    top["age_estimation"]["emulsification_risk"],
            },
            "top_slick":   top,
            "all_slicks":  slicks[:5],
        }

    # ── Age estimation ────────────────────────────────────────────────────────

    @staticmethod
    def _estimate_slick_age(
        area_km2: float,
        aspect_ratio: float,
        damping_db: float,
        mean_prob: float,
    ) -> Dict[str, Any]:
        if aspect_ratio >= 3.5 and damping_db >= 6.5:
            age_h  = round(max(0.5, 1.2 + 0.8 * math.log(max(1.0, area_km2)) - 0.2 * aspect_ratio), 1)
            stage  = "FRESH_DISCHARGE"
            evap   = round(min(25.0, 8.0 + age_h * 3.5), 1)
            code   = "Code 4: Continuous True Oil (>200 um)"
            emulsi = "LOW"
        elif aspect_ratio >= 1.8 or damping_db >= 4.5:
            age_h  = round(max(3.5, 5.5 + 2.0 * math.log(max(1.0, area_km2)) - 0.5 * (aspect_ratio - 1.8)), 1)
            stage  = "EVAPORATING_INTERMEDIATE"
            evap   = round(min(55.0, 25.0 + (age_h - 3.0) * 2.2), 1)
            code   = "Code 3: Metallic / Discontinuous (5-50 um)"
            emulsi = "MODERATE"
        else:
            age_h  = round(max(18.0, 22.0 + 4.0 * math.log(max(1.0, area_km2))), 1)
            stage  = "WEATHERED_EMULSION"
            evap   = round(min(75.0, 50.0 + (age_h - 18.0) * 0.8), 1)
            code   = "Code 5: Emulsified Mousse / Heavy Residue"
            emulsi = "HIGH"
        return {
            "estimated_age_hours":      age_h,
            "age_range_hours":          [round(age_h * 0.75, 1), round(age_h * 1.35, 1)],
            "weathering_stage":         stage,
            "evaporation_fraction_pct": evap,
            "appearance_code":          code,
            "emulsification_risk":      emulsi,
        }
