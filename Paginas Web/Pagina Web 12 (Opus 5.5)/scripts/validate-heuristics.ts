// Valida los resultados de las heurísticas de Erdoğan et al. (2012) en ../../Outputs/Erdogan2012
// contra las soluciones Gurobi de ../../Outputs. Recalcula todo lo que la sección Heurísticas muestra.
// Uso: node scripts/validate-heuristics.ts   (Node ≥ 22.18 ejecuta TypeScript directamente)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readHeuristics } from './solutions-api.js';
import type { DPFile, HeurStop, ILSFile } from '../src/types/heuristics.ts';
import type { SolutionData } from '../src/types/solution.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../../Outputs');
const EPS = 0.005 + 1e-9;

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.log('  ✗ ' + msg);
};
const near = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps;

const { dp, ils } = readHeuristics(outputsDir) as { dp: DPFile[]; ils: ILSFile[] };
if (!dp.length && !ils.length) {
  console.log('⚠ No hay resultados en Outputs/Erdogan2012/ (ejecuta los scripts de notebooks/). Nada que validar.');
  process.exit(0);
}

/** Soluciones Gurobi indexadas por "<modelo>|<n>|<id>". */
const gurobi = new Map<string, SolutionData>();
for (const f of fs.readdirSync(outputsDir).filter((x) => x.endsWith('.txt'))) {
  const s: SolutionData = JSON.parse(fs.readFileSync(path.join(outputsDir, f), 'utf-8'));
  const model = s.model ?? 'TSPPD-H';
  gurobi.set(`${model}|${s.numCustomers}|${s.instanceId}`, s);
}

const route = (tour: number[], c: number[][]) => tour.slice(0, -1).reduce((acc, v, k) => acc + c[v][tour[k + 1]], 0);

/** Recorre el detalle por parada y comprueba la dinámica de la carga y el costo. */
function checkDetail(tag: string, tour: number[], detail: HeurStop[], alpha: number[], beta: number[], ha: number, hb: number, total: number) {
  const customers = tour.slice(1, -1);
  if (detail.length !== customers.length) return fail(`${tag}: ${detail.length} paradas ≠ ${customers.length} clientes`);
  let a = customers.reduce((acc, v) => acc + alpha[v], 0);
  let front = 0;
  let rear = 0;
  let sum = 0;
  detail.forEach((d, k) => {
    const v = customers[k];
    if (d.customer !== v || d.position !== k + 1) fail(`${tag} parada ${k + 1}: cliente ${d.customer} ≠ ${v}`);
    if (d.aArrival !== a || d.bFrontArrival !== front || d.bRearArrival !== rear) fail(`${tag} parada ${k + 1}: carga de llegada inconsistente`);
    a -= alpha[v];
    let opsA = 0;
    let opsB = 0;
    if (d.policy === 1) {
      if (alpha[v] > 0) opsB = rear;
      rear += beta[v];
    } else {
      if (rear + beta[v] > 0) {
        opsB = rear;
        opsA = a;
      }
      front += rear + beta[v];
      rear = 0;
    }
    if (d.opsA !== opsA || d.opsB !== opsB) fail(`${tag} parada ${k + 1}: operaciones ${d.opsA}/${d.opsB} ≠ ${opsA}/${opsB}`);
    if (!near(d.cost, ha * opsA + hb * opsB, 1e-6)) fail(`${tag} parada ${k + 1}: costo ${d.cost} ≠ ${ha * opsA + hb * opsB}`);
    sum += d.cost;
  });
  if (!near(sum, total, 1e-6)) fail(`${tag}: Σ costos por parada ${sum} ≠ manipulación ${total}`);
}

const tally = { dpFiles: dp.length, dpEvaluations: 0, dpMatchesP3: 0, ilsFiles: ils.length, ilsOptimal: 0, runs: 0 };

