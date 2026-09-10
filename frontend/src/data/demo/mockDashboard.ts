import type { OperationalStats, CandidateVessel } from '@/types/dashboard';

export const mockOperationalStats: OperationalStats = {
  activeVessels: 124,
  trackedRoutes: 89,
  detectedSpills: 2,
};

export const mockCandidateVessel: CandidateVessel = {
  id: 'V-889',
  name: 'MT ARCTIC STAR',
  type: 'Chemical/Oil Products Tanker',
  mmsi: '312010010',
  imo: '9123456',
  speed: '14.2 kts',
  heading: '085° E',
  draft: '11.4 m',
  status: 'Underway',
  evidenceStrength: 78,
  lastFix: '2m ago',
  coordinates: "25°46'13\"N 80°09'05\"W",
  lat: 25.7704,
  lng: -80.1514,
};
