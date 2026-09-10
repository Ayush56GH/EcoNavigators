export interface CandidateRanking {
  rank: number;
  name: string;
  mmsi: string;
  imo: string;
  associationScore: number;
  evidenceLevel: number;
  variant: 'cyan' | 'amber' | 'muted';
  lat?: number;
  lng?: number;
  lon?: number;
  positionTimestamp?: string;
  anomalyType?: string;
  anomalyScore?: number;
  minDistanceKm?: number;
}

export interface ForensicCorrelationData {
  cpa: string;
  intersectionArea: string;
  proximityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  anomalyTimestamp: string;
  deltaT: string;
  timeCorrelationLevel: 'CONFIRMED' | 'UNCONFIRMED';
  headingVariance: string;
  speedProfile: string;
  trajectoryMatchLevel: 'MEDIUM' | 'HIGH' | 'LOW';
  aisAnomalyScore?: number;
  distance?: string;
  speedAnomaly?: string;
  trajectoryMatch?: string;
  fusionConfidence?: number;
  proximityEvidencePct?: number;
  timeEvidencePct?: number;
  trajectoryEvidencePct?: number;
  weatheringConfidencePct?: number;
}

export interface DriftPoint {
  step: number;
  hoursAgo?: number;
  minutes_ago?: number;
  timestamp?: string;
  lat: number;
  lon: number;
  uncertainty_radius_km?: number;
}

export interface ForecastPoint {
  step: number;
  hours_ahead: number;
  minutes_ahead?: number;
  timestamp?: string;
  lat: number;
  lon: number;
  uncertainty_radius_km?: number;
  estimated_dispersed_area_km2?: number;
}

export interface SpillCharacterization {
  area_km2: number;
  perimeter_km: number;
  aspect_ratio: number;
  orientation_deg: number;
  damping_contrast_db: number;
  slick_type: string;
  estimated_age_hours: number;
  age_range_hours: [number, number];
  weathering_stage: string;
  evaporation_fraction_pct: number;
  appearance_code: string;
  emulsification_risk: string;
}

export interface CoastalImpactAssessment {
  status: string;
  vulnerability_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  current_distance_to_coast_km: number;
  min_forecast_distance_km: number;
  nearest_sensitive_area: string;
  projected_landfall_point: [number, number] | null;
  estimated_landfall_eta_hours: number | null;
  action_advisory: string;
}

export interface BacktrackingAnalysisResponse {
  spillId: string;
  rankings: CandidateRanking[];
  forensicEvidence: ForensicCorrelationData;
  estimatedOriginPoint: [number, number] | null;
  estimatedDischargeTime: string | null;
  driftTrajectory?: DriftPoint[];
  forecastTrajectory?: ForecastPoint[];
  spillCharacterization?: SpillCharacterization;
  coastalImpact?: CoastalImpactAssessment;
  hydrodynamics?: any;
}

export interface BacktrackResult {
  spillId: string;
  estimatedOriginPoint: [number, number];
  estimatedOriginTimestamp: string;
  confidenceScore: number;
  driftTrajectory: DriftPoint[];
  status: string;
}
