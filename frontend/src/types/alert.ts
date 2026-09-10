export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  severity: AlertSeverity;
  coordinates?: string;
  actionLabel?: string;
  matchConfidence?: number;
  mmsi?: string;
  imo?: string;
  speed?: string;
  acknowledged?: boolean;
}

export interface AlertAcknowledgeResponse {
  id: string;
  success: boolean;
  message: string;
}
