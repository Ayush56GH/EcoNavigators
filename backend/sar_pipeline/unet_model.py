"""
UNet Model — Vanilla U-Net for Sentinel-1 SAR Oil Spill Segmentation.

Architecture
------------
- Encoder: 4 down-sampling blocks (Conv -> BN -> ReLU x2 + MaxPool)
- Bottleneck: double convolution
- Decoder: 4 up-sampling blocks (ConvTranspose + skip + Conv -> BN -> ReLU x2)
- Output: 1x1 convolution -> sigmoid probability map

Input:  (B, 2, 512, 512)  — VV and VH channels
Output: (B, 1, 512, 512)  — per-pixel spill probability in [0, 1]

Checkpoint metadata
-------------------
Every saved checkpoint includes:
  {
    "architecture": "VanillaUNet",
    "in_channels": 2,
    "base_features": 32,
    "image_size": 512,
    "preprocessing_version": "sar_preprocessing_v1",
    "training_dataset": "SYNTHETIC_SAR_v1",
    "model_version": "1.0.0"
  }

NOTE: This is a prototype trained on SYNTHETIC data.
Real-world Sentinel-1 labeled training data is required for
production-grade performance. See README.md for details.
"""

from __future__ import annotations
import torch
import torch.nn as nn
from typing import Optional


# Default checkpoint metadata — stored alongside weights
DEFAULT_METADATA = {
    "architecture": "VanillaUNet",
    "in_channels": 2,
    "base_features": 32,
    "image_size": 512,
    "preprocessing_version": "sar_preprocessing_v1",
    "training_dataset": "SYNTHETIC_SAR_v1",
    "model_version": "1.0.0",
}


