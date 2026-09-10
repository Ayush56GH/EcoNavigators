'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { OceanSurface } from './OceanSurface';
import { Vessel3D } from './Vessel3D';
import { AISTrajectory } from './AISTrajectory';
import { Satellite3D } from './Satellite3D';
import { ScanCone } from './ScanCone';
import { HotspotAOI } from './HotspotAOI';
import { OilSlick3D } from './OilSlick3D';
import { CameraRig } from './CameraRig';

interface ThreeSceneProps {
  currentStage: number; // 0, 1, 2, 3
  progress: number;     // 0 to 1 continuous
}

export function ThreeScene({ currentStage, progress }: ThreeSceneProps) {
  // Vessel coordinates & trajectory path
  const vesselPos: [number, number, number] = [-3.5, 0, 5.2];
  const vesselRot: [number, number, number] = [0, Math.PI * 0.7, 0];

  const trajectoryPoints: [number, number, number][] = [
    [-18, 0, -12],
    [-14, 0, -8],
    [-10, 0, -3],
    [-7, 0, 1],
    [-4.5, 0, 3.8],
    [-3.5, 0, 5.2], // Loitering point
  ];

  // Satellite coordinates & oil slick location
  const satPos: [number, number, number] = [8, 22, -6];
  const hotspotPos: [number, number, number] = [2, 0, 2];
  const slickPos: [number, number, number] = [2, 0, 2];

  const isAnomalous = currentStage >= 0;
  const isAOIGenerated = currentStage >= 1;
  const isScanning = currentStage === 2;
  const isSlickVisible = currentStage >= 2;
  const showAttribution = currentStage === 3;

  return (
    <Canvas className="w-full h-full" style={{ background: '#030a12' }}>
      <PerspectiveCamera makeDefault position={[12, 10, 22]} fov={50} />

      {/* Harmonized lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[20, 40, 20]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-10, 10, -10]} intensity={0.9} color="#00d7b2" />
      <pointLight
        position={[vesselPos[0], 4, vesselPos[2]]}
        intensity={isAnomalous ? 2.5 : 0.6}
        color={isAnomalous ? '#f43f5e' : '#00d7b2'}
      />

      {/* 3D Elements */}
      <OceanSurface />

      <Vessel3D position={vesselPos} rotation={vesselRot} isAnomalous={isAnomalous} />

      <AISTrajectory pathPoints={trajectoryPoints} isAnomalous={isAnomalous} />

      <Satellite3D position={satPos} isScanning={isScanning} />

      <ScanCone satPos={satPos} targetPos={hotspotPos} visible={isScanning} />

      <HotspotAOI position={hotspotPos} visible={isAOIGenerated} isScanning={isScanning} />

      <OilSlick3D
        position={slickPos}
        vesselPos={vesselPos}
        visible={isSlickVisible}
        showAttribution={showAttribution}
      />

      {/* Smooth Camera Rig driven by continuous scroll progress */}
      <CameraRig progress={progress} />

      {/* Controls */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={Math.PI / 6}
      />
    </Canvas>
  );
}
