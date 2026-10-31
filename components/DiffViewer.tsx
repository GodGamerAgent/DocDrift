'use client';

import React, { useState } from 'react';
import { Check, Info, X } from 'lucide-react';
import { DiffBlock, DiffLine, driftsForBlock, sourceRef } from '@/lib/diffModel';
import { DriftItem } from '@/lib/types';
import { InlineCode } from './InlineCode';
import { completeQuestStep } from './Header';

interface DiffViewerProps {
  blocks: DiffBlock[];
  accepted: Set<number>;
  onSetAccepted: (lineIds: number[], value: boolean) => void;
  drifts: DriftItem[];
  showContextTooltips?: boolean;
  docFile?: string;
}

const CONTEXT_EDGE = 3;

const LineNo: React.FC<{ n?: number }> = ({ n }) => (
  <span className="w-9 shrink-0 select-none pr-2 text-right font-mono tabular-nums text-muted/75">{n ?? ''}</span>
);

const ContextRow: React.FC<{ line: DiffLine }> = ({ line }) => (
  <div className="grid md:grid-cols-2">
    <div className="hidden min-w-0 md:flex py-0.5 text-fg">
      <span className="w-7 shrink-0" />
      <LineNo n={line.oldNo} />
      <span className="min-w-0 whitespace-pre-wrap break-words pr-2">{line.text || ' '}</span>
    </div>
    <div className="flex min-w-0 py-0.5 text-fg md:border-l md:border-line">
      <span className="w-7 shrink-0" />
      <LineNo n={line.newNo} />
      <span className="min-w-0 whitespace-pre-wrap break-words pr-2">{line.text || ' '}</span>
    </div>
  </div>
);

const ChangeCell: React.FC<{
  line?: DiffLine;
  side: 'removed' | 'added';
  accepted: boolean;
  onToggle: () => void;
}> = ({ line, side, accepted, onToggle }) => {
  if (!line) {
    return (
      <div
        className={`hidden bg-fg/[0.02] md:block ${side === 'added' ? 'md:border-l md:border-line' : ''}`}
      />
    );
  }

  const tone =
    side === 'removed'
      ? accepted
        ? 'bg-danger/10 text-danger'
        : 'bg-surface text-fg'
      : accepted
      ? 'bg-ok/10 text-ok'
      : 'bg-surface text-muted line-through opacity-60';

  const label =
    side === 'removed'
      ? accepted
        ? 'Remove this outdated line (click to keep original)'
        : 'Keeping original line (click to remove)'
      : accepted
      ? 'Accept this proposed fix line (click to reject)'
      : 'Rejected proposed fix line (click to accept)';

  return (
    <label
      className={`flex min-w-0 cursor-pointer items-start py-1 transition-colors hover:brightness-95 ${tone} ${
        side === 'added' ? 'md:border-l md:border-line' : ''
      }`}
      title={label}
    >
      <span className="flex w-7 shrink-0 justify-center pt-[2px]">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 cursor-pointer rounded accent-accent"
          checked={accepted}
          onChange={() => {
            completeQuestStep(2);
            onToggle();
          }}
          aria-label={label}
        />
      </span>
      <LineNo n={side === 'removed' ? line.oldNo : line.newNo} />
      <span className="w-3.5 shrink-0 select-none font-bold">{side === 'removed' ? '-' : '+'}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-2">{line.text || ' '}</span>
    </label>
  );
};

