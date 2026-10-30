export type DriftSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DriftCategory = 
  | 'CLI_FLAG'
  | 'FUNCTION_SIGNATURE'
  | 'ENV_VARIABLE'
  | 'API_ENDPOINT'
  | 'INSTALL_STEP'
  | 'VERSION_MISMATCH';

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

export interface RepoAnalysisResult {
  repoName: string;
  repoUrl?: string;
  isSample?: boolean;
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
}

export interface LMStudioStatus {
  connected: boolean;
  endpoint: string;
  model: string;
  availableModels: string[];
  latencyMs?: number;
  error?: string;
}
