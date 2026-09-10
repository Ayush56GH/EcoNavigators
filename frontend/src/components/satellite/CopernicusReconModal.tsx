'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Eye,
  Crosshair,
  Calendar,
  Layers,
  AlertTriangle,
  Download,
  Info,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  getSatelliteRecon,
  getVesselSatelliteRecon,
} from '@/services/api';
import { SatelliteReconData } from '@/types/satellite';
import { formatCoordinate } from '@/utils/geo';

interface CopernicusReconModalProps {
  isOpen: boolean;
  onClose: () => void;
  vesselId?: string;
  vesselName?: string;
  lat?: number;
  lng?: number;
  timestamp?: string;
  anomalyType?: string;
  anomalyScore?: number;
}

export default function CopernicusReconModal({
  isOpen,
  onClose,
  vesselId,
  vesselName,
  lat,
  lng,
  timestamp,
  anomalyType,
  anomalyScore,
}: CopernicusReconModalProps) {
  const [satellite, setSatellite] = useState<'sentinel-1' | 'sentinel-2'>('sentinel-1');
  const [bufferKm, setBufferKm] = useState<number>(8);
  const [reconData, setReconData] = useState<SatelliteReconData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSatelliteData = async (mode = satellite, dist = bufferKm) => {
    setLoading(true);
    setError(null);
    try {
      let data: SatelliteReconData;
      if (vesselId) {
        data = await getVesselSatelliteRecon(vesselId, mode);
      } else if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        data = await getSatelliteRecon(lat, lng, timestamp, mode, dist);
      } else {
        throw new Error('COORDINATES UNAVAILABLE: Target position or vessel ID is required to task satellite reconnaissance.');
      }
      setReconData(data);
    } catch (err: any) {
      console.error('[CopernicusReconModal] Satellite fetch error:', err);
      setError(err?.message || 'Failed to retrieve satellite imagery from Copernicus Data Space.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSatelliteData();
    } else {
      setReconData(null);
      setError(null);
    }
  }, [isOpen, vesselId, lat, lng]);

  if (!isOpen) return null;

  const currentLat = reconData?.center?.[0] ?? lat;
  const currentLon = reconData?.center?.[1] ?? lng;
  const effectiveAnomaly = anomalyType || reconData?.anomalyType;
  const effectiveScore = anomalyScore != null
    ? Math.round(anomalyScore * (anomalyScore <= 1 ? 100 : 1))
    : (reconData?.anomalyScore != null ? Math.round(reconData.anomalyScore * 100) : null);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(11, 23, 35, 0.98)',
          border: '1.5px solid var(--accent-cyan)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 32px rgba(0, 215, 178, 0.2)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(7, 14, 23, 0.9)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(0, 215, 178, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #00d7b2',
              }}
            >
              <Radio size={18} color="#00d7b2" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Copernicus Satellite Reconnaissance
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'rgba(0, 215, 178, 0.2)',
                    color: '#00d7b2',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid rgba(0, 215, 178, 0.4)',
                  }}
                >
                  ESA / CDSE
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Live Sentinel Constellation Tasking & Orbit Overpass Correlation
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Vessel & Anomaly Context Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(16, 27, 42, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>TARGET VESSEL: </span>
            <strong style={{ color: '#ffffff' }}>{vesselName || reconData?.vesselName || 'Anomalous Vessel'}</strong>
            {vesselId && <span style={{ color: 'var(--accent-cyan)' }}> (MMSI: {vesselId})</span>}
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)' }}>COORDINATES: </span>
            <strong style={{ color: '#ffffff' }}>
              {formatCoordinate(currentLat, currentLon)}
            </strong>
          </div>

          {effectiveAnomaly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(244, 63, 94, 0.2)',
                  color: '#f43f5e',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
              >
                <AlertTriangle size={12} />
                ANOMALY: {effectiveAnomaly}
              </span>
              <span style={{ color: '#c084fc', fontWeight: 700 }}>
                {effectiveScore != null ? `${effectiveScore}% Score` : 'Score N/A'}
              </span>
            </div>
          )}
        </div>

        {/* Satellite Mode Selector Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '0.75rem 1.5rem',
            gap: '10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(7, 14, 23, 0.5)',
          }}
        >
          <button
            onClick={() => {
              setSatellite('sentinel-1');
              fetchSatelliteData('sentinel-1', bufferKm);
            }}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              transition: 'all 0.2s',
              background:
                satellite === 'sentinel-1'
                  ? 'rgba(0, 215, 178, 0.18)'
                  : 'rgba(255, 255, 255, 0.04)',
              border:
                satellite === 'sentinel-1'
                  ? '1.5px solid #00d7b2'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              color: satellite === 'sentinel-1' ? '#00d7b2' : '#94a3b8',
            }}
          >
            <Radio size={15} />
            <span>Sentinel-1 SAR (Radar / Spill Detection)</span>
          </button>

          <button
            onClick={() => {
              setSatellite('sentinel-2');
              fetchSatelliteData('sentinel-2', bufferKm);
            }}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              transition: 'all 0.2s',
              background:
                satellite === 'sentinel-2'
                  ? 'rgba(0, 215, 178, 0.18)'
                  : 'rgba(255, 255, 255, 0.04)',
              border:
                satellite === 'sentinel-2'
                  ? '1.5px solid #00d7b2'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              color: satellite === 'sentinel-2' ? '#00d7b2' : '#94a3b8',
            }}
          >
            <Eye size={15} />
            <span>Sentinel-2 Optical (MSI True Color RGB)</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {loading ? (
            <div
              style={{
                height: '360px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                background: 'rgba(7, 14, 23, 0.8)',
                borderRadius: '8px',
                border: '1px dashed rgba(0, 215, 178, 0.4)',
              }}
            >
              <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                <RefreshCw
                  size={56}
                  color="#00d7b2"
                  style={{ animation: 'spin 2s linear infinite' }}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>
                  Acquiring Copernicus Sentinel Satellite Imagery...
                </div>
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '4px',
                  }}
                >
                  Querying {satellite === 'sentinel-1' ? 'Sentinel-1 SAR Radar' : 'Sentinel-2 Optical MSI'} constellation at [{formatCoordinate(currentLat, currentLon)}]
                </div>
              </div>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '8px',
              }}
            >
              <AlertTriangle size={32} color="#f43f5e" style={{ margin: '0 auto 10px' }} />
              <div style={{ color: '#f43f5e', fontWeight: 700, marginBottom: '6px' }}>
                Satellite Reconnaissance Query Issue
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '500px', margin: '0 auto' }}>
                {error}
              </div>
              <button
                className="btn-primary-cyan"
                onClick={() => fetchSatelliteData()}
                style={{ marginTop: '1rem', padding: '6px 16px', fontSize: '0.8rem' }}
              >
                Retry Request
              </button>
            </div>
          ) : reconData ? (
            <div>
              {/* Satellite Image Canvas Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '380px',
                  backgroundColor: '#070e17',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Real Satellite Image */}
                <img
                  src={reconData.imageBase64}
                  alt={reconData.satellite}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Target Vessel Crosshair in Center */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      border: '2px solid #00d7b2',
                      borderRadius: '50%',
                      boxShadow: '0 0 16px #00d7b2',
                    }}
                  />
                  <div
                    style={{
                      marginTop: '4px',
                      background: 'rgba(7, 14, 23, 0.9)',
                      border: '1px solid #00d7b2',
                      color: '#00d7b2',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    TARGET FIX
                  </div>
                </div>

                {/* Bounding Box HUD Badges in Corners */}
                {reconData.bbox && reconData.bbox.length >= 4 && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'rgba(7, 14, 23, 0.85)',
                        padding: '3px 7px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      NW: {formatCoordinate(reconData.bbox[3], reconData.bbox[0])}
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(7, 14, 23, 0.85)',
                        padding: '3px 7px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      SE: {formatCoordinate(reconData.bbox[1], reconData.bbox[2])}
                    </div>
                  </>
                )}

                {/* Sensor Mode Watermark in Top Right */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(11, 23, 35, 0.9)',
                    border: '1px solid #00d7b2',
                    color: '#00d7b2',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {reconData.satelliteType === 'SAR' ? '⚡ SENTINEL-1 C-BAND SAR' : '☀️ SENTINEL-2 MSI OPTICAL'}
                </div>
              </div>

              {/* Satellite Metadata Grid */}
              <div
                style={{
                  marginTop: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  background: 'rgba(7, 14, 23, 0.6)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>SATELLITE:</span>
                  <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>
                    {reconData.satellite}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>RESOLUTION:</span>
                  <div style={{ color: '#00d7b2', fontWeight: 700, marginTop: '2px' }}>
                    ~{reconData.resolutionMetersPerPx} m / pixel
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>ORBIT WINDOW:</span>
                  <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>
                    {reconData.timeRange.from.slice(0, 10)} to {reconData.timeRange.to.slice(0, 10)}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>DATASET:</span>
                  <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>
                    ESA CDSE L1/L2
                  </div>
                </div>
              </div>

              {/* Sensor Interpretation Note */}
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  lineHeight: '1.4',
                }}
              >
                <Info size={13} color="#00d7b2" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{reconData.description}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            backgroundColor: 'rgba(7, 14, 23, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Attribution: Copernicus Sentinel Data (ESA / European Commission / CDSE)
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {reconData?.imageBase64 && (
              <a
                href={reconData.imageBase64}
                download={`copernicus-${satellite}-${vesselId || 'target'}.jpg`}
                style={{ textDecoration: 'none' }}
              >
                <button
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Download size={13} />
                  <span>Download Image</span>
                </button>
              </a>
            )}

            <button
              onClick={onClose}
              className="btn-primary-cyan"
              style={{ padding: '6px 16px', fontSize: '11px' }}
            >
              Close Recon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
