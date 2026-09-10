import { DataSourceItem, GlossaryItem } from '@/types/sections';

export const dataSources: DataSourceItem[] = [
  {
    source: 'Satellite imagery',
    contribution: 'Shows where a possible slick was observed across a broad ocean area.',
    limitation: 'Cloud, darkness, sea conditions and image timing can affect interpretation.',
  },
  {
    source: 'AIS movement data',
    contribution: 'Shows which transmitting vessels were nearby and when.',
    limitation: 'Coverage, transmission gaps and non-transmitting vessels mean it is not a complete record.',
  },
  {
    source: 'Backtracking',
    contribution: 'Helps explore earlier positions that may be consistent with slick movement.',
    limitation: 'It is an estimate that depends on environmental conditions and available observations.',
  },
];

export const glossaryItems: GlossaryItem[] = [
  {
    term: 'SAR',
    definition: 'Synthetic Aperture Radar, a satellite imaging method that can observe the surface when optical imagery is limited.',
  },
  {
    term: 'AIS',
    definition: 'Automatic Identification System, a system that shares information about vessel identity and movement.',
  },
  {
    term: 'Slick',
    definition: 'A visible or detectable area on the water surface that may be associated with oil.',
  },
  {
    term: 'Source area',
    definition: 'A location estimated for further investigation, not a confirmed origin.',
  },
];
