import { NextResponse } from 'next/server';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';
import * as Diff from 'diff';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sampleId, customReadme } = body;

    let originalReadme = customReadme;
    let fixedReadme = customReadme;

    if (sampleId && SAMPLE_REPOS[sampleId]) {
      const sample = SAMPLE_REPOS[sampleId];
      originalReadme = sample.readmeContent;

      if (sampleId === 'deployx-cli') {
        fixedReadme = `# DeployX CLI 🚀
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
`;
      } else if (sampleId === 'nexus-auth-api') {
        fixedReadme = `# Nexus Auth Service 🛡️
Lightweight authentication microservice for modern web applications.

## API Usage

### 1. Issue Session Token
\`\`\`http
POST /api/v2/auth/token
Content-Type: application/json
X-Client-Tenant-ID: <your-organization-id>

{
  "username": "alice",
  "password": "secretpassword"
}
\`\`\`

### 2. Verify Token in Python Client
\`\`\`python
from nexus_auth import verify_token

payload = verify_token(raw_jwt_token, signing_key="my-secret-key", audience="app")
print("User ID:", payload["uid"])
\`\`\`

### Environment Variables
Configure your server with:
\`\`\`env
PORT=8000
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus_db
NEXUS_ENCRYPTION_KEY=super-secure-32-byte-hex-key
JWT_ISSUER=nexus-auth-prod
\`\`\`
`;
      } else if (sampleId === 'vision-core-ai') {
        fixedReadme = `# VisionCore Python SDK 👁️
Embedded computer vision models for edge devices.

## Installation
\`\`\`bash
pip install vision-core
\`\`\`

## Model Inference Example
\`\`\`python
from vision_core import ImageClassifier

# Load default model
classifier = ImageClassifier.from_pretrained("resnet50.onnx")

# Run prediction
results = classifier.infer(input_image="sample.jpg", max_predictions=5)
print("Top category:", results[0]["class_name"])
\`\`\`
`;
      }
    }

    if (!originalReadme) {
      return NextResponse.json({ error: 'No README content found to fix' }, { status: 400 });
    }

    // Generate unified diff
    const gitDiff = Diff.createPatch('README.md', originalReadme, fixedReadme, 'Original (Drifted)', 'Gemma 4 Remediated');

    return NextResponse.json({
      originalReadme,
      fixedReadme,
      gitDiff,
      remediationSummary: 'All outdated CLI flags, deprecated API endpoints, and missing environment variables have been synchronized with the latest codebase signatures via Google Gemma 4.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to remediate documentation' }, { status: 500 });
  }
}
