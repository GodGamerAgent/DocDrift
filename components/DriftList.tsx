'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ChevronDown, RotateCcw } from 'lucide-react';
import { DriftCategory, DriftItem, DriftSeverity } from '@/lib/types';
import { sourceRef } from '@/lib/diffModel';
import { InlineCode } from './InlineCode';

const SEVERITY_STYLE: Record<DriftSeverity, { label: string; tone: string }> = {
  CRITICAL: { label: 'Critical', tone: 'text-danger font-bold' },
  HIGH: { label: 'High', tone: 'text-warn font-bold' },
  MEDIUM: { label: 'Medium', tone: 'text-accent font-semibold' },
  LOW: { label: 'Low', tone: 'text-muted font-semibold' },
};
const FILTERS: Array<'ALL' | DriftSeverity> = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORY_LABEL: Record<DriftCategory, string> = {
  CLI_FLAG: 'CLI flag',
  FUNCTION_SIGNATURE: 'Function signature',
  ENV_VARIABLE: 'Environment variable',
  API_ENDPOINT: 'API endpoint',
  INSTALL_STEP: 'Setup step',
  VERSION_MISMATCH: 'Version',
  DEAD_LINK: 'Link & Badge',
  SECRET_LEAK: 'Secret leak',
  LICENSE_MISMATCH: 'License',
};

const Snippet: React.FC<{ label: string; text: string; tone?: 'danger' | 'ok' | 'neutral' }> = ({
  label,
  text,
  tone = 'neutral',
}) => {
  const borderTone =
    tone === 'danger'
      ? 'border-danger/35 bg-danger/[0.05] text-fg'
      : tone === 'ok'
      ? 'border-ok/35 bg-ok/[0.05] text-fg'
      : 'border-line bg-bg text-fg';
  return (
    <div className="min-w-0">
      <div className="hint mb-1 font-semibold">{label}</div>
      <pre
        className={`depth-well whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs leading-relaxed ${borderTone}`}
      >
        {text || '—'}
      </pre>
    </div>
  );
};

interface DriftListProps {
  drifts: DriftItem[];
  onResolve: (driftId: string) => void;
  showContextTooltips?: boolean;
  externalCategoryFilter?: 'ALL' | DriftCategory;
  onCategoryFilterChange?: (cat: 'ALL' | DriftCategory) => void;
  docFile?: string;
}

