'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Search, AlertOctagon } from 'lucide-react';
import { SpillDetail, SpillSummary } from '@/types/spill';
import EvidenceBar from '@/components/shared/EvidenceBar';
import StatusBadge from '@/components/shared/StatusBadge';
import DataGrid, { DataCellItem } from '@/components/shared/DataGrid';
import { formatIncidentId } from '@/utils/formatters';

interface SpillDetailPanelProps {
  spill: SpillDetail | null;
  spillsList?: SpillSummary[];
  selectedSpillId?: string | null;
  onSelectSpill?: (id: string) => void;
  loading?: boolean;
}

export default function SpillDetailPanel({
  spill,
  spillsList = [],
  selectedSpillId,
  onSelectSpill,
  loading,
}: SpillDetailPanelProps) {
  const router = useRouter();
  const [tracksExpanded, setTracksExpanded] = useState(true);

  if (loading) {
    return (
      <aside className="spill-left-column">
        <div className="spill-left-content" style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem' }}>
          Loading spill intelligence & SAR telemetry...
        </div>
      </aside>
    );
  }

  if (!spill) {
    return (
      <aside className="spill-left-column">
        <div className="spill-left-content" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <AlertOctagon size={36} color="#64748b" />
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>NO ACTIVE SPILLS</div>
          <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
            No verified oil slicks or anomalous SAR signatures currently reported in the monitored sector.
          </div>
          <Link href="/dashboard" style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
            &larr; Return to Dashboard
          </Link>
        </div>
      </aside>
    );
  }

  const telemetryItems: DataCellItem[] = [
    { label: 'DETECTION TIME', value: spill.detectionTime || 'N/A' },
    { label: 'EST. AREA', value: spill.estArea || spill.areaSqNm || 'N/A' },
    {
      label: 'PERIMETER / ASPECT',
      value: spill.perimeterKm
        ? `${spill.perimeterKm} (${spill.aspectRatio || 'N/A'})`
        : 'INCONCLUSIVE',
    },
    { label: 'ESTIMATED AGE', value: spill.estimatedAge || 'INCONCLUSIVE' },
    { label: 'SENSOR SOURCE', value: spill.sensorSource || 'N/A' },
    { label: 'CONFIDENCE', value: spill.confidence || 'INCONCLUSIVE', highlight: true },
  ];

  const evidencePct = spill.evidenceLevel ? Math.min(100, Math.round((spill.evidenceLevel / 5) * 100)) : 0;

  return (
    <aside className="spill-left-column">
      <div className="spill-left-content">
        {/* Header with Back button, Incident Selector, and Status */}
        <div>
          <div className="spill-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '34px', marginBottom: '0.35rem' }}>
            <div className="spill-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href="/dashboard"
                style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', transition: 'color 0.15s ease' }}
              >
                <ArrowLeft size={18} />
              </Link>
              {spillsList.length > 0 ? (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <select
                    value={selectedSpillId || spill.id}
                    onChange={(e) => onSelectSpill?.(e.target.value)}
                    style={{
                      background: 'rgba(11, 23, 35, 0.95)',
                      border: '1px solid var(--border-light)',
                      color: '#ffffff',
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      height: '34px',
                      padding: '0 28px 0 10px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono, monospace)',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {spillsList.map((s) => (
                      <option key={s.id} value={s.id} style={{ background: '#0b1723', color: '#ffffff' }}>
                        {formatIncidentId(s.id)}{s.vesselName ? ` — ${s.vesselName}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: '8px', color: 'var(--accent-cyan)', pointerEvents: 'none' }} />
                </div>
              ) : (
                <h1 className="spill-title-text" style={{ fontSize: '1.25rem', margin: 0, lineHeight: 1 }}>{formatIncidentId(spill.id)}</h1>
              )}
            </div>
            <StatusBadge variant={spill.status === 'CRITICAL' ? 'critical' : 'warning'}>
              {spill.status}
            </StatusBadge>
          </div>
          <div className="spill-coord-text" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', marginTop: '2px' }}>
            {spill.coordinates || 'COORDINATES UNAVAILABLE'}
          </div>
        </div>

        {/* 2x2 Telemetry Grid */}
        <DataGrid items={telemetryItems} columns={2} />

        {/* Evidence Strength Card */}
        <div className="glass-card" style={{ background: 'rgba(16, 27, 42, 0.9)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Evidence Strength
            </span>
            <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', fontWeight: 700 }}>
              {spill.evidenceLevel ? `Level ${spill.evidenceLevel}` : 'INCONCLUSIVE'}
            </span>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <EvidenceBar
              percentage={evidencePct}
              totalSegments={5}
              showLabel={false}
            />
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {spill.evidenceDescription || 'No multi-sensor evidence narrative registered for this event.'}
          </p>
        </div>

        {/* Nearby Historical Tracks Section */}
        <div>
          <div
            onClick={() => setTracksExpanded(!tracksExpanded)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Nearby Historical Tracks ({spill.nearbyTracks?.length || 0})
            </span>
            {tracksExpanded ? <ChevronUp size={16} color="#8896a6" /> : <ChevronDown size={16} color="#8896a6" />}
          </div>

          {tracksExpanded && (
            <div>
              {spill.nearbyTracks && spill.nearbyTracks.length > 0 ? (
                spill.nearbyTracks.map((track) => (
                  <div
                    key={track.mmsi || track.imo || Math.random()}
                    className={`spill-matched-track-card ${track.isPrimary ? 'primary' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <div>
                        <div style={{ color: '#ffffff', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem', fontWeight: 700 }}>
                          {track.mmsi ? `MMSI ${track.mmsi}` : (track.imo ? `IMO ${track.imo}` : 'TRACK UNKNOWN')}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                          {track.type} · IMO: {track.imo || 'N/A'}
                        </div>
                      </div>

                      <span
                        style={{
                          background: track.isPrimary ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${track.isPrimary ? 'rgba(251, 191, 36, 0.4)' : 'var(--border-light)'}`,
                          color: track.isPrimary ? '#fbbf24' : '#94a3b8',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '3px',
                        }}
                      >
                        MATCH: {track.matchScore}%
                      </span>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {track.lastPosTime}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  NO AIS TRAJECTORY AVAILABLE
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Backtrack Action */}
      <div className="spill-bottom-sticky-bar">
        <button
          className="btn-primary-cyan"
          onClick={() => router.push(`/backtracking?incidentId=${encodeURIComponent(spill.id)}`)}
          style={{ width: '100%', padding: '0.75rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Search size={16} />
          <span>BACKTRACK INCIDENT</span>
        </button>
        <div className="spill-bottom-subtitle" style={{ textAlign: 'center', marginTop: '4px' }}>
          Initiates hydrodynamic modeling to estimate origin point.
        </div>
      </div>
    </aside>
  );
}
