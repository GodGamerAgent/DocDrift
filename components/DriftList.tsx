'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DriftItem, DriftSeverity } from '@/lib/types';
import { InlineCode } from './InlineCode';

const SEVERITY_STYLE: Record<DriftSeverity, { label: string; dot: string }> = {
  CRITICAL: { label: 'Critical', dot: 'bg-danger' },
  HIGH: { label: 'High', dot: 'bg-warn' },
  MEDIUM: { label: 'Medium', dot: 'bg-accent' },
  LOW: { label: 'Low', dot: 'bg-muted' },
};
const FILTERS: Array<'ALL' | DriftSeverity> = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const Snippet: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div className="min-w-0">
    <div className="hint mb-1">{label}</div>
    <pre className="whitespace-pre-wrap break-words rounded-md border border-line bg-bg p-2.5 font-mono text-xs leading-relaxed">
      {text || '—'}
    </pre>
  </div>
);

interface DriftListProps {
  drifts: DriftItem[];
  onResolve: (driftId: string) => void;
}

export const DriftList: React.FC<DriftListProps> = ({ drifts, onResolve }) => {
  const [filter, setFilter] = useState<'ALL' | DriftSeverity>('ALL');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  if (drifts.length === 0) {
    return <div className="card p-6 text-center text-sm text-muted">No drift found. The README matches the code.</div>;
  }

  const visible = drifts.filter((d) => filter === 'ALL' || d.severity === filter);
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          Issues <span className="text-muted">({drifts.filter((d) => !d.resolved).length} open)</span>
        </h2>
        <div className="flex gap-1 text-xs">
          {FILTERS.map((f) => {
            const count = f === 'ALL' ? drifts.length : drifts.filter((d) => d.severity === f).length;
            if (f !== 'ALL' && count === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2 py-1 transition-colors ${
                  filter === f ? 'bg-fg/10 text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                {f === 'ALL' ? 'All' : SEVERITY_STYLE[f].label} {count}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="card divide-y divide-line overflow-hidden">
        {visible.map((drift) => {
          const open = openIds.has(drift.id);
          const severity = SEVERITY_STYLE[drift.severity] ?? SEVERITY_STYLE.MEDIUM;
          return (
            <li key={drift.id}>
              <button
                onClick={() => toggle(drift.id)}
                aria-expanded={open}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-fg/[0.03]"
              >
                <span className="mt-0.5 flex w-16 shrink-0 items-center gap-1.5 text-xs text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${severity.dot}`} />
                  {severity.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${drift.resolved ? 'text-muted line-through' : ''}`}>
                    <InlineCode text={drift.title} />
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted">
                    {drift.docFile} {drift.docLineRange}
                    {drift.codeFile && ` → ${drift.codeFile} ${drift.codeLineRange}`}
                  </span>
                </span>
                <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="space-y-3 px-4 pb-4 sm:pl-[6.25rem]">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Snippet label="README says" text={drift.docSnippet} />
                    <Snippet label="Code has" text={drift.codeSnippet} />
                  </div>
                  {drift.explanation && (
                    <p className="text-sm">
                      <InlineCode text={drift.explanation} />
                    </p>
                  )}
                  {drift.newcomerImpact && (
                    <p className="text-sm text-muted">
                      <span className="text-fg">Impact: </span>
                      <InlineCode text={drift.newcomerImpact} />
                    </p>
                  )}
                  {drift.suggestedDocFix && <Snippet label="Suggested fix" text={drift.suggestedDocFix} />}
                  <div className="flex justify-end">
                    <button className="btn" onClick={() => onResolve(drift.id)} disabled={drift.resolved}>
                      {drift.resolved ? 'Resolved' : 'Mark resolved'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
