'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Download, Radio, ChevronDown, WifiOff } from 'lucide-react';
import CandidateRankingPanel from '@/components/backtracking/CandidateRankingPanel';
import ForensicDossierPanel from '@/components/backtracking/ForensicDossierPanel';
import BacktrackMapCanvas from '@/components/backtracking/BacktrackMapCanvas';
import CopernicusReconModal from '@/components/satellite/CopernicusReconModal';
import { CandidateRanking, ForensicCorrelationData } from '@/types/backtracking';
import { Incident } from '@/types/incident';
import { mockCandidateRankings, mockForensicEvidence } from '@/data/demo/mockBacktracking';
import { getBacktrackingAnalysis, getVesselTrack, getSpillDetail, getSpillsList, getIncidents } from '@/services/api';
import { getAppMode } from '@/utils/appMode';
import { formatIncidentId } from '@/utils/formatters';

// Inner component that uses useSearchParams (must be inside Suspense boundary)
function BacktrackingPageInner() {
  const searchParams = useSearchParams();
  const isDemo = getAppMode() === 'demo';
  const incidentIdFromUrl = searchParams.get('incidentId') || '';
  const spillIdFromUrl = searchParams.get('spillId') || incidentIdFromUrl || (isDemo ? 'Spill-1' : '');

  const [selectedSpillId, setSelectedSpillId] = useState<string>(incidentIdFromUrl || spillIdFromUrl);
  const [incidentList, setIncidentList] = useState<Incident[]>([]);
  const [spillsList, setSpillsList] = useState<any[]>([]);
  const [rankings, setRankings] = useState<CandidateRanking[]>(isDemo ? mockCandidateRankings : []);
  const [evidence, setEvidence] = useState<ForensicCorrelationData | null>(isDemo ? mockForensicEvidence : null);
  const [activeCandidate, setActiveCandidate] = useState<CandidateRanking | null>(
    isDemo ? mockCandidateRankings[0] : null
  );
  const [viewMode, setViewMode] = useState<'ranking' | 'dossier'>('dossier');
  const [originPoint, setOriginPoint] = useState<[number, number] | null>(isDemo ? [28.45, -89.12] : null);
  const [originPolygon, setOriginPolygon] = useState<[number, number][] | undefined>(undefined);
  const [candidateTrack, setCandidateTrack] = useState<[number, number][]>([]);
  const [hoursWindow, setHoursWindow] = useState<1 | 6 | 12 | 24>(12);
  const [driftTrajectory, setDriftTrajectory] = useState<any[]>([]);
  const [forecastTrajectory, setForecastTrajectory] = useState<any[]>([]);
  const [spillCharacterization, setSpillCharacterization] = useState<any>(null);
  const [coastalImpact, setCoastalImpact] = useState<any>(null);
  const [hydrodynamics, setHydrodynamics] = useState<any>(null);
  const [reconModalOpen, setReconModalOpen] = useState<boolean>(false);
  const [fullAnalysis, setFullAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load incidents list (and fallback spills list) for the selector dropdown
  useEffect(() => {
    Promise.all([
      getIncidents().catch((err) => {
        if (!isDemo) console.warn('[BacktrackingPage] Error loading incidents list:', err);
        return [] as Incident[];
      }),
      getSpillsList().catch((err) => {
        if (!isDemo) console.warn('[BacktrackingPage] Error loading spills list:', err);
        return [] as any[];
      }),
    ]).then(([incList, spList]) => {
      const validIncidents = Array.isArray(incList) ? incList : [];
      const validSpills = Array.isArray(spList) ? spList : [];

      setIncidentList(validIncidents);
      setSpillsList(validSpills);

      // If no incident or spill selected from URL, default to first real incident or fallback to spill
      if (!incidentIdFromUrl && !spillIdFromUrl && !selectedSpillId) {
        if (validIncidents.length > 0 && validIncidents[0]?.incidentId) {
          setSelectedSpillId(validIncidents[0].incidentId);
        } else if (validSpills.length > 0 && validSpills[0]?.id) {
          setSelectedSpillId(validSpills[0].id);
        }
      }
    });
  }, [spillIdFromUrl, incidentIdFromUrl, isDemo, selectedSpillId]);

  // Fetch analysis whenever selectedSpillId or hoursWindow changes
  useEffect(() => {
    if (!selectedSpillId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const isInc = selectedSpillId.startsWith('INC-');
    Promise.all([
      getBacktrackingAnalysis(
        selectedSpillId,
        hoursWindow,
        isInc ? selectedSpillId : undefined
      ),
      isInc ? Promise.resolve(null) : getSpillDetail(selectedSpillId).catch(() => null),
    ])
      .then(([res, spill]) => {
        if (!isMounted) return;
        setIsLoading(false);

        if (res) {
          setFullAnalysis(res);
          if (res.rankings && res.rankings.length > 0) {
            setRankings(res.rankings);
            setActiveCandidate(res.rankings[0]); // always update to top candidate from live data
          } else {
            setRankings([]);
            setActiveCandidate(null);
          }
          setEvidence(res.forensicEvidence ?? null);
          if (res.estimatedOriginPoint && !isNaN(res.estimatedOriginPoint[0]) && !isNaN(res.estimatedOriginPoint[1])) {
            setOriginPoint(res.estimatedOriginPoint);
          }
          setDriftTrajectory(res.driftTrajectory ?? []);
          setForecastTrajectory(res.forecastTrajectory ?? []);
          setSpillCharacterization(res.spillCharacterization ?? null);
          setCoastalImpact(res.coastalImpact ?? null);
          setHydrodynamics(res.hydrodynamics ?? null);
        }

        if (spill) {
          if (typeof spill.lat === 'number' && typeof spill.lng === 'number' && !res?.estimatedOriginPoint) {
            setOriginPoint([spill.lat, spill.lng]);
          }
          if (spill.polygonGeom && spill.polygonGeom.length >= 3) {
            setOriginPolygon(spill.polygonGeom);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoading(false);
        console.warn('[BacktrackingPage] Error fetching live analysis:', err);
        if (!isDemo) {
          setError(err?.message || 'Failed to fetch backtracking analysis from backend service.');
          setRankings([]);
          setActiveCandidate(null);
          setEvidence(null);
          setOriginPoint(null);
          setOriginPolygon(undefined);
          setDriftTrajectory([]);
          setForecastTrajectory([]);
          setSpillCharacterization(null);
          setCoastalImpact(null);
          setHydrodynamics(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSpillId, hoursWindow, isDemo]);

  // Fetch track when activeCandidate changes
  useEffect(() => {
    if (!activeCandidate?.mmsi) {
      setCandidateTrack([]);
      return;
    }
    let isMounted = true;

    getVesselTrack(activeCandidate.mmsi, hoursWindow)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.track && res.track.length > 0) {
          setCandidateTrack(res.track.map((pt) => [pt.lat, pt.lon] as [number, number]));
        } else {
          setCandidateTrack([]);
        }
      })
      .catch(() => {
        if (isMounted) setCandidateTrack([]);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCandidate?.mmsi, hoursWindow]);

  const handleExportDossier = () => {
    if (!activeCandidate) return;

    const dossier = {
      exportedAt: new Date().toISOString(),
      incidentId: fullAnalysis?.incidentId || (selectedSpillId ? (selectedSpillId.startsWith('INC-') ? selectedSpillId : `INC-${selectedSpillId}`) : 'N/A'),
      spillId: fullAnalysis?.spillId ?? (selectedSpillId || 'N/A'),
      analysisWindowHours: hoursWindow,
      primarySuspect: {
        name: activeCandidate.name,
        mmsi: activeCandidate.mmsi,
        imo: activeCandidate.imo,
        associationScore: activeCandidate.associationScore,
        anomalyType: activeCandidate.anomalyType,
        minDistanceKm: activeCandidate.minDistanceKm,
      },
      forensicEvidence: evidence,
      estimatedOriginPoint: originPoint,
      estimatedDischargeTime: fullAnalysis?.estimatedDischargeTime ?? null,
      spillCharacterization: spillCharacterization ?? null,
      coastalImpact: coastalImpact ?? null,
      hydrodynamics: hydrodynamics ?? null,
      candidateRankings: rankings,
      hindcastTrajectory: driftTrajectory,
      forecastTrajectory: forecastTrajectory,
    };

    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-dossier-${selectedSpillId || 'incident'}-${activeCandidate.mmsi}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Offline / Error Banner */}
      {error && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.12)',
            borderBottom: '1px solid rgba(244, 63, 94, 0.4)',
            color: '#f43f5e',
            padding: '6px 16px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <WifiOff size={14} />
          <span>BACKEND SERVICE OFFLINE: {error} (LIVE MODE - NO MOCK DATA FABRICATION)</span>
        </div>
      )}

      {/* Top Breadcrumb & Status Bar */}
      <div className="backtrack-top-bar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
            BACKTRACKING ANALYSIS &gt; <span style={{ color: 'var(--accent-cyan)' }}>FORENSIC DRIFT MODEL</span>
          </div>

          {/* Live Spill Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              INCIDENT:
            </span>
            {incidentList.length > 0 ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  value={selectedSpillId}
                  onChange={(e) => setSelectedSpillId(e.target.value)}
                  style={{
                    background: 'rgba(11, 23, 35, 0.95)',
                    border: '1px solid var(--accent-cyan)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    height: '32px',
                    padding: '0 28px 0 10px',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    minWidth: '160px',
                    boxSizing: 'border-box',
                  }}
                >
                  {incidentList.map((inc) => (
                    <option key={inc.incidentId} value={inc.incidentId} style={{ background: '#0b1723', color: '#ffffff' }}>
                      {inc.incidentId}{inc.vessel?.name ? ` — ${inc.vessel.name}` : inc.mmsi ? ` (MMSI: ${inc.mmsi})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: '8px', color: 'var(--accent-cyan)', pointerEvents: 'none' }} />
              </div>
            ) : spillsList.length > 0 ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  value={selectedSpillId}
                  onChange={(e) => setSelectedSpillId(e.target.value)}
                  style={{
                    background: 'rgba(11, 23, 35, 0.95)',
                    border: '1px solid var(--accent-cyan)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    height: '32px',
                    padding: '0 28px 0 10px',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    minWidth: '140px',
                    boxSizing: 'border-box',
                  }}
                >
                  {spillsList.map((s: any) => (
                    <option key={s.id} value={s.id} style={{ background: '#0b1723', color: '#ffffff' }}>
                      {formatIncidentId(s.id)}{s.vesselName ? ` — ${s.vesselName}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: '8px', color: 'var(--accent-cyan)', pointerEvents: 'none' }} />
              </div>
            ) : (
              <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {formatIncidentId(selectedSpillId) || 'NO INCIDENTS AVAILABLE'}
              </span>
            )}

            {isLoading && (
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', animation: 'pulse 1s infinite' }}>
                ⟳ RUNNING DRIFT MODEL...
              </span>
            )}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <span>Incident: <span style={{ color: '#ffffff', fontWeight: 700 }}>{formatIncidentId(selectedSpillId)}</span></span>
            {' · '}
            <span>Primary Suspect: <span style={{ color: '#00d7b2', fontWeight: 700 }}>
              {activeCandidate ? activeCandidate.name : 'NONE IDENTIFIED'}
            </span></span>
            {activeCandidate && (
              <>
                {' '}({activeCandidate.imo ? `IMO: ${activeCandidate.imo}` : 'IMO: N/A'}) · MMSI: {activeCandidate.mmsi || 'N/A'}
              </>
            )}
            {' · '}
            <span>Candidate Vessels: <span style={{ color: '#ffffff', fontWeight: 700 }}>{rankings.length}</span></span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="backtrack-warning-banner" style={{ height: '34px', boxSizing: 'border-box' }}>
            <AlertTriangle size={14} />
            <span>STATUS: {activeCandidate ? 'RECOMMENDED FOR FURTHER INVESTIGATION' : 'AWAITING SPILL CORRELATION'}</span>
          </div>

          <button
            className="btn-outline-cyan"
            onClick={() => setReconModalOpen(true)}
            disabled={!activeCandidate && !originPoint}
            style={{
              height: '34px',
              padding: '0 1rem',
              fontSize: '0.75rem',
              opacity: (!activeCandidate && !originPoint) ? 0.4 : 1,
              cursor: (!activeCandidate && !originPoint) ? 'not-allowed' : 'pointer',
            }}
          >
            <Radio size={14} />
            <span>Satellite Recon</span>
          </button>

          <button
            className="btn-primary-cyan"
            onClick={handleExportDossier}
            disabled={!activeCandidate}
            style={{
              height: '34px',
              padding: '0 1rem',
              fontSize: '0.75rem',
              opacity: !activeCandidate ? 0.4 : 1,
              cursor: !activeCandidate ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={14} />
            <span>Export Dossier</span>
          </button>
        </div>
      </div>

      {/* Main Backtracking View Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left / Side Context Panel — toggle between ranking list and forensic dossier */}
        {viewMode === 'dossier' ? (
          <ForensicDossierPanel
            evidence={evidence}
            spillCharacterization={spillCharacterization}
            onBackToRankings={() => setViewMode('ranking')}
          />
        ) : (
          <CandidateRankingPanel
            rankings={rankings}
            onSelectCandidate={(c) => setActiveCandidate(c)}
            onViewEvidenceDetails={(c) => {
              setActiveCandidate(c);
              setViewMode('dossier');
            }}
          />
        )}

        {/* Center Forensic Overlay Map */}
        <BacktrackMapCanvas
          onViewEvidenceDetails={() => setViewMode('dossier')}
          showFloatingCandidateCard={viewMode === 'ranking' && activeCandidate !== null}
          activeCandidate={activeCandidate}
          rankings={rankings}
          candidateTrack={candidateTrack}
          originPoint={originPoint}
          originPolygon={originPolygon}
          hoursWindow={hoursWindow}
          onHoursWindowChange={setHoursWindow}
          driftTrajectory={driftTrajectory}
          forecastTrajectory={forecastTrajectory}
          spillCharacterization={spillCharacterization}
          coastalImpact={coastalImpact}
          hydrodynamics={hydrodynamics}
        />
      </div>

      {/* Copernicus Satellite Reconnaissance Modal */}
      <CopernicusReconModal
        isOpen={reconModalOpen}
        onClose={() => setReconModalOpen(false)}
        vesselId={activeCandidate?.mmsi}
        vesselName={activeCandidate?.name}
        lat={originPoint ? originPoint[0] : activeCandidate?.lat}
        lng={originPoint ? originPoint[1] : activeCandidate?.lng}
        anomalyType={activeCandidate?.anomalyType}
        anomalyScore={activeCandidate?.associationScore ? activeCandidate.associationScore / 100 : undefined}
      />
    </div>
  );
}

// Suspense wrapper required because BacktrackingPageInner uses useSearchParams
export default function BacktrackingPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: 'var(--accent-cyan)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
          }}
        >
          ⟳ INITIALIZING BACKTRACKING MODULE...
        </div>
      }
    >
      <BacktrackingPageInner />
    </Suspense>
  );
}
