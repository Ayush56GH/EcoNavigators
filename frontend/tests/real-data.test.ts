import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 1. Test Geographic Coordinate Formatter
import { formatCoordinate, formatLatitude, formatLongitude } from '../src/utils/geo.ts';

test('Geo: formatCoordinate formats directional latitude and longitude correctly', () => {
  // Florida/Miami coords (North, West)
  assert.equal(formatCoordinate(25.7704, -80.1514), '25.7704° N, 80.1514° W');
  // Southern/Eastern hemisphere (South, East)
  assert.equal(formatCoordinate(-12.3456, 45.6789), '12.3456° S, 45.6789° E');
  // Equator and Prime Meridian (North, East)
  assert.equal(formatCoordinate(0, 0), '0.0000° N, 0.0000° E');
  // Custom precision
  assert.equal(formatCoordinate(28.45, -89.12, 2), '28.45° N, 89.12° W');
});

test('Geo: formatCoordinate handles null, undefined, and NaN by returning COORDINATES UNAVAILABLE', () => {
  assert.equal(formatCoordinate(undefined, undefined), 'COORDINATES UNAVAILABLE');
  assert.equal(formatCoordinate(null, null), 'COORDINATES UNAVAILABLE');
  assert.equal(formatCoordinate(NaN, 10), 'COORDINATES UNAVAILABLE');
  assert.equal(formatCoordinate(10, NaN), 'COORDINATES UNAVAILABLE');
  assert.equal(formatCoordinate(undefined, 80), 'COORDINATES UNAVAILABLE');
});

test('Geo: formatLatitude and formatLongitude format single axes correctly', () => {
  assert.equal(formatLatitude(34.0522), '34.0522° N');
  assert.equal(formatLatitude(-33.8688), '33.8688° S');
  assert.equal(formatLatitude(undefined), 'N/A');

  assert.equal(formatLongitude(-118.2437), '118.2437° W');
  assert.equal(formatLongitude(151.2093), '151.2093° E');
  assert.equal(formatLongitude(null), 'N/A');
});

// 2. Test Spill Adapter Real Data Mapping
import {
  mapSpillSummary,
  mapSpillDetail,
} from '../src/services/adapters/spillAdapter.ts';

test('SpillAdapter: maps backend spill to summary without synthetic fields', () => {
  const rawBackend = {
    id: 'spill-live-001',
    detectionTime: '2026-09-09T10:00:00Z',
    lat: 28.1234,
    lng: -89.5678,
    estArea: '14.5 km²',
    confidence: '88%',
    status: 'ACTIVE',
  };

  const summary = mapSpillSummary(rawBackend);
  assert.equal(summary.id, 'spill-live-001');
  assert.equal(summary.lat, 28.1234);
  assert.equal(summary.lng, -89.5678);
  assert.equal(summary.estArea, '14.5 km²');
  assert.equal(summary.confidence, '88%');
  assert.equal(summary.status, 'ACTIVE');
});

test('SpillAdapter: preserves GeoJSON polygonGeom and does not fabricate slick polygons', () => {
  const rawPolygon: [number, number][] = [
    [28.1, -89.5],
    [28.2, -89.5],
    [28.2, -89.4],
    [28.1, -89.4],
  ];

  const rawDetail = {
    id: 'spill-live-002',
    timestamp: '2026-09-09T11:00:00Z',
    lat: 28.15,
    lng: -89.45,
    area_km2: 8.2,
    confidence: 0.94,
    polygonGeom: rawPolygon,
  };

  const detail = mapSpillDetail(rawDetail);
  assert.equal(detail.id, 'spill-live-002');
  assert.equal(detail.lat, 28.15);
  assert.equal(detail.lng, -89.45);
  assert.deepEqual(detail.polygonGeom, rawPolygon);
});

test('SpillAdapter: missing polygon does not synthesize fake geometry', () => {
  const rawNoPolygon = {
    id: 'spill-no-poly',
    timestamp: '2026-09-09T11:00:00Z',
    lat: 28.0,
    lng: -89.0,
  };

  const detail = mapSpillDetail(rawNoPolygon);
  assert.equal(detail.polygonGeom, null, 'polygonGeom must remain null when backend provides none');
});

// 3. Test Vessel Adapter Real Data Mapping
import {
  mapTrackedVessel,
  mapVesselDetail,
} from '../src/services/adapters/vesselAdapter.ts';

