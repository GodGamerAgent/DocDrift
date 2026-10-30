'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroCloner } from '@/components/HeroCloner';
import { HealthScorecard } from '@/components/HealthScorecard';
import { DriftList } from '@/components/DriftList';
import { RemediationModal } from '@/components/RemediationModal';
import { GemmaInspectorModal } from '@/components/GemmaInspectorModal';
import { LMStudioGuideModal } from '@/components/LMStudioGuideModal';
import { RepoAnalysisResult, LMStudioStatus, RemediationResult } from '@/lib/types';
import { calculateMetrics } from '@/lib/metrics';
import { AlertCircle } from 'lucide-react';

export default function HomePage() {
  const [analysis, setAnalysis] = useState<RepoAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>('deployx-cli');

  // LM Studio status
  const [lmStatus, setLmStatus] = useState<LMStudioStatus | null>(null);
  const [checkingLm, setCheckingLm] = useState(false);

  // Modals
  const [showRemediation, setShowRemediation] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showLmGuide, setShowLmGuide] = useState(false);

  // Remediation states
  const [remediated, setRemediated] = useState(false);
  const [fix, setFix] = useState<RemediationResult | null>(null);
  const [fixLoading, setFixLoading] = useState(false);

  // Each scan bumps this so responses from a superseded scan are ignored
  const scanSeq = useRef(0);

  // Check LM Studio on mount
  const checkLM = async () => {
    setCheckingLm(true);
    try {
      const res = await fetch('/api/lmstudio/status');
      const data = await res.json();
      setLmStatus(data);
    } catch (e) {
      setLmStatus({
        connected: false,
        endpoint: 'http://localhost:1234/v1',
        model: 'gemma-4-12b',
        availableModels: [],
      });
    } finally {
      setCheckingLm(false);
    }
  };

  useEffect(() => {
    checkLM();
    // Load initial sample
    handleScanSample('deployx-cli');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const runScan = async (payload: { repoUrl: string } | { sampleId: string }, fallbackError: string) => {
    const seq = ++scanSeq.current;
    setLoading(true);
    setError(null);
    setRemediated(false);
    setFix(null);
    setFixLoading(false);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (seq !== scanSeq.current) return;
      if (!res.ok) {
        throw new Error(data.error || fallbackError);
      }

      setAnalysis(data);
      // Pre-fetch fix
      fetchFix(data, seq);
    } catch (err: any) {
      if (seq === scanSeq.current) setError(err.message || fallbackError);
    } finally {
      if (seq === scanSeq.current) setLoading(false);
    }
  };

  const handleScanUrl = (url: string) => {
    setSelectedSampleId(null);
    runScan({ repoUrl: url }, 'Failed to scan repository');
  };

  const handleScanSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    runScan({ sampleId }, 'Failed to load sample');
  };

  const fetchFix = async (currentAnalysis: RepoAnalysisResult, seq: number) => {
    const payload = currentAnalysis.isSample
      ? { sampleId: currentAnalysis.sampleId }
      : { readme: currentAnalysis.readmeContent, readmeFile: currentAnalysis.readmeFile, drifts: currentAnalysis.drifts };
    if (!currentAnalysis.isSample && !currentAnalysis.readmeContent) return;

    setFixLoading(true);
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && seq === scanSeq.current) {
        setFix(await res.json());
      }
    } catch (e) {
      console.warn('Failed to pre-fetch fix:', e);
    } finally {
      if (seq === scanSeq.current) setFixLoading(false);
    }
  };

  // Metrics reflect only the drifts that are still unresolved
  const displayedAnalysis = useMemo(
    () =>
      analysis && {
        ...analysis,
        metrics: calculateMetrics(analysis.drifts.filter((d) => !d.resolved)),
      },
    [analysis]
  );

  const handleResolveIndividual = (driftId: string) => {
    if (!analysis) return;
    const updated = {
      ...analysis,
      drifts: analysis.drifts.map((d) => (d.id === driftId ? { ...d, resolved: true } : d)),
    };
    setAnalysis(updated);

    // If all resolved, mark remediated
    if (updated.drifts.every((d) => d.resolved)) {
      setRemediated(true);
    }
  };

  const handleApplyMerge = () => {
    if (!analysis) return;
    setRemediated(true);
    setAnalysis({
      ...analysis,
      drifts: analysis.drifts.map((d) => ({ ...d, resolved: true })),
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-white">
      {/* Navigation */}
      <Navbar
        lmStatus={lmStatus}
        checkingLm={checkingLm}
        onRefreshLm={checkLM}
        onOpenLmGuide={() => setShowLmGuide(true)}
        onOpenGemmaInspector={() => setShowInspector(true)}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero & Cloner Input */}
        <HeroCloner
          onScanUrl={handleScanUrl}
          onSelectSample={handleScanSample}
          selectedSampleId={selectedSampleId}
          loading={loading}
        />

        {/* Error Notification */}
        {error && (
          <div className="max-w-4xl mx-auto px-4 mb-6">
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-white px-2 py-1 rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Health Scorecard & Metrics */}
        {displayedAnalysis && (
          <>
            <HealthScorecard
              analysis={displayedAnalysis}
              onOpenRemediation={() => setShowRemediation(true)}
              remediated={remediated}
            />

            {/* List of Drift Items */}
            <DriftList
              drifts={displayedAnalysis.drifts}
              onResolveIndividual={handleResolveIndividual}
              onOpenDiffForDrift={() => setShowRemediation(true)}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070a12] py-8 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">DocDrift AI</span>
            <span>·</span>
            <span>Hacktoberfest Hack Day &apos;26 (Newton School of Technology × SMRU)</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-blue-400">Track 2: Google Gemma 4 (12B)</span>
            <span>·</span>
            <span className="text-slate-400">Problem Statement #18</span>
            <span>·</span>
            <span className="text-slate-400">Apache 2.0 Open Source</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <RemediationModal
        isOpen={showRemediation}
        onClose={() => setShowRemediation(false)}
        gitDiff={fix?.gitDiff || ''}
        fixedReadme={fix?.fixedReadme || ''}
        summary={fix?.remediationSummary}
        loading={fixLoading}
        onApplyMerge={handleApplyMerge}
      />

      <GemmaInspectorModal
        isOpen={showInspector}
        onClose={() => setShowInspector(false)}
        modelName={lmStatus?.model || 'gemma-4-12b'}
      />

      <LMStudioGuideModal
        isOpen={showLmGuide}
        onClose={() => setShowLmGuide(false)}
        status={lmStatus}
        onRefresh={checkLM}
      />
    </div>
  );
}
