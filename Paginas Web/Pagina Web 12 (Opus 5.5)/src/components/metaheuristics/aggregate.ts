/**
 * Agregaciones del benchmark de metaheurísticas (sección «Metaheurísticas»): una fila por instancia
 * (|Vc|, Id) con nuestros resultados y los del paper, y resúmenes por |Vc| al estilo de las Tablas 2–3
 * de Erdoğan et al. (2012). Funciones puras: las usa la sección y scripts/validate-metaheuristics.ts.
 *
 * Convenciones (las mismas del paper, verificadas contra sus Tablas 2–3):
 *   · 1dir: corrida desde el tour TSP (dirección 1).
 *   · 2dir: la mejor de las corridas desde el tour y desde el tour invertido, cada una con Niter iteraciones.
 *     En las Tablas 8–9 la columna «2 dir.» es SOLO la corrida desde el tour invertido; aquí el valor
 *     2dir del paper es min(1 dir., 2 dir.).
 *   · Desviación: (Z − Best) / Best · 100 con Best = mejor solución conocida del paper (Tablas 8–9).
 *   · Tiempo: segundos de pared. 1dir = tour TSP + solución inicial + metaheurística de la dirección 1;
 *     2dir = tour TSP + ambas direcciones. Dos fases: tour TSP + reubicación del depósito.
 */
import type {
  MetaDirection,
  MetaFile,
  MetaMethod,
  MetaRecord,
  MetaRunRecord,
  MetaTspRecord,
  MetaTwoPhaseRecord,
  PaperByN,
  PaperFile,
  PaperRow,
} from '../../types/metaheuristics';

export const META_METHODS: MetaMethod[] = ['twophase', 'ils-heuristic', 'ils-exact', 'its-heuristic', 'its-exact'];
export const DEFAULT_SIZES = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
export const DEFAULT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Ejecuciones por instancia: tour TSP + dos fases + 4 metaheurísticas × 2 direcciones. */
export const RUNS_PER_INSTANCE = 2 + 2 * (META_METHODS.length - 1);

/** Columnas de las Tablas 8–9 de cada método: [1 dir. (tour), 2 dir. (tour invertido)]. */
export const PAPER_COLUMNS: Record<MetaMethod, readonly [keyof PaperRow, keyof PaperRow]> = {
  twophase: ['init1', 'init2'],
  'ils-heuristic': ['ilsH1', 'ilsH2'],
  'ils-exact': ['ilsE1', 'ilsE2'],
  'its-heuristic': ['itsH1', 'itsH2'],
  'its-exact': ['itsE1', 'itsE2'],
};

/** Columnas de la fila «Time (s)» de la Tabla 9 (promedio de las 100 instancias, por dirección). */
const PAPER_TIME_COLUMNS: Partial<Record<MetaMethod, readonly [keyof PaperFile['timeRowTable9'], keyof PaperFile['timeRowTable9']]>> = {
  'ils-heuristic': ['ilsH1', 'ilsH2'],
  'ils-exact': ['ilsE1', 'ilsE2'],
  'its-heuristic': ['itsH1', 'itsH2'],
  'its-exact': ['itsE1', 'itsE2'],
};

const EPS = 1e-6;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const minOf = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));

/* ───────────────────────── Filas por instancia ───────────────────────── */

/** Resultado de una dirección (dos fases o una corrida de metaheurística). */
export interface DirResult {
  /** Z final de esa dirección. */
  z: number;
  /** Z de la solución inicial de esa dirección. */
  zInitial: number;
  /** Segundos de esa dirección sin el tour TSP (reubicación del depósito + metaheurística). */
  sec: number;
  /** La metaheurística mejoró la solución inicial (siempre false en dos fases). */
  improved: boolean;
  bestIteration?: number;
  improvements?: number;
  /** Evaluaciones de la manipulación: exactas (Alg. 2.1 + DP) y heurísticas (§2.2). */
  exactEvals?: number;
  heuristicEvals?: number;
  history?: number[];
}

export interface MethodCell {
  /** Dirección 1 (desde el tour TSP) y dirección 2 (desde el tour invertido), si terminaron bien. */
  dir1: DirResult | null;
  dir2: DirResult | null;
  /** Ejecuciones con error en este método e instancia. */
  errors: number;
  /** 1dir: Z y segundos (con el tour TSP). null si la dirección 1 aún no termina. */
  z1: number | null;
  t1: number | null;
  /** 2dir: mínimo de ambas direcciones y la suma de sus tiempos. null hasta que terminan las dos. */
  z2: number | null;
  t2: number | null;
}

export interface PaperCell {
  /** «1 dir.» de las Tablas 8–9. */
  z1: number;
  /** «2 dir.» de las Tablas 8–9: solo la corrida desde el tour invertido. */
  zRev: number;
  /** 2dir = min(1 dir., 2 dir.). */
  z2: number;
}