for (const d of dp) {
  const alpha = d.nodes.map((x) => x.alpha);
  const beta = d.nodes.map((x) => x.beta);
  for (const e of d.evaluations) {
    tally.dpEvaluations++;
    const tag = `${d.filename} ${e.model}`;
    const g = gurobi.get(`${e.model}|${d.numCustomers}|${d.instanceId}`);
    if (!g) {
      fail(`${tag}: no existe la solución Gurobi correspondiente`);
      continue;
    }
    if (e.tour.join() !== g.tour.join()) fail(`${tag}: el tour evaluado no es el de Gurobi`);
    if (!near(e.gurobiHandling, g.handlingCost) || !near(e.gurobiObjective, g.objectiveValue)) fail(`${tag}: valores Gurobi desactualizados`);
    const c = g.distMatrix;
    if (c && route(e.tour, c) !== e.totalDistance) fail(`${tag}: distancia ${e.totalDistance} ≠ ${route(e.tour, c)}`);
    if (!near(e.objectiveDP, e.totalDistance + e.handlingDP, 1e-6)) fail(`${tag}: Z DP ≠ distancia + manipulación`);
    if (e.handlingDP > Math.min(e.handlingP1, e.handlingP2) + 1e-6) fail(`${tag}: la DP no mejora a P1/P2 puras en su propia ruta`);
    checkDetail(tag, e.tour, e.detail, alpha, beta, d.h_a, d.h_b, e.handlingDP);
    if (e.model === 'TSPPD-H_1' && !near(e.handlingP1, e.gurobiHandling)) fail(`${tag}: P1 pura ${e.handlingP1} ≠ Gurobi ${e.gurobiHandling}`);
    if (e.model === 'TSPPD-H_2' && !near(e.handlingP2, e.gurobiHandling)) fail(`${tag}: P2 pura ${e.handlingP2} ≠ Gurobi ${e.gurobiHandling}`);
    if (e.model === 'TSPPD-H_3') {
      if (near(e.handlingDP, e.gurobiHandling)) tally.dpMatchesP3++;
      else fail(`${tag}: DP ${e.handlingDP} ≠ Gurobi P3 ${e.gurobiHandling}`);
    }
  }
}

for (const s of ils) {
  const tag = s.filename;
  const alpha = s.nodes.map((x) => x.alpha);
  const beta = s.nodes.map((x) => x.beta);
  const p3 = gurobi.get(`TSPPD-H_3|${s.numCustomers}|${s.instanceId}`);
  const c = p3?.distMatrix;
  const n = s.numCustomers;
  const b = s.best;
  if ([...b.tour.slice(1, -1)].sort((x, y) => x - y).join() !== Array.from({ length: n }, (_, i) => i + 1).join()) fail(`${tag}: el tour no visita cada cliente una vez`);
  if (c && route(b.tour, c) !== b.totalDistance) fail(`${tag}: distancia ${b.totalDistance} ≠ ${route(b.tour, c)}`);
  if (!near(b.objectiveValue, b.totalDistance + b.handlingCost, 1e-6)) fail(`${tag}: Z ≠ distancia + manipulación`);
  checkDetail(tag, b.tour, b.detail, alpha, beta, s.h_a, s.h_b, b.handlingCost);
  const bestDir = Math.min(...s.directions.map((x) => x.best.objectiveValue));
  if (!near(bestDir, b.objectiveValue, 1e-6)) fail(`${tag}: 'best' no es el mínimo de las direcciones`);
  for (const dir of s.directions) {
    if (dir.history.length !== s.params.nIter || dir.localOptima.length !== s.params.nIter) fail(`${tag} dir ${dir.direction}: traza incompleta`);
    const h = [dir.initial.objectiveValue, ...dir.history];
    if (h.some((v, k) => k > 0 && v > h[k - 1] + 1e-9)) fail(`${tag} dir ${dir.direction}: el mejor costo aumenta`);
    if (!near(h[h.length - 1], dir.best.objectiveValue, 1e-6)) fail(`${tag} dir ${dir.direction}: la traza no termina en el mejor costo`);
  }
  tally.runs += s.runsSummary.objectives.length;
  if (!near(s.runsSummary.min, b.objectiveValue, 1e-6)) fail(`${tag}: 'best' (${b.objectiveValue}) no es la mejor corrida (${s.runsSummary.min})`);
  if (!s.runsSummary.seeds.includes(b.seed)) fail(`${tag}: la semilla de 'best' no está entre las corridas`);
  if (p3) {
    if (b.objectiveValue < p3.objectiveValue - EPS) fail(`${tag}: ILS ${b.objectiveValue} mejora el óptimo Gurobi P3 ${p3.objectiveValue} (imposible)`);
    if (near(b.objectiveValue, p3.objectiveValue)) tally.ilsOptimal++;
  }
}

console.log('\nResumen:', JSON.stringify(tally, null, 2));
console.log(failures === 0 ? '\n✓ Resultados de las heurísticas consistentes con Gurobi' : `\n✗ ${failures} fallas`);
process.exit(failures === 0 ? 0 : 1);
