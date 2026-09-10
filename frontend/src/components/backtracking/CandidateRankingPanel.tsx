'use client';

import React from 'react';
import { Eye, Award, AlertCircle } from 'lucide-react';
import { CandidateRanking } from '@/types/backtracking';
import EvidenceBar from '@/components/shared/EvidenceBar';

interface CandidateRankingPanelProps {
  rankings?: CandidateRanking[];
  onSelectCandidate: (candidate: CandidateRanking) => void;
  onViewEvidenceDetails: (candidate: CandidateRanking) => void;
  loading?: boolean;
}

export default function CandidateRankingPanel({
  rankings = [],
  onSelectCandidate,
  onViewEvidenceDetails,
  loading,
}: CandidateRankingPanelProps) {
  return (
    <aside className="dashboard-side-panel">
      <div className="dashboard-panel-inner">
        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.2rem' }}>
            <Award size={16} />
            <span>Candidate Vessel Ranking</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {loading
              ? 'Computing Lagrangian correlation...'
              : rankings.length > 0
              ? `${rankings.length} vessel(s) correlated`
              : '0 vessels correlated'}
          </div>
        </div>

        {/* Empty State */}
        {!loading && rankings.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <AlertCircle size={32} color="#64748b" />
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
              NO CANDIDATE VESSELS FOUND
            </div>
            <div style={{ fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
              No candidate vessels matched the reverse Lagrangian drift corridor for this incident.
            </div>
          </div>
        )}

        {/* Candidate Ranking Cards */}
        <div>
          {rankings.map((c) => {
            const isRank1 = c.rank === 1;

            return (
              <div
                key={`${c.rank}-${c.mmsi || c.name}`}
                onClick={() => onSelectCandidate(c)}
                style={{
                  background: isRank1 ? 'rgba(16, 27, 42, 0.95)' : 'rgba(16, 27, 42, 0.75)',
                  border: `1.5px solid ${isRank1 ? 'var(--accent-cyan)' : 'var(--border-light)'}`,
                  borderRadius: '6px',
                  padding: '1.25rem',
                  marginBottom: '0.85rem',
                  boxShadow: isRank1 ? '0 0 16px rgba(0, 215, 178, 0.12)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isRank1 ? 'var(--accent-cyan)' : '#94a3b8', letterSpacing: '0.8px' }}>
                      RANK {c.rank}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                      {c.name}
                    </h3>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      MMSI: {c.mmsi || 'N/A'} {c.imo ? `| IMO: ${c.imo}` : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '1.35rem', fontWeight: 800, color: isRank1 ? 'var(--accent-cyan)' : '#fbbf24', lineHeight: 1 }}>
                      {c.associationScore}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Attribution Score
                    </div>
                  </div>
                </div>

                {c.anomalyType && (
                  <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginBottom: '0.4rem', fontFamily: 'var(--font-mono, monospace)' }}>
                    Anomaly: {c.anomalyType}
                  </div>
                )}

                <div style={{ margin: '0.85rem 0' }}>
                  <EvidenceBar
                    percentage={c.associationScore}
                    label="Attribution Score"
                    variant={c.variant}
                    showLabel={true}
                    showPercentage={false}
                  />
                </div>

                {isRank1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn-primary-cyan"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewEvidenceDetails(c);
                      }}
                      style={{ flex: 1, padding: '0.6rem 1rem' }}
                    >
                      View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewEvidenceDetails(c);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        padding: '0 0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
