'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroCloner } from '@/components/HeroCloner';
import { HealthScorecard } from '@/components/HealthScorecard';
import { DriftList } from '@/components/DriftList';
import { RemediationModal } from '@/components/RemediationModal';
import { GemmaInspectorModal } from '@/components/GemmaInspectorModal';
import { LMStudioGuideModal } from '@/components/LMStudioGuideModal';
import { RepoAnalysisResult, LMStudioStatus, DriftItem } from '@/lib/types';
import { AlertCircle, GitBranch, Sparkles } from 'lucide-react';

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
  const [gitDiff, setGitDiff] = useState('');
  const [fixedReadme, setFixedReadme] = useState('');

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
  }, []);

  const handleScanUrl = async (url: string) => {
    setLoading(true);
    setError(null);
    setSelectedSampleId(null);
    setRemediated(false);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan repository');
      }

      setAnalysis(data);
      // Pre-fetch fix
      fetchFix(data);
    } catch (err: any) {
      setError(err.message || 'Scanning failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSample = async (sampleId: string) => {
    setLoading(true);
    setError(null);
    setSelectedSampleId(sampleId);
    setRemediated(false);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan sample repository');
      }

      setAnalysis(data);
      fetchFix(data, sampleId);
    } catch (err: any) {
      setError(err.message || 'Failed to load sample');
    } finally {
      setLoading(false);
    }
  };

  const fetchFix = async (currentAnalysis: RepoAnalysisResult, sampleId?: string) => {
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleId: sampleId || (currentAnalysis.isSample ? selectedSampleId : undefined),
        }),
      });

      if (res.ok) {
        const fixData = await res.json();
        setGitDiff(fixData.gitDiff);
        setFixedReadme(fixData.fixedReadme);
      }
    } catch (e) {
      console.warn('Failed to pre-fetch fix:', e);
    }
  };

  const handleResolveIndividual = (driftId: string) => {
    if (!analysis) return;
    const updated = {
      ...analysis,
      drifts: analysis.drifts.map((d) => (d.id === driftId ? { ...d, resolved: true } : d)),
    };
    setAnalysis(updated);

    // If all resolved, mark remediated
    const allDone = updated.drifts.every((d) => d.resolved);
    if (allDone) {
      setRemediated(true);
    }
  };

  const handleApplyMerge = () => {
    if (!analysis) return;
    setRemediated(true);
    const updated = {
      ...analysis,
      drifts: analysis.drifts.map((d) => ({ ...d, resolved: true })),
      metrics: {
        ...analysis.metrics,
        overallScore: 100,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalDrifts: 0,
        estimatedOnboardingFrictionMin: 0,
        readinessForContributors: 'READY' as const,
      },
    };
    setAnalysis(updated);
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
        {analysis && (
          <>
            <HealthScorecard
              analysis={analysis}
              onOpenRemediation={() => setShowRemediation(true)}
              remediated={remediated}
            />

            {/* List of Drift Items */}
            <DriftList
              drifts={analysis.drifts}
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
        gitDiff={gitDiff}
        fixedReadme={fixedReadme}
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
