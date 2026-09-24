/**
 * Utilidades puras del compartimiento LIFO: ubicación de cada unidad en la vista,
 * etiquetas de nodos, conteo de manipulaciones "hasta ahora" y retardos de cascada.
 */
import type { BayView, Choreography, Unit, UnitMotion } from '../../lib/choreography';
import type { SimMode } from '../../state/SimulationProvider';
import type { SolutionData } from '../../types/solution';

export type Selection = { kind: 'slot'; index: number } | { kind: 'unit'; id: string };

export type UnitPlace =
  | { where: 'slot'; index: number }
  | { where: 'dock'; index: number }
  | { where: 'handed'; index: number }
  | { where: 'awaiting'; index: number }
  | { where: 'gone' };

/** Posición de reproducción usada para contar manipulaciones hasta el instante actual. */
export interface Cursor {
  mode: SimMode;
  stepIndex: number;
  subStep: number;
}

export const UNIT_HEX = { A: '#fb923c', B: '#22d3ee' } as const;
export const UNIT_RGB = { A: '251 146 60', B: '34 211 238' } as const;
export const HANDLING_HEX = '#fb7185';

export function locate(bay: BayView, id: string): UnitPlace {
  const s = bay.layout.indexOf(id);
  if (s >= 0) return { where: 'slot', index: s };
  const d = bay.dock.indexOf(id);
  if (d >= 0) return { where: 'dock', index: d };
  const h = bay.handedOver.indexOf(id);
  if (h >= 0) return { where: 'handed', index: h };
  const a = bay.awaiting.indexOf(id);
  if (a >= 0) return { where: 'awaiting', index: a };
  return { where: 'gone' };
}

export function nodeName(solution: SolutionData, id: number): string {
  if (id === 0) return 'Depósito';
  return solution.nodes.find((n) => n.id === id)?.label ?? `Cliente ${id}`;
}

/** Nodo → número de parada (1-based) en que el camión lo visita por primera vez. */
export function stopNumbers(solution: SolutionData): Map<number, number> {
  const map = new Map<number, number>();
  solution.steps.forEach((s, k) => {
    if (!map.has(s.to)) map.set(s.to, k + 1);
  });
  return map;
}

/** Nodo que caracteriza a la unidad: destino para α, origen para β. */
export function keyNode(u: Unit): number | undefined {
  return u.type === 'A' ? u.destination : u.origin;
}

export function unitTag(u: Unit): string {
  const n = keyNode(u);
  if (n === undefined) return '';
  return n === 0 ? 'D' : `C${n}`;
}

/** ¿La unidad pertenece al nodo resaltado? (α con destino en él, β recogida en él). */
export function isRelated(u: Unit, node: number): boolean {
  return u.type === 'A' ? u.destination === node : u.origin === node;
}

/** Índice de evacuaciones por unidad: [paso, fase] de cada vez que fue al andén. */
export type EvacIndex = Record<string, Array<readonly [number, number]>>;

export function buildEvacIndex(choreo: Choreography): EvacIndex {
  const out: EvacIndex = {};
  choreo.stops.forEach((stop, k) => {
    stop.phases.forEach((ph, j) => {
      for (const [id, m] of Object.entries(ph.motions)) {
        if (m !== 'evac') continue;
        (out[id] ??= []).push([k, j] as const);
      }
    });
  });
  return out;
}

export function handlingsUntil(index: EvacIndex, id: string, c: Cursor): number {
  const list = index[id];
  if (!list || c.mode === 'initial') return 0;
  if (c.mode === 'finished') return list.length;
  let n = 0;
  for (const [k, j] of list) if (k < c.stepIndex || (c.mode === 'stop' && k === c.stepIndex && j <= c.subStep)) n++;
  return n;
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
export const vez = (n: number) => `${n} ${plural(n, 'vez', 'veces')}`;

/**
 * Retardo (s) de cada unidad que se mueve en la fase actual para un efecto cascada:
 * se evacúa y entrega desde la compuerta hacia adentro; se carga desde el fondo hacia la puerta.
 */
export function phaseDelays(bay: BayView, spread = 0.25): Map<string, number> {
  const out = new Map<string, number>();
  const slotOf = new Map<string, number>();
  bay.layout.forEach((u, i) => {
    if (u) slotOf.set(u, i);
  });
  const groups: Record<'out' | 'handed' | 'in' | 'slide', Array<[string, number]>> = { out: [], handed: [], in: [], slide: [] };
  for (const [id, m] of Object.entries(bay.motions) as Array<[string, UnitMotion]>) {
    if (m === 'evac') groups.out.push([id, bay.dock.indexOf(id)]);
    else if (m === 'deliver' || m === 'unload') groups.handed.push([id, bay.handedOver.indexOf(id)]);
    else if (m === 'pickup' || m === 'reload') groups.in.push([id, -(slotOf.get(id) ?? 0)]);
    else groups.slide.push([id, slotOf.get(id) ?? 0]);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a[1] - b[1]);
    const n = list.length;
    list.forEach(([id], k) => out.set(id, n > 1 ? (k / (n - 1)) * spread : 0));
  }
  return out;
}

/** Marcas de la regla: 1, 5, 10, 15 … Q (evita solapar la última marca). */
export function rulerMarks(Q: number, minGap: number): number[] {
  const out = [1];
  for (let k = 5; k < Q; k += 5) if (Q - k >= minGap) out.push(k);
  if (Q > 1) out.push(Q);
  return out;
}
