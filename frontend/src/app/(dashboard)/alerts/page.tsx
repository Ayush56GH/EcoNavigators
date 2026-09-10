'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ShieldAlert,
  Radio,
  Filter,
  ArrowRight,
  MapPin,
  Ship,
  Zap,
  CheckCircle,
  RefreshCw,
  Satellite,
  WifiOff,
  Search,
} from 'lucide-react';
import EvidenceBar from '@/components/shared/EvidenceBar';
import CopernicusReconModal from '@/components/satellite/CopernicusReconModal';
import { AlertItem } from '@/types/alert';
import { getAlerts, acknowledgeAlert, identifyVessel } from '@/services/api';
import { useAppMode } from '@/utils/appMode';

export default function AlertsPage() {
  const router = useRouter();
  const { mode } = useAppMode();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [identifyingId, setIdentifyingId] = useState<string | null>(null);

  // Satellite recon modal state
  const [reconModal, setReconModal] = useState<{
    open: boolean;
    alertId?: string;
    alertTitle?: string;
    lat?: number;
    lng?: number;
    timestamp?: string;
  }>({ open: false });

  const fetchAlerts = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const liveAlerts = await getAlerts();
      setAlerts(liveAlerts || []);
    } catch (err: any) {
      console.error('[AlertsPage] Error fetching live alerts:', err);
      setError(
        err?.message ||
          'BACKEND OFFLINE: Unable to connect to real-time alert dispatch service.'
      );
      setAlerts([]);
    } finally {
      setLastRefresh(new Date());
      if (!silent) setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, mode]);

  // Auto-refresh every 30 seconds (silent)
  useEffect(() => {
    const interval = setInterval(() => fetchAlerts(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAcknowledge = async (alertId: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const success = await acknowledgeAlert(alertId);
      if (success) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        triggerToast(`Alert ${alertId} acknowledged and dismissed.`);
      } else {
        triggerToast(`Could not acknowledge alert ${alertId}`);
      }
    } catch (err: any) {
      triggerToast(err?.message || `Failed to acknowledge alert ${alertId}`);
    }
  };

  const handleOpenRecon = (alert: AlertItem, e: React.MouseEvent) => {
    e.preventDefault();
    let lat: number | undefined;
    let lng: number | undefined;
    if (alert.coordinates) {
      const decMatch = alert.coordinates.match(/([\d.]+)°\s*([NS]),?\s*([\d.]+)°\s*([EW])/i);
      if (decMatch) {
        lat = parseFloat(decMatch[1]) * (decMatch[2].toUpperCase() === 'S' ? -1 : 1);
        lng = parseFloat(decMatch[3]) * (decMatch[4].toUpperCase() === 'W' ? -1 : 1);
      }
    }
    setReconModal({
      open: true,
      alertId: alert.id,
      alertTitle: alert.title,
      lat,
      lng,
      timestamp: alert.timestamp,
    });
  };

  const handleIdentifyAlert = async (alert: AlertItem, e: React.MouseEvent) => {
    e.preventDefault();
    const mmsi = alert.mmsi || (alert.id.startsWith('AIS-') ? alert.id.replace('AIS-', '') : null);
    if (!mmsi) return;

    setIdentifyingId(alert.id);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (alert.coordinates) {
        const decMatch = alert.coordinates.match(/([\d.-]+)[,\s]+([\d.-]+)/);
        if (decMatch) {
          lat = parseFloat(decMatch[1]);
          lng = parseFloat(decMatch[2]);
        }
      }
      const incident = await identifyVessel(mmsi, lat, lng, alert.timestamp);
      router.push(`/incidents/${encodeURIComponent(incident.incidentId)}`);
    } catch (err: any) {
      triggerToast(err?.message || `Failed to identify incident for vessel ${mmsi}`);
      setIdentifyingId(null);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === 'all') return true;
    return a.severity === filterType;
  });

  const counts = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };

  return (
    <div className="alerts-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(11, 23, 35, 0.95)',
            border: '1.5px solid var(--accent-cyan)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '13px',
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Alerts Header */}
      <div className="alerts-header">
        <div>
          <h1 className="alerts-title">Operational Alerts</h1>
          <p className="alerts-subtitle">
            Real-time anomalies and critical environmental incidents ({filteredAlerts.length} Active).
          </p>
        </div>

        <div className="alerts-header-actions">
          {/* Severity summary pills */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {counts.critical > 0 && (
              <span style={{ background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.4)', color: '#f43f5e', fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
                {counts.critical} CRITICAL
              </span>
            )}
            {counts.warning > 0 && (
              <span style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
                {counts.warning} WARNING
              </span>
            )}
            {counts.info > 0 && (
              <span style={{ background: 'rgba(0,215,178,0.1)', border: '1px solid rgba(0,215,178,0.3)', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
                {counts.info} INFO
              </span>
            )}
          </div>

          <button
            className="alerts-filter-btn"
            onClick={() => {
              const nextFilter =
                filterType === 'all'
                  ? 'critical'
                  : filterType === 'critical'
                  ? 'warning'
                  : filterType === 'warning'
                  ? 'info'
                  : 'all';
              setFilterType(nextFilter);
            }}
          >
            <Filter size={14} />
            <span>Filter: {filterType.toUpperCase()}</span>
          </button>

          <button
            className="alerts-filter-btn"
            onClick={() => fetchAlerts()}
            disabled={refreshing}
            style={{ opacity: refreshing ? 0.6 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Refreshing…' : `Refresh`}</span>
          </button>
        </div>
      </div>

      {/* Last-refreshed indicator / connection state */}
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '0.75rem', paddingLeft: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {error ? (
          <>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e', display: 'inline-block', boxShadow: '0 0 6px #f43f5e' }} />
            <span style={{ color: '#f43f5e', fontWeight: 700 }}>DISCONNECTED — Backend Offline</span>
          </>
        ) : (
          <>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00d7b2', display: 'inline-block', boxShadow: '0 0 6px #00d7b2', animation: 'pulse 2s ease-in-out infinite' }} />
            <span>LIVE FEED — Last synced: {lastRefresh.toLocaleTimeString()} · Auto-refresh: 30s</span>
          </>
        )}
      </div>

      {/* Backend Offline Banner */}
      {error && mode === 'live' && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1.5px solid rgba(244, 63, 94, 0.4)',
            borderRadius: '6px',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WifiOff size={20} color="#f43f5e" />
            <div>
              <div style={{ color: '#f43f5e', fontWeight: 800, fontSize: '12px' }}>
                BACKEND ALERT DISPATCH OFFLINE
              </div>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                {error}
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchAlerts()}
            style={{
              background: 'rgba(244, 63, 94, 0.2)',
              border: '1px solid #f43f5e',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Alerts Feed Cards */}
      <div>
        {filteredAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {error ? 'No live alerts available while backend is offline.' : `No active alerts matching filter "${filterType}".`}
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';
            const isAisAlert = !!alert.mmsi || alert.id.startsWith('AIS-');

            // Only SAR/critical spill alerts use direct spill investigation links.
            // AIS-only alerts route exclusively through the canonical Identify Incident pipeline.
            const investigateHref = isAisAlert
              ? null
              : isCritical
                ? `/spills?spillId=${encodeURIComponent(alert.id)}${alert.coordinates ? `&coord=${encodeURIComponent(alert.coordinates)}` : ''}`
                : `/backtracking?spillId=${encodeURIComponent(alert.id)}${alert.imo ? `&imo=${encodeURIComponent(alert.imo)}` : ''}`;


            return (
              <div key={alert.id} className={`alert-feed-card ${alert.severity}`}>
                <div className="alert-feed-left">
                  <div className={`alert-feed-icon-box ${alert.severity}`}>
                    {isCritical ? (
                      <AlertTriangle size={22} />
                    ) : isWarning ? (
                      <ShieldAlert size={22} />
                    ) : (
                      <Radio size={22} />
                    )}
                  </div>

                  <div className="alert-feed-body">
                    <div className="alert-feed-meta-row">
                      <span
                        style={{
                          background: isCritical
                            ? 'rgba(244, 63, 94, 0.2)'
                            : isWarning
                            ? 'rgba(251, 191, 36, 0.15)'
                            : 'rgba(0, 215, 178, 0.12)',
                          border: `1px solid ${
                            isCritical
                              ? 'rgba(244, 63, 94, 0.4)'
                              : isWarning
                              ? 'rgba(251, 191, 36, 0.4)'
                              : 'rgba(0, 215, 178, 0.35)'
                          }`,
                          color: isCritical
                            ? '#ff6b81'
                            : isWarning
                            ? '#fbbf24'
                            : 'var(--accent-cyan)',
                          fontSize: '10px',
                          fontWeight: 800,
                          letterSpacing: '0.8px',
                          padding: '2px 7px',
                          borderRadius: '3px',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {isCritical
                          ? 'HIGH PRIORITY'
                          : isWarning
                          ? 'INVESTIGATION REQUIRED'
                          : 'SYSTEM UPDATE'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {alert.timestamp}
                      </span>
                    </div>

                    <h2 className="alert-feed-title">{alert.title}</h2>

                    {alert.subtitle && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '0.2rem' }}>
                        {alert.subtitle}
                      </p>
                    )}

                    <div className="alert-feed-details">
                      {alert.coordinates && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="#8896a6" />
                          <span>{alert.coordinates}</span>
                        </div>
                      )}
                      {alert.imo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Ship size={13} color="#8896a6" />
                          <span>IMO: {alert.imo}</span>
                        </div>
                      )}
                      {alert.speed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={13} color="#8896a6" />
                          <span>Speed: {alert.speed}</span>
                        </div>
                      )}
                    </div>

                    {/* Match confidence bar — strictly shown when matchConfidence present */}
                    {typeof alert.matchConfidence === 'number' && (
                      <div style={{ marginTop: '0.6rem' }}>
                        <EvidenceBar
                          percentage={alert.matchConfidence}
                          label="VESSEL MATCH CONFIDENCE"
                          variant={isCritical ? 'cyan' : isWarning ? 'amber' : 'cyan'}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert-feed-right">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    {(alert.mmsi || alert.id.startsWith('AIS-')) && (
                      <button
                        onClick={(e) => handleIdentifyAlert(alert, e)}
                        disabled={identifyingId === alert.id}
                        style={{
                          background: 'rgba(0, 215, 178, 0.15)',
                          border: '1px solid var(--accent-cyan)',
                          color: 'var(--accent-cyan)',
                          padding: '5px 12px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: identifyingId === alert.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontWeight: 700,
                          opacity: identifyingId === alert.id ? 0.7 : 1,
                        }}
                        title="Run real AIS anomaly check and create canonical Incident"
                      >
                        <Search size={12} />
                        <span>{identifyingId === alert.id ? 'Identifying…' : 'Identify Incident'}</span>
                      </button>
                    )}

                    {investigateHref && (
                      <Link
                        href={investigateHref}
                        className={isCritical ? 'btn-investigate-critical' : 'btn-view-evidence'}
                      >
                        <span>{alert.actionLabel || (isCritical ? 'Investigate Spill' : 'View Evidence')}</span>
                        <ArrowRight size={14} />
                      </Link>
                    )}

                    {/* Satellite Recon button for alerts that have coordinates */}
                    {alert.coordinates && (
                      <button
                        onClick={(e) => handleOpenRecon(alert, e)}
                        style={{
                          background: 'rgba(0,215,178,0.08)',
                          border: '1px solid rgba(0,215,178,0.35)',
                          color: 'var(--accent-cyan)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontWeight: 600,
                        }}
                        title="View Copernicus Satellite Imagery"
                      >
                        <Satellite size={12} />
                        <span>SAR Imagery</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => handleAcknowledge(alert.id, e)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-muted)',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Acknowledge and dismiss alert"
                    >
                      <CheckCircle size={12} />
                      <span>Acknowledge</span>
                    </button>
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    ID: {alert.id}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Copernicus Satellite Recon Modal */}
      <CopernicusReconModal
        isOpen={reconModal.open}
        onClose={() => setReconModal({ open: false })}
        vesselName={reconModal.alertTitle}
        lat={reconModal.lat}
        lng={reconModal.lng}
        timestamp={reconModal.timestamp}
      />
    </div>
  );
}
