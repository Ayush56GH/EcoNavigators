import React from 'react';
import { impactItems } from '@/data/impacts';

export function WhyItMattersSection() {
  return (
    <section className="why-matters-section" id="why-it-matters">
      <div className="why-matters-container">
        <div>
          <div className="tagline-light">· WHY IT MATTERS</div>
          <h2 className="why-matters-heading">
            Useful context for<br />
            <span className="highlight-light">real-world decisions.</span>
          </h2>
          <p className="why-matters-desc">
            EcoNavigators is designed to support careful investigation with connected, understandable information.
          </p>
        </div>
        <div className="impact-grid">
          {impactItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className="impact-card" key={item.title}>
                <div className="impact-card-header">
                  <span className="impact-num">0{index + 1}</span>
                  <Icon className="impact-icon" />
                </div>
                <h3 className="impact-card-title">{item.title}</h3>
                <p className="impact-card-body">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
