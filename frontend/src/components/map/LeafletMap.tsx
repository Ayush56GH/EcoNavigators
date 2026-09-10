'use client';

import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, AlertTriangle, ShieldCheck, Globe, Crosshair } from 'lucide-react';
import { CandidateVessel } from '@/types/dashboard';
import { SpillSummary, SpillDetail } from '@/types/spill';
import { formatCoordinate } from '@/utils/geo';

// Tile Layer configurations with high-res 3D Satellite & Ocean imagery
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
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  osm: {
    name: 'Standard OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

// Custom vessel marker icon
const createVesselIcon = (label: string) => {
  return L.divIcon({
    className: 'custom-leaflet-vessel-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="width: 14px; height: 14px; border-radius: 50%; background: #00d7b2; box-shadow: 0 0 12px #00d7b2, 0 0 24px rgba(0, 215, 178, 0.4); border: 2px solid #ffffff;"></div>
        <div style="margin-top: 4px; background: rgba(11, 23, 35, 0.92); border: 1px solid #00d7b2; color: #00d7b2; padding: 2px 7px; border-radius: 3px; font-family: 'Roboto Mono', monospace; font-size: 11px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
          ${label}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// World bounds in Web Mercator
const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-85.05112878, -180],
  [85.05112878, 180],
];

const WHOLE_MAP_CENTER: [number, number] = [20.0, 0.0];
const WHOLE_MAP_ZOOM = 2;

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
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

interface LeafletMapProps {
  showCandidateOverlay?: boolean;
  showSpillOverlay?: boolean;
  candidate?: CandidateVessel | null;
  spills?: Array<SpillSummary | SpillDetail>;
}

export default function LeafletMap({
  showCandidateOverlay = true,
  showSpillOverlay = true,
  candidate,
  spills = [],
}: LeafletMapProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTileKey, setActiveTileKey] = useState<keyof typeof TILE_PROVIDERS>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'world' | 'focus'>('world');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#070e17' }} />
    );
  }

  // Pure data resolution — NEVER invent candidate coordinates
  const hasCandidateCoords =
    candidate && typeof candidate.lat === 'number' && typeof candidate.lng === 'number';
  const candidatePosition: [number, number] | null = hasCandidateCoords
    ? [candidate!.lat!, candidate!.lng!]
    : null;

  // First valid spill coordinate for focus
  const firstSpillWithCoords = spills.find(
    (s) => typeof s.lat === 'number' && typeof s.lng === 'number'
  );

  // Dynamic center based on actual data
  let focusCenter: [number, number] = WHOLE_MAP_CENTER;
  let focusZoom = 6;
  if (candidatePosition) {
    focusCenter = candidatePosition;
    focusZoom = 7;
  } else if (firstSpillWithCoords) {
    focusCenter = [firstSpillWithCoords.lat, firstSpillWithCoords.lng];
    focusZoom = 7;
  }

  const activeCenter: [number, number] = viewMode === 'world' ? WHOLE_MAP_CENTER : focusCenter;
  const activeZoom = viewMode === 'world' ? WHOLE_MAP_ZOOM : focusZoom;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
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
        <MapController center={activeCenter} zoom={activeZoom} />

        {/* Tile Layer */}
        <TileLayer
          key={activeTileKey}
          url={TILE_PROVIDERS[activeTileKey].url}
          attribution={TILE_PROVIDERS[activeTileKey].attribution}
          noWrap={true}
          bounds={WORLD_BOUNDS}
          maxZoom={18}
        />

        {/* Candidate Vessel Marker — ONLY render when coordinates exist */}
        {showCandidateOverlay && candidatePosition && (
          <Marker
            position={candidatePosition}
            icon={createVesselIcon(
              candidate?.imo && candidate.imo !== 'N/A' && !String(candidate.imo).startsWith('UNKNOWN')
                ? (candidate.imo.startsWith('IMO') ? candidate.imo : `IMO ${candidate.imo}`)
                : (candidate?.mmsi ? `MMSI ${candidate.mmsi}` : (candidate?.name || 'CANDIDATE'))
            )}
          >
            <Popup className="custom-leaflet-popup">
              <div style={{ padding: '6px', color: '#070e17', minWidth: '160px' }}>
                <strong style={{ display: 'block', fontSize: '13px' }}>{candidate?.name || 'Candidate Vessel'}</strong>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  Position: {formatCoordinate(candidatePosition[0], candidatePosition[1])}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  IMO: {candidate?.imo || 'N/A'} | Speed: {candidate?.speed || 'N/A'}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  Heading: {candidate?.heading || 'N/A'} | Status: {candidate?.status || 'Underway'}
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: '#00876c' }}>
                  Evidence Strength: {candidate?.evidenceStrength ?? 0}% Association
                </div>
                <div style={{ marginTop: '8px' }}>
                  <a href={`/vessels?vesselId=${encodeURIComponent(candidate?.id || candidate?.mmsi || '')}`} style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, textDecoration: 'underline' }}>
                    View Vessel Intelligence &rarr;
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Detected Oil Spills — Render actual polygonGeom or point marker if polygon missing */}
        {showSpillOverlay &&
          spills.map((spill) => {
            const hasCoords = typeof spill.lat === 'number' && typeof spill.lng === 'number';
            if (!hasCoords) return null;

            const polygonGeom = 'polygonGeom' in spill ? spill.polygonGeom : null;

            if (polygonGeom && polygonGeom.length >= 3) {
              return (
                <Polygon
                  key={spill.id}
                  positions={polygonGeom}
                  pathOptions={{
                    color: spill.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
                    fillColor: spill.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
                    fillOpacity: 0.35,
                    weight: 2.5,
                  }}
                >
                  <Tooltip permanent direction="center" className="spill-leaflet-tooltip">
                    <div
                      style={{
                        background: '#881337',
                        border: '1px solid #f43f5e',
                        color: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                      }}
                    >
                      <AlertTriangle size={12} />
                      <span>{spill.id}</span>
                    </div>
                  </Tooltip>
                  <Popup className="custom-leaflet-popup">
                    <div style={{ padding: '6px', color: '#070e17' }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: '#be123c' }}>{spill.id}</strong>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        Status: {spill.status} | Conf: {spill.confidence || 'N/A'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Time: {spill.detectionTime || 'N/A'}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <a href={`/spills?spillId=${encodeURIComponent(spill.id)}`} style={{ fontSize: '11px', color: '#00876c', fontWeight: 700, textDecoration: 'underline' }}>
                          Investigate in Spills &rarr;
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            }

            // Polygon unavailable: draw explicit detection point marker with notice
            return (
              <CircleMarker
                key={spill.id}
                center={[spill.lat, spill.lng]}
                radius={8}
                pathOptions={{
                  color: spill.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
                  fillColor: spill.status === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
                  fillOpacity: 0.8,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" className="spill-leaflet-tooltip">
                  <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #f43f5e', color: '#ffffff', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                    {spill.id} (SLICK BOUNDARY UNAVAILABLE)
                  </div>
                </Tooltip>
                <Popup className="custom-leaflet-popup">
                  <div style={{ padding: '6px', color: '#070e17' }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#be123c' }}>{spill.id}</strong>
                    <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700, marginTop: '2px' }}>
                      SLICK BOUNDARY UNAVAILABLE
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                      Detection Center: {formatCoordinate(spill.lat, spill.lng)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                      Status: {spill.status} | Conf: {spill.confidence || 'N/A'}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <a href={`/spills?spillId=${encodeURIComponent(spill.id)}`} style={{ fontSize: '11px', color: '#00876c', fontWeight: 700, textDecoration: 'underline' }}>
                        Investigate Spill &rarr;
                      </a>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>

      {/* HUD Controls on top right: View Mode Toggle + Layer Switcher */}
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
                <span>Focus Incident</span>
              </>
            ) : (
              <>
                <Globe size={14} color="#00d7b2" />
                <span>Whole Map</span>
              </>
            )}
          </button>

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
