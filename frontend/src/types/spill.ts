export interface NearbyTrack {
  mmsi?: string;
  imo?: string | null;
  type: string;
  matchScore: number;
  lastPosTime: string;
  isPrimary?: boolean;
}

export type SpillStatus = 'CRITICAL' | 'WARNING' | 'RESOLVED';

export interface SpillSummary {
  id: string;
  status: SpillStatus;
  coordinates: string;
  lat: number;
  lng: number;
  estArea: string;
  detectionTime: string;
  confidence: string;
  vesselName?: string;
}

export interface SpillDetail {
  id: string;
  coordinates: string;
  lat: number;
  lng: number;
  status: SpillStatus;
  detectionTime: string;
  estArea: string;
  perimeterKm?: string;
  aspectRatio?: string;
  dampingContrast?: string;
  estimatedAge?: string;
  weatheringStage?: string;
  sensorSource: string;
  confidence: string;
  evidenceLevel: number;
  evidenceDescription: string;
  areaSqNm: string;
  nearbyTracks: NearbyTrack[];
  estimatedOriginStatus: string;
  polygonGeom?: Array<[number, number]> | null;
  geojson?: any;
}
