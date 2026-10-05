// Formato del benchmark de metaheurísticas a gran escala que exporta notebooks/erdogan2012/benchmark.mjs
// en Outputs/BenchmarkErdogan2012/ (benchmark_metaheuristicas.json + registros.jsonl) y de las cifras
// del paper (paper_erdogan2012.json, notebooks/erdogan2012/paper_tables.py). La API y el paquete
// estático entregan los registros sin tours ni trazas por óptimo local (solo `history`).
import type { DataSource } from './solution';

/** Métodos de la grilla por defecto, en el orden de las Tablas 8–9. */
export type MetaMethod = 'twophase' | 'ils-heuristic' | 'ils-exact' | 'its-heuristic' | 'its-exact';
/** Variantes opcionales (ILS con descenso completo): pueden aparecer si se ejecutaron. */
export type MetaExtraMethod = 'ilsd-heuristic' | 'ilsd-exact';
export type MetaAnyMethod = MetaMethod | MetaExtraMethod;
export type MetaAlgo = 'ils' | 'its';
export type MetaMode = 'exact' | 'heuristic';
/** 1dir: corrida desde el tour TSP. 2dir: mejor de las corridas desde el tour y desde el tour invertido. */
export type MetaDirection = '1dir' | '2dir';

interface MetaRecordBase {
  /** `${method}|${n}|${id}` (tsp, twophase) o `${method}|${n}|${id}|${dir}` (metaheurísticas). */
  key: string;
  n: number;
  id: number;
  /** h_a = h_b de la instancia (el de las Tablas 8–9 del paper). */
  h: number;
  config: Record<string, unknown>;
  status: 'ok' | 'error';
  error?: string;
  finishedAt: string;
  worker?: number;
}

export interface MetaTspRecord extends MetaRecordBase {
  method: 'tsp';
  /** Largo del ciclo TSP (depósito + clientes). */
  length?: number;
  timeSec?: number;
  bestRestart?: number;
}

export interface MetaSolution {
  /** Z = ruteo + manipulación óptima (Alg. 2.1 + DP). */
  objective: number;
  distance: number;
  handling: number;
  depotShift?: number;
}

export interface MetaTwoPhaseDir extends MetaSolution {
  dir: 1 | 2;
  feasibleShifts?: number;
  /** Estimación de la heurística lineal (§2.2) para el mismo tour. */
  handlingHeuristic?: number;
  /** Segundos de reubicar el depósito en esa dirección. */
  timeSec: number;
}

export interface MetaTwoPhaseRecord extends MetaRecordBase {
  method: 'twophase';
  /** 'paper': la dirección 1 reproduce la «Initial solution, 1 dir.» del paper; 'default': por convención. */
  orientation?: 'paper' | 'default';
  timeSec?: number;
  dirs?: MetaTwoPhaseDir[];
}

export interface MetaRunRecord extends MetaRecordBase {
  method: Exclude<MetaAnyMethod, 'twophase'>;
  algo?: MetaAlgo;
  mode?: MetaMode;
  dir: 1 | 2;
  orientation?: 'paper' | 'default';
  nRand?: number;
  tabuLength?: number | null;
  initial?: MetaSolution;
  best?: MetaSolution;
  /** Segundos de la reubicación del depósito (solución inicial) en esta dirección. */
  initSec?: number;
  /** Segundos de la metaheurística en esta dirección. */
  runSec?: number;
  bestIteration?: number;
  improvements?: number;
  /** Movimientos aplicados por la búsqueda local (ILS) o por el TS interno (ITS). */
  lsMoves?: number;
  rejectedMoves?: number | null;
  discardedRandomMoves?: number;
  evals?: { exact: number; heuristic: number; scanned: number; pruned: number; infeasible: number };
  /** costCurrent tras cada iteración (ILS: Niter valores; ITS: N*iter valores). */
  history?: number[];
}

export type MetaRecord = MetaTspRecord | MetaTwoPhaseRecord | MetaRunRecord;

export interface MetaMeta {
  cpu: string;
  logicalCpus: number | null;
  os: string;
  runtime: string;
  workers: number;
  params: {
    nIter: number;
    d: number;
    nIterIts: number;
    tabuRatio: number;
    seed: number;
    ilsLsRule: 'incumbent' | 'descent';
    tsp: { kicks: number; restarts: number; method: string };
  };
  /** h por |Vc| (claves "20", "40", …). */
  h: Record<string, number>;
  grid: { sizes: number[]; ids: number[]; methods: MetaAnyMethod[] };
}

export interface MetaFile {
  title: string;
  reference: string;
  generatedAt: string;
  /** null si se reconstruyó desde registros.jsonl. */
  meta: MetaMeta | null;
  methods: { key: MetaAnyMethod; label: string }[];
  count: number;
  records: MetaRecord[];
}

/** Una fila de las Tablas 8–9 (2 dir. = corrida desde el tour invertido, por sí sola). */
export interface PaperRow {
  n: number;
  id: number;
  best: number;
  init1: number;
  init2: number;
  ilsH1: number;
  ilsH2: number;
  ilsE1: number;
  ilsE2: number;
  itsH1: number;
  itsH2: number;
  itsE1: number;
  itsE2: number;
}

export interface PaperByN {
  ilsExact1dirDevPct: number;
  ilsExact1dirTimeSec: number;
  itsExact1dirDevPct: number;
  itsExact1dirTimeSec: number;
  ilsExact2dirDevPct: number;
  itsExact2dirDevPct: number;
}

export interface PaperFile {
  source: string;
  pdf: string;
  machine: string;
  h: string;
  params: Record<string, unknown>;
  columns: Record<string, string>;
  note: string;
  instances: PaperRow[];
  /** Fila «Time (s)» de la Tabla 9: segundos promedio por columna (todas las instancias). */
  timeRowTable9: Record<'ilsH1' | 'ilsH2' | 'ilsE1' | 'ilsE2' | 'itsH1' | 'itsH2' | 'itsE1' | 'itsE2', number>;
  /** Tablas 2 y 3 por |Vc| (claves "20", "40", …). */
  byN: Record<string, PaperByN>;
  averages: PaperByN;
  validation: { tables67Match: boolean; deviationChecks: number; maxAbsDiffPct: number };
}

/** Una corrida del experimento de sensibilidad del ITS exacto a Nrand (dirección 1). */
export interface ItsNrandRun {
  n: number;
  id: number;
  nRand: number;
  /** Z de la solución inicial (dos fases, dirección 1; la misma del benchmark). */
  initial: number;
  best: number;
  improvements: number;
  bestIteration: number;
  runSec: number;
  paperInitial: number | null;
  /** ITS exacto «1 dir.» de las Tablas 8–9. */
  paperItsExact1dir: number | null;
  finishedAt?: string;
}

/** Outputs/BenchmarkErdogan2012/its_nrand.json (notebooks/erdogan2012/its_nrand.mjs). */
export interface ItsNrandFile {
  title: string;
  note: string;
  runs: ItsNrandRun[];
}

/** Resultado de la carga. data, paper e itsNrand son null si aún no existen. */
export interface MetaheuristicsBundle {
  data: MetaFile | null;
  paper: PaperFile | null;
  itsNrand: ItsNrandFile | null;
  source: DataSource;
}
