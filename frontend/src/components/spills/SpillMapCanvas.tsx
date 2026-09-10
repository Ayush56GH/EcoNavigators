'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { SpillDetail } from '@/types/spill';

interface SpillMapCanvasProps {
  spill?: SpillDetail | null;
  matchedTrack?: Array<{ lat: number; lon: number }>;
}

const SpillMap = dynamic(() => import('@/components/spills/SpillMap'), {
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
        ANALYZING SYNTHETIC APERTURE RADAR (SAR) IMAGERY...
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

export default function SpillMapCanvas({ spill, matchedTrack }: SpillMapCanvasProps = {}) {
  return (
    <div className="map-canvas-container">
      <SpillMap spill={spill} matchedTrack={matchedTrack} />
    </div>
  );
}
