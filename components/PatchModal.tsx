'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPatch } from 'diff';
import { Check, Copy, Download, ExternalLink, GitBranch, GitPullRequest, Loader2, Play, X } from 'lucide-react';
import { DriftItem } from '@/lib/types';
import { buildDiffBlocks, changedLineIds, composeReadme, driftsForBlock, sourceRef } from '@/lib/diffModel';
import { DiffViewer } from './DiffViewer';
import { completeQuestStep } from './Header';

interface PatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalReadme: string;
  fixedReadme: string;
  readmeFile: string;
  summary?: string;
  loading: boolean;
  drifts: DriftItem[];
  repo?: string;
  initialOpenPr?: boolean;
  showContextTooltips?: boolean;
  enableGithubPr?: boolean;
}

interface GitHubStatus {
  connected: boolean;
  login?: string;
  source?: string;
  error?: string;
}

type PrState =
  | { step: 'closed' }
  | { step: 'form'; github?: GitHubStatus }
  | { step: 'creating' }
  | { step: 'done'; url: string; number: number; viaFork: boolean; branch?: string; dryRun?: boolean; bodyPreview?: string }
  | { step: 'error'; message: string };

export const PatchModal: React.FC<PatchModalProps> = ({
  isOpen,
  onClose,
  originalReadme,
  fixedReadme,
  readmeFile,
  summary,
  loading,
  drifts,
  repo,
  initialOpenPr = false,
  showContextTooltips = true,
  enableGithubPr = true,
}) => {
  const [tab, setTab] = useState<'REVIEW' | 'README'>('REVIEW');
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [pr, setPr] = useState<PrState>({ step: 'closed' });
  const [prTitle, setPrTitle] = useState(`docs: fix ${readmeFile} drift`);
  const [targetRepo, setTargetRepo] = useState(repo || 'acme-security/cloud-auth-py');

  useEffect(() => {
    if (repo) setTargetRepo(repo);
  }, [repo]);

  useEffect(() => {
    setPrTitle(`docs: fix ${readmeFile} drift`);
  }, [readmeFile]);

  const blocks = useMemo(() => buildDiffBlocks(originalReadme, fixedReadme), [originalReadme, fixedReadme]);
  const allIds = useMemo(() => changedLineIds(blocks), [blocks]);

  useEffect(() => {
    setAccepted(new Set(allIds));
    setPr({ step: 'closed' });
  }, [allIds]);

  useEffect(() => {
    if (isOpen && initialOpenPr && enableGithubPr) {
      setPr({ step: 'form' });
      fetch('/api/github/status')
        .then((r) => r.json())
        .then((github) => setPr((prev) => (prev.step === 'form' ? { step: 'form', github } : prev)))
        .catch(() =>
          setPr((prev) =>
            prev.step === 'form'
              ? { step: 'form', github: { connected: false, error: 'Could not check GitHub login.' } }
              : prev
          )
        );
    }
  }, [isOpen, initialOpenPr, enableGithubPr]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const finalReadme = useMemo(
    () => composeReadme(blocks, accepted, fixedReadme.endsWith('\n')),
    [blocks, accepted, fixedReadme]
  );
  const hasPatch = allIds.length > 0;
  const hasChanges = finalReadme !== originalReadme;

  if (!isOpen) return null;

  const setLines = (ids: number[], value: boolean) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });

  const patch = () => createPatch(readmeFile, originalReadme, finalReadme, 'original', 'fixed');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(patch());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([finalReadme], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = readmeFile.split('/').pop() || 'README.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openPrForm = async () => {
    completeQuestStep(4);
    setPr({ step: 'form' });
    try {
      const github = await fetch('/api/github/status').then((r) => r.json());
      setPr((prev) => (prev.step === 'form' ? { step: 'form', github } : prev));
    } catch {
      setPr((prev) =>
        prev.step === 'form'
          ? { step: 'form', github: { connected: false, error: 'Could not check GitHub login.' } }
          : prev
      );
    }
  };

  const buildPrDescription = () => {
    const addressed = drifts.filter((d) =>
      blocks.some(
        (b) =>
          b.kind === 'change' &&
          [...b.removed, ...b.added].some((l) => accepted.has(l.id)) &&
          driftsForBlock(b, [d]).length > 0
      )
    );
    return [
      'This PR updates the README so it matches the current code.',
      '',
      ...(addressed.length
        ? ['Issues addressed:', ...addressed.map((d) => `- ${d.title} (\`${sourceRef(d)}\`)`), '']
        : []),
      '_Generated with DocDrift Studio and reviewed before submitting._',
    ].join('\n');
  };

  const createPr = async () => {
    const description = buildPrDescription();
    setPr({ step: 'creating' });
    try {
      const res = await fetch('/api/github/pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: targetRepo.trim(),
          filePath: readmeFile,
          content: finalReadme,
          title: prTitle,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the pull request');
      setPr({
        step: 'done',
        url: data.url,
        number: data.number,
        viaFork: data.viaFork,
        branch: data.branch,
      });
    } catch (err: any) {
      setPr({ step: 'error', message: err.message });
    }
  };

  const simulatePrDryRun = () => {
    completeQuestStep(4);
    const branch = `docdrift/readme-${Date.now().toString(36)}`;
    const bodyPreview = buildPrDescription();
    setPr({
      step: 'done',
      url: `https://github.com/${targetRepo.trim()}/compare/main...${branch}`,
      number: 142,
      viaFork: false,
      branch,
      dryRun: true,
      bodyPreview,
    });
  };

  const acceptedCount = allIds.filter((id) => accepted.has(id)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-title"
        className="card-3d flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden bg-bg p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0">
            <h2 id="patch-title" className="text-base font-bold text-fg">
              Review {readmeFile} Patch {enableGithubPr ? '& Open Pull Request' : ''}
            </h2>
            <p className="hint mt-0.5">{loading ? 'Generating…' : summary || 'No patch available.'}</p>
          </div>
          <button onClick={onClose} className="btn-keycap px-2.5 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasPatch && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/80 px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex gap-1 rounded-lg border border-line bg-bg p-0.5">
                {(['REVIEW', 'README'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                      tab === t ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
                    }`}
                  >
                    {t === 'REVIEW' ? 'Side-by-Side Diff' : `Composed ${readmeFile}`}
                  </button>
                ))}
              </div>
              <span className="font-mono text-muted tabular-nums">
                {acceptedCount} of {allIds.length} lines accepted
              </span>
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => setLines(allIds, true)}
              >
                Accept all
              </button>
              <button
                type="button"
                className="font-semibold text-danger hover:underline"
                onClick={() => setLines(allIds, false)}
              >
                Reject all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleCopy} className="btn-keycap text-xs" disabled={!hasChanges}>
                {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy patch'}
              </button>
              <button type="button" onClick={handleDownload} className="btn-keycap text-xs" disabled={!hasChanges}>
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              {enableGithubPr && (
                <button
                  type="button"
                  onClick={openPrForm}
                  className="btn-keycap btn-keycap-primary text-xs"
                  disabled={!hasChanges || pr.step === 'creating'}
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  Open pull request
                </button>
              )}
            </div>
          </div>
        )}

        {enableGithubPr && pr.step !== 'closed' && (
          <div className="space-y-3 border-b border-line bg-surface px-5 py-4 text-sm">
            {pr.step === 'form' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm text-fg">
                    Creates a branch on <span className="font-mono font-semibold">{targetRepo}</span> (or on your fork),
                    commits the <span className="font-mono tabular-nums">{acceptedCount}</span> accepted line
                    {acceptedCount === 1 ? '' : 's'} to <span className="font-mono">{readmeFile}</span>, and opens a
                    ready-to-merge Pull Request.
                  </p>
                  <span className="hint font-mono">
                    {!pr.github
                      ? 'Checking GitHub login…'
                      : pr.github.connected
                      ? `Signed in as ${pr.github.login} (${pr.github.source})`
                      : pr.github.error}
                  </span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="hint mb-1 block">Target repository (owner/name)</label>
                    <input
                      className="input font-mono text-xs"
                      value={targetRepo}
                      onChange={(e) => setTargetRepo(e.target.value)}
                      aria-label="Target repository"
                    />
                  </div>
                  <div className="sm:col-span-8">
                    <label className="hint mb-1 block">Pull request title</label>
                    <input
                      className="input text-xs"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      aria-label="Pull request title"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button type="button" className="btn-keycap text-xs" onClick={() => setPr({ step: 'closed' })}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-keycap text-xs"
                    onClick={simulatePrDryRun}
                    disabled={!targetRepo.trim() || !prTitle.trim()}
                  >
                    <Play className="h-3.5 w-3.5 text-accent" />
                    Simulate PR Preview (Dry Run)
                  </button>
                  <button
                    type="button"
                    className="btn-keycap btn-keycap-primary text-xs"
                    onClick={createPr}
                    disabled={!pr.github?.connected || !prTitle.trim() || !targetRepo.trim()}
                  >
                    <GitPullRequest className="h-3.5 w-3.5" />
                    Create pull request on GitHub
                  </button>
                </div>
              </>
            )}
            {pr.step === 'creating' && (
              <p className="flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating branch, committing and opening the pull request…
              </p>
            )}
            {pr.step === 'done' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                    <Check className="h-4 w-4 text-ok" />
                    {pr.dryRun ? 'Dry-run Pull Request prepared:' : 'Pull request'} #{pr.number}{' '}
                    {pr.viaFork ? 'opened from your fork' : 'ready'} on branch{' '}
                    <span className="rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-xs">
                      <GitBranch className="mr-1 inline h-3 w-3" />
                      {pr.branch || 'docdrift/readme-fix'}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      View on GitHub <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button type="button" className="btn-keycap text-xs" onClick={() => setPr({ step: 'closed' })}>
                      Done
                    </button>
                  </div>
                </div>
                {pr.bodyPreview && (
                  <pre className="depth-well whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-mono text-xs text-muted">
                    {pr.bodyPreview}
                  </pre>
                )}
              </div>
            )}
            {pr.step === 'error' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-danger">{pr.message}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-keycap text-xs" onClick={simulatePrDryRun}>
                    Simulate PR Preview
                  </button>
                  <button type="button" className="btn-keycap text-xs" onClick={openPrForm}>
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto p-3 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating patch…
            </div>
          ) : !hasPatch ? (
            <p className="py-10 text-center text-sm text-muted">No {readmeFile} changes were generated.</p>
          ) : tab === 'REVIEW' ? (
            <DiffViewer
              blocks={blocks}
              accepted={accepted}
              onSetAccepted={setLines}
              drifts={drifts}
              showContextTooltips={showContextTooltips}
              docFile={readmeFile}
            />
          ) : (
            <pre className="depth-well whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-fg">
              {finalReadme}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
