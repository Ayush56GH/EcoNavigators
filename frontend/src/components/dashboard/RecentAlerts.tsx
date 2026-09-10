import React from 'react';
import Link from 'next/link';
import { AlertTriangle, BellOff } from 'lucide-react';
import { AlertItem } from '@/types/alert';

interface RecentAlertsProps {
  alerts: AlertItem[];
  loading?: boolean;
}

export default function RecentAlerts({ alerts, loading }: RecentAlertsProps) {
  return (
    <section>
      <div className="panel-section-title">
        <span>Recent Alerts ({alerts.length})</span>
      </div>

      {loading ? (
        <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
          Loading real-time alert feed...
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <BellOff size={18} color="#64748b" />
          <span>No unacknowledged alerts</span>
        </div>
      ) : (
        <div>
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isAisAlert = Boolean(alert.mmsi || alert.id.startsWith('AIS-'));
            const alertHref = isAisAlert
              ? (alert.mmsi ? `/incidents/${encodeURIComponent(alert.mmsi)}` : '/alerts')
              : `/spills?spillId=${encodeURIComponent(alert.id)}`;
            return (
              <Link
                key={alert.id}
                href={alertHref}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className={`alert-card-item ${isCritical ? 'critical' : 'warning'}`}>
                  <div className="alert-card-header">
                    <div className={`alert-type-label ${isCritical ? 'critical' : 'warning'}`}>
                      {isCritical ? <AlertTriangle size={13} /> : <BellOff size={13} />}
                      <span>{isCritical ? 'High Priority' : 'Medium'}</span>
                    </div>
                    <span className="alert-time">{alert.timestamp}</span>
                  </div>
                  <div className="alert-card-title">{alert.title}</div>
                  {alert.coordinates && (
                    <div className="alert-card-coords">Coord: {alert.coordinates}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
