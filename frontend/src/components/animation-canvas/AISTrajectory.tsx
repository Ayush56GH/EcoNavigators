'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface AISTrajectoryProps {
  pathPoints: [number, number, number][];
  isAnomalous: boolean;
}

export function AISTrajectory({ pathPoints, isAnomalous }: AISTrajectoryProps) {
  const curve = useMemo(() => {
    const vectorPoints = pathPoints.map(p => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(vectorPoints);
  }, [pathPoints]);

  const lineGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, 0.12, 8, false);
  }, [curve]);

  return (
    <group>
      {/* Dynamic 3D Trajectory Ribbon */}
      <mesh geometry={lineGeometry}>
        <meshBasicMaterial
          color={isAnomalous ? '#fbbf24' : '#00d7b2'}
          wireframe={false}
        />
      </mesh>

      {/* AIS Waypoint Dots */}
      {pathPoints.map((pt, i) => {
        const isTurnPoint = i >= pathPoints.length - 3;
        return (
          <mesh key={i} position={pt}>
            <sphereGeometry args={[isTurnPoint ? 0.35 : 0.2, 16, 16]} />
            <meshBasicMaterial
              color={isTurnPoint && isAnomalous ? '#f43f5e' : '#00d7b2'}
            />
          </mesh>
        );
      })}
    </group>
  );
}
