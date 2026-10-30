'use client';

import React, { useState } from 'react';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';

interface ScanFormProps {
  onScanUrl: (url: string) => void;
  onSelectSample: (sampleId: string) => void;
  activeSampleId: string | null;
  loading: boolean;
}

export const ScanForm: React.FC<ScanFormProps> = ({ onScanUrl, onSelectSample, activeSampleId, loading }) => {
  const [repoInput, setRepoInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput.trim()) onScanUrl(repoInput.trim());
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find documentation drift</h1>
        <p className="mt-1 text-sm text-muted">
          Compare a GitHub repository&apos;s README with its code and get a patch for anything out of date.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          placeholder="https://github.com/owner/repo"
          aria-label="GitHub repository URL"
          className="input font-mono"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !repoInput.trim()} className="btn btn-primary shrink-0 px-4">
          Scan
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Examples:</span>
        {Object.values(SAMPLE_REPOS).map((sample) => {
          const count = sample.expectedDrifts.length;
          return (
            <button
              key={sample.id}
              onClick={() => onSelectSample(sample.id)}
              disabled={loading}
              className={`btn ${activeSampleId === sample.id ? 'border-fg' : ''}`}
            >
              <span className="font-mono">{sample.id}</span>
              <span className={count > 0 ? 'text-danger' : 'text-ok'}>
                {count > 0 ? `${count} issues` : 'in sync'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
