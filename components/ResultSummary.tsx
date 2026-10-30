'use client';

import React from 'react';
import { RepoAnalysisResult } from '@/lib/types';

interface ResultSummaryProps {
  analysis: RepoAnalysisResult;
  onOpenPatch: () => void;
  patchLoading: boolean;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({ analysis, onOpenPatch, patchLoading }) => {
  const { metrics } = analysis;
  const allResolved = analysis.drifts.length > 0 && metrics.totalDrifts === 0;
  const scoreColor = metrics.overallScore >= 80 ? 'text-ok' : metrics.overallScore >= 50 ? 'text-warn' : 'text-danger';

  const counts = [
    { label: 'Critical', value: metrics.criticalCount },
    { label: 'High', value: metrics.highCount },
    { label: 'Medium', value: metrics.mediumCount },
    { label: 'Low', value: metrics.lowCount },
  ];

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {analysis.repoUrl ? (
            <a href={analysis.repoUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-muted hover:text-fg">
              {analysis.repoName}
            </a>
          ) : (
            <span className="font-mono text-sm text-muted">{analysis.repoName}</span>
          )}
          <p className="mt-1 text-sm">{allResolved ? 'All issues marked resolved.' : analysis.summary}</p>
          {analysis.notice && <p className="mt-2 text-xs text-warn">{analysis.notice}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-3xl font-semibold tabular-nums ${scoreColor}`}>{metrics.overallScore}</div>
          <div className="hint">health</div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-line pt-4">
        {counts.map((c) => (
          <div key={c.label}>
            <dt className="hint">{c.label}</dt>
            <dd className={`text-lg font-medium tabular-nums ${c.value === 0 ? 'text-muted' : ''}`}>{c.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="hint">
          {analysis.modelUsed} · {analysis.totalFilesScanned} files
          {metrics.estimatedOnboardingFrictionMin > 0 && ` · ~${metrics.estimatedOnboardingFrictionMin} min lost per new contributor`}
        </p>
        <button className="btn" onClick={onOpenPatch} disabled={analysis.drifts.length === 0}>
          {patchLoading ? 'Generating patch…' : 'View patch'}
        </button>
      </div>
    </section>
  );
};
