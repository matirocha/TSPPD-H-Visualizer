/** Derivaciones de la Comparativa: variantes por instancia, brechas y resúmenes por modelo. */
import type { ModelType, SolutionMeta } from '../../types/solution';
import { MODELS, type ModelMeta } from '../../lib/models';

export const EPS = 1e-6;

export interface VariantRow {
  model: ModelMeta;
  meta: SolutionMeta | null;
}

/** Las cuatro variantes en el orden canónico (General, P1, P2, P3); `meta = null` si falta. */
export function orderedVariants(list: SolutionMeta[]): VariantRow[] {
  return MODELS.map((model) => ({
    model,
    meta: list.find((s) => s.model === model.id && !s.error && Number.isFinite(s.objectiveValue)) ?? null,
  }));
}

export interface InstanceRow {
  instanceId: number;
  byModel: Partial<Record<ModelType, SolutionMeta>>;
  best: number;
  /** Brecha relativa (Z − Z_mejor) / Z_mejor por modelo presente. */
  gaps: Partial<Record<ModelType, number>>;
  maxGap: number;
}

export function customerCounts(solutions: SolutionMeta[]): number[] {
  return [...new Set(solutions.filter((s) => !s.error).map((s) => s.numCustomers))].sort((a, b) => a - b);
}

export function instanceRows(solutions: SolutionMeta[], numCustomers: number): InstanceRow[] {
  const ids = [...new Set(solutions.filter((s) => s.numCustomers === numCustomers && !s.error).map((s) => s.instanceId))].sort((a, b) => a - b);
  return ids.map((instanceId) => {
    const byModel: Partial<Record<ModelType, SolutionMeta>> = {};
    for (const s of solutions) {
      if (s.numCustomers === numCustomers && s.instanceId === instanceId && !s.error && Number.isFinite(s.objectiveValue)) byModel[s.model] = s;
    }
    const zs = Object.values(byModel).map((s) => s!.objectiveValue);
    const best = zs.length ? Math.min(...zs) : 0;
    const gaps: Partial<Record<ModelType, number>> = {};
    let maxGap = 0;
    for (const m of MODELS) {
      const s = byModel[m.id];
      if (!s) continue;
      const g = best > 0 ? Math.max(0, (s.objectiveValue - best) / best) : 0;
      gaps[m.id] = g;
      maxGap = Math.max(maxGap, g);
    }
    return { instanceId, byModel, best, gaps, maxGap };
  });
}

export interface ModelSummary {
  model: ModelMeta;
  bestCount: number;
  total: number;
  meanGap: number | null;
}

export function modelSummaries(rows: InstanceRow[]): ModelSummary[] {
  return MODELS.map((model) => {
    const gs = rows.map((r) => r.gaps[model.id]).filter((g): g is number => g !== undefined);
    return {
      model,
      bestCount: gs.filter((g) => g <= EPS).length,
      total: gs.length,
      meanGap: gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null,
    };
  });
}

/** "A", "A y B", "A, B y C". */
export function joinEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
