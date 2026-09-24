/**
 * Estado global de la simulación: catálogo de soluciones, solución activa,
 * coreografía LIFO y la máquina de estados de reproducción.
 *
 * Semántica de reproducción (heredada de la Página 10, con sus casos borde corregidos):
 *  - El camión recorre cada arco en TRANSIT_MS / velocidad.
 *  - Al llegar a un nodo se ejecutan las fases (sub-pasos) de la parada.
 *  - Modo continuo ON: todo avanza solo hasta terminar el tour.
 *  - Modo continuo OFF: la reproducción se pausa al llegar a cada parada; se avanza
 *    manualmente por los sub-pasos o se vuelve a pulsar Reproducir.
 *
 * El progreso del tramo (0→1, 60 fps) vive en un contexto aparte para que solo lo
 * consuman el mapa, la línea de tiempo y las métricas en vivo.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AnimationSpeed, DataSource, ModelType, PlaybackStatus, SolutionData, SolutionMeta, StepData } from '../types/solution';
import { fetchSolutionDetail, fetchSolutionsList, prefetchSolutions } from '../lib/api';
import { bayViewAt, buildChoreography, countLayout, type BayView, type Choreography, type Phase, type StopPlan } from '../lib/choreography';
import { findByHash, formatHash, parseHash } from '../lib/hash';
import * as P from './playback';
import { START, type PlaybackEnv, type PlaybackState } from './playback';

export const TRANSIT_MS = 3200;

export type SimMode = 'initial' | 'transit' | 'stop' | 'finished';

export interface SimActions {
  selectSolution: (filename: string) => void;
  /** Cambia de modelo manteniendo instancia y cantidad de clientes (con respaldo). */
  selectModel: (model: ModelType) => void;
  selectInstance: (numCustomers: number, instanceId: number, model?: ModelType) => void;
  refresh: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  prevStop: () => void;
  nextStop: () => void;
  selectStep: (stepIndex: number) => void;
  /** Posiciona el camión en el tramo `stepIndex` con avance `progress` (0–1). */
  seek: (stepIndex: number, progress: number) => void;
  setSubStep: (subStep: number) => void;
  nextSubStep: () => void;
  prevSubStep: () => void;
  continueJourney: () => void;
  setSpeed: (speed: AnimationSpeed) => void;
  setContinuous: (value: boolean) => void;
}

export interface SimContextValue {
  // Catálogo
  solutions: SolutionMeta[];
  source: DataSource | null;
  loading: boolean;
  error: string | null;
  selectedFilename: string;
  meta: SolutionMeta | null;
  activeModel: ModelType;
  // Solución activa
  solution: SolutionData | null;
  choreo: Choreography | null;
  /** Metadata de las 4 variantes (General, P1, P2, P3) de la instancia actual. */
  siblings: SolutionMeta[];
  // Reproducción
  stepIndex: number;
  arrived: boolean;
  subStep: number;
  finished: boolean;
  status: PlaybackStatus;
  speed: AnimationSpeed;
  continuous: boolean;
  // Derivados
  mode: SimMode;
  step: StepData | null;
  stop: StopPlan | null;
  phase: Phase | null;
  bay: BayView | null;
  actions: SimActions;
}

/** Subconjunto estable (no cambia con la reproducción) de SimContextValue. */
export type CatalogValue = Pick<
  SimContextValue,
  'solutions' | 'source' | 'loading' | 'error' | 'selectedFilename' | 'meta' | 'activeModel' | 'solution' | 'choreo' | 'siblings' | 'actions'
>;

interface ProgressStore {
  get: () => number;
  set: (v: number) => void;
  subscribe: (cb: () => void) => () => void;
}

function createProgressStore(): ProgressStore {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (v) => {
      if (v === value) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

const SimContext = createContext<SimContextValue | null>(null);
const CatalogContext = createContext<CatalogValue | null>(null);
const ProgressContext = createContext<ProgressStore>(createProgressStore());

/** Estado completo, incluida la reproducción (cambia en cada sub-paso). */
export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim debe usarse dentro de <SimulationProvider>');
  return ctx;
}

/**
 * Catálogo, solución activa y acciones. No cambia durante la reproducción: úsalo en
 * las secciones que no siguen al camión (comparativa, modelo, datos, pie…).
 */
export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <SimulationProvider>');
  return ctx;
}

