"""
SAR Oil Spill Analysis Service
==============================
Standalone, stateless service for SAR image validation, preprocessing,
MiT-B2 + U-Net inference, metric calculations, and visualization outputs.

Independent of AIS, Copernicus API, and external databases.
"""

from __future__ import annotations
import io
import os
import time
import base64
import logging
from typing import Dict, Any, Tuple, Optional, List
import numpy as np
from PIL import Image
import scipy.ndimage
import torch
import matplotlib

from config import sar_cfg
from sar_pipeline.mit_b2_unet import MiTB2UNet, load_mit_b2_checkpoint

logger = logging.getLogger(__name__)

# Global singleton model instance and metadata
_sar_model: Optional[MiTB2UNet] = None
_sar_model_device: str = "cpu"
_sar_model_init_error: Optional[str] = None


def init_sar_model(
    model_path: Optional[str] = None,
    device: Optional[str] = None,
) -> MiTB2UNet:
    """
    Initializes the standalone MiT-B2 + U-Net model once at backend startup.
    Keeps model resident in memory.
    """
    global _sar_model, _sar_model_device, _sar_model_init_error

    if model_path is None:
        model_path = sar_cfg.STANDALONE_MODEL_PATH

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    _sar_model_device = device

    logger.info("Initializing standalone SAR segmentation model from %s on %s...", model_path, device)
    try:
        model = load_mit_b2_checkpoint(model_path, device=device)
        _sar_model = model
        _sar_model_init_error = None
        logger.info("Standalone SAR segmentation model initialized successfully and cached in memory.")
        return model
    except Exception as exc:
        _sar_model = None
        _sar_model_init_error = str(exc)
        logger.error("Failed to initialize standalone SAR model: %s", exc, exc_info=True)
        raise


def get_sar_model() -> MiTB2UNet:
    """
    Retrieves the cached singleton model instance.
    Initializes it if not yet loaded.
    """
    global _sar_model
    if _sar_model is not None:
        return _sar_model
    if _sar_model_init_error is not None:
        raise RuntimeError(f"SAR model previously failed to load: {_sar_model_init_error}")
    return init_sar_model()


def is_sar_model_loaded() -> bool:
    """Returns True if the SAR segmentation model is loaded and ready."""
    return _sar_model is not None


