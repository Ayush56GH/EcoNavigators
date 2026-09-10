'use client';

import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, ShieldCheck, LineChart, Globe, Crosshair, AlertTriangle } from 'lucide-react';
import { SpillDetail } from '@/types/spill';
import { useAppMode } from '@/utils/appMode';
import { formatCoordinate } from '@/utils/geo';

const TILE_PROVIDERS = {
  satellite: {
    name: '3D Satellite (Esri Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Earthstar Geographics, Maxar',
  },
  ocean: {
    name: '3D Ocean (Bathymetry)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; GEBCO, NOAA, National Geographic',
  },
  dark: {
    name: 'Dark Tactical (CartoDB)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  osm: {
    name: 'Standard OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Custom Asset Icon for DEMO mode only
const createAssetIcon = (label: string, symbol: string) => {
  return L.divIcon({
    className: 'custom-asset-icon',
    html: `
      <div style="display: flex; align-items: center; gap: 6px; background: rgba(7, 14, 23, 0.88); border: 1px solid rgba(244, 63, 94, 0.6); color: #f43f5e; padding: 2px 7px; border-radius: 3px; font-family: 'Roboto Mono', monospace; font-size: 10px; font-weight: 700; white-space: nowrap; backdrop-filter: blur(4px);">
        <span>${symbol}</span>
        <span>${label}</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-85.05112878, -180],
  [85.05112878, 180],
];

const WHOLE_MAP_CENTER: [number, number] = [20.0, 0.0];
const WHOLE_MAP_ZOOM = 2;

function SpillMapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => {
      map.invalidateSize();
      map.setView(center, zoom);
    }, 120);
    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 350);

    const container = map.getContainer();
    if (!container) {
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [map]);

  useEffect(() => {
    map.flyTo(center, zoom, { animate: true, duration: 1.0 });
    map.invalidateSize();
  }, [center, zoom, map]);

  return null;
}

interface SpillMapProps {
  spill?: SpillDetail | null;
  matchedTrack?: Array<{ lat: number; lon: number }>;
}

export default function SpillMap({ spill, matchedTrack = [] }: SpillMapProps) {
  const { mode } = useAppMode();
  const [mounted, setMounted] = useState(false);
  const [activeTileKey, setActiveTileKey] = useState<keyof typeof TILE_PROVIDERS>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'world' | 'focus'>('world');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (spill?.id && typeof spill?.lat === 'number') {
      setViewMode('focus');
    }
  }, [spill?.id, spill?.lat]);

  const hasCoords = typeof spill?.lat === 'number' && typeof spill?.lng === 'number';
  const spillLat = spill?.lat;
  const spillLng = spill?.lng;

  const focusCenter: [number, number] = hasCoords ? [spillLat!, spillLng!] : WHOLE_MAP_CENTER;
  const activeCenter: [number, number] = viewMode === 'world' ? WHOLE_MAP_CENTER : focusCenter;
  const activeZoom = viewMode === 'world' ? WHOLE_MAP_ZOOM : 10;

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#070e17' }} />
    );
  }

  // Pure polygon from backend GeoJSON / polygonGeom — NEVER synthesize polygon around point
  const hasPolygon = Boolean(spill?.polygonGeom && spill.polygonGeom.length >= 3);
  const polygonPositions = hasPolygon ? spill!.polygonGeom! : [];

  // Matched vessel trajectory — strictly real track from backend
  const hasTrack = Array.isArray(matchedTrack) && matchedTrack.length > 0;
  const trackCoordinates: [number, number][] = hasTrack
    ? matchedTrack.map((p) => [p.lat, p.lon] as [number, number])
    : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Top Banner if Polygon is missing */}
      {spill && !hasPolygon && hasCoords && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid #f43f5e',
            borderRadius: '6px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1001,
            color: '#f43f5e',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <AlertTriangle size={14} />
          <span>SLICK BOUNDARY UNAVAILABLE — Point centroid rendered (Observed coordinates, no polygon fabricated)</span>
        </div>
      )}

      <MapContainer
        center={activeCenter}
        zoom={activeZoom}
        minZoom={2}
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#070e17' }}
        zoomControl={true}
      >
        <SpillMapController center={activeCenter} zoom={activeZoom} />

        {/* Tile Layer */}
        <TileLayer
          key={activeTileKey}
          url={TILE_PROVIDERS[activeTileKey].url}
          attribution={TILE_PROVIDERS[activeTileKey].attribution}
          noWrap={true}
          bounds={WORLD_BOUNDS}
          maxZoom={18}
        />

        {/* Matched AIS Vessel Track — ONLY when backend track is provided */}
        {hasTrack ? (
          <Polyline
            positions={trackCoordinates}
            pathOptions={{
              color: '#fbbf24',
              weight: 2.5,
              dashArray: '6, 6',
              opacity: 0.9,
            }}
          />
        ) : null}

        {/* Oil Spill Polygon Overlay — Strictly backend provided polygon */}
        {hasPolygon ? (
          <Polygon
            positions={polygonPositions}
            pathOptions={{
              color: spill?.status === 'CRITICAL' ? '#f43f5e' : '#00d7b2',
              fillColor: spill?.status === 'CRITICAL' ? '#f43f5e' : '#00d7b2',
              fillOpacity: 0.35,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="center" className="spill-hud-tooltip">
              <div
                style={{
                  background: 'rgba(11, 23, 35, 0.95)',
                  border: `1.5px solid ${spill?.status === 'CRITICAL' ? '#f43f5e' : '#00d7b2'}`,
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  SPILL ID: <span style={{ color: '#ffffff' }}>{spill?.id}</span>
                </div>
                <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>
                  STATUS: <span style={{ color: spill?.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24' }}>{spill?.status || 'N/A'}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  AREA: <span style={{ color: '#ffffff' }}>{spill?.areaSqNm || spill?.estArea || 'N/A'}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  CONFIDENCE: <span style={{ color: '#00d7b2' }}>{spill?.confidence || 'N/A'}</span>
                </div>
              </div>
            </Tooltip>
          </Polygon>
        ) : hasCoords ? (
          /* Polygon missing: Render detection point centroid with explicit note */
          <CircleMarker
            center={[spillLat!, spillLng!]}
            radius={10}
            pathOptions={{
              color: spill?.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
              fillColor: spill?.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="top">
              <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #f43f5e', color: '#ffffff', padding: '3px 8px', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                {spill?.id}: SLICK BOUNDARY UNAVAILABLE
              </div>
            </Tooltip>
            <Popup className="custom-leaflet-popup">
              <div style={{ padding: '6px', color: '#070e17' }}>
                <strong style={{ display: 'block', fontSize: '13px', color: '#be123c' }}>{spill?.id}</strong>
                <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                  SLICK BOUNDARY UNAVAILABLE
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  Centroid: {formatCoordinate(spillLat!, spillLng!)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ) : null}

        {/* DEMO mode response assets (ONLY rendered in demo mode, explicitly flagged) */}
        {mode === 'demo' && hasCoords && (
          <>
            <Marker position={[spillLat! - 0.04, spillLng! + 0.03]} icon={createAssetIcon('DEMO RESPONSE ASSET: SKIMMER 01', '⚓')} />
            <Marker position={[spillLat! + 0.02, spillLng! - 0.04]} icon={createAssetIcon('DEMO RESPONSE ASSET: BOOM 01', '⚓')} />
            <Marker position={[spillLat! + 0.05, spillLng! + 0.05]} icon={createAssetIcon('DEMO RESPONSE ASSET: AERIAL-A3', '✈')} />
          </>
        )}
      </MapContainer>

      {/* Floating Estimated Origin Point Card at Bottom-Right */}
      {spill && (
        <div className="origin-preview-box">
          <div className="origin-preview-title">Estimated Origin Point</div>
          <div className="origin-preview-desc">
            {spill.estimatedOriginStatus || 'Modeling Complete. Waiting for backtrack execution to visualize trajectory.'}
          </div>
          <div className="origin-preview-icon-row">
            <LineChart size={22} />
          </div>
        </div>
      )}

      {/* Layer Switcher & View Mode HUD */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasCoords && (
            <button
              onClick={() => setViewMode(viewMode === 'world' ? 'focus' : 'world')}
              style={{
                background: 'rgba(11, 23, 35, 0.92)',
                border: viewMode === 'world' ? '1px solid #00d7b2' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              }}
            >
              {viewMode === 'world' ? (
                <>
                  <Crosshair size={14} color="#00d7b2" />
                  <span>Focus Spill</span>
                </>
              ) : (
                <>
                  <Globe size={14} color="#00d7b2" />
                  <span>Whole Map</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            style={{
              background: 'rgba(11, 23, 35, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
          >
            <Layers size={14} color="#00d7b2" />
            <span>Layer: {TILE_PROVIDERS[activeTileKey].name}</span>
          </button>
        </div>

        {showLayerMenu && (
          <div
            style={{
              background: 'rgba(11, 23, 35, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              minWidth: '180px',
            }}
          >
            {(Object.keys(TILE_PROVIDERS) as Array<keyof typeof TILE_PROVIDERS>).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTileKey(key);
                  setShowLayerMenu(false);
                }}
                style={{
                  background: activeTileKey === key ? 'rgba(0, 215, 178, 0.15)' : 'transparent',
                  border: 'none',
                  color: activeTileKey === key ? '#00d7b2' : '#94a3b8',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: activeTileKey === key ? 700 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{TILE_PROVIDERS[key].name}</span>
                {activeTileKey === key && <ShieldCheck size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
