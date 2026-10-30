'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPatch } from 'diff';
import { Check, Copy, Download, ExternalLink, GitPullRequest, Loader2, X } from 'lucide-react';
import { DriftItem } from '@/lib/types';
import { buildDiffBlocks, changedLineIds, composeReadme, driftsForBlock, sourceRef } from '@/lib/diffModel';
import { DiffViewer } from './DiffViewer';

interface PatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalReadme: string;
  fixedReadme: string;
  readmeFile: string;
  summary?: string;
  loading: boolean;
  drifts: DriftItem[];
  // owner/name of a scanned GitHub repo; absent for built-in examples
  repo?: string;
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
  | { step: 'done'; url: string; number: number; viaFork: boolean }
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
}) => {
  const [tab, setTab] = useState<'REVIEW' | 'README'>('REVIEW');
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [pr, setPr] = useState<PrState>({ step: 'closed' });
  const [prTitle, setPrTitle] = useState('docs: fix README drift');

  const blocks = useMemo(() => buildDiffBlocks(originalReadme, fixedReadme), [originalReadme, fixedReadme]);
  const allIds = useMemo(() => changedLineIds(blocks), [blocks]);

  // Every change starts accepted whenever a new patch arrives
  useEffect(() => {
    setAccepted(new Set(allIds));
    setPr({ step: 'closed' });
  }, [allIds]);

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
    // Revoking synchronously can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openPrForm = async () => {
    setPr({ step: 'form' });
    try {
      const github = await fetch('/api/github/status').then((r) => r.json());
      setPr((prev) => (prev.step === 'form' ? { step: 'form', github } : prev));
    } catch {
      setPr((prev) => (prev.step === 'form' ? { step: 'form', github: { connected: false, error: 'Could not check GitHub login.' } } : prev));
    }
  };

  const createPr = async () => {
    // Describe only the issues whose changes are still accepted
    const addressed = drifts.filter((d) =>
      blocks.some(
        (b) =>
          b.kind === 'change' &&
          [...b.removed, ...b.added].some((l) => accepted.has(l.id)) &&
          driftsForBlock(b, [d]).length > 0
      )
    );
    const description = [
      'This PR updates the README so it matches the current code.',
      '',
      ...(addressed.length ? ['Issues addressed:', ...addressed.map((d) => `- ${d.title} (\`${sourceRef(d)}\`)`), ''] : []),
      '_Generated with DocDrift and reviewed before submitting._',
    ].join('\n');

    setPr({ step: 'creating' });
    try {
      const res = await fetch('/api/github/pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, filePath: readmeFile, content: finalReadme, title: prTitle, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the pull request');
      setPr({ step: 'done', url: data.url, number: data.number, viaFork: data.viaFork });
    } catch (err: any) {
      setPr({ step: 'error', message: err.message });
    }
  };

  const acceptedCount = allIds.filter((id) => accepted.has(id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="patch-title" className="font-medium">
              Review README changes
            </h2>
            <p className="hint mt-0.5">{loading ? 'Generating…' : summary || 'No patch available.'}</p>
          </div>
          <button onClick={onClose} className="btn px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasPatch && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex gap-1">
                {(['REVIEW', 'README'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-2 py-1 transition-colors ${tab === t ? 'bg-fg/10 text-fg' : 'text-muted hover:text-fg'}`}
                  >
                    {t === 'REVIEW' ? 'Changes' : 'Result'}
                  </button>
                ))}
              </div>
              <span className="text-muted">
                {acceptedCount} of {allIds.length} lines accepted
              </span>
              <button className="text-accent hover:underline" onClick={() => setLines(allIds, true)}>
                Accept all
              </button>
              <button className="text-accent hover:underline" onClick={() => setLines(allIds, false)}>
                Reject all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleCopy} className="btn" disabled={!hasChanges}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy patch'}
              </button>
              <button onClick={handleDownload} className="btn" disabled={!hasChanges}>
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              {repo && (
                <button onClick={openPrForm} className="btn btn-primary" disabled={!hasChanges || pr.step !== 'closed'}>
                  <GitPullRequest className="h-3.5 w-3.5" />
                  Open pull request
                </button>
              )}
            </div>
          </div>
        )}

        {pr.step !== 'closed' && (
          <div className="space-y-3 border-b border-line bg-surface px-5 py-4 text-sm">
            {pr.step === 'form' && (
              <>
                <p>
                  Creates a branch on <span className="font-mono">{repo}</span> (or on your fork if you can&apos;t push to
                  it), commits the {acceptedCount} accepted line{acceptedCount === 1 ? '' : 's'} to{' '}
                  <span className="font-mono">{readmeFile}</span>, and opens a pull request.
                </p>
                <p className="hint">
                  {!pr.github
                    ? 'Checking GitHub login…'
                    : pr.github.connected
                    ? `Signed in as ${pr.github.login} (${pr.github.source}).`
                    : pr.github.error}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    aria-label="Pull request title"
                  />
                  <div className="flex shrink-0 gap-2">
                    <button className="btn" onClick={() => setPr({ step: 'closed' })}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={createPr}
                      disabled={!pr.github?.connected || !prTitle.trim()}
                    >
                      Create pull request
                    </button>
                  </div>
                </div>
              </>
            )}
            {pr.step === 'creating' && (
              <p className="flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating branch, committing and opening the pull request…
              </p>
            )}
            {pr.step === 'done' && (
              <p className="flex flex-wrap items-center gap-2">
                <Check className="h-4 w-4 text-ok" />
                Pull request #{pr.number} opened{pr.viaFork ? ' from your fork' : ''}.
                <a href={pr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  View on GitHub <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </p>
            )}
            {pr.step === 'error' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-danger">{pr.message}</p>
                <button className="btn" onClick={openPrForm}>
                  Try again
                </button>
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
            <p className="py-10 text-center text-sm text-muted">No README changes were generated.</p>
          ) : tab === 'REVIEW' ? (
            <DiffViewer blocks={blocks} accepted={accepted} onSetAccepted={setLines} drifts={drifts} />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{finalReadme}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
