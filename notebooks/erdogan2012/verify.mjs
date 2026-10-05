/**
 * Verificaciones del motor (node notebooks/erdogan2012/verify.mjs). Termina con código 1 si alguna falla.
 *
 *   1. Instancias: buildInstance reproduce los 49 archivos Instancias/2_<N>_<Id>.tsp (matriz, α, β, Q).
 *   2. DP exacta = fuerza bruta sobre las 2^n combinaciones de políticas (n ≤ 12, h_a ≠ h_b, ceros).
 *   3. DP exacta en JavaScript = solve_handling de notebooks/tsppd_h_alg21_dp.py (Python).
 *   4. DP exacta = manipulación de Gurobi (Política 3) en los tours óptimos de Outputs/ (n = 5, 10).
 *   5. Heurística lineal: su costo = simulación de sus propias políticas y nunca es menor que el óptimo.
 *   6. Deltas de ruteo, carga de candidatos y deshacer movimientos = aplicar el movimiento y recalcular.
 *   7. bestMove con poda = barrido completo sin poda (exacto, heurístico y con lista tabú).
 *   8. Informativo: desviación de la heurística lineal frente a la DP (el paper reporta 8,66 % en promedio).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BASE_DIR, buildInstance } from './instances.mjs';
import {
  EPS,
  Evaluator,
  TabuList,
  applyMove,
  applyRelocate,
  applyTwoOpt,
  exactHandling,
  heuristicHandling,
  makeRng,
  simulatePolicies,
  undoMove,
} from './engine.mjs';

let failures = 0;
const ok = (msg) => console.log(`[OK] ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`[FALLA] ${msg}`);
};
const close = (x, y, tol = 1e-6) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));

/* 1 ─ instancias */
{
  const dir = path.join(BASE_DIR, 'Instancias');
  const files = fs.readdirSync(dir).filter((f) => /^2_\d+_\d+\.tsp$/.test(f));
  let good = 0;
  for (const f of files) {
    const [, N, id] = f.match(/^2_(\d+)_(\d+)\.tsp$/).map(Number);
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = text.split(/\r?\n/);
    const cap = Number(lines.find((l) => l.startsWith('CAPACITY')).split(':')[1]);
    const i0 = lines.findIndex((l) => l.includes('EDGE_WEIGHT_SECTION'));
    const i1 = lines.findIndex((l) => l.includes('DEMAND_SECTION'));
    const toks = lines.slice(i0 + 1, i1).join(' ').trim().split(/\s+/).map(Number);
    const m = Math.round(Math.sqrt(toks.length));
    const inst = buildInstance(N, id);
    let bad = 0;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) if (i !== j && toks[i * m + j] !== inst.c[i * inst.V + j]) bad++;
    for (const l of lines.slice(i1 + 1)) {
      const t = l.trim().split(/\s+/).map(Number);
      if (t.length === 3 && t[0] >= 1 && t[0] <= N && (t[1] !== inst.alpha[t[0]] || t[2] !== inst.beta[t[0]])) bad++;
    }
    if (cap !== inst.Q) bad++;
    if (bad === 0) good++;
    else fail(`${f}: ${bad} diferencias con la instancia derivada de e_vigo/`);
  }
  if (good === files.length && files.length === 49) ok(`instancias: ${good}/49 archivos Instancias/2_N_Id.tsp reproducidos (matriz, α, β, Q)`);
  else if (good === files.length) ok(`instancias: ${good} archivos reproducidos (se esperaban 49)`);
}

/* utilidades de secuencias aleatorias */
function randomSeq(rng, n) {
  const a = new Float64Array(n + 2);
  const b = new Float64Array(n + 2);
  const choiceA = [0, 0, 1, 2, 3, 5, 8, 13];
  const choiceB = [0, 0, 1, 2, 4, 6, 11];
  for (let k = 1; k <= n; k++) {
    a[k] = choiceA[rng.int(0, choiceA.length - 1)];
    b[k] = choiceB[rng.int(0, choiceB.length - 1)];
  }
  return { a, b };
}

