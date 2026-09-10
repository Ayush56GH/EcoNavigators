'use client';

import React from 'react';
import dynamic from 'next/dynamic';

import { CandidateVessel } from '@/types/dashboard';
import { SpillSummary, SpillDetail } from '@/types/spill';

interface MapCanvasProps {
  showCandidateOverlay?: boolean;
  showSpillOverlay?: boolean;
  candidate?: CandidateVessel | null;
  spills?: Array<SpillSummary | SpillDetail>;
}

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
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
        INITIALIZING SATELLITE & RADAR TILES...
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

export default function MapCanvas({
  showCandidateOverlay = true,
  showSpillOverlay = true,
  candidate,
  spills = [],
}: MapCanvasProps) {
  return (
    <div className="map-canvas-container">
      <LeafletMap
        showCandidateOverlay={showCandidateOverlay}
        showSpillOverlay={showSpillOverlay}
        candidate={candidate}
        spills={spills}
      />
    </div>
  );
}
