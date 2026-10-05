/**
 * Benchmark de metaheurísticas a gran escala — réplica de las Tablas 8 y 9 de Erdoğan et al. (2012).
 *
 * Compara, sobre las instancias de Gendreau et al. (1999) recortadas a |Vc| = 20, 40, …, 200
 * (instances.mjs), la función objetivo y el tiempo de:
 *
 *   · twophase       Dos fases: tour TSP → reubicación del depósito → manipulación óptima (Alg. 2.1 + DP)
 *                    — es la «Initial solution» de las Tablas 8–9
 *   · ils-heuristic  ILS (Algoritmo 4.2) con evaluación heurística lineal del vecindario (§2.2)
 *   · ils-exact      ILS con evaluación exacta (Alg. 2.1 + DP)
 *   · its-heuristic  ITS (Algoritmo 4.3) con evaluación heurística
 *   · its-exact      ITS con evaluación exacta
 *
 * Cada método se corre desde el tour TSP (dirección 1) y desde el tour invertido (dirección 2), con
 * Niter = 200 iteraciones en cada una: X-1dir es la dirección 1 y X-2dir el mínimo de ambas (así se
 * reproducen las Tablas 2–3 del paper; ver paper_tables.py). Parámetros del §4–5: Nrand = 0,1·|Vc|,
 * lista tabú de 0,5·|Vc|, N*iter = ⌊√Niter⌋ = 14 para el ITS, h de las Tablas 8–9 (instances.mjs).
 *
 * El tour TSP se calcula una vez por instancia (fase 1) y lo reutilizan todos los métodos. La
 * dirección 1 es la que reproduce la columna «Initial solution, 1 dir.» del paper cuando alguna de
 * nuestras dos soluciones iniciales coincide con las suyas; si no, la que parte por el cliente de menor
 * índice entre los dos vecinos del depósito.
 *
 * Tiempos (segundos de pared en un hilo de Node.js; los procesos en paralelo no comparten trabajo):
 *   · tspSec: construir el tour TSP (una vez por instancia).
 *   · initSec: reubicar el depósito en esa dirección (n evaluaciones de la DP).
 *   · runSec: la metaheurística en esa dirección.
 * La página suma: 1dir = tsp + init + run de la dirección 1; 2dir = tsp + ambas direcciones.
 *
 * Resultados (los lee la Página Web 12, sección «Metaheurísticas»):
 *   Outputs/BenchmarkErdogan2012/registros.jsonl              una línea por ejecución (se reanuda desde aquí)
 *   Outputs/BenchmarkErdogan2012/benchmark_metaheuristicas.json  consolidado: configuración + registros
 *   Outputs/BenchmarkErdogan2012/paper_erdogan2012.json       cifras del paper (paper_tables.py)
 *
 * Uso:
 *   node notebooks/erdogan2012/benchmark.mjs                                  # grilla completa
 *   node notebooks/erdogan2012/benchmark.mjs --sizes 20,40 --ids 1-3          # subconjunto
 *   node notebooks/erdogan2012/benchmark.mjs --methods twophase,its-exact --workers 4
 *   node notebooks/erdogan2012/benchmark.mjs --consolidate                    # solo regenerar el JSON
 *   node notebooks/erdogan2012/benchmark.mjs --dry-run                        # listar lo pendiente
 * Las ejecuciones ya registradas con la misma configuración se omiten (--force para repetirlas).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { BASE_DIR, IDS, PAPER_H, SIZES, buildInstance, defaultH } from './instances.mjs';
import { Evaluator, its, ils, makeRng, relocateDepot, round6, seedOf, solveTsp } from './engine.mjs';

/* ───────────────────────── Configuración por defecto ───────────────────────── */

