'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ScanConeProps {
  satPos: [number, number, number];
  targetPos: [number, number, number];
  visible: boolean;
}

export function ScanCone({ satPos, targetPos, visible }: ScanConeProps) {
  const coneRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (coneRef.current && visible) {
      const time = clock.getElapsedTime();
      const mat = coneRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.22 + Math.sin(time * 5) * 0.08;
    }
  });

  if (!visible) return null;

  // Compute length and midpoint between satellite and sea target
  const satVec = new THREE.Vector3(...satPos);
  const targetVec = new THREE.Vector3(...targetPos);
  const dir = new THREE.Vector3().subVectors(targetVec, satVec);
  const height = dir.length();
  const midPoint = new THREE.Vector3().addVectors(satVec, targetVec).multiplyScalar(0.5);

  return (
    <group position={midPoint.toArray()}>
      <mesh ref={coneRef} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.5, 12, height, 32, 1, true]} />
        <meshBasicMaterial
          color="#00d7b2"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          wireframe={false}
        />
      </mesh>
    </group>
  );
}
