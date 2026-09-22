import { SolutionMeta, SolutionData, ModelType } from '../types/solution';
import { DEFAULT_SOLUTIONS } from './defaultSolutions';

const API_BASE = '/api';

export async function fetchSolutionsList(): Promise<SolutionMeta[]> {
  try {
    const response = await fetch(`${API_BASE}/solutions`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.solutions) && data.solutions.length > 0) {
        return data.solutions.map((s: any) => {
          const isH1 = (s.model === 'TSPPD-H_1') || s.filename.includes('TSPPD_H1') || s.filename.includes('_H1_');
          const isH2 = (s.model === 'TSPPD-H_2') || s.filename.includes('TSPPD_H2') || s.filename.includes('_H2_');
          const isH3 = (s.model === 'TSPPD-H_3') || s.filename.includes('TSPPD_H3') || s.filename.includes('_H3_');
          let modelType: ModelType = 'TSPPD-H';
          let defaultName = 'TSPPD-H (General, Ecs. 1-16)';
          let pol = s.policy ?? 0;
          if (isH1) {
            modelType = 'TSPPD-H_1';
            defaultName = 'TSPPD-H_1 (Política 1, Ecs. 17-25)';
            pol = 1;
          } else if (isH2) {
            modelType = 'TSPPD-H_2';
            defaultName = 'TSPPD-H_2 (Política 2, Ecs. 26-27)';
            pol = 2;
          } else if (isH3) {
            modelType = 'TSPPD-H_3';
            defaultName = 'TSPPD-H_3 (Política 3, Ecs. 31-48)';
            pol = 3;
          }
          return {
            ...s,
            model: (isH1 || isH2 || isH3) ? modelType : (s.model || modelType),
            modelName: s.modelName || defaultName,
            policy: s.policy ?? pol,
          };
        });
      }
    }
  } catch {
    // Modo estático o Vercel sin servidor Node
  }

  // Fallback a soluciones preempaquetadas (ideal para Vercel)
  const list: SolutionMeta[] = Object.entries(DEFAULT_SOLUTIONS).map(([filename, content]) => {
    const isH1 = (content.model === 'TSPPD-H_1') || filename.includes('TSPPD_H1') || filename.includes('_H1_');
    const isH2 = (content.model === 'TSPPD-H_2') || filename.includes('TSPPD_H2') || filename.includes('_H2_');
    const isH3 = (content.model === 'TSPPD-H_3') || filename.includes('TSPPD_H3') || filename.includes('_H3_');
    let modelType: ModelType = 'TSPPD-H';
    let defaultName = 'TSPPD-H (General, Ecs. 1-16)';
    let pol = content.policy ?? 0;
    if (isH1) {
      modelType = 'TSPPD-H_1';
      defaultName = 'TSPPD-H_1 (Política 1, Ecs. 17-25)';
      pol = 1;
    } else if (isH2) {
      modelType = 'TSPPD-H_2';
      defaultName = 'TSPPD-H_2 (Política 2, Ecs. 26-27)';
      pol = 2;
    } else if (isH3) {
      modelType = 'TSPPD-H_3';
      defaultName = 'TSPPD-H_3 (Política 3, Ecs. 31-48)';
      pol = 3;
    }
    return {
      filename,
      instance: content.instance || filename.replace(/\.[^/.]+$/, ''),
      model: (content.model as ModelType) || modelType,
      modelName: content.modelName || defaultName,
      policy: content.policy ?? pol,
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
