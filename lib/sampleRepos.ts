import { DriftItem } from './types';

export interface SampleRepo {
  id: string;
  name: string;
  description: string;
  techStack: string;
  tags: string[];
  readmeContent: string;
  // README after applying every expected drift fix (used for the remediation diff)
  fixedReadmeContent: string;
  // API Documentation (docs/api.md) content and expected drifts
  apiDocFile: string;
  apiDocContent: string;
  fixedApiDocContent: string;
  expectedApiDrifts: DriftItem[];
  codeFiles: Record<string, string>;
  expectedDrifts: DriftItem[];
}

export const SAMPLE_REPOS: Record<string, SampleRepo> = {
  'deployx-cli': {
    id: 'deployx-cli',
    name: 'deployx-cloud/deployx-cli',
    description: 'Modern CLI tool & REST control-plane for deploying multi-cloud microservices. Drifted CLI arguments and REST API endpoints.',
    techStack: 'TypeScript · Node.js · Commander · Express',
    tags: ['CLI Flags', 'REST API v2', 'Breaking Changes', 'New Contributor Blocker'],
    readmeContent: `# DeployX CLI 🚀
The ultra-fast zero-configuration multi-cloud deployment agent.

## Quickstart

Install the CLI tool:
\`\`\`bash
npm install -g deployx-cli
\`\`\`

### Deploying a Service
Run the following command from your root directory:
\`\`\`bash
deployx push --env production --port 8080 --key-file ./keys/prod.pem
\`\`\`

### Environment Setup
Set your access token:
\`\`\`bash
export DEPLOYX_TOKEN="dx_live_99214"
\`\`\`

### Local Development Preview
\`\`\`bash
deployx preview --local-port 3000
\`\`\`
`,
    fixedReadmeContent: `# DeployX CLI 🚀
The ultra-fast zero-configuration multi-cloud deployment agent.

## Quickstart

Install the CLI tool:
\`\`\`bash
npm install -g deployx-cli
\`\`\`

### Deploying a Service
Run the following command from your root directory:
\`\`\`bash
deployx push --env production --region us-east-1 --listen-addr 0.0.0.0:8080 --credentials-file ./keys/prod.pem
\`\`\`

### Environment Setup
Set your access token:
\`\`\`bash
export DEPLOYX_TOKEN="dx_live_99214"
\`\`\`

### Local Development Preview
\`\`\`bash
deployx preview --preview-port 3000
\`\`\`
`,
    apiDocFile: 'docs/api.md',
    apiDocContent: `# DeployX Control-Plane REST & SDK API
[![OpenAPI Spec](https://img.shields.io/badge/OpenAPI-3.0_failing-red)](https://api.deployx-internal.invalid/openapi.json)

Programmatic HTTP endpoints and TypeScript SDK for triggering multi-cloud deployments.

## Endpoints

### Trigger Deployment
\`\`\`http
POST /api/v1/deploy
\`\`\`

Deploy a container image to a target cluster:
\`\`\`bash
curl -X POST https://api.deployx.io/api/v1/deploy \\
  -H "Authorization: Bearer ghp_99887766554433221100abcdefghijklmnoPQR" \\
  -d '{"service": "billing-api", "env": "production", "port": 8080}'
\`\`\`

### Check Cluster Status
\`\`\`http
GET /api/v1/status
\`\`\`

## SDK Signatures

\`\`\`ts
import { triggerDeployment } from 'deployx-cli/sdk';

await triggerDeployment(serviceName, env, port);
\`\`\`
`,
    fixedApiDocContent: `# DeployX Control-Plane REST & SDK API
[![OpenAPI Spec](https://img.shields.io/badge/OpenAPI-3.1_passing-brightgreen)](./docs/openapi.yaml)

Programmatic HTTP endpoints and TypeScript SDK for triggering multi-cloud deployments.

## Endpoints

### Trigger Deployment
\`\`\`http
POST /api/v2/deployments
\`\`\`

Deploy a container image to a target cluster:
\`\`\`bash
curl -X POST https://api.deployx.io/api/v2/deployments \\
  -H "Authorization: Bearer <DEPLOYX_API_TOKEN>" \\
  -d '{"service": "billing-api", "env": "production", "region": "us-east-1", "listenAddr": "0.0.0.0:8080"}'
\`\`\`

### Check Cluster Status
\`\`\`http
GET /api/v2/clusters/health
\`\`\`

- \`POST /api/v2/rollbacks\` — registered in \`src/api.ts:28\`

## SDK Signatures

\`\`\`ts
import { triggerDeployment } from 'deployx-cli/sdk';

await triggerDeployment(serviceName, env, region, listenAddr);
\`\`\`
`,
    codeFiles: {
      'src/cli.ts': `import { Command } from 'commander';

const program = new Command();

program
  .name('deployx')
  .description('Deploy services to cloud infrastructure')
  .version('2.4.0');

// BREAKING CHANGE IN v2.0:
// --port was deprecated and removed in favor of --listen-addr
// --key-file was renamed to --credentials-file
// --region is now MANDATORY for production environments
program
  .command('push')
  .description('Deploy service to cloud cluster')
  .requiredOption('--env <environment>', 'Target environment (production, staging, dev)')
  .requiredOption('--region <region>', 'Target cloud region (e.g. us-east-1, ap-south-1)')
  .option('--listen-addr <address>', 'Server bind address:port (e.g. 0.0.0.0:8080)', '0.0.0.0:8080')
  .option('--credentials-file <path>', 'Path to authentication credentials JSON/PEM')
  .action((options) => {
    if (options.port) {
      console.error('ERROR: --port has been removed. Use --listen-addr instead.');
      process.exit(1);
    }
    if (options.env === 'production' && !options.region) {
      console.error('ERROR: --region is required when --env is production.');
      process.exit(1);
    }
    console.log('Deploying service with options:', options);
  });

program
  .command('preview')
  .description('Local preview daemon')
  .option('--preview-port <number>', 'Local preview port', '4000')
  .action((opts) => {
    console.log('Preview server starting on port', opts.previewPort);
  });

program.parse(process.argv);
`,
      'src/api.ts': `import express from 'express';

export const app = express();
app.use(express.json());

// BREAKING CHANGE IN v2.4:
// POST /api/v1/deploy moved to POST /api/v2/deployments and requires 'region' + 'listenAddr'
app.post('/api/v2/deployments', (req, res) => {
  const { service, env, region, listenAddr = '0.0.0.0:8080' } = req.body;
  if (env === 'production' && !region) {
    return res.status(400).json({ error: 'region is required for production deployments' });
  }
  return res.status(201).json({ status: 'queued', service, env, region, listenAddr });
});

// GET /api/v1/status was replaced by GET /api/v2/clusters/health
app.get('/api/v2/clusters/health', (_req, res) => {
  return res.json({ healthy: true, version: '2.4.0' });
});

// New endpoint in v2.4 for instant deployment rollbacks
app.post('/api/v2/rollbacks', (req, res) => {
  return res.json({ rolledBack: true, deploymentId: req.body.deploymentId });
});

export async function triggerDeployment(
  serviceName: string,
  env: string,
  region: string,
  listenAddr = '0.0.0.0:8080'
) {
  return { serviceName, env, region, listenAddr };
}
`,
      'package.json': `{
  "name": "deployx-cli",
  "version": "2.4.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "commander": "^12.0.0"
  }
}`,
    },
    expectedDrifts: [
      {
        id: 'drift-1',
        title: 'Deprecated CLI Flag `--port` Removed from Code',
        category: 'CLI_FLAG',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L13-L15',
        codeFile: 'src/cli.ts',
        codeLineRange: 'L18-L23',
        docSnippet: 'deployx push --env production --port 8080 --key-file ./keys/prod.pem',
        codeSnippet: ".option('--listen-addr <address>', 'Server bind address:port', '0.0.0.0:8080')",
        explanation:
          'README instructs users to pass `--port 8080`, but the code in `src/cli.ts` removed `--port` and replaced it with `--listen-addr`. Running the README command throws an immediate CLI error and exits.',
        newcomerImpact:
          '100% of first-time users running the Quickstart will encounter `error: unknown option --port` and fail to deploy.',
        suggestedDocFix:
          'deployx push --env production --region us-east-1 --listen-addr 0.0.0.0:8080 --credentials-file ./keys/prod.pem',
        resolved: false,
      },
      {
        id: 'drift-2',
        title: 'Missing Mandatory `--region` Flag in Quickstart',
        category: 'CLI_FLAG',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L13-L15',
        codeFile: 'src/cli.ts',
        codeLineRange: 'L16-L17',
        docSnippet: 'deployx push --env production --port 8080',
        codeSnippet: ".requiredOption('--region <region>', 'Target cloud region')",
        explanation:
          "The code enforces `requiredOption('--region <region>')` when target environment is `production`, but the README completely omits this parameter.",
        newcomerImpact: 'Command fails with `error: required option --region <region> not specified`.',
        suggestedDocFix: 'deployx push --env production --region us-east-1 ...',
        resolved: false,
      },
      {
        id: 'drift-3',
        title: 'Renamed Parameter `--key-file` to `--credentials-file`',
        category: 'CLI_FLAG',
        severity: 'HIGH',
        docFile: 'README.md',
        docLineRange: 'L13-L15',
        codeFile: 'src/cli.ts',
        codeLineRange: 'L19-L20',
        docSnippet: '--key-file ./keys/prod.pem',
        codeSnippet: ".option('--credentials-file <path>', 'Path to authentication credentials JSON/PEM')",
        explanation:
          'Option `--key-file` was refactored to `--credentials-file` in the v2.4 rewrite, but README still mentions the old flag name.',
        newcomerImpact: 'Credentials are not parsed, leading to mysterious unauthorized errors.',
        suggestedDocFix: '--credentials-file ./keys/prod.pem',
        resolved: false,
      },
      {
        id: 'drift-4',
        title: 'Preview Flag Renamed `--local-port` to `--preview-port`',
        category: 'CLI_FLAG',
        severity: 'MEDIUM',
        docFile: 'README.md',
        docLineRange: 'L24-L26',
        codeFile: 'src/cli.ts',
        codeLineRange: 'L33-L37',
        docSnippet: 'deployx preview --local-port 3000',
        codeSnippet: ".option('--preview-port <number>', 'Local preview port', '4000')",
        explanation:
          'Local preview command option changed from `--local-port` to `--preview-port`. Passing `--local-port` is silently ignored or rejected.',
        newcomerImpact: 'User expects custom port 3000 but server boots on default 4000.',
        suggestedDocFix: 'deployx preview --preview-port 3000',
        resolved: false,
      },
    ],
    expectedApiDrifts: [
      {
        id: 'deployx-api-1',
        title: 'REST Endpoint `POST /api/v1/deploy` moved to `POST /api/v2/deployments` in `src/api.ts`',
        category: 'API_ENDPOINT',
        severity: 'CRITICAL',
        docFile: 'docs/api.md',
        docLineRange: 'L9-L17',
        codeFile: 'src/api.ts',
        codeLineRange: 'L8',
        docSnippet: 'POST /api/v1/deploy\n-d \'{"service": "billing-api", "env": "production", "port": 8080}\'',
        codeSnippet: "app.post('/api/v2/deployments', (req, res) => { const { service, env, region, listenAddr } = req.body; })",
        explanation:
          'In `src/api.ts:8`, the v1 deployment endpoint was replaced by `POST /api/v2/deployments` and the JSON payload now requires `region` and `listenAddr` instead of `port`.',
        newcomerImpact: 'API clients calling `POST /api/v1/deploy` receive HTTP 404 Not Found.',
        suggestedDocFix: 'POST /api/v2/deployments with {"service": "billing-api", "env": "production", "region": "us-east-1", "listenAddr": "0.0.0.0:8080"}',
        fixes: [
          { type: 'replace', find: 'POST /api/v1/deploy', replace: 'POST /api/v2/deployments' },
          { type: 'replace', find: 'https://api.deployx.io/api/v1/deploy', replace: 'https://api.deployx.io/api/v2/deployments' },
          {
            type: 'replace',
            find: '\'{"service": "billing-api", "env": "production", "port": 8080}\'',
            replace: '\'{"service": "billing-api", "env": "production", "region": "us-east-1", "listenAddr": "0.0.0.0:8080"}\'',
          },
        ],
        resolved: false,
      },
      {
        id: 'deployx-api-2',
        title: 'Health Endpoint `GET /api/v1/status` renamed to `GET /api/v2/clusters/health`',
        category: 'API_ENDPOINT',
        severity: 'HIGH',
        docFile: 'docs/api.md',
        docLineRange: 'L21-L23',
        codeFile: 'src/api.ts',
        codeLineRange: 'L17',
        docSnippet: 'GET /api/v1/status',
        codeSnippet: "app.get('/api/v2/clusters/health', (_req, res) => res.json({ healthy: true }))",
        explanation: 'In `src/api.ts:17`, `/api/v1/status` was migrated to `/api/v2/clusters/health`.',
        newcomerImpact: 'Monitoring probes and uptime checks polling `/api/v1/status` fail with 404.',
        suggestedDocFix: 'GET /api/v2/clusters/health',
        fixes: [{ type: 'replace', find: 'GET /api/v1/status', replace: 'GET /api/v2/clusters/health' }],
        resolved: false,
      },
      {
        id: 'deployx-api-3',
        title: 'SDK function `triggerDeployment` signature missing required `region` parameter',
        category: 'FUNCTION_SIGNATURE',
        severity: 'CRITICAL',
        docFile: 'docs/api.md',
        docLineRange: 'L27-L30',
        codeFile: 'src/api.ts',
        codeLineRange: 'L26',
        docSnippet: 'await triggerDeployment(serviceName, env, port);',
        codeSnippet: 'export async function triggerDeployment(serviceName: string, env: string, region: string, listenAddr = "0.0.0.0:8080")',
        explanation: 'In `src/api.ts:26`, `triggerDeployment` now takes `(serviceName, env, region, listenAddr)` instead of `(serviceName, env, port)`.',
        newcomerImpact: 'TypeScript builds fail and runtime calls pass `port` as the `region` parameter.',
        suggestedDocFix: 'await triggerDeployment(serviceName, env, region, listenAddr);',
        fixes: [
          {
            type: 'replace',
            find: 'await triggerDeployment(serviceName, env, port);',
            replace: 'await triggerDeployment(serviceName, env, region, listenAddr);',
          },
        ],
        resolved: false,
      },
      {
        id: 'deployx-api-4',
        title: 'Undocumented rollback endpoint `POST /api/v2/rollbacks` in `src/api.ts`',
        category: 'API_ENDPOINT',
        severity: 'MEDIUM',
        docFile: 'docs/api.md',
        docLineRange: 'L21-L24',
        codeFile: 'src/api.ts',
        codeLineRange: 'L22',
        docSnippet: 'GET /api/v1/status',
        codeSnippet: "app.post('/api/v2/rollbacks', (req, res) => { ... })",
        explanation: '`src/api.ts:22` exposes `POST /api/v2/rollbacks` for instant rollbacks, but `docs/api.md` omits it.',
        newcomerImpact: 'Integrators are unaware of the automated rollback endpoint.',
        suggestedDocFix: '- `POST /api/v2/rollbacks` — registered in `src/api.ts:28`',
        fixes: [{ type: 'appendToSection', heading: 'Endpoints', line: '- `POST /api/v2/rollbacks` — registered in `src/api.ts:28`' }],
        resolved: false,
      },
      {
        id: 'deployx-api-5',
        title: 'Hardcoded Bearer token `ghp_...` leaked in `docs/api.md` curl example',
        category: 'SECRET_LEAK',
        severity: 'CRITICAL',
        docFile: 'docs/api.md',
        docLineRange: 'L15',
        codeFile: 'docs/api.md',
        codeLineRange: 'L15',
        docSnippet: '-H "Authorization: Bearer ghp_99887766554433221100abcdefghijklmnoPQR"',
        codeSnippet: 'Replace hardcoded GitHub PAT in curl snippet with <DEPLOYX_API_TOKEN> placeholder.',
        explanation: 'Line 15 of `docs/api.md` embeds a live-formatted GitHub Personal Access Token inside the `Authorization: Bearer` header example.',
        newcomerImpact: 'Secret scanners block commits and users may copy a compromised token.',
        suggestedDocFix: '-H "Authorization: Bearer <DEPLOYX_API_TOKEN>"',
        fixes: [
          {
            type: 'replace',
            find: 'ghp_99887766554433221100abcdefghijklmnoPQR',
            replace: '<DEPLOYX_API_TOKEN>',
          },
        ],
        resolved: false,
      },
    ],
  },

  'tidy-cli': {
    id: 'tidy-cli',
    name: 'example/tidy-cli',
    description: 'A small CLI and programmatic SDK whose README and API docs match its code.',
    techStack: 'TypeScript · Node.js · Commander',
    tags: ['In sync'],
    readmeContent: `# tidy-cli
Format and lint config files in one pass.

## Install
\`\`\`bash
npm install -g tidy-cli
\`\`\`

## Usage
Check every config file and fix what can be fixed automatically:
\`\`\`bash
tidy check --config ./tidy.json --fix
\`\`\`

## Configuration
Set the log level (defaults to \`info\`):
\`\`\`bash
export TIDY_LOG_LEVEL=debug
\`\`\`
`,
    fixedReadmeContent: `# tidy-cli
Format and lint config files in one pass.

## Install
\`\`\`bash
npm install -g tidy-cli
\`\`\`

## Usage
Check every config file and fix what can be fixed automatically:
\`\`\`bash
tidy check --config ./tidy.json --fix
\`\`\`

## Configuration
Set the log level (defaults to \`info\`):
\`\`\`bash
export TIDY_LOG_LEVEL=debug
\`\`\`
`,
    apiDocFile: 'docs/api.md',
    apiDocContent: `# tidy-cli Programmatic API Reference

Use \`tidy-cli\` directly from Node.js scripts or build pipelines.

## SDK Functions

\`\`\`ts
import { checkWorkspace } from 'tidy-cli';

const report = await checkWorkspace(configPath, fix);
\`\`\`

## Environment Variables
- \`TIDY_LOG_LEVEL\` (defaults to \`info\`)
`,
    fixedApiDocContent: `# tidy-cli Programmatic API Reference

Use \`tidy-cli\` directly from Node.js scripts or build pipelines.

## SDK Functions

\`\`\`ts
import { checkWorkspace } from 'tidy-cli';

const report = await checkWorkspace(configPath, fix);
\`\`\`

## Environment Variables
- \`TIDY_LOG_LEVEL\` (defaults to \`info\`)
`,
    codeFiles: {
      'src/cli.ts': `import { Command } from 'commander';

const program = new Command();
const logLevel = process.env.TIDY_LOG_LEVEL || 'info';

program
  .name('tidy')
  .command('check')
  .description('Lint config files')
  .option('--config <path>', 'Path to tidy.json', './tidy.json')
  .option('--fix', 'Apply automatic fixes')
  .action((options) => {
    console.log(\`[\${logLevel}] checking with\`, options.config, options.fix ? '(fixing)' : '');
  });

program.parse(process.argv);
`,
      'src/api.ts': `export async function checkWorkspace(configPath = './tidy.json', fix = false) {
  return { ok: true, configPath, fixed: fix };
}
`,
    },
    expectedDrifts: [],
    expectedApiDrifts: [],
  },

  'cloud-auth-py': {
    id: 'cloud-auth-py',
    name: 'acme-security/cloud-auth-py',
    description: 'Zero-trust OAuth & REST daemon showcasing all 6 drift checks across both README.md and API Docs (docs/api.md).',
    techStack: 'Python · FastAPI · argparse · OAuth2',
    tags: ['Full 6-Check Suite', 'auth.py:42 & api_server.py:24', 'REST & SDK API Docs', 'Secrets & License'],
    readmeContent: `# CloudAuth Daemon
[![CI Status](https://img.shields.io/badge/build-failing-red)](https://ci.acme-internal.invalid/pipelines)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Zero-trust token issuer and CLI verification daemon for internal services.
Read the [Architecture Guide](https://docs.acme-auth-internal.invalid/v1/architecture) or join our [Engineering Discord](https://discord.gg/expired-auth-999).

## Usage

Start the authentication daemon with token rotation:
\`\`\`bash
cloud-auth serve --token-ttl 3600 --legacy-hmac
\`\`\`

## Environment Variables
Configure your cloud provider credentials before starting the daemon:
\`\`\`bash
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export GITHUB_TOKEN="ghp_1234567890abcdefghijklmnopqrstuvwxyzAB"
\`\`\`

## License
This project is distributed under the MIT License. See \`LICENSE\` for details.
`,
    fixedReadmeContent: `# CloudAuth Daemon
[![CI Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/acme-security/cloud-auth-py/actions)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](./LICENSE)

Zero-trust token issuer and CLI verification daemon for internal services.
Read the [Architecture Guide](./docs/architecture.md) or join our [Engineering Discussions](https://github.com/acme-security/cloud-auth-py/discussions).

## Usage

Start the authentication daemon with token rotation:
\`\`\`bash
cloud-auth serve --session-expiry 3600 --issuer-url https://auth.acme.internal
\`\`\`

- \`--issuer-url <url>\` (serve): OIDC issuer URL (required in v3.0)
- \`--audit-log <path>\` (serve): Write structured JSON security events to file

## Environment Variables
Configure your cloud provider credentials before starting the daemon:
\`\`\`bash
export AWS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>"
export GITHUB_TOKEN="<GITHUB_TOKEN>"
\`\`\`

- \`OIDC_SIGNING_SECRET\`

## License
This project is distributed under the Apache 2.0 License. See \`LICENSE\` for details.
`,
    apiDocFile: 'docs/api.md',
    apiDocContent: `# CloudAuth HTTP & Python SDK API Reference
[![API Spec](https://img.shields.io/badge/OpenAPI-failing-red)](https://spec.acme-auth-internal.invalid/v1/openapi.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

Zero-trust OIDC token issuance REST API and Python verification SDK.
See the [Swagger Playground](https://swagger.acme-auth-internal.invalid/v1) for interactive schemas.

## Endpoints

### Issue Session Token
\`\`\`http
POST /v1/token/issue
\`\`\`

Request a short-lived zero-trust token:
\`\`\`bash
curl -X POST https://auth.acme.internal/v1/token/issue \\
  -H "X-Auth-Key: AKIAIOSFODNN7EXAMPLE" \\
  -d '{"client_id": "payments-worker", "token_ttl": 3600, "legacy_hmac": true}'
\`\`\`

### Verify Active Session
\`\`\`python
from auth import verify_session

is_valid = verify_session(token, token_ttl=3600, legacy_hmac=True)
\`\`\`

## Environment Variables
Required server runtime configuration:
\`\`\`bash
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
\`\`\`

## License
Distributed under the MIT License.
`,
    fixedApiDocContent: `# CloudAuth HTTP & Python SDK API Reference
[![API Spec](https://img.shields.io/badge/OpenAPI-passing-brightgreen)](./openapi.yaml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](../LICENSE)

Zero-trust OIDC token issuance REST API and Python verification SDK.
See the [OpenAPI Specification](./openapi.yaml) for interactive schemas.

## Endpoints

### Issue Session Token
\`\`\`http
POST /v2/oauth/token
\`\`\`

Request a short-lived zero-trust token:
\`\`\`bash
curl -X POST https://auth.acme.internal/v2/oauth/token \\
  -H "Authorization: Bearer <OIDC_CLIENT_TOKEN>" \\
  -d '{"client_id": "payments-worker", "session_expiry": 3600, "issuer_url": "https://auth.acme.internal"}'
\`\`\`

- \`POST /v2/oauth/revoke\` (api_server.py:34): Revoke active OIDC session token immediately
- \`GET /v2/jwks.json\` (api_server.py:40): Public JSON Web Key Set for signature verification

### Verify Active Session
\`\`\`python
from auth import verify_session

is_valid = verify_session(token, session_expiry=3600)
\`\`\`

## Environment Variables
Required server runtime configuration:
\`\`\`bash
export AWS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>"
\`\`\`

- \`OIDC_SIGNING_SECRET\`

## License
Distributed under the Apache 2.0 License.
`,
    codeFiles: {
      'auth.py': `import os
import argparse

OIDC_SIGNING_SECRET = os.environ.get("OIDC_SIGNING_SECRET")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cloud-auth")
    sub = parser.add_subparsers(dest="command")

    # Line 42 below: refactored --token-ttl to --session-expiry and removed --legacy-hmac
    serve = sub.add_parser("serve")
    serve.add_argument("--session-expiry", type=int, default=3600, help="Session lifetime in seconds (replaces --token-ttl)")
    serve.add_argument("--issuer-url", required=True, help="OIDC issuer URL (required in v3.0)")
    serve.add_argument("--audit-log", default="/var/log/cloud-auth.json", help="Write structured JSON security events to file")
    return parser


def verify_session(token: str, session_expiry: int = 3600) -> bool:
    if not OIDC_SIGNING_SECRET:
        raise RuntimeError("Missing required OIDC_SIGNING_SECRET environment variable")
    return len(token) > 16 and session_expiry > 0
`,
      'api_server.py': `import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="CloudAuth OIDC Server", version="3.0.0")
OIDC_SIGNING_SECRET = os.environ.get("OIDC_SIGNING_SECRET")


class TokenRequest(BaseModel):
    client_id: str
    session_expiry: int = 3600
    issuer_url: str


# Line 24: Replaced POST /v1/token/issue with POST /v2/oauth/token and Bearer auth
@app.post("/v2/oauth/token")
def issue_oauth_token(payload: TokenRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required; X-Auth-Key was removed in v3.0")
    return {"access_token": "eyJhbGciOiJSUzI1NiIs...", "expires_in": payload.session_expiry}


@app.post("/v2/oauth/revoke")
def revoke_oauth_token(token: str):
    return {"revoked": True, "token": token}


@app.get("/v2/jwks.json")
def get_jwks():
    return {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256"}]}
`,
      'LICENSE': `                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/
`,
    },
    expectedDrifts: [
      {
        id: 'auth-drift-1',
        title: 'Flag `--token-ttl` was renamed to `--session-expiry` in `auth.py`',
        category: 'CLI_FLAG',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L11-L13',
        codeFile: 'auth.py',
        codeLineRange: 'L42',
        docSnippet: 'cloud-auth serve --token-ttl 3600 --legacy-hmac',
        codeSnippet: 'serve.add_argument("--session-expiry", type=int, default=3600, help="Session lifetime in seconds")',
        explanation: 'In `auth.py:42`, `--token-ttl` was renamed to `--session-expiry`, `--legacy-hmac` was removed, and `--issuer-url` became mandatory.',
        newcomerImpact: 'Running `cloud-auth serve --token-ttl 3600` exits immediately with `unrecognized arguments: --token-ttl --legacy-hmac`.',
        suggestedDocFix: 'cloud-auth serve --session-expiry 3600 --issuer-url https://auth.acme.internal',
        fixes: [
          {
            type: 'replace',
            find: 'cloud-auth serve --token-ttl 3600 --legacy-hmac',
            replace: 'cloud-auth serve --session-expiry 3600 --issuer-url https://auth.acme.internal',
          },
        ],
        resolved: false,
      },
      {
        id: 'auth-drift-2',
        title: 'New CLI flags `--issuer-url` and `--audit-log` missing from `## Usage`',
        category: 'CLI_FLAG',
        severity: 'HIGH',
        docFile: 'README.md',
        docLineRange: 'L8-L13',
        codeFile: 'auth.py',
        codeLineRange: 'L43-L44',
        docSnippet: '## Usage',
        codeSnippet: 'serve.add_argument("--audit-log", default="/var/log/cloud-auth.json", help="Write structured JSON security events to file")',
        explanation: 'The CLI defines required `--issuer-url` and optional `--audit-log`, neither of which is listed in the `## Usage` section.',
        newcomerImpact: 'Operators do not know `--issuer-url` is required or how to enable structured security audit logging.',
        suggestedDocFix: '- `--issuer-url <url>` (serve): OIDC issuer URL (required in v3.0)\n- `--audit-log <path>` (serve): Write structured JSON security events to file',
        fixes: [
          { type: 'appendToSection', heading: 'Usage', line: '- `--issuer-url <url>` (serve): OIDC issuer URL (required in v3.0)' },
          { type: 'appendToSection', heading: 'Usage', line: '- `--audit-log <path>` (serve): Write structured JSON security events to file' },
        ],
        resolved: false,
      },
      {
        id: 'auth-drift-3',
        title: 'Failing status badge, 404 docs link, and expired Discord invite',
        category: 'DEAD_LINK',
        severity: 'MEDIUM',
        docFile: 'README.md',
        docLineRange: 'L2-L6',
        codeFile: 'README.md',
        codeLineRange: 'L2',
        docSnippet: '[![CI Status](https://img.shields.io/badge/build-failing-red)] ... https://discord.gg/expired-auth-999',
        codeSnippet: 'HTTP 404 on docs.acme-auth-internal.invalid · Discord invite expired · Badge reports "build failing"',
        explanation: 'The CI status badge reports `failing`, the external architecture URL returns 404, and the Discord invite code has expired.',
        newcomerImpact: 'New contributors see a failing build badge and hit dead 404 pages when clicking the docs or community invite.',
        suggestedDocFix: 'Update the badge to GitHub Actions and point links to `./docs/architecture.md` and GitHub Discussions.',
        resolved: false,
      },
      {
        id: 'auth-drift-4',
        title: 'Hardcoded AWS access key and GitHub PAT leaked in README',
        category: 'SECRET_LEAK',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L18-L19',
        codeFile: 'README.md',
        codeLineRange: 'L18',
        docSnippet: 'export AWS_ACCESS_KEY_ID="AKIA…LE"\nexport GITHUB_TOKEN="ghp_…AB"',
        codeSnippet: 'Rotate leaked credentials immediately and replace with <AWS_ACCESS_KEY_ID> and <GITHUB_TOKEN>.',
        explanation: 'Lines 18-19 contain live-formatted AWS (`AKIA...`) and GitHub (`ghp_...`) tokens directly in the README example.',
        newcomerImpact: 'Automated scanners flag the repository and developers may accidentally run with shared credentials.',
        suggestedDocFix: 'export AWS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>"\nexport GITHUB_TOKEN="<GITHUB_TOKEN>"',
        fixes: [
          { type: 'replace', find: 'AKIAIOSFODNN7EXAMPLE', replace: '<AWS_ACCESS_KEY_ID>' },
          { type: 'replace', find: 'ghp_1234567890abcdefghijklmnopqrstuvwxyzAB', replace: '<GITHUB_TOKEN>' },
        ],
        resolved: false,
      },
      {
        id: 'auth-drift-5',
        title: 'README says MIT, but root LICENSE file is Apache 2.0',
        category: 'LICENSE_MISMATCH',
        severity: 'MEDIUM',
        docFile: 'README.md',
        docLineRange: 'L23',
        codeFile: 'LICENSE',
        codeLineRange: 'L1',
        docSnippet: 'This project is distributed under the MIT License.',
        codeSnippet: 'LICENSE: Apache License, Version 2.0',
        explanation: 'Both the top license badge and the `## License` section state MIT, whereas the root `LICENSE` file contains the Apache 2.0 text.',
        newcomerImpact: 'Downstream consumers and compliance teams receive conflicting legal licensing terms.',
        suggestedDocFix: 'This project is distributed under the Apache 2.0 License. See `LICENSE` for details.',
        fixes: [
          {
            type: 'replace',
            find: 'This project is distributed under the MIT License. See `LICENSE` for details.',
            replace: 'This project is distributed under the Apache 2.0 License. See `LICENSE` for details.',
          },
        ],
        resolved: false,
      },
      {
        id: 'auth-drift-6',
        title: 'Environment variable `OIDC_SIGNING_SECRET` is missing from the README',
        category: 'ENV_VARIABLE',
        severity: 'HIGH',
        docFile: 'README.md',
        docLineRange: 'L15-L20',
        codeFile: 'auth.py',
        codeLineRange: 'L4',
        docSnippet: 'export AWS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>"\nexport GITHUB_TOKEN="<GITHUB_TOKEN>"\n# Missing: OIDC_SIGNING_SECRET',
        codeSnippet: 'OIDC_SIGNING_SECRET = os.environ.get("OIDC_SIGNING_SECRET")',
        explanation: '`auth.py:4` reads `OIDC_SIGNING_SECRET` and raises `RuntimeError` if missing, but `## Environment Variables` in README.md only lists `AWS_ACCESS_KEY_ID` and `GITHUB_TOKEN`.',
        newcomerImpact: 'Every call to `verify_session()` crashes with `Missing required OIDC_SIGNING_SECRET`. Add `export OIDC_SIGNING_SECRET="your-256-bit-signing-secret"` to your shell or `.env`.',
        suggestedDocFix: '- `OIDC_SIGNING_SECRET` (e.g. `export OIDC_SIGNING_SECRET="your-256-bit-signing-secret"`)',
        fixes: [{ type: 'appendToSection', heading: 'Environment Variables', line: '- `OIDC_SIGNING_SECRET`' }],
        resolved: false,
      },
    ],
    expectedApiDrifts: [
      {
        id: 'auth-api-1',
        title: 'Endpoint `POST /v1/token/issue` replaced by `POST /v2/oauth/token` in `api_server.py`',
        category: 'API_ENDPOINT',
        severity: 'CRITICAL',
        docFile: 'docs/api.md',
        docLineRange: 'L10-L18',
        codeFile: 'api_server.py',
        codeLineRange: 'L24',
        docSnippet: 'POST /v1/token/issue\n-d \'{"client_id": "payments-worker", "token_ttl": 3600, "legacy_hmac": true}\'',
        codeSnippet: '@app.post("/v2/oauth/token")\ndef issue_oauth_token(payload: TokenRequest, authorization: str = Header(...)):',
        explanation: 'In `api_server.py:24`, `POST /v1/token/issue` was migrated to `POST /v2/oauth/token`, `X-Auth-Key` was replaced by `Authorization: Bearer`, and `TokenRequest` now expects `session_expiry` + `issuer_url`.',
        newcomerImpact: 'Every HTTP client following `docs/api.md` hits HTTP 404 on `/v1/token/issue` or 422 Validation Error on `token_ttl`.',
        suggestedDocFix: 'POST /v2/oauth/token with Bearer header and {"client_id": "payments-worker", "session_expiry": 3600, "issuer_url": "https://auth.acme.internal"}',
        fixes: [
          { type: 'replace', find: 'POST /v1/token/issue', replace: 'POST /v2/oauth/token' },
          { type: 'replace', find: 'https://auth.acme.internal/v1/token/issue', replace: 'https://auth.acme.internal/v2/oauth/token' },
          {
            type: 'replace',
            find: '\'{"client_id": "payments-worker", "token_ttl": 3600, "legacy_hmac": true}\'',
            replace: '\'{"client_id": "payments-worker", "session_expiry": 3600, "issuer_url": "https://auth.acme.internal"}\'',
          },
        ],
        resolved: false,
      },
      {
        id: 'auth-api-2',
        title: 'Python SDK `verify_session()` signature drifted from `auth.py:45`',
        category: 'FUNCTION_SIGNATURE',
        severity: 'CRITICAL',
        docFile: 'docs/api.md',
        docLineRange: 'L22-L25',
        codeFile: 'auth.py',
        codeLineRange: 'L45',
        docSnippet: 'is_valid = verify_session(token, token_ttl=3600, legacy_hmac=True)',
        codeSnippet: 'def verify_session(token: str, session_expiry: int = 3600) -> bool:',
        explanation: 'In `auth.py:45`, `verify_session` accepts `(token: str, session_expiry: int = 3600)` and no longer accepts `token_ttl` or `legacy_hmac`.',
        newcomerImpact: 'Calling `verify_session(token, token_ttl=3600, legacy_hmac=True)` raises `TypeError: verify_session() got an unexpected keyword argument "token_ttl"`.',
        suggestedDocFix: 'is_valid = verify_session(token, session_expiry=3600)',
        fixes: [
          {
            type: 'replace',
            find: 'is_valid = verify_session(token, token_ttl=3600, legacy_hmac=True)',
            replace: 'is_valid = verify_session(token, session_expiry=3600)',
          },
        ],
        resolved: false,
      },
      {
        id: 'auth-api-3',
        title: 'New endpoints `POST /v2/oauth/revoke` and `GET /v2/jwks.json` missing from `docs/api.md`',
        category: 'API_ENDPOINT',
        severity: 'HIGH',
        docFile: 'docs/api.md',
        docLineRange: 'L8-L19',
        codeFile: 'api_server.py',
        codeLineRange: 'L34-L40',
        docSnippet: '## Endpoints',
        codeSnippet: '@app.post("/v2/oauth/revoke") ... @app.get("/v2/jwks.json")',
        explanation: '`api_server.py:34-40` defines token revocation (`POST /v2/oauth/revoke`) and OIDC key discovery (`GET /v2/jwks.json`), neither of which is documented in `docs/api.md`.',
        newcomerImpact: 'Service integrators cannot discover how to revoke compromised tokens or fetch public JWKS keys.',
        suggestedDocFix: '- `POST /v2/oauth/revoke` (api_server.py:34): Revoke active OIDC session token immediately\n- `GET /v2/jwks.json` (api_server.py:40): Public JSON Web Key Set for signature verification',
        fixes: [
          {
            type: 'appendToSection',
            heading: 'Endpoints',
            line: '- `POST /v2/oauth/revoke` (api_server.py:34): Revoke active OIDC session token immediately',
          },
          {
            type: 'appendToSection',
            heading: 'Endpoints',
            line: '- `GET /v2/jwks.json` (api_server.py:40): Public JSON Web Key Set for signature verification',
          },
        ],
        resolved: false,
      },
      {
        id: 'auth-api-4',
        title: 'Failing OpenAPI badge and 404 Swagger Playground URL in `docs/api.md`',
        category: 'DEAD_LINK',
        severity: 'MEDIUM',
        docFile: 'docs/api.md',
        docLineRange: 'L2-L6',
        codeFile: 'docs/api.md',
        codeLineRange: 'L2',
        docSnippet: '[![API Spec](https://img.shields.io/badge/OpenAPI-failing-red)] ... https://swagger.acme-auth-internal.invalid/v1',
        codeSnippet: 'HTTP 404 on spec.acme-auth-internal.invalid and swagger.acme-auth-internal.invalid',
        explanation: 'The OpenAPI status badge in `docs/api.md` reports `failing` and the Swagger Playground link points to a decommissioned v1 internal host.',
        newcomerImpact: 'Developers attempting to download the OpenAPI spec or test endpoints hit 404 pages.',
        suggestedDocFix: 'Point OpenAPI badge and specification link to `./openapi.yaml`.',
        resolved: false,
      },
      {
        id: 'auth-api-5',
        title: 'Hardcoded AWS key `AKIAIOSFODNN7EXAMPLE` leaked in `docs/api.md` headers & env',
        category: 'SECRET_LEAK',
        severity: 'CRITICAL',
        docFile: 'docs/api.md',
        docLineRange: 'L17-L31',
        codeFile: 'docs/api.md',
        codeLineRange: 'L17',
        docSnippet: '-H "X-Auth-Key: AKIAIOSFODNN7EXAMPLE"\nexport AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"',
        codeSnippet: 'Replace hardcoded AWS key with <OIDC_CLIENT_TOKEN> and <AWS_ACCESS_KEY_ID>.',
        explanation: '`docs/api.md` embeds `AKIAIOSFODNN7EXAMPLE` in both the `curl` request header and the environment variable section.',
        newcomerImpact: 'Triggers secret leak alerts and models insecure header key usage.',
        suggestedDocFix: '-H "Authorization: Bearer <OIDC_CLIENT_TOKEN>" and export AWS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>"',
        fixes: [
          {
            type: 'replace',
            find: '-H "X-Auth-Key: AKIAIOSFODNN7EXAMPLE"',
            replace: '-H "Authorization: Bearer <OIDC_CLIENT_TOKEN>"',
          },
          { type: 'replace', find: 'AKIAIOSFODNN7EXAMPLE', replace: '<AWS_ACCESS_KEY_ID>' },
        ],
        resolved: false,
      },
      {
        id: 'auth-api-6',
        title: 'API Docs state MIT License, but root `LICENSE` is Apache 2.0 and `OIDC_SIGNING_SECRET` is missing',
        category: 'LICENSE_MISMATCH',
        severity: 'HIGH',
        docFile: 'docs/api.md',
        docLineRange: 'L28-L35',
        codeFile: 'LICENSE',
        codeLineRange: 'L1',
        docSnippet: 'Distributed under the MIT License.',
        codeSnippet: 'LICENSE: Apache License, Version 2.0 · api_server.py:6 OIDC_SIGNING_SECRET',
        explanation: '`docs/api.md` states MIT License instead of Apache 2.0 and omits the required `OIDC_SIGNING_SECRET` environment variable read by `api_server.py:6`.',
        newcomerImpact: 'API consumers see conflicting license terms and server operators miss `OIDC_SIGNING_SECRET`.',
        suggestedDocFix: 'Distributed under the Apache 2.0 License. Add `- OIDC_SIGNING_SECRET` to Environment Variables.',
        fixes: [
          { type: 'replace', find: 'Distributed under the MIT License.', replace: 'Distributed under the Apache 2.0 License.' },
          { type: 'appendToSection', heading: 'Environment Variables', line: '- `OIDC_SIGNING_SECRET`' },
        ],
        resolved: false,
      },
    ],
  },
};
