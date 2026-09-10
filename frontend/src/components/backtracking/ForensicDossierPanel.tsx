'use client';

import React from 'react';
import { Compass, Clock, GitCommit, ArrowLeft, Sparkles } from 'lucide-react';
import EvidenceBar from '@/components/shared/EvidenceBar';
import { ForensicCorrelationData } from '@/types/backtracking';

interface ForensicDossierPanelProps {
  evidence?: ForensicCorrelationData | null;
  spillCharacterization?: any;
  onBackToRankings: () => void;
}

function CategoricalBadge({ level }: { level?: string | null }) {
  if (!level) return null;
  const isHigh = level === 'HIGH' || level === 'CONFIRMED';
  const isMed = level === 'MEDIUM';

  const color = isHigh ? 'var(--accent-cyan)' : isMed ? '#fbbf24' : '#94a3b8';
  const bg = isHigh ? 'rgba(0, 215, 178, 0.15)' : isMed ? 'rgba(251, 191, 36, 0.15)' : 'rgba(148, 163, 184, 0.15)';
  const border = isHigh ? 'rgba(0, 215, 178, 0.4)' : isMed ? 'rgba(251, 191, 36, 0.4)' : 'rgba(148, 163, 184, 0.3)';

  return (
    <span
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: '3px',
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '0.5px',
      }}
    >
      {level}
    </span>
  );
}

