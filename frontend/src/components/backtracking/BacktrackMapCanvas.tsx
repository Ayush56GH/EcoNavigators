'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { CandidateRanking, DriftPoint, ForecastPoint } from '@/types/backtracking';

interface BacktrackMapCanvasProps {
  onViewEvidenceDetails?: () => void;
  showFloatingCandidateCard?: boolean;
  activeCandidate?: CandidateRanking | null;
  rankings?: CandidateRanking[];
  candidateTrack?: [number, number][];
  originPoint?: [number, number] | null;
  originPolygon?: [number, number][];
  hoursWindow?: 1 | 6 | 12 | 24;
  onHoursWindowChange?: (hours: 1 | 6 | 12 | 24) => void;
  driftTrajectory?: DriftPoint[];
  forecastTrajectory?: ForecastPoint[];
  spillCharacterization?: any;
  coastalImpact?: any;
  hydrodynamics?: any;
}

const BacktrackMap = dynamic(() => import('@/components/backtracking/BacktrackMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0c1a29',
        color: '#00d7b2',
        gap: '12px',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(0, 215, 178, 0.2)',
          borderTopColor: '#00d7b2',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <div style={{ fontSize: '12px', letterSpacing: '1px' }}>
        EXECUTING GNOME HYDRODYNAMIC DRIFT SIMULATION...
      </div>
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  ),
});

export default function BacktrackMapCanvas({
  onViewEvidenceDetails,
  showFloatingCandidateCard = false,
  activeCandidate,
  rankings = [],
  candidateTrack,
  originPoint,
  originPolygon,
  hoursWindow = 12,
  onHoursWindowChange,
  driftTrajectory,
  forecastTrajectory,
  spillCharacterization,
  coastalImpact,
  hydrodynamics,
}: BacktrackMapCanvasProps) {
  return (
    <div className="map-canvas-container">
      <BacktrackMap
        onViewEvidenceDetails={onViewEvidenceDetails}
        showFloatingCandidateCard={showFloatingCandidateCard}
        activeCandidate={activeCandidate}
        rankings={rankings}
        candidateTrack={candidateTrack}
        originPoint={originPoint}
        originPolygon={originPolygon}
        hoursWindow={hoursWindow}
        onHoursWindowChange={onHoursWindowChange}
        driftTrajectory={driftTrajectory}
        forecastTrajectory={forecastTrajectory}
        spillCharacterization={spillCharacterization}
        coastalImpact={coastalImpact}
        hydrodynamics={hydrodynamics}
      />
    </div>
  );
}
