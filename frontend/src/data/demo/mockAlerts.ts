import type { AlertItem } from '@/types/alert';

export const mockAlerts: AlertItem[] = [
  {
    id: 'SPL-992-BCB',
    title: 'Oil spill detected in Bay of Bengal',
    subtitle: 'Est. Extent: 4.2 km²',
    coordinates: '15.3833° N, 87.2000° E',
    timestamp: 'T-0:02:14 (Just now)',
    severity: 'critical',
    actionLabel: 'Investigate Spill',
  },
  {
    id: 'SPL-084',
    title: 'Candidate identified for Spill-084',
    subtitle: 'Evidence Strength: Medium',
    coordinates: '28.5383° N, 89.5632° W',
    timestamp: 'T-1:45:00 (12m ago)',
    severity: 'warning',
    actionLabel: 'View Evidence',
    matchConfidence: 78,
    imo: '9123456',
    speed: '14.2 kn',
  },
  {
    id: 'SYS-994',
    title: 'SAR Satellite Pass Completed',
    subtitle: 'New Synthetic Aperture Radar Imagery available for sector Alpha-Niner. Processing complete.',
    timestamp: 'T-4:12:30',
    severity: 'info',
    actionLabel: 'Load Layer',
  },
  {
    id: 'AIS-44321',
    title: 'Vessel IMO-44321 signal lost',
    subtitle: 'Zone 4B Anomaly detected',
    coordinates: '24.5000° N, 89.2000° W',
    timestamp: '12m ago',
    severity: 'warning',
  },
];
