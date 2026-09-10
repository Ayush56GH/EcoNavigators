export interface SatelliteReconData {
  success: boolean;
  satellite: string;
  satelliteType: 'SAR' | 'OPTICAL';
  vesselId?: string;
  vesselName?: string;
  isAnomaly?: boolean;
  anomalyType?: string;
  anomalyScore?: number;
  center: [number, number];
  coordinates?: { lat: number; lon: number };
  bbox: [number, number, number, number];
  timeRange: { from: string; to: string };
  targetTimestamp?: string;
  acquisitionTimestamp?: string;
  timeDifference?: string;
  resolutionMetersPerPx: number;
  dimensions: { width: number; height: number };
  imageBase64: string;
  description: string;
  attribution: string;
  processingStatus?: string;
  sarDetectionStatus?: string;
  segmentationConfidence?: number;
  slickPolygon?: Array<[number, number]>;
}

export interface SatelliteAnomalyItem {
  vesselId: string;
  vesselName: string;
  lon: number;
  lat: number;
  timestamp: string;
  anomalyType: string;
  anomalyScore: number;
}
