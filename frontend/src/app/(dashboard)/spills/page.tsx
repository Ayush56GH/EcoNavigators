'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import SpillDetailPanel from '@/components/spills/SpillDetailPanel';
import SpillMapCanvas from '@/components/spills/SpillMapCanvas';
import { getSpillsList, getSpillDetail, getVesselTrack } from '@/services/api';
import { SpillDetail, SpillSummary } from '@/types/spill';
import { useAppMode } from '@/utils/appMode';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function SpillsPageInner() {
  const searchParams = useSearchParams();
  const spillIdFromUrl = searchParams.get('spillId');
  const { mode } = useAppMode();

  const [spills, setSpills] = useState<SpillSummary[]>([]);
  const [selectedSpillId, setSelectedSpillId] = useState<string | null>(spillIdFromUrl);
  const [spillDetail, setSpillDetail] = useState<SpillDetail | null>(null);
  const [matchedTrack, setMatchedTrack] = useState<Array<{ lat: number; lon: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getSpillsList();
      setSpills(list || []);

      let targetId: string | null = null;
      if (spillIdFromUrl && list && list.some((s) => s.id === spillIdFromUrl)) {
        targetId = spillIdFromUrl;
      } else if (list && list.length > 0) {
        targetId = list[0].id;
      }

      setSelectedSpillId(targetId);

      if (targetId) {
        const detail = await getSpillDetail(targetId);
        setSpillDetail(detail);
      } else {
        setSpillDetail(null);
      }
    } catch (err: any) {
      console.error('[SpillsPage] Error fetching spills list:', err);
      setError(
        err?.message ||
          'Unable to connect to radar oil-spill detection service.'
      );
      setSpills([]);
      setSpillDetail(null);
    } finally {
      setLoading(false);
    }
  }, [spillIdFromUrl]);

  useEffect(() => {
    fetchSpills();
  }, [fetchSpills, mode]);

  // When selectedSpillId changes, fetch spill detail
  useEffect(() => {
    if (!selectedSpillId) return;
    let isMounted = true;

    getSpillDetail(selectedSpillId)
      .then((detail) => {
        if (!isMounted) return;
        setSpillDetail(detail);

        // If primary nearby track exists, attempt fetching its real AIS track using canonical MMSI only
        const primaryTrack = detail?.nearbyTracks?.find((t) => t.isPrimary);
        const trackMmsi = primaryTrack?.mmsi;
        if (trackMmsi) {
          getVesselTrack(trackMmsi)
            .then((res) => {
              if (isMounted && res && res.track) {
                setMatchedTrack(res.track.map((t: any) => ({ lat: t.lat, lon: t.lon ?? t.lng })));
              }
            })
            .catch(() => {
              if (isMounted) setMatchedTrack([]);
            });
        } else {
          setMatchedTrack([]);
        }
      })
      .catch((err) => {
        console.warn('[SpillsPage] Error fetching spill detail:', err);
        if (isMounted) {
          setSpillDetail(null);
          setMatchedTrack([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSpillId]);

  return (
    <>
      {/* Offline Alert Banner in LIVE mode */}
      {error && mode === 'live' && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1.5px solid #f43f5e',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '10px 20px',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(244, 63, 94, 0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <AlertTriangle size={20} color="#f43f5e" />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f43f5e', letterSpacing: '0.5px' }}>
              SPILL SERVICE OFFLINE
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{error}</div>
          </div>
          <button
            onClick={() => fetchSpills()}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid #f43f5e',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Left Inspection & Attribution Panel */}
      <SpillDetailPanel
        spill={spillDetail}
        spillsList={spills}
        selectedSpillId={selectedSpillId}
        onSelectSpill={(id) => setSelectedSpillId(id)}
        loading={loading}
      />

      {/* Right Interactive SAR & Satellite Radar Map */}
      <SpillMapCanvas spill={spillDetail} matchedTrack={matchedTrack} />
    </>
  );
}

export default function SpillsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem' }}>
          LOADING OIL SPILL INTELLIGENCE...
        </div>
      }
    >
      <SpillsPageInner />
    </Suspense>
  );
}