/* 2 ─ DP vs fuerza bruta */
{
  const rng = makeRng(2012);
  const f = new Float64Array(64);
  let worst = 0;
  let bad = 0;
  const T = 4000;
  for (let t = 0; t < T; t++) {
    const n = rng.int(1, 12);
    const { a, b } = randomSeq(rng, n);
    const hs = [0.1, 0.5, 1, 2, 1 / 3];
    const ha = hs[rng.int(0, hs.length - 1)];
    const hb = hs[rng.int(0, hs.length - 1)];
    const dp = exactHandling(a, b, n, ha, hb, f);
    let brute = Infinity;
    const policy = new Int8Array(n + 1);
    for (let mask = 0; mask < 1 << n; mask++) {
      for (let k = 1; k <= n; k++) policy[k] = (mask >> (k - 1)) & 1 ? 2 : 1;
      brute = Math.min(brute, simulatePolicies(a, b, n, ha, hb, policy));
    }
    worst = Math.max(worst, Math.abs(dp - brute));
    if (!close(dp, brute)) bad++;
  }
  if (bad) fail(`DP ≠ fuerza bruta en ${bad}/${T} secuencias (error máx. ${worst})`);
  else ok(`DP exacta = fuerza bruta 2^n en ${T} secuencias aleatorias (n ≤ 12; error máx. ${worst.toExponential(1)})`);
}

/* 3 ─ DP JavaScript vs Python */
{
  const rng = makeRng(77);
  const cases = [];
  const f = new Float64Array(512);
  for (let t = 0; t < 300; t++) {
    const n = rng.int(1, 200);
    const { a, b } = randomSeq(rng, n);
    const ha = [0.1, 0.2, 0.25, 1 / 3, 0.5, 1][rng.int(0, 5)];
    const hb = rng.next() < 0.7 ? ha : [0.1, 0.5, 1][rng.int(0, 2)];
    cases.push({ a: Array.from(a.slice(0, n + 1)), b: Array.from(b.slice(0, n + 1)), ha, hb, js: exactHandling(a, b, n, ha, hb, f) });
  }
  const tmp = path.join(BASE_DIR, 'Outputs', 'BenchmarkErdogan2012', '.verify_cases.json');
  fs.writeFileSync(tmp, JSON.stringify(cases));
  const py = spawnSync(
    'python',
    [
      '-c',
      [
        'import json, sys',
        `sys.path.insert(0, ${JSON.stringify(path.join(BASE_DIR, 'notebooks'))})`,
        'from tsppd_h_alg21_dp import solve_handling',
        `cases = json.load(open(${JSON.stringify(tmp)}))`,
        'print(json.dumps([solve_handling(c["a"], c["b"], c["ha"], c["hb"])[0] for c in cases]))',
      ].join('\n'),
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 },
  );
  fs.rmSync(tmp, { force: true });
  if (py.status !== 0) fail(`no se pudo ejecutar Python: ${py.stderr.slice(-400)}`);
  else {
    const vals = JSON.parse(py.stdout.trim().split(/\r?\n/).pop());
    const bad = cases.filter((c, k) => !close(c.js, vals[k], 1e-9)).length;
    if (bad) fail(`DP JavaScript ≠ Python en ${bad}/${cases.length} secuencias`);
    else ok(`DP JavaScript = solve_handling de Python en ${cases.length} secuencias (n ≤ 200, h_a ≠ h_b incluido)`);
  }
}

/* 4 ─ DP vs Gurobi Política 3 */
{
  const dir = path.join(BASE_DIR, 'Outputs');
  const files = fs.readdirSync(dir).filter((f) => /^Solucion_TSPPD_H3_.*\.txt$/.test(f));
  let good = 0;
  const f = new Float64Array(64);
  for (const file of files) {
    const sol = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const nodes = new Map(sol.nodes.map((nd) => [nd.id, nd]));
    const cust = sol.tour.slice(1, -1).map(Number);
    const n = cust.length;
    const a = new Float64Array(n + 2);
    const b = new Float64Array(n + 2);
    cust.forEach((v, k) => {
      a[k + 1] = nodes.get(v).alpha;
      b[k + 1] = nodes.get(v).beta;
    });
    const h = sol.h ?? 0.1;
    const dp = exactHandling(a, b, n, h, h, f);
    if (Math.abs(dp - sol.handlingCost) <= 0.005 + 1e-9) good++;
    else fail(`${file}: DP ${dp} ≠ Gurobi ${sol.handlingCost}`);
  }
  if (files.length && good === files.length) ok(`DP exacta = manipulación Gurobi (Política 3) en ${good}/${files.length} tours óptimos de Outputs/`);
}

/* 5 ─ heurística lineal */
{
  const rng = makeRng(5);
  const f = new Float64Array(1024);
  const sa = new Float64Array(1024);
  const sb = new Float64Array(1024);
  const policy = new Int8Array(1024);
  let bad = 0;
  let below = 0;
  const T = 3000;
  for (let t = 0; t < T; t++) {
    const n = rng.int(1, 300);
    const { a, b } = randomSeq(rng, n);
    const ha = [0.1, 0.5, 1, 1 / 3][rng.int(0, 3)];
    const hb = rng.next() < 0.7 ? ha : [0.1, 0.5, 1][rng.int(0, 2)];
    const heur = heuristicHandling(a, b, n, ha, hb, sa, sb, policy);
    const sim = simulatePolicies(a, b, n, ha, hb, policy);
    const ex = exactHandling(a, b, n, ha, hb, f);
    if (!close(heur, sim)) bad++;
    if (heur < ex - 1e-7) below++;
  }
  if (bad) fail(`heurística: su costo ≠ simulación de sus políticas en ${bad}/${T} secuencias`);
  else ok(`heurística lineal: costo = simulación de sus propias políticas en ${T} secuencias`);
  if (below) fail(`heurística por debajo del óptimo de la DP en ${below}/${T} secuencias`);
  else ok(`heurística lineal ≥ óptimo de la DP en ${T} secuencias (cota superior)`);
}