test('VesselAdapter: maps backend vessel without synthetic waypoints', () => {
  const rawVessel = {
    mmsi: '123456789',
    name: 'PACIFIC EXPLORER',
    imo: '9876543',
    lat: 24.5,
    lng: -81.2,
    speed: '12.4 kts',
    heading: '180°',
    status: 'Underway',
  };

  const tracked = mapTrackedVessel(rawVessel);
  assert.equal(tracked.mmsi, '123456789');
  assert.equal(tracked.name, 'PACIFIC EXPLORER');
  assert.equal(tracked.lat, 24.5);
  assert.equal(tracked.lng, -81.2);
  assert.equal(tracked.speed, '12.4 kts');
});

test('VesselAdapter: invalid/missing coordinates do not fabricate fake positions', () => {
  const rawInvalid = {
    mmsi: '999999999',
    lat: null,
    lng: undefined,
  };

  const tracked = mapTrackedVessel(rawInvalid);
  assert.equal(tracked.lat, undefined);
  assert.equal(tracked.lng, undefined);
  assert.equal(tracked.lastCoords, 'Position unavailable');
});

test('VesselAdapter: maps real AIS track points accurately into vessel detail', () => {
  const rawVessel = {
    mmsi: '123456789',
    name: 'PACIFIC EXPLORER',
    trajectory: [
      { timestamp: '2026-09-09T08:00:00Z', lat: 24.1, lon: -81.0, sog: 10 },
      { timestamp: '2026-09-09T06:00:00Z', lat: 24.0, lon: -80.9, sog: 11 },
    ],
  };

  const detail = mapVesselDetail(rawVessel);
  assert.equal(detail.trajectory.length, 2);
  assert.equal(detail.trajectory[0].lat, 24.1);
  assert.equal(detail.trajectory[0].lng, -81.0);
  assert.equal(detail.trajectory[0].speedKnots, 10);
});

// 4. Test Backtrack Adapter Real Data Mapping
import {
  mapBacktrackingResponse,
  mapCandidateRanking,
  mapForensicEvidence,
} from '../src/services/adapters/backtrackAdapter.ts';

test('BacktrackAdapter: maps real hydrodynamic drift and candidate rankings safely', () => {
  const rawBacktrack = {
    spillId: 'spill-bt-01',
    analysisWindowHours: 12,
    estimatedOriginPoint: [28.5, -89.2],
    driftTrajectory: [
      { step: 1, lat: 28.52, lon: -89.25, uncertainty_radius_km: 1.2 },
      { step: 2, lat: 28.50, lon: -89.20, uncertainty_radius_km: 1.5 },
    ],
    rankings: [
      {
        mmsi: '312000100',
        name: 'MT OCEAN LEADER',
        rank: 1,
        associationScore: 91,
      },
    ],
    forensicEvidence: {
      cpa: '0.42 nm',
      intersectionArea: '3.1 km²',
      proximityLevel: 'HIGH',
      anomalyTimestamp: '2026-09-09T09:30:00Z',
      deltaT: '-14 min',
      timeCorrelationLevel: 'CONFIRMED',
      headingVariance: '±3.2°',
      speedProfile: '11.8 kt constant',
      trajectoryMatchLevel: 'HIGH',
    },
  };

  const result = mapBacktrackingResponse(rawBacktrack);
  assert.equal(result.spillId, 'spill-bt-01');
  assert.deepEqual(result.estimatedOriginPoint, [28.5, -89.2]);
  assert.equal(result.driftTrajectory.length, 2);
  assert.equal(result.rankings.length, 1);
  assert.equal(result.rankings[0].mmsi, '312000100');
  assert.equal(result.rankings[0].associationScore, 91);
  assert.equal(result.forensicEvidence?.cpa, '0.42 nm');
});

test('BacktrackAdapter: empty backend results yield empty arrays and nulls, not fake defaults', () => {
  const result = mapBacktrackingResponse({});
  assert.equal(result.rankings.length, 0);
  assert.equal(result.driftTrajectory.length, 0);
  assert.equal(result.forecastTrajectory.length, 0);
  assert.equal(result.estimatedOriginPoint, null);
  assert.equal(result.forensicEvidence.cpa, 'N/A');
  assert.equal(result.forensicEvidence.intersectionArea, 'N/A');
});

