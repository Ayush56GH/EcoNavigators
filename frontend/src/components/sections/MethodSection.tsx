'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { methodSteps } from '@/data/methodSteps';

export function MethodSection() {
  const [activeStep, setActiveStep] = useState(0);
  const currentStep = methodSteps[activeStep];

  return (
    <section className="method-section" id="how-it-works">
      <div className="method-wrapper">
        <div className="tagline">· THE ECO NAVIGATORS METHOD</div>
        <div className="method-header">
          <h2 className="method-title">
            From detection<br />
            <span className="highlight">to evidence.</span>
          </h2>
          <p className="method-subtitle">
            Click through the steps to see how simple observations become an investigation trail.
          </p>
        </div>

        <div className="method-container">
          <div className="method-tabs">
            {methodSteps.map((item, index) => (
              <button
                className={`tab-item ${activeStep === index ? 'active' : ''}`}
                onClick={() => setActiveStep(index)}
                key={item.number}
                type="button"
              >
                <span className="tab-number">{item.number}</span>
                <span className="tab-title">{item.title}</span>
                <ChevronRight className="tab-arrow" size={18} />
              </button>
            ))}
          </div>

          <div className="method-display-box">
            <div className="display-graphic">
              <span className="graphic-tag">NORTH ATLANTIC / DEMO VIEW</span>
              <div className="detected-slick-graphic">
                <span className="slick-tag-label">DETECTED SLICK</span>
              </div>
              <div className="scale-tag">
                <span>0</span>
                <i className="scale-line" />
                <span>50 km</span>
              </div>
            </div>

            <div className="display-info">
              <div className="info-step-label">STEP {currentStep.number}</div>
              <h3 className="info-title">{currentStep.title}</h3>
              <p className="info-description">{currentStep.description}</p>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${((activeStep + 1) / methodSteps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