/* 6 ─ movimientos */
{
  const inst = buildInstance(60, 3);
  const ev = new Evaluator(inst);
  const rng = makeRng(9);
  const n = inst.n;
  const perm = Int32Array.from({ length: n }, (_, k) => k + 1);
  let bad = 0;
  const T = 3000;
  for (let t = 0; t < T; t++) {
    for (let k = n - 1; k > 0; k--) {
      const r = rng.int(0, k);
      [perm[k], perm[r]] = [perm[r], perm[k]];
    }
    const before = Int32Array.from(perm);
    const R = ev.routing(perm);
    let move;
    if (rng.next() < 0.5) {
      const i = rng.int(0, n - 1);
      let p = rng.int(0, n - 2);
      if (p >= i) p++;
      move = { kind: 'relocate', i, j: p };
    } else {
      let i = rng.int(0, n - 2);
      let j = rng.int(i + 1, n - 1);
      if (i === 0 && j === n - 1) j = n - 2;
      move = { kind: '2opt', i, j };
    }
    // delta de ruteo: el bestMove de un tour «sin manipulación» se compara contra recalcular
    const feasibleLoaded = ev.loadMove(perm, move.kind === 'relocate' ? 0 : 1, move.i, move.j);
    const aLoaded = Array.from(ev.a.slice(1, n + 1));
    const bLoaded = Array.from(ev.b.slice(1, n + 1));
    applyMove(perm, move);
    const R2 = ev.routing(perm);
    const feasibleAfter = ev.load(perm);
    const aAfter = Array.from(ev.a.slice(1, n + 1));
    const bAfter = Array.from(ev.b.slice(1, n + 1));
    if (feasibleAfter && (!feasibleLoaded || aLoaded.join() !== aAfter.join() || bLoaded.join() !== bAfter.join())) bad++;
    if (!feasibleAfter && feasibleLoaded) bad++;
    // delta (mismo cálculo que bestMove)
    const { c, V } = inst;
    let delta;
    if (move.kind === 'relocate') {
      const { i, j: p } = move;
      const v = before[i];
      const prev = i > 0 ? before[i - 1] : 0;
      const next = i < n - 1 ? before[i + 1] : 0;
      const x = p > 0 ? before[p - 1 < i ? p - 1 : p] : 0;
      const y = p < n - 1 ? before[p < i ? p : p + 1] : 0;
      delta = c[prev * V + next] - c[prev * V + v] - c[v * V + next] + c[x * V + v] + c[v * V + y] - c[x * V + y];
    } else {
      const { i, j } = move;
      const prev = i > 0 ? before[i - 1] : 0;
      const next = j < n - 1 ? before[j + 1] : 0;
      delta = c[prev * V + before[j]] + c[before[i] * V + next] - c[prev * V + before[i]] - c[before[j] * V + next];
    }
    if (Math.abs(R + delta - R2) > 1e-9) bad++;
    undoMove(perm, move);
    if (perm.join() !== before.join()) bad++;
  }
  if (bad) fail(`movimientos: ${bad} discrepancias (delta de ruteo, carga del candidato o deshacer)`);
  else ok(`movimientos: delta de ruteo, carga del candidato y deshacer coinciden en ${T} relocate/2-opt aleatorios`);
}