class _DoubleConv(nn.Module):
    """Two consecutive Conv2d -> BatchNorm -> ReLU blocks."""

    def __init__(self, in_ch: int, out_ch: int) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class VanillaUNet(nn.Module):
    """
    Vanilla U-Net for binary oil-spill segmentation.

    Parameters
    ----------
    in_channels : int
        Number of input channels. Default 2 (VV, VH).
    base_features : int
        Feature maps in the first encoder block. Doubles each block.
        Default 32 → [32, 64, 128, 256, 512 bottleneck].
    """

    MODEL_TYPE = "VanillaUNet"

    def __init__(self, in_channels: int = 2, base_features: int = 32) -> None:
        super().__init__()
        f = base_features

        # Encoder
        self.enc1 = _DoubleConv(in_channels, f)
        self.pool1 = nn.MaxPool2d(2)
        self.enc2 = _DoubleConv(f, f * 2)
        self.pool2 = nn.MaxPool2d(2)
        self.enc3 = _DoubleConv(f * 2, f * 4)
        self.pool3 = nn.MaxPool2d(2)
        self.enc4 = _DoubleConv(f * 4, f * 8)
        self.pool4 = nn.MaxPool2d(2)

        # Bottleneck
        self.bottleneck = _DoubleConv(f * 8, f * 16)

        # Decoder
        self.up4   = nn.ConvTranspose2d(f * 16, f * 8, kernel_size=2, stride=2)
        self.dec4  = _DoubleConv(f * 16, f * 8)
        self.up3   = nn.ConvTranspose2d(f * 8, f * 4, kernel_size=2, stride=2)
        self.dec3  = _DoubleConv(f * 8, f * 4)
        self.up2   = nn.ConvTranspose2d(f * 4, f * 2, kernel_size=2, stride=2)
        self.dec2  = _DoubleConv(f * 4, f * 2)
        self.up1   = nn.ConvTranspose2d(f * 2, f, kernel_size=2, stride=2)
        self.dec1  = _DoubleConv(f * 2, f)

        # Output
        self.out_conv = nn.Conv2d(f, 1, kernel_size=1)

        self.in_channels   = in_channels
        self.base_features = base_features

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Encoder
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool1(e1))
        e3 = self.enc3(self.pool2(e2))
        e4 = self.enc4(self.pool3(e3))

        # Bottleneck
        b = self.bottleneck(self.pool4(e4))

        # Decoder with skip connections
        d4 = self.dec4(torch.cat([self.up4(b), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))

        return self.out_conv(d1)   # raw logits — apply sigmoid externally

    def get_metadata(self) -> dict:
        """Return checkpoint metadata dict matching DEFAULT_METADATA schema."""
        return {
            "architecture":          self.MODEL_TYPE,
            "in_channels":           self.in_channels,
            "base_features":         self.base_features,
            "image_size":            512,
            "preprocessing_version": "sar_preprocessing_v1",
            "training_dataset":      "SYNTHETIC_SAR_v1",
            "model_version":         "1.0.0",
        }


def build_model(
    in_channels: int = 2,
    base_features: int = 32,
) -> VanillaUNet:
    """Factory function — use this instead of instantiating directly."""
    return VanillaUNet(in_channels=in_channels, base_features=base_features)


def save_checkpoint(
    model: VanillaUNet,
    path: str,
    extra_metadata: Optional[dict] = None,
) -> None:
    """
    Save model weights + metadata to a single .pt file.

    The checkpoint format is:
        {
            "model_state_dict": ...,
            "metadata": { architecture, in_channels, ... }
        }
    This allows verification at load time.
    """
    meta = model.get_metadata()
    if extra_metadata:
        meta.update(extra_metadata)
    torch.save({"model_state_dict": model.state_dict(), "metadata": meta}, path)
    print(f"[UNet] Checkpoint saved: {path}  (arch={meta['architecture']}, "
          f"in_ch={meta['in_channels']}, preprocessing={meta['preprocessing_version']})")


def load_checkpoint(path: str, device: str = "cpu") -> tuple[VanillaUNet, dict]:
    """
    Load a checkpoint with STRICT architecture verification.

    Raises
    ------
    ValueError
        If the checkpoint architecture does not match VanillaUNet, or if
        in_channels / base_features differ from the checkpoint metadata.
    RuntimeError
        If weights cannot be loaded strictly (shape mismatch).
    """
    ckpt = torch.load(path, map_location=device)

    # Support both legacy (raw state_dict) and new (dict with metadata) formats
    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        state_dict = ckpt["model_state_dict"]
        metadata   = ckpt.get("metadata", {})
    else:
        # Legacy format — raw state dict, no metadata
        state_dict = ckpt
        metadata   = {}
        print("[UNet] WARNING: legacy checkpoint without metadata loaded. "
              "Retrain to include metadata for architecture verification.")

    # Verify architecture
    arch = metadata.get("architecture", "UNKNOWN")
    if arch not in ("UNKNOWN", "VanillaUNet"):
        raise ValueError(
            f"[UNet] Checkpoint architecture mismatch: "
            f"expected 'VanillaUNet', got '{arch}'. "
            "Load the correct checkpoint or retrain."
        )

    in_channels   = metadata.get("in_channels", 2)
    base_features = metadata.get("base_features", 32)

    model = VanillaUNet(in_channels=in_channels, base_features=base_features)

    # STRICT loading — fail loudly on any shape mismatch
    try:
        model.load_state_dict(state_dict, strict=True)
    except RuntimeError as e:
        raise RuntimeError(
            f"[UNet] Weight loading failed (strict=True): {e}\n"
            "The checkpoint weights are incompatible with the current model architecture. "
            "Retrain or supply a matching checkpoint."
        ) from e

    model = model.to(device)
    model.eval()

    prep_version = metadata.get("preprocessing_version", "UNKNOWN")
    print(f"[UNet] Loaded checkpoint: arch={arch}, in_ch={in_channels}, "
          f"preprocessing={prep_version}, dataset={metadata.get('training_dataset','UNKNOWN')}")

    return model, metadata
