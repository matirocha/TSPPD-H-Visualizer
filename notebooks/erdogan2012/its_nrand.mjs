/**
 * Sensibilidad del ITS exacto a Nrand con |Vc| grande (complemento del benchmark).
 *
 * Con Nrand = 0,1·|Vc| (§4.3) nuestro ITS no mejora ninguna solución inicial con |Vc| ≥ 160, mientras
 * que el paper sí (Tablas 8–9). Este experimento corre el ITS exacto (dirección 1, misma solución
 * inicial y misma semilla que el benchmark) con varios Nrand para ver si la diferencia se explica por
 * lo fuerte de la perturbación: 20 movimientos aleatorios frente a solo 14 iteraciones de TS interno.
 *
 * Uso (cada corrida con |Vc| = 200 tarda ~6 min; se ejecutan en paralelo, una por proceso):
 *   node notebooks/erdogan2012/its_nrand.mjs                       # |Vc| = 200, Id 1–3, Nrand 2,5,10,20
 *   node notebooks/erdogan2012/its_nrand.mjs --n 160 --ids 1-3 --nrand 4,8,16
 * Requiere los registros del benchmark (tour TSP y solución inicial). Escribe
 * Outputs/BenchmarkErdogan2012/its_nrand.json (agrega o reemplaza por clave n|id|nRand).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { BASE_DIR, buildInstance } from './instances.mjs';
import { Evaluator, its, makeRng, round6, seedOf } from './engine.mjs';

const OUT_DIR = path.join(BASE_DIR, 'Outputs', 'BenchmarkErdogan2012');
const RECORDS_FILE = path.join(OUT_DIR, 'registros.jsonl');
const PAPER_FILE = path.join(OUT_DIR, 'paper_erdogan2012.json');
const OUT_FILE = path.join(OUT_DIR, 'its_nrand.json');
const N_ITER_ITS = 14; // ⌊√200⌋
const SEED = 1;

function run({ n, id, nRand, initialTour }) {
  const inst = buildInstance(n, id);
  const ev = new Evaluator(inst);
  const perm = Int32Array.from(initialTour.slice(1, -1));
  const t0 = performance.now();
  // Misma semilla que el its-exact del benchmark en la dirección 1 (benchmark.mjs: seedOf(seed, n, id, dir, 2))
  const r = its(ev, perm, { mode: 'exact', nIter: N_ITER_ITS, nRand, tabuLength: Math.round(0.5 * n), rng: makeRng(seedOf(SEED, n, id, 1, 2)) });
  return {
    n,
    id,
    nRand,
    initial: round6(ev.exactTotal(perm)),
    best: round6(r.cost),
    improvements: r.improvements,
    bestIteration: r.bestIteration,
    runSec: round6((performance.now() - t0) / 1000),
  };
}

if (!isMainThread) {
  parentPort.postMessage(run(workerData));
} else {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const k = args.indexOf(name);
    return k >= 0 ? args[k + 1] : def;
  };
  const list = (s) =>
    s.split(',').flatMap((p) => {
      const m = p.match(/^(\d+)-(\d+)$/);
      return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, k) => Number(m[1]) + k) : [Number(p)];
    });
  const n = Number(opt('--n', '200'));
  const ids = list(opt('--ids', '1-3'));
  const nRands = list(opt('--nrand', '2,5,10,20'));

  const recs = new Map();
  for (const line of fs.readFileSync(RECORDS_FILE, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      recs.set(r.key, r);
    } catch {
      // línea a medio escribir
    }
  }
  const paper = JSON.parse(fs.readFileSync(PAPER_FILE, 'utf8'));
  const jobs = [];
  for (const id of ids) {
    const two = recs.get(`twophase|${n}|${id}`);
    if (!two || two.status !== 'ok') throw new Error(`Falta la solución inicial twophase|${n}|${id}: corre primero benchmark.mjs`);
    for (const nRand of nRands) jobs.push({ n, id, nRand, initialTour: two.dirs[0].tour });
  }
  const results = await Promise.all(
    jobs.map(
      (job) =>
        new Promise((resolve, reject) => {
          const w = new Worker(fileURLToPath(import.meta.url), { workerData: job });
          w.once('message', resolve);
          w.once('error', reject);
        }),
    ),
  );
  const prev = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : { runs: [] };
  const byKey = new Map(prev.runs.map((r) => [`${r.n}|${r.id}|${r.nRand}`, r]));
  for (const r of results) {
    const p = paper.instances.find((x) => x.n === r.n && x.id === r.id);
    byKey.set(`${r.n}|${r.id}|${r.nRand}`, { ...r, paperInitial: p?.init1 ?? null, paperItsExact1dir: p?.itsE1 ?? null, finishedAt: new Date().toISOString() });
  }
  const runs = [...byKey.values()].sort((a, b) => a.n - b.n || a.id - b.id || a.nRand - b.nRand);
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        title: 'Sensibilidad del ITS exacto a Nrand (dirección 1, N*iter = 14, lista tabú 0,5·|Vc|)',
        note: 'Misma solución inicial y semilla que its-exact|n|id|1 del benchmark; el paper usa Nrand = 0,1·|Vc| (§4.3).',
        runs,
      },
      null,
      2,
    ),
  );
  for (const r of results.sort((a, b) => a.id - b.id || a.nRand - b.nRand)) {
    console.log(`|Vc|=${r.n} Id=${r.id} Nrand=${String(r.nRand).padStart(2)}: ${r.initial.toFixed(2)} → ${r.best.toFixed(2)} (${r.improvements} mejoras, ${r.runSec.toFixed(0)} s)`);
  }
  console.log(`[OK] ${OUT_FILE}`);
}
