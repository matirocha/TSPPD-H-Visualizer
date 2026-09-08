import { SolutionMeta, SolutionData } from '../types/solution';
import { DEFAULT_SOLUTIONS } from './defaultSolutions';

const API_BASE = '/api';

export async function fetchSolutionsList(): Promise<SolutionMeta[]> {
  try {
    const response = await fetch(`${API_BASE}/solutions`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.solutions) && data.solutions.length > 0) {
        return data.solutions;
      }
    }
  } catch {
    // Modo estático o Vercel sin servidor Node
  }

  // Fallback a soluciones preempaquetadas (ideal para Vercel)
  const list: SolutionMeta[] = Object.entries(DEFAULT_SOLUTIONS).map(([filename, content]) => {
    const isH1 = (content.model === 'TSPPD-H_1') || filename.includes('TSPPD_H1') || filename.includes('_H1_');
    const modelType = isH1 ? 'TSPPD-H_1' : 'TSPPD-H';
    const modelName = content.modelName || (isH1 ? 'TSPPD-H_1 (Política 1, Ecs. 17-25)' : 'TSPPD-H (General, Ecs. 1-16)');
    return {
      filename,
      instance: content.instance || filename.replace(/\.[^/.]+$/, ''),
      model: modelType,
      modelName,
      policy: content.policy,
      numCustomers: content.numCustomers || 0,
      instanceId: content.instanceId || 0,
      h: content.h ?? 0.1,
      capacity: content.capacity || 0,
      objectiveValue: content.objectiveValue || 0,
      totalDistance: content.totalDistance || 0,
      handlingCost: content.handlingCost || 0,
      tourLength: content.tour ? content.tour.length : 0,
      stepCount: content.steps ? content.steps.length : 0,
    };
  });

  list.sort((a, b) => (a.instanceId || 0) - (b.instanceId || 0) || a.filename.localeCompare(b.filename));
  return list;
}

export async function fetchSolutionDetail(filename: string): Promise<SolutionData> {
  try {
    const response = await fetch(`${API_BASE}/solutions/${encodeURIComponent(filename)}`);
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch {
    // Modo estático o Vercel sin servidor Node
  }

  if (DEFAULT_SOLUTIONS[filename]) {
    return DEFAULT_SOLUTIONS[filename];
  }

  throw new Error(`Solución no encontrada: ${filename}`);
}
