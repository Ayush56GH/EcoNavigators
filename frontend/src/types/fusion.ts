export type FusionStatus =
  | 'CONFIRMED'
  | 'PROBABLE'
  | 'SUSPECT'
  | 'UNCONFIRMED'
  | 'INCONCLUSIVE';

export interface FusionEvidence {
  confidenceScore: number;
  status: FusionStatus;
  temporalCorrelation: string;
  spatialProximityKm: number;
  hydrodynamicAlignment: string;
  notes?: string;
}
