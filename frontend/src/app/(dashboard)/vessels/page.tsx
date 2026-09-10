'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import VesselMapCanvas from '@/components/vessels/VesselMapCanvas';
import VesselListPanel from '@/components/vessels/VesselListPanel';
import VesselDetailPanel from '@/components/vessels/VesselDetailPanel';
import { TrackedVessel } from '@/types/vessel';
import { getTrackedVessels, getVesselTrack, getVesselDetail } from '@/services/api';
import { useAppMode } from '@/utils/appMode';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function VesselsPageInner() {
  const searchParams = useSearchParams();
  const vesselIdFromUrl = searchParams.get('vesselId');
  const searchFromUrl = searchParams.get('search');
  const { mode } = useAppMode();

  const [vessels, setVessels] = useState<TrackedVessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<TrackedVessel | null>(null);
  const [track, setTrack] = useState<{ lat: number; lon: number; timestamp: string }[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVessels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const liveVessels = await getTrackedVessels({
        search: searchFromUrl || undefined,
      });
      setVessels(liveVessels || []);

      // If URL specified a vessel, select it
      if (vesselIdFromUrl && liveVessels && liveVessels.length > 0) {
        const found = liveVessels.find(
          (v) => v.id === vesselIdFromUrl || v.mmsi === vesselIdFromUrl
        );
        if (found) {
          setSelectedVessel(found);
          setViewMode('detail');
        } else {
          // Attempt direct fetch of vessel detail
          try {
            const detail = await getVesselDetail(vesselIdFromUrl);
            if (detail) {
              setSelectedVessel(detail);
              setViewMode('detail');
            }
          } catch {
            setSelectedVessel(liveVessels[0]);
          }
        }
      } else if (liveVessels && liveVessels.length > 0) {
        setSelectedVessel(liveVessels[0]);
      } else {
        setSelectedVessel(null);
      }
    } catch (err: any) {
      console.error('[VesselsPage] Error loading live vessels:', err);
      setError(
        err?.message ||
          'Unable to connect to AIS vessel tracking service.'
      );
      setVessels([]);
      setSelectedVessel(null);
    } finally {
      setLoading(false);
    }
  }, [vesselIdFromUrl, searchFromUrl]);

  useEffect(() => {
    fetchVessels();
  }, [fetchVessels, mode]);

  // Fetch real AIS track whenever the selected vessel changes
  useEffect(() => {
    if (!selectedVessel) {
      setTrack([]);
      return;
    }

    const vesselMmsi = selectedVessel.mmsi;
    if (!vesselMmsi) {
      setTrack([]);
      return;
    }

    let isMounted = true;
    getVesselTrack(vesselMmsi)
      .then((res) => {
        if (isMounted && res && res.track) {
          setTrack(res.track);
        } else if (isMounted) {
          setTrack([]);
        }
      })
      .catch((err) => {
        console.warn('[VesselsPage] Error loading vessel track:', err);
        if (isMounted) setTrack([]);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVessel?.mmsi]);

  const handleSelectVessel = (vessel: TrackedVessel) => {
    setSelectedVessel(vessel);
    setViewMode('detail');
  };

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
              AIS TELEMETRY OFFLINE
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{error}</div>
          </div>
          <button
            onClick={() => fetchVessels()}
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

      {/* Interactive Map with Vessel Trajectory */}
      <VesselMapCanvas vessel={selectedVessel} track={track} />

      {/* Right Context Panel (List or Detail) */}
      {viewMode === 'detail' && selectedVessel ? (
        <VesselDetailPanel
          vessel={selectedVessel}
          onBackToList={() => setViewMode('list')}
        />
      ) : (
        <VesselListPanel
          vessels={vessels}
          selectedVesselId={selectedVessel?.id || ''}
          onSelectVessel={handleSelectVessel}
          loading={loading}
          searchQuery={searchFromUrl}
        />
      )}
    </>
  );
}

export default function VesselsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem' }}>
          LOADING VESSEL INTELLIGENCE...
        </div>
      }
    >
      <VesselsPageInner />
    </Suspense>
  );
}
