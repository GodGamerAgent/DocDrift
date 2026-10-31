'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LMStudioStatus } from '@/lib/types';
import { BooleanKey, EngineMode, NUMBER_LIMITS, SETTINGS_SAVED_EVENT, Settings } from '@/lib/settingsSchema';

type NumberKey = keyof typeof NUMBER_LIMITS;

const ENGINE_LABELS: Record<EngineMode, string> = {
  auto: 'Auto: model, falling back to rules',
  model: 'Model only',
  rules: 'Rules only (no model)',
};

const Section: React.FC<{ code: string; title: string; description: string; children: React.ReactNode }> = ({
  code,
  title,
  description,
  children,
}) => (
  <section className="card-3d p-6">
    <div className="font-mono text-[11px] text-muted">{code}</div>
    <h2 className="mt-0.5 text-base font-bold text-fg">{title}</h2>
    <p className="hint mt-0.5">{description}</p>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; hint?: string; htmlFor: string; wide?: boolean; children: React.ReactNode }> = ({
  label,
  hint,
  htmlFor,
  wide,
  children,
}) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <label htmlFor={htmlFor} className="label mb-1.5">
      {label}
    </label>
    {children}
    {hint && <p className="hint mt-1">{hint}</p>}
  </div>
);

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [status, setStatus] = useState<LMStudioStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [github, setGithub] = useState<{ connected: boolean; login?: string; source?: string; error?: string } | null>(null);

  const checkConnection = async () => {
    setTesting(true);
    try {
      setStatus(await fetch('/api/lmstudio/status').then((r) => r.json()));
    } catch {
      setStatus(null);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings);
        setSaved(data.settings);
        setDefaults(data.defaults);
      })
      .catch(() => setMessage({ kind: 'error', text: 'Could not load settings.' }));
    checkConnection();
    fetch('/api/github/status')
      .then((r) => r.json())
      .then(setGithub)
      .catch(() => setGithub({ connected: false, error: 'Could not check GitHub login.' }));
  }, []);

  if (!settings || !saved || !defaults) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
    setMessage(null);
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: 'error', text: (data.errors || ['Could not save settings']).join('. ') });
        return false;
      }
      setSettings(data.settings);
      setSaved(data.settings);
      setMessage({ kind: 'ok', text: 'Settings saved.' });
      window.dispatchEvent(new Event(SETTINGS_SAVED_EVENT));
      return true;
    } catch {
      setMessage({ kind: 'error', text: 'Could not save settings.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (dirty && !(await save())) return;
    await checkConnection();
  };

  const numberInput = (key: NumberKey, unit?: string) => (
    <div className="flex items-center gap-2">
      <input
        id={key}
        type="number"
        className="input tabular-nums"
        min={NUMBER_LIMITS[key].min}
        max={NUMBER_LIMITS[key].max}
        step={NUMBER_LIMITS[key].step}
        value={Number.isFinite(settings[key]) ? settings[key] : ''}
        onChange={(e) => update(key, e.target.valueAsNumber)}
      />
      {unit && <span className="hint shrink-0">{unit}</span>}
    </div>
  );

  const toggle = (key: BooleanKey, label: string, hint: string) => (
    <label className="depth-well flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-bg p-3.5 transition-colors hover:border-accent sm:col-span-2">
      <span className="min-w-0">
        <span className="label">{label}</span>
        <span className="hint mt-0.5 block">{hint}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0 pt-0.5">
        <span className={`font-mono text-xs font-bold ${settings[key] ? 'text-ok' : 'text-muted'}`}>
          {settings[key] ? 'ON' : 'OFF'}
        </span>
        <input
          id={key}
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded accent-accent"
          checked={settings[key]}
          onChange={(e) => update(key, e.target.checked)}
        />
      </span>
    </label>
  );

  const engineSelect = (key: 'analysisMode' | 'remediationMode') => (
    <select id={key} className="input" value={settings[key]} onChange={(e) => update(key, e.target.value as EngineMode)}>
      {(Object.keys(ENGINE_LABELS) as EngineMode[]).map((mode) => (
        <option key={mode} value={mode}>
          {ENGINE_LABELS[mode]}
        </option>
      ))}
    </select>
  );

  const promptInput = (key: 'analysisPrompt' | 'remediationPrompt') => (
    <>
      <textarea
        id={key}
        rows={8}
        className="input font-mono text-xs leading-relaxed"
        value={settings[key]}
        onChange={(e) => update(key, e.target.value)}
      />
      {settings[key] !== defaults[key] && (
        <button className="mt-1 text-xs font-semibold text-accent hover:underline" onClick={() => update(key, defaults[key])}>
          Restore default prompt
        </button>
      )}
    </>
  );

  const chatModels = (status?.availableModels || []).filter((id) => !/embed/i.test(id));
  const modelOptions = Array.from(new Set([...chatModels, ...(settings.model ? [settings.model] : [])]));

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Settings &amp; Feature Controls</h1>
        <p className="mt-1 text-sm text-muted">Toggle individual DocDrift features on or off and configure your model connection.</p>
      </div>

      <Section
        code="[§01 // FEATURE_&_AUDITOR_TOGGLES]"
        title="Feature & Audit Check Toggles"
        description="Enable or disable individual UI workspaces and rule-based auditors across every repository scan."
      >
        {toggle(
          'enableDiffViewer',
          'Interactive Side-by-Side Diff Viewer',
          'GitHub-style split screen showing outdated sections in red and proposed fixes in green, with one-click line-by-line accept/reject toggles.'
        )}
        {toggle(
          'enableContextTooltips',
          'Context Tooltips ("Why it Changed")',
          'Hover notes over fixes citing the exact source file and line number that triggered the update (e.g., auth.py:42).'
        )}
        {toggle(
          'checkCliFlags',
          'CLI Flag & Argument Auditor',
          'Detects removed, renamed, or newly added terminal flags and updates the ## Usage docs.'
        )}
        {toggle(
          'checkLinks',
          'Dead Link & Broken Badge Scanner',
          'Flags 404 links, broken image assets, outdated Discord invites, and failed status badges.'
        )}
        <Field label="Max external links checked" htmlFor="maxLinksToCheck">
          {numberInput('maxLinksToCheck', 'links')}
        </Field>
        <Field label="Link timeout" htmlFor="linkTimeoutSec">
          {numberInput('linkTimeoutSec', 'seconds')}
        </Field>
        {toggle(
          'checkSecrets',
          'Secret Leak Detector',
          'Catches hardcoded API keys, tokens, or private keys pasted into documentation examples.'
        )}
        {toggle(
          'checkLicense',
          'License Mismatch Detector',
          'Ensures the license named in the README matches the root LICENSE file.'
        )}
        {toggle(
          'enableGithubPr',
          'One-Click GitHub PR Creator',
          'Connects to GitHub to push accepted updates directly to a new branch and open a ready-to-merge Pull Request.'
        )}
      </Section>

      <Section
        code="[§02 // MODEL_INFERENCE_BRIDGE]"
        title="Model connection (LM Studio & Gemma 4 Cloud Bridge)"
        description="Connects to LM Studio locally when running, and automatically uses Gemma 4 (gemma-4-26b-a4b-it) for testing when LM Studio is offline."
      >
        <Field label="LM Studio endpoint" htmlFor="lmStudioEndpoint" wide>
          <input
            id="lmStudioEndpoint"
            className="input font-mono"
            value={settings.lmStudioEndpoint}
            onChange={(e) => update('lmStudioEndpoint', e.target.value)}
            placeholder="http://localhost:1234/v1"
          />
        </Field>

        <div className="sm:col-span-2 depth-well flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status?.connected ? 'bg-ok' : 'bg-muted/50'}`} />
            <span className="truncate font-mono text-xs tabular-nums text-fg">
              {testing
                ? 'Checking…'
                : status?.connected
                ? `Connected (${status.model}) · ${status.latencyMs} ms · ${chatModels.length} model${chatModels.length === 1 ? '' : 's'}`
                : status?.error || 'Not connected'}
            </span>
          </span>
          <button className="btn-keycap text-xs" onClick={testConnection} disabled={testing || saving}>
            {dirty ? 'Save & test' : 'Test connection'}
          </button>
        </div>

        <Field label="Model" htmlFor="model" hint="Auto picks Gemma 4 (gemma-4-26b-a4b-it) or the first Gemma model LM Studio lists.">
          <select id="model" className="input font-mono text-xs" value={settings.model} onChange={(e) => update('model', e.target.value)}>
            <option value="">Auto (gemma-4-26b-a4b-it)</option>
            {modelOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Request timeout" htmlFor="requestTimeoutSec" hint="Per model call. Local 12B models can need minutes.">
          {numberInput('requestTimeoutSec', 'seconds')}
        </Field>
        <Field label="Temperature" htmlFor="temperature" hint="Lower is more deterministic.">
          {numberInput('temperature')}
        </Field>
      </Section>

      <Section code="[§03 // DRIFT_ANALYSIS_ENGINE]" title="Drift analysis" description="How the README is compared with the code.">
        <Field label="Engine" htmlFor="analysisMode" hint="Model only shows an error instead of falling back." wide>
          {engineSelect('analysisMode')}
        </Field>
        <Field label="Max output tokens" htmlFor="analysisMaxTokens" hint="Includes reasoning tokens on thinking models.">
          {numberInput('analysisMaxTokens', 'tokens')}
        </Field>
        <Field label="README sent to model" htmlFor="readmeCharsForAnalysis">
          {numberInput('readmeCharsForAnalysis', 'characters')}
        </Field>
        <Field label="Source files sent to model" htmlFor="filesForAnalysis" hint="Most relevant files first.">
          {numberInput('filesForAnalysis', 'files')}
        </Field>
        <Field label="Characters per file" htmlFor="charsPerFile">
          {numberInput('charsPerFile', 'characters')}
        </Field>
        <Field label="System prompt" htmlFor="analysisPrompt" wide>
          {promptInput('analysisPrompt')}
        </Field>
      </Section>

      <Section code="[§04 // README_REMEDIATION]" title="README patch" description="How the fixed README is produced.">
        <Field
          label="Engine"
          htmlFor="remediationMode"
          hint="Rules apply mechanical fixes for CLI flags (## Usage), secrets, licenses, and environment variables."
          wide
        >
          {engineSelect('remediationMode')}
        </Field>
        <Field label="Max output tokens" htmlFor="remediationMaxTokens">
          {numberInput('remediationMaxTokens', 'tokens')}
        </Field>
        <Field label="Largest README to rewrite" htmlFor="maxReadmeCharsForRewrite" hint="Bigger READMEs use rules.">
          {numberInput('maxReadmeCharsForRewrite', 'characters')}
        </Field>
        <Field label="System prompt" htmlFor="remediationPrompt" wide>
          {promptInput('remediationPrompt')}
        </Field>
      </Section>

      <Section code="[§05 // REPOSITORY_CLONE_LIMITS]" title="Repository scanning" description="Limits for cloning and reading a repository.">
        <Field label="Clone timeout" htmlFor="cloneTimeoutSec">
          {numberInput('cloneTimeoutSec', 'seconds')}
        </Field>
        <Field label="Folder depth" htmlFor="maxScanDepth">
          {numberInput('maxScanDepth', 'levels')}
        </Field>
        <Field label="Max code files read" htmlFor="maxCodeFiles">
          {numberInput('maxCodeFiles', 'files')}
        </Field>
        <Field label="Skip files larger than" htmlFor="maxFileSizeKb">
          {numberInput('maxFileSizeKb', 'KB')}
        </Field>
      </Section>

      <section className="card-3d p-6">
        <div className="font-mono text-[11px] text-muted">[§06 // GITHUB_PR_AUTH]</div>
        <h2 className="mt-0.5 text-base font-bold text-fg">GitHub</h2>
        <p className="hint mt-0.5">Used to open pull requests. DocDrift never stores a token.</p>
        <div className="mt-4 depth-well flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-3 text-sm">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${github?.connected ? 'bg-ok' : 'bg-muted/50'}`} />
          <span className="text-fg">
            {!github
              ? 'Checking…'
              : github.connected
              ? `Signed in as ${github.login} via ${github.source}`
              : github.error}
          </span>
        </div>
        <p className="hint mt-2">
          Uses the <code className="font-mono">GITHUB_TOKEN</code> environment variable if set, otherwise your{' '}
          <code className="font-mono">gh auth login</code> session. Without push access, the pull request is opened from
          your fork.
        </p>
      </section>

      <div className="flex justify-start">
        <button
          className="btn-keycap text-xs"
          onClick={() => {
            setSettings(defaults);
            setMessage(null);
          }}
        >
          Reset all to defaults
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <p className={`text-sm font-semibold ${message?.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
            {message?.text || (dirty ? 'Unsaved changes' : 'All changes saved')}
          </p>
          <div className="flex shrink-0 gap-2">
            <button className="btn-keycap" onClick={() => setSettings(saved)} disabled={!dirty || saving}>
              Discard
            </button>
            <button className="btn-keycap btn-keycap-primary" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