/* 7 ─ bestMove con poda = barrido completo */
{
  function bruteBest(ev, perm, mode, tabu, aspiration) {
    const n = perm.length;
    const cand = Int32Array.from(perm);
    let c1 = Infinity;
    let m1 = null;
    for (let i = 0; i < n; i++) {
      for (let p = 0; p < n; p++) {
        if (p === i) continue;
        cand.set(perm);
        applyRelocate(cand, i, p);
        if (!ev.feasible(cand)) continue;
        const cost = ev.routing(cand) + (mode === 'exact' ? ev.exactHandling(cand) : ev.heuristicHandling(cand));
        const isTabu = tabu && tabu.has(tabu.relocateKey(perm[i]));
        if (isTabu && !(cost < aspiration - EPS)) continue;
        if (cost < c1 - EPS) {
          c1 = cost;
          m1 = { kind: 'relocate', i, j: p, cost };
        }
      }
    }
    let c2 = Infinity;
    let m2 = null;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        cand.set(perm);
        applyTwoOpt(cand, i, j);
        if (!ev.feasible(cand)) continue;
        const cost = ev.routing(cand) + (mode === 'exact' ? ev.exactHandling(cand) : ev.heuristicHandling(cand));
        const isTabu = tabu && tabu.has(tabu.twoOptKey(i, j));
        if (isTabu && !(cost < aspiration - EPS)) continue;
        if (cost < c2 - EPS) {
          c2 = cost;
          m2 = { kind: '2opt', i, j, cost };
        }
      }
    }
    if (m1 === null && m2 === null) return null;
    // «if cost1 < cost2 relocate, else 2-opt» (empate → 2-opt)
    if (m2 !== null && !(c1 < c2 - EPS)) return m2;
    return m1;
  }
  const rng = makeRng(31);
  let bad = 0;
  let total = 0;
  for (const [N, id] of [
    [20, 1],
    [20, 6],
    [40, 2],
    [60, 9],
  ]) {
    const inst = buildInstance(N, id);
    const ev = new Evaluator(inst);
    const n = inst.n;
    const perm = Int32Array.from({ length: n }, (_, k) => k + 1);
    for (let t = 0; t < 25; t++) {
      // tour factible al azar (reintentos)
      do {
        for (let k = n - 1; k > 0; k--) {
          const r = rng.int(0, k);
          [perm[k], perm[r]] = [perm[r], perm[k]];
        }
      } while (!ev.feasible(perm));
      for (const mode of ['exact', 'heuristic']) {
        for (const withTabu of [false, true]) {
          let tabu = null;
          let asp = -Infinity;
          if (withTabu) {
            tabu = new TabuList(Math.round(n / 2), n);
            for (let k = 0; k < n / 2; k++) {
              if (rng.next() < 0.5) tabu.add(tabu.relocateKey(rng.int(1, n)));
              else {
                const i = rng.int(0, n - 2);
                tabu.add(tabu.twoOptKey(i, rng.int(i + 1, n - 1)));
              }
            }
            asp = ev.exactTotal(perm);
          }
          const fast = ev.bestMove(perm, mode, tabu, asp);
          const slow = bruteBest(ev, perm, mode, tabu, asp);
          total++;
          const same =
            (fast === null && slow === null) ||
            (fast !== null && slow !== null && fast.kind === slow.kind && fast.i === slow.i && fast.j === slow.j && close(fast.cost, slow.cost, 1e-9));
          if (!same) {
            bad++;
            if (bad <= 3) fail(`bestMove N=${N} Id=${id} ${mode}${withTabu ? '+tabú' : ''}: ${JSON.stringify(fast)} vs barrido completo ${JSON.stringify(slow)}`);
          }
        }
      }
    }
  }
  if (!bad) ok(`bestMove con poda = barrido completo sin poda en ${total} casos (exacto/heurístico, con y sin lista tabú)`);
  else fail(`bestMove difiere del barrido completo en ${bad}/${total} casos`);
}

/* 8 ─ desviación de la heurística (informativo) */
{
  const rng = makeRng(866);
  const f = new Float64Array(1024);
  const sa = new Float64Array(1024);
  const sb = new Float64Array(1024);
  const rows = [];
  for (const n of [25, 50, 75, 100, 250, 500]) {
    let sum = 0;
    let max = 0;
    let cnt = 0;
    for (let t = 0; t < 1000; t++) {
      // misma derivación de demandas que las instancias (p' en 1..19), orden aleatorio
      const a = new Float64Array(n + 2);
      const b = new Float64Array(n + 2);
      for (let k = 1; k <= n; k++) {
        const pp = rng.int(1, 19);
        const bb = Math.floor((pp * rng.int(0, 4)) / 5);
        a[k] = pp - bb;
        b[k] = bb;
      }
      const h = 20 / n;
      const ex = exactHandling(a, b, n, h, h, f);
      if (ex <= 1e-9) continue;
      const he = heuristicHandling(a, b, n, h, h, sa, sb);
      const dev = ((he - ex) / ex) * 100;
      sum += dev;
      max = Math.max(max, dev);
      cnt++;
    }
    rows.push(`|Vc|=${n}: prom. ${(sum / cnt).toFixed(2)} %, máx. ${max.toFixed(2)} %`);
  }
  console.log(`[INFO] desviación heurística lineal vs DP (paper: 8,66 % prom., 52,70 % máx.): ${rows.join(' · ')}`);
}

if (failures) {
  console.log(`\n${failures} verificación(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron.');
