'use client';

import React from 'react';
import { X, Cpu, CheckCircle2, Play, Terminal, ArrowRight, ShieldCheck } from 'lucide-react';
import { LMStudioStatus } from '@/lib/types';

interface LMStudioGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: LMStudioStatus | null;
  onRefresh: () => void;
}

export const LMStudioGuideModal: React.FC<LMStudioGuideModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel-elevated w-full max-w-2xl max-h-[90vh] rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>LM Studio & Gemma 4 Setup Guide</span>
              </h3>
              <p className="text-xs text-slate-400">
                How to connect your Mac M5 (16 GB) to DocDrift in 3 simple clicks
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4">
          
          {/* Current Status Box */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`w-3 h-3 rounded-full ${
                  status?.connected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-amber-400'
                }`}
              />
              <div>
                <div className="font-bold text-white font-mono">
                  {status?.connected ? '🟢 Connected to LM Studio' : '🟡 Offline (Gemma Simulator Mode Active)'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Target: {status?.endpoint || 'http://localhost:1234/v1'}
                </div>
              </div>
            </div>

            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs transition"
            >
              Test Connection
            </button>
          </div>

          {/* 3 Step Instructions */}
          <div className="space-y-3 font-sans">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div>
                <h4 className="font-semibold text-white">Open LM Studio & Download Gemma</h4>
                <p className="text-slate-400 mt-0.5 leading-relaxed">
                  Open <strong>LM Studio</strong> on your Mac. In the search tab, search for <code>gemma-4-12b</code> or <code>gemma-2-9b</code>. Select the <strong>Q4_K_M</strong> (4-bit) quantization (~7.8 GB download, fits perfectly in your 16 GB unified RAM). When loading it, set the <strong>context length to 16384 or more</strong> so full drift analyses fit.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                2
              </div>
              <div>
                <h4 className="font-semibold text-white">Start the Local Inference Server</h4>
                <p className="text-slate-400 mt-0.5 leading-relaxed">
                  Click the <strong>Developer / Server tab</strong> (the <code>&lt;-&gt;</code> icon on the left sidebar in LM Studio). Choose your Gemma model from the top dropdown, then click <strong>&quot;Start Server&quot;</strong>.
                </p>
                <div className="mt-1.5 p-2 bg-black/40 rounded border border-slate-800 font-mono text-[11px] text-slate-300">
                  LM Studio will listen on: <code>http://localhost:1234/v1</code>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                3
              </div>
              <div>
                <h4 className="font-semibold text-white">You Are All Set to Vibe Code!</h4>
                <p className="text-slate-400 mt-0.5 leading-relaxed">
                  Click &quot;Test Connection&quot; above. DocDrift will automatically route all drift audits and PR generation straight to your live Gemma 4 model!
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Vibe Coding Protection:</strong> If your LM Studio server is not running or takes time to start, DocDrift automatically runs in high-fidelity simulator mode so your hackathon demo never fails!
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Got it, Let&apos;s Build
          </button>
        </div>

      </div>
    </div>
  );
};
