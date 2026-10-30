'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LMStudioStatus } from '@/lib/types';
import { EngineMode, NUMBER_LIMITS, SETTINGS_SAVED_EVENT, Settings } from '@/lib/settingsSchema';

type NumberKey = keyof typeof NUMBER_LIMITS;

const ENGINE_LABELS: Record<EngineMode, string> = {
  auto: 'Auto: model, falling back to rules',
  model: 'Model only',
  rules: 'Rules only (no model)',
};

const Section: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="card p-5">
    <h2 className="font-medium">{title}</h2>
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

  const toggle = (key: 'checkCliFlags' | 'checkLinks' | 'checkSecrets' | 'checkLicense', label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
      <input
        id={key}
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-fg"
        checked={settings[key]}
        onChange={(e) => update(key, e.target.checked)}
      />
      <span>
        <span className="label">{label}</span>
        <span className="hint mt-0.5 block">{hint}</span>
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
        <button className="mt-1 text-xs text-accent hover:underline" onClick={() => update(key, defaults[key])}>
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
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Saved on this machine and used for every scan.</p>
      </div>

      <Section title="Model connection" description="DocDrift talks to LM Studio's OpenAI-compatible local server.">
        <Field label="LM Studio endpoint" htmlFor="lmStudioEndpoint" wide>
          <input
            id="lmStudioEndpoint"
            className="input font-mono"
            value={settings.lmStudioEndpoint}
            onChange={(e) => update('lmStudioEndpoint', e.target.value)}
            placeholder="http://localhost:1234/v1"
          />
        </Field>

        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg px-3 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${status?.connected ? 'bg-ok' : 'bg-muted/50'}`} />
            <span className="truncate">
              {testing
                ? 'Checking…'
                : status?.connected
                ? `Connected · ${status.latencyMs} ms · ${chatModels.length} model${chatModels.length === 1 ? '' : 's'}`
                : status?.error || 'Not connected'}
            </span>
          </span>
          <button className="btn" onClick={testConnection} disabled={testing || saving}>
            {dirty ? 'Save & test' : 'Test connection'}
          </button>
        </div>

        <Field label="Model" htmlFor="model" hint="Auto picks the first Gemma model LM Studio lists.">
          <select id="model" className="input" value={settings.model} onChange={(e) => update('model', e.target.value)}>
            <option value="">Auto</option>
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

      <Section title="Drift analysis" description="How the README is compared with the code.">
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

      <Section title="README patch" description="How the fixed README is produced.">
        <Field label="Engine" htmlFor="remediationMode" hint="Rules can only add missing environment variables." wide>
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

      <Section title="Repository scanning" description="Limits for cloning and reading a repository.">
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

      <Section title="Extra checks" description="Rule-based checks that run on every scan, alongside the drift analysis.">
        {toggle('checkCliFlags', 'CLI flags', 'Removed, renamed, required and undocumented flags, with fixes for the Usage section.')}
        {toggle('checkLinks', 'Links and badges', 'Dead links, missing files and images, expired Discord invites, failing status badges.')}
        <Field label="Max external links checked" htmlFor="maxLinksToCheck">
          {numberInput('maxLinksToCheck', 'links')}
        </Field>
        <Field label="Link timeout" htmlFor="linkTimeoutSec">
          {numberInput('linkTimeoutSec', 'seconds')}
        </Field>
        {toggle('checkSecrets', 'Secrets', 'API keys, tokens and private keys pasted into the README.')}
        {toggle('checkLicense', 'License', 'License named in the README matches the LICENSE file.')}
      </Section>

      <section className="card p-5">
        <h2 className="font-medium">GitHub</h2>
        <p className="hint mt-0.5">Used to open pull requests. DocDrift never stores a token.</p>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-2.5 text-sm">
          <span className={`h-2 w-2 shrink-0 rounded-full ${github?.connected ? 'bg-ok' : 'bg-muted/50'}`} />
          <span>
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

      <details className="card p-5 text-sm">
        <summary className="cursor-pointer font-medium">Setting up LM Studio</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          <li>Download a Gemma model in LM Studio (a 4-bit 12B build fits in 16 GB of RAM).</li>
          <li>
            Load it with a <span className="text-fg">context length of 16384 or more</span>. Smaller contexts fail with
            &ldquo;Context size has been exceeded&rdquo;.
          </li>
          <li>
            Open the Developer tab and start the server (default <code className="font-mono">http://localhost:1234/v1</code>).
          </li>
          <li>Run one scan at a time: parallel requests share the model&apos;s context.</li>
        </ol>
      </details>

      <div className="flex justify-start">
        <button
          className="text-sm text-muted hover:text-fg"
          onClick={() => {
            setSettings(defaults);
            setMessage(null);
          }}
        >
          Reset all to defaults
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <p className={`text-sm ${message?.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
            {message?.text || (dirty ? 'Unsaved changes' : 'All changes saved')}
          </p>
          <div className="flex shrink-0 gap-2">
            <button className="btn" onClick={() => setSettings(saved)} disabled={!dirty || saving}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
