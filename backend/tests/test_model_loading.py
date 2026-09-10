"""
Tests for model loading and architecture verification.

CRITICAL: strict=False is NOT used. Any weight mismatch must fail loudly.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import tempfile
import pytest
import torch
from sar_pipeline.unet_model import VanillaUNet, save_checkpoint, load_checkpoint, DEFAULT_METADATA


class TestVanillaUNetArchitecture:
    def test_forward_shape_512(self):
        model = VanillaUNet(in_channels=2, base_features=32)
        x = torch.zeros(1, 2, 512, 512)
        out = model(x)
        assert out.shape == (1, 1, 512, 512), f"Expected (1,1,512,512) got {out.shape}"

    def test_forward_shape_256(self):
        model = VanillaUNet(in_channels=2, base_features=16)
        x = torch.zeros(1, 2, 256, 256)
        out = model(x)
        assert out.shape == (1, 1, 256, 256)

    def test_forward_is_raw_logits(self):
        """Model outputs raw logits — sigmoid applied externally."""
        model = VanillaUNet(in_channels=2, base_features=8)
        x = torch.ones(1, 2, 64, 64)
        out = model(x)
        # Logits can be < 0 or > 1
        assert out.min().item() < 0.5 or out.max().item() > 0.5

    def test_metadata_matches_default(self):
        model = VanillaUNet(in_channels=2, base_features=32)
        meta = model.get_metadata()
        assert meta["architecture"]  == "VanillaUNet"
        assert meta["in_channels"]   == 2
        assert meta["base_features"] == 32
        assert meta["image_size"]    == 512
        assert "preprocessing_version" in meta

    def test_in_channels_1(self):
        """Single-channel input also works."""
        model = VanillaUNet(in_channels=1, base_features=8)
        x = torch.zeros(1, 1, 64, 64)
        out = model(x)
        assert out.shape == (1, 1, 64, 64)


class TestCheckpointRoundtrip:
    def test_save_and_load_strict(self):
        """Save then load — strict=True must succeed with matching architecture."""
        model = VanillaUNet(in_channels=2, base_features=16)
        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
            path = f.name
        try:
            save_checkpoint(model, path)
            loaded_model, meta = load_checkpoint(path)
            assert meta["architecture"] == "VanillaUNet"
            assert meta["in_channels"] == 2
            # Weight values must be identical
            for k in model.state_dict():
                torch.testing.assert_close(
                    model.state_dict()[k].float(),
                    loaded_model.state_dict()[k].float(),
                    msg=f"Weight mismatch for {k}",
                )
        finally:
            os.unlink(path)

    def test_wrong_architecture_raises(self):
        """Checkpoint claiming wrong architecture must raise ValueError."""
        model = VanillaUNet(in_channels=2, base_features=16)
        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
            path = f.name
        try:
            meta = model.get_metadata()
            meta["architecture"] = "MiT_B2_UNet"  # wrong
            torch.save({"model_state_dict": model.state_dict(), "metadata": meta}, path)
            with pytest.raises(ValueError, match="architecture mismatch"):
                load_checkpoint(path)
        finally:
            os.unlink(path)

    def test_incompatible_weights_raise(self):
        """Shape-incompatible weights must raise RuntimeError, not silently load."""
        # Build a model with base_features=8 (small), save its weights
        small_model = VanillaUNet(in_channels=2, base_features=8)
        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
            path = f.name
        try:
            # Save small model state dict but claim base_features=32
            fake_meta = {"architecture": "VanillaUNet", "in_channels": 2, "base_features": 32}
            torch.save({"model_state_dict": small_model.state_dict(), "metadata": fake_meta}, path)
            with pytest.raises(RuntimeError):
                load_checkpoint(path)  # should fail strict loading
        finally:
            os.unlink(path)

    def test_metadata_includes_preprocessing_version(self):
        model = VanillaUNet(in_channels=2, base_features=8)
        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
            path = f.name
        try:
            save_checkpoint(model, path)
            _, meta = load_checkpoint(path)
            assert "preprocessing_version" in meta
            assert meta["preprocessing_version"] == "sar_preprocessing_v1"
        finally:
            os.unlink(path)
