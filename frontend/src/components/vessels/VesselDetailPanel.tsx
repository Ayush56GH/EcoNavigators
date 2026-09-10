'use client';

import React, { useState } from 'react';
import { ArrowLeft, Radio, Ship, AlertCircle } from 'lucide-react';
import { TrackedVessel } from '@/types/vessel';
import EvidenceBar from '@/components/shared/EvidenceBar';
import DataGrid, { DataCellItem } from '@/components/shared/DataGrid';
import CopernicusReconModal from '@/components/satellite/CopernicusReconModal';
import { formatCoordinate } from '@/utils/geo';

interface VesselDetailPanelProps {
  vessel: TrackedVessel | null;
  onBackToList: () => void;
}

export default function VesselDetailPanel({
  vessel,
  onBackToList,
}: VesselDetailPanelProps) {
  const [showSatelliteModal, setShowSatelliteModal] = useState<boolean>(false);

  if (!vessel) {
    return (
      <aside className="dashboard-side-panel">
        <div className="dashboard-panel-inner">
          <button
            onClick={onBackToList}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              padding: 0,
              marginBottom: '0.5rem',
            }}
          >
            <ArrowLeft size={14} />
            <span>All Monitored Vessels</span>
          </button>
          <div className="glass-card" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Ship size={32} color="#64748b" style={{ margin: '0 auto 8px' }} />
            <div>No vessel selected</div>
          </div>
        </div>
      </aside>
    );
  }

  const hasCoords = typeof vessel.lat === 'number' && typeof vessel.lng === 'number';
  const positionText = hasCoords
    ? formatCoordinate(vessel.lat, vessel.lng)
    : (vessel.lastCoords && vessel.lastCoords !== 'N/A' ? vessel.lastCoords : 'Position unavailable');

  const telemetryData: DataCellItem[] = [
    { label: 'SPEED', value: vessel.speed || 'N/A' },
    { label: 'HEADING', value: vessel.heading || 'N/A' },
    { label: 'DRAFT', value: vessel.draft || 'N/A' },
    { label: 'STATUS', value: vessel.status || 'Underway', highlight: true },
  ];

  return (
    <>
      <aside className="dashboard-side-panel">
        <div className="dashboard-panel-inner">
          {/* Back navigation button */}
          <button
            onClick={onBackToList}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              padding: 0,
              marginBottom: '0.25rem',
            }}
          >
            <ArrowLeft size={14} />
            <span>All Monitored Vessels</span>
          </button>

          <div className="glass-card" style={{ background: 'rgba(16, 27, 42, 0.95)', padding: '1.5rem' }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.8px' }}>
                {vessel.category}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                MMSI: {vessel.mmsi || 'N/A'}
              </span>
            </div>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
              {vessel.name}
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              IMO: {vessel.imo || 'N/A'} • Position: {positionText}
            </p>

            {/* Copernicus Satellite Recon Button */}
            <div style={{ marginBottom: '1rem' }}>
              {hasCoords ? (
                <button
                  onClick={() => setShowSatelliteModal(true)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(0, 215, 178, 0.22) 0%, rgba(14, 165, 233, 0.15) 100%)',
                    border: '1.5px solid #00d7b2',
                    color: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px rgba(0, 215, 178, 0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={16} color="#00d7b2" />
                    <span>Copernicus Satellite Recon</span>
                  </div>
                  <span
                    style={{
                      background: '#00d7b2',
                      color: '#070e17',
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    LIVE ESA SAR
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    color: 'var(--text-muted)',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>Position unavailable for satellite tasking</span>
                </div>
              )}
            </div>

            {/* Action Row */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button className="btn-primary-cyan" style={{ flex: 1 }} onClick={onBackToList}>
                Back to Vessel List
              </button>
            </div>

            {/* 2x2 Telemetry Data Grid */}
            <div style={{ marginBottom: '1.25rem' }}>
              <DataGrid items={telemetryData} columns={2} />
            </div>

            {/* Evidence Strength Meter */}
            <div style={{ marginBottom: '1.25rem' }}>
              <EvidenceBar percentage={vessel.evidenceStrength || 0} label="EVIDENCE STRENGTH" />
            </div>
          </div>
        </div>
      </aside>

      {/* Copernicus Satellite Reconnaissance Modal */}
      {hasCoords && (
        <CopernicusReconModal
          isOpen={showSatelliteModal}
          onClose={() => setShowSatelliteModal(false)}
          vesselId={vessel.mmsi}
          vesselName={vessel.name}
          lat={vessel.lat}
          lng={vessel.lng}
        />
      )}
    </>
  );
}
