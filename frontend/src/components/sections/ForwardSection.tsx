import React from 'react';
import { Menu } from 'lucide-react';

interface ForwardSectionProps {
  onOpenResearchNote: () => void;
}

export function ForwardSection({ onOpenResearchNote }: ForwardSectionProps) {
  return (
    <section className="forward-section">
      <div className="forward-icon">
        <Menu size={22} />
      </div>
      <div className="tagline-light">· A CLEARER WAY FORWARD</div>
      <h2 className="forward-title">
        A smarter way to understand<br />
        <span>marine oil spills.</span>
      </h2>
      <p className="forward-desc">
        From satellite detection to vessel movement analysis, EcoNavigators brings the pieces together to help investigators understand what happened.
      </p>
      <div className="forward-actions">
        <a className="btn-forward-primary" href="#how-it-works">Explore how it works ↗</a>
        <button
          className="btn-forward-secondary"
          onClick={onOpenResearchNote}
          type="button"
        >
          Open research note ↘
        </button>
      </div>
    </section>
  );
}
