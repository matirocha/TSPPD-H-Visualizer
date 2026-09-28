// Formato de los resultados de las heurísticas de Erdoğan et al. (2012) que exportan
// notebooks/tsppd_h_alg21_dp.py (Algoritmo 2.1 + DP) y notebooks/tsppd_h_alg42_ils.py
// (ILS, Algoritmo 4.2) en Outputs/Erdogan2012/.
import type { DataSource, ModelType } from './solution';

/** 1 = Política 1 (β en la compuerta) · 2 = Política 2 (β al fondo). */
export type StopPolicy = 1 | 2;

/** Una parada del tour con la decisión y el costo de la DP (simulación física de la carga). */
export interface HeurStop {
  /** Posición k = 1..n en el tour. */
  position: number;
  customer: number;
  alpha: number;
  beta: number;
  /** Carga al llegar: α a bordo, β en el fondo (frente) y β en la compuerta. */
  aArrival: number;
  bFrontArrival: number;
  bRearArrival: number;
  policy: StopPolicy;
  /** Unidades α / β descargadas y recargadas (operaciones adicionales). */
  opsA: number;
  opsB: number;
  cost: number;
  aDeparture: number;
  bFrontDeparture: number;
  bRearDeparture: number;
}

/** Algoritmo 2.1 + DP aplicado al tour que encontró Gurobi para un modelo. */
export interface DPEvaluation {
  model: ModelType;
  label: string;
  /** Archivo de Outputs/ con la solución Gurobi evaluada. */
  source: string;
  gurobiHandling: number;
  gurobiObjective: number;
  /** Costo y operaciones que Gurobi pagó en cada cliente (clave: id del cliente). */
  gurobiStops: Record<string, { cost: number; ops: number }>;
  /** Solo Política 3: decisión s_i de Gurobi traducida a 1 (s_i = 1) ó 2 (s_i = 0). */
  gurobiPolicies: Record<string, StopPolicy> | null;
  tour: number[];
  feasible: boolean;
  totalDistance: number;
  /** Manipulación óptima de la Política 3 en este tour (f(0) de la DP). */
  handlingDP: number;
  objectiveDP: number;
  /** Manipulación del mismo tour con Política 1 pura y Política 2 pura. */
  handlingP1: number;
  handlingP2: number;
  /** Política elegida por la DP en cada cliente (clave: id del cliente). */
  policies: Record<string, StopPolicy>;
  policy2Customers: number[];
  /** f(0..n) de la programación dinámica (índice = posición en el tour). */
  f: number[];
  detail: HeurStop[];
  dpTimeMs: number;
}

export interface HeurNode {
  id: number;
  alpha: number;
  beta: number;
}

export interface DPFile {
  filename: string;
  algorithm: 'alg21-dp';
  algorithmName: string;
  paper: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  h_a: number;
  h_b: number;
  capacity: number;
  nodes: HeurNode[];
  evaluations: DPEvaluation[];
  generatedAt: string;
}

export interface TourCost {
  tour: number[];
  totalDistance: number;
  handlingCost: number;
  objectiveValue: number;
}

export interface ILSBest extends TourCost {
  handlingP1: number;
  handlingP2: number;
  policies: Record<string, StopPolicy>;
  policy2Customers: number[];
  detail: HeurStop[];
  direction: 1 | 2;
  seed: number;
  bestIteration?: number;
}

/** Una ejecución del ILS desde una dirección del ciclo TSP (1 = original, 2 = inverso). */
export interface ILSDirection {
  direction: 1 | 2;
  seed: number;
  initial: TourCost & { depotShift: number; feasibleShifts: number };
  best: TourCost;
  bestIteration: number;
  improvements: number;
  localSearchMoves: number;
  discardedRandomMoves: number;
  dpCalls: number;
  neighborsScanned: number;
  timeSec: number;
  /** Mejor costo (costCurrent) tras cada iteración 1..Niter. */
  history: number[];
  /** Costo del óptimo local alcanzado en cada iteración 1..Niter. */
  localOptima: number[];
}

export interface ILSParams {
  nIter: number;
  nRand: number;
  d: number;
  seed: number;
  runs: number;
  neighborhood: string;
  evaluation: string;
  tspMethod: string;
  maxRandomTries: number;
}

export interface ILSRunsSummary {
  /** Z de ILS-2dir en cada corrida (semillas consecutivas). */
  objectives: number[];
  oneDirObjectives: number[];
  seeds: number[];
  timesSec: number[];
  min: number;
  mean: number;
  max: number;
  /** Corridas que alcanzan el mínimo. */
  hitsBest: number;
}

export interface GurobiReference {
  label: string;
  source: string;
  tour: number[];
  totalDistance: number;
  handlingCost: number;
  objectiveValue: number;
}

export interface ILSFile {
  filename: string;
  algorithm: 'alg42-ils';
  algorithmName: string;
  paper: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  h_a: number;
  h_b: number;
  capacity: number;
  params: ILSParams;
  nodes: HeurNode[];
  tsp: { tour: number[]; cost: number; method: string };
  /** ILS-2dir de la mejor corrida (menor Z; ante empate, la de menor semilla). */
  best: ILSBest;
  /** ILS-1dir (dirección 1) de esa misma corrida. */
  oneDir: ILSBest;
  /** Las dos direcciones de esa corrida, con su traza. */
  directions: ILSDirection[];
  runsSummary: ILSRunsSummary;
  reference: Partial<Record<ModelType, GurobiReference>>;
  gapToGurobiP3Pct: number | null;
  timeSec: number;
  generatedAt: string;
}

export interface HeuristicsBundle {
  dp: DPFile[];
  ils: ILSFile[];
  source: DataSource;
}
