'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraRigProps {
  progress: number; // 0 to 1 continuous scroll progress
}

// 4 Cinematic keyframes corresponding to each investigation stage
const keyframes = [
  { pos: new THREE.Vector3(10, 8, 18), look: new THREE.Vector3(-2, 0, 4) },  // Stage 0: AIS Anomaly (Vessel focus)
  { pos: new THREE.Vector3(0, 24, 22), look: new THREE.Vector3(0, 0, 2) },   // Stage 1: Hotspot AOI (Buffer zone)
  { pos: new THREE.Vector3(16, 28, 26), look: new THREE.Vector3(2, 0, 2) },  // Stage 2: SAR Sweep (Satellite angle)
  { pos: new THREE.Vector3(0, 22, 24), look: new THREE.Vector3(0, 0, 1) },   // Stage 3: Attribution (Tactical overview)
];

export function CameraRig({ progress }: CameraRigProps) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(10, 8, 18));
  const currentLook = useRef(new THREE.Vector3(-2, 0, 4));

  useFrame((_, delta) => {
    const p = Math.max(0, Math.min(1, progress));
    const totalSegments = keyframes.length - 1;
    const scaledP = p * totalSegments;
    const segmentIndex = Math.min(Math.floor(scaledP), totalSegments - 1);
    const t = scaledP - segmentIndex;

    // Smooth cubic easing between keyframe segments
    const easeT = t * t * (3 - 2 * t);

    const k1 = keyframes[segmentIndex];
    const k2 = keyframes[segmentIndex + 1] || k1;

    // Interpolate target position and look-at point
    const targetPos = new THREE.Vector3().lerpVectors(k1.pos, k2.pos, easeT);
    const targetLook = new THREE.Vector3().lerpVectors(k1.look, k2.look, easeT);

    // Continuous smooth frame damping for buttery smooth motion
    const damping = Math.min(1, delta * 5);
    currentPos.current.lerp(targetPos, damping);
    currentLook.current.lerp(targetLook, damping);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLook.current);
  });

  return null;
}
