'use client';

import React from 'react';
import { DocHealthMetrics, RepoAnalysisResult } from '@/lib/types';
import { AlertTriangle, Clock, ShieldAlert, Sparkles, CheckCircle2, GitMerge } from 'lucide-react';

interface HealthScorecardProps {
  analysis: RepoAnalysisResult;
  onOpenRemediation: () => void;
  remediated: boolean;
}

export const HealthScorecard: React.FC<HealthScorecardProps> = ({
  analysis,
  onOpenRemediation,
  remediated,
}) => {
  const { metrics, repoName, modelUsed, drifts } = analysis;
  const currentScore = remediated ? 100 : metrics.overallScore;

  // Determine score color
  let scoreColor = 'text-red-400';
  let badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
  let badgeLabel = 'CRITICAL DRIFT';
  let ringColor = '#ef4444';

  if (currentScore >= 80) {
    scoreColor = 'text-emerald-400';
    badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    badgeLabel = 'DOCS IN SYNC';
    ringColor = '#10b981';
  } else if (currentScore >= 50) {
    scoreColor = 'text-amber-400';
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    badgeLabel = 'MODERATE DRIFT';
    ringColor = '#f59e0b';
  }

  // Calculate SVG circumference for circular gauge
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (currentScore / 100) * circumference;

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-7xl mx-auto border border-slate-800 shadow-2xl relative overflow-hidden mb-8">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
        
        {/* Left: Circular Health Meter + Repo Name */}
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          
          {/* Circular Gauge */}
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-800"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={ringColor}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold font-mono tracking-tight ${scoreColor}`}>
                {currentScore}%
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Health</span>
            </div>
          </div>

          {/* Repo Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1 justify-center sm:justify-start">
              <h2 className="text-xl sm:text-2xl font-bold text-white font-mono">{repoName}</h2>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {remediated ? '100% REMEDIATED' : badgeLabel}
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-md">
              {remediated
                ? 'All documentation drift has been resolved! Ready to merge PR patch.'
                : analysis.summary}
            </p>
            <div className="mt-2 text-xs font-mono text-slate-500 flex items-center space-x-2 justify-center sm:justify-start">
              <span>Model: <strong className="text-blue-400">{modelUsed}</strong></span>
              <span>·</span>
              <span>Scanned {analysis.totalFilesScanned} files</span>
            </div>
          </div>

        </div>

        {/* Center: Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <div className="flex items-center justify-center text-red-400 mb-1">
              <ShieldAlert className="w-4 h-4 mr-1" />
              <span className="text-xs font-mono">Critical</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {remediated ? 0 : metrics.criticalCount}
            </div>
            <div className="text-[11px] text-slate-500">Blockers</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <div className="flex items-center justify-center text-amber-400 mb-1">
              <AlertTriangle className="w-4 h-4 mr-1" />
              <span className="text-xs font-mono">Total Drift</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {remediated ? 0 : metrics.totalDrifts}
            </div>
            <div className="text-[11px] text-slate-500">Mismatches</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center col-span-2 sm:col-span-1">
            <div className="flex items-center justify-center text-blue-400 mb-1">
              <Clock className="w-4 h-4 mr-1" />
              <span className="text-xs font-mono">Friction</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {remediated ? '0 min' : `~${metrics.estimatedOnboardingFrictionMin}m`}
            </div>
            <div className="text-[11px] text-slate-500">Lost per contributor</div>
          </div>

        </div>

        {/* Right CTA Button */}
        <div className="shrink-0 w-full sm:w-auto">
          <button
            onClick={onOpenRemediation}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 shadow-xl shadow-blue-600/25 border border-blue-400/30 transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>{remediated ? 'View Gemma 4 PR Patch' : 'Remediate All with Gemma 4'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
