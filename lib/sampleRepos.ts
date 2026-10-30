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
  codeFiles: Record<string, string>;
  expectedDrifts: DriftItem[];
}

export const SAMPLE_REPOS: Record<string, SampleRepo> = {
  'deployx-cli': {
    id: 'deployx-cli',
    name: 'deployx-cloud/deployx-cli',
    description: 'Modern CLI tool for deploying multi-cloud microservices. Drifted CLI arguments and flag defaults.',
    techStack: 'TypeScript · Node.js · Commander',
    tags: ['CLI Flags', 'Breaking Changes', 'New Contributor Blocker'],
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
      'package.json': `{
  "name": "deployx-cli",
  "version": "2.4.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "commander": "^12.0.0"
  }
}`
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
        codeSnippet: '.option(\'--listen-addr <address>\', \'Server bind address:port\', \'0.0.0.0:8080\')',
        explanation: 'README instructs users to pass `--port 8080`, but the code in `src/cli.ts` removed `--port` and replaced it with `--listen-addr`. Running the README command throws an immediate CLI error and exits.',
        newcomerImpact: '100% of first-time users running the Quickstart will encounter `error: unknown option --port` and fail to deploy.',
        suggestedDocFix: 'deployx push --env production --region us-east-1 --listen-addr 0.0.0.0:8080 --credentials-file ./keys/prod.pem',
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
        codeSnippet: '.requiredOption(\'--region <region>\', \'Target cloud region\')',
        explanation: 'The code enforces `requiredOption(\'--region <region>\')` when target environment is `production`, but the README completely omits this parameter.',
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
        codeSnippet: '.option(\'--credentials-file <path>\', \'Path to authentication credentials JSON/PEM\')',
        explanation: 'Option `--key-file` was refactored to `--credentials-file` in the v2.4 rewrite, but README still mentions the old flag name.',
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
        codeSnippet: '.option(\'--preview-port <number>\', \'Local preview port\', \'4000\')',
        explanation: 'Local preview command option changed from `--local-port` to `--preview-port`. Passing `--local-port` is silently ignored or rejected.',
        newcomerImpact: 'User expects custom port 3000 but server boots on default 4000.',
        suggestedDocFix: 'deployx preview --preview-port 3000',
        resolved: false,
      }
    ]
  },

  'tidy-cli': {
    id: 'tidy-cli',
    name: 'example/tidy-cli',
    description: 'A small CLI whose README matches its code exactly.',
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
    },
    expectedDrifts: [],
  },
};
