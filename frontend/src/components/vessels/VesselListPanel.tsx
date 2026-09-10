'use client';

import React from 'react';
import { TrackedVessel } from '@/types/vessel';
import EvidenceBar from '@/components/shared/EvidenceBar';
import { Ship } from 'lucide-react';

interface VesselListPanelProps {
  vessels: TrackedVessel[];
  selectedVesselId: string;
  onSelectVessel: (vessel: TrackedVessel) => void;
  loading?: boolean;
  searchQuery?: string | null;
}

export default function VesselListPanel({
  vessels,
  selectedVesselId,
  onSelectVessel,
  loading,
  searchQuery,
}: VesselListPanelProps) {
  return (
    <aside className="dashboard-side-panel">
      <div className="dashboard-panel-inner">
        <div className="panel-section-title">
          <span>Monitored Vessels</span>
          <span className="panel-section-badge">
            {loading ? 'Syncing...' : `${vessels.length} Active`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono, monospace)' }}>
            Loading live vessel telemetry...
          </div>
        ) : vessels.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Ship size={28} color="#64748b" />
            <span style={{ fontSize: '0.85rem' }}>
              {searchQuery ? `No vessels found for "${searchQuery}"` : 'No vessels available.'}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {searchQuery
                ? 'Try searching by a different vessel name, MMSI, or IMO.'
                : 'No live AIS targets reported in the current sector.'}
            </span>
          </div>
        ) : (
          <div>
            {vessels.map((v) => {
              const isSelected = v.id === selectedVesselId;
              const isCandidate = v.category === 'CANDIDATE VESSEL';

              return (
                <div
                  key={v.id}
                  onClick={() => onSelectVessel(v)}
                  className={`vessel-list-card ${isSelected ? 'active' : ''}`}
                >
                  <div className="vessel-card-top">
                    <span
                      className={`vessel-card-category ${
                        isCandidate ? 'candidate' : ''
                      }`}
                    >
                      {v.category}
                    </span>
                    <span className="vessel-card-mmsi">MMSI: {v.mmsi || 'N/A'}</span>
                  </div>

                  <div
                    className={`vessel-card-name ${
                      isCandidate ? 'candidate' : ''
                    }`}
                  >
                    {v.name}
                  </div>

                  <div className="vessel-card-metrics">
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>SPEED: </span>
                      <span>{v.speed || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>HEADING: </span>
                      <span>{v.heading || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Evidence Bar for Candidate Vessel */}
                  {isCandidate && (
                    <div style={{ marginTop: '0.85rem' }}>
                      <EvidenceBar
                        percentage={v.evidenceStrength}
                        label="EVIDENCE STRENGTH"
                        showLabel={true}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
