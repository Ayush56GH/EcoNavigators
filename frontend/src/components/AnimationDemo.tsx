'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SceneContainer } from './animation-canvas/SceneContainer';

const stages = [
  { number: '01', title: 'AIS anomaly', detail: 'Loitering & speed drop detected', tag: 'VESSEL TELEMETRY' },
  { number: '02', title: 'Hotspot AOI', detail: '5 km search reticle generated', tag: 'SPATIAL BUFFER' },
  { number: '03', title: 'SAR sweep', detail: 'Sentinel-1 radar sweeps ocean', tag: 'RADAR IMAGERY' },
  { number: '04', title: 'Oil detected', detail: 'Spill confirmed & attributed (89%)', tag: 'DETECTED SPILL' },
];

export function AnimationDemo() {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const totalScrollable = rect.height - windowHeight;

    if (totalScrollable <= 0) return;

    // Calculate normalized progress (0.0 to 1.0)
    const currentScroll = -rect.top;
    const rawProgress = Math.max(0, Math.min(1, currentScroll / totalScrollable));
    setProgress(rawProgress);

    // Calculate active stage from continuous progress
    const stageIndex = Math.min(
      stages.length - 1,
      Math.floor(rawProgress * stages.length)
    );
    setCurrentStage(stageIndex);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  const scrollToStage = (index: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || window.pageYOffset;
    const sectionTop = rect.top + scrollTop;
    const windowHeight = window.innerHeight;
    const totalScrollable = rect.height - windowHeight;
    const targetFraction = index / (stages.length - 1);
    const targetScroll = sectionTop + targetFraction * Math.max(0, totalScrollable);

    window.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });
  };

  return (
    <div className="animation-scroll-wrapper" ref={containerRef}>
      <div className="animation-sticky-frame">
        <div className="animation-demo-card">
          {/* Top Stage Navigation Cards */}
          <div className="animation-timeline">
            {stages.map((stage, index) => (
              <button
                className={`animation-step ${currentStage === index ? 'active' : ''}`}
                key={stage.number}
                onClick={() => scrollToStage(index)}
                type="button"
              >
                <div className="animation-step-header">
                  <span className="step-num">{stage.number}</span>
                  <span className="step-tag">{stage.tag}</span>
                </div>
                <strong className="step-name">{stage.title}</strong>
                <small className="step-desc">{stage.detail}</small>
              </button>
            ))}
          </div>

          {/* 3D WebGL Canvas Stage */}
          <div className="animation-stage">
            <SceneContainer currentStage={currentStage} progress={progress} />
          </div>
        </div>
      </div>
    </div>
  );
}
