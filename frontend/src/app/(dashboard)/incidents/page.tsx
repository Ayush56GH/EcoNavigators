'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ship, ShieldAlert, ArrowRight, RefreshCw, Search, Satellite, AlertCircle } from 'lucide-react';
import { Incident } from '@/types/incident';
import { getIncidents, identifyVessel } from '@/services/api';
import { useAppMode } from '@/utils/appMode';

export default function IncidentsPage() {
  const router = useRouter();
  const { mode } = useAppMode();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Quick identify input
  const [manualMmsi, setManualMmsi] = useState<string>('');
  const [identifying, setIdentifying] = useState<boolean>(false);
  const [identifyErr, setIdentifyErr] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getIncidents();
      setIncidents(data || []);
    } catch (err: any) {
      console.error('Failed to load incidents:', err);
      setError(err?.message || 'Unable to connect to incident registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [mode]);

  const handleManualIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMmsi.trim()) return;
    setIdentifying(true);
    setIdentifyErr(null);
    try {
      const inc = await identifyVessel(manualMmsi.trim());
      router.push(`/incidents/${encodeURIComponent(inc.incidentId)}`);
    } catch (err: any) {
      setIdentifyErr(err?.message || `Identification failed for MMSI ${manualMmsi}`);
      setIdentifying(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: 800, margin: '0 0 4px' }}>
            Incident Registry
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Active investigative incidents, AIS anomaly classifications, and backtracking dossiers.
          </p>
        </div>

        <button
          onClick={fetchIncidents}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={13} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Quick Identify Box */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(16, 27, 42, 0.85)' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
          Identify Vessel by MMSI
        </div>
        <form onSubmit={handleManualIdentify} style={{ display: 'flex', gap: '8px', maxWidth: '500px' }}>
          <input
            type="text"
            placeholder="Enter canonical 9-digit MMSI (e.g. 368091590)"
            value={manualMmsi}
            onChange={(e) => setManualMmsi(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-light)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            type="submit"
            disabled={identifying || !manualMmsi.trim()}
            className="btn-primary-cyan"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <Search size={14} />
            <span>{identifying ? 'Identifying…' : 'Identify'}</span>
          </button>
        </form>
        {identifyErr && (
          <div style={{ color: '#f43f5e', fontSize: '11px', marginTop: '6px' }}>{identifyErr}</div>
        )}
      </div>

      {/* Incidents Table / List */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem' }}>
          Recorded Incidents ({incidents.length})
        </h3>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading incidents…
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertCircle size={28} color="#64748b" style={{ margin: '0 auto 0.5rem' }} />
            <div>No incidents registered yet.</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Identify a suspect vessel from the <Link href="/alerts" style={{ color: 'var(--accent-cyan)' }}>Alerts Feed</Link> or enter an MMSI above.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {incidents.map((inc) => (
              <div
                key={inc.incidentId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: '#ffffff', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {inc.incidentId}
                    </span>
                    <span
                      style={{
                        background: inc.state === 'AIS_ANOMALY' ? 'rgba(244,63,94,0.15)' : 'rgba(0,215,178,0.12)',
                        border: `1px solid ${inc.state === 'AIS_ANOMALY' ? '#f43f5e' : 'var(--accent-cyan)'}`,
                        color: inc.state === 'AIS_ANOMALY' ? '#f43f5e' : 'var(--accent-cyan)',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {inc.state || 'RECORDED'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', padding: '1px 5px', borderRadius: '3px' }}>
                      SAR: DEFERRED
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    MMSI: <strong style={{ color: 'var(--accent-cyan)' }}>{inc.mmsi}</strong> · {inc.timestamp}
                  </div>
                </div>

                <Link href={`/incidents/${encodeURIComponent(inc.incidentId)}`} style={{ textDecoration: 'none' }}>
                  <button
                    className="btn-primary-cyan"
                    style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>View Dossier</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
