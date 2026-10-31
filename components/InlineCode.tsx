import React from 'react';

// Renders `backtick` spans in model/heuristic text as inline code.
export const InlineCode: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(`[^`]+`)/g).map((part, i) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
        <code key={i} className="rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
          {part.slice(1, -1)}
        </code>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    )}
  </>
);
