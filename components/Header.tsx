'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, Moon, Compass } from 'lucide-react';
import { LMStudioStatus } from '@/lib/types';

type NavSection = 'scanner' | 'diff' | 'checks' | 'settings';
type ThemeId = 'atelier' | 'nordic' | 'starlight';

export function completeQuestStep(_step?: string | number) {
  // No-op when Field Quest sub-bar is hidden in classic layout
}

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<LMStudioStatus | null | undefined>(undefined);
  const [activeSection, setActiveSection] = useState<NavSection>('scanner');
  const [theme, setTheme] = useState<ThemeId>('atelier');
  const clickLockUntil = useRef<number>(0);

  useEffect(() => {
    let active = true;
    const check = () =>
      fetch('/api/lmstudio/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => active && setStatus(data))
        .catch(() => active && setStatus(null));

    check();
    const id = setInterval(check, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('docdrift-theme') as ThemeId | null;
      if (savedTheme && ['atelier', 'nordic', 'starlight'].includes(savedTheme)) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'atelier');
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'atelier');
    }
  }, []);

  const handleSelectTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('docdrift-theme', nextTheme);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (pathname === '/settings') {
      setActiveSection('settings');
      return;
    }

    const computeActiveFromScroll = () => {
      if (Date.now() < clickLockUntil.current) return;

      const checksEl = document.getElementById('audit-checks');
      const diffEl = document.getElementById('diff-workspace');
      const triggerY = Math.min(260, window.innerHeight * 0.35);

      const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40;
      if (scrolledToBottom && checksEl) {
        setActiveSection('checks');
        return;
      }

      if (checksEl) {
        const rect = checksEl.getBoundingClientRect();
        if (rect.top <= triggerY) {
          setActiveSection('checks');
          return;
        }
      }

      if (diffEl) {
        const rect = diffEl.getBoundingClientRect();
        if (rect.top <= triggerY) {
          setActiveSection('diff');
          return;
        }
      }

      setActiveSection('scanner');
    };

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#diff-workspace') {
        setActiveSection('diff');
      } else if (hash === '#audit-checks') {
        setActiveSection('checks');
      } else if (hash === '#scanner-top' || hash === '') {
        computeActiveFromScroll();
      }
    };

    handleHashChange();
    window.addEventListener('scroll', computeActiveFromScroll, { passive: true });
    window.addEventListener('resize', computeActiveFromScroll, { passive: true });
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('scroll', computeActiveFromScroll);
      window.removeEventListener('resize', computeActiveFromScroll);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [pathname]);

  const handleSectionClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    section: NavSection,
    targetId: string
  ) => {
    if (pathname !== '/') {
      setActiveSection(section);
      return;
    }

    e.preventDefault();
    clickLockUntil.current = Date.now() + 750;
    setActiveSection(section);

    if (targetId === 'scanner-top') {
      window.history.replaceState(null, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.history.replaceState(null, '', `/#${targetId}`);
    const el = document.getElementById(targetId);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 76;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      router.push(`/#${targetId}`);
    }
  };

  const connected = !!status?.connected;
  const statusLabel =
    status === undefined ? 'Checking model…' : connected ? status!.model : 'Model offline';

  const navLinkClass = (section: NavSection) => {
    const isActive = pathname === '/settings' ? section === 'settings' : activeSection === section;
    return `relative rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 ${
      isActive
        ? 'bg-accent text-white font-semibold shadow-sm'
        : 'text-muted hover:text-fg hover:bg-surface'
    }`;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={(e) => handleSectionClick(e, 'scanner', 'scanner-top')}
          className="flex items-center gap-2 text-base font-extrabold tracking-tight text-fg whitespace-nowrap shrink-0"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded border border-line bg-surface font-mono text-xs font-bold text-accent shadow-sm">
            §
          </span>
          <span>DocDrift</span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
          <a
            href="/#scanner-top"
            aria-current={pathname === '/' && activeSection === 'scanner' ? 'page' : undefined}
            onClick={(e) => handleSectionClick(e, 'scanner', 'scanner-top')}
            className={navLinkClass('scanner')}
          >
            Scanner
          </a>
          <a
            href="/#diff-workspace"
            aria-current={pathname === '/' && activeSection === 'diff' ? 'page' : undefined}
            onClick={(e) => handleSectionClick(e, 'diff', 'diff-workspace')}
            className={navLinkClass('diff')}
          >
            Diff Viewer
          </a>
          <a
            href="/#audit-checks"
            aria-current={pathname === '/' && activeSection === 'checks' ? 'page' : undefined}
            onClick={(e) => handleSectionClick(e, 'checks', 'audit-checks')}
            className={navLinkClass('checks')}
          >
            Audit Checks
          </a>
          <Link
            href="/settings"
            aria-current={pathname === '/settings' ? 'page' : undefined}
            onClick={() => setActiveSection('settings')}
            className={navLinkClass('settings')}
          >
            Settings
          </Link>
        </nav>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {/* 3-Theme Switcher (Atelier | Nordic | Starlight) */}
          <div
            role="group"
            aria-label="Color Theme Switcher"
            className="flex items-center rounded-md border border-line bg-surface p-0.5 text-[11px] font-mono"
          >
            <button
              type="button"
              onClick={() => handleSelectTheme('atelier')}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                theme === 'atelier'
                  ? 'bg-accent text-white font-semibold'
                  : 'text-muted hover:text-fg'
              }`}
              title="Atelier Paper (Warm Architectural Default)"
            >
              <Compass className="h-3 w-3" />
              Atelier
            </button>
            <button
              type="button"
              onClick={() => handleSelectTheme('nordic')}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                theme === 'nordic'
                  ? 'bg-accent text-white font-semibold'
                  : 'text-muted hover:text-fg'
              }`}
              title="Nordic Studio (Crisp Daylight)"
            >
              <Sun className="h-3 w-3" />
              Nordic
            </button>
            <button
              type="button"
              onClick={() => handleSelectTheme('starlight')}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                theme === 'starlight'
                  ? 'bg-accent text-white font-semibold'
                  : 'text-muted hover:text-fg'
              }`}
              title="Starlight Observatory (Warm Scholarly Dark)"
            >
              <Moon className="h-3 w-3" />
              Starlight
            </button>
          </div>

          <Link
            href="/settings"
            className="btn-keycap px-2.5 py-1 text-xs font-mono whitespace-nowrap shrink-0"
            title={
              connected
                ? `Connected to ${status!.endpoint}`
                : status?.error || 'LM Studio is not connected'
            }
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                connected ? 'bg-ok' : 'bg-muted/50'
              }`}
            />
            <span className="truncate max-w-[9rem] sm:max-w-[11rem]">{statusLabel}</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
