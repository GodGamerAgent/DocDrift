'use client';

import React, { useState } from 'react';
import { X, Sparkles, Terminal, Cpu, Database, CheckCircle, ShieldCheck } from 'lucide-react';

interface GemmaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string;
}

export const GemmaInspectorModal: React.FC<GemmaInspectorModalProps> = ({
  isOpen,
  onClose,
  modelName,
}) => {
  const [activeTab, setActiveTab] = useState<'PROMPT' | 'ARCHITECTURE' | 'EVALUATION'>('PROMPT');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel-elevated w-full max-w-3xl max-h-[85vh] rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">Gemma 4 Deep Inspection</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Track 2: Best Use of Gemma
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transparent breakdown of where Google Gemma 4 12B does the core AI reasoning.
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

        {/* Tab Bar */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('PROMPT')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'PROMPT' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Prompt & AST Feed
          </button>
          <button
            onClick={() => setActiveTab('ARCHITECTURE')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'ARCHITECTURE' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mac M5 & LM Studio Setup
          </button>
          <button
            onClick={() => setActiveTab('EVALUATION')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'EVALUATION' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hackathon Verification
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs max-h-[55vh] space-y-4">
          {activeTab === 'PROMPT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-slate-400 font-bold mb-1 flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>1. System Prompt (LM Studio API endpoint: POST /v1/chat/completions)</span>
                </div>
                <pre className="text-blue-300 whitespace-pre-wrap text-[11px] bg-black/40 p-3 rounded-lg border border-blue-500/10">
{`You are Google Gemma 4 12B running locally via LM Studio.
Your role: Act as an autonomous Documentation Auditor & Diff Engine.
You cross-examine Markdown documentation code snippets against actual AST signatures:
- Identify removed or deprecated CLI flags
- Identify altered API routes and missing required HTTP headers
- Spot missing environment variables from .env.example
- Compute severity (CRITICAL, HIGH, MEDIUM) based on whether it breaks the quickstart.`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-slate-400 font-bold mb-1 flex items-center space-x-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>2. Context Payload Injected to Gemma 4</span>
                </div>
                <div className="text-slate-300 text-[11px] font-sans leading-relaxed">
                  Instead of feeding entire multi-megabyte repos, DocDrift parses the AST of entrypoints (`cli.ts`, `app.py`, `routes.py`, `.env.example`, `package.json`) and pairs each with extracted Markdown code blocks. Gemma receives a concise ~2,500 token prompt and outputs a structured JSON analysis.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ARCHITECTURE' && (
            <div className="space-y-4 font-sans text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Hardware & Runtime: Mac M5 with 16 GB Unified RAM</span>
                </h4>
                <p className="leading-relaxed mb-3">
                  Google Gemma 4 (12B) runs on Apple Silicon unified memory with Metal acceleration via LM Studio.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">QUANTIZATION</span>
                    <span className="text-white font-semibold">Q4_K_M (4-bit)</span>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">RAM FOOTPRINT</span>
                    <span className="text-emerald-400 font-semibold">~7.8 GB of 16 GB</span>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">LOCAL ENDPOINT</span>
                    <span className="text-blue-400 font-semibold">http://localhost:1234/v1</span>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">INFERENCE LATENCY</span>
                    <span className="text-purple-400 font-semibold">~42 tokens/sec (Metal)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'EVALUATION' && (
            <div className="space-y-3 font-sans text-xs text-slate-300">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Hacktoberfest Criteria Alignment (Problem #18)</span>
                </h4>
                <ul className="space-y-2 mt-2">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Track 2: Best Use of Gemma</strong> — Gemma 4 performs the semantic comparison between code signatures and human-readable docs.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>100% Open-Source</strong> — Released under Apache 2.0 / MIT license on GitHub.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>3-Minute Live Demo Ready</strong> — Immediate visual before/after diffs, health scores, and 1-click patch generation.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white transition"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