// 5. Codebase Integrity Audits: Verify no hardcoded literals remain in live flow
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Codebase Integrity: No fake fallback coordinates [25.7704, -80.1514] in map components', () => {
  const mapFiles = [
    'src/components/map/LeafletMap.tsx',
    'src/components/vessels/VesselMap.tsx',
    'src/components/spills/SpillMap.tsx',
    'src/components/backtracking/BacktrackMap.tsx',
    'src/components/satellite/CopernicusReconModal.tsx',
  ];

  for (const relPath of mapFiles) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(
      !content.includes('25.7704'),
      `File ${relPath} should not contain hardcoded coordinate 25.7704`
    );
    assert.ok(
      !content.includes('-80.1514'),
      `File ${relPath} should not contain hardcoded coordinate -80.1514`
    );
  }
});

test('Codebase Integrity: No fake incident ID "EV-8892" fabricated in live backtracking', () => {
  const backtrackingPage = path.join(rootDir, 'src/app/(dashboard)/backtracking/page.tsx');
  const content = fs.readFileSync(backtrackingPage, 'utf8');
  assert.ok(
    !content.includes("'EV-8892'"),
    'Backtracking page must not contain hardcoded incidentId EV-8892'
  );
  assert.ok(
    !content.includes('"EV-8892"'),
    'Backtracking page must not contain hardcoded incidentId EV-8892'
  );
});

test('Codebase Integrity: No hardcoded 127.0.0.1:8000 in login/signup or pages', () => {
  const pagesToCheck = [
    'src/app/login/page.tsx',
    'src/app/signup/page.tsx',
    'src/app/(dashboard)/dashboard/page.tsx',
    'src/app/(dashboard)/vessels/page.tsx',
    'src/app/(dashboard)/spills/page.tsx',
    'src/app/(dashboard)/alerts/page.tsx',
    'src/app/(dashboard)/backtracking/page.tsx',
  ];

  for (const relPath of pagesToCheck) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(
      !content.includes('127.0.0.1:8000'),
      `Page ${relPath} should not contain hardcoded 127.0.0.1:8000`
    );
  }
});

// 6. Test AppMode switching
import { getAppMode, setAppMode } from '../src/utils/appMode.ts';

test('AppMode: defaults to live mode and supports toggling between live and demo', () => {
  // Should default to live
  assert.equal(getAppMode(), 'live');

  // Switch to demo
  setAppMode('demo');
  assert.equal(getAppMode(), 'demo');

  // Switch back to live
  setAppMode('live');
  assert.equal(getAppMode(), 'live');
});

// 7. Incident Adapter & Pipeline Tests
import {
  createIncidentFromAlert,
  createIncidentFromSpill,
  createIncidentFromVessel,
} from '../src/services/adapters/incidentAdapter.ts';
import { identifyVessel, getIncident } from '../src/services/api.ts';

test('IncidentAdapter: createIncidentFromAlert extracts canonical MMSI and assigns flow status', () => {
  const alert = {
    id: 'AIS-368091590',
    title: 'AIS Anomaly: SPEED_DROP',
    timestamp: '2026-09-09T12:00:00Z',
    severity: 'warning' as const,
    mmsi: '368091590',
    speed: '4.2 kts',
  };

  const incident = createIncidentFromAlert(alert);
  assert.equal(incident.incidentId, 'AIS-368091590');
  assert.equal(incident.mmsi, '368091590');
  assert.equal(incident.status, 'AIS_ANOMALY');
  assert.equal(incident.risk, 'Medium');
  assert.equal(incident.ais?.mmsi, '368091590');
});

test('IncidentAdapter: createIncidentFromVessel preserves MMSI and does not fabricate IMO', () => {
  const vessel = {
    id: '368091590',
    mmsi: '368091590',
    name: 'OCEAN GUARDIAN',
    category: 'PRODUCT TANKER',
    imo: null,
    risk: 'Medium' as const,
    speed: '11.2 kts',
    heading: '180°',
    status: 'Underway',
  };

  const incident = createIncidentFromVessel(vessel);
  assert.equal(incident.mmsi, '368091590');
  assert.equal(incident.vessel?.mmsi, '368091590');
  assert.equal(incident.ais?.imo, null);
  assert.ok(!incident.ais?.imo?.startsWith('IMO-'));
});

test('Identify API: in Demo mode returns valid Incident with SAR status DEFERRED', async () => {
  setAppMode('demo');
  try {
    const inc = await identifyVessel('368091590');
    assert.equal(inc.mmsi, '368091590');
    assert.ok(inc.incidentId.startsWith('INC-368091590'));
    assert.equal((inc.sar as any)?.status, 'DEFERRED');
    assert.ok((inc.sar as any)?.reason?.toLowerCase().includes('deferred'));
  } finally {
    setAppMode('live');
  }
});

