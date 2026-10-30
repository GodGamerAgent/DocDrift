import { DriftItem, RepoAnalysisResult } from './types';

export interface SampleRepo {
  id: string;
  name: string;
  description: string;
  techStack: string;
  tags: string[];
  readmeContent: string;
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

  'nexus-auth-api': {
    id: 'nexus-auth-api',
    name: 'nexus-framework/auth-service',
    description: 'High-throughput enterprise JWT authentication server. API routes and required headers migrated in v3.0.',
    techStack: 'Python · FastAPI · PyJWT',
    tags: ['API Endpoints', 'Header Drift', 'Security Signature'],
    readmeContent: `# Nexus Auth Service 🛡️
Lightweight authentication microservice for modern web applications.

## API Usage

### 1. Issue Session Token
\`\`\`http
POST /auth/login
Content-Type: application/json

{
  "username": "alice",
  "password": "secretpassword"
}
\`\`\`

### 2. Verify Token in Python Client
\`\`\`python
from nexus_auth import verify_token

payload = verify_token(raw_jwt_token, secret="my-secret-key")
print("User ID:", payload["uid"])
\`\`\`

### Environment Variables
Configure your server with:
\`\`\`env
PORT=8000
DATABASE_URL=sqlite:///./dev.db
\`\`\`
`,
    codeFiles: {
      'api/routes.py': `from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

# MIGRATED FROM /auth/login TO /api/v2/auth/token
# Also now strictly requires 'X-Client-Tenant-ID' header
@router.post("/api/v2/auth/token")
async def login(
    body: LoginRequest,
    x_client_tenant_id: str = Header(..., description="Mandatory multi-tenant organization ID")
):
    if not x_client_tenant_id:
        raise HTTPException(status_code=400, detail="Missing X-Client-Tenant-ID header")
    return {"access_token": "token_abc123", "token_type": "bearer", "expires_in": 3600}
`,
      'nexus_auth/__init__.py': `import jwt

# Signature updated in v3.0:
# Requires mandatory 'audience' parameter to prevent confused deputy vulnerability
# 'secret' renamed to 'signing_key'
def verify_token(token: str, *, signing_key: str, audience: str, algorithms: list = ["HS256"]):
    """Verifies token against specific audience to enforce OAuth2 compliance."""
    return jwt.decode(token, signing_key, audience=audience, algorithms=algorithms)
`,
      '.env.example': `PORT=8000
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus_db
NEXUS_ENCRYPTION_KEY=super-secure-32-byte-hex-key
JWT_ISSUER=nexus-auth-prod
`
    },
    expectedDrifts: [
      {
        id: 'drift-api-1',
        title: 'Deprecated Route `/auth/login` Migrated to `/api/v2/auth/token`',
        category: 'API_ENDPOINT',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L7-L13',
        codeFile: 'api/routes.py',
        codeLineRange: 'L12-L18',
        docSnippet: 'POST /auth/login',
        codeSnippet: '@router.post("/api/v2/auth/token")',
        explanation: 'README documents route `POST /auth/login`, but FastAPI route was moved to `/api/v2/auth/token`. Calling the documented route returns 404 Not Found.',
        newcomerImpact: 'Any developer testing the API with Postman or cURL gets a 404 HTTP error immediately.',
        suggestedDocFix: 'POST /api/v2/auth/token\nHeader: X-Client-Tenant-ID: <your-tenant-id>',
        resolved: false,
      },
      {
        id: 'drift-api-2',
        title: 'Mandatory Header `X-Client-Tenant-ID` Missing in Docs',
        category: 'API_ENDPOINT',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L8-L13',
        codeFile: 'api/routes.py',
        codeLineRange: 'L16-L19',
        docSnippet: 'POST /auth/login\nContent-Type: application/json',
        codeSnippet: 'x_client_tenant_id: str = Header(...)',
        explanation: 'FastAPI router enforces `x_client_tenant_id` as a required header. The documentation only specifies `Content-Type: application/json`.',
        newcomerImpact: 'Requests fail with `422 Unprocessable Entity - Missing header: X-Client-Tenant-ID`.',
        suggestedDocFix: 'X-Client-Tenant-ID: default-org-id',
        resolved: false,
      },
      {
        id: 'drift-api-3',
        title: 'Function Signature Drift: `verify_token()` Kwargs Changed',
        category: 'FUNCTION_SIGNATURE',
        severity: 'HIGH',
        docFile: 'README.md',
        docLineRange: 'L17-L22',
        codeFile: 'nexus_auth/__init__.py',
        codeLineRange: 'L6-L10',
        docSnippet: 'verify_token(raw_jwt_token, secret="my-secret-key")',
        codeSnippet: 'def verify_token(token: str, *, signing_key: str, audience: str, algorithms: list = ["HS256"])',
        explanation: 'Parameter `secret` was renamed to `signing_key` and made keyword-only. In addition, parameter `audience` is now required for security.',
        newcomerImpact: 'Calling `verify_token(..., secret=...)` throws `TypeError: verify_token() got an unexpected keyword argument \'secret\'`.',
        suggestedDocFix: 'payload = verify_token(raw_jwt_token, signing_key="my-secret-key", audience="app")',
        resolved: false,
      },
      {
        id: 'drift-api-4',
        title: 'Undocumented Mandatory Environment Variables',
        category: 'ENV_VARIABLE',
        severity: 'HIGH',
        docFile: 'README.md',
        docLineRange: 'L26-L29',
        codeFile: '.env.example',
        codeLineRange: 'L3-L4',
        docSnippet: 'PORT=8000\nDATABASE_URL=sqlite:///./dev.db',
        codeSnippet: 'NEXUS_ENCRYPTION_KEY=...\nJWT_ISSUER=nexus-auth-prod',
        explanation: 'The README only lists PORT and DATABASE_URL, leaving out `NEXUS_ENCRYPTION_KEY` and `JWT_ISSUER`, without which the server crashes at startup.',
        newcomerImpact: 'App fails to boot with `KeyError: NEXUS_ENCRYPTION_KEY`.',
        suggestedDocFix: 'PORT=8000\nDATABASE_URL=...\nNEXUS_ENCRYPTION_KEY=<key>\nJWT_ISSUER=nexus-auth-prod',
        resolved: false,
      }
    ]
  },

