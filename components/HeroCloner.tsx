'use client';

import React, { useState } from 'react';
import { GitBranch, ArrowRight, Terminal, Zap, Shield, Eye, Loader2 } from 'lucide-react';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';

interface HeroClonerProps {
  onScanUrl: (url: string) => void;
  onSelectSample: (sampleId: string) => void;
  selectedSampleId: string | null;
  loading: boolean;
}

export const HeroCloner: React.FC<HeroClonerProps> = ({
  onScanUrl,
  onSelectSample,
  selectedSampleId,
  loading,
}) => {
  const [repoInput, setRepoInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput.trim()) {
      onScanUrl(repoInput.trim());
    }
  };

  return (
    <div className="relative pt-8 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
      
      {/* Decorative ambient badge */}
      <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-medium mb-6">
        <Zap className="w-3.5 h-3.5 text-blue-400" />
        <span>Problem Statement #18: Documentation Drift Detector</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
        Never Let Outdated Docs{' '}
        <span className="gradient-text">Break New Contributors</span>
      </h1>

      <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
        Code evolves rapidly, but READMEs and API docs go stale. DocDrift scans your GitHub repository,
        cross-examines code against markdown with <span className="text-blue-400 font-medium">Google Gemma 4</span>,
        and generates instant 1-click remediation PR patches.
      </p>

      {/* GitHub Clone Input Bar */}
      <div className="mt-8 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <div className="absolute left-4 pointer-events-none text-slate-400">
            <GitBranch className="w-5 h-5 text-blue-400" />
          </div>
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="Paste any GitHub repo (e.g. https://github.com/expressjs/express)"
            className="w-full pl-12 pr-36 py-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition shadow-2xl text-sm sm:text-base font-mono"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !repoInput.trim()}
            className="absolute right-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center space-x-1.5 shadow-lg shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>Analyze Drift</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Showcase Demos */}
      <div className="mt-6 flex flex-col items-center">
        <span className="text-xs uppercase tracking-wider text-slate-500 font-mono mb-2.5">
          Or test 1-click real world drift scenarios:
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          
          <button
            onClick={() => onSelectSample('deployx-cli')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition ${
              selectedSampleId === 'deployx-cli'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/20'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>deployx-cli (CLI Flag Drift)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-sans">
              {SAMPLE_REPOS['deployx-cli'].expectedDrifts.length} Drifts
            </span>
          </button>

          <button
            onClick={() => onSelectSample('nexus-auth-api')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition ${
              selectedSampleId === 'nexus-auth-api'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/20'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>nexus-auth-service (API & Route Drift)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-sans">
              {SAMPLE_REPOS['nexus-auth-api'].expectedDrifts.length} Drifts
            </span>
          </button>

          <button
            onClick={() => onSelectSample('vision-core-ai')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition ${
              selectedSampleId === 'vision-core-ai'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/20'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>vision-core (Python Method Drift)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-sans">
              {SAMPLE_REPOS['vision-core-ai'].expectedDrifts.length} Drifts
            </span>
          </button>

        </div>
      </div>

    </div>
  );
};
