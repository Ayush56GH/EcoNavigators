"""
SAR Preprocessor — Single source of truth for Sentinel-1 SAR preprocessing.

Used by BOTH training (train_unet.py) and inference (sar_unet_detector.py).
Training and inference MUST import from this module; never define normalization
constants in more than one place.

Physical basis
--------------
Sentinel-1 GRD ocean backscatter in linear power scale:
  VV:  typically -15 to -5 dB  (linear ~0.03 to 0.32)
  VH:  typically -25 to -12 dB (linear ~0.003 to 0.063)

We convert to dB, clip to a physically-motivated range, then normalize to [0, 1].
NO ImageNet mean/std is applied — SAR data is not natural imagery.
"""

from __future__ import annotations
import numpy as np
from typing import Tuple

# ──────────────────────────────────────────────────────────────
# Versioning — bump when ANY preprocessing parameter changes.
# The version is stored in every model checkpoint so training
# and inference can be verified to use the same pipeline.
# ──────────────────────────────────────────────────────────────
PREPROCESSING_VERSION = "sar_preprocessing_v1"

# dB clip ranges — ocean surface normal operating window
VV_DB_MIN: float = -30.0   # dB  (below this: calm-sea extreme)
VV_DB_MAX: float =   0.0   # dB  (above this: land / vessel clutter)

VH_DB_MIN: float = -40.0   # dB
VH_DB_MAX: float = -10.0   # dB

# Minimum linear value before log — avoids log(0)
_EPS: float = 1e-10

# Target spatial size fed to the UNet (must be divisible by 32)
TARGET_SIZE: int = 512


def linear_to_db(arr: np.ndarray) -> np.ndarray:
    """Convert linear power backscatter to dB.  arr values >= 0."""
    return 10.0 * np.log10(np.maximum(arr, _EPS))


def db_to_normalized(arr_db: np.ndarray, db_min: float, db_max: float) -> np.ndarray:
    """Clip to [db_min, db_max] then min-max normalize to [0, 1]."""
    clipped = np.clip(arr_db, db_min, db_max)
    return (clipped - db_min) / (db_max - db_min)


