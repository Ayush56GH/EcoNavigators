import React from 'react';
import { AnimationDemo } from '@/components/AnimationDemo';

export function DemoSection() {
  return (
    <section className="video-section" id="demo">
      <div className="tagline">· SYSTEM IN ACTION</div>
      <h2 className="method-title">Watch the platform live</h2>
      <AnimationDemo />
    </section>
  );
}
