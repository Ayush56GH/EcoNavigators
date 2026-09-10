'use client';

import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, ShieldCheck, Maximize2, Globe, Crosshair, Wind, Waves, Clock, Compass, AlertOctagon, Sparkles } from 'lucide-react';
import { CandidateRanking, DriftPoint, ForecastPoint } from '@/types/backtracking';

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

const createDriftNodeIcon = (label: string) => {
  return L.divIcon({
    className: 'custom-drift-node-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #fb923c; border: 2px solid #ffffff; box-shadow: 0 0 10px #f97316;"></div>
        <div style="margin-top: 3px; background: rgba(7, 14, 23, 0.9); border: 1px solid #fb923c; color: #fb923c; padding: 2px 5px; border-radius: 3px; font-family: 'Roboto Mono', monospace; font-size: 10px; font-weight: 700; white-space: nowrap;">
          ${label}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const createForecastNodeIcon = (label: string) => {
  return L.divIcon({
    className: 'custom-forecast-node-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #06b6d4; border: 2px solid #ffffff; box-shadow: 0 0 10px #06b6d4;"></div>
        <div style="margin-top: 3px; background: rgba(7, 14, 23, 0.9); border: 1px solid #06b6d4; color: #22d3ee; padding: 2px 5px; border-radius: 3px; font-family: 'Roboto Mono', monospace; font-size: 10px; font-weight: 700; white-space: nowrap;">
          ${label}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const createVesselMarkerIcon = (label: string, isPrimary: boolean = true) => {
  const dotColor = isPrimary ? '#00d7b2' : '#fbbf24';
  const glowColor = isPrimary ? 'rgba(0, 215, 178, 0.4)' : 'rgba(251, 191, 36, 0.4)';
  const badgeBorder = isPrimary ? '#00d7b2' : '#fbbf24';
  const badgeColor = isPrimary ? '#00d7b2' : '#fbbf24';

  return L.divIcon({
    className: 'custom-leaflet-vessel-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
        <div style="width: 14px; height: 14px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 12px ${glowColor}; border: 2px solid #ffffff;"></div>
        <div style="margin-top: 4px; background: rgba(11, 23, 35, 0.92); border: 1px solid ${badgeBorder}; color: ${badgeColor}; padding: 2px 7px; border-radius: 3px; font-family: 'Roboto Mono', monospace; font-size: 11px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          ${label}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Define the geographical edges of the world in Web Mercator
const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-85.05112878, -180],
  [85.05112878, 180],
];

const WHOLE_MAP_CENTER: [number, number] = [20.0, 0.0];
const WHOLE_MAP_ZOOM = 2;

function BacktrackMapController({ center, zoom }: { center: [number, number]; zoom: number }) {
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

interface BacktrackMapProps {
  onViewEvidenceDetails?: () => void;
  showFloatingCandidateCard?: boolean;
  activeCandidate?: CandidateRanking | null;
  rankings?: CandidateRanking[];
  candidateTrack?: [number, number][];
  originPoint?: [number, number] | null;
  originPolygon?: [number, number][];
  hoursWindow?: 1 | 6 | 12 | 24;
  onHoursWindowChange?: (hours: 1 | 6 | 12 | 24) => void;
  driftTrajectory?: DriftPoint[];
  forecastTrajectory?: ForecastPoint[];
  spillCharacterization?: any;
  coastalImpact?: any;
  hydrodynamics?: any;
}

export default function BacktrackMap({
  onViewEvidenceDetails,
  showFloatingCandidateCard = false,
  activeCandidate,
  rankings = [],
  candidateTrack,
  originPoint,
  originPolygon,
  hoursWindow = 12,
  onHoursWindowChange,
  driftTrajectory,
  forecastTrajectory,
  spillCharacterization,
  coastalImpact,
  hydrodynamics,
}: BacktrackMapProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTileKey, setActiveTileKey] = useState<keyof typeof TILE_PROVIDERS>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'world' | 'focus'>('world');
  const [driftMode, setDriftMode] = useState<'hindcast' | 'forecast' | 'dual'>('dual');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (activeCandidate?.mmsi || activeCandidate?.name) {
      setViewMode('focus');
    }
  }, [activeCandidate?.mmsi, activeCandidate?.name]);

  // Geographic validation for origin and candidate
  const hasOrigin = Boolean(
    originPoint &&
    typeof originPoint[0] === 'number' &&
    typeof originPoint[1] === 'number' &&
    !isNaN(originPoint[0]) &&
    !isNaN(originPoint[1])
  );

  const hasCandidatePos = Boolean(
    activeCandidate?.lat != null &&
    activeCandidate?.lng != null &&
    !isNaN(activeCandidate.lat) &&
    !isNaN(activeCandidate.lng)
  );

  const candidatePos: [number, number] | null = hasCandidatePos
    ? [activeCandidate!.lat!, activeCandidate!.lng!]
    : null;

  // Center on midpoint if both present, or on single point, or fallback to world center
  const focusCenter: [number, number] = (hasOrigin && candidatePos)
    ? [(originPoint![0] + candidatePos[0]) / 2, (originPoint![1] + candidatePos[1]) / 2]
    : hasOrigin
    ? [originPoint![0], originPoint![1]]
    : candidatePos
    ? candidatePos
    : WHOLE_MAP_CENTER;

  const activeCenter: [number, number] = viewMode === 'world' ? WHOLE_MAP_CENTER : focusCenter;
  const activeZoom = viewMode === 'world' ? WHOLE_MAP_ZOOM : (hasOrigin || candidatePos ? 6 : WHOLE_MAP_ZOOM);

  if (!mounted) {
    return (
      <div style={{ width: '100%', height: '100%', backgroundColor: '#070e17' }} />
    );
  }

  // Drift Vector path: ONLY real Lagrangian hydrodynamic trajectory from backend
  const effectiveDriftPath: [number, number][] =
    driftTrajectory && driftTrajectory.length > 0
      ? driftTrajectory.map((pt) => [pt.lat, pt.lon] as [number, number])
      : [];

  // Forward Forecast path: ONLY real forecast trajectory from backend
  const effectiveForecastPath: [number, number][] =
    forecastTrajectory && forecastTrajectory.length > 0
      ? forecastTrajectory.map((pt) => [pt.lat, pt.lon] as [number, number])
      : [];

  // AIS Vessel path: ONLY real candidate track from backend
  const effectiveVesselTrack: [number, number][] =
    candidateTrack && candidateTrack.length > 0
      ? candidateTrack
      : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Coastal Impact & Landfall Alert Banner */}
      {coastalImpact && (coastalImpact.vulnerability_level === 'CRITICAL' || coastalImpact.vulnerability_level === 'HIGH') && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.96)',
            border: `1.5px solid ${coastalImpact.vulnerability_level === 'CRITICAL' ? '#f43f5e' : '#f59e0b'}`,
            borderRadius: '6px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 1001,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            maxWidth: '680px',
            pointerEvents: 'auto',
          }}
        >
          <AlertOctagon size={18} color={coastalImpact.vulnerability_level === 'CRITICAL' ? '#f43f5e' : '#f59e0b'} />
          <div style={{ fontSize: '11px', color: '#f8fafc' }}>
            <span style={{ fontWeight: 800, color: coastalImpact.vulnerability_level === 'CRITICAL' ? '#f43f5e' : '#f59e0b', marginRight: '6px' }}>
              [MODELLED FORECAST: {coastalImpact.status || 'LANDFALL RISK'}]
            </span>
            <span>{coastalImpact.action_advisory}</span>
          </div>
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
        <BacktrackMapController center={activeCenter} zoom={activeZoom} />

        <TileLayer
          key={activeTileKey}
          url={TILE_PROVIDERS[activeTileKey].url}
          attribution={TILE_PROVIDERS[activeTileKey].attribution}
          noWrap={true}
          bounds={WORLD_BOUNDS}
          maxZoom={18}
        />

        {/* Spill Origin: Real Polygon or Centroid Circle Marker */}
        {originPolygon && originPolygon.length >= 3 ? (
          <Polygon
            positions={originPolygon}
            pathOptions={{
              color: '#c026d3',
              fillColor: '#c026d3',
              fillOpacity: 0.25,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="center">
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#f43f5e' }}>
                SPILL ORIGIN SECTOR
              </div>
            </Tooltip>
          </Polygon>
        ) : hasOrigin && originPoint ? (
          <Circle
            center={originPoint}
            radius={1000}
            pathOptions={{
              color: '#c026d3',
              fillColor: '#c026d3',
              fillOpacity: 0.3,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="center">
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#c026d3' }}>
                SPILL ORIGIN
              </div>
            </Tooltip>
          </Circle>
        ) : null}

        {/* Candidate Vessel AIS Track (Only if 2+ real points) */}
        {effectiveVesselTrack.length >= 2 && (
          <Polyline
            positions={effectiveVesselTrack}
            pathOptions={{
              color: '#00d7b2',
              weight: 2.5,
              dashArray: '5, 8',
              opacity: 0.9,
            }}
          />
        )}

        {/* Hydrodynamic Backtrack Drift Arrow / Vector (Hindcast) */}
        {(driftMode === 'hindcast' || driftMode === 'dual') && effectiveDriftPath.length >= 2 && (
          <>
            <Polyline
              positions={effectiveDriftPath}
              pathOptions={{
                color: '#f97316',
                weight: 3.5,
                opacity: 0.95,
              }}
            />

            {/* Expanding Uncertainty Circles for Lagrangian Hindcast */}
            {driftTrajectory &&
              driftTrajectory
                .filter((_, idx) => idx % Math.max(1, Math.floor(driftTrajectory.length / 5)) === 0)
                .map((pt, idx) => (
                  <Circle
                    key={`uncertainty-${idx}`}
                    center={[pt.lat, pt.lon]}
                    radius={(pt.uncertainty_radius_km || 1.0) * 1000}
                    pathOptions={{
                      color: '#f97316',
                      fillColor: '#fb923c',
                      fillOpacity: 0.08,
                      weight: 1,
                      dashArray: '3, 4',
                    }}
                  />
                ))}

            {/* Hindcast Drift Timeline Nodes */}
            {effectiveDriftPath.length > 0 && (
              <>
                <Marker position={effectiveDriftPath[0]} icon={createDriftNodeIcon(`T-${hoursWindow}h (Origin)`)} />
                {effectiveDriftPath.length > 2 && (
                  <Marker
                    position={effectiveDriftPath[Math.floor(effectiveDriftPath.length / 2)]}
                    icon={createDriftNodeIcon(`T-${Math.floor(hoursWindow / 2)}h`)}
                  />
                )}
                <Marker position={effectiveDriftPath[effectiveDriftPath.length - 1]} icon={createDriftNodeIcon('SPILL OBSERVED')} />
              </>
            )}
          </>
        )}

        {/* Forward Forecast Flow Polyline (Prediction) */}
        {(driftMode === 'forecast' || driftMode === 'dual') && effectiveForecastPath.length >= 2 && (
          <>
            <Polyline
              positions={effectiveForecastPath}
              pathOptions={{
                color: '#06b6d4',
                weight: 3.5,
                dashArray: '8, 8',
                opacity: 0.95,
              }}
            />

            {/* Expanding Forward Dispersion Circles */}
            {forecastTrajectory &&
              forecastTrajectory
                .filter((_, idx) => idx % Math.max(1, Math.floor(forecastTrajectory.length / 5)) === 0)
                .map((pt, idx) => (
                  <Circle
                    key={`forecast-dispersion-${idx}`}
                    center={[pt.lat, pt.lon]}
                    radius={(pt.uncertainty_radius_km || 1.2) * 1000}
                    pathOptions={{
                      color: '#06b6d4',
                      fillColor: '#22d3ee',
                      fillOpacity: 0.08,
                      weight: 1,
                      dashArray: '4, 4',
                    }}
                  />
                ))}

            {/* Forecast Timeline Nodes */}
            {effectiveForecastPath.length > 0 && (
              <>
                {effectiveForecastPath.length > 1 && (
                  <Marker
                    position={effectiveForecastPath[Math.min(effectiveForecastPath.length - 1, 12)]}
                    icon={createForecastNodeIcon('T+6h Forecast')}
                  />
                )}
                {effectiveForecastPath.length > 24 && (
                  <Marker
                    position={effectiveForecastPath[Math.min(effectiveForecastPath.length - 1, 48)]}
                    icon={createForecastNodeIcon('T+24h Forecast')}
                  />
                )}
                <Marker
                  position={effectiveForecastPath[effectiveForecastPath.length - 1]}
                  icon={createForecastNodeIcon('T+48h Horizon')}
                />
              </>
            )}
          </>
        )}

        {/* Candidate Vessel Markers (All candidates with coordinates, deduplicated by MMSI) */}
        {(() => {
          const renderedMmsis = new Set<string>();
          const candidatesToRender: Array<{
            candidate: CandidateRanking;
            position: [number, number];
            isPrimary: boolean;
          }> = [];

          // If active candidate has valid coordinates, ensure it's prioritized
          if (candidatePos && activeCandidate) {
            candidatesToRender.push({
              candidate: activeCandidate,
              position: candidatePos,
              isPrimary: activeCandidate.rank === 1 || !rankings.length || rankings[0]?.mmsi === activeCandidate.mmsi,
            });
            if (activeCandidate.mmsi) renderedMmsis.add(activeCandidate.mmsi);
          }

          // Add other candidates from rankings that have valid coordinates
          for (const cand of rankings) {
            if (!cand.mmsi || renderedMmsis.has(cand.mmsi)) continue;
            if (
              cand.lat != null &&
              cand.lng != null &&
              !isNaN(cand.lat) &&
              !isNaN(cand.lng)
            ) {
              renderedMmsis.add(cand.mmsi);
              candidatesToRender.push({
                candidate: cand,
                position: [cand.lat, cand.lng],
                isPrimary: cand.rank === 1,
              });
            }
          }

          return candidatesToRender.map(({ candidate, position, isPrimary }) => {
            const label = isPrimary
              ? `PRIMARY: ${candidate.name || 'SUSPECT'}`
              : `CANDIDATE #${candidate.rank}: ${candidate.name || 'VESSEL'}`;

            return (
              <Marker
                key={`cand-marker-${candidate.mmsi || candidate.rank}`}
                position={position}
                icon={createVesselMarkerIcon(label, isPrimary)}
              >
                <Tooltip permanent={false} direction="top">
                  <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    <div>{candidate.name || 'Candidate Vessel'}</div>
                    <div style={{ fontSize: '10px', color: isPrimary ? '#00d7b2' : '#fbbf24', marginTop: '2px' }}>
                      {isPrimary ? 'PRIMARY SUSPECT' : `RANK #${candidate.rank}`} · Score: {candidate.associationScore}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                      MMSI: {candidate.mmsi || 'N/A'} {candidate.imo ? `· IMO: ${candidate.imo}` : ''}
                    </div>
                    <div style={{ fontSize: '9px', color: '#00d7b2', marginTop: '3px' }}>
                      Correlated Pos: [{position[0].toFixed(4)}, {position[1].toFixed(4)}]
                    </div>
                    {candidate.positionTimestamp && (
                      <div style={{ fontSize: '9px', color: '#cbd5e1' }}>
                        Observed: {new Date(candidate.positionTimestamp).toUTCString().replace('GMT', 'UTC')}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Marker>
            );
          });
        })()}
      </MapContainer>

      {/* Floating Card over Map in Simulation Mode */}
      {showFloatingCandidateCard && (
        <div
          style={{
            position: 'absolute',
            top: '1.25rem',
            left: '1.25rem',
            width: '320px',
            background: 'rgba(11, 23, 35, 0.95)',
            border: '1.5px solid var(--accent-cyan)',
            borderRadius: '6px',
            padding: '1.25rem',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', fontWeight: 700 }}>
              CANDIDATE VESSEL #{activeCandidate?.rank || 1}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {activeCandidate?.mmsi ? `MMSI: ${activeCandidate.mmsi}` : 'ID: N/A'}
            </span>
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.2rem' }}>
            {activeCandidate?.name || 'UNKNOWN CANDIDATE'}
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
            IMO: {activeCandidate?.imo || 'N/A'} | MMSI: {activeCandidate?.mmsi || 'N/A'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Proximity match</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {activeCandidate?.associationScore != null
                  ? activeCandidate.associationScore > 75 ? 'High' : 'Medium'
                  : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Time correlation</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {activeCandidate?.associationScore != null
                  ? activeCandidate.associationScore > 60 ? 'Confirmed' : 'Unconfirmed'
                  : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Attribution Score</span>
              <span style={{ color: '#00d7b2', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {activeCandidate?.associationScore != null ? activeCandidate.associationScore : 'N/A'}
              </span>
            </div>
            {activeCandidate?.lat != null && activeCandidate?.lng != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Correlated Pos</span>
                <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                  [{activeCandidate.lat.toFixed(4)}, {activeCandidate.lng.toFixed(4)}]
                </span>
              </div>
            )}
            {activeCandidate?.positionTimestamp && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Correlated At</span>
                <span style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                  {new Date(activeCandidate.positionTimestamp).toUTCString().replace('GMT', 'UTC')}
                </span>
              </div>
            )}
          </div>

          <button
            className="btn-primary-cyan"
            onClick={onViewEvidenceDetails}
            style={{ width: '100%', height: '36px', fontSize: '0.78rem' }}
          >
            View Evidence Details
          </button>
        </div>
      )}

      {/* HUD Controls on top right: View Mode Toggle + Layer Switcher + Legend */}
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
          {/* Drift Mode Selector: Hindcast vs Forecast vs Dual */}
          <div
            style={{
              display: 'flex',
              gap: '3px',
              background: 'rgba(11, 23, 35, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              padding: '3px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
          >
            <button
              onClick={() => setDriftMode('hindcast')}
              style={{
                background: driftMode === 'hindcast' ? '#fb923c' : 'transparent',
                color: driftMode === 'hindcast' ? '#070e17' : '#94a3b8',
                border: 'none',
                padding: '5px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Hindcast: Trace slick backward in time to source origin"
            >
              ⏪ Hindcast
            </button>
            <button
              onClick={() => setDriftMode('forecast')}
              style={{
                background: driftMode === 'forecast' ? '#06b6d4' : 'transparent',
                color: driftMode === 'forecast' ? '#070e17' : '#94a3b8',
                border: 'none',
                padding: '5px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Forecast: Predict future forward flow & landfall trajectory"
            >
              ⏩ Forecast
            </button>
            <button
              onClick={() => setDriftMode('dual')}
              style={{
                background: driftMode === 'dual' ? 'var(--accent-cyan, #00d7b2)' : 'transparent',
                color: driftMode === 'dual' ? '#070e17' : '#94a3b8',
                border: 'none',
                padding: '5px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Dual Drift: View both Origin Hindcast and Forward Flow Prediction"
            >
              ↔ Dual Drift
            </button>
          </div>

          {/* Multi-window historical time selector */}
          <div
            style={{
              display: 'flex',
              gap: '3px',
              background: 'rgba(11, 23, 35, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              padding: '3px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: '#94a3b8' }}>
              <Clock size={13} color="#00d7b2" />
            </div>
            {([1, 6, 12, 24] as const).map((hrs) => (
              <button
                key={hrs}
                onClick={() => onHoursWindowChange && onHoursWindowChange(hrs)}
                style={{
                  background: hoursWindow === hrs ? 'var(--accent-cyan, #00d7b2)' : 'transparent',
                  color: hoursWindow === hrs ? '#070e17' : '#94a3b8',
                  border: 'none',
                  padding: '5px 9px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={`Analyze ${hrs} hours historical tracking & Lagrangian drift`}
              >
                {hrs}H
              </button>
            ))}
          </div>

          {/* Whole Map vs Focus Drift Corridor toggle */}
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
                <span>Focus Corridor</span>
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

        {/* Hydrodynamic Drift Vectors Card */}
        {hydrodynamics && (
          <div
            style={{
              background: 'rgba(11, 23, 35, 0.94)',
              border: '1px solid rgba(0, 215, 178, 0.3)',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '11px',
              color: '#e2e8f0',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '205px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#00d7b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Waves size={13} />
              <span>Lagrangian Drift Vectors</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Surface Current:</span>
              <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {hydrodynamics.surface_current?.speed_knots ?? 0.8} kt @ {hydrodynamics.surface_current?.direction_deg ?? 45}°
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
              <span>Wind Leeway (3%):</span>
              <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {hydrodynamics.wind?.speed_knots ?? 12.0} kt @ {hydrodynamics.wind?.direction_deg ?? 80}°
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fb923c', fontWeight: 600, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '3px' }}>
              <span>Net Reverse Drift:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {hydrodynamics.net_drift_vector?.speed_knots ?? 1.15} kt @ {((hydrodynamics.net_drift_vector?.direction_deg ?? 45) + 180) % 360}°
              </span>
            </div>
          </div>
        )}

        {/* Forensic Layer Legend */}
        <div className="forensic-legend-box" style={{ position: 'static', marginTop: '4px' }}>
          <div className="legend-title">LAYER LEGEND</div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#c026d3' }} />
            <span>Detected Spill Contour</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#00d7b2' }} />
            <span>Candidate Vessel AIS</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#f97316' }} />
            <span>Backtrack Drift Model</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#06b6d4' }} />
            <span>Forecast Forward Flow</span>
          </div>
        </div>
      </div>

      {/* Spill Characterization & Weathering HUD Card */}
      {spillCharacterization && spillCharacterization.data_available !== false && spillCharacterization.status !== 'DEFERRED' && (
        <div
          style={{
            position: 'absolute',
            bottom: '44px',
            left: '14px',
            width: '320px',
            background: 'rgba(11, 23, 35, 0.95)',
            border: '1px solid rgba(192, 38, 211, 0.4)',
            borderRadius: '6px',
            padding: '12px',
            backdropFilter: 'blur(12px)',
            zIndex: 990,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c026d3', fontWeight: 800, fontSize: '11px', letterSpacing: '0.5px' }}>
              <Sparkles size={13} />
              <span>SLICK CHARACTERIZATION & AGE</span>
            </div>
            <span
              style={{
                background: spillCharacterization.weathering_stage === 'FRESH_DISCHARGE' ? 'rgba(0, 215, 178, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                color: spillCharacterization.weathering_stage === 'FRESH_DISCHARGE' ? '#00d7b2' : '#fbbf24',
                border: `1px solid ${spillCharacterization.weathering_stage === 'FRESH_DISCHARGE' ? '#00d7b2' : '#fbbf24'}`,
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 800,
              }}
            >
              {spillCharacterization.weathering_stage ? spillCharacterization.weathering_stage.replace('_', ' ') : 'NOT AVAILABLE'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', marginTop: '2px' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>AREA / PERIMETER</div>
              <div style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {spillCharacterization.area_km2 != null ? `${spillCharacterization.area_km2} km²` : 'N/A'}
                {spillCharacterization.perimeter_km != null ? ` / ${spillCharacterization.perimeter_km} km` : ''}
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>ASPECT RATIO / AXIS</div>
              <div style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {spillCharacterization.aspect_ratio != null
                  ? `${spillCharacterization.aspect_ratio}x (${spillCharacterization.orientation_deg != null ? `${spillCharacterization.orientation_deg}°` : 'N/A'})`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>DAMPING CONTRAST</div>
              <div style={{ color: '#c084fc', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {spillCharacterization.damping_contrast_db != null ? `${spillCharacterization.damping_contrast_db} dB` : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>ESTIMATED AGE</div>
              <div style={{ color: '#fb923c', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                {spillCharacterization.estimated_age_hours != null ? `~${spillCharacterization.estimated_age_hours} hours` : 'N/A'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
            <span>Evaporation: <strong style={{ color: '#ffffff' }}>{spillCharacterization.evaporation_fraction_pct != null ? `${spillCharacterization.evaporation_fraction_pct}%` : 'N/A'}</strong></span>
            <span>Risk: <strong style={{ color: spillCharacterization.emulsification_risk === 'HIGH' ? '#f43f5e' : '#fbbf24' }}>{spillCharacterization.emulsification_risk || 'N/A'}</strong></span>
          </div>
        </div>
      )}

      {/* Forensic Bottom Status HUD */}
      <div className="forensic-bottom-bar">
        <div>
          MODEL: <span style={{ color: '#ffffff' }}>GNOME v1.3</span> &nbsp;|&nbsp;
          CONFIDENCE INTERVAL: <span style={{ color: 'var(--accent-cyan)' }}>{activeCandidate?.associationScore != null ? `${activeCandidate.associationScore}%` : 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <Maximize2 size={13} />
          <span>Expand View</span>
        </div>
      </div>
    </div>
  );
}
