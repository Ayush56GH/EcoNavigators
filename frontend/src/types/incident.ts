import type { TrackedVessel, VesselDetail } from './vessel';
import type { SpillDetail } from './spill';
import type { SatelliteReconData } from './satellite';
import type { BacktrackingAnalysisResponse } from './backtracking';
import type { FusionEvidence } from './fusion';

export type IdentifyFlowState =
  | 'IDLE'
  | 'LOADING'
  | 'AIS_ANOMALY'
  | 'AIS_NORMAL'
  | 'SAR_DEFERRED'
  | 'PENDING_SAR'
  | 'SEARCHING_SAR'
  | 'SAR_UNAVAILABLE'
  | 'SAR_ACQUIRED'
  | 'PROCESSING_SAR'
  | 'SLICK_DETECTED'
  | 'NO_SLICK'
  | 'LOOKALIKE_REJECTED'
  | 'TEMPORAL_MISMATCH'
  | 'SPATIAL_MISMATCH'
  | 'FUSION_PROBABLE'
  | 'FUSION_CONFIRMED'
  | 'INCONCLUSIVE'
  | 'ERROR';

export interface IncidentAisData {
  vesselId?: string;
  mmsi?: string;
  imo?: string | null;
  name?: string;
  category?: string;
  anomalyDetected?: boolean;
  anomalyType?: string;
  anomalyScore?: number;
  confidence?: number;
  reason?: string;
  reasons?: string[];
  lat?: number | null;
  lng?: number | null;
  lon?: number | null;
  speed?: string;
  heading?: string;
  timestamp?: string;
  metrics?: Record<string, any>;
  track?: Array<{ lat: number; lng: number; timestamp: string }>;
}

export interface IncidentSarData {
  status: 'DEFERRED' | 'ACQUIRED' | 'SEARCHING' | 'UNAVAILABLE' | string;
  reason?: string;
  satellite?: string;
  available?: boolean;
}

export interface IncidentSlickData {
  spillId?: string;
  coordinates?: string;
  lat?: number;
  lng?: number;
  status?: string;
  confidence?: string;
  areaSqNm?: string;
  detectionTime?: string;
  sensorSource?: string;
  polygonGeom?: Array<[number, number]> | null;
}

export interface Incident {
  incidentId: string;
  mmsi: string;
  state?: IdentifyFlowState;
  status?: IdentifyFlowState;
  timestamp: string;
  location?: {
    lat: number | null;
    lon: number | null;
  };
  ais?: IncidentAisData;
  sar?: IncidentSarData | SatelliteReconData;
  fusion?: FusionEvidence;
  slick?: IncidentSlickData;
  backtracking?: {
    status: string;
  } | BacktrackingAnalysisResponse;
  risk?: 'High' | 'Medium' | 'Low';
  vessel?: {
    mmsi: string;
    name?: string;
    type?: string;
    imo?: string | null;
    speed?: string;
    heading?: string;
    status?: string;
  } | VesselDetail | TrackedVessel;
}
