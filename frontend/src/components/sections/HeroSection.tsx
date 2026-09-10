import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="hero-section" id="home">
      <div className="hero-wrapper">
        <div className="hero-content">
          <div className="tagline">· MARINE ENVIRONMENTAL INTELLIGENCE</div>
          <h1 className="hero-title">
            Detect.<br />
            <span className="highlight">Track.</span> Trace.<br />
            Protect.
          </h1>
          <p className="hero-description">
            EcoNavigators helps detect marine oil spills using satellite imagery and connects them with vessel movement data to trace possible sources.
          </p>
          <div className="hero-actions">
            <Link className="btn-primary" href="/signup">Get started ↘</Link>
            <a className="btn-secondary" href="#demo">Explore the system ›</a>
          </div>
        </div>
        <div className="hero-visual-card">
          <Image
            className="hero-map-img"
            src="/satellite-map.png"
            alt="Satellite map visualization"
            width={600}
            height={400}
            priority
          />
        </div>
      </div>
    </section>
  );
}