export const METHODS = ['twophase', 'ils-heuristic', 'ils-exact', 'its-heuristic', 'its-exact'];
/** Variantes opcionales (no forman parte de la grilla por defecto): ILS con descenso completo. */
export const EXTRA_METHODS = ['ilsd-heuristic', 'ilsd-exact'];
export const METHOD_LABELS = {
  twophase: 'Dos fases (TSP + Alg. 2.1)',
  'ils-heuristic': 'ILS heurístico',
  'ils-exact': 'ILS exacto',
  'its-heuristic': 'ITS heurístico',
  'its-exact': 'ITS exacto',
  'ilsd-heuristic': 'ILS heurístico (descenso completo)',
  'ilsd-exact': 'ILS exacto (descenso completo)',
};
const DEFAULTS = {
  iters: 200, // Niter por dirección (§5)
  d: 0.1, // Nrand = d·|Vc| (§4.2)
  tabuRatio: 0.5, // largo de la lista tabú = c·|Vc| con c = 50 % (§4.1)
  seed: 1,
  tspKicks: 3000,
  tspRestarts: 8,
  workers: Math.max(1, Math.min(8, Math.floor((os.availableParallelism?.() ?? os.cpus().length) / 2))),
};

const OUT_DIR = path.join(BASE_DIR, 'Outputs', 'BenchmarkErdogan2012');
const RECORDS_FILE = path.join(OUT_DIR, 'registros.jsonl');
const SUMMARY_FILE = path.join(OUT_DIR, 'benchmark_metaheuristicas.json');
const PAPER_FILE = path.join(OUT_DIR, 'paper_erdogan2012.json');
const LOG_FILE = path.join(OUT_DIR, 'benchmark.log');

const nRandOf = (n, d) => Math.max(1, Math.floor(d * n + 0.5 + 1e-9));
const tabuLengthOf = (n, ratio) => Math.max(1, Math.round(ratio * n));
const itsItersOf = (iters) => Math.floor(Math.sqrt(iters) + 1e-9);

function parseMethod(method) {
  if (method === 'twophase' || method === 'tsp') return { algo: method, mode: null, lsRule: null };
  const [algo, mode] = method.split('-');
  return { algo: algo === 'ilsd' ? 'ils' : algo, mode, lsRule: algo === 'ilsd' ? 'descent' : algo === 'ils' ? 'incumbent' : null };
}

/** Parámetros que, si cambian, invalidan un registro previo de ese método. */
function configOf(method, opts) {
  const tsp = { kicks: opts.tspKicks, restarts: opts.tspRestarts, seed: opts.seed };
  if (method === 'tsp') return { tsp };
  if (method === 'twophase') return { tsp, h: 'paper' };
  const { algo, lsRule } = parseMethod(method);
  const base = { tsp, h: 'paper', nIter: opts.iters, d: opts.d, seed: opts.seed };
  if (algo === 'ils') return { ...base, lsRule };
  return { ...base, nIterIts: itsItersOf(opts.iters), tabuRatio: opts.tabuRatio };
}

const keyOf = (method, n, id, dir) => (dir ? `${method}|${n}|${id}|${dir}` : `${method}|${n}|${id}`);
const sameConfig = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ───────────────────────── Trabajo de un proceso (worker) ───────────────────────── */

/** Normaliza el ciclo TSP: [c1, …, cn] con c1 < cn (dirección por defecto). */
function defaultCycle(tour) {
  const cyc = tour.slice(1);
  return cyc[0] <= cyc[cyc.length - 1] ? cyc : cyc.slice().reverse();
}

/**
 * Soluciones iniciales de las dos direcciones. Si alguna coincide con la «Initial solution» del paper,
 * se orienta para que la dirección 1 sea la suya; si no, se usa la orientación por defecto.
 */
function initialSolutions(inst, tspTour, paperRow) {
  const ev = new Evaluator(inst);
  const cyc = defaultCycle(tspTour);
  const t0 = performance.now();
  const a = relocateDepot(ev, Int32Array.from(cyc));
  const t1 = performance.now();
  const b = relocateDepot(ev, Int32Array.from(cyc).reverse());
  const t2 = performance.now();
  let dirs = [
    { ...a, timeSec: (t1 - t0) / 1000 },
    { ...b, timeSec: (t2 - t1) / 1000 },
  ];
  let orientation = 'default';
  if (paperRow) {
    const eq = (x, y) => Math.abs(Math.round(x * 100) / 100 - y) < 0.006;
    if (eq(a.cost, paperRow.init1) || eq(b.cost, paperRow.init2)) orientation = 'paper';
    else if (eq(b.cost, paperRow.init1) || eq(a.cost, paperRow.init2)) {
      dirs = [dirs[1], dirs[0]];
      orientation = 'paper';
    }
  }
  return { ev, dirs, orientation };
}

