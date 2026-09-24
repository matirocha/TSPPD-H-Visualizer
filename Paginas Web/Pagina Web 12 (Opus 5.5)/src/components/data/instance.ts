import type { SolutionData } from '../../types/solution';
import { scrollBehavior } from '../../lib/motion';

/** Etiqueta corta de nodo: D (depósito) o C1…Cn. */
export const nodeLabel = (id: number) => (id === 0 ? 'D' : `C${id}`);

/** Valores ≥ este umbral son "infinito" en las matrices del solver (diagonal = 1e7). */
export const INF = 1e6;

type RGB = [number, number, number];

/** Rampa secuencial monocroma (zinc-900 → zinc-500): costo bajo = oscuro, alto = claro. */
const RAMP_LOW: RGB = [24, 24, 27];
const RAMP_HIGH: RGB = [113, 113, 122];

export const RAMP_CSS = `linear-gradient(90deg, rgb(${RAMP_LOW.join(' ')}), rgb(${RAMP_HIGH.join(' ')}))`;

export function rampRgb(t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(RAMP_LOW[i] + (RAMP_HIGH[i] - RAMP_LOW[i]) * k)) as RGB;
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;

export function contrast(a: RGB, b: RGB) {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

/** Tinta de texto con contraste AA (≥ 4,5:1) sobre `bg`: la más suave que cumpla. */
const INKS = ['#d4d4d8', '#fafafa', '#09090b'];
export function inkOn(bg: RGB): string {
  let best = INKS[0];
  let bestC = 0;
  for (const ink of INKS) {
    const c = contrast(bg, hexRgb(ink));
    if (c >= 4.5) return ink;
    if (c > bestC) [best, bestC] = [ink, c];
  }
  return best;
}

export const rgbCss = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`;

export interface InstanceFacts {
  size: number;
  matrix: number[][];
  /** Orden (1-based) del arco i→j en el tour. */
  arcOrder: Map<string, number>;
  min: number;
  max: number;
  mean: number;
  tourMean: number;
  symmetric: boolean;
  /** Posición de cada nodo en el tour (depósito = 0). */
  visit: Map<number, number>;
  /** Índice del paso que llega a cada nodo (depósito = último paso). */
  stepTo: Map<number, number>;
  sumAlpha: number;
  sumBeta: number;
  peakLoad: number;
  peakStep: number;
}

export function instanceFacts(solution: SolutionData): InstanceFacts {
  const matrix = solution.distMatrix ?? [];
  const size = matrix.length;
  const arcOrder = new Map<string, number>();
  const tour = solution.tour;
  for (let k = 0; k < tour.length - 1; k++) arcOrder.set(`${tour[k]}-${tour[k + 1]}`, k + 1);

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  let symmetric = true;
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++) {
      if (i === j) continue;
      const v = matrix[i]?.[j];
      if (v === undefined || v >= INF) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
      count++;
      if (matrix[j]?.[i] !== v) symmetric = false;
    }

  let tourSum = 0;
  let tourCount = 0;
  for (const key of arcOrder.keys()) {
    const [i, j] = key.split('-').map(Number);
    const v = matrix[i]?.[j];
    if (v !== undefined && v < INF) {
      tourSum += v;
      tourCount++;
    }
  }

  const visit = new Map<number, number>();
  tour.forEach((id, k) => {
    if (!visit.has(id)) visit.set(id, k);
  });
  const stepTo = new Map<number, number>();
  solution.steps.forEach((s, k) => stepTo.set(s.to, k));

  const customers = solution.nodes.filter((n) => !n.isDepot && n.id !== 0);
  let peakLoad = 0;
  let peakStep = 0;
  solution.steps.forEach((s, k) => {
    const load = s.aOnTruck + s.bOnTruck;
    if (load > peakLoad) [peakLoad, peakStep] = [load, k];
  });

  return {
    size,
    matrix,
    arcOrder,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean: count ? sum / count : 0,
    tourMean: tourCount ? tourSum / tourCount : 0,
    symmetric,
    visit,
    stepTo,
    sumAlpha: customers.reduce((a, n) => a + n.alpha, 0),
    sumBeta: customers.reduce((a, n) => a + n.beta, 0),
    peakLoad,
    peakStep,
  };
}

/** Salta a la parada `stepIndex` del simulador y desplaza la vista hasta él. */
export function jumpToSimulator(select: () => void) {
  select();
  window.requestAnimationFrame(() => document.getElementById('simulador')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }));
}
