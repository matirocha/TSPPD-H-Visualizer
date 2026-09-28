/**
 * Datos de la sección Heurísticas: carga de Outputs/Erdogan2012/ (vía /api/heuristics o
 * el paquete estático), unión por instancia y resúmenes. Todo se deriva de los archivos
 * que exportan los scripts de Python; nada se recalcula ni se inventa en el navegador.
 */
import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../../state/SimulationProvider';
import { fetchHeuristics } from '../../lib/api';
import { MODELS } from '../../lib/models';
import type { ModelType } from '../../types/solution';
import type { DPEvaluation, DPFile, HeuristicsBundle, ILSFile, TourCost } from '../../types/heuristics';

/**
 * Tolerancia para comparar costos: Gurobi exporta la manipulación redondeada a 2 decimales
 * y h = 0,1, así que dos valores "iguales" pueden diferir en menos de medio centésimo.
 */
export const COST_EPS = 0.005 + 1e-9;
export const sameCost = (a: number, b: number) => Math.abs(a - b) <= COST_EPS;

export interface HeurInstance {
  key: string;
  numCustomers: number;
  instanceId: number;
  dp: DPFile | null;
  ils: ILSFile | null;
}

export const instanceKey = (n: number, id: number) => `${n}-${id}`;

/** Une los archivos DP e ILS por (clientes, instancia), ordenados. */
export function joinInstances(bundle: Pick<HeuristicsBundle, 'dp' | 'ils'>): HeurInstance[] {
  const map = new Map<string, HeurInstance>();
  const slot = (n: number, id: number) => {
    const key = instanceKey(n, id);
    let v = map.get(key);
    if (!v) {
      v = { key, numCustomers: n, instanceId: id, dp: null, ils: null };
      map.set(key, v);
    }
    return v;
  };
  for (const d of bundle.dp) slot(d.numCustomers, d.instanceId).dp = d;
  for (const s of bundle.ils) slot(s.numCustomers, s.instanceId).ils = s;
  return [...map.values()].sort((a, b) => a.numCustomers - b.numCustomers || a.instanceId - b.instanceId);
}

export function findInstance(list: HeurInstance[], n: number | null | undefined, id: number | null | undefined): HeurInstance | null {
  if (n == null || id == null) return null;
  return list.find((x) => x.numCustomers === n && x.instanceId === id) ?? null;
}

export const customerCountsOf = (list: HeurInstance[]) => [...new Set(list.map((x) => x.numCustomers))].sort((a, b) => a - b);

/** Evaluación del Algoritmo 2.1 + DP sobre el tour Gurobi de un modelo. */
export function evalFor(inst: HeurInstance | null, model: ModelType): DPEvaluation | null {
  return inst?.dp?.evaluations.find((e) => e.model === model) ?? null;
}

/** Solución Gurobi de un modelo (desde la evaluación DP o, si falta, desde la referencia del ILS). */
export function gurobiFor(inst: HeurInstance | null, model: ModelType): TourCost | null {
  const e = evalFor(inst, model);
  if (e) return { tour: e.tour, totalDistance: e.totalDistance, handlingCost: e.gurobiHandling, objectiveValue: e.gurobiObjective };
  const r = inst?.ils?.reference[model];
  if (r) return { tour: r.tour, totalDistance: r.totalDistance, handlingCost: r.handlingCost, objectiveValue: r.objectiveValue };
  return null;
}

/** Brecha relativa (a − ref) / ref, o null si no hay referencia positiva. */
export const relGap = (value: number, ref: number | null | undefined) => (ref && ref > 0 ? (value - ref) / ref : null);

/** Mismo recorrido (misma secuencia de nodos). */
export const sameTour = (a: number[] | null | undefined, b: number[] | null | undefined) =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

/** Mismo ciclo recorrido en sentido inverso. */
export const reversedTour = (a: number[] | null | undefined, b: number[] | null | undefined) =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[b.length - 1 - i]);

