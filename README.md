# DocDrift AI 🚀
### Autonomous Documentation Drift Detector & Remediation Engine
**Built for Hacktoberfest '26 Hack Day (Newton School of Technology × SMRU) · Track 2: Best Use of Gemma 4**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Model](https://img.shields.io/badge/AI_Model-Gemma_4_26B_A4B-4285F4?logo=google)](https://huggingface.co/google/gemma-4-26B-A4B-it)
[![Model License](https://img.shields.io/badge/Model_License-Apache_2.0-blue.svg)](https://ai.google.dev/gemma/docs/gemma_4_license)
[![Runtime](https://img.shields.io/badge/Runtime-LM_Studio_Local-8B5CF6)](https://lmstudio.ai)

---

## 🏁 Hackathon Submission at a Glance

| | |
|---|---|
| **Track** | Track 2: Best Use of Gemma 4 |
| **Problem statement** | #18: Documentation Drift Detector |
| **Application code** | Apache License 2.0 (see [LICENSE](LICENSE)) |
| **AI model** | Google Gemma 4 26B A4B, instruction-tuned (`gemma-4-26b-a4b-it`; in LM Studio: `google/gemma-4-26b-a4b-qat`) |
| **Model source** | [huggingface.co/google/gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it) |
| **Model license** | Apache 2.0 ([Gemma 4 license](https://ai.google.dev/gemma/docs/gemma_4_license)) |
| **How the model runs** | Locally through LM Studio's OpenAI-compatible server (default), or through the Gemini API as a Gemma-only fallback when `GEMINI_API_KEY` is set |

The app's Apache 2.0 license covers DocDrift's code only. Gemma 4 is distributed by Google under its own license, linked above.

---

## 🎯 Problem Statement #18: Documentation Drift Detector
> **"READMEs and API docs go stale as code changes, so new contributors follow wrong instructions."**

**Who it helps:** open-source maintainers and new contributors.

When open-source code evolves, developers modify CLI flags, refactor API endpoints, change function signatures, and add required environment variables. However, `README.md` and documentation are frequently forgotten.

New contributors arrive, follow outdated instructions, run into crashes (`error: unknown option --port`, `404 Not Found`, `KeyError: MISSING_ENV`), get frustrated, and abandon the project.

**DocDrift** solves this by cross-examining your codebase against its documentation using **Google Gemma 4** running locally in LM Studio, then proposing line-by-line fixes you can review and send as a pull request.

---

## ✨ Features
- 🔍 **Automated GitHub Cloner**: Shallow-clones any public GitHub repository (`git clone --depth 1`), or try one of three built-in benchmark repos: `deployx-cli` (drifted docs), `tidy-cli` (docs in sync) and `cloud-auth-py` (Python, drifted docs).
- 🧠 **Gemma 4 Drift Analysis**: Gemma semantically compares the README against the source code to pinpoint broken CLI flags, altered API routes, changed function signatures, and missing environment variables, returning structured findings with severity and line ranges.
- 📘 **README & API Docs targets**: Audit `README.md` or the API reference (`docs/api.md`) against REST endpoints and SDK signatures.
- 🧾 **Rule-based checks**: CLI flags, source file line references, links, badges, leaked secrets and license consistency.
- 📊 **Documentation Health Score**: 0–100 health metric with severity breakdowns (Critical, High, Medium, Low) and newcomer-friction estimates.
- ⚡ **Gemma 4 Remediation**: Gemma rewrites the drifted sections; review every change in a side-by-side diff viewer, accept or reject individual lines, then copy the patch.
- 🔀 **1-Click GitHub PR**: Opens a pull request with the accepted fix (via a fork if you lack push access).
- 🛡️ **Rule-based fallback**: If no model is reachable, rule-based checks still catch removed CLI flags and undocumented environment variables.
- ⚙️ **Settings page**: Configure the endpoint, model, timeouts, token limits, system prompts, analysis/patch engine (model, rules, or auto) and scan limits at `/settings`.

---

## 🏗️ How Gemma 4 Does the Real AI Work (Track 2)

```
[ GitHub Repo / Markdown ]
           │
           ▼
[ AST & Code Extractor ] ──> Extracts CLI options, API routes, exported functions, .env
           │
           ▼
[ Gemma 4 Prompt Pipeline ]          lib/prompts.ts, lib/lmstudio.ts
  • System: "Autonomous Documentation Auditor & Diff Engine"
  • Ingests: README code blocks vs. codebase signatures
  • Model: gemma-4-26b-a4b-it (LM Studio, or Gemini API fallback)
           │
           ▼
[ Structured JSON Drift Output ]     lib/analyzer.ts
  • Category, Severity, Line Ranges, Impact on Newcomers
           │
           ▼
[ Gemma 4 Remediation Engine ] ──> Corrected README (lib/remediation.ts)
           │
           ▼
[ Side-by-side Diff Viewer ] ──> Line-by-line accept/reject (lib/diffModel.ts) ──> GitHub PR
```

Each scan result names the engine that produced it (for example `google/gemma-4-26b-a4b-qat (LM Studio)` or `Rule-based fallback`), so you can always see when Gemma did the work.

---

## 🚀 Quickstart for Local Development

### Prerequisites
- Node.js (v18.17+)
- Git (used to shallow-clone repositories)
- LM Studio with Gemma 4 26B A4B downloaded (or a `GEMINI_API_KEY`, see below)

### 1. Clone & Install
```bash
git clone https://github.com/GodGamerAgent/DocDrift.git
cd DocDrift
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
No variable is required for a local LM Studio setup. Optionally set:
- `GEMINI_API_KEY`: runs Gemma 4 through the Gemini API when LM Studio is not reachable.
- `LMSTUDIO_ENDPOINT`: LM Studio server URL (default `http://localhost:1234/v1`).
- `GITHUB_TOKEN`: used to open pull requests; without it DocDrift uses your `gh auth login` session.

`.env` is gitignored; never commit real keys.

### 3. Start the LM Studio server
1. Open LM Studio.
2. Search for and download **Gemma 4 26B A4B** (`google/gemma-4-26b-a4b-qat`).
3. Switch to the **Local Server** (`<->`) tab, load the Gemma model, and click **Start Server** on port `1234`.
4. When loading the model, set its **context length to at least 16384** tokens. Drift analysis sends a ~4k-token prompt, and reasoning-tuned Gemma builds can spend several thousand more tokens thinking; at LM Studio's smaller defaults the request fails with "Context size has been exceeded" and DocDrift falls back to its rule-based detector.

Everything else is configured on the **Settings** page (http://localhost:3000/settings): LM Studio endpoint, model, request timeout, token limits, prompts and scan limits. Settings are saved to `.docdrift/settings.json` (gitignored). The `LMSTUDIO_ENDPOINT` and `LMSTUDIO_TIMEOUT_MS` environment variables only change the defaults.

### 4. Launch DocDrift
```bash
npm run dev
```
Visit **[http://localhost:3000](http://localhost:3000)**, then pick a built-in benchmark repo or paste a public GitHub URL and click **Scan Repository**.

### 5. Run the tests
```bash
npm test
```
Runs the unit tests for the diff viewer, CLI/API checks, secrets, licenses and fix application.

```bash
npm run test:e2e
```
End-to-end check of all features plus the live scan/fix endpoints; it needs `npm run dev` running on port 3000.

---

## ⚠️ Known Limitations
- Only **public** GitHub repositories can be scanned; private repos fail to clone.
- Code extraction understands Node.js/TypeScript (Commander, yargs, Express-style routers) and Python (argparse, click, FastAPI-style routes). Other stacks still get link, badge, secret and license checks, plus Gemma's semantic review.
- Large repositories are truncated to the file and size limits on the Settings page, so drift in skipped files can be missed.
- Without a reachable model, only rule-based checks run, and they catch fewer issues than Gemma.
- Model output can be wrong: review each suggested change in the diff viewer before opening a pull request.

---

## 📜 Licenses
- **Application code**: [Apache License 2.0](LICENSE)
- **AI model**: Gemma 4 26B A4B (`gemma-4-26b-a4b-it`), [Apache License 2.0](https://ai.google.dev/gemma/docs/gemma_4_license), source: [Hugging Face model card](https://huggingface.co/google/gemma-4-26B-A4B-it)

This project follows the [MLH Code of Conduct](https://mlh.io/code-of-conduct).

---
*Built with ❤️ during Hacktoberfest '26 Hack Day Hyderabad at Newton School of Technology × SMRU.*
