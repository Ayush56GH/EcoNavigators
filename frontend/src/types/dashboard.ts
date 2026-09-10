export interface OperationalStats {
  activeVessels: number;
  trackedRoutes: number;
  detectedSpills: number;
}

export interface CandidateVessel {
  id: string;
  name: string;
  type: string;
  mmsi: string;
  imo: string;
  speed: string;
  heading: string;
  draft: string;
  status: string;
  evidenceStrength: number;
  lastFix: string;
  coordinates: string;
  lat?: number;
  lng?: number;
}
