"""
MiT-B2 + U-Net Segmentation Model
=================================
Authoritative implementation matching models/mit_b2_unet_best.pth:
- Encoder: SegformerModel (nvidia/mit-b2) hidden states [64, 128, 320, 512]
- Decoder: 4-stage convolutional U-Net decoder with skip connections
- Strict loading: load_state_dict(..., strict=True) with zero tolerance for mismatched weights
"""

from __future__ import annotations
import os
import logging
from typing import Tuple, Dict, Any, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import SegformerModel, SegformerConfig

logger = logging.getLogger(__name__)


class ConvBlock(nn.Module):
    """
    Double convolution block:
    Conv2d(in_ch, out_ch, 3, padding=1, bias=False) -> BatchNorm2d -> ReLU ->
    Conv2d(out_ch, out_ch, 3, padding=1, bias=False) -> BatchNorm2d -> ReLU
    """

    def __init__(self, in_ch: int, out_ch: int) -> None:
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class MiTB2UNet(nn.Module):
    """
    U-Net segmentation network with an MiT-B2 encoder backbone.
    Expects input shape: [B, 3, 256, 256]
    Outputs raw logits shape: [B, 1, 256, 256]
    """

    def __init__(self, pretrained_backbone: str = "nvidia/mit-b2") -> None:
        super().__init__()
        try:
            config = SegformerConfig.from_pretrained(pretrained_backbone)
        except Exception as e:
            logger.warning(
                "Could not fetch SegformerConfig from remote '%s' (%s). Using default MiT-B2 config.",
                pretrained_backbone,
                e,
            )
            config = SegformerConfig(
                hidden_sizes=[64, 128, 320, 512],
                decoder_hidden_size=768,
                num_attention_heads=[1, 2, 5, 8],
                intermediate_sizes=[256, 512, 1280, 2048],
                num_encoder_blocks=[3, 4, 6, 3],
            )

        self.encoder = SegformerModel(config)

        # Decoder blocks matching checkpoint weights
        self.dec4 = ConvBlock(512 + 320, 256)   # 832 -> 256
        self.dec3 = ConvBlock(256 + 128, 128)   # 384 -> 128
        self.dec2 = ConvBlock(128 + 64, 64)     # 192 -> 64
        self.dec1 = ConvBlock(64, 32)           # 64 -> 32
        self.final = nn.Conv2d(32, 1, kernel_size=1, bias=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        Parameters
        ----------
        x : torch.Tensor
            Batch of RGB images of shape [B, 3, H, W] (e.g. 256x256).

        Returns
        -------
        torch.Tensor
            Raw logits of shape [B, 1, H, W].
        """
        orig_h, orig_w = x.shape[2], x.shape[3]

        outputs = self.encoder(x, output_hidden_states=True)
        # hidden_states contains feature maps from each stage:
        # f1: [B, 64,  H/4,  W/4]  (e.g. 64x64)
        # f2: [B, 128, H/8,  W/8]  (e.g. 32x32)
        # f3: [B, 320, H/16, W/16] (e.g. 16x16)
        # f4: [B, 512, H/32, W/32] (e.g. 8x8)
        f1, f2, f3, f4 = outputs.hidden_states[0], outputs.hidden_states[1], outputs.hidden_states[2], outputs.hidden_states[3]

        # Stage 4: f4 (512 ch) upsampled to f3 spatial size + f3 (320 ch) -> 832 ch
        x4 = F.interpolate(f4, size=f3.shape[2:], mode="bilinear", align_corners=False)
        d4 = self.dec4(torch.cat([x4, f3], dim=1))  # [B, 256, H/16, W/16]

        # Stage 3: d4 (256 ch) upsampled to f2 spatial size + f2 (128 ch) -> 384 ch
        x3 = F.interpolate(d4, size=f2.shape[2:], mode="bilinear", align_corners=False)
        d3 = self.dec3(torch.cat([x3, f2], dim=1))  # [B, 128, H/8, W/8]

        # Stage 2: d3 (128 ch) upsampled to f1 spatial size + f1 (64 ch) -> 192 ch
        x2 = F.interpolate(d3, size=f1.shape[2:], mode="bilinear", align_corners=False)
        d2 = self.dec2(torch.cat([x2, f1], dim=1))  # [B, 64, H/4, W/4]

        # Stage 1: d2 (64 ch) upsampled to original input spatial size -> 32 ch
        x1 = F.interpolate(d2, size=(orig_h, orig_w), mode="bilinear", align_corners=False)
        d1 = self.dec1(x1)                          # [B, 32, H, W]

        # Final projection to 1 channel (raw logits)
        out = self.final(d1)                        # [B, 1, H, W]
        return out


def load_mit_b2_checkpoint(
    checkpoint_path: str,
    device: Optional[str] = None,
) -> MiTB2UNet:
    """
    Loads and strictly validates the MiT-B2 + U-Net checkpoint.

    Parameters
    ----------
    checkpoint_path : str
        Path to mit_b2_unet_best.pth.
    device : Optional[str]
        Target device ('cuda', 'cpu', or auto-detected).

    Returns
    -------
    MiTB2UNet
        Instantiated and evaluated model ready for inference.
    """
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(
            f"Authoritative SAR model checkpoint not found at: {checkpoint_path}. "
            "Please ensure mit_b2_unet_best.pth is located in the models/ directory."
        )

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    logger.info("Instantiating MiTB2UNet architecture for device: %s", device)
    model = MiTB2UNet()

    logger.info("Loading checkpoint weights from %s (map_location=%s)...", checkpoint_path, device)
    checkpoint = torch.load(checkpoint_path, map_location=device)

    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    elif isinstance(checkpoint, dict):
        state_dict = checkpoint
    else:
        raise ValueError(
            f"Unexpected checkpoint format in {checkpoint_path}: expected dict containing 'model_state_dict'"
        )

    try:
        # STRICT loading required by specification
        load_result = model.load_state_dict(state_dict, strict=True)
        logger.info(
            "Checkpoint loaded successfully with strict=True: %s", load_result
        )
    except RuntimeError as err:
        logger.error("STRICT CHECKPOINT LOADING FAILED: %s", err)
        raise RuntimeError(
            f"Checkpoint architecture mismatch in {checkpoint_path}! "
            f"Strict loading failed: {err}"
        ) from err

    model.to(device)
    model.eval()
    return model
