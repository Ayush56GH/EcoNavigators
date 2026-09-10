'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface OilSlick3DProps {
  position: [number, number, number];
  vesselPos: [number, number, number];
  visible: boolean;
  showAttribution: boolean;
}

export function OilSlick3D({ position, vesselPos, visible, showAttribution }: OilSlick3DProps) {
  const slickRef = useRef<THREE.Mesh>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);

  // Generate organic irregular oil slick polygon shape
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const radius = 5.2;
    const pointsCount = 16;
    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      const varR = radius + Math.sin(i * 2.5) * 1.8 + Math.cos(i * 1.4) * 1.2;
      const x = Math.cos(angle) * varR;
      const y = Math.sin(angle) * varR;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (slickRef.current && visible) {
      const scale = 1 + Math.sin(time * 0.8) * 0.03;
      slickRef.current.scale.set(scale, scale, 1);
    }
    if (pulseRingRef.current && showAttribution) {
      const pulse = 1 + Math.sin(time * 3) * 0.08;
      pulseRingRef.current.scale.set(pulse, pulse, 1);
    }
  });

  if (!visible) return null;

  return (
    <group position={position}>
      {/* 3D Iridescent Dark Oil Slick Mesh */}
      <mesh
        ref={slickRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08, 0]}
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#060c14"
          roughness={0.1}
          metalness={0.95}
          emissive="#1e293b"
          emissiveIntensity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glowing Slick Boundary Outline */}
      <mesh
        ref={pulseRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.09, 0]}
      >
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial
          color={showAttribution ? '#f43f5e' : '#fbbf24'}
          wireframe
          transparent
          opacity={showAttribution ? 0.85 : 0.5}
        />
      </mesh>

      {/* Confirmed Oil Detection Marker & Vector in Final Stage */}
      {showAttribution && (
        <group>
          {/* Floating 3D Telemetry Badge */}
          <Html position={[0, 3.2, 0]} center distanceFactor={28}>
            <div
              style={{
                background: 'rgba(7, 14, 23, 0.94)',
                border: '1.5px solid #00d7b2',
                borderRadius: '8px',
                padding: '0.65rem 1rem',
                boxShadow: '0 0 25px rgba(0, 215, 178, 0.35), 0 10px 30px rgba(0,0,0,0.85)',
                backdropFilter: 'blur(12px)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#f43f5e',
                    boxShadow: '0 0 10px #f43f5e',
                    animation: 'blink 1s infinite alternate',
                  }}
                />
                <strong style={{ color: '#ffffff', fontSize: '0.82rem', letterSpacing: '1px' }}>
                  OIL SLICK DETECTED
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.68rem', color: '#94a3b8' }}>
                <span>FOOTPRINT: 2.4 km²</span>
                <span style={{ color: '#00d7b2', fontWeight: 'bold' }}>MATCH: 89% TO VESSEL</span>
              </div>
            </div>
            <style>{`
              @keyframes blink {
                0% { opacity: 0.4; }
                100% { opacity: 1; }
              }
            `}</style>
          </Html>

          {/* Spatial Vector Connector Line to Source Vessel */}
          <line>
            <bufferGeometry
              attach="geometry"
              onUpdate={(geo) => {
                const p1 = new THREE.Vector3(0, 0.2, 0); // Slick center
                const p2 = new THREE.Vector3(
                  vesselPos[0] - position[0],
                  vesselPos[1] - position[1] + 0.2,
                  vesselPos[2] - position[2]
                );
                geo.setFromPoints([p1, p2]);
              }}
            />
            <lineDashedMaterial
              attach="material"
              color="#00d7b2"
              dashSize={0.5}
              gapSize={0.25}
              linewidth={2}
            />
          </line>

          {/* Centroid Marker Dot */}
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#f43f5e" />
          </mesh>
        </group>
      )}
    </group>
  );
}
