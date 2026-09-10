import type { LucideIcon } from 'lucide-react';

export interface MethodStep {
  number: string;
  title: string;
  description: string;
}

export interface ImpactItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface ProcessCardItem {
  number: string;
  title: string;
  description: string;
}

export interface DataSourceItem {
  source: string;
  contribution: string;
  limitation: string;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}
