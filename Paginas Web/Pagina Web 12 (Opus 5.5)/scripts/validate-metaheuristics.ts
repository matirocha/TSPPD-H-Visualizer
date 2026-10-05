// Valida la agregación del benchmark de metaheurísticas (sección «Metaheurísticas», Tablas 8–9 de
// Erdoğan et al. 2012):
//  1) fixtures sintéticos: 1dir = dirección 1 con el tour TSP; 2dir = mínimo de ambas direcciones con
//     el tiempo de las dos; pendientes (dirección 2 faltante → z2/t2 null), errores, ámbitos 'done' y
//     'common', tiempos del paper por |Vc| y de la fila «Time (s)», avance con la grilla;
//  2) cifras reales del paper (../../Outputs/BenchmarkErdogan2012/paper_erdogan2012.json): PAPER_COLUMNS
//     apunta a las columnas correctas y, con resultados idénticos a los del paper, summarizeByN reproduce
//     las Tablas 2–3 (desviación de ILS/ITS exactos, 1dir y 2dir) con tolerancia de 0,006 pp;
//  3) registros reales si existen (solo lectura): recalcula de forma independiente desde registros.jsonl
//     (última línea por clave) z1/z2/t1/t2 de cada instancia y los compara con buildInstances sobre lo
//     que entrega el lector de la página (scripts/solutions-api.js), más la coherencia de cada registro;
//  4) exportación (export.ts) sin ejecuciones, con datos parciales (pendientes y errores), completos y
//     sin el paper: modelo del resumen = summarizeByN / summarizeOverall, pie del detalle por instancia,
//     LaTeX bien formado (columnas, llaves, «%», NBSP) del resumen y de las tres vistas del detalle, y CSV;
//  5) sensibilidad del ITS exacto a Nrand (its_nrand.json, si existe): la corrida con el Nrand del §4.3
//     (0,1·|Vc|) reproduce la its-exact|n|id|1 del benchmark (misma solución inicial y mismo Z final).
// Uso: node scripts/validate-metaheuristics.ts   (Node ≥ 22.18 ejecuta TypeScript directamente)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as A from '../src/components/metaheuristics/aggregate.ts';
import * as E from '../src/components/metaheuristics/export.ts';
import type {
  MetaDirection,
  MetaFile,
  MetaMethod,
  ItsNrandFile,
  MetaRecord,
  PaperByN,
  PaperFile,
  PaperRow,
} from '../src/types/metaheuristics.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../../Outputs');
const metaDir = path.join(outputsDir, 'BenchmarkErdogan2012');