export interface InstanceRow {
  n: number;
  id: number;
  h: number | null;
  /** Tour TSP compartido por todos los métodos. */
  tspSec: number | null;
  tspLength: number | null;
  /** 'paper': la dirección 1 reproduce la solución inicial «1 dir.» del paper. */
  orientation: 'paper' | 'default' | null;
  /** Best de las Tablas 8–9 (null si la instancia no está en el paper). */
  best: number | null;
  paperRow: PaperRow | null;
  cells: Record<MetaMethod, MethodCell>;
  paper: Record<MetaMethod, PaperCell> | null;
  /** Mejor Z de todas nuestras corridas terminadas (null si aún no hay ninguna). */
  ourBest: number | null;
}

const instKey = (n: number, id: number) => `${n}|${id}`;

const emptyCell = (): MethodCell => ({ dir1: null, dir2: null, errors: 0, z1: null, t1: null, z2: null, t2: null });

function paperCells(row: PaperRow): Record<MetaMethod, PaperCell> {
  const out = {} as Record<MetaMethod, PaperCell>;
  for (const m of META_METHODS) {
    const [c1, c2] = PAPER_COLUMNS[m];
    const z1 = row[c1] as number;
    const zRev = row[c2] as number;
    out[m] = { z1, zRev, z2: Math.min(z1, zRev) };
  }
  return out;
}

function runResult(r: MetaRunRecord): DirResult | null {
  if (r.status !== 'ok' || !r.best || !r.initial || !finite(r.best.objective)) return null;
  return {
    z: r.best.objective,
    zInitial: r.initial.objective,
    sec: (r.initSec ?? 0) + (r.runSec ?? 0),
    improved: r.best.objective < r.initial.objective - EPS,
    bestIteration: r.bestIteration,
    improvements: r.improvements,
    exactEvals: r.evals?.exact,
    heuristicEvals: r.evals?.heuristic,
    history: r.history,
  };
}

/** Grilla del experimento: la del consolidado o, si falta, la de las Tablas 8–9. */
export function gridOf(file: MetaFile | null): { sizes: number[]; ids: number[] } {
  const g = file?.meta?.grid;
  return {
    sizes: g?.sizes?.length ? [...g.sizes].sort((a, b) => a - b) : DEFAULT_SIZES,
    ids: g?.ids?.length ? [...g.ids].sort((a, b) => a - b) : DEFAULT_IDS,
  };
}

/** Una fila por instancia de la grilla (y por cada instancia extra con registros), ordenadas por |Vc| e Id. */
export function buildInstances(file: MetaFile | null, paper: PaperFile | null): InstanceRow[] {
  const { sizes, ids } = gridOf(file);
  const rows = new Map<string, InstanceRow>();
  const paperByKey = new Map((paper?.instances ?? []).map((r) => [instKey(r.n, r.id), r]));
  const ensure = (n: number, id: number): InstanceRow => {
    const k = instKey(n, id);
    let row = rows.get(k);
    if (!row) {
      const pr = paperByKey.get(k) ?? null;
      const cells = {} as Record<MetaMethod, MethodCell>;
      for (const m of META_METHODS) cells[m] = emptyCell();
      row = {
        n,
        id,
        h: null,
        tspSec: null,
        tspLength: null,
        orientation: null,
        best: pr?.best ?? null,
        paperRow: pr,
        cells,
        paper: pr ? paperCells(pr) : null,
        ourBest: null,
      };
      rows.set(k, row);
    }
    return row;
  };
  for (const n of sizes) for (const id of ids) ensure(n, id);

  for (const rec of (file?.records ?? []) as MetaRecord[]) {
    if (!finite(rec.n) || !finite(rec.id)) continue;
    const row = ensure(rec.n, rec.id);
    if (finite(rec.h)) row.h = rec.h;
    if (rec.method === 'tsp') {
      const t = rec as MetaTspRecord;
      if (t.status === 'ok') {
        row.tspSec = finite(t.timeSec) ? t.timeSec : null;
        row.tspLength = finite(t.length) ? t.length : null;
      }
      continue;
    }
    if (rec.method === 'twophase') {
      const tp = rec as MetaTwoPhaseRecord;
      const cell = row.cells.twophase;
      if (tp.status !== 'ok' || !tp.dirs?.length) {
        cell.errors++;
        continue;
      }
      row.orientation = tp.orientation ?? row.orientation;
      for (const d of tp.dirs) {
        const res: DirResult = { z: d.objective, zInitial: d.objective, sec: d.timeSec ?? 0, improved: false };
        if (d.dir === 1) cell.dir1 = res;
        else cell.dir2 = res;
      }
      continue;
    }
    const method = rec.method as MetaMethod;
    if (!META_METHODS.includes(method)) continue; // variantes extra (ILS descenso completo): fuera de esta tabla
    const run = rec as MetaRunRecord;
    const cell = row.cells[method];
    const res = runResult(run);
    if (!res) {
      cell.errors++;
      continue;
    }
    if (run.orientation && !row.orientation) row.orientation = run.orientation;
    if (run.dir === 1) cell.dir1 = res;
    else if (run.dir === 2) cell.dir2 = res;
  }

  for (const row of rows.values()) {
    const tsp = row.tspSec ?? 0;
    for (const m of META_METHODS) {
      const c = row.cells[m];
      if (c.dir1) {
        c.z1 = c.dir1.z;
        c.t1 = tsp + c.dir1.sec;
      }
      if (c.dir1 && c.dir2) {
        c.z2 = Math.min(c.dir1.z, c.dir2.z);
        c.t2 = tsp + c.dir1.sec + c.dir2.sec;
      }
      row.ourBest = minOf(row.ourBest, minOf(c.dir1?.z ?? null, c.dir2?.z ?? null));
    }
  }
  return [...rows.values()].sort((a, b) => a.n - b.n || a.id - b.id);
}

