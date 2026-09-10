import type { SpillDetail } from '@/types/spill';

export const mockSpillDetail: SpillDetail = {
  id: 'Spill-084',
  coordinates: '28.5383° N, 89.5632° W',
  lat: 28.5383,
  lng: -89.5632,
  status: 'CRITICAL',
  detectionTime: '2023-10-24 14:32Z',
  estArea: '14.2 sq nmi',
  sensorSource: 'Sentinel-1 SAR',
  confidence: '98% High',
  evidenceLevel: 5,
  evidenceDescription:
    'Strong synthetic aperture radar signature corroborated with multispectral anomaly. Clear trajectory established.',
  areaSqNm: '41.2 SQ NM',
  nearbyTracks: [
    {
      imo: 'IMO-9384756',
      type: 'Crude Oil Tanker',
      matchScore: 84,
      lastPosTime: 'Last pos: -1.2h from spill time',
      isPrimary: true,
    },
    {
      imo: 'IMO-1192837',
      type: 'Bulk Carrier',
      matchScore: 12,
      lastPosTime: 'Last pos: -4.5h from spill time',
      isPrimary: false,
    },
  ],
  estimatedOriginStatus:
    'Modeling Complete. Waiting for backtrack execution to visualize trajectory.',
  polygonGeom: [
    [28.60, -89.65],
    [28.62, -89.45],
    [28.48, -89.40],
    [28.45, -89.62],
  ],
};
