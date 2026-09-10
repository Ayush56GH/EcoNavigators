'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ThreeSceneDynamic = dynamic(
  () => import('./ThreeScene').then((mod) => mod.ThreeScene),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#030a12',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00d7b2',
          fontFamily: 'var(--font-mono)',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '2px solid #00d7b2',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ letterSpacing: '2px', fontSize: '0.8rem', color: '#94a3b8' }}>
          LOADING 3D INVESTIGATION ENGINE...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    ),
  }
);

interface SceneContainerProps {
  currentStage: number;
  progress: number;
}

export function SceneContainer({ currentStage, progress }: SceneContainerProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ThreeSceneDynamic currentStage={currentStage} progress={progress} />
    </div>
  );
}
