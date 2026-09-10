export interface TrajectoryPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speedKnots: number;
  headingDeg: number;
}

export type VesselCategory =
  | 'CANDIDATE VESSEL'
  | 'PRODUCT TANKER'
  | 'CRUDE CARRIER'
  | 'BULK CARRIER'
  | string;

export type VesselRisk = 'High' | 'Medium' | 'Low';

export interface TrackedVessel {
  id: string;
  name: string;
  category: VesselCategory;
  mmsi: string;
  imo: string;
  speed: string;
  heading: string;
  status: string;
  evidenceStrength: number;
  risk: VesselRisk;
  lastCoords: string;
  lat?: number;
  lng?: number;
  draft?: string;
  typeDescription?: string;
  flag?: string;
  lastFix?: string;
}

export interface VesselDetail extends TrackedVessel {
  trajectory: TrajectoryPoint[];
}
