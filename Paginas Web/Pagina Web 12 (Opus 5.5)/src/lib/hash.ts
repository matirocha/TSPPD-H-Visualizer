import type { ModelType, SolutionMeta } from '../types/solution';
import { MODELS, modelMeta } from './models';

/** Estado compartible en la URL: #/p3/10/7 → Política 3, 10 clientes, instancia 7. */
export interface HashSelection {
  model: ModelType;
  numCustomers: number;
  instanceId: number;
}

export function parseHash(hash: string): HashSelection | null {
  const m = hash.replace(/^#\/?/, '').split('/');
  if (m.length < 3) return null;
  const model = MODELS.find((x) => x.hashKey === m[0])?.id;
  const numCustomers = Number(m[1]);
  const instanceId = Number(m[2]);
  if (!model || !Number.isFinite(numCustomers) || !Number.isFinite(instanceId)) return null;
  return { model, numCustomers, instanceId };
}

export function formatHash(meta: Pick<SolutionMeta, 'model' | 'numCustomers' | 'instanceId'>): string {
  return `#/${modelMeta(meta.model).hashKey}/${meta.numCustomers}/${meta.instanceId}`;
}

export function findByHash(list: SolutionMeta[], sel: HashSelection | null): SolutionMeta | undefined {
  if (!sel) return undefined;
  return list.find((s) => s.model === sel.model && s.numCustomers === sel.numCustomers && s.instanceId === sel.instanceId);
}
