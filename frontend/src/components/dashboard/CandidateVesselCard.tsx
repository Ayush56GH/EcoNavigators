'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateVessel } from '@/types/dashboard';
import EvidenceBar from '@/components/shared/EvidenceBar';
import Link from 'next/link';
import { Radio, Ship, AlertCircle, Search, Loader2 } from 'lucide-react';
import CopernicusReconModal from '@/components/satellite/CopernicusReconModal';
import { identifyVessel } from '@/services/api';

interface CandidateVesselCardProps {
  vessel: CandidateVessel | null;
  loading?: boolean;
}

export default function CandidateVesselCard({ vessel, loading }: CandidateVesselCardProps) {
  const router = useRouter();
  const [showSatelliteModal, setShowSatelliteModal] = useState<boolean>(false);
  const [identifying, setIdentifying] = useState<boolean>(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  const handleIdentify = async () => {
    const targetMmsi = vessel?.mmsi || vessel?.id;
    if (!targetMmsi) return;
    setIdentifying(true);
    setIdentifyError(null);
    try {
      const incident = await identifyVessel(targetMmsi, vessel?.lat, vessel?.lng);
      router.push(`/incidents/${encodeURIComponent(incident.incidentId)}`);
    } catch (err: any) {
      console.error('[CandidateVesselCard] Identification failed:', err);
      setIdentifyError(err?.message || 'Identification failed');
      setIdentifying(false);
    }
  };

  if (loading) {
    return (
      <section>
        <div className="glass-card" style={{ background: 'rgba(16, 27, 42, 0.85)', padding: '1.25rem' }}>
          <div className="kpi-title" style={{ marginBottom: '0.85rem' }}>
            Candidate Vessel Analysis
          </div>
          <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono, monospace)' }}>
            Loading candidate vessel telemetry...
          </div>
        </div>
      </section>
    );
  }

  if (!vessel) {
    return (
      <section>
        <div className="glass-card" style={{ background: 'rgba(16, 27, 42, 0.85)', padding: '1.25rem' }}>
          <div className="kpi-title" style={{ marginBottom: '0.85rem' }}>
            Candidate Vessel Analysis
          </div>
          <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Ship size={24} color="#64748b" />
            <span style={{ fontSize: '0.8rem' }}>No suspect vessel currently associated with active anomalies</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section>
        <div className="glass-card" style={{ background: 'rgba(16, 27, 42, 0.85)', padding: '1.25rem' }}>
          <div className="kpi-title" style={{ marginBottom: '0.85rem' }}>
            Candidate Vessel Analysis
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.5px' }}>
                {vessel.name}
              </div>
              <div style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem', marginTop: '2px' }}>
                {vessel.imo && vessel.imo !== 'N/A' && !vessel.imo.startsWith('UNKNOWN')
                  ? (vessel.imo.startsWith('IMO') ? vessel.imo : `IMO ${vessel.imo}`)
                  : `MMSI ${vessel.mmsi}`}
              </div>
            </div>
            <span className="status-badge muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
              {vessel.type}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
            <span>Speed: <strong style={{ color: '#ffffff' }}>{vessel.speed}</strong></span>
            <span>Heading: <strong style={{ color: '#ffffff' }}>{vessel.heading}</strong></span>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <EvidenceBar percentage={vessel.evidenceStrength ?? 0} label="Evidence Strength" />
          </div>

          {identifyError && (
            <div style={{ color: '#f43f5e', fontSize: '11px', marginBottom: '8px' }}>
              {identifyError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleIdentify}
              disabled={identifying}
              className="btn-primary-cyan"
              style={{
                flex: 1,
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: identifying ? 0.7 : 1,
                cursor: identifying ? 'not-allowed' : 'pointer',
                fontSize: '0.78rem',
              }}
              title="Run real AIS anomaly check and create canonical Incident"
            >
              {identifying ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Identifying…</span>
                </>
              ) : (
                <>
                  <Search size={14} />
                  <span>Identify</span>
                </>
              )}
            </button>

            <Link href={`/vessels?vesselId=${encodeURIComponent(vessel.id || vessel.mmsi)}`} style={{ textDecoration: 'none' }}>
              <button
                className="btn-secondary-dark"
                style={{
                  height: '34px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                View Details
              </button>
            </Link>

            {typeof vessel.lat === 'number' && typeof vessel.lng === 'number' && (
              <button
                onClick={() => setShowSatelliteModal(true)}
                className="btn-outline-cyan"
                style={{
                  height: '34px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Inspect Copernicus Sentinel SAR Satellite Imagery"
              >
                <Radio size={14} />
                <span>Satellite Recon</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Copernicus Satellite Reconnaissance Modal */}
      {typeof vessel.lat === 'number' && typeof vessel.lng === 'number' && (
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
