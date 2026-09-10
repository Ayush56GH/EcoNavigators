/**
 * SAR Oil Spill Detection Types
 */

export interface SARVisualizations {
  original_image: string;
  probability_map: string;
  binary_mask: string;
  overlay: string;
}

export interface SARImageMetadata {
  filename: string;
  original_width: number;
  original_height: number;
  analyzed_width: number;
  analyzed_height: number;
}

export interface SARAnalysisResult {
  success: boolean;
  status: 'OIL-LIKE SPILL DETECTED' | 'NO SIGNIFICANT OIL-LIKE REGION DETECTED' | string;
  threshold: number;
  min_oil_area_percent: number;
  oil_area_percent: number;
  mean_pixel_probability: number;
  max_pixel_probability: number;
  detected_region_confidence: number;
  detected_region_count: number;
  largest_region_percent: number;
  inference_time_ms: number;
  image_metadata: SARImageMetadata;
  visualizations: SARVisualizations;
  disclaimer: string;
  physical_area_note: string;
}
