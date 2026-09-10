'use client';

import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, ShieldCheck, Globe, Crosshair, AlertTriangle } from 'lucide-react';
import { TrackedVessel } from '@/types/vessel';
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
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  osm: {
    name: 'Standard OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Custom vessel marker icon
const createVesselIcon = (title: string, subtitle: string) => {
  return L.divIcon({
    className: 'custom-vessel-map-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="width: 14px; height: 14px; border-radius: 50%; background: #00d7b2; box-shadow: 0 0 16px #00d7b2; border: 2px solid #ffffff;"></div>
        <div style="margin-top: 5px; background: rgba(11, 23, 35, 0.95); border: 1.5px solid #00d7b2; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.6); backdrop-filter: blur(8px);">
          <div style="font-weight: 700; color: #00d7b2;">${title}</div>
          <div style="font-size: 10px; color: #94a3b8;">${subtitle}</div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Waypoint dot icon with real backend timestamp label
const createWaypointIcon = (label: string) => {
  return L.divIcon({
    className: 'custom-waypoint-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #00d7b2; border: 2px solid #070e17; box-shadow: 0 0 8px #00d7b2;"></div>
        <div style="margin-top: 4px; background: rgba(7, 14, 23, 0.88); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; padding: 2px 6px; border-radius: 3px; font-family: 'Roboto Mono', monospace; font-size: 10px; white-space: nowrap; backdrop-filter: blur(4px);">
          ${label}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

interface VesselMapProps {
  vessel?: TrackedVessel | null;
  track?: { lat: number; lon: number; timestamp: string }[];
}

const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-85.05112878, -180],
  [85.05112878, 180],
];

const WHOLE_MAP_CENTER: [number, number] = [20.0, 0.0];
const WHOLE_MAP_ZOOM = 2;

function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
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

export default function VesselMap({ vessel, track = [] }: VesselMapProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTileKey, setActiveTileKey] = useState<keyof typeof TILE_PROVIDERS>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'world' | 'focus'>('world');

  useEffect(() => {
    setMounted(true);
  }, []);

  // When a vessel is explicitly selected and has coordinates, switch to focus mode
  useEffect(() => {
    if (vessel?.id && (typeof vessel?.lat === 'number' || (track && track.length > 0))) {
      setViewMode('focus');
    }
  }, [vessel?.id, vessel?.lat, track]);

  // Determine vessel location strictly from real data
  const lastTrackPoint = track && track.length > 0 ? track[track.length - 1] : null;
  const currentLat = lastTrackPoint ? lastTrackPoint.lat : vessel?.lat;
  const currentLng = lastTrackPoint ? lastTrackPoint.lon : vessel?.lng;

  const hasPosition = typeof currentLat === 'number' && typeof currentLng === 'number';

  const activeCenter: [number, number] =
    viewMode === 'focus' && hasPosition ? [currentLat!, currentLng!] : WHOLE_MAP_CENTER;
  const activeZoom = viewMode === 'focus' && hasPosition ? 9 : WHOLE_MAP_ZOOM;

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#070e17' }} />
    );
  }

  // Pure track coordinates: NEVER fabricate synthetic line
  const hasTrack = Array.isArray(track) && track.length > 0;
  const trackCoordinates: [number, number][] = hasTrack
    ? track.map((p) => [p.lat, p.lon] as [number, number])
    : [];

  // Waypoints strictly from real track fixes
  const waypoints = hasTrack
    ? track
        .filter((_, idx) => idx === 0 || idx === track.length - 1 || idx % Math.max(1, Math.floor(track.length / 4)) === 0)
        .map((p) => ({
          pos: [p.lat, p.lon] as [number, number],
          label: p.timestamp ? (p.timestamp.length > 10 ? p.timestamp.slice(11, 16) : p.timestamp) : 'Fix',
          fullTimestamp: p.timestamp,
        }))
    : [];

  const vesselTitle = vessel?.name || 'No vessel selected';
  const vesselSubtitle = `${vessel?.heading || 'N/A'} · ${vessel?.speed || 'N/A'}`;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Floating HUD Telemetry Box (Top-Left) */}
      <div className="hud-telemetry-box">
        <div className="hud-telemetry-coord">
          LOC: {hasPosition ? formatCoordinate(currentLat!, currentLng!) : 'Position unavailable'}
        </div>
        <div className="hud-telemetry-fix">
          VESSEL: {vesselTitle} | MMSI: {vessel?.mmsi || 'N/A'}
        </div>
      </div>

      {/* No Track Warning HUD if track is empty */}
      {vessel && !hasTrack && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '1.25rem',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            borderRadius: '4px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1000,
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            color: '#fbbf24',
            backdropFilter: 'blur(8px)',
          }}
        >
          <AlertTriangle size={14} />
          <span>NO AIS TRACK AVAILABLE</span>
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
        <MapViewController center={activeCenter} zoom={activeZoom} />

        {/* Tile Layer */}
        <TileLayer
          key={activeTileKey}
          url={TILE_PROVIDERS[activeTileKey].url}
          attribution={TILE_PROVIDERS[activeTileKey].attribution}
          noWrap={true}
          bounds={WORLD_BOUNDS}
          maxZoom={18}
        />

        {/* Route History Polyline — ONLY render when backend-provided track exists */}
        {hasTrack && (
          <Polyline
            positions={trackCoordinates}
            pathOptions={{
              color: '#00d7b2',
              weight: 3,
              dashArray: '4, 8',
              opacity: 0.9,
            }}
          />
        )}

        {/* Chronological Waypoints along Track — strictly real timestamps */}
        {waypoints.map((wp, idx) => (
          <Marker key={idx} position={wp.pos} icon={createWaypointIcon(wp.label)}>
            <Tooltip permanent={false} direction="top" offset={[0, -10]}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                {wp.fullTimestamp || 'Fix'}: {formatCoordinate(wp.pos[0], wp.pos[1])}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Dynamic Monitored Vessel Marker — ONLY if position is known */}
        {hasPosition && (
          <Marker position={[currentLat!, currentLng!]} icon={createVesselIcon(vesselTitle, vesselSubtitle)}>
            <Popup className="custom-leaflet-popup">
              <div style={{ padding: '6px', color: '#070e17', fontFamily: 'sans-serif' }}>
                <strong style={{ fontSize: '13px' }}>{vesselTitle}</strong>
                <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px' }}>
                  <div>Position: {formatCoordinate(currentLat!, currentLng!)}</div>
                  <div>MMSI: {vessel?.mmsi || 'N/A'}</div>
                  <div>IMO: {vessel?.imo || 'N/A'}</div>
                  <div>Category: {vessel?.category || 'N/A'}</div>
                  <div>Speed: {vessel?.speed || 'N/A'}</div>
                  <div>Status: {vessel?.status || 'Underway'}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
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
          {hasPosition && (
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
                  <span>Focus Vessel</span>
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
