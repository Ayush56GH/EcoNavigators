import React from 'react';
import { Target, AlertCircle } from 'lucide-react';
import { OperationalStats } from '@/types/dashboard';

interface OperationalOverviewProps {
  stats: OperationalStats | null;
  loading?: boolean;
  error?: string | null;
}

export default function OperationalOverview({ stats, loading, error }: OperationalOverviewProps) {
  return (
    <section>
      <div className="panel-section-title">
        <span>Operational Overview</span>
      </div>

      {error ? (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#f43f5e',
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <AlertCircle size={16} />
          <span>BACKEND OFFLINE: Telemetry counts unavailable</span>
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-title">Active Vessels</div>
          <div className="kpi-value">
            {loading ? '...' : (stats ? stats.activeVessels : '--')}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Tracked Routes</div>
          <div className="kpi-value">
            {loading ? '...' : (stats ? stats.trackedRoutes : '--')}
          </div>
        </div>
      </div>
      <div className="kpi-card-full">
        <div>
          <div className="kpi-title">Detected Spills</div>
          <div className="kpi-value" style={{ color: '#c084fc' }}>
            {loading ? '...' : (stats ? stats.detectedSpills : '--')}
          </div>
        </div>
        <Target size={30} style={{ color: '#c084fc', opacity: 0.85 }} />
      </div>
    </section>
  );
}