function solutionOf(ev, perm, extra = {}) {
  const routing = ev.routing(perm);
  const handling = ev.exactHandling(perm);
  return {
    objective: round6(routing + handling),
    distance: routing,
    handling: round6(handling),
    tour: [0, ...perm, 0],
    ...extra,
  };
}

function runJob(job) {
  const { method, n, id, dir, opts, tspTour, paperRow } = job;
  const h = defaultH(n);
  const inst = buildInstance(n, id, { h });
  const config = configOf(method, opts);
  const base = { key: keyOf(method, n, id, method === 'tsp' || method === 'twophase' ? null : dir), method, n, id, h, config };

  if (method === 'tsp') {
    const t0 = performance.now();
    const tsp = solveTsp(inst, { kicks: opts.tspKicks, restarts: opts.tspRestarts, seed: seedOf(opts.seed, n, id) });
    const timeSec = (performance.now() - t0) / 1000;
    return { ...base, status: 'ok', tour: tsp.tour, length: tsp.length, bestRestart: tsp.restart, timeSec: round6(timeSec) };
  }

  const { ev, dirs, orientation } = initialSolutions(inst, tspTour, paperRow);

  if (method === 'twophase') {
    return {
      ...base,
      status: 'ok',
      orientation,
      timeSec: round6(dirs[0].timeSec + dirs[1].timeSec),
      dirs: dirs.map((d, k) => ({
        dir: k + 1,
        ...solutionOf(ev, d.perm, { depotShift: d.shift, feasibleShifts: d.feasibleShifts }),
        // estimación heurística (§2.2) del mismo tour, para comparar con el óptimo de la DP
        handlingHeuristic: round6(ev.heuristicHandling(d.perm)),
        timeSec: round6(d.timeSec),
      })),
    };
  }

  const { algo, mode, lsRule } = parseMethod(method);
  const start = dirs[dir - 1];
  const nRand = nRandOf(n, opts.d);
  const rng = makeRng(seedOf(opts.seed, n, id, dir, algo === 'ils' ? 1 : 2));
  ev.resetStats();
  const t0 = performance.now();
  const res =
    algo === 'ils'
      ? ils(ev, start.perm, { mode, nIter: opts.iters, nRand, rng, lsRule })
      : its(ev, start.perm, { mode, nIter: itsItersOf(opts.iters), nRand, tabuLength: tabuLengthOf(n, opts.tabuRatio), rng });
  const runSec = (performance.now() - t0) / 1000;
  const stats = { ...ev.stats };
  return {
    ...base,
    algo,
    mode,
    dir,
    status: 'ok',
    orientation,
    nRand,
    tabuLength: algo === 'its' ? tabuLengthOf(n, opts.tabuRatio) : null,
    initial: solutionOf(ev, start.perm, { depotShift: start.shift }),
    best: solutionOf(ev, res.perm),
    initSec: round6(start.timeSec),
    runSec: round6(runSec),
    bestIteration: res.bestIteration,
    improvements: res.improvements,
    lsMoves: res.lsMoves,
    rejectedMoves: res.rejectedMoves ?? null,
    discardedRandomMoves: res.discarded,
    evals: stats,
    history: res.history,
    localOptima: res.localOptima,
  };
}

if (!isMainThread) {
  parentPort.on('message', (job) => {
    let rec;
    try {
      rec = runJob(job);
    } catch (err) {
      rec = {
        key: keyOf(job.method, job.n, job.id, job.method === 'tsp' || job.method === 'twophase' ? null : job.dir),
        method: job.method,
        n: job.n,
        id: job.id,
        dir: job.dir ?? null,
        h: defaultH(job.n),
        config: configOf(job.method, job.opts),
        status: 'error',
        error: String(err?.stack ?? err),
      };
    }
    rec.finishedAt = new Date().toISOString();
    rec.worker = workerData.index;
    parentPort.postMessage(rec);
  });
}