export interface HeurSummary {
  instances: number;
  /** Instancias con evaluación DP del tour de la Política 3. */
  dpChecks: number;
  /** …donde la DP reproduce la manipulación de Gurobi P3. */
  dpMatches: number;
  ilsCount: number;
  /** ILS-2dir con el mismo Z* que Gurobi P3. */
  ilsOptimal: number;
  meanGapPct: number | null;
  maxGapPct: number | null;
  /** Ahorro relativo medio de la DP frente a la manipulación de Gurobi en el tour de P1 / P2. */
  savingVsP1: number | null;
  savingVsP2: number | null;
  /** Rutas del Modelo General donde su manipulación (sin política) es menor que la de la DP. */
  generalBelowDp: number;
  generalChecks: number;
  /** Corridas (semillas) que alcanzan el mejor valor de su instancia. */
  runsHit: number;
  runsTotal: number;
  /** Tiempo medio de una corrida ILS (ambas direcciones), en segundos. */
  meanRunSec: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function summarize(list: HeurInstance[]): HeurSummary {
  let dpChecks = 0;
  let dpMatches = 0;
  let ilsCount = 0;
  let ilsOptimal = 0;
  let generalBelowDp = 0;
  let generalChecks = 0;
  let runsHit = 0;
  let runsTotal = 0;
  const gaps: number[] = [];
  const s1: number[] = [];
  const s2: number[] = [];
  const times: number[] = [];

  for (const inst of list) {
    const p3 = evalFor(inst, 'TSPPD-H_3');
    if (p3) {
      dpChecks++;
      if (sameCost(p3.handlingDP, p3.gurobiHandling)) dpMatches++;
    }
    const p1 = evalFor(inst, 'TSPPD-H_1');
    if (p1 && p1.gurobiHandling > 0) s1.push((p1.gurobiHandling - p1.handlingDP) / p1.gurobiHandling);
    const p2 = evalFor(inst, 'TSPPD-H_2');
    if (p2 && p2.gurobiHandling > 0) s2.push((p2.gurobiHandling - p2.handlingDP) / p2.gurobiHandling);
    const gen = evalFor(inst, 'TSPPD-H');
    if (gen) {
      generalChecks++;
      if (gen.gurobiHandling < gen.handlingDP - 1e-9 && !sameCost(gen.gurobiHandling, gen.handlingDP)) generalBelowDp++;
    }
    const ils = inst.ils;
    if (ils) {
      ilsCount++;
      const ref = gurobiFor(inst, 'TSPPD-H_3');
      if (ref) {
        const g = relGap(ils.best.objectiveValue, ref.objectiveValue);
        if (g !== null) gaps.push(g * 100);
        if (sameCost(ils.best.objectiveValue, ref.objectiveValue)) ilsOptimal++;
      }
      runsHit += ils.runsSummary.hitsBest;
      runsTotal += ils.runsSummary.objectives.length;
      times.push(...ils.runsSummary.timesSec);
    }
  }

  return {
    instances: list.length,
    dpChecks,
    dpMatches,
    ilsCount,
    ilsOptimal,
    meanGapPct: mean(gaps),
    maxGapPct: gaps.length ? Math.max(...gaps) : null,
    savingVsP1: mean(s1),
    savingVsP2: mean(s2),
    generalBelowDp,
    generalChecks,
    runsHit,
    runsTotal,
    meanRunSec: mean(times),
  };
}

/** Modelos Gurobi en el orden canónico, con su evaluación DP (si existe). */
export function evaluationsInOrder(inst: HeurInstance | null) {
  return MODELS.map((model) => ({ model, evaluation: evalFor(inst, model.id) }));
}

export interface HeuristicsState {
  bundle: HeuristicsBundle | null;
  instances: HeurInstance[];
  loading: boolean;
  error: string | null;
}

/**
 * Carga los resultados al montar la sección y cada vez que el catálogo se recarga
 * (botón de recarga de la barra superior), de modo que un nuevo `python …` se vea sin
 * reiniciar el servidor.
 */
export function useHeuristics(): HeuristicsState {
  const { source, solutions } = useCatalog();
  const [state, setState] = useState<{ bundle: HeuristicsBundle | null; loading: boolean; error: string | null }>({
    bundle: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!source) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetchHeuristics(source)
      .then((bundle) => {
        if (alive) setState({ bundle, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (alive) setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
      });
    return () => {
      alive = false;
    };
  }, [source, solutions]);

  const instances = useMemo(() => (state.bundle ? joinInstances(state.bundle) : []), [state.bundle]);
  return { ...state, instances };
}
