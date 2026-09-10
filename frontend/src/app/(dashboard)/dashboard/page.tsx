'use client';

import React, { useEffect, useState, useCallback } from 'react';
import MapCanvas from '@/components/map/MapCanvas';
import OperationalOverview from '@/components/dashboard/OperationalOverview';
import RecentAlerts from '@/components/dashboard/RecentAlerts';
import CandidateVesselCard from '@/components/dashboard/CandidateVesselCard';
import { OperationalStats, CandidateVessel } from '@/types/dashboard';
import { AlertItem } from '@/types/alert';
import { SpillSummary } from '@/types/spill';
import {
  getOperationalStats,
  getCandidateVessel,
  getAlerts,
  getSpillsList,
} from '@/services/api';
import { useAppMode } from '@/utils/appMode';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { mode } = useAppMode();
  const [stats, setStats] = useState<OperationalStats | null>(null);
  const [candidate, setCandidate] = useState<CandidateVessel | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [spills, setSpills] = useState<SpillSummary[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [liveStats, liveCandidate, liveAlerts, liveSpills] = await Promise.all([
        getOperationalStats().catch((e) => {
          console.error('[Dashboard] Error fetching operational stats:', e);
          throw e;
        }),
        getCandidateVessel().catch((e) => {
          console.warn('[Dashboard] Candidate vessel unavailable:', e);
          return null;
        }),
        getAlerts().catch((e) => {
          console.error('[Dashboard] Error fetching alerts:', e);
          throw e;
        }),
        getSpillsList().catch((e) => {
          console.warn('[Dashboard] Spills list unavailable:', e);
          return [];
        }),
      ]);

      setStats(liveStats);
      setCandidate(liveCandidate);
      setAlerts(liveAlerts || []);
      setSpills(liveSpills || []);
    } catch (err: any) {
      console.error('[DashboardPage] API failure in LIVE mode:', err);
      setError(
        err?.message ||
          'BACKEND OFFLINE: Unable to connect to maritime surveillance services.'
      );
      setStats(null);
      setCandidate(null);
      setAlerts([]);
      setSpills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, mode]);

  return (
    <>
      {/* Offline Alert Banner in LIVE mode */}
      {error && mode === 'live' && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1.5px solid #f43f5e',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '10px 20px',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(244, 63, 94, 0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <AlertTriangle size={20} color="#f43f5e" />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f43f5e', letterSpacing: '0.5px' }}>
              BACKEND OFFLINE
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{error}</div>
          </div>
          <button
            onClick={() => loadDashboardData()}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid #f43f5e',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Center Interactive Map Canvas */}
      <MapCanvas
        showCandidateOverlay={Boolean(candidate)}
        showSpillOverlay={spills.length > 0}
        candidate={candidate}
        spills={spills}
      />

      {/* Right Context Panel */}
      <aside className="dashboard-side-panel">
        <div className="dashboard-panel-inner">
          <OperationalOverview stats={stats} loading={loading} error={error} />
          <RecentAlerts alerts={alerts.slice(0, 3)} loading={loading} />
          <CandidateVesselCard vessel={candidate} loading={loading} />
        </div>
      </aside>
    </>
  );
}
