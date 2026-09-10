import type { SpillDetail, SpillSummary, NearbyTrack } from '@/types/spill';
import { formatCoordinate } from '@/utils/geo';

export function mapSpillSummary(data: any): SpillSummary {
  return {
    id: data.id,
    status: data.status || 'WARNING',
    coordinates: data.coordinates || (typeof data.lat === 'number' && typeof data.lng === 'number' ? formatCoordinate(data.lat, data.lng) : 'COORDINATES UNAVAILABLE'),
    lat: Number(data.lat),
    lng: Number(data.lng),
    estArea: data.estArea || data.areaSqNm || 'N/A',
    detectionTime: data.detectionTime || 'N/A',
    confidence: data.confidence || 'N/A',
    vesselName: data.vesselName,
  };
}

export function mapSpillDetail(data: any): SpillDetail {
  const lat = typeof data.lat === 'number' ? data.lat : NaN;
  const lng = typeof data.lng === 'number' ? data.lng : NaN;

  // Handle polygon geometry: backend provides polygonGeom as list of tuples [lat, lng]
  let polygonGeom: Array<[number, number]> | null = null;
  if (Array.isArray(data.polygonGeom) && data.polygonGeom.length >= 3) {
    polygonGeom = data.polygonGeom.map((pt: any) => [Number(pt[0]), Number(pt[1])] as [number, number]);
  } else if (data.geojson && data.geojson.coordinates) {
    // GeoJSON polygon coordinates are [lng, lat]
    try {
      const coords = data.geojson.coordinates[0];
      if (Array.isArray(coords)) {
        polygonGeom = coords.map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number]);
      }
    } catch {
      polygonGeom = null;
    }
  }

  const nearbyTracks: NearbyTrack[] = Array.isArray(data.nearbyTracks)
    ? data.nearbyTracks.map((t: any) => ({
        mmsi: t.mmsi ? String(t.mmsi) : (t.vessel_id ? String(t.vessel_id).replace('MMSI_', '') : undefined),
        imo: t.imo && t.imo !== 'UNKNOWN' && !String(t.imo).startsWith('IMO-') ? String(t.imo) : null,
        type: t.type || 'Vessel',
        matchScore: typeof t.matchScore === 'number' ? t.matchScore : 0,
        lastPosTime: t.lastPosTime || 'N/A',
        isPrimary: Boolean(t.isPrimary),
      }))
    : [];

  return {
    id: data.id,
    coordinates: data.coordinates || formatCoordinate(lat, lng),
    lat,
    lng,
    status: data.status || 'WARNING',
    detectionTime: data.detectionTime || 'N/A',
    estArea: data.estArea || data.areaSqNm || 'N/A',
    perimeterKm: data.perimeterKm,
    aspectRatio: data.aspectRatio,
    dampingContrast: data.dampingContrast,
    estimatedAge: data.estimatedAge,
    weatheringStage: data.weatheringStage,
    sensorSource: data.sensorSource || 'N/A',
    confidence: data.confidence || 'N/A',
    evidenceLevel: typeof data.evidenceLevel === 'number' ? data.evidenceLevel : 0,
    evidenceDescription: data.evidenceDescription || 'No evidence description available.',
    areaSqNm: data.areaSqNm || data.estArea || 'N/A',
    nearbyTracks,
    estimatedOriginStatus: data.estimatedOriginStatus || 'Modeling pending.',
    polygonGeom,
    geojson: data.geojson || null,
  };
}
