'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, X } from 'lucide-react';

interface PatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  gitDiff: string;
  fixedReadme: string;
  summary?: string;
  loading: boolean;
}

function diffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('Index:') || line.startsWith('===')) return 'text-muted';
  if (line.startsWith('@@')) return 'text-accent';
  if (line.startsWith('+')) return 'bg-ok/10 text-ok';
  if (line.startsWith('-')) return 'bg-danger/10 text-danger';
  return '';
}

export const PatchModal: React.FC<PatchModalProps> = ({ isOpen, onClose, gitDiff, fixedReadme, summary, loading }) => {
  const [tab, setTab] = useState<'DIFF' | 'README'>('DIFF');
  const [copied, setCopied] = useState(false);
  const hasPatch = gitDiff.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(gitDiff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([fixedReadme], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    // Revoking synchronously can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="patch-title" className="font-medium">
              README patch
            </h2>
            <p className="hint mt-0.5">{loading ? 'Generating…' : summary || 'No patch available.'}</p>
          </div>
          <button onClick={onClose} className="btn px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasPatch && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-2">
            <div className="flex gap-1 text-xs">
              {(['DIFF', 'README'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-2 py-1 transition-colors ${tab === t ? 'bg-fg/10 text-fg' : 'text-muted hover:text-fg'}`}
                >
                  {t === 'DIFF' ? 'Diff' : 'New README'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy patch'}
              </button>
              <button onClick={handleDownload} className="btn">
                <Download className="h-3.5 w-3.5" />
                Download README
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 font-sans text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating patch…
            </div>
          ) : !hasPatch ? (
            <p className="py-10 text-center font-sans text-sm text-muted">No README changes were generated.</p>
          ) : tab === 'DIFF' ? (
            gitDiff.split('\n').map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-words px-2 ${diffLineClass(line)}`}>
                {line || ' '}
              </div>
            ))
          ) : (
            <pre className="whitespace-pre-wrap break-words">{fixedReadme}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
