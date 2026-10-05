// Formato del benchmark de tiempos que exporta notebooks/tsppd_h_benchmark.py en
// Outputs/Benchmark/benchmark_tiempos.json (una fila por método × instancia × h).
import type { DataSource } from './solution';

/** Métodos comparados, en el orden canónico de las tablas. */
export type BenchMethod = 'general' | 'p1' | 'p2' | 'p3' | 'dp' | 'ils';
export type GurobiMethod = Extract<BenchMethod, 'general' | 'p1' | 'p2' | 'p3'>;

/**
 * Estado de una ejecución. Gurobi: optimal · time_limit (con o sin incumbente) · infeasible …
 * Heurísticas: heuristic. Cualquier fallo del script: error.
 */
export type BenchStatus =
  | 'optimal'
  | 'time_limit'
  | 'infeasible'
  | 'inf_or_unbd'
  | 'unbounded'
  | 'interrupted'
  | 'numeric'
  | 'suboptimal'
  | 'heuristic'
  /** No se ejecutó a propósito (Modelo General con N > meta.generalMaxN: alto costo computacional). */
  | 'skipped'
  | 'error'
  | (string & {});

interface BenchRecordBase {
  /** `${method}|${numCustomers}|${instanceId}|${h}` */
  key: string;
  method: BenchMethod;
  label: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  /** Parámetros que identifican la configuración (TimeLimit, hilos, parámetros del ILS…). */
  config: Record<string, unknown>;
  /** Procesos simultáneos e hilos durante la medición. */
  parallel?: { workers: number | null; threads: number };
  status: BenchStatus;
  /** Solo Gurobi con Status = OPTIMAL. Las heurísticas siempre false. */
  optimal: boolean;
  finishedAt: string;
  error?: string;
  /** Motivo de un registro 'skipped'. */
  reason?: string;
  /** Segundos: Runtime de Gurobi (sin construir el modelo) o tiempo de pared de la heurística. */
  timeSec?: number;
  /** Costo total Z (ruteo + manipulación) de la mejor solución, o null si no hubo solución. */
  objective?: number | null;
  totalDistance?: number | null;
  /** Costo de manipulación z^H. */
  handlingCost?: number | null;
  tour?: number[] | null;
}

export interface GurobiRecord extends BenchRecordBase {
  method: GurobiMethod;
  model: 'TSPPD-H' | 'TSPPD-H_1' | 'TSPPD-H_2' | 'TSPPD-H_3';
  /** Tiempo de construcción del modelo en Python (no incluido en timeSec). */
  buildSec?: number;
  solCount?: number;
  nodeCount?: number;
  numVars?: number;
  numBinVars?: number;
  numConstrs?: number;
  /** Mejor cota inferior (ObjBound). */
  bound?: number | null;
  /** MIPGap de Gurobi en %: |ObjBound − ObjVal| / |ObjVal| · 100. */
  gapPct?: number | null;
}

export interface DPRecord extends BenchRecordBase {
  method: 'dp';
  /** Tiempo de construir el tour TSP (incluido en timeSec). */
  tspTimeSec?: number;
  tspMethod?: string;
  /** Llamadas a la DP para reubicar el depósito (dos direcciones). */
  dpCalls?: number;
  /** Milisegundos de una sola evaluación Algoritmo 2.1 + DP sobre el tour final. */
  dpTimeMs?: number;
}

export interface ILSRecord extends BenchRecordBase {
  method: 'ils';
  /** timeSec = promedio por ejecución ILS-2dir (ambas direcciones + tour inicial). */
  timeMinSec?: number;
  timeMaxSec?: number;
  /** Tiempo total de las `runs` ejecuciones. */
  totalTimeSec?: number;
  runs?: number;
  nRand?: number;
  tspMethod?: string;
  /** objective = mejor Z de las corridas; también la media, el peor y el mejor ILS-1dir. */
  objectiveMean?: number;
  objectiveMax?: number;
  objective1dir?: number;
  objectives?: number[];
  /** Corridas que alcanzaron el mejor Z. */
  hitsBest?: number;
}

export type BenchRecord = GurobiRecord | DPRecord | ILSRecord;

export interface BenchMeta {
  cpu: string;
  logicalCpus: number | null;
  os: string;
  python: string;
  gurobi: string | null;
  timeLimitSec: number;
  threads: number;
  workers: number;
  ils: { nIter: number; d: number; seed: number; runs: number };
  dpRepeats: number;
  /** Mayor N en que se ejecutó el Modelo General (null o ausente: sin tope). */
  generalMaxN?: number | null;
  /** Grilla diseñada del experimento (ausente en consolidados antiguos: usar DEFAULT_GRID). */
  grid?: { customers: number[]; ids: number[]; h: number[]; methods: BenchMethod[] };
}

/** Archivo Outputs/Benchmark/benchmark_tiempos.json tal como lo escribe el script. */
export interface BenchmarkFile {
  title: string;
  reference: string;
  generatedAt: string;
  /** null si el consolidado no se pudo leer y los registros se reconstruyeron desde registros.jsonl. */
  meta: BenchMeta | null;
  methods: { key: BenchMethod; label: string }[];
  count: number;
  records: BenchRecord[];
}

/** Resultado de la carga: null si aún no existe el archivo. */
export interface BenchmarkBundle {
  data: BenchmarkFile | null;
  source: DataSource;
}
