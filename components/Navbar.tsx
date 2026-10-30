'use client';

import React from 'react';
import { GitPullRequest, Cpu, Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LMStudioStatus } from '@/lib/types';

interface NavbarProps {
  lmStatus: LMStudioStatus | null;
  checkingLm: boolean;
  onRefreshLm: () => void;
  onOpenLmGuide: () => void;
  onOpenGemmaInspector: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lmStatus,
  checkingLm,
  onRefreshLm,
  onOpenLmGuide,
  onOpenGemmaInspector,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 shadow-lg shadow-blue-500/20">
            <GitPullRequest className="w-5 h-5 text-white" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-[#090d16] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white flex items-center">
                Doc<span className="text-blue-400">Drift</span>
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  AI
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Documentation Drift Detector</p>
          </div>
        </div>

        {/* Center: Track Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/40 border border-slate-700/50 text-xs">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-slate-300">Hacktoberfest &apos;26 Hack Day</span>
          <span className="text-slate-600">·</span>
          <span className="text-indigo-400 font-medium">Track 2: Gemma 4</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">Problem #18</span>
        </div>

        {/* Right Actions: LM Studio Status & Gemma Inspector */}
        <div className="flex items-center space-x-3">
          {/* Gemma Inspector Button */}
          <button
            onClick={onOpenGemmaInspector}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition"
            title="Inspect Gemma 4 Prompt & AST Extraction"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Gemma 4 Inspector</span>
          </button>

          {/* LM Studio Connection Pill */}
          <div
            onClick={onOpenLmGuide}
            className="cursor-pointer group flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all duration-200 bg-slate-900/90 hover:border-slate-600"
            style={{
              borderColor: lmStatus?.connected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
            }}
          >
            <Cpu className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition" />
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  lmStatus?.connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-200 font-medium">
                {lmStatus?.connected ? 'LM Studio: Gemma 4' : 'Gemma Simulator'}
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefreshLm();
              }}
              disabled={checkingLm}
              className="p-0.5 text-slate-400 hover:text-white transition ml-1"
              title="Ping LM Studio (port 1234)"
            >
              <RefreshCw className={`w-3 h-3 ${checkingLm ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