/* ───────────────────────── Lecturas por dirección ───────────────────────── */

export const zOf = (c: MethodCell, dir: MetaDirection) => (dir === '1dir' ? c.z1 : c.z2);
export const timeOf = (c: MethodCell, dir: MetaDirection) => (dir === '1dir' ? c.t1 : c.t2);
export const paperZOf = (p: PaperCell, dir: MetaDirection) => (dir === '1dir' ? p.z1 : p.z2);

export function devPct(z: number | null, best: number | null): number | null {
  if (z === null || best === null || !(best > 0)) return null;
  return ((z - best) / best) * 100;
}

/* ───────────────────────── Resúmenes por |Vc| ───────────────────────── */

export interface MethodSummary {
  /** Instancias con resultado en esta dirección. */
  done: number;
  /** Promedios sobre las instancias terminadas (null si ninguna). */
  devPct: number | null;
  avgZ: number | null;
  timeSec: number | null;
  /** Mismas instancias, cifras del paper. */
  paperDevPct: number | null;
  paperAvgZ: number | null;
  /**
   * Segundos del paper con este |Vc| cuando se publican (Tabla 2: ILS-1dir e ITS-1dir exactos);
   * en 2dir se estima como el doble (Niter iteraciones en cada dirección). null si no hay dato.
   */
  paperTimeSec: number | null;
  /** Instancias en que la metaheurística mejoró su solución inicial (en 2dir: alguna dirección). */
  improved: number;
  /** Instancias en que nuestro Z es menor que el del paper con el mismo método y dirección. */
  beatsPaper: number;
  /** Instancias en que nuestro Z es menor que el Best del paper. */
  beatsBest: number;
}

export interface NSummary {
  n: number;
  h: number | null;
  instances: number;
  methods: Record<MetaMethod, MethodSummary>;
  /** Todas las instancias tienen todos los métodos en esta dirección. */
  complete: boolean;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * scope 'done': cada método promedia sus propias instancias terminadas. 'common': solo las instancias
 * que todos los métodos ya terminaron en esa dirección (columnas comparables con datos parciales).
 */
export function summarizeMethods(
  rows: InstanceRow[],
  dir: MetaDirection,
  paperByN?: PaperByN | null,
  scope: 'done' | 'common' = 'done',
): Record<MetaMethod, MethodSummary> {
  const usable = scope === 'common' ? rows.filter((r) => META_METHODS.every((m) => zOf(r.cells[m], dir) !== null)) : rows;
  const out = {} as Record<MetaMethod, MethodSummary>;
  for (const m of META_METHODS) {
    const devs: number[] = [];
    const zs: number[] = [];
    const ts: number[] = [];
    const pDevs: number[] = [];
    const pZs: number[] = [];
    let improved = 0;
    let beatsPaper = 0;
    let beatsBest = 0;
    for (const r of usable) {
      const c = r.cells[m];
      const z = zOf(c, dir);
      if (z === null) continue;
      zs.push(z);
      const d = devPct(z, r.best);
      if (d !== null) devs.push(d);
      const t = timeOf(c, dir);
      if (t !== null) ts.push(t);
      const improvedHere = dir === '1dir' ? !!c.dir1?.improved : !!(c.dir1?.improved || c.dir2?.improved);
      if (improvedHere) improved++;
      if (r.paper) {
        const pz = paperZOf(r.paper[m], dir);
        pZs.push(pz);
        const pd = devPct(pz, r.best);
        if (pd !== null) pDevs.push(pd);
        if (z < pz - 0.005) beatsPaper++;
      }
      if (r.best !== null && z < r.best - 0.005) beatsBest++;
    }
    let paperTimeSec: number | null = null;
    if (paperByN && (m === 'ils-exact' || m === 'its-exact')) {
      const t1 = m === 'ils-exact' ? paperByN.ilsExact1dirTimeSec : paperByN.itsExact1dirTimeSec;
      paperTimeSec = dir === '1dir' ? t1 : 2 * t1;
    }
    out[m] = {
      done: zs.length,
      devPct: mean(devs),
      avgZ: mean(zs),
      timeSec: mean(ts),
      paperDevPct: mean(pDevs),
      paperAvgZ: mean(pZs),
      paperTimeSec,
      improved,
      beatsPaper,
      beatsBest,
    };
  }
  return out;
}

export function summarizeByN(rows: InstanceRow[], dir: MetaDirection, paper: PaperFile | null, scope: 'done' | 'common' = 'done'): NSummary[] {
  const byN = new Map<number, InstanceRow[]>();
  for (const r of rows) byN.set(r.n, [...(byN.get(r.n) ?? []), r]);
  return [...byN.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, list]) => ({
      n,
      h: list.find((r) => r.h !== null)?.h ?? null,
      instances: list.length,
      methods: summarizeMethods(list, dir, paper?.byN?.[String(n)] ?? null, scope),
      complete: list.every((r) => META_METHODS.every((m) => zOf(r.cells[m], dir) !== null)),
    }));
}

