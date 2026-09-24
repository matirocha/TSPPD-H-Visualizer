import type { ModelType } from '../types/solution';

export type ModelTone = 'general' | 'p1' | 'p2' | 'p3';

export interface ModelMeta {
  id: ModelType;
  tone: ModelTone;
  /** Clave corta usada en la URL (#/p3/10/7). */
  hashKey: 'general' | 'p1' | 'p2' | 'p3';
  label: string;
  short: string;
  name: string;
  equations: string;
  script: string;
  /** Patrón de carga desde el frente (F, cabina) hasta la compuerta trasera (R). */
  pattern: string;
  summary: string;
}

export const MODELS: ModelMeta[] = [
  {
    id: 'TSPPD-H',
    tone: 'general',
    hashKey: 'general',
    label: 'General',
    short: 'Gen',
    name: 'TSPPD-H · Modelo general',
    equations: 'Ecs. 1–16',
    script: 'notebooks/tsppd_h_gurobi.py',
    pattern: '[F, posiciones libres, R]',
    summary: 'Cada unidad ocupa una posición k del camión; el modelo decide libremente dónde cargar, descargar y reubicar.',
  },
  {
    id: 'TSPPD-H_1',
    tone: 'p1',
    hashKey: 'p1',
    label: 'Política 1',
    short: 'P1',
    name: 'TSPPD-H₁ · Compuerta trasera',
    equations: 'Ecs. 17–25',
    script: 'notebooks/tsppd_h_1_gurobi.py',
    pattern: '[F, α…α, β…β, R]',
    summary: 'Las β recogidas quedan en la compuerta. Al entregar α en un cliente, todas las β a bordo se evacuan y recargan.',
  },
  {
    id: 'TSPPD-H_2',
    tone: 'p2',
    hashKey: 'p2',
    label: 'Política 2',
    short: 'P2',
    name: 'TSPPD-H₂ · Fondo del camión',
    equations: 'Ecs. 26–30',
    script: 'notebooks/tsppd_h_2_gurobi.py',
    pattern: '[F, β…β, α…α, R]',
    summary: 'Las β se ubican al fondo. Al recoger, las α que siguen en ruta se evacuan para abrir paso y luego se recargan.',
  },
  {
    id: 'TSPPD-H_3',
    tone: 'p3',
    hashKey: 'p3',
    label: 'Política 3',
    short: 'P3',
    name: 'TSPPD-H₃ · Híbrida',
    equations: 'Ecs. 31–48',
    script: 'notebooks/tsppd_h_3_gurobi.py',
    pattern: '[F, β…β, α…α, β…β, R]',
    summary: 'En cada cliente el modelo elige Política 1 (s_i = 1) o Política 2 (s_i = 0), formando hasta tres bloques de carga.',
  },
];

export const MODEL_BY_ID: Record<ModelType, ModelMeta> = Object.fromEntries(MODELS.map((m) => [m.id, m])) as Record<
  ModelType,
  ModelMeta
>;

export const modelMeta = (id: ModelType | undefined | null): ModelMeta => MODEL_BY_ID[id ?? 'TSPPD-H'];

/** Clases de chip por tono (texto + fondo + borde). */
export const TONE_CHIP: Record<ModelTone, string> = {
  general: 'text-zinc-100 bg-zinc-100/10 border-zinc-100/25',
  p1: 'text-p1 bg-p1/12 border-p1/35',
  p2: 'text-p2 bg-p2/12 border-p2/35',
  p3: 'tone-p3',
};

/** Color sólido representativo (para gráficos SVG). */
export const TONE_COLOR: Record<ModelTone, string> = {
  general: '#f4f4f5',
  p1: '#a78bfa',
  p2: '#a3e635',
  p3: '#5eead4',
};

export const POLICY_INFO = {
  1: {
    code: 'P1',
    s: 's_i = 1',
    title: 'Política 1 · compuerta',
    rule: 'Las β recogidas se cargan en la compuerta trasera.',
    consequence: 'Si más adelante hay entregas α, estas β deberán evacuarse y recargarse (costo h_b).',
    chip: 'text-p1 bg-p1/12 border-p1/35',
    color: '#a78bfa',
  },
  2: {
    code: 'P2',
    s: 's_i = 0',
    title: 'Política 2 · fondo',
    rule: 'Las α remanentes se evacúan y las β se ubican al fondo, junto a la cabina.',
    consequence: 'Se paga ahora (h_a por cada α remanente), pero las entregas siguientes quedan despejadas.',
    chip: 'text-p2 bg-p2/12 border-p2/35',
    color: '#a3e635',
  },
} as const;