const WhyTooltip: React.FC<{ reasons: DriftItem[] }> = ({ reasons }) => {
  const [pinned, setPinned] = useState(false);
  if (reasons.length === 0) return null;

  const primaryRef = sourceRef(reasons[0]);

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-0.5 text-xs font-semibold text-fg shadow-sm transition-colors hover:border-accent hover:text-accent focus:outline-none"
      >
        <Info className="h-3.5 w-3.5 text-accent" />
        <span>Why it changed</span>
        <span aria-hidden="true" className="text-muted">·</span>
        <span className="font-mono text-[11px] text-accent">{primaryRef}</span>
      </button>
      <span
        role="tooltip"
        className={`${
          pinned ? 'visible' : 'invisible group-focus-within:visible group-hover:visible'
        } card-3d absolute left-0 top-full z-30 mt-1.5 w-96 max-w-[85vw] p-3.5 font-sans text-xs text-fg`}
      >
        <span className="mb-1.5 block font-mono text-[11px] font-bold text-muted">
          [SOURCE_CITATION // {reasons.length} {reasons.length === 1 ? 'TRIGGER' : 'TRIGGERS'}]
        </span>
        {reasons.map((d) => (
          <span key={d.id} className="block border-t border-line py-2 first:border-t-0 first:pt-0 last:pb-0">
            <span className="block font-semibold text-fg">
              <InlineCode text={d.title} />
            </span>
            <span className="mt-0.5 block font-mono text-[11px] text-accent">
              Source: {sourceRef(d)} ({d.category})
            </span>
            {d.explanation && (
              <span className="mt-1 block text-muted leading-relaxed">
                <InlineCode text={d.explanation} />
              </span>
            )}
            {d.codeSnippet && (
              <span className="mt-1.5 block truncate rounded border border-line bg-bg px-2 py-1 font-mono text-[11px] text-fg">
                {d.codeSnippet}
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  blocks,
  accepted,
  onSetAccepted,
  drifts,
  showContextTooltips = true,
  docFile = 'README.md',
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  let changeNo = 0;

  return (
    <div className="card-3d overflow-visible font-mono text-xs leading-5">
      <div className="grid grid-cols-1 border-b border-line bg-surface font-sans text-xs font-semibold text-muted md:grid-cols-2 rounded-t-[0.85rem]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span>Current {docFile} (Outdated in Red)</span>
          <span className="font-mono text-[11px] text-danger">- Removed</span>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 md:border-l md:border-t-0">
          <span>Proposed {docFile} (Fixes in Green)</span>
          <span className="font-mono text-[11px] text-ok">+ Added</span>
        </div>
      </div>

      {blocks.map((block, index) => {
        if (block.kind === 'context') {
          const isFirst = index === 0;
          const isLast = index === blocks.length - 1;
          const head = isFirst ? 0 : CONTEXT_EDGE;
          const tail = isLast ? 0 : CONTEXT_EDGE;
          if (expanded.has(index) || block.lines.length <= head + tail + 2) {
            return block.lines.map((line) => <ContextRow key={line.id} line={line} />);
          }
          const hidden = block.lines.length - head - tail;
          return (
            <React.Fragment key={`ctx-${index}`}>
              {block.lines.slice(0, head).map((line) => <ContextRow key={line.id} line={line} />)}
              <button
                type="button"
                className="block w-full border-y border-line bg-bg/70 px-4 py-1.5 text-left font-sans text-xs text-muted transition-colors hover:bg-bg hover:text-fg"
                onClick={() => setExpanded(new Set(expanded).add(index))}
              >
                Show {hidden} unchanged line{hidden === 1 ? '' : 's'}
              </button>
              {block.lines.slice(block.lines.length - tail).map((line) => <ContextRow key={line.id} line={line} />)}
            </React.Fragment>
          );
        }

        changeNo++;
        const ids = [...block.removed, ...block.added].map((l) => l.id);
        const allOn = ids.every((id) => accepted.has(id));
        const anyOn = ids.some((id) => accepted.has(id));
        const rows = Math.max(block.removed.length, block.added.length);
        const reasons = driftsForBlock(block, drifts);

        return (
          <div key={`chg-${block.id}`} className="border-y border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-bg/80 px-4 py-1.5 font-sans text-xs">
              <span className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-fg tabular-nums">Change {changeNo}</span>
                {showContextTooltips && <WhyTooltip reasons={reasons} />}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                    allOn ? 'text-muted cursor-default' : 'bg-ok/15 text-ok hover:bg-ok/25'
                  }`}
                  disabled={allOn}
                  onClick={() => {
                    completeQuestStep(2);
                    onSetAccepted(ids, true);
                  }}
                >
                  <Check className="h-3 w-3" />
                  Accept
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                    anyOn ? 'bg-danger/15 text-danger hover:bg-danger/25' : 'text-muted cursor-default'
                  }`}
                  disabled={!anyOn}
                  onClick={() => {
                    completeQuestStep(2);
                    onSetAccepted(ids, false);
                  }}
                >
                  <X className="h-3 w-3" />
                  Reject
                </button>
              </span>
            </div>
            {Array.from({ length: rows }, (_, i) => {
              const removed = block.removed[i];
              const added = block.added[i];
              return (
                <div key={i} className="grid md:grid-cols-2">
                  <ChangeCell
                    line={removed}
                    side="removed"
                    accepted={!!removed && accepted.has(removed.id)}
                    onToggle={() => removed && onSetAccepted([removed.id], !accepted.has(removed.id))}
                  />
                  <ChangeCell
                    line={added}
                    side="added"
                    accepted={!!added && accepted.has(added.id)}
                    onToggle={() => added && onSetAccepted([added.id], !accepted.has(added.id))}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
