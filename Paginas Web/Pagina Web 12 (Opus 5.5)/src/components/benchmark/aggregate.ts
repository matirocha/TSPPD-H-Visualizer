/**
 * Agregación del benchmark de tiempos (sección «Tiempos»), al estilo de las tablas de
 * Battarra, Erdoğan, Laporte & Vigo (2010, Tablas 2–4) y Erdoğan et al. (2012, Tabla 2).
 *
 * Módulo puro (sin React): lo usan los componentes y `node scripts/validate-benchmark.ts`.
 * Todo se deriva de Outputs/Benchmark/benchmark_tiempos.json tal como lo escribe
 * notebooks/tsppd_h_benchmark.py; los datos pueden estar incompletos (el benchmark corre en vivo),
 * así que cada combinación de la grilla existe aunque aún no tenga registros («pendiente»).
 *
 * Convenciones:
 *  · Medias sobre lo TERMINADO (sin errores). Las ejecuciones Gurobi que tocaron el límite de
 *    tiempo cuentan con su Runtime en `meanTimeSec` (estilo Erdoğan) y no en `meanTimeOptimalSec`
 *    (estilo Battarra, «Avg. seconds» solo de las resueltas).
 *  · Brecha (gap) solo de Gurobi factible no óptimo: |cota − z| / |z| · 100.
 *  · Desviación de cualquier método respecto de la referencia de la Política 3 de su instancia:
 *    (Z − ref) / ref · 100. DP e ILS buscan en el espacio de la Política 3; el Modelo General es
 *    una relajación (puede quedar bajo la referencia: desviación negativa).
 */
import type { BenchMethod, BenchRecord, BenchmarkFile, GurobiMethod, GurobiRecord, ILSRecord } from '../../types/benchmark';

/** Métodos en el orden canónico de las tablas. */
export const METHOD_ORDER: readonly BenchMethod[] = ['general', 'p1', 'p2', 'p3', 'dp', 'ils'];
export const GUROBI_METHODS: readonly GurobiMethod[] = ['general', 'p1', 'p2', 'p3'];

export function isGurobiMethod(m: BenchMethod): m is GurobiMethod {
  return m === 'general' || m === 'p1' || m === 'p2' || m === 'p3';
}

const isBenchMethod = (m: unknown): m is BenchMethod => typeof m === 'string' && (METHOD_ORDER as readonly string[]).includes(m);

/** Número finito o null (los JSON pueden traer null, ausente o basura). */
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const max = (xs: number[]): number | null => (xs.length ? Math.max(...xs) : null);

// ---------------------------------------------------------------------------------------------
// Grilla
// ---------------------------------------------------------------------------------------------

export interface BenchGrid {
  customers: number[];
  ids: number[];
  h: number[];
  methods: BenchMethod[];
}

/** Grilla por defecto del script (Battarra et al. 2010): |Vc| × Id 1..10 × h × 6 métodos = 900 registros. */
export const DEFAULT_GRID: BenchGrid = {
  customers: [5, 10, 15, 20, 25],
  ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  h: [0.1, 0.5, 1],
  methods: [...METHOD_ORDER],
};