let failures = 0;
let checks = 0;
const check = (cond: boolean, msg: string) => {
  checks++;
  if (!cond) {
    failures++;
    if (failures <= 60) console.log('  ✗ ' + msg);
  }
};
const near = (a: number | null | undefined, b: number | null | undefined, eps = 1e-9) =>
  (a === null || a === undefined) && (b === null || b === undefined)
    ? true
    : typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const eq = (got: unknown, want: unknown, msg: string) =>
  check(Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `${msg}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
const approx = (got: number | null | undefined, want: number | null | undefined, msg: string, eps = 1e-9) =>
  check(near(got, want, eps), `${msg}: ${got} ≠ ${want}`);
/** Diferencia absoluta (para porcentajes del paper redondeados a 2 decimales). */
const within = (got: number | null | undefined, want: number | null | undefined, tol: number, msg: string) =>
  check(typeof got === 'number' && typeof want === 'number' && Math.abs(got - want) <= tol, `${msg}: ${got} vs ${want} (tol ${tol})`);

const RUN_METHODS = A.META_METHODS.filter((m) => m !== 'twophase') as Exclude<MetaMethod, 'twophase'>[];
const DIRS: MetaDirection[] = ['1dir', '2dir'];

// =============================================================================================
// 1) FIXTURES SINTÉTICOS
// =============================================================================================
console.log('1) Fixtures sintéticos');

let clock = 0;
const stamp = (offset = 0) => new Date(Date.UTC(2026, 9, 4, 12, 0, ++clock + offset)).toISOString();

function tspRec(n: number, id: number, h: number, timeSec: number, extra: Record<string, unknown> = {}): MetaRecord {
  return { key: `tsp|${n}|${id}`, method: 'tsp', n, id, h, config: {}, status: 'ok', length: 90, timeSec, finishedAt: stamp(), ...extra } as unknown as MetaRecord;
}
function twoPhaseRec(n: number, id: number, h: number, d1: [number, number], d2: [number, number], extra: Record<string, unknown> = {}): MetaRecord {
  const dir = (k: 1 | 2, [objective, timeSec]: [number, number]) => ({ dir: k, objective, distance: objective - 10, handling: 10, timeSec });
  return {
    key: `twophase|${n}|${id}`,
    method: 'twophase',
    n,
    id,
    h,
    config: {},
    status: 'ok',
    orientation: 'paper',
    timeSec: d1[1] + d2[1],
    dirs: [dir(1, d1), dir(2, d2)],
    finishedAt: stamp(),
    ...extra,
  } as unknown as MetaRecord;
}
/** Corrida de una metaheurística: [Z inicial, Z final, initSec, runSec]. */
function runRec(method: string, n: number, id: number, h: number, dir: 1 | 2, v: [number, number, number, number], extra: Record<string, unknown> = {}): MetaRecord {
  const [z0, z, initSec, runSec] = v;
  return {
    key: `${method}|${n}|${id}|${dir}`,
    method,
    n,
    id,
    h,
    dir,
    config: {},
    status: 'ok',
    orientation: 'paper',
    initial: { objective: z0, distance: z0 - 10, handling: 10 },
    best: { objective: z, distance: z - 10, handling: 10 },
    initSec,
    runSec,
    bestIteration: 3,
    improvements: z < z0 ? 1 : 0,
    evals: { exact: 10, heuristic: 0, scanned: 10, pruned: 0, infeasible: 0 },
    history: [z0, z],
    finishedAt: stamp(),
    ...extra,
  } as unknown as MetaRecord;
}
function errRec(method: string, n: number, id: number, h: number, dir: 1 | 2 | null): MetaRecord {
  return {
    key: dir ? `${method}|${n}|${id}|${dir}` : `${method}|${n}|${id}`,
    method,
    n,
    id,
    h,
    ...(dir ? { dir } : {}),
    config: {},
    status: 'error',
    error: 'Error: boom',
    finishedAt: stamp(),
  } as unknown as MetaRecord;
}

const fixRecords: MetaRecord[] = [
  // (20, 1): dirección 2 del ILS heurístico pendiente; ITS exacto con error en la dirección 1.
  tspRec(20, 1, 1, 0.5),
  twoPhaseRec(20, 1, 1, [110, 0.1], [115, 0.2]),
  runRec('ils-exact', 20, 1, 1, 1, [110, 100, 0.1, 2]),
  runRec('ils-exact', 20, 1, 1, 2, [115, 99, 0.2, 3]),
  runRec('ils-heuristic', 20, 1, 1, 1, [110, 108, 0.1, 0.4]),
  errRec('its-exact', 20, 1, 1, 1),
  runRec('its-exact', 20, 1, 1, 2, [115, 101, 0.2, 1.3]),
  runRec('its-heuristic', 20, 1, 1, 1, [110, 110, 0.1, 0.2]),
  runRec('its-heuristic', 20, 1, 1, 2, [115, 109, 0.2, 0.3]),
  // (20, 2): completa.
  tspRec(20, 2, 1, 1),
  twoPhaseRec(20, 2, 1, [220, 0.1], [212, 0.1]),
  runRec('ils-heuristic', 20, 2, 1, 1, [220, 215, 0.1, 0.5]),
  runRec('ils-heuristic', 20, 2, 1, 2, [212, 212, 0.1, 0.5]),
  runRec('ils-exact', 20, 2, 1, 1, [220, 204, 0.1, 4]),
  runRec('ils-exact', 20, 2, 1, 2, [212, 206, 0.1, 4]),
  runRec('its-heuristic', 20, 2, 1, 1, [220, 210, 0.1, 1]),
  runRec('its-heuristic', 20, 2, 1, 2, [212, 211, 0.1, 1]),
  runRec('its-exact', 20, 2, 1, 1, [220, 202, 0.1, 2]),
  runRec('its-exact', 20, 2, 1, 2, [212, 199, 0.1, 2]),
  // (40, 1): solo el tour TSP; (40, 2): nada.
  tspRec(40, 1, 0.5, 3),
  // Fuera de la tabla: variante extra (ILS con descenso completo) y una instancia fuera de la grilla,
  // ambas con la marca de tiempo más nueva (no deben contar en lastFinishedAt).
  runRec('ilsd-exact', 20, 1, 1, 1, [110, 90, 0.1, 50], { finishedAt: '2030-01-01T00:00:00.000Z' }),
  tspRec(60, 1, 0.33, 7, { finishedAt: '2030-01-02T00:00:00.000Z' }),
];

const fixture: MetaFile = {
  title: 'fixture',
  reference: '',
  generatedAt: '2026-10-04T12:00:00Z',
  meta: {
    cpu: 'x',
    logicalCpus: 2,
    os: 'test',
    runtime: 'Node.js v24.0.0',
    workers: 2,
    params: { nIter: 200, d: 0.1, nIterIts: 14, tabuRatio: 0.5, seed: 1, ilsLsRule: 'incumbent', tsp: { kicks: 1, restarts: 1, method: 'x' } },
    h: { '20': 1, '40': 0.5 },
    grid: { sizes: [40, 20], ids: [2, 1], methods: [...A.META_METHODS] },
  },
  methods: A.META_METHODS.map((key) => ({ key, label: key })),
  count: fixRecords.length,
  records: fixRecords,
};

const prow = (n: number, id: number, best: number, v: number[]): PaperRow => {
  const [init1, init2, ilsH1, ilsH2, ilsE1, ilsE2, itsH1, itsH2, itsE1, itsE2] = v;
  return { n, id, best, init1, init2, ilsH1, ilsH2, ilsE1, ilsE2, itsH1, itsH2, itsE1, itsE2 };
};
const byNFix = (t: number): PaperByN => ({
  ilsExact1dirDevPct: 1,
  ilsExact1dirTimeSec: t,
  itsExact1dirDevPct: 0.5,
  itsExact1dirTimeSec: t / 2,
  ilsExact2dirDevPct: 0.8,
  itsExact2dirDevPct: 0.4,
});
const paperFix: PaperFile = {
  source: 'fixture',
  pdf: '',
  machine: '',
  h: '',
  params: { nIter: 200 },
  columns: {},
  note: '',
  instances: [
    prow(20, 1, 100, [110, 120, 105, 104, 101, 103, 106, 107, 102, 100]),
    prow(20, 2, 200, [220, 210, 212, 214, 205, 204, 211, 209, 202, 203]),
    prow(40, 1, 300, [330, 320, 310, 311, 305, 306, 309, 308, 302, 301]),
    prow(40, 2, 400, [440, 430, 420, 421, 410, 409, 415, 416, 404, 403]),
  ],
  timeRowTable9: { ilsH1: 10, ilsH2: 11, ilsE1: 100, ilsE2: 101, itsH1: 5, itsH2: 6, itsE1: 50, itsE2: 52 },
  byN: { '20': byNFix(1.5), '40': byNFix(3) },
  averages: byNFix(2.25),
  validation: { tables67Match: true, deviationChecks: 0, maxAbsDiffPct: 0 },
};

{
  // Constantes y grilla
  eq(A.META_METHODS, ['twophase', 'ils-heuristic', 'ils-exact', 'its-heuristic', 'its-exact'], 'META_METHODS en el orden de las Tablas 8–9');
  eq(A.RUNS_PER_INSTANCE, 10, 'RUNS_PER_INSTANCE = tour TSP + dos fases + 4 × 2 direcciones');
  eq(A.gridOf(fixture), { sizes: [20, 40], ids: [1, 2] }, 'gridOf ordena meta.grid');
  eq(A.gridOf(null), { sizes: [20, 40, 60, 80, 100, 120, 140, 160, 180, 200], ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, 'gridOf(null) = grilla de las Tablas 8–9');
  eq(A.gridOf({ ...fixture, meta: null }).sizes.length, 10, 'gridOf sin meta → grilla por defecto');
}

const rows = A.buildInstances(fixture, paperFix);
const row = (n: number, id: number) => rows.find((r) => r.n === n && r.id === id)!;
{
  eq(
    rows.map((r) => `${r.n}|${r.id}`),
    ['20|1', '20|2', '40|1', '40|2', '60|1'],
    'buildInstances: grilla completa + instancia extra con registros, ordenadas',
  );
  const r1 = row(20, 1);
  eq([r1.h, r1.tspSec, r1.tspLength, r1.orientation, r1.best], [1, 0.5, 90, 'paper', 100], '(20,1) h, tour TSP, orientación y Best');
  eq(row(40, 1).h, 0.5, '(40,1) h desde el registro TSP');
  eq([row(40, 2).h, row(40, 2).tspSec, row(40, 2).orientation, row(40, 2).ourBest], [null, null, null, null], '(40,2) sin registros: todo null');
  eq([row(60, 1).best, row(60, 1).paper, row(60, 1).paperRow], [null, null, null], '(60,1) fuera del paper: sin Best ni celdas del paper');

  // Dos fases: z2 = mínimo de las direcciones; t1 = tsp + dir. 1; t2 = tsp + ambas.
  const tp = r1.cells.twophase;
  eq([tp.z1, tp.z2, tp.errors, tp.dir1?.improved, tp.dir2?.z], [110, 110, 0, false, 115], 'dos fases (20,1): z1, z2 = min(110, 115)');
  approx(tp.t1, 0.5 + 0.1, 'dos fases (20,1) t1 = tsp + dir. 1');
  approx(tp.t2, 0.5 + 0.1 + 0.2, 'dos fases (20,1) t2 = tsp + ambas');
  const tp2 = row(20, 2).cells.twophase;
  eq([tp2.z1, tp2.z2], [220, 212], 'dos fases (20,2): z2 = dirección invertida si es mejor');

  // ILS exacto: ambas direcciones.
  const ie = r1.cells['ils-exact'];
  eq([ie.z1, ie.z2, ie.dir1?.zInitial, ie.dir1?.improved, ie.dir2?.improved], [100, 99, 110, true, true], 'ILS exacto (20,1): z1, z2 = min(100, 99)');
  approx(ie.t1, 0.5 + 0.1 + 2, 'ILS exacto (20,1) t1 = tsp + init + run (dir. 1)');
  approx(ie.t2, 0.5 + 0.1 + 2 + 0.2 + 3, 'ILS exacto (20,1) t2 = tsp + ambas direcciones');
  approx(ie.dir2?.sec, 3.2, 'DirResult.sec = initSec + runSec');
  eq([ie.dir1?.bestIteration, ie.dir1?.improvements, ie.dir1?.exactEvals, ie.dir1?.heuristicEvals, ie.dir1?.history], [3, 1, 10, 0, [110, 100]], 'DirResult copia trazas y evaluaciones');

  // Pendiente: falta la dirección 2 → z2/t2 null, z1/t1 sí.
  const ih = r1.cells['ils-heuristic'];
  eq([ih.z1, ih.z2, ih.t2, ih.dir2, ih.errors], [108, null, null, null, 0], 'ILS heurístico (20,1): dirección 2 pendiente → z2 = t2 = null');
  approx(ih.t1, 0.5 + 0.1 + 0.4, 'ILS heurístico (20,1) t1');

  // Error en la dirección 1: cuenta como error y deja 1dir y 2dir sin valor.
  const te = r1.cells['its-exact'];
  eq([te.errors, te.dir1, te.z1, te.t1, te.z2, te.t2, te.dir2?.z], [1, null, null, null, null, null, 101], 'ITS exacto (20,1): error en dir. 1 → 1dir y 2dir pendientes');

  // Sin mejora en la dirección 1, con mejora en la 2.
  const th = r1.cells['its-heuristic'];
  eq([th.z1, th.z2, th.dir1?.improved, th.dir2?.improved], [110, 109, false, true], 'ITS heurístico (20,1): mejora solo en dir. 2');
  approx(th.t2, 0.5 + 0.3 + 0.5, 'ITS heurístico (20,1) t2');

  // La variante extra (ilsd-exact, Z = 90) no entra en las celdas ni en ourBest.
  eq(r1.ourBest, 99, 'ourBest (20,1) = mejor de las corridas de la tabla (sin variantes extra)');
  eq(row(20, 2).ourBest, 199, 'ourBest (20,2)');

  // Celdas del paper: 2dir = min(1 dir., 2 dir.) de las Tablas 8–9.
  const p1 = r1.paper!;
  eq(
    A.META_METHODS.map((m) => [p1[m].z1, p1[m].zRev, p1[m].z2]),
    [
      [110, 120, 110],
      [105, 104, 104],
      [101, 103, 101],
      [106, 107, 106],
      [102, 100, 100],
    ],
    'celdas del paper (20,1): z1, zRev y z2 = min',
  );

  // Lecturas por dirección
  eq([A.zOf(ie, '1dir'), A.zOf(ie, '2dir'), A.timeOf(ih, '2dir'), A.paperZOf(p1['its-exact'], '1dir'), A.paperZOf(p1['its-exact'], '2dir')], [100, 99, null, 102, 100], 'zOf / timeOf / paperZOf');
  eq([A.devPct(110, 100), A.devPct(null, 100), A.devPct(100, null), A.devPct(100, 0)], [10, null, null, null], 'devPct');

  // Registros inválidos: dos fases con error y corrida «ok» sin solución cuentan como error.
  const broken = A.buildInstances(
    { ...fixture, records: [errRec('twophase', 20, 1, 1, null), runRec('ils-exact', 20, 1, 1, 1, [110, 100, 0.1, 2], { best: undefined })] },
    null,
  );
  const b1 = broken.find((r) => r.n === 20 && r.id === 1)!;
  eq([b1.cells.twophase.errors, b1.cells['ils-exact'].errors, b1.cells['ils-exact'].z1, b1.paper, b1.best], [1, 1, null, null, null], 'errores de dos fases y corridas sin solución; sin paper → paper null');
  // Sin tour TSP registrado, el tiempo es solo el de la dirección.
  const noTsp = A.buildInstances({ ...fixture, records: [runRec('ils-exact', 20, 1, 1, 1, [110, 100, 0.25, 2])] }, null);
  approx(noTsp.find((r) => r.n === 20 && r.id === 1)!.cells['ils-exact'].t1, 2.25, 'sin registro TSP: t1 = init + run');
}

{
  // Resúmenes por |Vc|, ámbito 'done' (cada método con sus instancias terminadas).
  const s1 = A.summarizeByN(rows, '1dir', paperFix);
  eq(s1.map((g) => [g.n, g.h, g.instances, g.complete]), [[20, 1, 2, false], [40, 0.5, 2, false], [60, 0.33, 1, false]], 'summarizeByN 1dir: grupos, h y completitud');
  const m20 = s1[0].methods;
  const tp = m20.twophase;
  eq([tp.done, tp.devPct, tp.avgZ, tp.paperDevPct, tp.paperAvgZ, tp.paperTimeSec, tp.improved, tp.beatsPaper, tp.beatsBest], [2, 10, 165, 10, 165, null, 0, 0, 0], '1dir |Vc|=20 dos fases');
  approx(tp.timeSec, (0.6 + 1.1) / 2, '1dir |Vc|=20 dos fases: tiempo medio');
  const ie = m20['ils-exact'];
  eq([ie.done, ie.devPct, ie.avgZ, ie.paperDevPct, ie.paperAvgZ, ie.paperTimeSec, ie.improved, ie.beatsPaper, ie.beatsBest], [2, 1, 152, 1.75, 153, 1.5, 2, 2, 0], '1dir |Vc|=20 ILS exacto');
  approx(ie.timeSec, (2.6 + 5.1) / 2, '1dir |Vc|=20 ILS exacto: tiempo medio');
  const ih = m20['ils-heuristic'];
  eq([ih.done, ih.devPct, ih.paperDevPct, ih.paperTimeSec, ih.improved, ih.beatsPaper], [2, 7.75, 5.5, null, 2, 0], '1dir |Vc|=20 ILS heurístico (sin tiempo del paper por |Vc|)');
  approx(ih.timeSec, (1.0 + 1.6) / 2, '1dir |Vc|=20 ILS heurístico: tiempo medio');
  const te = m20['its-exact'];
  eq([te.done, te.devPct, te.timeSec, te.paperDevPct, te.paperTimeSec, te.improved, te.beatsPaper], [1, 1, 3.1, 1, 0.75, 1, 0], '1dir |Vc|=20 ITS exacto (solo la instancia terminada)');
  const th = m20['its-heuristic'];
  eq([th.done, th.devPct, th.paperDevPct, th.improved, th.beatsPaper], [2, 7.5, 5.75, 1, 1], '1dir |Vc|=20 ITS heurístico');
  const m40 = s1[1].methods;
  eq(A.META_METHODS.map((m) => [m40[m].done, m40[m].devPct, m40[m].timeSec, m40[m].paperDevPct]), A.META_METHODS.map(() => [0, null, null, null]), '1dir |Vc|=40 sin resultados: todo null');
  eq([m40['ils-exact'].paperTimeSec, m40['its-exact'].paperTimeSec], [3, 1.5], '1dir |Vc|=40: tiempo del paper (Tabla 2) aun sin resultados propios');
  eq(s1[2].methods['ils-exact'].paperTimeSec, null, '|Vc| fuera del paper: sin tiempo del paper');

  const s2 = A.summarizeByN(rows, '2dir', paperFix);
  const n20 = s2[0].methods;
  eq([n20.twophase.done, n20.twophase.devPct, n20.twophase.paperDevPct, n20.twophase.beatsPaper], [2, 8, 7.5, 0], '2dir |Vc|=20 dos fases (paper: min de las columnas)');
  approx(n20.twophase.timeSec, (0.8 + 1.2) / 2, '2dir |Vc|=20 dos fases: tiempo medio');
  const e2 = n20['ils-exact'];
  eq([e2.done, e2.devPct, e2.paperDevPct, e2.paperTimeSec, e2.improved, e2.beatsPaper, e2.beatsBest], [2, 0.5, 1.5, 3, 2, 1, 1], '2dir |Vc|=20 ILS exacto (tiempo del paper ×2, supera Best)');
  approx(e2.timeSec, (5.8 + 9.2) / 2, '2dir |Vc|=20 ILS exacto: tiempo medio');
  eq([n20['ils-heuristic'].done, n20['ils-heuristic'].devPct, n20['ils-heuristic'].improved], [1, 6, 1], '2dir |Vc|=20 ILS heurístico: la instancia pendiente no cuenta');
  approx(n20['ils-heuristic'].timeSec, 2.2, '2dir |Vc|=20 ILS heurístico: tiempo');
  eq([n20['its-exact'].done, n20['its-exact'].devPct, n20['its-exact'].paperDevPct, n20['its-exact'].paperTimeSec, n20['its-exact'].beatsBest], [1, -0.5, 1, 1.5, 1], '2dir |Vc|=20 ITS exacto');
  eq([n20['its-heuristic'].done, n20['its-heuristic'].devPct, n20['its-heuristic'].improved], [2, 7, 2], '2dir |Vc|=20 ITS heurístico');
  approx(n20['its-heuristic'].timeSec, (1.3 + 3.2) / 2, '2dir |Vc|=20 ITS heurístico: tiempo medio');

  // Ámbito 'common': solo instancias que todos los métodos terminaron en esa dirección → (20,2).
  for (const dir of DIRS) {
    const c = A.summarizeByN(rows, dir, paperFix, 'common')[0].methods;
    eq(A.META_METHODS.map((m) => c[m].done), [1, 1, 1, 1, 1], `${dir} 'common' |Vc|=20: solo (20,2)`);
    eq(c.twophase.devPct, dir === '1dir' ? 10 : 6, `${dir} 'common' |Vc|=20: dos fases sobre (20,2)`);
    eq(c['ils-exact'].paperDevPct, dir === '1dir' ? 2.5 : 2, `${dir} 'common' |Vc|=20: paper sobre las mismas instancias`);
  }
  eq(A.summarizeByN(rows, '1dir', paperFix, 'common')[1].methods['ils-exact'].done, 0, "'common' |Vc|=40: ninguna instancia común");

  // Completitud: con todo terminado en |Vc| = 20.
  const fullRows = A.buildInstances(
    {
      ...fixture,
      records: [
        ...fixRecords,
        runRec('ils-heuristic', 20, 1, 1, 2, [115, 104, 0.2, 0.4]),
        runRec('its-exact', 20, 1, 1, 1, [110, 102, 0.1, 1.1]),
      ],
    },
    paperFix,
  );
  eq(DIRS.map((d) => A.summarizeByN(fullRows, d, paperFix)[0].complete), [true, true], 'complete con |Vc| = 20 terminado');
  eq(fullRows.find((r) => r.n === 20 && r.id === 1)!.cells['its-exact'].errors, 1, 'un error previo se sigue contando aunque luego haya resultado');

  // Promedio general: fila «Time (s)» de la Tabla 9 solo para los métodos cuyo promedio cubre todas
  // las instancias del paper (con datos parciales, nuestro promedio de un subconjunto no se compara
  // con el de las 100 del paper).
  const o1 = A.summarizeOverall(rows, '1dir', paperFix);
  const o2 = A.summarizeOverall(rows, '2dir', paperFix);
  eq(
    A.META_METHODS.map((m) => [o1[m].paperTimeSec, o2[m].paperTimeSec]),
    A.META_METHODS.map(() => [null, null]),
    'summarizeOverall: instancias del paper sin terminar (|Vc| = 40) → sin tiempos de la Tabla 9',
  );
  eq([o1['ils-exact'].done, o1['ils-exact'].devPct, o1['ils-exact'].paperDevPct], [2, 1, 1.75], 'summarizeOverall 1dir ILS exacto');
  const partial = A.summarizeOverall(rows.filter((r) => r.n === 20), '1dir', paperFix);
  eq(A.META_METHODS.map((m) => partial[m].paperTimeSec), [null, null, null, null, null], 'summarizeOverall sin la grilla del paper completa: sin tiempos del paper');
  // Paper reducido a |Vc| = 20: 'done' exige que ESE método haya terminado sus instancias; 'common', que todos.
  const paper20: PaperFile = { ...paperFix, instances: paperFix.instances.filter((p) => p.n === 20) };
  const d1 = A.summarizeOverall(rows, '1dir', paper20);
  const d2 = A.summarizeOverall(rows, '2dir', paper20);
  eq(
    A.META_METHODS.map((m) => [d1[m].paperTimeSec, d2[m].paperTimeSec]),
    [
      [null, null],
      [10, null],
      [100, 201],
      [5, 11],
      [null, null],
    ],
    "summarizeOverall 'done': Tabla 9 solo para los métodos con todas las instancias del paper (1dir = columna 1; 2dir = suma)",
  );
  eq(
    DIRS.map((d) => A.META_METHODS.map((m) => A.summarizeOverall(rows, d, paper20, 'common')[m].paperTimeSec)),
    DIRS.map(() => [null, null, null, null, null]),
    "summarizeOverall 'common': sin tiempos de la Tabla 9 si alguna instancia del paper no es común",
  );
  for (const scope of ['done', 'common'] as const) {
    const f1 = A.summarizeOverall(fullRows, '1dir', paper20, scope);
    const f2 = A.summarizeOverall(fullRows, '2dir', paper20, scope);
    eq(
      A.META_METHODS.map((m) => [f1[m].paperTimeSec, f2[m].paperTimeSec]),
      [
        [null, null],
        [10, 21],
        [100, 201],
        [5, 11],
        [50, 102],
      ],
      `summarizeOverall '${scope}' con todo terminado: tiempos de la Tabla 9 (1dir = columna 1; 2dir = suma)`,
    );
  }
  eq(A.summarizeOverall(rows, '2dir', paperFix, 'common')['ils-exact'].done, 1, "summarizeOverall 'common'");
  eq(A.summarizeOverall(rows, '1dir', null)['ils-exact'].paperTimeSec, null, 'summarizeOverall sin paper');
}

{
  // Avance: tour TSP + dos fases + 8 corridas por instancia de la grilla; los errores cuentan.
  const p = A.progressOf(fixture);
  eq([p.expected, p.done, p.errors, p.pct, p.complete], [40, 20, 1, 50, false], 'progressOf: 2 × 2 instancias × 10 ejecuciones');
  check(p.lastFinishedAt !== null && p.lastFinishedAt < '2030', `progressOf: lastFinishedAt ignora variantes extra e instancias fuera de la grilla (${p.lastFinishedAt})`);
  const p0 = A.progressOf(null);
  eq([p0.expected, p0.done, p0.errors, p0.pct, p0.complete, p0.lastFinishedAt], [1000, 0, 0, 0, false, null], 'progressOf(null): 1.000 ejecuciones pendientes');
  eq(A.progressOf({ ...fixture, meta: null }).expected, 1000, 'progressOf sin meta: grilla por defecto');
  const reduced = A.progressOf({ ...fixture, meta: { ...fixture.meta!, grid: { sizes: [20], ids: [2], methods: ['twophase', 'its-exact'] } } });
  eq([reduced.expected, reduced.done, reduced.complete], [4, 4, true], 'progressOf con meta.grid.methods reducido: tsp + dos fases + 2 direcciones');
  const one = A.progressOf({ ...fixture, meta: { ...fixture.meta!, grid: { sizes: [20], ids: [2], methods: [...A.META_METHODS] } } });
  eq([one.expected, one.done, one.pct, one.complete], [10, 10, 100, true], 'progressOf: instancia completa');
}

{
  // Lector del servidor: consolidado ausente → registros.jsonl (líneas corruptas se ignoran); paper aparte.
  const os = await import('os');
  const api = (await import('./solutions-api.js')) as {
    readMetaheuristics?: (dir: string) => { data: MetaFile | null; paper: PaperFile | null; itsNrand?: ItsNrandFile | null };
  };
  if (typeof api.readMetaheuristics === 'function') {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-'));
    try {
      eq(api.readMetaheuristics(tmp), { data: null, paper: null, itsNrand: null }, 'readMetaheuristics sin carpeta → { data: null, paper: null, itsNrand: null }');
      const dir = path.join(tmp, 'BenchmarkErdogan2012');
      fs.mkdirSync(dir);
      const lines = fixRecords.slice(0, 4).map((r) => JSON.stringify(r));
      fs.writeFileSync(path.join(dir, 'registros.jsonl'), lines.join('\n') + '\n{"key": "a medio escrib');
      fs.writeFileSync(path.join(dir, 'paper_erdogan2012.json'), JSON.stringify(paperFix));
      const got = api.readMetaheuristics(tmp);
      eq([got.data?.count, got.data?.meta, got.paper?.instances.length, got.itsNrand], [4, null, 4, null], 'readMetaheuristics: JSONL (sin la línea a medio escribir) + paper, sin its_nrand.json');
      const nrandRun = { n: 20, id: 1, nRand: 2, initial: 110, best: 100, improvements: 1, bestIteration: 1, runSec: 1, paperInitial: 110, paperItsExact1dir: 102 };
      fs.writeFileSync(path.join(dir, 'its_nrand.json'), JSON.stringify({ title: 't', note: '', runs: [] }));
      eq(api.readMetaheuristics(tmp).itsNrand, null, 'readMetaheuristics: its_nrand.json sin corridas → null');
      fs.writeFileSync(path.join(dir, 'its_nrand.json'), JSON.stringify({ title: 't', note: '', runs: [nrandRun] }));
      eq(api.readMetaheuristics(tmp).itsNrand?.runs, [nrandRun], 'readMetaheuristics: its_nrand.json');
      eq(A.buildInstances(got.data, got.paper).find((r) => r.n === 20 && r.id === 1)!.cells['ils-exact'].z1, 100, 'buildInstances sobre lo que entrega el lector');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } else console.log('   (readMetaheuristics no existe en scripts/solutions-api.js: se omite esa comprobación)');
}

console.log(`   ${checks} comprobaciones, ${failures} fallas`);

// =============================================================================================
// 2) CIFRAS REALES DEL PAPER (Tablas 2–3 y 8–9)
// =============================================================================================
console.log('\n2) Cifras del paper en Outputs/BenchmarkErdogan2012/paper_erdogan2012.json');
const paperPath = path.join(metaDir, 'paper_erdogan2012.json');
let paperReal: PaperFile | null = null;
{
  const before = failures;
  if (!fs.existsSync(paperPath)) {
    console.log('⚠ No existe paper_erdogan2012.json (notebooks/erdogan2012/paper_tables.py). Se omite esta parte.');
  } else {
    const paper = JSON.parse(fs.readFileSync(paperPath, 'utf-8')) as PaperFile;
    paperReal = paper;
    const TOL = 0.006;
    const { sizes, ids } = A.gridOf(null);
    eq(paper.instances.length, sizes.length * ids.length, 'paper: 100 instancias');
    for (const n of sizes) for (const id of ids) check(paper.instances.some((r) => r.n === n && r.id === id), `paper: falta (${n}, ${id})`);
    eq(Object.keys(paper.byN).map(Number).sort((a, b) => a - b), sizes, 'paper.byN: un resumen por |Vc|');
    eq(paper.validation?.tables67Match, true, 'paper.validation.tables67Match');

    // PAPER_COLUMNS: cada método apunta a su familia y a «tour original» (1) / «tour invertido» (2).
    const FAMILY: Record<MetaMethod, RegExp> = {
      twophase: /inicial/i,
      'ils-heuristic': /^ILS heurístico/,
      'ils-exact': /^ILS exacto/,
      'its-heuristic': /^ITS heurístico/,
      'its-exact': /^ITS exacto/,
    };
    const seen = new Set<string>();
    for (const m of A.META_METHODS) {
      const [c1, c2] = A.PAPER_COLUMNS[m];
      seen.add(c1);
      seen.add(c2);
      const d1 = paper.columns?.[c1] ?? '';
      const d2 = paper.columns?.[c2] ?? '';
      check(FAMILY[m].test(d1) && FAMILY[m].test(d2), `PAPER_COLUMNS[${m}] = ${c1}/${c2}: «${d1}» / «${d2}»`);
      check(!/invertido/i.test(d1) && /invertido/i.test(d2), `PAPER_COLUMNS[${m}]: la 1.ª columna es el tour, la 2.ª el tour invertido`);
      for (const r of paper.instances) check(Number.isFinite(r[c1]) && Number.isFinite(r[c2]), `paper (${r.n},${r.id}): ${c1}/${c2} no numéricos`);
    }
    eq(seen.size, 10, 'PAPER_COLUMNS: 10 columnas distintas');
    for (const r of paper.instances)
      for (const c of seen) check(r[c as keyof PaperRow] >= r.best - 0.005, `paper (${r.n},${r.id}): ${c} = ${r[c as keyof PaperRow]} < Best ${r.best}`);

    // Sin ejecuciones propias: estructura completa, todo pendiente, sin cifras del paper en los promedios.
    const empty = A.buildInstances(null, paper);
    eq(empty.length, 100, 'buildInstances(null, paper): 100 filas');
    check(empty.every((r) => r.best !== null && r.paper !== null && A.META_METHODS.every((m) => r.cells[m].z1 === null && r.cells[m].z2 === null)), 'sin registros: Best y paper presentes, todo lo propio pendiente');
    const emptySum = A.summarizeByN(empty, '2dir', paper);
    check(emptySum.every((g) => !g.complete && A.META_METHODS.every((m) => g.methods[m].done === 0 && g.methods[m].paperDevPct === null)), 'sin registros: resúmenes vacíos (el paper se promedia solo sobre instancias terminadas)');
    eq(emptySum.map((g) => g.methods['ils-exact'].paperTimeSec), sizes.map((n) => 2 * paper.byN[String(n)].ilsExact1dirTimeSec), 'sin registros: tiempo del paper por |Vc| igual disponible (2dir = 2 × Tabla 2)');

    // «Espejo»: nuestras corridas con exactamente los Z del paper (dir. 1 = 1 dir., dir. 2 = 2 dir.).
    const mirrorRecs: MetaRecord[] = [];
    for (const r of paper.instances) {
      const h = 0.1;
      mirrorRecs.push(tspRec(r.n, r.id, h, 0));
      mirrorRecs.push(twoPhaseRec(r.n, r.id, h, [r.init1, 0], [r.init2, 0]));
      for (const m of RUN_METHODS) {
        const [c1, c2] = A.PAPER_COLUMNS[m];
        mirrorRecs.push(runRec(m, r.n, r.id, h, 1, [r.init1, r[c1], 0, 1]));
        mirrorRecs.push(runRec(m, r.n, r.id, h, 2, [r.init2, r[c2], 0, 1]));
      }
    }
    const mirror = A.buildInstances({ ...fixture, meta: null, records: mirrorRecs }, paper);
    eq(A.progressOf({ ...fixture, meta: null, records: mirrorRecs }), { ...A.progressOf({ ...fixture, meta: null, records: mirrorRecs }), done: 1000, complete: true }, 'espejo: 1.000 ejecuciones');
    let worst = 0;
    for (const dir of DIRS) {
      const sums = A.summarizeByN(mirror, dir, paper);
      for (const g of sums) {
        const ref = paper.byN[String(g.n)];
        check(g.complete, `espejo ${dir} |Vc|=${g.n}: completo`);
        for (const m of A.META_METHODS) {
          const s = g.methods[m];
          eq([s.done, s.beatsPaper], [10, 0], `espejo ${dir} |Vc|=${g.n} ${m}: 10 instancias, ninguna mejor que el paper`);
          approx(s.devPct, s.paperDevPct, `espejo ${dir} |Vc|=${g.n} ${m}: desviación propia = la del paper`);
        }
        const pairs: [MetaMethod, number, number][] =
          dir === '1dir'
            ? [
                ['ils-exact', ref.ilsExact1dirDevPct, ref.ilsExact1dirTimeSec],
                ['its-exact', ref.itsExact1dirDevPct, ref.itsExact1dirTimeSec],
              ]
            : [
                ['ils-exact', ref.ilsExact2dirDevPct, 2 * ref.ilsExact1dirTimeSec],
                ['its-exact', ref.itsExact2dirDevPct, 2 * ref.itsExact1dirTimeSec],
              ];
        for (const [m, dev, sec] of pairs) {
          const got = g.methods[m].paperDevPct;
          if (typeof got === 'number') worst = Math.max(worst, Math.abs(got - dev));
          within(got, dev, TOL, `Tabla ${dir === '1dir' ? 2 : 3} |Vc|=${g.n} ${m} ${dir}: desviación`);
          approx(g.methods[m].paperTimeSec, sec, `Tabla 2 |Vc|=${g.n} ${m} ${dir}: segundos`);
        }
      }
      // Promedio general (fila «Average» de las Tablas 2–3) y fila «Time (s)» de la Tabla 9.
      const o = A.summarizeOverall(mirror, dir, paper);
      const avg = paper.averages;
      within(o['ils-exact'].paperDevPct, dir === '1dir' ? avg.ilsExact1dirDevPct : avg.ilsExact2dirDevPct, TOL, `promedio ${dir} ILS exacto`);
      within(o['its-exact'].paperDevPct, dir === '1dir' ? avg.itsExact1dirDevPct : avg.itsExact2dirDevPct, TOL, `promedio ${dir} ITS exacto`);
      const t9 = paper.timeRowTable9;
      eq(
        RUN_METHODS.map((m) => o[m].paperTimeSec),
        dir === '1dir' ? [t9.ilsH1, t9.ilsE1, t9.itsH1, t9.itsE1] : [t9.ilsH1 + t9.ilsH2, t9.ilsE1 + t9.ilsE2, t9.itsH1 + t9.itsH2, t9.itsE1 + t9.itsE2],
        `promedio ${dir}: segundos de la fila «Time (s)» de la Tabla 9`,
      );
    }
    // Coherencia interna del paper: la fila «Average» de la Tabla 2 es la media de los |Vc|.
    for (const k of ['ilsExact1dirTimeSec', 'itsExact1dirTimeSec'] as const) {
      const mean = sizes.reduce((s, n) => s + paper.byN[String(n)][k], 0) / sizes.length;
      within(mean, paper.averages[k], 0.006, `paper: Average de la Tabla 2 (${k}) = media por |Vc|`);
    }
    const t9Gap = Math.abs(paper.averages.itsExact1dirTimeSec - paper.timeRowTable9.itsE1);
    if (t9Gap > 0.01)
      console.log(
        `   (nota: el paper publica ${paper.averages.itsExact1dirTimeSec} s para ITS exacto 1dir en la Tabla 2 y ${paper.timeRowTable9.itsE1} s en la fila «Time (s)» de la Tabla 9)`,
      );
    console.log(`   máx. |Δ| Tablas 2–3: ${worst.toFixed(4)} pp · ${failures - before} fallas`);
  }
}

// =============================================================================================
// 3) REGISTROS REALES (solo lectura)
// =============================================================================================
console.log('\n3) Registros reales en Outputs/BenchmarkErdogan2012');
const jsonlPath = path.join(metaDir, 'registros.jsonl');

type RawRec = Record<string, any>;

/** Último registro por clave del JSONL (líneas corruptas o a medio escribir se ignoran). */
function readJsonl(file: string): { latest: Map<string, RawRec>; lines: number; bad: number } {
  const latest = new Map<string, RawRec>();
  let lines = 0;
  let bad = 0;
  if (!fs.existsSync(file)) return { latest, lines, bad };
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    lines++;
    try {
      const r = JSON.parse(line) as RawRec;
      if (typeof r?.key === 'string') latest.set(r.key, r);
      else bad++;
    } catch {
      bad++;
    }
  }
  return { latest, lines, bad };
}

{
  const before = failures;
  const api = (await import('./solutions-api.js')) as { readMetaheuristics?: (dir: string) => { data: MetaFile | null; paper: PaperFile | null } };
  // El lector de la página primero (el benchmark agrega la línea al JSONL y luego reescribe el
  // consolidado): así el JSONL leído después contiene al menos lo que entregó el lector.
  const page = typeof api.readMetaheuristics === 'function' ? api.readMetaheuristics(outputsDir) : { data: null, paper: null };
  const { latest, lines, bad } = readJsonl(jsonlPath);
  if (!page.data && latest.size === 0) {
    console.log('⚠ Aún no hay registros (node notebooks/erdogan2012/benchmark.mjs). Se omite esta parte.');
  } else {
    const data = page.data;
    const paper = page.paper ?? paperReal;
    console.log(`   lector: ${data ? data.records.length : '—'} registros (${data?.meta ? 'consolidado' : 'desde el JSONL'}) · JSONL: ${lines} líneas, ${latest.size} claves, ${bad} corruptas`);

    // 3a) Lo que entrega el lector coincide con el JSONL (salvo ejecuciones más nuevas en vivo).
    const sameRun = new Set<string>();
    let newer = 0;
    for (const r of data?.records ?? []) {
      const l = latest.get(r.key);
      if (!l) {
        check(false, `${r.key}: no está en registros.jsonl`);
        continue;
      }
      if (l.finishedAt !== r.finishedAt) {
        newer++;
        continue;
      }
      sameRun.add(r.key);
      check(l.status === r.status && l.method === r.method && l.n === r.n && l.id === r.id, `${r.key}: distinto del JSONL`);
    }
    if (newer) console.log(`   (${newer} claves con una ejecución más nueva en el JSONL: el benchmark corre en vivo)`);

    // 3b) Integridad de cada registro del JSONL.
    const H: Record<number, number> = { 20: 1, 40: 0.5, 60: 0.33, 80: 0.125, 100: 0.1, 120: 0.17, 140: 0.14, 160: 0.125, 180: 0.11, 200: 0.1 };
    const KNOWN = new Set(['tsp', ...A.META_METHODS, 'ilsd-heuristic', 'ilsd-exact']);
    const { sizes, ids } = A.gridOf(data);
    const nIter = data?.meta?.params?.nIter ?? 200;
    const nIterIts = data?.meta?.params?.nIterIts ?? Math.floor(Math.sqrt(nIter));
    let okRuns = 0;
    for (const r of latest.values()) {
      const tag = r.key;
      check(KNOWN.has(r.method), `${tag}: método desconocido`);
      const isRun = r.method !== 'tsp' && r.method !== 'twophase';
      eq(r.key, isRun ? `${r.method}|${r.n}|${r.id}|${r.dir}` : `${r.method}|${r.n}|${r.id}`, `${tag}: clave ≠ método|n|id[|dir]`);
      check(sizes.includes(r.n) && ids.includes(r.id), `${tag}: instancia fuera de la grilla`);
      if (H[r.n] !== undefined) approx(r.h, data?.meta?.h?.[String(r.n)] ?? H[r.n], `${tag}: h de la instancia`);
      if (r.status !== 'ok') {
        check(typeof r.error === 'string' && r.error.length > 0, `${tag}: error sin mensaje`);
        continue;
      }
      if (r.method === 'tsp') {
        check(r.length > 0 && r.timeSec >= 0, `${tag}: tour TSP sin largo o tiempo`);
        if (Array.isArray(r.tour)) eq(new Set(r.tour).size, r.n + 1, `${tag}: el tour visita depósito + |Vc| clientes`);
      } else if (r.method === 'twophase') {
        eq(r.dirs?.length, 2, `${tag}: dos direcciones`);
        for (const d of r.dirs ?? []) approx(d.objective, d.distance + d.handling, `${tag} dir ${d.dir}: Z = ruteo + manipulación`, 1e-6);
        const pr = paper?.instances.find((p) => p.n === r.n && p.id === r.id);
        if (pr && r.orientation === 'paper') {
          const hit = (z: number, ref: number) => Math.abs(Math.round(z * 100) / 100 - ref) < 0.006;
          check(hit(r.dirs[0].objective, pr.init1) || hit(r.dirs[1].objective, pr.init2), `${tag}: orientación 'paper' sin coincidir con la solución inicial del paper`);
        }
      } else {
        okRuns++;
        check(r.dir === 1 || r.dir === 2, `${tag}: dirección inválida`);
        check(r.best.objective <= r.initial.objective + 1e-6, `${tag}: la metaheurística empeoró la solución inicial`);
        approx(r.best.objective, r.best.distance + r.best.handling, `${tag}: Z = ruteo + manipulación`, 1e-6);
        check(r.initSec >= 0 && r.runSec >= 0, `${tag}: tiempos negativos`);
        if (Array.isArray(r.history) && r.history.length) {
          check(Math.min(...r.history) >= r.best.objective - 1e-6, `${tag}: la traza baja de la mejor solución`);
          if (r.method === 'ils-exact' || r.method === 'ils-heuristic') eq(r.history.length, nIter, `${tag}: traza del ILS con Niter puntos`);
          if (r.method === 'its-exact' || r.method === 'its-heuristic') eq(r.history.length, nIterIts, `${tag}: traza del ITS con N*iter puntos`);
        }
        // La solución inicial de cada dirección es la de dos fases (mismo tour y misma reubicación).
        const tp = latest.get(`twophase|${r.n}|${r.id}`);
        const d = tp?.status === 'ok' ? tp.dirs?.find((x: RawRec) => x.dir === r.dir) : null;
        if (d) {
          approx(r.initial.objective, d.objective, `${tag}: solución inicial ≠ dos fases dir. ${r.dir}`, 1e-6);
          eq(r.orientation, tp!.orientation, `${tag}: orientación ≠ dos fases`);
        }
      }
    }

    // 3c) Recálculo independiente de z1/z2/t1/t2 y comparación con buildInstances.
    const rowsReal = A.buildInstances(data, paper);
    let compared = 0;
    let skipped = 0;
    for (const n of sizes)
      for (const id of ids) {
        const tsp = latest.get(`tsp|${n}|${id}`);
        const tspSec = tsp?.status === 'ok' && Number.isFinite(tsp.timeSec) ? tsp.timeSec : 0;
        const row = rowsReal.find((r) => r.n === n && r.id === id)!;
        for (const m of A.META_METHODS) {
          const keys = m === 'twophase' ? [`twophase|${n}|${id}`] : [`${m}|${n}|${id}|1`, `${m}|${n}|${id}|2`];
          const involved = [`tsp|${n}|${id}`, ...keys].filter((k) => latest.has(k));
          if (!involved.length) continue;
          // Solo si el lector entregó exactamente las mismas ejecuciones que el JSONL.
          if (!involved.every((k) => sameRun.has(k))) {
            skipped++;
            continue;
          }
          let dir1: { z: number; sec: number } | null = null;
          let dir2: { z: number; sec: number } | null = null;
          if (m === 'twophase') {
            const tp = latest.get(keys[0]);
            if (tp?.status === 'ok')
              for (const d of tp.dirs ?? []) {
                const v = { z: d.objective, sec: d.timeSec ?? 0 };
                if (d.dir === 1) dir1 = v;
                else dir2 = v;
              }
          } else {
            const pick = (k: string) => {
              const r = latest.get(k);
              return r?.status === 'ok' && r.best && r.initial ? { z: r.best.objective as number, sec: (r.initSec ?? 0) + (r.runSec ?? 0) } : null;
            };
            dir1 = pick(keys[0]);
            dir2 = pick(keys[1]);
          }
          const c = row.cells[m];
          const want = {
            z1: dir1 ? dir1.z : null,
            t1: dir1 ? tspSec + dir1.sec : null,
            z2: dir1 && dir2 ? Math.min(dir1.z, dir2.z) : null,
            t2: dir1 && dir2 ? tspSec + dir1.sec + dir2.sec : null,
          };
          approx(c.z1, want.z1, `(${n},${id}) ${m}: z1`);
          approx(c.t1, want.t1, `(${n},${id}) ${m}: t1`);
          approx(c.z2, want.z2, `(${n},${id}) ${m}: z2`);
          approx(c.t2, want.t2, `(${n},${id}) ${m}: t2`);
          const best = paper?.instances.find((p) => p.n === n && p.id === id)?.best ?? null;
          if (want.z2 !== null && best !== null) approx(A.devPct(c.z2, row.best), ((want.z2 - best) / best) * 100, `(${n},${id}) ${m}: desviación 2dir`);
          compared++;
        }
      }

    // 3d) Avance: el lector nunca registra más que el JSONL; con el JSONL como fuente, lo mismo.
    const inGrid = (r: RawRec) => sizes.includes(r.n) && ids.includes(r.id) && (r.method === 'tsp' || A.META_METHODS.includes(r.method));
    const jsonlDone = [...latest.values()].filter(inGrid).length;
    const prog = A.progressOf(data);
    check(prog.done <= jsonlDone, `progressOf: ${prog.done} ejecuciones > ${jsonlDone} del JSONL`);
    if (!data?.meta) eq(prog.done, jsonlDone, 'progressOf = claves de la grilla en el JSONL (lector sin consolidado)');
    console.log(
      `   ${prog.done}/${prog.expected} ejecuciones (${okRuns} corridas de metaheurísticas) · ${compared} celdas método × instancia recalculadas` +
        (skipped ? ` · ${skipped} omitidas por ejecuciones más nuevas en vivo` : ''),
    );
    console.log(`   ${failures - before} fallas con los datos reales`);
  }
}

// =============================================================================================
// 4) EXPORTACIÓN (export.ts): modelo del resumen, detalle por instancia, LaTeX y CSV
// =============================================================================================
console.log('\n4) Exportación: resumen, detalle por instancia, LaTeX y CSV');
{
  const before = failures;
  const api = (await import('./solutions-api.js')) as { readMetaheuristics?: (dir: string) => { data: MetaFile | null; paper: PaperFile | null } };
  const real = typeof api.readMetaheuristics === 'function' ? api.readMetaheuristics(outputsDir) : { data: null, paper: null };
  const paper = real.paper ?? paperReal;
  const full = real.data;
  // Datos parciales: un tercio de los registros fuera y algunos con error (celdas «…» y «error»).
  const partial: MetaFile | null = full
    ? {
        ...full,
        records: full.records
          .filter((_, i) => i % 3 !== 0)
          .map((r, i) => (i % 17 === 0 ? ({ ...r, status: 'error', error: 'Error: simulado' } as MetaRecord) : r)),
      }
    : null;
  const cases: [string, MetaFile | null, PaperFile | null][] = [
    ['sin ejecuciones', null, paper],
    ['parcial', partial, paper],
    ['completo', full, paper],
    ['sin paper', full, null],
  ];

  eq(E.DETAIL_COLS.length, 2 * A.META_METHODS.length, 'DETAIL_COLS: 1 dir. y 2 dir. de cada método');
  eq(E.hFor(80, null), 0.125, 'hFor: respaldo PAPER_H con |Vc| = 80');
  eq(E.hFor(80, 0.2), 0.2, 'hFor: el h de los registros manda');
  eq(E.hLabel(0.125), '0,125', 'hLabel: 3 decimales sin redondear 0,125');
  if (paper) for (const cols of Object.values(E.PAPER_TIME_COLS)) for (const k of cols ?? []) check(Number.isFinite(paper.timeRowTable9[k]), `PAPER_TIME_COLS: ${k} no está en timeRowTable9`);

  /** LaTeX bien formado: sin NBSP ni «−» Unicode, «%» escapado, llaves equilibradas y filas con todas las columnas. */
  const texOk = (tex: string, cols: number, tag: string) => {
    check(!/[ −]/.test(tex), `${tag}: NBSP o «−» sin convertir`);
    // «%» comenta el resto de la línea en LaTeX: solo vale escapado (\%) o al final de la línea (\resizebox{…}{%).
    check(!tex.split('\n').some((l) => !l.startsWith('%') && /(^|[^\\])%./.test(l)), `${tag}: «%» sin escapar`);
    let depth = 0;
    for (const ch of tex.replace(/\\[{}]/g, '')) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth < 0) break;
    }
    eq(depth, 0, `${tag}: llaves equilibradas`);
    const start = tex.indexOf('\\midrule');
    const end = tex.indexOf('\\bottomrule');
    const body = tex
      .slice(start, end)
      .split('\n')
      .filter((l) => l.endsWith('\\\\') && !l.startsWith('\\multicolumn{' + cols));
    check(body.length > 0, `${tag}: tabla sin filas`);
    for (const l of body) eq((l.match(/(?<!\\)&/g) ?? []).length + (l.startsWith('\\multicolumn{2}') ? 1 : 0), cols - 1, `${tag}: columnas de «${l.slice(0, 40)}…»`);
  };

  let latexTables = 0;
  for (const [label, file, pap] of cases) {
    const rows = A.buildInstances(file, pap);
    const sizes = A.gridOf(file).sizes;
    for (const dir of DIRS) {
      // Modelo del resumen = summarizeByN ('done') por |Vc| y summarizeOverall ('common') en Prom.
      const model = E.summaryModel(rows, pap, dir, file);
      const byN = A.summarizeByN(rows, dir, pap, 'done');
      eq(model.byN.map((r) => r.n), byN.map((g) => g.n), `${label} ${dir}: filas del resumen`);
      for (const [i, g] of byN.entries())
        for (const m of A.META_METHODS) approx(model.byN[i].cells[m].s.devPct, g.methods[m].devPct, `${label} ${dir} |Vc| = ${g.n} ${m}: desviación`);
      const overall = A.summarizeOverall(rows, dir, pap, 'common');
      for (const m of A.META_METHODS) approx(model.overall.cells[m].s.timeSec, overall[m].timeSec, `${label} ${dir} Prom. ${m}: segundos`);
      check(model.commonInstances <= model.totalInstances, `${label} ${dir}: instancias comunes ≤ total`);
      texOk(E.toLatexSummary(rows, pap, dir, file), 2 + 2 * A.META_METHODS.length, `${label} ${dir}: LaTeX del resumen`);
      latexTables++;
    }
    // Detalle por instancia: pie de cada columna y LaTeX en las tres vistas.
    for (const n of sizes) {
      const list = rows.filter((r) => r.n === n);
      for (const c of E.DETAIL_COLS) {
        const f = E.detailFoot(list, c);
        eq(f.secDone, list.filter((r) => E.detailResult(r, c) !== null).length, `${label} |Vc| = ${n} ${c.key}: instancias con tiempo`);
        check(f.better + f.worse <= f.compared && f.compared <= f.secDone, `${label} |Vc| = ${n} ${c.key}: conteos del pie`);
        for (const r of list) {
          const p = E.detailPaper(r, c);
          if (r.paper) eq(p, c.dir === 1 ? r.paper[c.method].z1 : r.paper[c.method].zRev, `${label} (${n},${r.id}) ${c.key}: cifra del paper`);
          else eq(p, null, `${label} (${n},${r.id}) ${c.key}: sin paper`);
        }
      }
      for (const view of ['ours', 'paper', 'delta'] as const) {
        const tex = E.toLatexMetaDetail(rows, { n, view, paper: pap, h: E.hFor(n, list.find((r) => r.h !== null)?.h ?? null) });
        texOk(tex, 2 + E.DETAIL_COLS.length, `${label} |Vc| = ${n} ${view}: LaTeX del detalle`);
        const pendingCells = view !== 'paper' && list.some((r) => E.DETAIL_COLS.some((c) => !E.detailResult(r, c) && r.cells[c.method].errors === 0));
        check(!pendingCells || tex.includes('\\ldots: pendiente.'), `${label} |Vc| = ${n} ${view}: celdas pendientes sin nota`);
        latexTables++;
      }
    }
    // CSV: mismas columnas en cada línea; resumen = 2 direcciones × (tamaños + Prom.); instancias = una por fila.
    const csvShape = (csv: string, lines: number, tag: string) => {
      const ls = csv.trimEnd().split('\r\n');
      eq(ls.length, lines + 1, `${tag}: líneas`);
      const cols = ls[0].split(';').length;
      for (const l of ls) eq(l.split(';').length, cols, `${tag}: columnas`);
    };
    csvShape(E.toCsvSummary(rows, pap, undefined, file), 2 * (new Set(rows.map((r) => r.n)).size + 1), `${label}: CSV del resumen`);
    csvShape(E.toCsvInstances(rows), rows.length, `${label}: CSV por instancia`);
  }
  console.log(`   ${cases.length} escenarios · ${latexTables} tablas LaTeX revisadas${full ? '' : ' (sin registros reales: solo el paper)'}`);
  console.log(`   ${failures - before} fallas`);
}

// =============================================================================================
// 5) SENSIBILIDAD DEL ITS EXACTO A NRAND (its_nrand.json, solo lectura)
// =============================================================================================
console.log('\n5) Sensibilidad del ITS exacto a Nrand (its_nrand.json)');
{
  const before = failures;
  const nrandPath = path.join(metaDir, 'its_nrand.json');
  if (!fs.existsSync(nrandPath)) {
    console.log('⚠ No existe its_nrand.json (node notebooks/erdogan2012/its_nrand.mjs). Se omite esta parte.');
  } else {
    const api = (await import('./solutions-api.js')) as {
      readMetaheuristics?: (dir: string) => { data: MetaFile | null; paper: PaperFile | null; itsNrand?: ItsNrandFile | null };
    };
    const fromReader = typeof api.readMetaheuristics === 'function' ? api.readMetaheuristics(outputsDir) : null;
    const file = JSON.parse(fs.readFileSync(nrandPath, 'utf-8')) as ItsNrandFile;
    check(Array.isArray(file.runs) && file.runs.length > 0, 'its_nrand.json: sin corridas');
    if (fromReader) eq(fromReader.itsNrand?.runs.length, file.runs.length, 'readMetaheuristics entrega its_nrand.json');
    const d = fromReader?.data?.meta?.params?.d ?? 0.1;
    // Misma regla que benchmark.mjs (nRandOf).
    const nRandOf = (n: number) => Math.max(1, Math.floor(d * n + 0.5 + 1e-9));
    const { latest } = readJsonl(jsonlPath);
    let matched = 0;
    for (const r of file.runs ?? []) {
      check(r.best <= r.initial + 1e-6, `its_nrand (${r.n},${r.id}) Nrand ${r.nRand}: Z final mayor que la inicial`);
      if (r.nRand !== nRandOf(r.n)) continue;
      const rec = latest.get(`its-exact|${r.n}|${r.id}|1`);
      if (!rec) {
        console.log(`   (sin its-exact|${r.n}|${r.id}|1 en registros.jsonl: no se compara)`);
        continue;
      }
      matched++;
      eq(rec.status, 'ok', `its-exact|${r.n}|${r.id}|1: estado`);
      approx(r.initial, rec.initial?.objective, `its_nrand (${r.n},${r.id}) Nrand ${r.nRand}: solución inicial = its-exact|${r.n}|${r.id}|1`, 1e-6);
      approx(r.best, rec.best?.objective, `its_nrand (${r.n},${r.id}) Nrand ${r.nRand}: Z final = its-exact|${r.n}|${r.id}|1`, 1e-6);
    }
    check(latest.size === 0 || matched > 0, 'its_nrand.json: ninguna corrida con el Nrand del §4.3 (0,1·|Vc|) que comparar con el benchmark');
    console.log(`   ${file.runs?.length ?? 0} corridas · ${matched} con Nrand = ${d}·|Vc| comparadas con its-exact del benchmark · ${failures - before} fallas`);
  }
}

console.log(failures === 0 ? `\n✓ Benchmark de metaheurísticas: ${checks} comprobaciones correctas` : `\n✗ ${failures} fallas de ${checks} comprobaciones`);
process.exit(failures === 0 ? 0 : 1);
