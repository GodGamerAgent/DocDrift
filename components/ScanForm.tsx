'use client';

import React, { useState } from 'react';
import { BookOpen, Code2, Cpu, Globe, Play, Sparkles } from 'lucide-react';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';
import { DocTarget } from '@/lib/types';
import { Tilt3DCard } from './Tilt3DCard';

const ONLINE_REPOS = [
  { label: 'sindresorhus/ora', url: 'https://github.com/sindresorhus/ora', desc: 'Terminal spinner CLI & Node API' },
  { label: 'tj/commander.js', url: 'https://github.com/tj/commander.js', desc: 'Node.js CLI option parser' },
  { label: 'kelseyhightower/nocode', url: 'https://github.com/kelseyhightower/nocode', desc: 'Lightweight README & LICENSE repo' },
];

interface ScanFormProps {
  onScanUrl: (url: string) => void;
  onSelectSample: (sampleId: string, useLiveModel?: boolean) => void;
  activeSampleId: string | null;
  loading: boolean;
  useLiveModel: boolean;
  onToggleLiveModel: (value: boolean) => void;
  docTarget: DocTarget;
  onChangeDocTarget: (target: DocTarget) => void;
}

export const ScanForm: React.FC<ScanFormProps> = ({
  onScanUrl,
  onSelectSample,
  activeSampleId,
  loading,
  useLiveModel,
  onToggleLiveModel,
  docTarget,
  onChangeDocTarget,
}) => {
  const [repoInput, setRepoInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput.trim()) onScanUrl(repoInput.trim());
  };

  const handleQuickOnlineScan = (url: string) => {
    setRepoInput(url);
    onScanUrl(url);
  };

  return (
    <section id="scanner-top">
      <Tilt3DCard className="p-6 sm:p-8" intensity={3}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="font-mono uppercase tracking-wider">Autonomous Documentation Drift &amp; Remediation Suite</span>
            <span className="badge--positive font-mono tabular-nums">Gemma 4 · README &amp; API Docs Auditors Ready</span>
          </div>

          <div>
            <h1
              className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl"
              style={{ textWrap: 'balance' }}
            >
              Keep your repository README and API Docs synchronized with your source code
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Cross-examine CLI flags, REST API endpoints, SDK signatures, source file line references,
              links, badges, secrets, and licenses against real code—then review line-by-line patches in a
              split diff viewer and open a GitHub pull request.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="https://github.com/owner/repo"
              aria-label="GitHub repository URL"
              className="input font-mono flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !repoInput.trim()}
              className="btn-keycap btn-keycap-primary px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              <Play className="h-4 w-4 shrink-0 fill-current" />
              <span>Scan Repository</span>
            </button>
          </form>

          {/* 1-Click Live Online GitHub Repositories */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
            <span className="inline-flex items-center gap-1 font-mono text-muted">
              <Globe className="h-3.5 w-3.5 text-accent" />
              <span>Test Online GitHub Repos:</span>
            </span>
            {ONLINE_REPOS.map((repo) => (
              <button
                key={repo.url}
                type="button"
                disabled={loading}
                onClick={() => handleQuickOnlineScan(repo.url)}
                title={repo.desc}
                className="btn-keycap px-2.5 py-1 font-mono text-xs"
              >
                {repo.label}
              </button>
            ))}
          </div>

          {/* Target Document Toggle (README.md vs API Docs) & Scan Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">Audit Target:</span>
              <div
                role="group"
                aria-label="Documentation Target"
                className="inline-flex items-center rounded-xl border border-line bg-bg p-1"
              >
                <button
                  type="button"
                  onClick={() => onChangeDocTarget('readme')}
                  disabled={loading}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                    docTarget === 'readme'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>README.md</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDocTarget('api')}
                  disabled={loading}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                    docTarget === 'api'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5 shrink-0" />
                  <span>API Docs (docs/api.md)</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">
                Engine:{' '}
                <strong className="font-semibold text-fg">
                  {useLiveModel ? 'Live Gemma 4 Audit' : 'Instant Snapshot'}
                </strong>
              </span>
              <div className="inline-flex items-center rounded-xl border border-line bg-bg p-1">
                <button
                  type="button"
                  onClick={() => onToggleLiveModel(false)}
                  disabled={loading}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                    !useLiveModel
                      ? 'bg-surface text-fg shadow-sm border border-line'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  Instant Snapshot
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLiveModel(true)}
                  disabled={loading}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                    useLiveModel
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  <Cpu className="h-3 w-3 shrink-0" />
                  Live Gemma 4 Audit
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Example Repository Cards */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              Built-in Benchmark Repositories ({docTarget === 'api' ? 'Auditing API Docs · docs/api.md' : 'Auditing README.md'}):
            </span>
            {activeSampleId && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onSelectSample(activeSampleId, true)}
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3 w-3" />
                Re-scan {activeSampleId} with Live Gemma 4
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {Object.values(SAMPLE_REPOS).map((sample) => {
              const count =
                docTarget === 'api' ? sample.expectedApiDrifts.length : sample.expectedDrifts.length;
              const isActive = activeSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectSample(sample.id, useLiveModel)}
                  disabled={loading}
                  className={`btn-keycap flex-col items-start justify-between p-3.5 text-left h-auto ${
                    isActive
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/25'
                      : ''
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-fg truncate">
                      {sample.id}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                        count > 0 ? 'text-danger' : 'text-ok'
                      }`}
                    >
                      {count > 0 ? `${count} ${docTarget === 'api' ? 'API ' : ''}issues` : 'in sync'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted truncate w-full">
                    {sample.techStack}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Tilt3DCard>
    </section>
  );
};
