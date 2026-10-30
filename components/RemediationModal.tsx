'use client';

import React, { useState } from 'react';
import { X, Check, Copy, Download, GitPullRequest, Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RemediationModalProps {
  isOpen: boolean;
  onClose: () => void;
  gitDiff: string;
  fixedReadme: string;
  summary?: string;
  loading?: boolean;
  onApplyMerge: () => void;
}

export const RemediationModal: React.FC<RemediationModalProps> = ({
  isOpen,
  onClose,
  gitDiff,
  fixedReadme,
  summary,
  loading = false,
  onApplyMerge,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'DIFF' | 'PREVIEW'>('DIFF');

  if (!isOpen) return null;

  const hasPatch = gitDiff.length > 0;

  const handleCopyDiff = async () => {
    try {
      await navigator.clipboard.writeText(gitDiff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownloadReadme = () => {
    const blob = new Blob([fixedReadme], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README_REMEDIATED.md';
    a.click();
    // Revoking synchronously can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSimulateMerge = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#8b5cf6', '#06b6d4'],
    });
    onApplyMerge();
    onClose();
  };

  // Format diff lines into styled tokens
  const diffLines = gitDiff.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel-elevated w-full max-w-4xl max-h-[85vh] rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Gemma 4 Remediation PR Patch</span>
                {hasPatch && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Ready to Commit
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {loading ? 'Generating patch…' : summary || 'No patch available for this repository.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Bar */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono">
            <button
              onClick={() => setActiveTab('DIFF')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'DIFF' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unified Git Diff (.diff)
            </button>
            <button
              onClick={() => setActiveTab('PREVIEW')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'PREVIEW' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Remediated README.md Preview
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyDiff}
              disabled={!hasPatch}
              className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Patch' : 'Copy Patch'}</span>
            </button>

            <button
              onClick={handleDownloadReadme}
              disabled={!hasPatch}
              className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download README</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs max-h-[50vh] bg-black/40">
          {loading ? (
            <div className="flex items-center justify-center space-x-2 py-12 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Generating remediation patch…</span>
            </div>
          ) : !hasPatch ? (
            <div className="py-12 text-center text-slate-400">
              No automatic README changes were generated for this scan.
            </div>
          ) : activeTab === 'DIFF' ? (
            <div className="space-y-0.5 select-text">
              {diffLines.map((line, idx) => {
                let lineClass = 'text-slate-400';
                let bgClass = 'transparent';

                if (line.startsWith('---') || line.startsWith('+++')) {
                  lineClass = 'text-blue-300 font-bold';
                  bgClass = 'rgba(59, 130, 246, 0.1)';
                } else if (line.startsWith('@@')) {
                  lineClass = 'text-purple-400 font-semibold';
                  bgClass = 'rgba(168, 85, 247, 0.1)';
                } else if (line.startsWith('-')) {
                  lineClass = 'text-red-300';
                  bgClass = 'rgba(239, 68, 68, 0.18)';
                } else if (line.startsWith('+')) {
                  lineClass = 'text-emerald-300';
                  bgClass = 'rgba(16, 185, 129, 0.18)';
                }

                return (
                  <div
                    key={idx}
                    style={{ backgroundColor: bgClass }}
                    className={`px-3 py-0.5 rounded whitespace-pre-wrap ${lineClass}`}
                  >
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">
              {fixedReadme}
            </pre>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            {hasPatch && (
              <>
                Fix generated by <span className="text-blue-400 font-semibold">DocDrift</span> from the detected drifts.
              </>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition"
            >
              Close
            </button>

            <button
              onClick={handleSimulateMerge}
              disabled={!hasPatch}
              className="disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs font-mono flex items-center space-x-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              <GitPullRequest className="w-4 h-4" />
              <span>Simulate Merge PR (100% Score)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