export const DriftList: React.FC<DriftListProps> = ({
  drifts,
  onResolve,
  showContextTooltips = true,
  externalCategoryFilter,
  onCategoryFilterChange,
  docFile = 'README.md',
}) => {
  const [filter, setFilter] = useState<'ALL' | DriftSeverity>('ALL');
  const [catFilter, setCatFilter] = useState<'ALL' | DriftCategory>('ALL');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(drifts.slice(0, 1).map((d) => d.id)));

  useEffect(() => {
    if (externalCategoryFilter) {
      setCatFilter(externalCategoryFilter);
    }
  }, [externalCategoryFilter]);

  const handleSetCat = (cat: 'ALL' | DriftCategory) => {
    setCatFilter(cat);
    onCategoryFilterChange?.(cat);
  };

  if (drifts.length === 0) {
    return (
      <section id="audit-checks" className="scroll-mt-24">
        <div className="card-3d p-8 text-center text-sm text-muted">
          No drift found. <span className="font-mono font-semibold text-fg">{docFile}</span> matches the source code and LICENSE file.
        </div>
      </section>
    );
  }

  const categoriesPresent = Array.from(new Set(drifts.map((d) => d.category)));
  const visible = drifts.filter(
    (d) => (filter === 'ALL' || d.severity === filter) && (catFilter === 'ALL' || d.category === catFilter)
  );

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section id="audit-checks" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-fg">
            Audit Checks &amp; Detected Drift Issues{' '}
            <span className="font-mono text-sm font-normal text-muted tabular-nums">
              ({drifts.filter((d) => !d.resolved).length} open of {drifts.length})
            </span>
          </h2>
        </div>

        {/* Interactive Severity & Category Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {categoriesPresent.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
              <button
                type="button"
                onClick={() => handleSetCat('ALL')}
                className={`rounded-md px-2.5 py-1 whitespace-nowrap shrink-0 transition-colors ${
                  catFilter === 'ALL' ? 'bg-accent font-semibold text-white' : 'text-muted hover:text-fg'
                }`}
              >
                All Checks
              </button>
              {categoriesPresent.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSetCat(cat)}
                  className={`rounded-md px-2.5 py-1 whitespace-nowrap shrink-0 transition-colors ${
                    catFilter === cat ? 'bg-accent font-semibold text-white' : 'text-muted hover:text-fg'
                  }`}
                >
                  {CATEGORY_LABEL[cat] ?? cat}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
            {FILTERS.map((f) => {
              const count = f === 'ALL' ? drifts.length : drifts.filter((d) => d.severity === f).length;
              if (f !== 'ALL' && count === 0) return null;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2.5 py-1 font-mono tabular-nums whitespace-nowrap shrink-0 transition-colors ${
                    filter === f ? 'bg-accent font-bold text-white' : 'text-muted hover:text-fg'
                  }`}
                >
                  {f === 'ALL' ? 'All' : SEVERITY_STYLE[f].label} {count}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="space-y-3" style={{ perspective: '1000px' }}>
        {visible.map((drift, idx) => {
          const open = openIds.has(drift.id);
          const severity = SEVERITY_STYLE[drift.severity] ?? SEVERITY_STYLE.MEDIUM;
          const ref = sourceRef(drift);
          return (
            <motion.li
              key={drift.id}
              initial={{ opacity: 1, y: 10, rotateX: 3 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: false, amount: 0.05 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.15) }}
              className="card-3d overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(drift.id)}
                aria-expanded={open}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-fg/[0.02]"
              >
                <span className={`mt-0.5 w-16 shrink-0 text-xs ${severity.tone}`}>
                  {severity.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${drift.resolved ? 'text-muted line-through' : 'text-fg'}`}>
                    <InlineCode text={drift.title} />
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    <span>{CATEGORY_LABEL[drift.category] ?? drift.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      {drift.docFile} {drift.docLineRange}
                      {drift.codeFile && ` → ${drift.codeFile} ${drift.codeLineRange}`}
                    </span>
                    {showContextTooltips && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono font-semibold text-accent">Source: {ref}</span>
                      </>
                    )}
                  </span>
                </span>
                <ChevronDown
                  className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {open && (
                <div className="space-y-4 border-t border-line bg-bg/50 px-5 py-4 sm:pl-24">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Snippet label={`${drift.docFile || docFile} says (Outdated)`} text={drift.docSnippet} tone="danger" />
                    <Snippet
                      label={drift.codeFile ? `Source truth (${ref})` : 'Verification details'}
                      text={drift.codeSnippet}
                      tone="ok"
                    />
                  </div>
                  {showContextTooltips && drift.explanation && (
                    <p className="text-sm leading-relaxed text-fg">
                      <span className="font-bold text-accent">Why it changed ({ref}): </span>
                      <InlineCode text={drift.explanation} />
                    </p>
                  )}
                  {drift.newcomerImpact && (
                    <p className="text-sm text-muted">
                      <span className="font-semibold text-fg">Impact: </span>
                      <InlineCode text={drift.newcomerImpact} />
                    </p>
                  )}
                  {drift.suggestedDocFix && (
                    <Snippet label={`Proposed ${drift.docFile || docFile} fix`} text={drift.suggestedDocFix} tone="ok" />
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn-keycap text-xs"
                      onClick={() => onResolve(drift.id)}
                    >
                      {drift.resolved ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reopen issue
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                          Mark resolved
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
};
