# DocDrift AI 🚀
### Autonomous Documentation Drift Detector & Remediation Engine
**Built for Hacktoberfest '26 Hack Day (Newton School of Technology × SMRU) · Track 2: Best Use of Gemma 4**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Model](https://img.shields.io/badge/AI_Model-Google_Gemma_4_12B-4285F4?logo=google)](https://ai.google.dev/gemma)
[![Hardware](https://img.shields.io/badge/Hardware-Apple_Silicon_M5-000000?logo=apple)](https://apple.com)
[![Runtime](https://img.shields.io/badge/Runtime-LM_Studio_Local-8B5CF6)](https://lmstudio.ai)

---

## 🎯 Problem Statement #18: Documentation Drift Detector
> **"READMEs and API docs go stale as code changes, so new contributors follow wrong instructions."**

When open-source code evolves, developers modify CLI flags, refactor API endpoints, change function signatures, and add required environment variables. However, `README.md` and documentation are frequently forgotten. 

New contributors arrive, follow outdated instructions, run into crashes (`error: unknown option --port`, `404 Not Found`, `KeyError: MISSING_ENV`), get frustrated, and abandon the project.

**DocDrift** solves this autonomously by cross-examining your codebase against documentation using **Google Gemma 4 12B** running locally in LM Studio.

---

## ✨ Features
- 🔍 **Automated GitHub Cloner**: Shallow-clones any public GitHub repository (`git clone --depth 1`) or tests instantly with 3 built-in real-world drift scenarios.
- 🧠 **Google Gemma 4 (12B) Core**: Semantically compares README instructions against source code to pinpoint broken CLI flags, altered API routes, changed function signatures, and missing environment variables.
- 📊 **Documentation Health Score**: Real-time 0–100% health metric with visual gauge, severity breakdowns (Critical, High, Medium), and newcomer friction calculations.
- ⚡ **1-Click PR Remediation**: Gemma 4 generates the exact unified git patch (`.diff`) and updated `README.md` ready to commit or copy.
- 💻 **Optimized for Mac M5 (16GB RAM)**: Leverages Apple Silicon Metal acceleration via LM Studio (`http://localhost:1234/v1`).
- 🛡️ **Zero-Crash Vibe Coding Mode**: Includes an intelligent fallback simulator so your hackathon live demo never fails even if LM Studio is offline!

---

## 🏗️ How Gemma 4 Does the Real AI Work (Track 2)

```
[ GitHub Repo / Markdown ]
           │
           ▼
[ AST & Code Extractor ] ──> Extracts CLI options, API routes, exported functions, .env
           │
           ▼
[ Gemma 4 Prompt Pipeline ]
  • System: "Autonomous Documentation Auditor & Diff Engine"
  • Ingests: README code blocks vs. codebase signatures
  • Model: Google Gemma 4 (12B, Q4_K_M) in LM Studio
           │
           ▼
[ Structured JSON Drift Output ]
  • Category, Severity, Line Ranges, Impact on Newcomers
           │
           ▼
[ Gemma 4 Remediation Engine ] ──> Outputs Unified Git Diff (.diff)
```

---

## 🚀 Quickstart for Local Development

### Prerequisites
- Node.js (v18.17+)
- Git (used to shallow-clone repositories)
- LM Studio (with `gemma-4-12b` or `gemma-2-9b` downloaded)

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd DocDrift
npm install
```

### 2. Start LM Studio Server
1. Open LM Studio on your Mac M5.
2. Search and download `gemma-4-12b` (4-bit quantization).
3. Switch to the **Local Server** (`<->`) tab, select the Gemma model, and click **Start Server** on port `1234`.
4. When loading the model, set its **context length to at least 16384** tokens. Drift analysis sends a ~4k-token prompt, and reasoning-tuned Gemma builds can spend several thousand more tokens thinking; at LM Studio's smaller defaults the request fails with "Context size has been exceeded" and DocDrift falls back to its rule-based detector.

If LM Studio runs on a different host or port, set `LMSTUDIO_ENDPOINT` before starting DocDrift (e.g. `LMSTUDIO_ENDPOINT=http://localhost:5678/v1 npm run dev`). Model calls time out after 5 minutes by default; raise `LMSTUDIO_TIMEOUT_MS` on slower machines.

### 3. Launch DocDrift Web App
```bash
npm run dev
```
Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📜 Licenses
- **Project License**: [Apache License 2.0](LICENSE)
- **AI Model License**: [Google Gemma Terms of Use & Gemma Open Model License](https://ai.google.dev/gemma/terms)

---
*Built with ❤️ during Hacktoberfest '26 Hack Day Hyderabad at Newton School of Technology × SMRU.*
