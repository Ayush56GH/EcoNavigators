'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function OceanSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (meshRef.current) {
      // Subtle wave oscillation effect
      const position = meshRef.current.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const u = position.getX(i);
        const v = position.getY(i);
        const z = Math.sin(u * 0.15 + time * 1.2) * Math.cos(v * 0.15 + time * 1.2) * 0.25;
        position.setZ(i, z);
      }
      position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Dynamic ocean surface mesh */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[120, 120, 48, 48]} />
        <meshStandardMaterial
          color="#040d1a"
          roughness={0.15}
          metalness={0.85}
          wireframe={false}
          flatShading
        />
      </mesh>

      {/* Harmonized Grid Lines with site teal accent */}
      <gridHelper
        ref={gridRef}
        args={[120, 60, '#00d7b2', '#09233b']}
        position={[0, 0, 0]}
      />
    </group>
  );
}