test('Identify API: in Live mode rejects unreachable backend with ApiError and never substitutes mock data', async () => {
  setAppMode('live');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed: ECONNREFUSED');
  }) as any;
  try {
    // Attempting to call identifyVessel when backend is unreachable must strictly reject with ApiError
    await assert.rejects(
      async () => {
        await identifyVessel('999999999');
      },
      (err: any) => {
        assert.ok(err.name === 'ApiError');
        assert.ok(err.message.includes('Unable to connect') || err.message.includes('backend service') || err.message.includes('ECONNREFUSED'));
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Codebase Integrity: ForensicDossierPanel does not fabricate percentages 90, 65, 35, 95', () => {
  const dossierFile = path.join(rootDir, 'src/components/backtracking/ForensicDossierPanel.tsx');
  const content = fs.readFileSync(dossierFile, 'utf8');
  assert.ok(!content.includes('? 90 :'), 'ForensicDossierPanel must not contain fake 90% derivation');
  assert.ok(!content.includes('? 65 :'), 'ForensicDossierPanel must not contain fake 65% derivation');
  assert.ok(!content.includes('? 35 :'), 'ForensicDossierPanel must not contain fake 35% derivation');
  assert.ok(!content.includes('? 95 :'), 'ForensicDossierPanel must not contain fake 95% derivation');
});

test('Codebase Integrity: CandidateVesselCard does not fabricate IMO- prefix', () => {
  const cardFile = path.join(rootDir, 'src/components/dashboard/CandidateVesselCard.tsx');
  const content = fs.readFileSync(cardFile, 'utf8');
  assert.ok(!content.includes('`IMO-${vessel.imo}`'), 'CandidateVesselCard must not fabricate IMO- prefix');
});

test('Codebase Integrity: Dedicated Incident detail route exists and defines SAR as DEFERRED', () => {
  const incidentPage = path.join(rootDir, 'src/app/(dashboard)/incidents/[incidentId]/page.tsx');
  assert.ok(fs.existsSync(incidentPage), 'incidents/[incidentId]/page.tsx must exist');
  const content = fs.readFileSync(incidentPage, 'utf8');
  assert.ok(content.includes('DEFERRED'), 'Incident page must display DEFERRED for SAR');
  assert.ok(content.includes('getVesselTrack'), 'Incident page must fetch real AIS track');
  assert.ok(content.includes('/backtracking'), 'Incident page must include action to initiate backtracking');
});

test('Codebase Integrity: Alerts page routes AIS alerts through Identify and does not use alert.id as fake spillId', () => {
  const alertsPage = path.join(rootDir, 'src/app/(dashboard)/alerts/page.tsx');
  const content = fs.readFileSync(alertsPage, 'utf8');
  assert.ok(content.includes('isAisAlert'), 'Alerts page must identify AIS alerts');
  assert.ok(content.includes('handleIdentifyAlert'), 'Alerts page must have handleIdentifyAlert handler');
  assert.ok(content.includes('const investigateHref = isAisAlert\n              ? null'), 'AIS alerts must not have direct investigateHref with fake spill ID');
});

test('Codebase Integrity: Backtracking page accepts and prioritizes incidentId parameter', () => {
  const btPage = path.join(rootDir, 'src/app/(dashboard)/backtracking/page.tsx');
  const content = fs.readFileSync(btPage, 'utf8');
  assert.ok(content.includes('incidentIdFromUrl'), 'Backtracking page must read incidentId from URL');
  assert.ok(content.includes('getBacktrackingAnalysis'), 'Backtracking page must call getBacktrackingAnalysis');
});

test('Codebase Integrity: Candidate ranking displays Attribution Score without percentage symbol', () => {
  const panelFile = path.join(rootDir, 'src/components/backtracking/CandidateRankingPanel.tsx');
  const content = fs.readFileSync(panelFile, 'utf8');
  assert.ok(content.includes('Attribution Score'), 'Candidate ranking must display Attribution Score label');
  assert.ok(!content.includes('{c.associationScore}%'), 'Candidate ranking must not append % suffix to attribution score');
});

test('Codebase Integrity: Spills page and Vessels page use MMSI only for vessel track lookup', () => {
  const spillsPage = path.join(rootDir, 'src/app/(dashboard)/spills/page.tsx');
  const spillsContent = fs.readFileSync(spillsPage, 'utf8');
  assert.ok(!spillsContent.includes('primaryTrack?.imo && !primaryTrack.imo.startsWith'), 'Spills page must not fall back to IMO for track lookup');

  const vesselsPage = path.join(rootDir, 'src/app/(dashboard)/vessels/page.tsx');
  const vesselsContent = fs.readFileSync(vesselsPage, 'utf8');
  assert.ok(!vesselsContent.includes('getVesselTrack(selectedVessel.id || selectedVessel.mmsi)'), 'Vessels page must not pass non-MMSI vessel id to getVesselTrack');
});

test('UI Integrity: formatIncidentId standardizes incident identifiers', async () => {
  const { formatIncidentId } = await import('../src/utils/formatters.ts');
  assert.equal(formatIncidentId('Spill-7'), 'INC-007');
  assert.equal(formatIncidentId('Spill-1'), 'INC-001');
  assert.equal(formatIncidentId('Spill-12'), 'INC-012');
  assert.equal(formatIncidentId('INC-2026-001'), 'INC-2026-001');
  assert.equal(formatIncidentId(null), 'INC-N/A');
});

test('UI Integrity: SpillDetailPanel uses BACKTRACK INCIDENT and incidentId routing', () => {
  const panelFile = path.join(rootDir, 'src/components/spills/SpillDetailPanel.tsx');
  const content = fs.readFileSync(panelFile, 'utf8');
  assert.ok(content.includes('BACKTRACK INCIDENT'), 'SpillDetailPanel button must read BACKTRACK INCIDENT');
  assert.ok(content.includes('incidentId='), 'SpillDetailPanel must route with incidentId');
  assert.ok(!content.includes('BACKTRACK SPILL'), 'SpillDetailPanel must not contain legacy BACKTRACK SPILL text');
});

test('UI Integrity: SpillMap warning banner contains exact scientific honesty text', () => {
  const mapFile = path.join(rootDir, 'src/components/spills/SpillMap.tsx');
  const content = fs.readFileSync(mapFile, 'utf8');
  assert.ok(content.includes('SLICK BOUNDARY UNAVAILABLE — Point centroid rendered (Observed coordinates, no polygon fabricated)'));
});

test('UI Integrity: BacktrackMap labels simulated forecast as MODELLED FORECAST', () => {
  const mapFile = path.join(rootDir, 'src/components/backtracking/BacktrackMap.tsx');
  const content = fs.readFileSync(mapFile, 'utf8');
  assert.ok(content.includes('MODELLED FORECAST:'), 'BacktrackMap must clearly label simulated drift as MODELLED FORECAST');
});

test('Search Integrity: Topbar provides working search form navigating to /vessels?search=', () => {
  const topbarFile = path.join(rootDir, 'src/components/app-shell/Topbar.tsx');
  const content = fs.readFileSync(topbarFile, 'utf8');
  assert.ok(content.includes('searchQuery'), 'Topbar must have controlled searchQuery state');
  assert.ok(content.includes('handleSearchSubmit'), 'Topbar must have handleSearchSubmit');
  assert.ok(content.includes('/vessels?search='), 'Topbar must navigate to /vessels?search=');
  assert.ok(content.includes("router.push('/vessels')"), 'Topbar must navigate to /vessels when search query is empty');
  assert.ok(content.includes("type=\"submit\""), 'Topbar must have submit trigger');
});

test('Search Integrity: Vessels page consumes search query parameter and passes to getTrackedVessels', () => {
  const vesselsPageFile = path.join(rootDir, 'src/app/(dashboard)/vessels/page.tsx');
  const content = fs.readFileSync(vesselsPageFile, 'utf8');
  assert.ok(content.includes("searchParams.get('search')"), 'Vessels page must read search param from URL');
  assert.ok(content.includes('search: searchFromUrl'), 'Vessels page must pass search to getTrackedVessels');
  assert.ok(content.includes('searchQuery={searchFromUrl}'), 'Vessels page must pass searchQuery to VesselListPanel');
});

test('Incident Integrity: Backtracking page loads real persisted incidents and preserves canonical incidentId', () => {
  const backtrackingFile = path.join(rootDir, 'src/app/(dashboard)/backtracking/page.tsx');
  const content = fs.readFileSync(backtrackingFile, 'utf8');
  assert.ok(content.includes('getIncidents'), 'Backtracking page must import and invoke getIncidents');
  assert.ok(content.includes('setIncidentList'), 'Backtracking page must manage incidentList state');
  assert.ok(content.includes('value={inc.incidentId}'), 'Dropdown options must bind real incident.incidentId');
  assert.ok(content.includes('selectedSpillId.startsWith(\'INC-\')'), 'Backtracking page must detect canonical INC- identifiers');
});


