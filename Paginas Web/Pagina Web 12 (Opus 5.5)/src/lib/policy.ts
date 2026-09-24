import type { ModelType, SolutionData, StepData } from '../types/solution';

/** Normaliza el valor s_i de TSPPD-H_3: 1 → Política 1; 0 (o 2) → Política 2. */
export function normalizePolicyValue(value: number | undefined | null): 1 | 2 | null {
  if (value === undefined || value === null) return null;
  return value === 0 || value === 2 ? 2 : 1;
}

export function modelOf(solution: Pick<SolutionData, 'model'>): ModelType {
  return solution.model ?? 'TSPPD-H';
}

/**
 * Política con la que se opera en la parada del paso `step`.
 * - TSPPD-H_1 → 1, TSPPD-H_2 → 2 (fijas).
 * - TSPPD-H_3 → decisión s_i del nodo (policyApplied o policyDecisions).
 * - Modelo General → null (no hay política: posiciones libres).
 */
export function stepPolicy(solution: SolutionData, step: StepData | undefined | null): 1 | 2 | null {
  if (!step) return null;
  const model = modelOf(solution);
  if (model === 'TSPPD-H_1') return 1;
  if (model === 'TSPPD-H_2') return 2;
  if (model === 'TSPPD-H_3') {
    if (step.to === 0) return null;
    return (
      normalizePolicyValue(step.policyApplied) ??
      normalizePolicyValue(solution.policyDecisions?.[String(step.to)]) ??
      1
    );
  }
  return null;
}

/** Decisión s_i de un nodo cliente en TSPPD-H_3 (null en otros modelos o en el depósito). */
export function nodePolicy(solution: SolutionData, nodeId: number): 1 | 2 | null {
  if (modelOf(solution) !== 'TSPPD-H_3' || nodeId === 0) return null;
  const fromDecisions = normalizePolicyValue(solution.policyDecisions?.[String(nodeId)]);
  if (fromDecisions) return fromDecisions;
  return stepPolicy(solution, solution.steps.find((s) => s.to === nodeId));
}