/** Avance del tramo actual (0–1). Se actualiza a 60 fps durante el tránsito. */
export function useProgress(): number {
  const store = useContext(ProgressContext);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export interface LiveMetrics {
  traveledKm: number;
  totalKm: number;
  handlingSoFar: number;
  opsSoFar: number;
  zSoFar: number;
  load: { A: number; B: number; empty: number };
  loadRatio: number;
  customersServed: number;
  /** Posición global del camión en el tour (0–1, proporcional a la distancia). */
  tourRatio: number;
}

/**
 * Costo de manipulación ya pagado en una parada tras ejecutar las fases 0..j.
 * Cada unidad evacuada cuesta h_a (α) o h_b (β). Una parada de Política 3 con s_i = 0
 * puede tener dos fases con costo (β de la compuerta y luego α remanentes), así que el
 * costo se acumula fase a fase; completadas todas, se usa el valor exacto del solver.
 */
export function stopHandlingUntil(stop: StopPlan, j: number, choreo: Choreography, solution: SolutionData) {
  const lastCosted = stop.phases.reduce((acc, p, i) => (p.costedUnits > 0 ? i : acc), -1);
  const step = solution.steps[stop.stepIndex];
  if (lastCosted < 0 || j < 0) return { cost: 0, ops: 0 };
  if (j >= lastCosted) return { cost: step.handlingCost, ops: step.handlingCount };
  const ha = solution.h_a ?? solution.h;
  const hb = solution.h_b ?? solution.h;
  let cost = 0;
  let ops = 0;
  for (const p of stop.phases.slice(0, j + 1)) {
    for (const [id, m] of Object.entries(p.motions)) {
      if (m !== 'evac') continue;
      ops++;
      cost += choreo.units[id]?.type === 'A' ? ha : hb;
    }
  }
  return { cost, ops };
}

/** Métricas acumuladas "hasta ahora", sincronizadas con la reproducción. */
export function useLiveMetrics(): LiveMetrics | null {
  const sim = useSim();
  const progress = useProgress();
  return useMemo(() => {
    const { solution, choreo, bay, stepIndex, arrived, mode, stop, subStep } = sim;
    if (!solution || !choreo || !bay) return null;
    const steps = solution.steps;
    const totalKm = solution.totalDistance || steps.reduce((a, s) => a + s.distance, 0);
    let traveled = 0;
    let handling = 0;
    let ops = 0;
    let served = 0;
    if (mode !== 'initial') {
      for (let i = 0; i < stepIndex; i++) {
        traveled += steps[i].distance;
        handling += steps[i].handlingCost;
        ops += steps[i].handlingCount;
        if (steps[i].to !== 0) served++;
      }
      const cur = steps[stepIndex];
      traveled += arrived ? cur.distance : cur.distance * progress;
      if (arrived && stop) {
        const paid = stopHandlingUntil(stop, subStep, choreo, solution);
        handling += paid.cost;
        ops += paid.ops;
      }
      if (arrived && stop && cur.to !== 0 && subStep >= stop.phases.length - 1) served++;
    }
    if (mode === 'finished') {
      traveled = totalKm;
      handling = solution.handlingCost;
      ops = steps.reduce((a, s) => a + s.handlingCount, 0);
    }
    const load = countLayout(choreo, bay.layout);
    return {
      traveledKm: traveled,
      totalKm,
      handlingSoFar: handling,
      opsSoFar: ops,
      zSoFar: traveled + handling,
      load,
      loadRatio: (load.A + load.B) / (choreo.capacity || 1),
      customersServed: served,
      tourRatio: totalKm > 0 ? Math.min(1, traveled / totalKm) : 0,
    };
  }, [sim, progress]);
}

function pickDefault(list: SolutionMeta[], prev: string): string {
  if (list.some((s) => s.filename === prev)) return prev;
  const fromHash = findByHash(list, parseHash(window.location.hash));
  if (fromHash) return fromHash.filename;
  return (list.find((s) => s.numCustomers === 10) ?? list[0])?.filename ?? '';
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  // ── Catálogo y solución
  const [solutions, setSolutions] = useState<SolutionMeta[]>([]);
  const [source, setSource] = useState<DataSource | null>(null);
  const [selectedFilename, setSelectedFilename] = useState('');
  const [solution, setSolution] = useState<SolutionData | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Reproducción
  const [pb, setPb] = useState<PlaybackState>(START);
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const [continuous, setContinuous] = useState(true);

  const choreo = useMemo(() => (solution ? buildChoreography(solution) : null), [solution]);

  // Datos que las transiciones necesitan sin re-crear las acciones
  const dataRef = useRef({ lastStep: 0, phaseCounts: [] as number[], continuous: true, solutions: [] as SolutionMeta[], meta: null as SolutionMeta | null });
  dataRef.current.lastStep = (solution?.steps.length ?? 1) - 1;
  dataRef.current.phaseCounts = choreo?.stops.map((s) => s.phases.length) ?? [];
  dataRef.current.continuous = continuous;
  dataRef.current.solutions = solutions;
  const env = useCallback(
    (): PlaybackEnv => ({
      lastStep: dataRef.current.lastStep,
      phaseCounts: dataRef.current.phaseCounts,
      continuous: dataRef.current.continuous,
    }),
    [],
  );

  const meta = useMemo(() => solutions.find((s) => s.filename === selectedFilename) ?? null, [solutions, selectedFilename]);
  dataRef.current.meta = meta;
  const activeModel: ModelType = solution?.model ?? meta?.model ?? 'TSPPD-H';

  const siblings = useMemo(
    () =>
      meta
        ? solutions.filter((s) => s.numCustomers === meta.numCustomers && s.instanceId === meta.instanceId)
        : [],
    [solutions, meta],
  );

  // ── Carga del catálogo. Cada recarga incrementa `reloadToken` para volver a pedir
  //    también el detalle activo (Reintentar / Recargar tras re-ejecutar el solver).
  const [reloadToken, setReloadToken] = useState(0);
  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const { solutions: list, source: src } = await fetchSolutionsList();
      setSolutions(list);
      setSource(src);
      setSelectedFilename((prev) => pickDefault(list, prev));
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // ── Carga del detalle (ignora respuestas obsoletas). La caché se invalida por mtime.
  const requestRef = useRef(0);
  const solutionRef = useRef<{ filename: string; data: SolutionData } | null>(null);
  const metaMtime = meta?.mtime;
  useEffect(() => {
    if (!selectedFilename || !source) return;
    const req = ++requestRef.current;
    setDetailLoading(true);
    fetchSolutionDetail(selectedFilename, source, metaMtime)
      .then((data) => {
        if (req !== requestRef.current) return;
        const prev = solutionRef.current;
        const unchanged = prev?.filename === selectedFilename && (prev.data === data || JSON.stringify(prev.data) === JSON.stringify(data));
        setError(null);
        if (unchanged) return; // misma solución: se conserva la reproducción en curso
        solutionRef.current = { filename: selectedFilename, data };
        setSolution(data);
        setPb(START);
      })
      .catch((err: Error) => {
        if (req !== requestRef.current) return;
        setError(err.message);
        // No dejar en pantalla una solución distinta de la seleccionada
        if (solutionRef.current?.filename !== selectedFilename) {
          solutionRef.current = null;
          setSolution(null);
        }
      })
      .finally(() => req === requestRef.current && setDetailLoading(false));
  }, [selectedFilename, source, metaMtime, reloadToken]);

  // ── URL compartible (#/p3/10/7) y precarga de las variantes hermanas
  useEffect(() => {
    if (!meta) return;
    const hash = formatHash(meta);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [meta]);

  useEffect(() => {
    const onHash = () => {
      const found = findByHash(dataRef.current.solutions, parseHash(window.location.hash));
      if (found) setSelectedFilename(found.filename);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (source && siblings.length) prefetchSolutions(siblings.map((s) => ({ filename: s.filename, mtime: s.mtime })), source);
  }, [siblings, source]);

  // ── Motor de tránsito (requestAnimationFrame)
  useEffect(() => {
    if (pb.status !== 'playing' || pb.arrived || pb.finished || !solution) return;
    let raf = 0;
    let last: number | null = null;
    const duration = TRANSIT_MS / speed;
    const frame = (t: number) => {
      const delta = last === null ? 0 : Math.min(t - last, 100);
      last = t;
      setPb((s) => P.tick(s, delta, duration, env()));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pb.status, pb.arrived, pb.finished, pb.stepIndex, speed, solution]);

  // ── Avance automático de sub-pasos en la parada
  useEffect(() => {
    if (pb.status !== 'playing' || !pb.arrived || pb.finished || !choreo) return;
    const phase = choreo.stops[pb.stepIndex]?.phases[pb.subStep];
    if (!phase) return;
    const { stepIndex: k, subStep: j } = pb;
    const timer = window.setTimeout(() => setPb((s) => P.autoAdvance(s, k, j, env())), phase.durationMs / speed);
    return () => window.clearTimeout(timer);
  }, [pb.status, pb.arrived, pb.finished, pb.stepIndex, pb.subStep, speed, choreo]);

  // ── Acciones (estables): delegan en las transiciones puras de ./playback
  const actions = useMemo<SimActions>(() => {
    const byMeta = (pred: (m: SolutionMeta) => boolean) => dataRef.current.solutions.find(pred);
    const apply = (fn: (s: PlaybackState, e: PlaybackEnv) => PlaybackState) => () => setPb((s) => fn(s, env()));

    return {
      selectSolution: (filename) => setSelectedFilename(filename),
      selectModel: (model) => {
        const cur = dataRef.current.meta;
        const n = cur?.numCustomers ?? 10;
        const id = cur?.instanceId ?? 1;
        const match =
          byMeta((s) => s.model === model && s.instanceId === id && s.numCustomers === n) ??
          byMeta((s) => s.model === model && s.numCustomers === n) ??
          byMeta((s) => s.model === model);
        if (match) setSelectedFilename(match.filename);
      },
      selectInstance: (numCustomers, instanceId, model) => {
        const m = model ?? dataRef.current.meta?.model ?? 'TSPPD-H';
        const match =
          byMeta((s) => s.model === m && s.numCustomers === numCustomers && s.instanceId === instanceId) ??
          byMeta((s) => s.numCustomers === numCustomers && s.instanceId === instanceId);
        if (match) setSelectedFilename(match.filename);
      },
      refresh: () => void loadList(),
      play: () => setPb(P.play),
      pause: () => setPb(P.pause),
      toggle: () => setPb(P.toggle),
      reset: () => setPb(START),
      prevStop: apply(P.prevStop),
      nextStop: apply(P.nextStop),
      selectStep: (k) => setPb((s) => P.selectStep(s, k, env())),
      seek: (k, p) => setPb((s) => P.seek(s, k, p, env())),
      setSubStep: (j) => setPb((s) => P.setSubStep(s, j, env())),
      nextSubStep: apply(P.nextSubStep),
      prevSubStep: apply(P.prevSubStep),
      continueJourney: apply(P.continueJourney),
      setSpeed: (v) => setSpeed(v),
      setContinuous: (v) => setContinuous(v),
    };
  }, [loadList, env]);

  // ── Derivados
  const atStart = pb.stepIndex === 0 && !pb.arrived && pb.progress === 0;
  const mode: SimMode = pb.finished ? 'finished' : pb.arrived ? 'stop' : atStart ? 'initial' : 'transit';
  const step = solution?.steps[pb.stepIndex] ?? null;
  const stop = choreo?.stops[pb.stepIndex] ?? null;
  const bay = useMemo(
    () => (choreo ? bayViewAt(choreo, pb.stepIndex, pb.arrived, pb.subStep, mode === 'initial') : null),
    [choreo, pb.stepIndex, pb.arrived, pb.subStep, mode],
  );
  const phase = pb.arrived ? bay?.phase ?? null : null;

  const value = useMemo<SimContextValue>(
    () => ({
      solutions,
      source,
      loading: listLoading || detailLoading,
      error,
      selectedFilename,
      meta,
      activeModel,
      solution,
      choreo,
      siblings,
      stepIndex: pb.stepIndex,
      arrived: pb.arrived,
      subStep: pb.subStep,
      finished: pb.finished,
      status: pb.status,
      speed,
      continuous,
      mode,
      step,
      stop,
      phase,
      bay,
      actions,
    }),
    [
      solutions,
      source,
      listLoading,
      detailLoading,
      error,
      selectedFilename,
      meta,
      activeModel,
      solution,
      choreo,
      siblings,
      pb.stepIndex,
      pb.arrived,
      pb.subStep,
      pb.finished,
      pb.status,
      speed,
      continuous,
      mode,
      step,
      stop,
      phase,
      bay,
      actions,
    ],
  );

  // Catálogo y solución: cambia solo al cargar datos o elegir otra solución, nunca por
  // la reproducción. Las secciones que no siguen al camión se suscriben solo a esto.
  const catalog = useMemo<CatalogValue>(
    () => ({
      solutions,
      source,
      loading: listLoading || detailLoading,
      error,
      selectedFilename,
      meta,
      activeModel,
      solution,
      choreo,
      siblings,
      actions,
    }),
    [solutions, source, listLoading, detailLoading, error, selectedFilename, meta, activeModel, solution, choreo, siblings, actions],
  );

  // Progreso a 60 fps: store externo (useSyncExternalStore) para no propagar un cambio
  // de contexto por todo el árbol en cada cuadro.
  const progressStore = useRef<ProgressStore>(createProgressStore()).current;
  useLayoutEffect(() => {
    progressStore.set(pb.progress);
  }, [pb.progress, progressStore]);

  return (
    <CatalogContext.Provider value={catalog}>
      <SimContext.Provider value={value}>
        <ProgressContext.Provider value={progressStore}>{children}</ProgressContext.Provider>
      </SimContext.Provider>
    </CatalogContext.Provider>
  );
}