export default function ForensicDossierPanel({
  evidence,
  spillCharacterization,
  onBackToRankings,
}: ForensicDossierPanelProps) {
  const ev = evidence;

  // Real measured percentages strictly without synthetic fallback numbers
  const proximityScore = ev?.proximityEvidencePct ?? null;
  const timeScore = ev?.timeEvidencePct ?? null;
  const trajectoryScore = ev?.trajectoryEvidencePct ?? null;
  const weatheringScore = ev?.weatheringConfidencePct ?? null;

  return (
    <aside className="spill-left-column" style={{ width: '480px', minWidth: '480px' }}>
      <div className="spill-left-content" style={{ padding: '1.25rem' }}>
        {/* Back navigation */}
        <button
          onClick={onBackToRankings}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '0.5rem',
          }}
        >
          <ArrowLeft size={14} />
          <span>Candidate Rankings</span>
        </button>

        {!ev && !spillCharacterization && (
          <div
            style={{
              padding: '0.85rem',
              background: 'rgba(7, 14, 23, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginBottom: '1rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            NO FORENSIC EVIDENCE CORRELATED YET. SELECT A CANDIDATE VESSEL.
          </div>
        )}

        {/* Card 1: Proximity Correlation */}
        <div className="evidence-correlation-card">
          <div className="correlation-watermark">01</div>
          <div className="correlation-header">
            <Compass size={18} color="#00d7b2" />
            <span className="correlation-title">Proximity Correlation</span>
          </div>
          <p className="correlation-desc">
            Spatial analysis of vessel AIS track relative to the detected anomaly contour.
          </p>

          <div className="evidence-metrics-grid">
            <div className="data-cell">
              <div className="data-cell-label">CLOSEST POINT (CPA)</div>
              <div className="data-cell-value">{ev?.cpa || 'N/A'}</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">INTERSECTION AREA</div>
              <div className="data-cell-value">{ev?.intersectionArea || 'N/A'}</div>
            </div>
          </div>

          <div className="evidence-assessment-row">
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ASSESSMENT</span>
            <CategoricalBadge level={ev?.proximityLevel || 'LOW'} />
          </div>

          <EvidenceBar percentage={proximityScore} label="MEASURED EVIDENCE" variant="cyan" />
        </div>

        {/* Card 2: Time Correlation */}
        <div className="evidence-correlation-card">
          <div className="correlation-watermark">02</div>
          <div className="correlation-header">
            <Clock size={18} color="#00d7b2" />
            <span className="correlation-title">Time Correlation</span>
          </div>
          <p className="correlation-desc">
            Temporal alignment between satellite pass detection and vessel AIS broadcast.
          </p>

          <div className="evidence-metrics-grid">
            <div className="data-cell">
              <div className="data-cell-label">ANOMALY TIMESTAMP</div>
              <div className="data-cell-value" style={{ fontSize: '0.8rem' }}>{ev?.anomalyTimestamp || 'N/A'}</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">DELTA (ΔT)</div>
              <div className="data-cell-value" style={{ color: 'var(--accent-cyan)' }}>{ev?.deltaT || 'N/A'}</div>
            </div>
          </div>

          <div className="evidence-assessment-row">
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ASSESSMENT</span>
            <CategoricalBadge level={ev?.timeCorrelationLevel || 'UNCONFIRMED'} />
          </div>

          <EvidenceBar percentage={timeScore} label="MEASURED EVIDENCE" variant="cyan" />
        </div>

        {/* Card 3: Trajectory Match */}
        <div className="evidence-correlation-card">
          <div className="correlation-watermark">03</div>
          <div className="correlation-header">
            <GitCommit size={18} color="#fbbf24" />
            <span className="correlation-title">Trajectory Match</span>
          </div>
          <p className="correlation-desc">
            Comparison of slick drift model (oceanographic currents) vs vessel heading.
          </p>

          <div className="evidence-metrics-grid">
            <div className="data-cell">
              <div className="data-cell-label">HEADING VARIANCE</div>
              <div className="data-cell-value">{ev?.headingVariance || 'N/A'}</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">SPEED PROFILE</div>
              <div className="data-cell-value" style={{ color: '#fbbf24' }}>{ev?.speedProfile || 'N/A'}</div>
            </div>
          </div>

          <div className="evidence-assessment-row">
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ASSESSMENT</span>
            <CategoricalBadge level={ev?.trajectoryMatchLevel || 'MEDIUM'} />
          </div>

          <EvidenceBar percentage={trajectoryScore} label="MEASURED EVIDENCE" variant="amber" />
        </div>

        {/* Card 4: Slick Characterization & Weathering Forensic Profile */}
        <div className="evidence-correlation-card">
          <div className="correlation-watermark">04</div>
          <div className="correlation-header">
            <Sparkles size={18} color="#c026d3" />
            <span className="correlation-title">Slick Characterization & Age</span>
          </div>
          <p className="correlation-desc">
            Morphometric parameters, wave damping attenuation, and weathering age estimation.
          </p>

          <div className="evidence-metrics-grid">
            <div className="data-cell">
              <div className="data-cell-label">DAMPING CONTRAST</div>
              <div className="data-cell-value" style={{ color: spillCharacterization?.damping_contrast_db != null ? '#c084fc' : undefined }}>
                {spillCharacterization?.damping_contrast_db != null ? `${spillCharacterization.damping_contrast_db} dB` : 'N/A'}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">ASPECT RATIO / AXIS</div>
              <div className="data-cell-value">
                {spillCharacterization?.aspect_ratio != null
                  ? `${spillCharacterization.aspect_ratio}x (${spillCharacterization?.orientation_deg != null ? `${spillCharacterization.orientation_deg}°` : 'N/A'})`
                  : 'N/A'}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">ESTIMATED SLICK AGE</div>
              <div className="data-cell-value" style={{ color: spillCharacterization?.estimated_age_hours != null ? '#fb923c' : undefined }}>
                {spillCharacterization?.estimated_age_hours != null ? `~${spillCharacterization.estimated_age_hours} Hours` : 'N/A'}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">WEATHERING STAGE</div>
              <div className="data-cell-value" style={{ fontSize: '0.75rem', color: spillCharacterization?.weathering_stage ? '#00d7b2' : undefined }}>
                {spillCharacterization?.weathering_stage ? spillCharacterization.weathering_stage.replace('_', ' ') : 'NOT AVAILABLE'}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">VOLATILE EVAPORATION</div>
              <div className="data-cell-value">
                {spillCharacterization?.evaporation_fraction_pct != null ? `${spillCharacterization.evaporation_fraction_pct}%` : 'N/A'}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">BONN CLASSIFICATION</div>
              <div className="data-cell-value" style={{ fontSize: '0.72rem' }}>
                {spillCharacterization?.appearance_code || 'N/A'}
              </div>
            </div>
          </div>

          <div className="evidence-assessment-row">
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ASSESSMENT</span>
            {spillCharacterization?.weathering_stage && spillCharacterization.weathering_stage !== 'DEFERRED' ? (
              <CategoricalBadge level={spillCharacterization.weathering_stage.replace('_', ' ')} />
            ) : (
              <CategoricalBadge level="SAR DEFERRED" />
            )}
          </div>

          <EvidenceBar percentage={weatheringScore} label="WEATHERING CONFIDENCE" variant="cyan" />
        </div>
      </div>
    </aside>
  );
}
