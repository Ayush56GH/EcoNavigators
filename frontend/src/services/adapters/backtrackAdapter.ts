import type {
  BacktrackingAnalysisResponse,
  CandidateRanking,
  ForensicCorrelationData,
  DriftPoint,
  ForecastPoint,
  BacktrackResult,
} from '@/types/backtracking';

export function mapCandidateRanking(data: any, index: number): CandidateRanking {
  return {
    rank: typeof data.rank === 'number' ? data.rank : index + 1,
    name: data.name || `CANDIDATE-${data.mmsi || data.imo || index + 1}`,
    mmsi: String(data.mmsi || ''),
    imo: String(data.imo || 'N/A'),
    associationScore: typeof data.associationScore === 'number' ? data.associationScore : 0,
    evidenceLevel: typeof data.evidenceLevel === 'number' ? data.evidenceLevel : 0,
    variant: data.variant || (data.associationScore > 75 ? 'cyan' : data.associationScore > 50 ? 'amber' : 'muted'),
    lat: typeof data.lat === 'number' ? data.lat : undefined,
    lng: typeof data.lng === 'number' ? data.lng : (typeof data.lon === 'number' ? data.lon : undefined),
    lon: typeof data.lon === 'number' ? data.lon : (typeof data.lng === 'number' ? data.lng : undefined),
    positionTimestamp: data.positionTimestamp ? String(data.positionTimestamp) : undefined,
    anomalyType: data.anomalyType,
    anomalyScore: typeof data.anomalyScore === 'number' ? data.anomalyScore : undefined,
    minDistanceKm: typeof data.minDistanceKm === 'number' ? data.minDistanceKm : undefined,
  };
}

export function mapForensicEvidence(data: any): ForensicCorrelationData {
  return {
    cpa: data?.cpa || 'N/A',
    intersectionArea: data?.intersectionArea || 'N/A',
    proximityLevel: data?.proximityLevel || 'LOW',
    anomalyTimestamp: data?.anomalyTimestamp || 'N/A',
    deltaT: data?.deltaT || 'N/A',
    timeCorrelationLevel: data?.timeCorrelationLevel || 'UNCONFIRMED',
    headingVariance: data?.headingVariance || 'N/A',
    speedProfile: data?.speedProfile || 'N/A',
    trajectoryMatchLevel: data?.trajectoryMatchLevel || 'LOW',
    aisAnomalyScore: typeof data?.aisAnomalyScore === 'number' ? data.aisAnomalyScore : undefined,
    distance: data?.distance,
    speedAnomaly: data?.speedAnomaly,
    trajectoryMatch: data?.trajectoryMatch,
    fusionConfidence: typeof data?.fusionConfidence === 'number' ? data.fusionConfidence : undefined,
  };
}

export function mapBacktrackingResponse(data: any): BacktrackingAnalysisResponse {
  const rankings: CandidateRanking[] = Array.isArray(data.rankings)
    ? data.rankings.map(mapCandidateRanking)
    : [];

  const forensicEvidence: ForensicCorrelationData = mapForensicEvidence(data.forensicEvidence);

  let estimatedOriginPoint: [number, number] | null = null;
  if (Array.isArray(data.estimatedOriginPoint) && data.estimatedOriginPoint.length >= 2) {
    const lat = Number(data.estimatedOriginPoint[0]);
    const lon = Number(data.estimatedOriginPoint[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      estimatedOriginPoint = [lat, lon];
    }
  }

  const driftTrajectory: DriftPoint[] = Array.isArray(data.driftTrajectory)
    ? data.driftTrajectory.map((pt: any, i: number) => ({
        step: typeof pt.step === 'number' ? pt.step : i,
        hoursAgo: pt.hoursAgo,
        minutes_ago: pt.minutes_ago,
        timestamp: pt.timestamp,
        lat: Number(pt.lat),
        lon: Number(pt.lon ?? pt.lng),
        uncertainty_radius_km: pt.uncertainty_radius_km,
      }))
    : [];

  const forecastTrajectory: ForecastPoint[] = Array.isArray(data.forecastTrajectory)
    ? data.forecastTrajectory.map((pt: any, i: number) => ({
        step: typeof pt.step === 'number' ? pt.step : i,
        hours_ahead: typeof pt.hours_ahead === 'number' ? pt.hours_ahead : i,
        minutes_ahead: pt.minutes_ahead,
        timestamp: pt.timestamp,
        lat: Number(pt.lat),
        lon: Number(pt.lon ?? pt.lng),
        uncertainty_radius_km: pt.uncertainty_radius_km,
        estimated_dispersed_area_km2: pt.estimated_dispersed_area_km2,
      }))
    : [];

  return {
    spillId: String(data.spillId || ''),
    rankings,
    forensicEvidence,
    estimatedOriginPoint,
    estimatedDischargeTime: data.estimatedDischargeTime || null,
    driftTrajectory,
    forecastTrajectory,
    spillCharacterization: data.spillCharacterization || null,
    coastalImpact: data.coastalImpact || null,
    hydrodynamics: data.hydrodynamics || null,
  };
}
