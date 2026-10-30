import { DriftItem, DocHealthMetrics } from './types';

// Kept free of Node-only imports so the client can recompute metrics as drifts get resolved.
export function calculateMetrics(drifts: DriftItem[]): DocHealthMetrics {
  const criticalCount = drifts.filter((d) => d.severity === 'CRITICAL').length;
  const highCount = drifts.filter((d) => d.severity === 'HIGH').length;
  const mediumCount = drifts.filter((d) => d.severity === 'MEDIUM').length;
  const lowCount = drifts.filter((d) => d.severity === 'LOW').length;
  const total = drifts.length;

  // Compute 0-100 score:
  // Each critical deducts 25 points, high 15 points, medium 8 points, low 3 points
  let score = 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 8 + lowCount * 3);
  if (score < 5) score = 5;
  if (total === 0) score = 100;

  // Contributor onboarding friction in minutes (5 min baseline for reading the docs at all)
  const frictionMin = total === 0 ? 0 : criticalCount * 45 + highCount * 25 + mediumCount * 10 + lowCount * 3 + 5;

  let readiness: 'READY' | 'WARNING' | 'BROKEN' = 'READY';
  if (criticalCount > 0) {
    readiness = 'BROKEN';
  } else if (highCount > 0 || mediumCount > 1) {
    readiness = 'WARNING';
  }

  return {
    overallScore: score,
    totalDrifts: total,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    estimatedOnboardingFrictionMin: frictionMin,
    readinessForContributors: readiness,
  };
}
