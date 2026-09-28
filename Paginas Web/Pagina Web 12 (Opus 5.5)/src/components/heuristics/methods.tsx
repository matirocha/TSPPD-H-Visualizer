/**
 * Identidad visual de los métodos que compara la sección Heurísticas: los cuatro
 * modelos Gurobi (tonos de lib/models) más el Algoritmo 2.1 + DP (ámbar ▲) y el
 * ILS · Algoritmo 4.2 (azul ★). Codificación doble color + forma, como ModelMark.
 */
import { MODELS, TONE_COLOR, type ModelTone } from '../../lib/models';
import type { ModelType } from '../../types/solution';
import { COLOR } from '../analysis/chart';
import { ModelMarkSvg } from '../analysis/ModelMark';

export type HeurTone = 'dp' | 'ils';
export type MethodTone = ModelTone | HeurTone;

/** Colores sólidos para SVG (espejo de --color-dp / --color-ils de index.css). */
export const HEUR_COLOR: Record<HeurTone, string> = { dp: '#fbbf24', ils: '#60a5fa' };
export const METHOD_COLOR: Record<MethodTone, string> = { ...TONE_COLOR, ...HEUR_COLOR };

export interface HeurMethodMeta {
  tone: HeurTone;
  label: string;
  short: string;
  /** Sección y ecuaciones del paper. */
  reference: string;
  script: string;
  summary: string;
}

export const HEUR_METHODS: Record<HeurTone, HeurMethodMeta> = {
  dp: {
    tone: 'dp',
    label: 'Algoritmo 2.1 + DP',
    short: 'Alg. 2.1',
    reference: '§2.1 · Ecs. (1)–(2)',
    script: 'notebooks/tsppd_h_alg21_dp.py',
    summary:
      'Para una ruta fija, calcula en O(n²) la manipulación óptima de la Política 3: en qué clientes conviene pasar las β al fondo (Política 2) y en cuáles dejarlas en la compuerta (Política 1).',
  },
  ils: {
    tone: 'ils',
    label: 'ILS · Algoritmo 4.2',
    short: 'ILS',
    reference: '§4.2 · Algoritmo 4.2',
    script: 'notebooks/tsppd_h_alg42_ils.py',
    summary:
      'Iterated Local Search: perturba al azar la mejor ruta y la mejora con movimientos relocate y 2-opt, evaluando cada vecino con ruteo + manipulación exacta (Algoritmo 2.1 + DP).',
  },
};

/** Paper de las heurísticas (verificado contra papers/Erdogan2012.pdf). */
export const ERDOGAN_REF = {
  authors: 'Erdoğan, G., Battarra, M., Laporte, G. y Vigo, D. (2012)',
  title: 'Metaheuristics for the traveling salesman problem with pickups, deliveries and handling costs',
  journal: 'Computers & Operations Research',
  volume: '39',
  pages: '1074–1086',
  doi: '10.1016/j.cor.2011.07.013',
  pdf: 'papers/Erdogan2012.pdf',
} as const;

/** Tono de un modelo Gurobi (para usar MethodMark con ModelType). */
export const toneOfModel = (id: ModelType): ModelTone => MODELS.find((m) => m.id === id)?.tone ?? 'general';

/** Marca SVG: modelos Gurobi (○ ● ■ ◆), Algoritmo 2.1 (▲) e ILS (★). */
export function MethodMarkSvg({ tone, x, y, r = 4.5, ring = COLOR.surface }: { tone: MethodTone; x: number; y: number; r?: number; ring?: string }) {
  if (tone === 'dp') {
    const d = r * 1.35;
    return (
      <path
        d={`M${x},${y - d}L${x + d * 1.02},${y + d * 0.78}L${x - d * 1.02},${y + d * 0.78}Z`}
        fill={HEUR_COLOR.dp}
        stroke={ring}
        strokeWidth={2}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    );
  }
  if (tone === 'ils') {
    const outer = r * 1.45;
    const inner = outer * 0.45;
    let d = '';
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      d += `${k === 0 ? 'M' : 'L'}${(x + rad * Math.cos(a)).toFixed(2)},${(y + rad * Math.sin(a)).toFixed(2)}`;
    }
    return <path d={`${d}Z`} fill={HEUR_COLOR.ils} stroke={ring} strokeWidth={2} strokeLinejoin="round" paintOrder="stroke" />;
  }
  return <ModelMarkSvg tone={tone} x={x} y={y} r={r} ring={ring} />;
}

/** Versión HTML (leyendas, tablas y tarjetas). */
export function MethodMark({ tone, size = 12 }: { tone: MethodTone; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 12 12" className="shrink-0 overflow-visible">
      <MethodMarkSvg tone={tone} x={6} y={6.3} r={4.25} ring="transparent" />
    </svg>
  );
}
