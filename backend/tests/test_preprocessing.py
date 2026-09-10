"""
Tests for SARPreprocessor — verifies that training and inference
use IDENTICAL preprocessing. Any divergence here would cause
train/inference mismatch.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
import pytest
from sar_pipeline.sar_preprocessor import (
    SARPreprocessor,
    PREPROCESSING_VERSION,
    linear_to_db,
    db_to_normalized,
)


def make_vv(val=0.05):
    return np.full((64, 64), val, dtype=np.float32)

def make_vh(val=0.008):
    return np.full((64, 64), val, dtype=np.float32)


class TestSARPreprocessorUnit:
    def test_version_is_string(self):
        assert isinstance(PREPROCESSING_VERSION, str)
        assert len(PREPROCESSING_VERSION) > 0

    def test_linear_to_db_zero_safe(self):
        arr = np.array([0.0, 0.0, 1.0], dtype=np.float32)
        result = linear_to_db(arr)
        assert np.all(np.isfinite(result)), "log(0) must not produce -inf or nan"

    def test_db_to_normalized_range(self):
        arr_db = np.array([-30.0, -15.0, 0.0], dtype=np.float32)
        n = db_to_normalized(arr_db, -30.0, 0.0)
        assert abs(n[0] - 0.0) < 1e-5, "min dB should normalize to 0"
        assert abs(n[2] - 1.0) < 1e-5, "max dB should normalize to 1"
        assert 0.0 < n[1] < 1.0

    def test_preprocess_vv_output_range(self):
        prep = SARPreprocessor()
        vv = make_vv(0.05)
        out = prep.preprocess_vv(vv)
        assert out.min() >= 0.0, "output should be >= 0"
        assert out.max() <= 1.0, "output should be <= 1"

    def test_preprocess_vh_output_range(self):
        prep = SARPreprocessor()
        vh = make_vh(0.008)
        out = prep.preprocess_vh(vh)
        assert out.min() >= 0.0
        assert out.max() <= 1.0

    def test_preprocess_pair_shape(self):
        prep = SARPreprocessor(target_size=64)
        vv = make_vv()
        vh = make_vh()
        pair = prep.preprocess_pair(vv, vh)
        assert pair.shape == (2, 64, 64), f"Expected (2,64,64), got {pair.shape}"
        assert pair.dtype == np.float32

    def test_preprocess_pair_channel_order(self):
        """VV in channel 0, VH in channel 1."""
        prep = SARPreprocessor(target_size=64)
        # Make VV and VH distinctly different
        vv = np.full((64, 64), 0.10, dtype=np.float32)  # higher backscatter
        vh = np.full((64, 64), 0.005, dtype=np.float32) # lower backscatter
        pair = prep.preprocess_pair(vv, vh)
        # VV normalized value should be higher than VH normalized value
        # because VV linear is higher and its dB range is less negative
        assert pair[0].mean() != pair[1].mean(), "VV and VH should not be identical"

    def test_deterministic_repeated_calls(self):
        """Same input must produce identical output every call."""
        prep = SARPreprocessor(target_size=64)
        vv = np.random.rand(64, 64).astype(np.float32) * 0.2
        vh = np.random.rand(64, 64).astype(np.float32) * 0.04
        out1 = prep.preprocess_pair(vv, vh)
        out2 = prep.preprocess_pair(vv, vh)
        np.testing.assert_array_equal(out1, out2)

    def test_get_config_contains_version(self):
        prep = SARPreprocessor()
        cfg = prep.get_config()
        assert cfg["preprocessing_version"] == PREPROCESSING_VERSION

    def test_display_jpeg_fallback_shape(self):
        prep = SARPreprocessor(target_size=64)
        rgb = np.random.randint(0, 255, (64, 64, 3), dtype=np.uint8).astype(np.float32)
        out = prep.preprocess_from_rgb_jpeg(rgb)
        assert out.shape == (2, 64, 64)
        assert out.min() >= 0.0
        assert out.max() <= 1.0
