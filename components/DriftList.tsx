'use client';

import React, { useState } from 'react';
import { DriftItem, DriftSeverity, DriftCategory } from '@/lib/types';
import { 
  AlertCircle, 
  Terminal, 
  Code2, 
  FileText, 
  Key, 
  Network, 
  Check, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

interface DriftListProps {
  drifts: DriftItem[];
  onResolveIndividual: (driftId: string) => void;
  onOpenDiffForDrift: (drift: DriftItem) => void;
}

export const DriftList: React.FC<DriftListProps> = ({
  drifts,
  onResolveIndividual,
  onOpenDiffForDrift,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const filteredDrifts = drifts.filter((d) => {
    if (filterSeverity === 'ALL') return true;
    return d.severity === filterSeverity;
  });

  const getCategoryIcon = (category: DriftCategory) => {
    switch (category) {
      case 'CLI_FLAG':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'API_ENDPOINT':
        return <Network className="w-4 h-4 text-purple-400" />;
      case 'ENV_VARIABLE':
        return <Key className="w-4 h-4 text-amber-400" />;
      case 'FUNCTION_SIGNATURE':
        return <Code2 className="w-4 h-4 text-blue-400" />;
      default:
        return <FileText className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getSeverityBadge = (severity: DriftSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
      
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Detected Drift Points</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {drifts.length} items
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-referenced Markdown code snippets vs. actual codebase AST signatures.
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterSeverity === sev
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Drift Cards Grid */}
      <div className="space-y-4">
        {filteredDrifts.map((drift) => {
          const isResolved = drift.resolved;

          return (
            <div
              key={drift.id}
              className={`glass-panel rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${
                isResolved
                  ? 'border-emerald-500/40 bg-emerald-950/10 opacity-75'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Top Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50">
                    {getCategoryIcon(drift.category)}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white flex items-center gap-2">
                      <span>{drift.title}</span>
                      {isResolved && (
                        <span className="inline-flex items-center text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <Check className="w-3 h-3 mr-1" />
                          Remediated
                        </span>
                      )}
                    </h4>
                    <div className="text-xs font-mono text-slate-400 flex items-center space-x-2 mt-0.5">
                      <span>Category: <strong className="text-slate-300">{drift.category}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border uppercase tracking-wider font-semibold ${getSeverityBadge(drift.severity)}`}>
                    {drift.severity}
                  </span>
                </div>
              </div>

              {/* Side-by-side snippet comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                
                {/* Outdated Doc snippet */}
                <div className="rounded-xl bg-red-950/20 border border-red-500/20 p-3.5">
                  <div className="flex items-center justify-between text-xs font-mono text-red-400 mb-2">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Outdated Doc: {drift.docFile}</span>
                    </span>
                    <span className="text-slate-500">{drift.docLineRange}</span>
                  </div>
                  <pre className="text-xs font-mono bg-black/40 text-red-200 p-2.5 rounded-lg overflow-x-auto border border-red-500/10">
                    <code>{drift.docSnippet}</code>
                  </pre>
                </div>

                {/* Actual Codebase snippet */}
                <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3.5">
                  <div className="flex items-center justify-between text-xs font-mono text-emerald-400 mb-2">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Actual Code: {drift.codeFile}</span>
                    </span>
                    <span className="text-slate-500">{drift.codeLineRange}</span>
                  </div>
                  <pre className="text-xs font-mono bg-black/40 text-emerald-200 p-2.5 rounded-lg overflow-x-auto border border-emerald-500/10">
                    <code>{drift.codeSnippet}</code>
                  </pre>
                </div>

              </div>

              {/* Explanation & Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 mb-4">
                <div>
                  <span className="text-slate-400 block font-semibold mb-1">
                    🔍 Gemma 4 Analysis:
                  </span>
                  <p className="text-slate-300 font-sans leading-relaxed">{drift.explanation}</p>
                </div>
                <div>
                  <span className="text-amber-400 block font-semibold mb-1">
                    ⚠️ New Contributor Impact:
                  </span>
                  <p className="text-slate-300 font-sans leading-relaxed">{drift.newcomerImpact}</p>
                </div>
              </div>

              {/* Suggested Fix Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                <div className="text-xs font-mono text-slate-400 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-slate-300 font-medium">Gemma 4 Suggested Fix:</span>
                  <code className="bg-blue-950/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20 max-w-sm truncate inline-block">
                    {drift.suggestedDocFix}
                  </code>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => onOpenDiffForDrift(drift)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
                  >
                    View Diff
                  </button>
                  <button
                    onClick={() => onResolveIndividual(drift.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-1 transition ${
                      isResolved
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isResolved ? 'Remediated' : 'Apply Gemma Fix'}</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
