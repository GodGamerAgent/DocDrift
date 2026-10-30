'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScanForm } from '@/components/ScanForm';
import { ScanProgress } from '@/components/ScanProgress';
import { ResultSummary } from '@/components/ResultSummary';
import { DriftList } from '@/components/DriftList';
import { PatchModal } from '@/components/PatchModal';
import { RepoAnalysisResult, RemediationResult } from '@/lib/types';
import { calculateMetrics } from '@/lib/metrics';

export default function ScanPage() {
  const [analysis, setAnalysis] = useState<RepoAnalysisResult | null>(null);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

  const [fix, setFix] = useState<RemediationResult | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const closePatch = useCallback(() => setShowPatch(false), []);

  // Each scan bumps this so responses from a superseded scan are ignored
  const scanSeq = useRef(0);
  const loading = scanStartedAt !== null;

  const fetchFix = async (current: RepoAnalysisResult, seq: number) => {
    if (current.drifts.length === 0) return;
    if (!current.isSample && !current.readmeContent) return;
    const payload = current.isSample
      ? { sampleId: current.sampleId }
      : { readme: current.readmeContent, readmeFile: current.readmeFile, drifts: current.drifts };

    setFixLoading(true);
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && seq === scanSeq.current) setFix(await res.json());
    } catch (e) {
      console.warn('Failed to generate patch:', e);
    } finally {
      if (seq === scanSeq.current) setFixLoading(false);
    }
  };

  const runScan = async (payload: { repoUrl: string } | { sampleId: string }) => {
    const seq = ++scanSeq.current;
    setScanStartedAt(Date.now());
    setError(null);
    setAnalysis(null);
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
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      setAnalysis(data);
      fetchFix(data, seq);
    } catch (err: any) {
      if (seq === scanSeq.current) setError(err.message || 'Scan failed');
    } finally {
      if (seq === scanSeq.current) setScanStartedAt(null);
    }
  };

  const handleScanUrl = (url: string) => {
    setActiveSampleId(null);
    runScan({ repoUrl: url });
  };

  const handleSelectSample = (sampleId: string) => {
    setActiveSampleId(sampleId);
    runScan({ sampleId });
  };

  const handleResolve = (driftId: string) => {
    setAnalysis((prev) =>
      prev && { ...prev, drifts: prev.drifts.map((d) => (d.id === driftId ? { ...d, resolved: true } : d)) }
    );
  };

  // Metrics reflect only the drifts that are still unresolved
  const displayed = useMemo(
    () => analysis && { ...analysis, metrics: calculateMetrics(analysis.drifts.filter((d) => !d.resolved)) },
    [analysis]
  );

  return (
    <div className="space-y-8">
      <ScanForm
        onScanUrl={handleScanUrl}
        onSelectSample={handleSelectSample}
        activeSampleId={activeSampleId}
        loading={loading}
      />

      {scanStartedAt !== null && <ScanProgress startedAt={scanStartedAt} />}

      {error && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
          <span className="text-danger">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-xs text-muted hover:text-fg">
            Dismiss
          </button>
        </div>
      )}

      {displayed && (
        <div className="space-y-6">
          <ResultSummary analysis={displayed} onOpenPatch={() => setShowPatch(true)} patchLoading={fixLoading} />
          <DriftList drifts={displayed.drifts} onResolve={handleResolve} />
        </div>
      )}

      <PatchModal
        isOpen={showPatch}
        onClose={closePatch}
        gitDiff={fix?.gitDiff || ''}
        fixedReadme={fix?.fixedReadme || ''}
        summary={fix?.remediationSummary}
        loading={fixLoading}
      />
    </div>
  );
}