  'vision-core-ai': {
    id: 'vision-core-ai',
    name: 'open-vision/vision-core',
    description: 'Computer vision SDK for edge inference. Python class initialization and inference signature drifted.',
    techStack: 'Python · PyTorch · NumPy',
    tags: ['Function Signatures', 'AI Model Loading', 'Python SDK'],
    readmeContent: `# VisionCore Python SDK 👁️
Embedded computer vision models for edge devices.

## Installation
\`\`\`bash
pip install vision-core
\`\`\`

## Model Inference Example
\`\`\`python
from vision_core import ImageClassifier

# Load default model
classifier = ImageClassifier.load("resnet50.onnx")

# Run prediction
results = classifier.predict(image_path="sample.jpg", top_k=5)
print("Top category:", results[0].label)
\`\`\`
`,
    codeFiles: {
      'vision_core/classifier.py': `class ImageClassifier:
    """VisionCore Classifier."""
    
    @classmethod
    def from_pretrained(cls, model_identifier: str, device: str = "cpu"):
        """Factory method replaced .load() in version 3.0"""
        return cls(model_identifier, device)

    def infer(self, input_image, *, max_predictions: int = 5, confidence_threshold: float = 0.5):
        """Method predict() was renamed to infer() to align with OpenVINO standard."""
        # Returns List[Dict[str, Any]] with 'class_name' key instead of 'label'
        return [{"class_name": "tabby_cat", "confidence": 0.98}]
`
    },
    expectedDrifts: [
      {
        id: 'drift-vis-1',
        title: 'Factory Method `.load()` Renamed to `.from_pretrained()`',
        category: 'FUNCTION_SIGNATURE',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L12-L14',
        codeFile: 'vision_core/classifier.py',
        codeLineRange: 'L4-L7',
        docSnippet: 'classifier = ImageClassifier.load("resnet50.onnx")',
        codeSnippet: '@classmethod\ndef from_pretrained(cls, model_identifier: str, device: str = "cpu"):',
        explanation: 'README calls `ImageClassifier.load()`, but the method was refactored to `from_pretrained()` following modern HuggingFace conventions.',
        newcomerImpact: 'Throws `AttributeError: type object \'ImageClassifier\' has no attribute \'load\'`.',
        suggestedDocFix: 'classifier = ImageClassifier.from_pretrained("resnet50.onnx")',
        resolved: false,
      },
      {
        id: 'drift-vis-2',
        title: 'Inference Method `.predict()` Renamed to `.infer()` and Params Drifted',
        category: 'FUNCTION_SIGNATURE',
        severity: 'CRITICAL',
        docFile: 'README.md',
        docLineRange: 'L15-L18',
        codeFile: 'vision_core/classifier.py',
        codeLineRange: 'L9-L13',
        docSnippet: 'results = classifier.predict(image_path="sample.jpg", top_k=5)',
        codeSnippet: 'def infer(self, input_image, *, max_predictions: int = 5, confidence_threshold: float = 0.5):',
        explanation: 'The inference method was renamed from `predict` to `infer`, argument `top_k` was renamed to `max_predictions`, and `image_path` changed to `input_image`.',
        newcomerImpact: 'Immediate `AttributeError: \'ImageClassifier\' object has no attribute \'predict\'`.',
        suggestedDocFix: 'results = classifier.infer(input_image="sample.jpg", max_predictions=5)',
        resolved: false,
      }
    ]
  }
};