def _to_png_data_uri(img: Image.Image) -> str:
    """Encodes a PIL Image into a base64 Data URI."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def validate_image_file(
    content: bytes,
    filename: Optional[str] = None,
    max_bytes: int = sar_cfg.SAR_MAX_UPLOAD_BYTES,
) -> Image.Image:
    """
    Validates uploaded file size, extension, and decodability.
    Returns decoded PIL Image.
    """
    if not content:
        raise ValueError("Uploaded file is empty.")

    if len(content) > max_bytes:
        max_mb = max_bytes / (1024 * 1024)
        raise ValueError(f"Uploaded file size ({len(content) / (1024 * 1024):.1f} MB) exceeds maximum allowed {max_mb:.0f} MB.")

    if filename:
        ext = os.path.splitext(filename.lower())[1]
        allowed_exts = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
        if ext and ext not in allowed_exts:
            raise ValueError(f"Unsupported file format '{ext}'. Allowed formats: PNG, JPG, JPEG, TIF, TIFF.")

    try:
        img = Image.open(io.BytesIO(content))
        img.load()  # verify integrity
        return img
    except Exception as exc:
        raise ValueError(f"Invalid or corrupted image file: {str(exc)}") from exc


def preprocess_image(img: Image.Image) -> Tuple[torch.Tensor, Tuple[int, int], Image.Image]:
    """
    Preprocesses PIL image to [1, 3, 256, 256] float32 tensor normalized to [0, 1].

    Returns
    -------
    tensor : torch.Tensor
        Batch tensor [1, 3, 256, 256].
    original_dims : Tuple[int, int]
        (width, height) of original image.
    resized_rgb_pil : Image.Image
        256x256 RGB PIL Image for visualization generation.
    """
    orig_dims = (img.width, img.height)

    # Convert grayscale, palette, or RGBA to 3-channel RGB
    if img.mode != "RGB":
        img_rgb = img.convert("RGB")
    else:
        img_rgb = img

    # Bilinear resize to 256x256
    resized_pil = img_rgb.resize((256, 256), Image.Resampling.BILINEAR)

    # Convert to float32 in [0, 1]
    arr = np.array(resized_pil, dtype=np.float32) / 255.0  # shape [256, 256, 3]

    # Permute to [3, 256, 256]
    arr_chw = np.transpose(arr, (2, 0, 1))

    # Add batch dimension -> [1, 3, 256, 256]
    tensor = torch.from_numpy(arr_chw).unsqueeze(0).float()

    return tensor, orig_dims, resized_pil


def generate_visualizations(
    resized_pil: Image.Image,
    probs_256: np.ndarray,
    binary_mask_256: np.ndarray,
) -> Dict[str, str]:
    """
    Generates 4 visualization outputs as base64 Data URIs:
    1. original: Resized RGB image
    2. probability_map: Color-mapped heatmap of sigmoid probabilities
    3. binary_mask: High-contrast binary prediction mask
    4. overlay: Original image blended with semi-transparent oil spill mask
    """
    # 1. Original
    original_uri = _to_png_data_uri(resized_pil)

    # 2. Probability Heatmap (using matplotlib 'inferno' colormap)
    cmap = matplotlib.colormaps.get_cmap("inferno")
    rgba_heatmap = (cmap(probs_256) * 255).astype(np.uint8)
    heatmap_pil = Image.fromarray(rgba_heatmap, mode="RGBA").convert("RGB")
    prob_map_uri = _to_png_data_uri(heatmap_pil)

    # 3. Binary Mask (0=black, 255=bright teal / white for visibility)
    mask_visual = np.zeros((256, 256, 3), dtype=np.uint8)
    # Bright cyan/coral for high visibility:
    mask_visual[binary_mask_256 == 1] = [0, 230, 255]
    mask_pil = Image.fromarray(mask_visual, mode="RGB")
    binary_mask_uri = _to_png_data_uri(mask_pil)

    # 4. Overlay: Original blended with semi-transparent red/crimson detection
    orig_np = np.array(resized_pil, dtype=np.uint8)
    overlay_np = orig_np.copy()
    mask_bool = binary_mask_256 == 1

    # Apply semi-transparent red tint (60% red blend, 40% original)
    overlay_np[mask_bool, 0] = np.clip(orig_np[mask_bool, 0] * 0.4 + 255 * 0.6, 0, 255).astype(np.uint8)
    overlay_np[mask_bool, 1] = np.clip(orig_np[mask_bool, 1] * 0.35, 0, 255).astype(np.uint8)
    overlay_np[mask_bool, 2] = np.clip(orig_np[mask_bool, 2] * 0.35, 0, 255).astype(np.uint8)

    overlay_pil = Image.fromarray(overlay_np, mode="RGB")
    overlay_uri = _to_png_data_uri(overlay_pil)

    return {
        "original_image": original_uri,
        "probability_map": prob_map_uri,
        "binary_mask": binary_mask_uri,
        "overlay": overlay_uri,
    }


def analyze_sar_image(
    image_bytes: bytes,
    filename: Optional[str] = None,
    threshold: float = sar_cfg.SAR_THRESHOLD,
    min_oil_area_percent: float = sar_cfg.MIN_OIL_AREA_PERCENT,
    min_region_pixels: int = sar_cfg.SAR_MIN_REGION_PIXELS,
) -> Dict[str, Any]:
    """
    Executes the end-to-end SAR oil-spill detection pipeline:
    Validate -> Preprocess -> MiT-B2 UNet -> Sigmoid -> Connected Components -> Metrics -> Visualizations
    """
    # 1. Validate image
    pil_img = validate_image_file(image_bytes, filename=filename)

    # 2. Preprocess
    input_tensor, (orig_w, orig_h), resized_pil = preprocess_image(pil_img)

    # 3. Model inference
    model = get_sar_model()
    device = next(model.parameters()).device
    input_tensor = input_tensor.to(device)

    start_time = time.perf_counter()
    with torch.no_grad():
        logits = model(input_tensor)
        probs_tensor = torch.sigmoid(logits)
    inference_time_ms = int((time.perf_counter() - start_time) * 1000)

    # Extract 256x256 2D probability array on CPU
    probs = probs_tensor.squeeze().cpu().numpy().astype(np.float32)

    # 4. Binary thresholding
    binary_mask = (probs >= threshold).astype(np.uint8)
    total_pixels = binary_mask.size
    oil_pixels = int(np.sum(binary_mask))

    # 5. Connected Component Analysis
    labeled_array, num_features = scipy.ndimage.label(binary_mask)

    # Compute region sizes and filter tiny noise if min_region_pixels > 1
    region_sizes = []
    if num_features > 0:
        for i in range(1, num_features + 1):
            sz = int(np.sum(labeled_array == i))
            if sz >= min_region_pixels:
                region_sizes.append(sz)

    detected_region_count = len(region_sizes)
    largest_region_pixels = max(region_sizes) if region_sizes else 0
    largest_region_percent = round(float((largest_region_pixels / total_pixels) * 100.0), 2)

    # 6. Metrics
    oil_area_percent = round(float((oil_pixels / total_pixels) * 100.0), 2)
    mean_pixel_prob = round(float(np.mean(probs) * 100.0), 2)
    max_pixel_prob = round(float(np.max(probs) * 100.0), 2)

    if oil_pixels > 0:
        detected_region_conf = round(float(np.mean(probs[binary_mask == 1]) * 100.0), 2)
    else:
        detected_region_conf = 0.0

    # 7. Decision
    if oil_area_percent >= min_oil_area_percent:
        status = "OIL-LIKE SPILL DETECTED"
    else:
        status = "NO SIGNIFICANT OIL-LIKE REGION DETECTED"

    # 8. Visualizations
    visualizations = generate_visualizations(resized_pil, probs, binary_mask)

    return {
        "success": True,
        "status": status,
        "threshold": threshold,
        "min_oil_area_percent": min_oil_area_percent,
        "oil_area_percent": oil_area_percent,
        "mean_pixel_probability": mean_pixel_prob,
        "max_pixel_probability": max_pixel_prob,
        "detected_region_confidence": detected_region_conf,
        "detected_region_count": detected_region_count,
        "largest_region_percent": largest_region_percent,
        "inference_time_ms": inference_time_ms,
        "image_metadata": {
            "filename": filename or "uploaded_image.png",
            "original_width": orig_w,
            "original_height": orig_h,
            "analyzed_width": 256,
            "analyzed_height": 256,
        },
        "visualizations": visualizations,
        "disclaimer": (
            "Results indicate model-detected oil-like regions in the uploaded SAR image. "
            "This automated result should not be treated as definitive confirmation of an oil spill."
        ),
        "physical_area_note": "Physical area unavailable — geospatial resolution was not provided.",
    }
