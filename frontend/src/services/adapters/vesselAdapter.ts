import type { TrackedVessel, VesselDetail, TrajectoryPoint } from '@/types/vessel';
import { formatCoordinate } from '@/utils/geo';

export function mapTrackedVessel(data: any): TrackedVessel {
  return {
    id: data.id || data.mmsi || 'UNKNOWN',
    name: data.name || data.ship_name || `VESSEL-${data.mmsi || 'UNKNOWN'}`,
    category: data.category || data.ship_type || 'PRODUCT TANKER',
    mmsi: String(data.mmsi || ''),
    imo: String(data.imo || 'N/A'),
    speed: data.speed ? String(data.speed) : (typeof data.sog === 'number' ? `${data.sog.toFixed(1)} kts` : 'N/A'),
    heading: data.heading ? String(data.heading) : (typeof data.cog === 'number' ? `${data.cog.toFixed(0)}°` : 'N/A'),
    status: data.status ? String(data.status) : 'Underway',
    evidenceStrength: typeof data.evidenceStrength === 'number' ? data.evidenceStrength : 0,
    risk: data.risk || 'Low',
    lastCoords: data.lastCoords || (typeof data.lat === 'number' && typeof data.lng === 'number' ? formatCoordinate(data.lat, data.lng) : 'Position unavailable'),
    lat: typeof data.lat === 'number' ? data.lat : (typeof data.y === 'number' ? data.y : undefined),
    lng: typeof data.lng === 'number' ? data.lng : (typeof data.lon === 'number' ? data.lon : (typeof data.x === 'number' ? data.x : undefined)),
    draft: data.draft ? String(data.draft) : undefined,
    typeDescription: data.typeDescription || data.ship_type,
    flag: data.flag,
    lastFix: data.lastFix || data.ts,
  };
}

export function mapVesselDetail(data: any): VesselDetail {
  const base = mapTrackedVessel(data);
  const trajectory: TrajectoryPoint[] = Array.isArray(data.trajectory)
    ? data.trajectory.map((tp: any) => ({
        lat: Number(tp.lat),
        lng: Number(tp.lng ?? tp.lon),
        timestamp: String(tp.timestamp || tp.ts || ''),
        speedKnots: Number(tp.speedKnots ?? tp.sog ?? 0),
        headingDeg: Number(tp.headingDeg ?? tp.heading ?? tp.cog ?? 0),
      }))
    : [];

  return {
    ...base,
    trajectory,
  };
}
