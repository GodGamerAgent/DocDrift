'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export const ScanProgress: React.FC<{ startedAt: number }> = ({ startedAt }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="card flex items-start gap-3 p-4" role="status">
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted" />
      <div>
        <div className="text-sm">
          Analyzing… <span className="font-mono text-muted">{clock}</span>
        </div>
        <p className="hint mt-0.5">With a local model this can take several minutes.</p>
      </div>
    </div>
  );
};