/**
 * Promedio general (fila «Prom.»). El tiempo del paper es el de la fila «Time (s)» de la Tabla 9
 * (promedio de las 100 instancias por dirección; 2dir = suma de ambas columnas), solo para los
 * métodos cuyo promedio nuestro cubre las 100 instancias del paper: con scope 'done', las que ese
 * método terminó; con 'common', las que terminaron todos. Con datos parciales queda en null, para no
 * comparar nuestro promedio de un subconjunto (casi siempre los |Vc| chicos) con el de las 100.
 */
export function summarizeOverall(rows: InstanceRow[], dir: MetaDirection, paper: PaperFile | null, scope: 'done' | 'common' = 'done') {
  const methods = summarizeMethods(rows, dir, null, scope);
  if (!paper?.instances?.length) return methods;
  const byKey = new Map(rows.map((r) => [instKey(r.n, r.id), r]));
  const paperRows = paper.instances.map((p) => byKey.get(instKey(p.n, p.id)) ?? null);
  const has = (r: InstanceRow | null, m: MetaMethod) => r !== null && zOf(r.cells[m], dir) !== null;
  const commonCovers = paperRows.every((r) => META_METHODS.every((m) => has(r, m)));
  for (const m of META_METHODS) {
    const cols = PAPER_TIME_COLUMNS[m];
    if (!cols) continue;
    const covers = scope === 'common' ? commonCovers : paperRows.every((r) => has(r, m));
    if (!covers) continue;
    const t1 = paper.timeRowTable9[cols[0]];
    const t2 = paper.timeRowTable9[cols[1]];
    methods[m].paperTimeSec = dir === '1dir' ? t1 : t1 + t2;
  }
  return methods;
}

/* ───────────────────────── Avance ───────────────────────── */

export interface Progress {
  done: number;
  expected: number;
  errors: number;
  pct: number;
  complete: boolean;
  lastFinishedAt: string | null;
}

/** Ejecuciones registradas de la grilla (tour TSP + dos fases + 8 corridas por instancia). Los errores cuentan. */
export function progressOf(file: MetaFile | null): Progress {
  const { sizes, ids } = gridOf(file);
  const methods = (file?.meta?.grid?.methods?.length ? file.meta.grid.methods : META_METHODS).filter((m) => m !== 'twophase');
  const perInstance = 2 + 2 * methods.length;
  const expected = sizes.length * ids.length * perInstance;
  const inGrid = new Set(sizes.flatMap((n) => ids.map((id) => instKey(n, id))));
  const wanted = new Set<string>(['tsp', 'twophase', ...methods]);
  let done = 0;
  let errors = 0;
  let last: string | null = null;
  for (const r of file?.records ?? []) {
    if (!inGrid.has(instKey(r.n, r.id)) || !wanted.has(r.method)) continue;
    done++;
    if (r.status !== 'ok') errors++;
    if (r.finishedAt && (!last || r.finishedAt > last)) last = r.finishedAt;
  }
  return {
    done,
    expected,
    errors,
    pct: expected ? (done / expected) * 100 : 0,
    complete: expected > 0 && done >= expected,
    lastFinishedAt: last,
  };
}