/* ───────────────────────── Proceso principal ───────────────────────── */

function parseArgs(argv) {
  const opts = {
    ...DEFAULTS,
    sizes: SIZES,
    ids: IDS,
    methods: METHODS,
    force: false,
    consolidate: false,
    dryRun: false,
  };
  const list = (s) =>
    s.split(',').flatMap((part) => {
      const m = part.match(/^(\d+)-(\d+)$/);
      if (m) return Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, k) => Number(m[1]) + k);
      return [Number(part)];
    });
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    const next = () => argv[++k];
    if (a === '--sizes') opts.sizes = list(next());
    else if (a === '--ids') opts.ids = list(next());
    else if (a === '--methods') opts.methods = next().split(',');
    else if (a === '--workers') opts.workers = Number(next());
    else if (a === '--iters') opts.iters = Number(next());
    else if (a === '--d') opts.d = Number(next());
    else if (a === '--seed') opts.seed = Number(next());
    else if (a === '--tsp-kicks') opts.tspKicks = Number(next());
    else if (a === '--tsp-restarts') opts.tspRestarts = Number(next());
    else if (a === '--force') opts.force = true;
    else if (a === '--consolidate') opts.consolidate = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else throw new Error(`Opción desconocida: ${a}`);
  }
  for (const m of opts.methods) if (!METHODS.includes(m) && !EXTRA_METHODS.includes(m)) throw new Error(`Método desconocido: ${m}`);
  if (!(Number.isInteger(opts.workers) && opts.workers >= 1)) throw new Error(`--workers debe ser un entero ≥ 1: ${opts.workers}`);
  for (const n of opts.sizes) if (!(n >= 2 && n <= 200)) throw new Error(`|Vc| fuera de rango: ${n}`);
  return opts;
}

function readRecords() {
  if (!fs.existsSync(RECORDS_FILE)) return new Map();
  const map = new Map();
  for (const line of fs.readFileSync(RECORDS_FILE, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      map.set(r.key, r); // la última línea de cada clave gana
    } catch {
      // línea a medio escribir (corte abrupto): se ignora
    }
  }
  return map;
}

/** Agrega '\n' si el archivo no termina en salto de línea (fragmento de una escritura cortada). */
function ensureTrailingNewline(file) {
  if (!fs.existsSync(file)) return;
  const size = fs.statSync(file).size;
  if (size === 0) return;
  const fd = fs.openSync(file, 'r');
  const last = Buffer.alloc(1);
  fs.readSync(fd, last, 0, 1, size - 1);
  fs.closeSync(fd);
  if (last[0] !== 0x0a) fs.appendFileSync(file, '\n');
}

function cpuName() {
  return os.cpus()[0]?.model?.trim() ?? os.arch();
}

