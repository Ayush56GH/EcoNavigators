'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ModalProps } from '@/types/modal';
import { dataSources, glossaryItems } from '@/data/researchNote';

export function ResearchNoteModal({ isOpen, onClose }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay active"
      role="dialog"
      aria-modal="true"
      aria-label="Research note"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-content">
        <button
          className="modal-close"
          aria-label="Close research note"
          onClick={onClose}
          type="button"
        >
          <X />
        </button>

        <div className="note-header">
          <div className="note-tag">RESEARCH NOTE / 01</div>
          <h2 className="note-title">From a detected slick to a clearer story</h2>
          <p className="note-subtitle">
            A concise overview of how EcoNavigators connects satellite observations, vessel movement and backtracking to support marine oil-spill investigation.
          </p>
        </div>

        <div className="note-section">
          <h4>Purpose</h4>
          <p>
            EcoNavigators is designed to help people understand what may have happened during a marine pollution event. It identifies possible relationships between a detected slick and nearby vessel activity; it does not automatically prove responsibility.
          </p>
        </div>

        <div className="note-section">
          <h4>1. The question we are trying to answer</h4>
          <p>
            An oil slick may be detected after it has moved from its original location. Currents, wind and time can make the source difficult to understand from one image alone. Investigators need to compare where the slick was seen, where it may have travelled, and which vessels were nearby during the relevant period.
          </p>
        </div>

        <div className="note-section">
          <h4>2. The connected workflow</h4>
          <p>
            <strong>01 Spot the spill:</strong> Satellite imagery is reviewed to identify an area that may contain an oil slick.<br />
            <strong>02 Understand its movement:</strong> Observed positions and environmental context help estimate how the slick may have moved over time.<br />
            <strong>03 Look at vessel movements:</strong> Historical AIS records provide vessel locations, tracks and timing around the affected area.<br />
            <strong>04 Connect the evidence:</strong> Spatial and time relationships are compared to identify vessels of interest for further review.<br />
            <strong>05 Build an investigation trail:</strong> Observations, movement paths and assumptions can be viewed together as supporting context.
          </p>
        </div>

        <div className="note-section">
          <h4>3. What each data source contributes</h4>
          <div className="table-wrap">
            <table className="note-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Contribution</th>
                  <th>Important Limitation</th>
                </tr>
              </thead>
              <tbody>
                {dataSources.map((item) => (
                  <tr key={item.source}>
                    <td><strong>{item.source}</strong></td>
                    <td>{item.contribution}</td>
                    <td>{item.limitation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="note-section">
          <h4>4. How results should be used</h4>
          <p>
            EcoNavigators supports investigation and prioritization. A vessel with a strong spatial and temporal association should be treated as a vessel of interest, not as proof of cause. Any conclusion should be checked against additional evidence, local knowledge, environmental conditions and relevant authorities.
          </p>
          <p className="note-principle">
            <em>Core principle: connect the pieces clearly, communicate uncertainty honestly, and keep final judgment with the people conducting the investigation.</em>
          </p>
        </div>

        <div className="note-section">
          <h4>5. Plain-language glossary</h4>
          <p>
            {glossaryItems.map((item) => (
              <React.Fragment key={item.term}>
                • <strong>{item.term}:</strong> {item.definition}
                <br />
              </React.Fragment>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
