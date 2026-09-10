'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Satellite3DProps {
  position: [number, number, number];
  isScanning: boolean;
}

export function Satellite3D({ position, isScanning }: Satellite3DProps) {
  const satGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (satGroupRef.current) {
      // Gentle orbital stabilization rotation
      satGroupRef.current.rotation.y = time * 0.2;
    }
  });

  return (
    <group ref={satGroupRef} position={position} scale={[0.7, 0.7, 0.7]}>
      {/* Main Satellite Chassis */}
      <mesh>
        <boxGeometry args={[1.2, 1.2, 2.2]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Synthetic Aperture Radar (SAR) Panel (Bottom facing ocean) */}
      <mesh position={[0, -0.7, 0]}>
        <boxGeometry args={[2.8, 0.15, 1.2]} />
        <meshStandardMaterial
          color={isScanning ? '#00d7b2' : '#475569'}
          emissive={isScanning ? '#00d7b2' : '#000000'}
          emissiveIntensity={isScanning ? 0.9 : 0}
        />
      </mesh>

      {/* Left Solar Array Wing */}
      <mesh position={[-3.2, 0, 0]}>
        <boxGeometry args={[5.0, 0.08, 1.4]} />
        <meshStandardMaterial color="#0f2b5c" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Right Solar Array Wing */}
      <mesh position={[3.2, 0, 0]}>
        <boxGeometry args={[5.0, 0.08, 1.4]} />
        <meshStandardMaterial color="#0f2b5c" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Gold Foil Thermal Insulation Accents */}
      <mesh position={[0, 0, 1.15]}>
        <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
        <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Optical Sensor Dome */}
      <mesh position={[0, -0.6, 0.8]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#00d7b2" emissive="#00d7b2" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}
