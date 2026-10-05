/**
 * Identidad de los cinco métodos de la sección «Metaheurísticas». La familia define el color
 * (Dos fases ámbar como el Algoritmo 2.1 de las otras secciones, ILS azul, ITS fucsia) y la
 * evaluación del vecindario el trazo: exacta = línea continua y marca rellena; heurística =
 * línea discontinua y marca hueca. Lo publicado en el paper va en gris (zinc) en todas partes.
 */
import type { MetaMethod } from '../../types/metaheuristics';

export type MetaFamily = 'twophase' | 'ils' | 'its';

export interface MetaMethodInfo {
  method: MetaMethod;
  family: MetaFamily;
  /** null en dos fases (no hay vecindario que evaluar). */
  evaluation: 'exact' | 'heuristic' | null;
  /** Encabezado de tabla. */
  label: string;
  /** Forma corta (leyendas, celdas angostas). */
  short: string;
  /** Explicación completa (title de los encabezados, notas). */
  title: string;
  /** Sección del paper. */
  reference: string;
}

/** Colores sólidos para SVG (espejo de --color-dp / --color-ils / --color-its de index.css). */
export const META_FAMILY_COLOR: Record<MetaFamily, string> = { twophase: '#fbbf24', ils: '#60a5fa', its: '#e879f9' };
/** Gris de lo publicado en el paper (zinc-400). */
export const PAPER_COLOR = '#a1a1aa';

export const META_INFO: Record<MetaMethod, MetaMethodInfo> = {
  twophase: {
    method: 'twophase',
    family: 'twophase',
    evaluation: null,
    label: 'Dos fases',
    short: 'Dos fases',
    title:
      'Dos fases (solución inicial del §4): 1) tour TSP con el depósito reubicado donde el costo es menor (Mosheiov 1994); 2) manipulación óptima de la Política 3 con el Algoritmo 2.1 + DP. Es la columna «Initial solution» de las Tablas 8–9.',
    reference: '§4 · solución inicial',
  },
  'ils-heuristic': {
    method: 'ils-heuristic',
    family: 'ils',
    evaluation: 'heuristic',
    label: 'ILS heurístico',
    short: 'ILS-H',
    title:
      'ILS · Algoritmo 4.2, con evaluación heurística lineal del vecindario (§2.2): el mejor movimiento según la estimación O(n) se re-evalúa con la DP exacta antes de aplicarlo.',
    reference: '§4.2 · Algoritmo 4.2 + §2.2',
  },
  'ils-exact': {
    method: 'ils-exact',
    family: 'ils',
    evaluation: 'exact',
    label: 'ILS exacto',
    short: 'ILS-E',
    title: 'ILS · Algoritmo 4.2, evaluando cada vecino con ruteo + manipulación óptima (Algoritmo 2.1 + DP, O(n²)).',
    reference: '§4.2 · Algoritmo 4.2 + §2.1',
  },
  'its-heuristic': {
    method: 'its-heuristic',
    family: 'its',
    evaluation: 'heuristic',
    label: 'ITS heurístico',
    short: 'ITS-H',
    title:
      'ITS · Algoritmo 4.3 (perturbación + Tabu Search del Algoritmo 4.1), con evaluación heurística lineal del vecindario y re-evaluación exacta del movimiento elegido.',
    reference: '§4.3 · Algoritmo 4.3 + §2.2',
  },
  'its-exact': {
    method: 'its-exact',
    family: 'its',
    evaluation: 'exact',
    label: 'ITS exacto',
    short: 'ITS-E',
    title: 'ITS · Algoritmo 4.3 (perturbación + Tabu Search del Algoritmo 4.1), evaluando cada vecino con el Algoritmo 2.1 + DP.',
    reference: '§4.3 · Algoritmo 4.3 + §2.1',
  },
};

export const methodColor = (m: MetaMethod) => META_FAMILY_COLOR[META_INFO[m].family];
/** Trazo SVG: discontinuo para la evaluación heurística. */
export const methodDash = (m: MetaMethod) => (META_INFO[m].evaluation === 'heuristic' ? '5 4' : undefined);
