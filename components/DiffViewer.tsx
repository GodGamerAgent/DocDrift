'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { DiffBlock, DiffLine, driftsForBlock, sourceRef } from '@/lib/diffModel';
import { DriftItem } from '@/lib/types';
import { InlineCode } from './InlineCode';

interface DiffViewerProps {
  blocks: DiffBlock[];
  accepted: Set<number>;
  onSetAccepted: (lineIds: number[], value: boolean) => void;
  drifts: DriftItem[];
}

const CONTEXT_EDGE = 3;

const LineNo: React.FC<{ n?: number }> = ({ n }) => (
  <span className="w-9 shrink-0 select-none pr-2 text-right text-muted/70">{n ?? ''}</span>
);

const ContextRow: React.FC<{ line: DiffLine }> = ({ line }) => (
  <div className="grid md:grid-cols-2">
    <div className="hidden min-w-0 md:flex">
      <span className="w-6 shrink-0" />
      <LineNo n={line.oldNo} />
      <span className="min-w-0 whitespace-pre-wrap break-words">{line.text || ' '}</span>
    </div>
    <div className="flex min-w-0 md:border-l md:border-line">
      <span className="w-6 shrink-0" />
      <LineNo n={line.newNo} />
      <span className="min-w-0 whitespace-pre-wrap break-words">{line.text || ' '}</span>
    </div>
  </div>
);

const ChangeCell: React.FC<{
  line?: DiffLine;
  side: 'removed' | 'added';
  accepted: boolean;
  onToggle: () => void;
}> = ({ line, side, accepted, onToggle }) => {
  if (!line) return <div className={`hidden bg-fg/[0.02] md:block ${side === 'added' ? 'md:border-l md:border-line' : ''}`} />;

  const tone =
    side === 'removed'
      ? accepted
        ? 'bg-danger/10 text-danger'
        : 'text-fg'
      : accepted
      ? 'bg-ok/10 text-ok'
      : 'text-muted line-through opacity-60';
  const label = side === 'removed' ? (accepted ? 'Remove this line' : 'Keeping this line') : accepted ? 'Add this line' : 'Not adding this line';

  return (
    <label
      className={`flex min-w-0 cursor-pointer items-start ${tone} ${side === 'added' ? 'md:border-l md:border-line' : ''}`}
      title={label}
    >
      <span className="flex w-6 shrink-0 justify-center pt-[3px]">
        <input type="checkbox" className="h-3 w-3 accent-fg" checked={accepted} onChange={onToggle} aria-label={label} />
      </span>
      <LineNo n={side === 'removed' ? line.oldNo : line.newNo} />
      <span className="w-3 shrink-0 select-none">{side === 'removed' ? '-' : '+'}</span>
      <span className="min-w-0 whitespace-pre-wrap break-words">{line.text || ' '}</span>
    </label>
  );
};

const WhyTooltip: React.FC<{ reasons: DriftItem[] }> = ({ reasons }) => {
  if (reasons.length === 0) return null;
  return (
    <span className="group relative inline-flex">
      <button type="button" className="inline-flex items-center gap-1 text-muted hover:text-fg focus:text-fg focus:outline-none">
        <Info className="h-3.5 w-3.5" />
        Why?
      </button>
      <span
        role="tooltip"
        className="invisible absolute left-0 top-full z-20 mt-1 w-80 max-w-[80vw] rounded-md border border-line bg-bg p-3 font-sans text-xs text-fg shadow-lg group-focus-within:visible group-hover:visible"
      >
        {reasons.map((d) => (
          <span key={d.id} className="block py-1 first:pt-0 last:pb-0">
            <span className="block">
              <InlineCode text={d.title} />
            </span>
            <span className="mt-0.5 block font-mono text-muted">Source: {sourceRef(d)}</span>
          </span>
        ))}
      </span>
    </span>
  );
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ blocks, accepted, onSetAccepted, drifts }) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  let changeNo = 0;

  return (
    <div className="overflow-hidden rounded-md border border-line font-mono text-xs leading-5">
      <div className="hidden border-b border-line bg-surface font-sans text-xs text-muted md:grid md:grid-cols-2">
        <div className="px-3 py-1.5">Current README</div>
        <div className="border-l border-line px-3 py-1.5">Proposed README</div>
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
                className="block w-full border-y border-line bg-surface px-3 py-1 text-left font-sans text-xs text-muted hover:text-fg"
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
        const rows = Math.max(block.removed.length, block.added.length);
        const reasons = driftsForBlock(block, drifts);

        return (
          <div key={`chg-${block.id}`} className="border-y border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface px-3 py-1 font-sans text-xs">
              <span className="flex items-center gap-3">
                <span className="text-muted">Change {changeNo}</span>
                <WhyTooltip reasons={reasons} />
              </span>
              <span className="flex gap-2">
                <button
                  className={allOn ? 'text-muted' : 'text-accent hover:underline'}
                  disabled={allOn}
                  onClick={() => onSetAccepted(ids, true)}
                >
                  Accept
                </button>
                <button
                  className={ids.some((id) => accepted.has(id)) ? 'text-accent hover:underline' : 'text-muted'}
                  disabled={!ids.some((id) => accepted.has(id))}
                  onClick={() => onSetAccepted(ids, false)}
                >
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
