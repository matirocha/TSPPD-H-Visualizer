/**
 * Identidad de los seis métodos del benchmark en la sección «Tiempos»: mismo tono y forma
 * que en el resto de la página (MethodMark: General ○ · P1 ● · P2 ■ · P3 ◆ · Dos fases ▲ · ILS ★).
 * «Dos fases» = ruta TSP + Algoritmo 2.1 + DP: el Algoritmo 2.1 solo calcula la manipulación de
 * una ruta fija, así que como método completo necesita que otra fase le entregue la ruta.
 */
import type { BenchMethod } from '../../types/benchmark';
import { MODELS, type ModelTone } from '../../lib/models';
import type { MethodTone } from '../heuristics/methods';

export interface BenchMethodInfo {
  method: BenchMethod;
  tone: MethodTone;
  /** Encabezado de tabla. */
  label: string;
  /** Forma corta (tooltips, leyendas compactas). */
  short: string;
  /** Explicación completa (atributo title de los encabezados). */
  title: string;
}

const eq = (tone: ModelTone) => MODELS.find((m) => m.tone === tone)?.equations ?? '';

export const BENCH_INFO: Record<BenchMethod, BenchMethodInfo> = {
  general: {
    method: 'general',
    tone: 'general',
    label: 'General',
    short: 'Gen',
    title: `Gurobi · Modelo General TSPPD-H (${eq('general')})`,
  },
  p1: { method: 'p1', tone: 'p1', label: 'Política 1', short: 'P1', title: `Gurobi · TSPPD-H₁, Política 1 (${eq('p1')})` },
  p2: { method: 'p2', tone: 'p2', label: 'Política 2', short: 'P2', title: `Gurobi · TSPPD-H₂, Política 2 (${eq('p2')})` },
  p3: { method: 'p3', tone: 'p3', label: 'Política 3', short: 'P3', title: `Gurobi · TSPPD-H₃, Política 3 (${eq('p3')})` },
  dp: {
    method: 'dp',
    tone: 'dp',
    label: 'Dos fases (TSP + Alg. 2.1)',
    short: 'Dos fases',
    title: 'Heurística de dos fases (como «Two-phase» de Battarra et al. 2010): 1) ruta = tour TSP con el depósito reubicado; 2) manipulación óptima de la Política 3 sobre esa ruta con el Algoritmo 2.1 + DP',
  },
  ils: {
    method: 'ils',
    tone: 'ils',
    label: 'ILS-2dir',
    short: 'ILS',
    title: 'ILS-2dir · Algoritmo 4.2 de Erdoğan et al. (2012), evaluación exacta con el Algoritmo 2.1 + DP',
  },
};
