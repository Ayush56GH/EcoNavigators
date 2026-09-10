import { Droplets, Compass, Menu, Target } from 'lucide-react';
import { ImpactItem } from '@/types/sections';

export const impactItems: ImpactItem[] = [
  {
    icon: Droplets,
    title: 'Environmental',
    description: 'Support faster understanding of potential marine pollution events.',
  },
  {
    icon: Compass,
    title: 'Operational',
    description: 'Bring satellite and vessel information together for investigators.',
  },
  {
    icon: Menu,
    title: 'Economic',
    description: 'Help reduce the impact on coastal and maritime activities.',
  },
  {
    icon: Target,
    title: 'Technical',
    description: 'Combine observations, movement data and backtracking in one workflow.',
  },
];
