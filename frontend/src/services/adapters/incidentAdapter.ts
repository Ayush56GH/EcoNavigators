import type { Incident, IdentifyFlowState } from '@/types/incident';
import type { AlertItem } from '@/types/alert';
import type { SpillDetail } from '@/types/spill';
import type { TrackedVessel, VesselDetail } from '@/types/vessel';
import type { SatelliteReconData } from '@/types/satellite';
import type { BacktrackingAnalysisResponse } from '@/types/backtracking';

export function createIncidentFromAlert(alert: AlertItem): Incident {
  let status: IdentifyFlowState = 'AIS_ANOMALY';
  if (alert.severity === 'critical') {
    status = 'SLICK_DETECTED';
  } else if (alert.title.toLowerCase().includes('sar')) {
    status = 'SAR_ACQUIRED';
  }

  const mmsi = alert.mmsi || (alert.id.startsWith('AIS-') ? alert.id.replace('AIS-', '') : alert.id);
  return {
    incidentId: alert.id,
    mmsi,
    status,
    timestamp: alert.timestamp,
    ais: {
      mmsi,
      imo: alert.imo,
      speed: alert.speed,
    },
    risk: alert.severity === 'critical' ? 'High' : alert.severity === 'warning' ? 'Medium' : 'Low',
  };
}

export function createIncidentFromSpill(spill: SpillDetail): Incident {
  const mmsi = spill.nearbyTracks?.[0]?.mmsi || spill.id;
  return {
    incidentId: spill.id,
    mmsi,
    status: spill.status === 'CRITICAL' ? 'SLICK_DETECTED' : 'FUSION_PROBABLE',
    timestamp: spill.detectionTime,
    slick: {
      spillId: spill.id,
      coordinates: spill.coordinates,
      lat: spill.lat,
      lng: spill.lng,
      status: spill.status,
      confidence: spill.confidence,
      areaSqNm: spill.areaSqNm,
      detectionTime: spill.detectionTime,
      sensorSource: spill.sensorSource,
      polygonGeom: spill.polygonGeom,
    },
    risk: spill.status === 'CRITICAL' ? 'High' : 'Medium',
  };
}

export function createIncidentFromVessel(vessel: TrackedVessel | VesselDetail): Incident {
  const mmsi = vessel.mmsi || vessel.id;
  return {
    incidentId: vessel.id,
    mmsi,
    status: vessel.category === 'CANDIDATE VESSEL' ? 'FUSION_PROBABLE' : 'AIS_ANOMALY',
    timestamp: vessel.lastFix || 'Now',
    ais: {
      vesselId: vessel.id,
      mmsi,
      imo: vessel.imo,
      name: vessel.name,
      category: vessel.category,
      lat: vessel.lat,
      lng: vessel.lng,
      speed: vessel.speed,
      heading: vessel.heading,
      track: 'trajectory' in vessel && Array.isArray(vessel.trajectory)
        ? vessel.trajectory.map((t) => ({ lat: t.lat, lng: t.lng, timestamp: t.timestamp }))
        : undefined,
    },
    risk: vessel.risk,
    vessel,
  };
}
