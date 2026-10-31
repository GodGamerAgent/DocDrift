export type DriftSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DriftCategory = 
  | 'CLI_FLAG'
  | 'FUNCTION_SIGNATURE'
  | 'ENV_VARIABLE'
  | 'API_ENDPOINT'
  | 'INSTALL_STEP'
  | 'VERSION_MISMATCH'
  | 'DEAD_LINK'
  | 'SECRET_LEAK'
  | 'LICENSE_MISMATCH';

// Mechanical README edits a rule-based check knows how to make.
export type DocFix =
  // Replace `find` with `replace`; `token` matches only whole flag/word tokens
  | { type: 'replace'; find: string; replace: string; token?: boolean }
  // Append a line to the `## heading` section, creating the section if missing
  | { type: 'appendToSection'; heading: string; line: string };

export interface DriftItem {
  id: string;
  title: string;
  category: DriftCategory;
  severity: DriftSeverity;
  docFile: string;
  docLineRange: string;
  codeFile: string;
  codeLineRange: string;
  docSnippet: string;
  codeSnippet: string;
  explanation: string;
  newcomerImpact: string;
  suggestedDocFix: string;
  fixes?: DocFix[];
  resolved?: boolean;
}

export interface DocHealthMetrics {
  overallScore: number; // 0-100
  totalDrifts: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  estimatedOnboardingFrictionMin: number;
  readinessForContributors: 'READY' | 'WARNING' | 'BROKEN';
}

export type DocTarget = 'readme' | 'api';

export interface RepoAnalysisResult {
  repoName: string;
  repoUrl?: string;
  isSample?: boolean;
  sampleId?: string;
  docTarget?: DocTarget;
  branch?: string;
  totalFilesScanned: number;
  docsScanned: string[];
  codeFilesScanned: string[];
  metrics: DocHealthMetrics;
  drifts: DriftItem[];
  modelUsed: string;
  inferenceMode: 'LM_STUDIO_LIVE' | 'GEMMA_LOCAL_SIMULATOR';
  analyzedAt: string;
  summary: string;
  // Shown when the model was requested but could not be used
  notice?: string;
  // Present for cloned repos so the remediation step can patch the actual README or API Doc
  readmeFile?: string;
  readmeContent?: string;
}

export interface RemediationResult {
  originalReadme: string;
  fixedReadme: string;
  gitDiff: string;
  remediationSummary: string;
}

export interface LMStudioStatus {
  connected: boolean;
  endpoint: string;
  model: string;
  availableModels: string[];
  latencyMs?: number;
  error?: string;
}
