'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Vessel3DProps {
  position: [number, number, number];
  rotation: [number, number, number];
  isAnomalous: boolean;
}

export function Vessel3D({ position, rotation, isAnomalous }: Vessel3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const radarRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (groupRef.current) {
      // Gentle ship pitching/rolling motion on sea
      groupRef.current.rotation.z = Math.sin(time * 2) * 0.03;
      groupRef.current.rotation.x = Math.cos(time * 1.5) * 0.02;
    }
    if (radarRef.current) {
      radarRef.current.rotation.y = time * 3;
    }
  });

  const hullColor = isAnomalous ? '#be123c' : '#1e293b';
  const deckColor = '#334155';
  const accentColor = isAnomalous ? '#fbbf24' : '#00d7b2';

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={[0.8, 0.8, 0.8]}>
      {/* Lower Hull */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2.5, 0.7, 7.5]} />
        <meshStandardMaterial color={hullColor} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Pointed Bow */}
      <mesh position={[0, 0.4, 4.2]} rotation={[0, 0, 0]}>
        <coneGeometry args={[1.25, 1.8, 4]} />
        <meshStandardMaterial color={hullColor} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Main Deck Plate */}
      <mesh position={[0, 0.78, 0.5]}>
        <boxGeometry args={[2.4, 0.1, 7]} />
        <meshStandardMaterial color={deckColor} roughness={0.6} />
      </mesh>

      {/* Cylindrical Oil Tanks on Deck */}
      {[-1.8, -0.6, 0.6, 1.8].map((zPos, idx) => (
        <group key={idx} position={[0, 1.1, zPos]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 1.8, 16]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.2, 0.1, 1.6]} />
            <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}

      {/* Bridge / Superstructure (Aft) */}
      <mesh position={[0, 1.6, -2.4]}>
        <boxGeometry args={[2.0, 1.4, 1.6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>

      {/* Bridge Windows */}
      <mesh position={[0, 1.9, -1.58]}>
        <boxGeometry args={[1.8, 0.35, 0.05]} />
        <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.8} />
      </mesh>

      {/* Exhaust Funnel Stack */}
      <mesh position={[0, 2.6, -2.7]}>
        <cylinderGeometry args={[0.3, 0.3, 0.8, 12]} />
        <meshStandardMaterial color={isAnomalous ? '#f43f5e' : '#0f172a'} />
      </mesh>

      {/* Rotating Radar Mast */}
      <mesh ref={radarRef} position={[0, 2.5, -2.0]}>
        <boxGeometry args={[0.9, 0.08, 0.15]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={1} />
      </mesh>

      {/* Status Warning Beacon Sphere */}
      {isAnomalous && (
        <mesh position={[0, 2.9, -2.0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={2} />
        </mesh>
      )}

      {/* Water Wake Effect behind vessel */}
      <mesh position={[0, 0.05, -4.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 3]} />
        <meshBasicMaterial color="#00d7b2" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
