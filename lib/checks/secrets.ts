import { DriftItem, DriftSeverity } from '../types';
import { makeDrift } from './common';

interface SecretPattern {
  name: string;
  placeholder: string;
  severity: DriftSeverity;
  regex: RegExp;
}

// Provider formats are specific enough to treat any match as a real credential.
const PROVIDER_PATTERNS: SecretPattern[] = [
  { name: 'AWS access key', placeholder: '<AWS_ACCESS_KEY_ID>', severity: 'CRITICAL', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'GitHub token', placeholder: '<GITHUB_TOKEN>', severity: 'CRITICAL', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { name: 'Slack token', placeholder: '<SLACK_TOKEN>', severity: 'CRITICAL', regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'Stripe live key', placeholder: '<STRIPE_SECRET_KEY>', severity: 'CRITICAL', regex: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/g },
  { name: 'Anthropic API key', placeholder: '<ANTHROPIC_API_KEY>', severity: 'CRITICAL', regex: /\bsk-ant-[A-Za-z0-9_-]{32,}/g },
  { name: 'OpenAI API key', placeholder: '<OPENAI_API_KEY>', severity: 'CRITICAL', regex: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { name: 'Google API key', placeholder: '<GOOGLE_API_KEY>', severity: 'CRITICAL', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'private key', placeholder: '<PRIVATE_KEY>', severity: 'CRITICAL', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: 'JSON Web Token', placeholder: '<JWT>', severity: 'HIGH', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

// NAME=value / name: "value" where the name says it is a credential
const ASSIGNMENT = /\b([A-Za-z0-9_]*(?:api[_-]?key|secret|token|password|passwd|access[_-]?key)[A-Za-z0-9_]*)\s*[=:]\s*["']?([^\s"'`,;]{8,})/gi;
const PLACEHOLDER = /^(<.*>|\$\{?[\w.]+\}?|%[\w]+%|\{\{.*\}\}|x{3,}|\*{3,}|\.{3})$|your|example|changeme|placeholder|dummy|sample|redacted|replace|insert|here|xxxx/i;

function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return Array.from(counts.values()).reduce((sum, n) => sum - (n / value.length) * Math.log2(n / value.length), 0);
}

function looksLikeRealSecret(value: string): boolean {
  if (PLACEHOLDER.test(value)) return false;
  if (!/[0-9]/.test(value) || !/[A-Za-z]/.test(value)) return false;
  return entropy(value) >= 3;
}

const mask = (secret: string) => (secret.length <= 8 ? '****' : `${secret.slice(0, 4)}…${secret.slice(-2)}`);

export function findSecrets(readme: string, readmeFile: string): DriftItem[] {
  const drifts: DriftItem[] = [];
  const found = new Set<string>();
  const lines = readme.split('\n');

  const report = (secret: string, kind: string, placeholder: string, severity: DriftSeverity, lineIndex: number) => {
    if (found.has(secret)) return;
    found.add(secret);
    const line = lines[lineIndex];
    drifts.push(
      makeDrift({
        id: `secret-${drifts.length + 1}`,
        title: `Possible ${kind} committed in the README`,
        category: 'SECRET_LEAK',
        severity,
        docFile: readmeFile,
        docLineRange: `L${lineIndex + 1}`,
        docSnippet: line.split(secret).join(mask(secret)).trim(),
        codeSnippet: 'Removing it from the README does not revoke it. Rotate the credential with its provider.',
        explanation: `Line ${lineIndex + 1} contains what looks like a real ${kind}. Anyone reading the docs (or the git history) can use it.`,
        newcomerImpact: 'Contributors may copy a live credential into their own setup, and attackers can harvest it.',
        suggestedDocFix: line.split(secret).join(placeholder).trim(),
        fixes: [{ type: 'replace', find: secret, replace: placeholder }],
      })
    );
  };

  lines.forEach((line, i) => {
    for (const pattern of PROVIDER_PATTERNS) {
      for (const m of Array.from(line.matchAll(pattern.regex))) report(m[0], pattern.name, pattern.placeholder, pattern.severity, i);
    }
    for (const m of Array.from(line.matchAll(ASSIGNMENT))) {
      const value = m[2];
      if (Array.from(found).some((s) => s.includes(value) || value.includes(s))) continue;
      if (looksLikeRealSecret(value)) report(value, 'credential', `<${m[1].toUpperCase().replace(/-/g, '_')}>`, 'HIGH', i);
    }
  });

  return drifts;
}
