import React from 'react';
import { processCards } from '@/data/processCards';

export function MonitoringChallengeSection() {
  return (
    <section className="process-section" id="monitoring-challenge">
      <div className="process-container">
        <div className="process-header">
          <div className="tagline-light">· THE MONITORING CHALLENGE</div>
          <h2 className="process-title">
            Bridging satellite data<br />and maritime enforcement.
          </h2>
        </div>
        <div className="process-grid">
          {processCards.map((card) => (
            <article className="process-card" key={card.number}>
              <div className="card-num">{card.number}</div>
              <h3 className="card-heading">{card.title}</h3>
              <p className="card-body">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
