'use client';

import React from 'react';
import { BookOpen, Code2, Columns, GitPullRequest, Sparkles } from 'lucide-react';
import { DocTarget, RepoAnalysisResult } from '@/lib/types';
import { Tilt3DCard } from './Tilt3DCard';

interface ResultSummaryProps {
  analysis: RepoAnalysisResult;
  onOpenPatch: () => void;
  patchLoading: boolean;
  showInlineDiff?: boolean;
  onToggleInlineDiff?: () => void;
  enableDiffViewer?: boolean;
  enableGithubPr?: boolean;
  docTarget?: DocTarget;
  onSwitchDocTarget?: (target: DocTarget) => void;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({
  analysis,
  onOpenPatch,
  patchLoading,
  showInlineDiff,
  onToggleInlineDiff,
  enableDiffViewer = true,
  enableGithubPr = true,
  docTarget = 'readme',
  onSwitchDocTarget,
}) => {
  const { metrics } = analysis;
  const allResolved = analysis.drifts.length > 0 && metrics.totalDrifts === 0;
  const activeFile = analysis.readmeFile || (docTarget === 'api' ? 'docs/api.md' : 'README.md');
  const scoreColor =
    metrics.overallScore >= 80
      ? 'text-ok'
      : metrics.overallScore >= 50
      ? 'text-warn'
      : 'text-danger';

  const counts = [
    {
      label: 'Critical',
      value: metrics.criticalCount,
      tone: metrics.criticalCount > 0 ? 'text-danger' : 'text-muted',
    },
    {
      label: 'High',
      value: metrics.highCount,
      tone: metrics.highCount > 0 ? 'text-warn' : 'text-muted',
    },
    {
      label: 'Medium',
      value: metrics.mediumCount,
      tone: metrics.mediumCount > 0 ? 'text-accent' : 'text-muted',
    },
    {
      label: 'Low',
      value: metrics.lowCount,
      tone: metrics.lowCount > 0 ? 'text-fg' : 'text-muted',
    },
  ];

  return (
    <Tilt3DCard className="p-6 sm:p-8" intensity={2.5}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {analysis.repoUrl ? (
              <a
                href={analysis.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-bold text-fg hover:text-accent hover:underline"
              >
                {analysis.repoName}
              </a>
            ) : (
              <span className="font-mono font-bold text-fg">{analysis.repoName}</span>
            )}
            <span aria-hidden="true">·</span>
            <span className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
              Target: {activeFile}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Readiness: {metrics.readinessForContributors}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Scanned at {analysis.analyzedAt}</span>
          </div>
          <p className="mt-1.5 text-base font-bold text-fg">
            {allResolved ? 'All issues marked resolved.' : analysis.summary}
          </p>
          {analysis.notice && <p className="mt-2 text-xs text-warn">{analysis.notice}</p>}

          {onSwitchDocTarget && (
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-bg p-1 text-xs">
              <button
                type="button"
                onClick={() => onSwitchDocTarget('readme')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 transition-all ${
                  docTarget === 'readme'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>Audit README.md</span>
              </button>
              <button
                type="button"
                onClick={() => onSwitchDocTarget('api')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 transition-all ${
                  docTarget === 'api'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-fg'
                }`}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0" />
                <span>Audit API Docs (docs/api.md)</span>
              </button>
            </div>
          )}
        </div>

        {/* Recessed Health Score Well */}
        <div className="depth-well flex flex-col items-end rounded-xl border border-line bg-bg px-5 py-3 text-right shrink-0">
          <div className={`text-3xl font-extrabold tabular-nums leading-none ${scoreColor}`}>
            {metrics.overallScore}
          </div>
          <div className="mt-1 text-xs font-semibold text-muted">health score</div>
        </div>
      </div>

      {/* Severity Metric Grid */}
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
        {counts.map((c) => (
          <div
            key={c.label}
            className="depth-well rounded-xl border border-line bg-bg px-4 py-3"
          >
            <dt className="hint">{c.label} severity</dt>
            <dd className={`mt-0.5 text-xl font-extrabold tabular-nums ${c.tone}`}>{c.value}</dd>
          </div>
        ))}
      </dl>

      {/* Action Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="hint font-mono tabular-nums">
          {analysis.modelUsed} · {analysis.totalFilesScanned} files
          {metrics.estimatedOnboardingFrictionMin > 0 &&
            ` · ~${metrics.estimatedOnboardingFrictionMin} min lost per new contributor`}
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          {enableDiffViewer && onToggleInlineDiff && analysis.drifts.length > 0 && (
            <button type="button" className="btn-keycap px-3.5 py-2 text-xs" onClick={onToggleInlineDiff}>
              <Columns className="h-3.5 w-3.5 shrink-0" />
              <span>{showInlineDiff ? 'Hide inline diff' : 'Inline side-by-side diff'}</span>
            </button>
          )}
          <button
            type="button"
            className="btn-keycap btn-keycap-primary px-4 py-2 text-xs font-semibold"
            onClick={onOpenPatch}
            disabled={analysis.drifts.length === 0}
          >
            {patchLoading ? (
              <>
                <Sparkles className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>Generating patch…</span>
              </>
            ) : (
              <>
                <GitPullRequest className="h-3.5 w-3.5 shrink-0" />
                <span>{enableGithubPr ? 'View patch & Open PR' : `View ${activeFile} patch`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Tilt3DCard>
  );
};
