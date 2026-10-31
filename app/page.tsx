'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, GitPullRequest } from 'lucide-react';
import { DocTarget, RemediationResult, RepoAnalysisResult } from '@/lib/types';
import { SETTINGS_SAVED_EVENT, Settings } from '@/lib/settingsSchema';
import { calculateMetrics } from '@/lib/metrics';
import { buildDiffBlocks, changedLineIds, composeReadme } from '@/lib/diffModel';
import { ScanForm } from '@/components/ScanForm';
import { ScanProgress } from '@/components/ScanProgress';
import { ResultSummary } from '@/components/ResultSummary';
import { DiffViewer } from '@/components/DiffViewer';
import { DriftList } from '@/components/DriftList';
import { PatchModal } from '@/components/PatchModal';
import { WaterScrollReveal } from '@/components/WaterScrollReveal';

export default function HomePage() {
  const [analysis, setAnalysis] = useState<RepoAnalysisResult | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>('cloud-auth-py');
  const [lastRepoUrl, setLastRepoUrl] = useState<string | null>(null);
  const [docTarget, setDocTarget] = useState<DocTarget>('readme');
  const [useLiveModel, setUseLiveModel] = useState(false);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<RemediationResult | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [showPatch, setShowPatch] = useState(false);
  const [openPrOnModal, setOpenPrOnModal] = useState(false);
  const [showInlineDiff, setShowInlineDiff] = useState(true);
  const [inlineAccepted, setInlineAccepted] = useState<Set<number>>(() => new Set());
  const [settings, setSettings] = useState<Partial<Settings>>({
    enableDiffViewer: true,
    enableContextTooltips: true,
    enableGithubPr: true,
  });
  const scanSeq = useRef(0);

  const loading = scanStartedAt !== null;

  useEffect(() => {
    const load = () =>
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          if (data?.settings) {
            setSettings(data.settings);
            setShowInlineDiff(data.settings.enableDiffViewer !== false);
          }
        })
        .catch(() => {});

    load();
    window.addEventListener(SETTINGS_SAVED_EVENT, load);
    return () => window.removeEventListener(SETTINGS_SAVED_EVENT, load);
  }, []);

  const closePatch = useCallback(() => {
    setShowPatch(false);
    setOpenPrOnModal(false);
  }, []);

  const fetchFix = useCallback(async (current: RepoAnalysisResult, seq: number) => {
    if (current.drifts.length === 0) return;
    if (!current.isSample && !current.readmeContent) return;

    const target = current.docTarget || 'readme';
    const payload = current.isSample
      ? { sampleId: current.sampleId, docTarget: target }
      : {
          readme: current.readmeContent,
          readmeFile: current.readmeFile,
          drifts: current.drifts,
          docTarget: target,
        };

    setFixLoading(true);
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (seq === scanSeq.current && res.ok) {
        setFix(data);
        const blocks = buildDiffBlocks(data.originalReadme, data.fixedReadme);
        setInlineAccepted(new Set(changedLineIds(blocks)));
      }
    } catch {
      // Inline diff falls back gracefully
    } finally {
      if (seq === scanSeq.current) setFixLoading(false);
    }
  }, []);

  const runScan = useCallback(
    async (payload: { repoUrl?: string; sampleId?: string; useLiveModel?: boolean; docTarget?: DocTarget }) => {
      const seq = ++scanSeq.current;
      setScanStartedAt(Date.now());
      setError(null);
      setFix(null);
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
    },
    [fetchFix]
  );

  useEffect(() => {
    runScan({ sampleId: 'cloud-auth-py', useLiveModel: false, docTarget: 'readme' });
  }, [runScan]);

  const handleScanUrl = (url: string) => {
    setActiveSampleId(null);
    setLastRepoUrl(url);
    runScan({ repoUrl: url, docTarget });
  };

  const handleSelectSample = (sampleId: string, liveOverride?: boolean) => {
    setActiveSampleId(sampleId);
    setLastRepoUrl(null);
    runScan({ sampleId, useLiveModel: liveOverride ?? useLiveModel, docTarget });
  };

  const handleChangeDocTarget = (nextTarget: DocTarget) => {
    if (nextTarget === docTarget) return;
    setDocTarget(nextTarget);
    if (activeSampleId) {
      runScan({ sampleId: activeSampleId, useLiveModel, docTarget: nextTarget });
    } else if (lastRepoUrl) {
      runScan({ repoUrl: lastRepoUrl, docTarget: nextTarget });
    } else if (analysis?.repoUrl) {
      runScan({ repoUrl: analysis.repoUrl, docTarget: nextTarget });
    }
  };

  const handleResolve = (driftId: string) => {
    setAnalysis((prev) =>
      prev && {
        ...prev,
        drifts: prev.drifts.map((d) =>
          d.id === driftId ? { ...d, resolved: !d.resolved } : d
        ),
      }
    );
  };

  const displayed = useMemo(
    () =>
      analysis && {
        ...analysis,
        metrics: calculateMetrics(analysis.drifts.filter((d) => !d.resolved)),
      },
    [analysis]
  );

  const inlineBlocks = useMemo(
    () => (fix ? buildDiffBlocks(fix.originalReadme, fix.fixedReadme) : []),
    [fix]
  );
  const inlineAllIds = useMemo(() => changedLineIds(inlineBlocks), [inlineBlocks]);
  const inlineAcceptedCount = useMemo(
    () => inlineAllIds.filter((id) => inlineAccepted.has(id)).length,
    [inlineAllIds, inlineAccepted]
  );
  const inlineComposedReadme = useMemo(
    () =>
      fix
        ? composeReadme(inlineBlocks, inlineAccepted, fix.fixedReadme.endsWith('\n'))
        : '',
    [fix, inlineBlocks, inlineAccepted]
  );

  const setInlineLines = (ids: number[], value: boolean) =>
    setInlineAccepted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });

  const enableDiffViewer = settings.enableDiffViewer !== false;
  const enableContextTooltips = settings.enableContextTooltips !== false;
  const enableGithubPr = settings.enableGithubPr !== false;
  const activeDocFile = displayed?.readmeFile || (docTarget === 'api' ? 'docs/api.md' : 'README.md');

  return (
    <div className="space-y-8 pb-16" style={{ perspective: '1300px' }}>
      <WaterScrollReveal>
        <ScanForm
          onScanUrl={handleScanUrl}
          onSelectSample={handleSelectSample}
          activeSampleId={activeSampleId}
          loading={loading}
          useLiveModel={useLiveModel}
          onToggleLiveModel={setUseLiveModel}
          docTarget={docTarget}
          onChangeDocTarget={handleChangeDocTarget}
        />
      </WaterScrollReveal>

      {scanStartedAt !== null && <ScanProgress startedAt={scanStartedAt} />}

      {error && (
        <div className="card-3d flex items-start justify-between gap-4 border-danger/40 bg-danger/10 p-4 text-sm">
          <span className="font-medium text-danger">{error}</span>
          <button onClick={() => setError(null)} className="btn-keycap px-2.5 py-1 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {displayed && (
        <div className="space-y-8">
          <WaterScrollReveal>
            <ResultSummary
              analysis={displayed}
              onOpenPatch={() => setShowPatch(true)}
              patchLoading={fixLoading}
              showInlineDiff={showInlineDiff}
              onToggleInlineDiff={() => setShowInlineDiff((p) => !p)}
              enableDiffViewer={enableDiffViewer}
              enableGithubPr={enableGithubPr}
              docTarget={docTarget}
              onSwitchDocTarget={handleChangeDocTarget}
            />
          </WaterScrollReveal>

          {/* Interactive Side-by-Side Diff Viewer Workspace directly on page */}
          <WaterScrollReveal id="diff-workspace" className="scroll-mt-20 space-y-3">
            {enableDiffViewer && showInlineDiff && fix && inlineAllIds.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight text-fg">
                      Interactive Side-by-Side Diff Viewer &amp; Source Citations ({activeDocFile})
                    </h2>
                    <p className="hint">
                      Toggle individual lines on or off
                      {enableContextTooltips
                        ? ', hover “Why it changed” for exact file:line references'
                        : ''}
                      {enableGithubPr ? ', or open a GitHub PR.' : '.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-muted tabular-nums">
                      {inlineAcceptedCount} of {inlineAllIds.length} lines accepted
                    </span>
                    <button
                      type="button"
                      className="btn-keycap px-3 py-1.5 text-xs"
                      onClick={() => setInlineLines(inlineAllIds, true)}
                    >
                      Accept all
                    </button>
                    <button
                      type="button"
                      className="btn-keycap px-3 py-1.5 text-xs"
                      onClick={() => setInlineLines(inlineAllIds, false)}
                    >
                      Reject all
                    </button>
                    {enableGithubPr && (
                      <button
                        type="button"
                        className="btn-keycap btn-keycap-primary px-3.5 py-1.5 text-xs font-semibold"
                        onClick={() => {
                          setOpenPrOnModal(true);
                          setShowPatch(true);
                        }}
                      >
                        <GitPullRequest className="h-3.5 w-3.5 shrink-0" />
                        <span>Prepare GitHub PR ({inlineAcceptedCount} lines)</span>
                      </button>
                    )}
                  </div>
                </div>

                <DiffViewer
                  blocks={inlineBlocks}
                  accepted={inlineAccepted}
                  onSetAccepted={setInlineLines}
                  drifts={displayed.drifts}
                  showContextTooltips={enableContextTooltips}
                  docFile={activeDocFile}
                />
              </>
            ) : (
              <div className="card-3d flex flex-wrap items-center justify-between gap-4 p-5 text-sm">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-ok shrink-0" />
                  <div>
                    <div className="font-bold text-fg">Side-by-Side Diff Viewer ({activeDocFile})</div>
                    <div className="hint">
                      {!enableDiffViewer
                        ? 'Interactive Side-by-Side Diff Viewer is currently toggled off in Settings.'
                        : fixLoading
                        ? `Computing line-by-line ${activeDocFile} remediation patch…`
                        : displayed.drifts.length === 0
                        ? `${activeDocFile} is 100% synchronized with ${displayed.repoName}—no diff hunks required.`
                        : showInlineDiff
                        ? `Reviewing detected drift findings below. Click "View patch" to inspect the full ${activeDocFile}.`
                        : 'Split Diff Viewer is hidden. Click "Show Split Diff" to expand.'}
                    </div>
                  </div>
                </div>
                {enableDiffViewer && !showInlineDiff && (
                  <button
                    type="button"
                    className="btn-keycap text-xs"
                    onClick={() => setShowInlineDiff(true)}
                  >
                    Show Split Diff
                  </button>
                )}
              </div>
            )}
          </WaterScrollReveal>

          <DriftList
            drifts={displayed.drifts}
            onResolve={handleResolve}
            showContextTooltips={enableContextTooltips}
            docFile={activeDocFile}
          />
        </div>
      )}

      <PatchModal
        isOpen={showPatch}
        onClose={closePatch}
        originalReadme={fix?.originalReadme || analysis?.readmeContent || ''}
        fixedReadme={
          inlineComposedReadme ||
          fix?.fixedReadme ||
          fix?.originalReadme ||
          analysis?.readmeContent ||
          ''
        }
        readmeFile={activeDocFile}
        summary={fix?.remediationSummary}
        loading={fixLoading}
        drifts={analysis?.drifts ?? []}
        repo={analysis?.repoName}
        initialOpenPr={openPrOnModal}
        showContextTooltips={enableContextTooltips}
        enableGithubPr={enableGithubPr}
      />
    </div>
  );
}
