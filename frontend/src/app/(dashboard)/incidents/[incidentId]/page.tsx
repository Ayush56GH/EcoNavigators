'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Ship,
  AlertTriangle,
  ShieldCheck,
  Clock,
  MapPin,
  Compass,
  Gauge,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Satellite,
  FileText,
  Activity,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Incident } from '@/types/incident';
import { getIncident, identifyVessel, getVesselTrack } from '@/services/api';
import { formatCoordinate } from '@/utils/geo';
import { useAppMode } from '@/utils/appMode';

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { mode } = useAppMode();

  const incidentId = typeof params?.incidentId === 'string' ? params.incidentId : '';

  const [incident, setIncident] = useState<Incident | null>(null);
  const [track, setTrack] = useState<{ lat: number; lon: number; timestamp: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingTrack, setLoadingTrack] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidentData = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    setError(null);
    try {
      let inc: Incident;
      try {
        inc = await getIncident(incidentId);
      } catch (err: any) {
        if (/^\d{7,9}$/.test(incidentId)) {
          inc = await identifyVessel(incidentId);
        } else {
          throw err;
        }
      }
      setIncident(inc);

      if (inc?.mmsi) {
        setLoadingTrack(true);
        try {
          const trackRes = await getVesselTrack(inc.mmsi, 24);
          setTrack(trackRes?.track || []);
        } catch (tErr) {
          console.warn('[IncidentDetailPage] Vessel track unavailable:', tErr);
          setTrack([]);
        } finally {
          setLoadingTrack(false);
        }
      }
    } catch (err: any) {
      console.error('[IncidentDetailPage] Error loading incident:', err);
      setError(err?.message || `Unable to retrieve incident records for ${incidentId}`);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncidentData();
  }, [fetchIncidentData, mode]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-cyan)', margin: '0 auto 1rem' }} />
          <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.1rem' }}>Loading Incident Dossier…</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
            Retrieving telemetry, anomaly assessment, and backtracking correlation for {incidentId}
          </div>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Link
          href="/alerts"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Alerts</span>
        </Link>
        <div
          className="glass-card"
          style={{
            padding: '2.5rem',
            border: '1.5px solid rgba(244, 63, 94, 0.4)',
            background: 'rgba(244, 63, 94, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <AlertCircle size={28} color="#f43f5e" />
            <div>
              <div style={{ color: '#f43f5e', fontWeight: 700, fontSize: '1.1rem' }}>Incident Not Found</div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{error || 'No records match this incident identifier.'}</div>
            </div>
          </div>
          <button
            onClick={() => fetchIncidentData()}
            className="btn-primary-cyan"
            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const isAnomaly = Boolean(incident.ais?.anomalyDetected || incident.state === 'AIS_ANOMALY');
  const vessel = (incident.vessel || {}) as any;
  const lat = incident.location?.lat ?? (typeof incident.ais?.lat === 'number' ? incident.ais.lat : null);
  const lon = incident.location?.lon ?? (typeof incident.ais?.lon === 'number' ? incident.ais.lon : null);
  const coordString = formatCoordinate(lat, lon);

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top breadcrumb & back */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <Link href="/alerts" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Alerts</Link>
          <span>/</span>
          <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{incident.incidentId}</span>
        </div>

        <button
          onClick={() => fetchIncidentData()}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={13} />
          <span>Refresh Dossier</span>
        </button>
      </div>

      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: isAnomaly ? 'linear-gradient(135deg, rgba(244,63,94,0.1) 0%, rgba(16,27,42,0.9) 100%)' : 'rgba(16, 27, 42, 0.85)',
          borderLeft: `4px solid ${isAnomaly ? '#f43f5e' : 'var(--accent-cyan)'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  background: isAnomaly ? 'rgba(244,63,94,0.2)' : 'rgba(0,215,178,0.15)',
                  border: `1px solid ${isAnomaly ? '#f43f5e' : 'var(--accent-cyan)'}`,
                  color: isAnomaly ? '#f43f5e' : 'var(--accent-cyan)',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.8px',
                }}
              >
                {incident.state || (isAnomaly ? 'AIS_ANOMALY' : 'AIS_NORMAL')}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                {incident.timestamp}
              </span>
            </div>
            <h1 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px' }}>
              Incident Dossier: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{incident.incidentId}</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Real data-driven forensic correlation and vessel identification report.
            </p>
          </div>

          {/* Action Button: Backtracking */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link
              href={`/backtracking?incidentId=${encodeURIComponent(incident.incidentId)}&mmsi=${encodeURIComponent(incident.mmsi)}`}
              style={{ textDecoration: 'none' }}
            >
              <button
                className="btn-primary-cyan"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                <span>Initiate Backtracking</span>
                <ArrowRight size={15} />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: 3 Main Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Card 1: Vessel Identification */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <Ship size={18} color="#00d7b2" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Vessel Identification</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>CANONICAL MMSI</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {incident.mmsi}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>IMO NUMBER</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {vessel.imo && vessel.imo !== 'N/A' && !String(vessel.imo).startsWith('UNKNOWN') ? String(vessel.imo) : 'Not available'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>VESSEL NAME</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                {vessel.name || `Vessel ${incident.mmsi}`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>SHIP TYPE</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                {vessel.type || 'Commercial Vessel'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>SPEED (SOG)</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                {vessel.speed || 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>HEADING</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                {vessel.heading || 'N/A'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Link
              href={`/vessels?vesselId=${encodeURIComponent(incident.mmsi)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--accent-cyan)',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <span>View Full Vessel Telemetry & Map</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Card 2: AIS Anomaly & Gatekeeper */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <Activity size={18} color={isAnomaly ? '#f43f5e' : '#00d7b2'} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>AIS Anomaly Assessment</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ANOMALY STATUS</span>
              <span
                style={{
                  background: isAnomaly ? 'rgba(244,63,94,0.2)' : 'rgba(0,215,178,0.15)',
                  border: `1px solid ${isAnomaly ? '#f43f5e' : 'var(--accent-cyan)'}`,
                  color: isAnomaly ? '#f43f5e' : 'var(--accent-cyan)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {isAnomaly ? 'ANOMALY DETECTED' : 'NORMAL NAVIGATION'}
              </span>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>ANOMALY TYPE</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isAnomaly ? '#fbbf24' : '#94a3b8' }}>
                {incident.ais?.anomalyType || (isAnomaly ? 'BEHAVIORAL ANOMALY' : 'NONE')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>DETECTION REASON</div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45, background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '4px' }}>
                {incident.ais?.reason || (isAnomaly ? 'Vessel exhibited abnormal kinetic pattern' : 'Normal commercial navigation confirmed.')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>ANOMALY COORDINATES</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {coordString}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: SAR Status (Marked DEFERRED) */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <Satellite size={18} color="#fbbf24" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Satellite Reconnaissance (SAR)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PIPELINE STATUS</span>
              <span
                style={{
                  background: 'rgba(251,191,36,0.15)',
                  border: '1px solid rgba(251,191,36,0.5)',
                  color: '#fbbf24',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.5px',
                }}
              >
                DEFERRED
              </span>
            </div>

            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '4px', padding: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                Copernicus SAR & U-Net ML Deferred
              </div>
              <p style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
                SAR satellite imagery acquisition (Sentinel-1) and U-Net segmentation inference are marked as DEFERRED for future integration.
                Forensic investigation relies on real AIS kinetic telemetry and Lagrangian drift backtracking.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              <div className="data-cell">
                <div className="data-cell-label">SATELLITE</div>
                <div className="data-cell-value" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DEFERRED</div>
              </div>
              <div className="data-cell">
                <div className="data-cell-label">SLICK SEGMENTATION</div>
                <div className="data-cell-value" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DEFERRED</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AIS Trajectory History Table (Real points from getVesselTrack) */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, margin: '0 0 2px' }}>
              Real AIS Trajectory Breadcrumbs
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {track.length > 0
                ? `${track.length} verified AIS GPS points within 24h operational window`
                : loadingTrack
                ? 'Querying real AIS history…'
                : 'No track points recorded for this vessel in the active window'}
            </span>
          </div>

          <Link
            href={`/backtracking?incidentId=${encodeURIComponent(incident.incidentId)}&mmsi=${encodeURIComponent(incident.mmsi)}`}
            style={{ textDecoration: 'none' }}
          >
            <button
              className="btn-primary-cyan"
              style={{ fontSize: '11px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <span>Launch Backtracking Analysis</span>
              <ArrowRight size={13} />
            </button>
          </Link>
        </div>

        {track.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {loadingTrack ? 'Loading verified AIS points…' : 'No AIS track points available for this MMSI.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>#</th>
                  <th style={{ padding: '8px 12px' }}>TIMESTAMP (UTC)</th>
                  <th style={{ padding: '8px 12px' }}>LATITUDE</th>
                  <th style={{ padding: '8px 12px' }}>LONGITUDE</th>
                  <th style={{ padding: '8px 12px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {track.slice(0, 15).map((point, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: idx === 0 ? 'rgba(0,215,178,0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', color: '#ffffff' }}>{point.timestamp}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--accent-cyan)' }}>{point.lat.toFixed(4)}°</td>
                    <td style={{ padding: '8px 12px', color: 'var(--accent-cyan)' }}>{point.lon.toFixed(4)}°</td>
                    <td style={{ padding: '8px 12px' }}>
                      {idx === 0 ? (
                        <span style={{ color: '#00d7b2', fontSize: '10px', fontWeight: 700 }}>LATEST FIX</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>RECORDED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {track.length > 15 && (
              <div style={{ textAlign: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Showing first 15 of {track.length} points
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