class SARPreprocessor:
    """
    Versioned SAR preprocessing pipeline.

    Usage
    -----
    >>> prep = SARPreprocessor()
    >>> tensor = prep.preprocess_pair(vv_linear, vh_linear)  # shape (2, H, W)
    """

    VERSION = PREPROCESSING_VERSION

    def __init__(
        self,
        vv_db_min: float = VV_DB_MIN,
        vv_db_max: float = VV_DB_MAX,
        vh_db_min: float = VH_DB_MIN,
        vh_db_max: float = VH_DB_MAX,
        target_size: int = TARGET_SIZE,
    ) -> None:
        self.vv_db_min = vv_db_min
        self.vv_db_max = vv_db_max
        self.vh_db_min = vh_db_min
        self.vh_db_max = vh_db_max
        self.target_size = target_size

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def preprocess_vv(self, vv: np.ndarray) -> np.ndarray:
        """
        Preprocess a VV backscatter array.

        Parameters
        ----------
        vv : np.ndarray
            2-D array of linear power backscatter values (float32).
            If values are clearly >1 (i.e. already 0-255 pixel range
            from a JPEG), they are rescaled to [0,1] first.

        Returns
        -------
        np.ndarray
            Normalized float32 array in [0, 1], same spatial shape as input.
        """
        vv = vv.astype(np.float32)
        vv = self._maybe_rescale_from_display(vv)
        return db_to_normalized(linear_to_db(vv), self.vv_db_min, self.vv_db_max)

    def preprocess_vh(self, vh: np.ndarray) -> np.ndarray:
        """Preprocess a VH backscatter array (same contract as preprocess_vv)."""
        vh = vh.astype(np.float32)
        vh = self._maybe_rescale_from_display(vh)
        return db_to_normalized(linear_to_db(vh), self.vh_db_min, self.vh_db_max)

    def preprocess_pair(
        self,
        vv: np.ndarray,
        vh: np.ndarray,
    ) -> np.ndarray:
        """
        Preprocess a VV+VH pair.

        Returns
        -------
        np.ndarray
            Float32 array of shape (2, target_size, target_size).
            Channel 0 = VV normalized, Channel 1 = VH normalized.
        """
        vv_norm = self.preprocess_vv(vv)
        vh_norm = self.preprocess_vh(vh)

        # Resize to target size using bilinear interpolation
        vv_resized = self._resize(vv_norm)
        vh_resized = self._resize(vh_norm)

        return np.stack([vv_resized, vh_resized], axis=0).astype(np.float32)

    def preprocess_from_rgb_jpeg(self, rgb_arr: np.ndarray) -> np.ndarray:
        """
        Fallback preprocessor for when the Copernicus API returns a
        JPEG preview (R=VV-stretch, G=VH-stretch, B=ratio).

        IMPORTANT: This path loses calibrated backscatter values.
        It is labeled as DISPLAY_APPROXIMATION in the pipeline state
        and reduces segmentation confidence.

        Parameters
        ----------
        rgb_arr : np.ndarray  shape (H, W, 3), dtype uint8 or float32

        Returns
        -------
        np.ndarray  shape (2, target_size, target_size), float32 in [0,1]
        """
        rgb = rgb_arr.astype(np.float32)
        if rgb.max() > 1.0:
            rgb = rgb / 255.0

        # Channel 0 (R) was encoded as sqrt-stretched VV
        # Channel 1 (G) was encoded as amplified VH
        # Invert the display stretch to approximate linear backscatter
        vv_approx = np.clip((rgb[:, :, 0] / 2.2) ** 2, 0.0, 1.0)
        vh_approx = np.clip((rgb[:, :, 1] / 2.5) ** 2, 0.0, 1.0)

        # Normalize in display space (no dB conversion — values already stretched)
        vv_n = vv_approx
        vh_n = vh_approx

        vv_r = self._resize(vv_n)
        vh_r = self._resize(vh_n)
        return np.stack([vv_r, vh_r], axis=0).astype(np.float32)

    def get_config(self) -> dict:
        """Return preprocessing configuration dict for storage in checkpoints."""
        return {
            "preprocessing_version": self.VERSION,
            "vv_db_min": self.vv_db_min,
            "vv_db_max": self.vv_db_max,
            "vh_db_min": self.vh_db_min,
            "vh_db_max": self.vh_db_max,
            "target_size": self.target_size,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _maybe_rescale_from_display(arr: np.ndarray) -> np.ndarray:
        """
        If the array looks like 0-255 display values (max > 2.0),
        rescale to [0, 1] linear range before dB conversion.
        This is a heuristic for when display-encoded data is passed in.
        """
        if arr.max() > 2.0:
            arr = arr / 255.0
        return arr

    def _resize(self, arr: np.ndarray) -> np.ndarray:
        """Bilinear resize 2-D array to (target_size, target_size)."""
        h, w = arr.shape
        ts = self.target_size
        if h == ts and w == ts:
            return arr
        try:
            import torch
            import torch.nn.functional as F
            t = (
                torch.from_numpy(arr)
                .unsqueeze(0)
                .unsqueeze(0)
                .float()
            )
            t = F.interpolate(t, size=(ts, ts), mode="bilinear", align_corners=False)
            return t.squeeze().numpy()
        except ImportError:
            # NumPy-only fallback (nearest-neighbour)
            row_idx = (np.arange(ts) * h / ts).astype(int)
            col_idx = (np.arange(ts) * w / ts).astype(int)
            return arr[np.ix_(row_idx, col_idx)]


# ──────────────────────────────────────────────────────────────
# Module-level default instance (shared by training + inference)
# ──────────────────────────────────────────────────────────────
default_preprocessor = SARPreprocessor()
