import React from 'react';

interface EvidenceBarProps {
  percentage?: number | null; // 0 to 100 or null if unavailable
  totalSegments?: number;
  label?: string;
  variant?: 'cyan' | 'amber' | 'rose' | 'muted';
  showLabel?: boolean;
  showPercentage?: boolean;
}

export default function EvidenceBar({
  percentage,
  totalSegments = 4,
  label = 'Evidence Strength',
  variant = 'cyan',
  showLabel = true,
  showPercentage = true,
}: EvidenceBarProps) {
  const hasPercentage = typeof percentage === 'number' && !isNaN(percentage);
  const activeSegments = hasPercentage
    ? Math.round((Math.max(0, Math.min(100, percentage)) / 100) * totalSegments)
    : 0;

  const getVariantClass = (isActive: boolean) => {
    if (!isActive) return '';
    if (variant === 'amber') return 'active-amber';
    if (variant === 'rose') return 'active-rose';
    if (variant === 'muted') return '';
    return 'active-cyan';
  };

  return (
    <div className="evidence-bar-container">
      {showLabel && (
        <div className="evidence-bar-header">
          <span className="evidence-bar-label">{label}</span>
          <span className="evidence-bar-score" style={!hasPercentage ? { color: 'var(--text-muted)' } : undefined}>
            {hasPercentage ? (showPercentage ? `${Math.round(percentage)}%` : `${Math.round(percentage)}`) : 'N/A'}
          </span>
        </div>
      )}
      <div className="evidence-bar-segments">
        {Array.from({ length: totalSegments }).map((_, index) => {
          const isActive = index < activeSegments;
          return (
            <div
              key={index}
              className={`evidence-segment ${getVariantClass(isActive)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
