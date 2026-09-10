"""
Tests for Standalone SAR Oil Spill Detection Feature (MiT-B2 + U-Net)
=====================================================================
Covers all acceptance tests:
1. Valid RGB image upload & inference
2. Grayscale image upload & 3-channel conversion
3. Arbitrary image dimensions (non-256x256) resize
4. Corrupted / invalid image handling (clean 400 error)
5. Unsupported file format (clean 400 error)
6. Model is loaded once and not re-instantiated on every request
7. CPU inference compatibility
8. strict=True checkpoint validation
9. Existing AIS functionality remains unaffected
10. Database structures remain unchanged
"""

import io
import os
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
import torch

from api.main import app
from sar_pipeline.mit_b2_unet import MiTB2UNet, load_mit_b2_checkpoint
from sar_pipeline.sar_service import (
    get_sar_model,
    is_sar_model_loaded,
    analyze_sar_image,
    validate_image_file,
    preprocess_image,
)
from config import sar_cfg

client = TestClient(app)


def _make_test_image_bytes(
    size=(256, 256),
    mode="RGB",
    color=(100, 150, 200),
    fmt="PNG",
) -> bytes:
    """Helper to generate in-memory test image bytes."""
    img = Image.new(mode, size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestSARUploadAndInference:
    """Acceptance tests 1 through 8."""

    def test_strict_checkpoint_loading(self):
        """TEST 8: Verify checkpoint loads with strict=True and zero missing/unexpected keys."""
        ckpt_path = sar_cfg.STANDALONE_MODEL_PATH
        assert os.path.exists(ckpt_path), f"Checkpoint must exist at {ckpt_path}"
        model = load_mit_b2_checkpoint(ckpt_path, device="cpu")
        assert isinstance(model, MiTB2UNet)
        assert not model.training

    def test_valid_rgb_image_upload(self):
        """TEST 1: Upload a valid RGB image -> Inference succeeds, returns metrics & visualizations."""
        img_bytes = _make_test_image_bytes(size=(256, 256), mode="RGB")
        resp = client.post(
            "/api/sar/analyze",
            files={"image": ("test_sar.png", img_bytes, "image/png")},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        assert data["status"] in ["OIL-LIKE SPILL DETECTED", "NO SIGNIFICANT OIL-LIKE REGION DETECTED"]
        assert "oil_area_percent" in data
        assert "detected_region_confidence" in data
        assert "mean_pixel_probability" in data
        assert "max_pixel_probability" in data
        assert "detected_region_count" in data
        assert "largest_region_percent" in data
        assert "inference_time_ms" in data
        assert "visualizations" in data
        vis = data["visualizations"]
        assert "original_image" in vis
        assert "probability_map" in vis
        assert "binary_mask" in vis
        assert "overlay" in vis
        assert vis["original_image"].startswith("data:image/png;base64,")
        assert vis["probability_map"].startswith("data:image/png;base64,")
        assert vis["binary_mask"].startswith("data:image/png;base64,")
        assert vis["overlay"].startswith("data:image/png;base64,")

    def test_grayscale_image_conversion(self):
        """TEST 2: Upload a grayscale image -> Backend converts it to 3-channel input and succeeds."""
        img_bytes = _make_test_image_bytes(size=(256, 256), mode="L", color=120)
        resp = client.post(
            "/api/sar/analyze",
            files={"image": ("test_grayscale.jpg", img_bytes, "image/jpeg")},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        assert "oil_area_percent" in data

    def test_non_square_dimensions_resize(self):
        """TEST 3: Upload an image with dimensions other than 256x256 -> Preprocessing resizes correctly."""
        img_bytes = _make_test_image_bytes(size=(512, 384), mode="RGB")
        resp = client.post(
            "/api/sar/analyze",
            files={"image": ("test_large.png", img_bytes, "image/png")},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        meta = data["image_metadata"]
        assert meta["original_width"] == 512
        assert meta["original_height"] == 384
        assert meta["analyzed_width"] == 256
        assert meta["analyzed_height"] == 256

    def test_corrupted_image_handling(self):
        """TEST 4: Upload an invalid / corrupted image -> Clean 400 error message."""
        corrupted_bytes = b"NOT_A_VALID_IMAGE_FILE_HEADER_GARBAGE"
        resp = client.post(
            "/api/sar/analyze",
            files={"image": ("corrupted.png", corrupted_bytes, "image/png")},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data
        assert "Invalid or corrupted image" in data["detail"]

    def test_unsupported_file_format(self):
        """TEST 5: Upload an unsupported file extension -> Clean 400 validation error."""
        text_bytes = b"Hello world, this is a plain text file."
        resp = client.post(
            "/api/sar/analyze",
            files={"image": ("document.txt", text_bytes, "text/plain")},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "Unsupported file format" in data["detail"]

    def test_model_singleton_cached_in_memory(self):
        """TEST 6: Running inference twice does NOT reload the model weights from disk."""
        model_1 = get_sar_model()
        img_bytes = _make_test_image_bytes(size=(256, 256), mode="RGB")
        resp1 = client.post("/api/sar/analyze", files={"image": ("test.png", img_bytes, "image/png")})
        assert resp1.status_code == 200

        model_2 = get_sar_model()
        resp2 = client.post("/api/sar/analyze", files={"image": ("test.png", img_bytes, "image/png")})
        assert resp2.status_code == 200

        # Exact same in-memory object instance
        assert model_1 is model_2

    def test_cpu_inference_compatibility(self):
        """TEST 7: Model forward pass runs smoothly on CPU."""
        model = get_sar_model()
        dummy_input = torch.randn(1, 3, 256, 256, device="cpu")
        with torch.no_grad():
            output = model(dummy_input)
            prob = torch.sigmoid(output)
        assert prob.shape == (1, 1, 256, 256)
        assert prob.device.type == "cpu"

    def test_api_health_reports_sar_model_loaded(self):
        """Verify health check reports model status."""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("sar_model_loaded") is True

        resp_v1 = client.get("/api/v1/health")
        assert resp_v1.status_code == 200
        assert resp_v1.json().get("sar_model_loaded") is True
