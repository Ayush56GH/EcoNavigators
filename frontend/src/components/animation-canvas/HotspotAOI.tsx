'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HotspotAOIProps {
  position: [number, number, number];
  visible: boolean;
  isScanning: boolean;
}

export function HotspotAOI({ position, visible, isScanning }: HotspotAOIProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const reticleRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (ringRef.current && visible) {
      ringRef.current.rotation.z = time * 0.5;
    }
    if (reticleRef.current && visible) {
      reticleRef.current.rotation.y = -time * 0.8;
    }
  });

  if (!visible) return null;

  return (
    <group position={position}>
      {/* 5km Radius Buffer Ring on Sea Surface */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[11.5, 12, 64]} />
        <meshBasicMaterial
          color={isScanning ? '#00d7b2' : '#fbbf24'}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Target Reticle Lines */}
      <group ref={reticleRef} position={[0, 0.1, 0]}>
        {[-12, 12].map((x, idx) => (
          <mesh key={idx} position={[x / 2, 0, 0]}>
            <boxGeometry args={[2, 0.05, 0.2]} />
            <meshBasicMaterial color={isScanning ? '#00d7b2' : '#fbbf24'} />
          </mesh>
        ))}
        {[-12, 12].map((z, idx) => (
          <mesh key={`z-${idx}`} position={[0, 0, z / 2]}>
            <boxGeometry args={[0.2, 0.05, 2]} />
            <meshBasicMaterial color={isScanning ? '#00d7b2' : '#fbbf24'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