/** h iguales salvo ruido de punto flotante (JSON 1.0 → 1, 0.1 + 1e-12 …). */
export function sameH(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** h como lo escribe Python con `{h:g}` en las claves: 0.1 → "0.1", 1.0 → "1". */
export const hKey = (h: number): string => String(Number(h.toPrecision(12)));

/** Clave de un registro: `${method}|${N}|${Id}|${h}` (misma forma que task_key del script). */
export const benchKey = (method: BenchMethod, n: number, id: number, h: number): string => `${method}|${n}|${id}|${hKey(h)}`;

/** Registro con los campos mínimos para ubicarlo en la grilla. */
function isPlaceable(r: unknown): r is BenchRecord {
  if (!r || typeof r !== 'object') return false;
  const x = r as Partial<BenchRecord>;
  return isBenchMethod(x.method) && Number.isInteger(x.numCustomers) && Number.isInteger(x.instanceId) && isNum(x.h);
}

const placeable = (file: BenchmarkFile | null): BenchRecord[] => (Array.isArray(file?.records) ? file.records.filter(isPlaceable) : []);

const intList = (v: unknown, fallback: number[]): number[] =>
  Array.isArray(v) && v.length ? v.filter((x): x is number => Number.isInteger(x)) : fallback;

/** Agrega h a la lista si no hay otro igual (sameH); devuelve el valor canónico. */
function canonH(list: number[], h: number): number {
  const found = list.find((x) => sameH(x, h));
  if (found !== undefined) return found;
  list.push(h);
  return h;
}

/**
 * Grilla del experimento: meta.grid si existe (consolidados nuevos) o DEFAULT_GRID, unida en ambos
 * casos a los valores observados en los registros (para que un registro fuera de la grilla
 * declarada, p. ej. de una corrida parcial anterior, nunca quede oculto).
 *
 * meta describe solo la ÚLTIMA invocación del script: si algún registro cae fuera de meta.grid,
 * esa invocación fue parcial (p. ej. se reanudó con `--customers 25` o se repitió un subconjunto)
 * y no describe el experimento; entonces se une también con DEFAULT_GRID para que los tamaños
 * aún sin registros (N = 20 en ese ejemplo) sigan apareciendo como pendientes.
 */
export function gridOf(file: BenchmarkFile | null): BenchGrid {
  const g = file?.meta?.grid;
  const records = placeable(file);
  const gCustomers = intList(g?.customers, DEFAULT_GRID.customers);
  const gIds = intList(g?.ids, DEFAULT_GRID.ids);
  const gH = Array.isArray(g?.h) && g.h.length ? g.h.filter((x): x is number => isNum(x)) : DEFAULT_GRID.h;
  const gMethods = Array.isArray(g?.methods) && g.methods.length ? g.methods.filter(isBenchMethod) : DEFAULT_GRID.methods;
  const partialMeta =
    !!g &&
    records.some(
      (r) => !gCustomers.includes(r.numCustomers) || !gIds.includes(r.instanceId) || !gH.some((x) => sameH(x, r.h)) || !gMethods.includes(r.method),
    );
  const customers = new Set([...gCustomers, ...(partialMeta ? DEFAULT_GRID.customers : [])]);
  const ids = new Set([...gIds, ...(partialMeta ? DEFAULT_GRID.ids : [])]);
  const hs: number[] = [];
  for (const h of [...gH, ...(partialMeta ? DEFAULT_GRID.h : [])]) canonH(hs, h);
  const methods = new Set<BenchMethod>([...gMethods, ...(partialMeta ? DEFAULT_GRID.methods : [])]);
  for (const r of records) {
    customers.add(r.numCustomers);
    ids.add(r.instanceId);
    canonH(hs, r.h);
    methods.add(r.method);
  }
  const asc = (a: number, b: number) => a - b;
  return {
    customers: [...customers].sort(asc),
    ids: [...ids].sort(asc),
    h: hs.sort(asc),
    methods: METHOD_ORDER.filter((m) => methods.has(m)),
  };
}

export const COST_EPS = 0.005 + 1e-9;
/** Costos iguales salvo redondeo (Gurobi y los scripts redondean; h = 0,1 deja medios centésimos). */
export const sameCost = (a: number, b: number): boolean => Math.abs(a - b) <= COST_EPS;

/** Cuántos registros Gurobi (la última ejecución por clave) se midieron con cada TimeLimit. */
function timeLimitCounts(file: BenchmarkFile | null): Map<number, number> {
  const latest = new Map<string, BenchRecord>();
  for (const r of placeable(file)) if (isGurobiMethod(r.method)) latest.set(benchKey(r.method, r.numCustomers, r.instanceId, r.h), r);
  const counts = new Map<number, number>();
  for (const r of latest.values()) {
    const t = num(r.config?.timeLimitSec);
    if (t !== null && t > 0) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/**
 * Límite de tiempo de Gurobi: el más frecuente en `config.timeLimitSec` de los registros (empate:
 * el mayor). meta.timeLimitSec solo si ningún registro lo trae, porque meta describe la última
 * invocación del script (`--consolidate` usa el valor por defecto aunque los registros digan otro).
 */
export function timeLimitOf(file: BenchmarkFile | null): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [t, c] of timeLimitCounts(file)) {
    if (c > bestCount || (c === bestCount && best !== null && t > best)) {
      best = t;
      bestCount = c;
    }
  }
  if (best !== null) return best;
  const m = num(file?.meta?.timeLimitSec);
  return m !== null && m > 0 ? m : null;
}

/** Límites de tiempo distintos entre los registros Gurobi, ascendentes (más de uno = mezcla). */
export function timeLimitsOf(file: BenchmarkFile | null): number[] {
  const ts = [...timeLimitCounts(file).keys()].sort((a, b) => a - b);
  if (ts.length) return ts;
  const t = timeLimitOf(file);
  return t === null ? [] : [t];
}

// ---------------------------------------------------------------------------------------------
// Instancias y celdas
// ---------------------------------------------------------------------------------------------

export interface BenchInstance {
  key: string;
  h: number;
  numCustomers: number;
  instanceId: number;
  records: Partial<Record<BenchMethod, BenchRecord>>;
  /** Referencia Política 3 para desviaciones: z*_P3 si P3 es óptimo (proven=true); si no, el menor Z disponible entre P3 (incumbente), dp e ils. */
  ref: { value: number; proven: boolean } | null;
}

/** Clave de instancia: `${h}|${N}|${Id}`. */
export const instanceKey = (h: number, n: number, id: number): string => `${hKey(h)}|${n}|${id}`;

const isError = (r: BenchRecord) => r.status === 'error';
/** Ejecución que el script decidió no correr (Modelo General con N sobre el tope: alto costo computacional). */
const isSkipped = (r: BenchRecord) => r.status === 'skipped';
const isOptimalRecord = (r: BenchRecord) => isGurobiMethod(r.method) && (r.optimal === true || r.status === 'optimal');

function refOf(records: Partial<Record<BenchMethod, BenchRecord>>): BenchInstance['ref'] {
  const p3 = records.p3;
  if (p3 && !isError(p3) && isOptimalRecord(p3)) {
    const z = num(p3.objective);
    if (z !== null) return { value: z, proven: true };
  }
  const zs = [p3, records.dp, records.ils]
    .filter((r): r is BenchRecord => !!r && !isError(r) && !isSkipped(r))
    .map((r) => num(r.objective))
    .filter(isNum);
  return zs.length ? { value: Math.min(...zs), proven: false } : null;
}

/**
 * Todas las combinaciones h × N × Id de la grilla (las pendientes con `records = {}`), ordenadas
 * por h, N e Id. Si una clave aparece varias veces en el archivo, gana la última.
 */
export function buildInstances(file: BenchmarkFile | null): BenchInstance[] {
  const grid = gridOf(file);
  const hs = [...grid.h];
  const latest = new Map<string, BenchRecord>();
  for (const r of placeable(file)) latest.set(benchKey(r.method, r.numCustomers, r.instanceId, canonH(hs, r.h)), r);

  const out: BenchInstance[] = [];
  for (const h of grid.h) {
    for (const n of grid.customers) {
      for (const id of grid.ids) {
        const records: Partial<Record<BenchMethod, BenchRecord>> = {};
        for (const m of grid.methods) {
          const r = latest.get(benchKey(m, n, id, h));
          if (r) records[m] = r;
        }
        out.push({ key: instanceKey(h, n, id), h, numCustomers: n, instanceId: id, records, ref: refOf(records) });
      }
    }
  }
  return out;
}

/** 'skipped': no se ejecutó a propósito (alto costo computacional); se muestra en blanco con una nota. */
export type CellState = 'pending' | 'error' | 'skipped' | 'optimal' | 'feasible' | 'no_solution' | 'heuristic';

export interface Cell {
  method: BenchMethod;
  state: CellState;
  record: BenchRecord | null;
  /** Z total (ruteo + manipulación) de la mejor solución; para Gurobi no óptimo, la mejor entera. */
  objective: number | null;
  /** z^H, costo de manipulación de esa solución. */
  handling: number | null;
  /** Segundos (Runtime de Gurobi; ILS: media por ejecución). */
  timeSec: number | null;
  /** Gurobi factible no óptimo: |cota − z| / |z| · 100. */
  gapPct: number | null;
  /** (Z − ref) / ref · 100 si hay Z y referencia (0 exacto si coincide con la referencia). */
  devPct: number | null;
  hitsRef: boolean;
}

export function cellOf(inst: BenchInstance, method: BenchMethod): Cell {
  const record = inst.records[method] ?? null;
  const empty = { method, record, objective: null, handling: null, timeSec: null, gapPct: null, devPct: null, hitsRef: false };
  if (!record) return { ...empty, state: 'pending' };
  if (isError(record)) return { ...empty, state: 'error', timeSec: num(record.timeSec) };
  if (isSkipped(record)) return { ...empty, state: 'skipped' };

  const objective = num(record.objective);
  const timeSec = num(record.timeSec);
  const handling = objective === null ? null : num(record.handlingCost);
  let state: CellState;
  let gapPct: number | null = null;
  if (isGurobiMethod(method)) {
    if (objective === null) state = 'no_solution';
    else if (isOptimalRecord(record)) state = 'optimal';
    else {
      state = 'feasible';
      const g = record as GurobiRecord;
      gapPct = num(g.gapPct);
      const bound = num(g.bound);
      if (gapPct === null && bound !== null && objective !== 0) gapPct = (Math.abs(bound - objective) / Math.abs(objective)) * 100;
    }
  } else {
    state = objective === null ? 'no_solution' : 'heuristic';
  }

  const ref = inst.ref;
  const hitsRef = objective !== null && ref !== null && sameCost(objective, ref.value);
  const devPct = objective !== null && ref !== null && ref.value !== 0 ? (hitsRef ? 0 : ((objective - ref.value) / ref.value) * 100) : null;
  return { method, state, record, objective, handling, timeSec, gapPct, devPct, hitsRef };
}

// ---------------------------------------------------------------------------------------------
// Resúmenes
// ---------------------------------------------------------------------------------------------

export interface MethodStats {
  method: BenchMethod;
  /** Ejecuciones esperadas: instancias del grupo menos las que no se ejecutan a propósito (skipped). */
  expected: number;
  /** Ejecuciones terminadas (sin pendientes ni skipped, incluye errores). */
  done: number;
  /** Instancias que no se ejecutan por su alto costo computacional (fuera de expected y done). */
  skipped: number;
  errors: number;
  optimal: number;
  feasible: number;
  noSolution: number;
  /** Media sobre registros terminados sin error; los que tocaron el límite cuentan con su Runtime (estilo Erdoğan). */
  meanTimeSec: number | null;
  /** Gurobi: solo óptimos (estilo Battarra «Avg. seconds»). Heurísticas: null. */
  meanTimeOptimalSec: number | null;
  maxTimeSec: number | null;
  /** Gurobi factibles no óptimos (estilo Battarra «Avg. dev.»). Heurísticas: null. */
  meanGapPct: number | null;
  /** Desviación media de Z; en el ILS, Z es la MEJOR de sus corridas (ver meanRunDevPct). */
  meanDevPct: number | null;
  maxDevPct: number | null;
  /**
   * Solo ILS: desviación media de una corrida cualquiera (objectiveMean, la media de Z de las
   * corridas, frente a la misma referencia). Es la que corresponde al tiempo por corrida.
   */
  meanRunDevPct: number | null;
  /** Celdas cuyo Z coincide con la referencia de su instancia (probada o no). */
  hitsRef: number;
  /** Celdas con Z y referencia (denominador de hitsRef y de las desviaciones). */
  withRef: number;
  /** Extra: coincidencias solo con referencias probadas (z*_P3 óptimo) y cuántas celdas tenían una. */
  hitsProvenRef: number;
  withProvenRef: number;
  meanObjective: number | null;
}

export interface GroupStats {
  h: number;
  numCustomers: number;
  instances: number;
  methods: Record<BenchMethod, MethodStats>;
}

function statsOf(method: BenchMethod, insts: BenchInstance[]): MethodStats {
  const gurobi = isGurobiMethod(method);
  const times: number[] = [];
  const optTimes: number[] = [];
  const gaps: number[] = [];
  const devs: number[] = [];
  const runDevs: number[] = [];
  const objectives: number[] = [];
  const s = {
    done: 0,
    skipped: 0,
    errors: 0,
    optimal: 0,
    feasible: 0,
    noSolution: 0,
    hitsRef: 0,
    hitsProvenRef: 0,
    withProvenRef: 0,
  };
  for (const inst of insts) {
    const c = cellOf(inst, method);
    if (c.state === 'pending') continue;
    if (c.state === 'skipped') {
      s.skipped++;
      continue;
    }
    s.done++;
    if (c.state === 'error') {
      s.errors++;
      continue;
    }
    if (c.state === 'optimal') s.optimal++;
    else if (c.state === 'feasible') s.feasible++;
    else if (c.state === 'no_solution') s.noSolution++;
    if (isNum(c.timeSec)) {
      times.push(c.timeSec);
      if (c.state === 'optimal') optTimes.push(c.timeSec);
    }
    if (c.state === 'feasible' && isNum(c.gapPct)) gaps.push(c.gapPct);
    if (isNum(c.objective)) objectives.push(c.objective);
    if (isNum(c.devPct)) {
      devs.push(c.devPct);
      if (c.hitsRef) s.hitsRef++;
      if (inst.ref?.proven) {
        s.withProvenRef++;
        if (c.hitsRef) s.hitsProvenRef++;
      }
      if (method === 'ils' && inst.ref && inst.ref.value !== 0) {
        const zMean = num((c.record as ILSRecord).objectiveMean);
        if (zMean !== null) runDevs.push(sameCost(zMean, inst.ref.value) ? 0 : ((zMean - inst.ref.value) / inst.ref.value) * 100);
      }
    }
  }
  return {
    method,
    expected: insts.length - s.skipped,
    ...s,
    meanTimeSec: mean(times),
    meanTimeOptimalSec: gurobi ? mean(optTimes) : null,
    maxTimeSec: max(times),
    meanGapPct: gurobi ? mean(gaps) : null,
    meanDevPct: mean(devs),
    maxDevPct: max(devs),
    meanRunDevPct: method === 'ils' ? mean(runDevs) : null,
    withRef: devs.length,
    meanObjective: mean(objectives),
  };
}

function statsByMethod(insts: BenchInstance[]): Record<BenchMethod, MethodStats> {
  return Object.fromEntries(METHOD_ORDER.map((m) => [m, statsOf(m, insts)])) as Record<BenchMethod, MethodStats>;
}

const ofH = (instances: BenchInstance[], h: number | 'all') => (h === 'all' ? instances : instances.filter((i) => sameH(i.h, h)));
const customersOf = (instances: BenchInstance[]) => [...new Set(instances.map((i) => i.numCustomers))].sort((a, b) => a - b);

export function summarizeGroup(instances: BenchInstance[], h: number, n: number): GroupStats {
  const insts = instances.filter((i) => sameH(i.h, h) && i.numCustomers === n);
  return {
    h,
    numCustomers: n,
    instances: insts.length,
    methods: statsByMethod(insts),
  };
}

/** Una fila por N de la grilla (ascendente) para ese h. */
export function summarizeByN(instances: BenchInstance[], h: number): GroupStats[] {
  return customersOf(instances).map((n) => summarizeGroup(instances, h, n));
}

/**
 * Instancias (de ese h, o de todos) que TODOS los métodos ya terminaron, con o sin error. Con la
 * grilla completa son todas. Un método sin ningún registro en la selección no se exige (si no, el
 * conjunto quedaría vacío hasta que empiece); sin ningún registro, son todas (pendientes).
 */
export function commonInstances(instances: BenchInstance[], h: number | 'all'): BenchInstance[] {
  const sel = ofH(instances, h);
  const present = METHOD_ORDER.filter((m) => sel.some((i) => i.records[m]));
  return sel.filter((i) => present.every((m) => i.records[m]));
}

/**
 * Totales sobre todos los N (fila «Prom.»), para un h o para todos. `scope`:
 *  · 'all' (por defecto): cada método promedia lo que tenga terminado (para cifras por método);
 *  · 'common': solo las instancias que todos los métodos ya terminaron (commonInstances), para que
 *    con datos parciales las columnas de la fila se lean en horizontal como en Erdoğan et al.:
 *    mismas instancias para todos. Con la grilla completa ambos coinciden.
 */
export function summarizeOverall(instances: BenchInstance[], h: number | 'all', scope: 'all' | 'common' = 'all'): Record<BenchMethod, MethodStats> {
  return statsByMethod(scope === 'common' ? commonInstances(instances, h) : ofH(instances, h));
}

/** Instancias que cubre una fila de resumen (las de cualquier método, contando las que no se ejecutan). */
export const instancesOf = (stats: Record<BenchMethod, MethodStats>): number => Math.max(0, ...METHOD_ORDER.map((m) => stats[m].expected + stats[m].skipped));

/**
 * Menor N (para ese h, o para todos) desde el que el método no se ejecuta en ninguna instancia
 * (todas 'skipped' en ese N y en los mayores); null si siempre se ejecuta. Para la nota «§».
 */
export function skippedFromN(instances: BenchInstance[], method: BenchMethod, h: number | 'all'): number | null {
  const sel = ofH(instances, h);
  let from: number | null = null;
  for (const n of customersOf(sel).reverse()) {
    const group = sel.filter((i) => i.numCustomers === n);
    if (!group.length || !group.every((i) => i.records[method]?.status === 'skipped')) break;
    from = n;
  }
  return from;
}

export interface Progress {
  expected: number;
  done: number;
  errors: number;
  /** Porcentaje 0–100. */
  pct: number;
  complete: boolean;
  /** finishedAt más reciente (ISO, tal como viene en el registro). */
  lastFinishedAt: string | null;
}

export function progressOf(file: BenchmarkFile | null, instances: BenchInstance[]): Progress {
  const methods = gridOf(file).methods;
  const expected = instances.length * methods.length;
  let done = 0;
  let errors = 0;
  for (const inst of instances) {
    for (const m of methods) {
      const r = inst.records[m];
      if (!r) continue;
      done++;
      if (isError(r)) errors++;
    }
  }
  let lastFinishedAt: string | null = null;
  let lastMs = -Infinity;
  for (const r of placeable(file)) {
    const t = typeof r.finishedAt === 'string' ? Date.parse(r.finishedAt) : NaN;
    if (Number.isFinite(t) && t > lastMs) {
      lastMs = t;
      lastFinishedAt = r.finishedAt;
    }
  }
  return {
    expected,
    done,
    errors,
    pct: expected > 0 ? (done / expected) * 100 : 0,
    complete: expected > 0 && done >= expected,
    lastFinishedAt,
  };
}

/**
 * Mayor N tal que TODAS las instancias de ese N y de todos los N menores (para ese h, o para todos)
 * están terminadas y resueltas a optimalidad por el método; null si ni siquiera el N menor.
 */
export function largestAllSolvedN(instances: BenchInstance[], method: GurobiMethod, h: number | 'all'): number | null {
  const sel = ofH(instances, h);
  let best: number | null = null;
  for (const n of customersOf(sel)) {
    const group = sel.filter((i) => i.numCustomers === n);
    if (!group.length || !group.every((i) => cellOf(i, method).state === 'optimal')) break;
    best = n;
  }
  return best;
}