function writeSummary(records, opts, extraMeta = {}) {
  const list = [...records.values()].sort(
    (a, b) => a.n - b.n || a.id - b.id || a.method.localeCompare(b.method) || (a.dir ?? 0) - (b.dir ?? 0),
  );
  const methods = [...new Set([...opts.methods, ...list.map((r) => r.method).filter((m) => m !== 'tsp')])];
  const data = {
    title: 'Benchmark de metaheurísticas TSPPD-H (Erdoğan et al. 2012, Tablas 8–9)',
    reference:
      'Erdoğan, Battarra, Laporte & Vigo (2012). Metaheuristics for the traveling salesman problem with pickups, deliveries and handling costs. Computers & Operations Research 39, 1074–1086.',
    generatedAt: new Date().toISOString(),
    meta: {
      cpu: cpuName(),
      logicalCpus: os.availableParallelism?.() ?? os.cpus().length,
      os: `${os.type()} ${os.release()}`,
      runtime: `Node.js ${process.version}`,
      workers: opts.workers,
      params: {
        nIter: opts.iters,
        d: opts.d,
        nIterIts: itsItersOf(opts.iters),
        tabuRatio: opts.tabuRatio,
        seed: opts.seed,
        ilsLsRule: 'incumbent',
        tsp: { kicks: opts.tspKicks, restarts: opts.tspRestarts, method: '2-opt + Or-opt iterado con double-bridge (sustituto de Lin–Kernighan)' },
      },
      h: PAPER_H,
      grid: { sizes: opts.sizes, ids: opts.ids, methods: opts.methods },
      ...extraMeta,
    },
    methods: methods.map((key) => ({ key, label: METHOD_LABELS[key] ?? key })),
    count: list.length,
    records: list,
  };
  const tmp = `${SUMMARY_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, SUMMARY_FILE);
}

/** Peso relativo (≈ segundos) de una ejecución, para ordenar las más largas primero y estimar el avance. */
function weightOf(method, n) {
  const x = n / 200;
  if (method === 'tsp') return 2.5 * x;
  if (method === 'twophase') return 0.05 * x;
  const { algo, mode, lsRule } = parseMethod(method);
  const scans = algo === 'ils' && lsRule === 'descent' ? 48 * x ** 0.5 * 200 : 200;
  return scans * (mode === 'exact' ? 1.7 * x ** 4 : 0.11 * x ** 3) + 0.1;
}

function log(line) {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const text = `[${stamp}] ${line}`;
  console.log(text);
  fs.appendFileSync(LOG_FILE, `${text}\n`);
}

function fmtDur(sec) {
  if (!Number.isFinite(sec)) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${Math.round(sec % 60)} s`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const records = readRecords();

  if (opts.consolidate) {
    writeSummary(records, opts);
    console.log(`[OK] ${records.size} registros → ${SUMMARY_FILE}`);
    return;
  }

  const paper = fs.existsSync(PAPER_FILE) ? JSON.parse(fs.readFileSync(PAPER_FILE, 'utf8')) : null;
  if (!paper) console.warn('[AVISO] Falta paper_erdogan2012.json (python notebooks/erdogan2012/paper_tables.py): la dirección 1 no se alinea con el paper.');
  const paperRow = (n, id) => paper?.instances.find((r) => r.n === n && r.id === id) ?? null;

  const isDone = (method, n, id, dir) => {
    const r = records.get(keyOf(method, n, id, dir));
    return !opts.force && r && r.status === 'ok' && sameConfig(r.config, configOf(method, opts));
  };

  // Trabajos: fase 1 (TSP) y fase 2 (dos fases + metaheurísticas en cada dirección)
  const phase1 = [];
  const phase2 = [];
  for (const n of opts.sizes) {
    for (const id of opts.ids) {
      if (!isDone('tsp', n, id, null)) phase1.push({ method: 'tsp', n, id });
      for (const method of opts.methods) {
        if (method === 'twophase') {
          if (!isDone(method, n, id, null)) phase2.push({ method, n, id });
        } else {
          for (const dir of [1, 2]) if (!isDone(method, n, id, dir)) phase2.push({ method, n, id, dir });
        }
      }
    }
  }
  // Un TSP rehecho invalida lo que dependía de él
  const tspRedo = new Set(phase1.map((j) => `${j.n}|${j.id}`));
  if (tspRedo.size) {
    for (const n of opts.sizes)
      for (const id of opts.ids) {
        if (!tspRedo.has(`${n}|${id}`)) continue;
        for (const method of opts.methods) {
          const dirs = method === 'twophase' ? [null] : [1, 2];
          for (const dir of dirs) {
            if (!phase2.some((j) => j.method === method && j.n === n && j.id === id && (j.dir ?? null) === dir)) phase2.push({ method, n, id, dir: dir ?? undefined });
          }
        }
      }
  }
  phase1.sort((a, b) => weightOf(b.method, b.n) - weightOf(a.method, a.n));
  phase2.sort((a, b) => weightOf(b.method, b.n) - weightOf(a.method, a.n));
  const totalWeight = [...phase1, ...phase2].reduce((s, j) => s + weightOf(j.method, j.n), 0);

  log(
    `Benchmark Erdoğan 2012 · |Vc| ${opts.sizes.join(',')} · Id ${opts.ids.join(',')} · ${opts.methods.join(', ')} · ` +
      `${opts.workers} procesos · Niter ${opts.iters} · pendientes: ${phase1.length} TSP + ${phase2.length} ejecuciones ` +
      `(≈ ${fmtDur((totalWeight / opts.workers) * 1.15)} estimado)`,
  );
  if (opts.dryRun) {
    for (const j of [...phase1, ...phase2]) console.log(`  ${keyOf(j.method, j.n, j.id, j.dir)}`);
    return;
  }
  if (!phase1.length && !phase2.length) {
    writeSummary(records, opts);
    log('Nada pendiente: consolidado regenerado.');
    return;
  }

  const started = Date.now();
  let doneWeight = 0;
  let doneCount = 0;
  const totalCount = phase1.length + phase2.length;
  // Si un corte dejó una última línea a medias, el primer registro nuevo no debe quedar pegado a ella.
  ensureTrailingNewline(RECORDS_FILE);

  const workers = Array.from({ length: Math.min(opts.workers, Math.max(phase1.length, phase2.length)) }, (_, index) =>
    new Worker(fileURLToPath(import.meta.url), { workerData: { index } }),
  );

  const runQueue = (queue, prepare) =>
    new Promise((resolve, reject) => {
      let next = 0;
      let active = 0;
      const dispatch = (w) => {
        if (next >= queue.length) {
          if (active === 0) resolve();
          return;
        }
        const job = queue[next++];
        active++;
        w.once('message', (rec) => {
          active--;
          records.set(rec.key, rec);
          fs.appendFileSync(RECORDS_FILE, `${JSON.stringify(rec)}\n`);
          doneWeight += weightOf(job.method, job.n);
          doneCount++;
          try {
            writeSummary(records, opts);
          } catch (err) {
            log(`[AVISO] No se pudo escribir el consolidado: ${err.message}`);
          }
          const elapsed = (Date.now() - started) / 1000;
          const eta = doneWeight > 0 ? (elapsed / doneWeight) * (totalWeight - doneWeight) : NaN;
          const what =
            rec.status !== 'ok'
              ? `ERROR ${rec.error?.split('\n')[0]}`
              : rec.method === 'tsp'
                ? `L=${rec.length} t=${rec.timeSec.toFixed(2)}s`
                : rec.method === 'twophase'
                  ? `z1=${rec.dirs[0].objective.toFixed(2)} z2=${rec.dirs[1].objective.toFixed(2)}`
                  : `z=${rec.initial.objective.toFixed(2)}→${rec.best.objective.toFixed(2)} t=${rec.runSec.toFixed(1)}s`;
          log(
            `[${String(doneCount).padStart(String(totalCount).length)}/${totalCount}] ${fmtDur(elapsed)} · ETA ${fmtDur(eta)} | ` +
              `${rec.method.padEnd(13)} N=${String(rec.n).padEnd(3)} Id=${String(rec.id).padEnd(2)}${rec.dir ? ` dir=${rec.dir}` : '      '} | ${what}`,
          );
          dispatch(w);
        });
        w.postMessage(prepare(job));
      };
      for (const w of workers) dispatch(w);
      for (const w of workers) w.once('error', reject);
    });

  const common = { iters: opts.iters, d: opts.d, seed: opts.seed, tabuRatio: opts.tabuRatio, tspKicks: opts.tspKicks, tspRestarts: opts.tspRestarts };
  await runQueue(phase1, (job) => ({ ...job, opts: common }));
  // Fase 2: cada trabajo recibe el tour TSP ya calculado
  const missingTsp = phase2.filter((j) => records.get(keyOf('tsp', j.n, j.id, null))?.status !== 'ok');
  if (missingTsp.length) log(`[AVISO] ${missingTsp.length} ejecuciones sin tour TSP válido: se omiten.`);
  const ready = phase2.filter((j) => !missingTsp.includes(j));
  await runQueue(ready, (job) => ({
    ...job,
    opts: common,
    tspTour: records.get(keyOf('tsp', job.n, job.id, null)).tour,
    paperRow: paperRow(job.n, job.id),
  }));

  await Promise.all(workers.map((w) => w.terminate()));
  writeSummary(records, opts);
  log(`[OK] Benchmark terminado en ${fmtDur((Date.now() - started) / 1000)} → ${SUMMARY_FILE}`);
}

if (isMainThread) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

