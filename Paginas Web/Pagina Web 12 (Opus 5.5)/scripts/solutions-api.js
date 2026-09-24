// Lógica compartida entre el middleware de Vite (dev) y el servidor Express (prod)
// para leer las soluciones Gurobi de ../../Outputs.
import fs from 'fs';
import path from 'path';

const MODEL_PATTERNS = [
  { model: 'TSPPD-H_1', policy: 1, name: 'TSPPD-H_1 (Política 1, Ecs. 17-25)', tokens: ['TSPPD_H1', '_H1_'] },
  { model: 'TSPPD-H_2', policy: 2, name: 'TSPPD-H_2 (Política 2, Ecs. 26-30)', tokens: ['TSPPD_H2', '_H2_'] },
  { model: 'TSPPD-H_3', policy: 3, name: 'TSPPD-H_3 (Política 3, Ecs. 31-48)', tokens: ['TSPPD_H3', '_H3_'] },
];

/** Identifica el modelo por el campo `model` o, si falta, por el nombre de archivo. */
export function detectModel(content, filename) {
  for (const p of MODEL_PATTERNS) {
    if (content?.model === p.model || p.tokens.some((t) => filename.includes(t))) {
      return { model: p.model, policy: p.policy, defaultName: p.name };
    }
  }
  return { model: 'TSPPD-H', policy: content?.policy ?? 0, defaultName: 'TSPPD-H (General, Ecs. 1-16)' };
}

export function buildMeta(filename, content, mtime) {
  const { model, policy, defaultName } = detectModel(content, filename);
  return {
    filename,
    mtime,
    model,
    modelName: content.modelName || defaultName,
    policy,
    instance: content.instance || filename.replace(/\.[^/.]+$/, ''),
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
}

const isSolutionFile = (f) => f.endsWith('.txt') || f.endsWith('.json');

export function sortMeta(list) {
  return list.sort(
    (a, b) =>
      (a.numCustomers || 0) - (b.numCustomers || 0) ||
      (a.instanceId || 0) - (b.instanceId || 0) ||
      a.filename.localeCompare(b.filename),
  );
}

export function listSolutions(outputsDir) {
  if (!fs.existsSync(outputsDir)) return [];
  const list = fs
    .readdirSync(outputsDir)
    .filter(isSolutionFile)
    .map((f) => {
      const filePath = path.join(outputsDir, f);
      const stat = fs.statSync(filePath);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return buildMeta(f, content, stat.mtimeMs);
      } catch {
        return { filename: f, mtime: stat.mtimeMs, error: 'Formato JSON no válido' };
      }
    });
  return sortMeta(list);
}

/**
 * Lee una solución por nombre de archivo. Devuelve null si no existe.
 * Rechaza rutas con separadores para impedir path traversal fuera de Outputs/.
 */
export function readSolution(outputsDir, filename) {
  if (!filename || filename !== path.basename(filename) || !isSolutionFile(filename)) return null;
  const filePath = path.join(outputsDir, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
