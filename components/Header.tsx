'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LMStudioStatus } from '@/lib/types';
import { SETTINGS_SAVED_EVENT } from '@/lib/settingsSchema';

const NAV = [
  { href: '/', label: 'Scan' },
  { href: '/settings', label: 'Settings' },
];

export const Header: React.FC = () => {
  const pathname = usePathname();
  // undefined = still checking, null = the status request itself failed
  const [status, setStatus] = useState<LMStudioStatus | null | undefined>(undefined);

  useEffect(() => {
    const load = () =>
      fetch('/api/lmstudio/status')
        .then((res) => res.json())
        .then(setStatus)
        .catch(() => setStatus(null));
    load();
    window.addEventListener(SETTINGS_SAVED_EVENT, load);
    return () => window.removeEventListener(SETTINGS_SAVED_EVENT, load);
  }, []);

  const connected = !!status?.connected;
  const statusLabel = status === undefined ? 'Checking model…' : connected ? status!.model : 'Model offline';

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            DocDrift
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'text-fg' : 'text-muted transition-colors hover:text-fg'}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <Link
          href="/settings"
          className="flex min-w-0 items-center gap-2 text-xs text-muted transition-colors hover:text-fg"
          title={connected ? `Connected to ${status!.endpoint}` : status?.error || 'LM Studio is not connected'}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-ok' : 'bg-muted/50'}`} />
          <span className="truncate max-w-[12rem] sm:max-w-[18rem]">{statusLabel}</span>
        </Link>
      </div>
    </header>
  );
};
