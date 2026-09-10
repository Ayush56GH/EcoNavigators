import { ProcessCardItem } from '@/types/sections';

export const processCards: ProcessCardItem[] = [
  {
    number: '01 / DETECTION',
    title: 'Automated Slick Spotting',
    description: 'Using SAR radar imagery from Sentinel satellites to scan coastal waters regardless of cloud cover or night hours.',
  },
  {
    number: '02 / MODELLING',
    title: 'Hydrodynamic Drift',
    description: 'Combining ocean current speeds, wave directions, and sea winds to backtrack where an oil slick originated.',
  },
  {
    number: '03 / ATTRIBUTION',
    title: 'Vessel Cross-Matching',
    description: 'Filtering AIS location records of commercial vessels passing through the trajectory window at the estimated time.',
  },
];
