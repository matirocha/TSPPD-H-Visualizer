// Valida la agregación del benchmark de tiempos (sección «Tiempos»):
//  1) fixtures sintéticos: óptimo, time_limit con y sin incumbente, error, pendiente, h = 1 vs 1.0,
//     claves repetidas, referencia no probada, formato es-CL y exportación LaTeX/CSV;
//  2) datos reales de ../../Outputs/Benchmark (solo lectura): recalcula de forma independiente desde
//     registros.jsonl y compara conteos y medias, y revisa la coherencia entre métodos.
// Uso: node scripts/validate-benchmark.ts   (Node ≥ 22.18 ejecuta TypeScript directamente)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as A from '../src/components/benchmark/aggregate.ts';
import { fmtMs, fmtNum, fmtPctValue, fmtSec, fmtZ } from '../src/components/benchmark/format.ts';
import { toCsv, toLatexComparison, toLatexDetail, toLatexSummary } from '../src/components/benchmark/export.ts';
import type { BenchMethod, BenchRecord, BenchmarkFile } from '../src/types/benchmark.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../../Outputs');
const benchDir = path.join(outputsDir, 'Benchmark');

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
const eq = (got: unknown, want: unknown, msg: string) => check(Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `${msg}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
const approx = (got: number | null | undefined, want: number | null | undefined, msg: string, eps = 1e-9) => check(near(got, want, eps), `${msg}: ${got} ≠ ${want}`);

// =============================================================================================
// 1) FIXTURES SINTÉTICOS
// =============================================================================================
console.log('1) Fixtures sintéticos');

const MODEL = { general: 'TSPPD-H', p1: 'TSPPD-H_1', p2: 'TSPPD-H_2', p3: 'TSPPD-H_3' } as const;
let clock = 0;
function rec(method: BenchMethod, n: number, id: number, h: number, extra: Record<string, unknown> = {}): BenchRecord {
  clock++;
  const base: Record<string, unknown> = {
    key: `${method}|${n}|${id}|${h}`,
    method,
    label: method,
    numCustomers: n,
    instanceId: id,
    h,
    config: method === 'dp' ? {} : method === 'ils' ? { nIter: 200, d: 0.1, seed: 1, runs: 10 } : { timeLimitSec: 60, threads: 1 },
    parallel: { workers: 2, threads: 1 },
    status: method === 'dp' || method === 'ils' ? 'heuristic' : 'optimal',
    optimal: !(method === 'dp' || method === 'ils'),
    finishedAt: new Date(Date.UTC(2026, 9, 3, 12, 0, clock)).toISOString(),
    timeSec: 1,
    objective: 100,
    totalDistance: 90,
    handlingCost: 10,
  };
  if (method in MODEL) Object.assign(base, { model: MODEL[method as keyof typeof MODEL], bound: extra.objective ?? 100, gapPct: 0 });
  if (method === 'ils') Object.assign(base, { runs: 10, hitsBest: 10 });
  return { ...base, ...extra } as unknown as BenchRecord;
}

const fixture: BenchmarkFile = {
  title: 'fixture',
  reference: '',
  generatedAt: '2026-10-03T12:00:00Z',
  meta: {
    cpu: 'x',
    logicalCpus: 2,
    os: 'test',
    python: '3',
    gurobi: '13',
    timeLimitSec: 60,
    threads: 1,
    workers: 2,
    ils: { nIter: 200, d: 0.1, seed: 1, runs: 10 },
    dpRepeats: 1,
    grid: { customers: [5, 10], ids: [1, 2], h: [0.1, 1.0], methods: [...A.METHOD_ORDER] },
  },
  methods: A.METHOD_ORDER.map((key) => ({ key, label: key })),
  count: 0,
  records: [
    // A: h=0.1 N=5 Id=1 — todo óptimo; P3 define la referencia probada (98).
    rec('p1', 5, 1, 0.1, { objective: 111, timeSec: 9 }), // reemplazado más abajo (última por clave gana)
    rec('general', 5, 1, 0.1, { objective: 95, handlingCost: 5, timeSec: 5 }),
    rec('p2', 5, 1, 0.1, { objective: 102, handlingCost: 12, timeSec: 2 }),
    rec('p3', 5, 1, 0.1, { objective: 98, handlingCost: 8, timeSec: 4 }),
    rec('dp', 5, 1, 0.1, { objective: 99, handlingCost: 9, timeSec: 0.001 }),
    rec('ils', 5, 1, 0.1, { objective: 98.004, handlingCost: 8, timeSec: 0.05 }),
    rec('p1', 5, 1, 0.1, { objective: 100, timeSec: 1 }),
    // B: h=0.1 N=5 Id=2 — P2 al límite con incumbente (brecha desde la cota), P3 al límite sin incumbente, General con error.
    rec('p1', 5, 2, 0.1, { objective: 200, timeSec: 3 }),
    rec('p2', 5, 2, 0.1, { status: 'time_limit', optimal: false, objective: 210, handlingCost: 20, bound: 189, gapPct: null, timeSec: 60 }),
    rec('p3', 5, 2, 0.1, { status: 'time_limit', optimal: false, objective: null, handlingCost: null, totalDistance: null, bound: 180, gapPct: null, timeSec: 60 }),
    rec('general', 5, 2, 0.1, { status: 'error', optimal: false, error: 'GurobiError: Out of memory', timeSec: undefined, objective: undefined }),
    rec('dp', 5, 2, 0.1, { objective: 205, timeSec: 0.002 }),
    rec('ils', 5, 2, 0.1, { objective: 203, timeSec: 0.07 }),
    // C: h=0.1 N=10 Id=1 — solo P1 (óptimo) e ILS; D (Id=2) pendiente por completo.
    rec('p1', 10, 1, 0.1, { objective: 300.5, timeSec: 7 }),
    rec('ils', 10, 1, 0.1, { objective: 300, timeSec: 0.2 }),
    // h = 1: clave escrita como «1.0» y luego como «1» (misma ejecución: gana la última); P3 con h ruidoso.
    rec('p1', 5, 1, 1, { key: 'p1|5|1|1.0', objective: 160, timeSec: 2 }),
    rec('p1', 5, 1, 1, { key: 'p1|5|1|1', objective: 150, timeSec: 1.5 }),
    rec('p3', 5, 1, 1.0000000001, { objective: 140, timeSec: 3 }),
    rec('p2', 5, 1, 1, { status: 'time_limit', optimal: false, objective: 155, bound: 150, gapPct: 3.2258, timeSec: 60 }),
  ],
};
fixture.count = fixture.records.length;

{
  const grid = A.gridOf(fixture);
  eq(grid.customers, [5, 10], 'grid.customers');
  eq(grid.h, [0.1, 1], 'grid.h (1.0 ≡ 1 y h ruidoso sin duplicar)');
  eq(grid.methods, [...A.METHOD_ORDER], 'grid.methods');
  const noMeta = A.gridOf({ ...fixture, meta: null, records: [...fixture.records, rec('dp', 30, 11, 0.25)] });
  eq(noMeta.customers, [5, 10, 15, 20, 25, 30], 'sin meta: DEFAULT_GRID ∪ observados (N)');
  eq(noMeta.ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'sin meta: DEFAULT_GRID ∪ observados (Id)');
  eq(noMeta.h, [0.1, 0.25, 0.5, 1], 'sin meta: DEFAULT_GRID ∪ observados (h)');
  eq(A.gridOf(null).customers, A.DEFAULT_GRID.customers, 'gridOf(null) = DEFAULT_GRID');
  eq(A.buildInstances(null).length, 150, 'buildInstances(null): 5 × 10 × 3 pendientes');
  eq(A.timeLimitOf(fixture), 60, 'timeLimitOf con meta');
  eq(A.timeLimitOf({ ...fixture, meta: null }), 60, 'timeLimitOf desde config');
  eq(A.timeLimitOf(null), null, 'timeLimitOf(null)');
  check(A.sameH(1, 1.0) && A.sameH(0.1, 0.1 + 1e-12) && !A.sameH(0.1, 0.5), 'sameH');
  check(A.sameCost(340.8, 340.805) && !A.sameCost(340.8, 340.81), 'sameCost');
  eq(A.benchKey('p1', 10, 1, 1.0), 'p1|10|1|1', 'benchKey con h = 1.0');
  eq(A.benchKey('ils', 10, 1, 0.1), 'ils|10|1|0.1', 'benchKey con h = 0.1');
}

const inst = A.buildInstances(fixture);
/** Claves distintas del fixture (h ruidoso ≡ 1). */
const unique = new Set(fixture.records.map((r) => A.benchKey(r.method, r.numCustomers, r.instanceId, Math.round(r.h * 1e6) / 1e6))).size;
const find = (h: number, n: number, id: number) => inst.find((i) => A.sameH(i.h, h) && i.numCustomers === n && i.instanceId === id)!;
{
  eq(inst.length, 8, 'buildInstances: 2 h × 2 N × 2 Id');
  eq(
    inst.map((i) => i.key),
    ['0.1|5|1', '0.1|5|2', '0.1|10|1', '0.1|10|2', '1|5|1', '1|5|2', '1|10|1', '1|10|2'],
    'orden h, N, Id',
  );
  const a = find(0.1, 5, 1);
  const b = find(0.1, 5, 2);
  const c = find(0.1, 10, 1);
  const d = find(0.1, 10, 2);
  const e = find(1, 5, 1);
  eq(a.ref, { value: 98, proven: true }, 'ref A: z*_P3 probado');
  eq(b.ref, { value: 203, proven: false }, 'ref B: min(P3 sin incumbente, DP, ILS) no probada');
  eq(c.ref, { value: 300, proven: false }, 'ref C: solo ILS (P1 no cuenta)');
  eq(d.ref, null, 'ref D: pendiente');
  eq(e.ref, { value: 140, proven: true }, 'ref h=1: P3 con h ruidoso se ubica en h = 1');
  eq(a.records.p1?.objective, 100, 'clave repetida: gana la última');
  eq(e.records.p1?.objective, 150, 'h=1 vs 1.0: gana la última');

  const cell = (i: A.BenchInstance, m: BenchMethod) => A.cellOf(i, m);
  eq(cell(a, 'p1').state, 'optimal', 'A p1 óptimo');
  eq(cell(a, 'p1').gapPct, null, 'óptimo sin brecha');
  approx(cell(a, 'p1').devPct, ((100 - 98) / 98) * 100, 'A p1 desviación vs z*_P3');
  approx(cell(a, 'general').devPct, ((95 - 98) / 98) * 100, 'A general bajo la referencia (relajación)');
  eq(cell(a, 'ils').state, 'heuristic', 'A ils heurística');
  eq(cell(a, 'ils').hitsRef, true, 'A ils alcanza z*_P3 (dentro de COST_EPS)');
  eq(cell(a, 'ils').devPct, 0, 'A ils desviación 0 exacta');
  approx(cell(a, 'dp').devPct, (1 / 98) * 100, 'A dp desviación');
  eq(cell(a, 'p3').handling, 8, 'A p3 z^H');
  eq(cell(b, 'p2').state, 'feasible', 'B p2 time_limit con incumbente → factible');
  approx(cell(b, 'p2').gapPct, (21 / 210) * 100, 'B p2 brecha calculada desde la cota');
  eq(cell(b, 'p3').state, 'no_solution', 'B p3 time_limit sin incumbente');
  eq(cell(b, 'p3').devPct, null, 'sin solución → sin desviación');
  eq(cell(b, 'general').state, 'error', 'B general error');
  eq(cell(b, 'general').objective, null, 'error sin objetivo');
  eq(cell(c, 'p2').state, 'pending', 'C p2 pendiente');
  eq(cell(e, 'p2').gapPct, 3.2258, 'gapPct del registro tiene prioridad');

  // Resumen h=0.1, N=5 (instancias A y B)
  const g = A.summarizeGroup(inst, 0.1, 5);
  eq(g.instances, 2, 'grupo N=5: 2 instancias');
  eq([g.methods.ils.withRef, g.methods.ils.withProvenRef], [2, 1], 'grupo N=5: ILS con referencia y con referencia probada');
  const p1 = g.methods.p1;
  eq([p1.expected, p1.done, p1.errors, p1.optimal, p1.feasible, p1.noSolution], [2, 2, 0, 2, 0, 0], 'p1 conteos');
  approx(p1.meanTimeSec, 2, 'p1 tiempo medio');
  approx(p1.meanTimeOptimalSec, 2, 'p1 tiempo medio óptimos');
  const p2 = g.methods.p2;
  eq([p2.done, p2.optimal, p2.feasible], [2, 1, 1], 'p2 conteos');
  approx(p2.meanTimeSec, 31, 'p2 tiempo medio (el límite cuenta con su Runtime)');
  approx(p2.meanTimeOptimalSec, 2, 'p2 tiempo medio solo óptimos');
  approx(p2.maxTimeSec, 60, 'p2 tiempo máximo');
  approx(p2.meanGapPct, 10, 'p2 brecha media de no óptimos');
  const p3 = g.methods.p3;
  eq([p3.done, p3.optimal, p3.noSolution, p3.withRef, p3.hitsRef], [2, 1, 1, 1, 1], 'p3 conteos');
  approx(p3.meanTimeSec, 32, 'p3 tiempo medio (incluye el límite sin incumbente)');
  eq(p3.meanGapPct, null, 'p3 sin brecha (sin incumbente)');
  const gen = g.methods.general;
  eq([gen.done, gen.errors, gen.optimal], [2, 1, 1], 'general: error cuenta como terminado');
  approx(gen.meanTimeSec, 5, 'general: el error no entra en la media');
  const dp = g.methods.dp;
  approx(dp.meanDevPct, ((1 / 98) * 100 + (2 / 203) * 100) / 2, 'dp desviación media');
  approx(dp.maxDevPct, (1 / 98) * 100, 'dp desviación máxima');
  eq([dp.hitsRef, dp.withRef, dp.meanTimeOptimalSec, dp.meanGapPct], [0, 2, null, null], 'dp sin campos Gurobi');
  const ils = g.methods.ils;
  eq([ils.hitsRef, ils.hitsProvenRef, ils.withProvenRef, ils.withRef], [2, 1, 1, 2], 'ils coincidencias con la referencia');
  approx(ils.meanObjective, (98.004 + 203) / 2, 'ils objetivo medio');

  const byN = A.summarizeByN(inst, 0.1);
  eq(byN.map((x) => x.numCustomers), [5, 10], 'summarizeByN: un grupo por N');
  eq([byN[1].methods.p1.done, byN[1].methods.p1.expected, byN[1].methods.dp.done], [1, 2, 0], 'N=10 parcial');
  const all01 = A.summarizeOverall(inst, 0.1);
  eq([all01.p1.done, all01.p1.expected, all01.p1.optimal], [3, 4, 3], 'summarizeOverall(h=0.1) p1');
  approx(all01.p1.meanTimeSec, (1 + 3 + 7) / 3, 'summarizeOverall(h=0.1) p1 tiempo');
  const all = A.summarizeOverall(inst, 'all');
  eq([all.p1.done, all.p1.expected], [4, 8], "summarizeOverall('all') p1");

  const prog = A.progressOf(fixture, inst);
  eq([prog.expected, prog.done, prog.errors, prog.complete], [48, unique, 1, false], 'progressOf');
  approx(prog.pct, (unique / 48) * 100, 'progressOf pct');
  eq(prog.lastFinishedAt, fixture.records[fixture.records.length - 1].finishedAt, 'progressOf lastFinishedAt');
  eq(A.progressOf(null, A.buildInstances(null)).expected, 900, 'progressOf sin archivo: 900 esperados');

  eq(A.largestAllSolvedN(inst, 'p1', 0.1), 5, 'largestAllSolvedN p1 h=0.1 (N=10 incompleto)');
  eq(A.largestAllSolvedN(inst, 'p3', 0.1), null, 'largestAllSolvedN p3 h=0.1 (B sin solución)');
  eq(A.largestAllSolvedN(inst, 'p1', 'all'), null, "largestAllSolvedN p1 'all' (h=1 Id=2 pendiente)");
}

{
  // Formato es-CL
  const S = (s: string) => s.replace(/\u00a0/g, ' ');
  eq(fmtSec(null), '—', 'fmtSec(null)');
  eq(S(fmtSec(0.004)), '< 0,01', 'fmtSec(0.004)');
  eq(fmtSec(0.01), '0,01', 'fmtSec(0.01)');
  eq(fmtSec(2.489), '2,49', 'fmtSec(2.489)');
  eq(fmtSec(9.996), '10,0', 'fmtSec(9.996) sube de rango tras redondear');
  eq(fmtSec(63.25), '63,3', 'fmtSec(63.25)');
  eq(fmtSec(1800), '1.800', 'fmtSec(1800)');
  eq(fmtSec(Number.NaN), '—', 'fmtSec(NaN)');
  eq(S(fmtMs(0.0004)), '< 0,001', 'fmtMs(0.0004)');
  eq(fmtMs(0.007346), '0,007', 'fmtMs(0.007346)');
  eq(fmtMs(12.34), '12,3', 'fmtMs(12.34)');
  eq(S(fmtPctValue(4.2)), '4,2 %', 'fmtPctValue(4.2)');
  eq(S(fmtPctValue(-0.31)), '−0,3 %', 'fmtPctValue(−0.31)');
  eq(S(fmtPctValue(-0.0001, 2)), '0,00 %', 'fmtPctValue sin −0');
  eq(fmtPctValue(null), '—', 'fmtPctValue(null)');
  eq(fmtZ(349.7), '349,7', 'fmtZ(349.7)');
  eq(fmtZ(1234.56), '1.234,6', 'fmtZ(1234.56)');
  eq(fmtNum(-1.234, 2), '−1,23', 'fmtNum negativo');
}

{
  // Exportación
  const unescapedPct = (tex: string) =>
    tex
      .split('\n')
      .filter((l) => !l.startsWith('%'))
      .some((l) => /(^|[^\\])%(?!$)/.test(l)); // un % al final de línea es un comentario LaTeX intencional
  const groups = A.summarizeByN(inst, 0.1);
  const sum = toLatexSummary(groups, A.summarizeOverall(inst, 0.1), { h: 0.1, timeLimitSec: 60 });
  check(sum.includes('\\toprule') && sum.includes('\\bottomrule') && sum.includes('\\cmidrule(lr){12-13}'), 'resumen: booktabs y 6 bloques');
  check(sum.includes('$h = h_a = h_b = 0{,}1$') && sum.includes('60{,}0\\,s'), 'resumen: caption con h y límite');
  check(/^5 & 1\/2 & 5\{,\}00 & 2\/2 & 2\{,\}00 & 1\/2 & 31\{,\}0 & 1\/2 & 32\{,\}0 & /m.test(sum), 'resumen: fila N=5');
  check(/^10 & \\ldots & \\ldots & 1\/2\$\^\{\\dagger\}\$ & 7\{,\}00/m.test(sum), 'resumen: fila N=10 parcial con †');
  check(/^Prom\. & /m.test(sum) && sum.includes('Datos parciales'), 'resumen: fila Prom. y nota de parciales');
  check(!unescapedPct(sum), 'resumen: sin % sin escapar');
  check(sum.includes('$<$\\,0{,}01'), 'resumen: «< 0,01» en LaTeX');
  // «Solo óptimas»: P2 y P3 de N=5 promedian solo su Id 1 (el Id 2 tocó el límite).
  const sumOpt = toLatexSummary(groups, A.summarizeOverall(inst, 0.1), { h: 0.1, timeLimitSec: 60, timeMode: 'optimal' });
  check(/^5 & 1\/2 & 5\{,\}00 & 2\/2 & 2\{,\}00 & 1\/2 & 2\{,\}00 & 1\/2 & 4\{,\}00 & /m.test(sumOpt), 'resumen solo óptimas: fila N=5');
  check(sumOpt.includes('resueltas a optimalidad (-- si ninguna)') && !sumOpt.includes('cuentan con su tiempo'), 'resumen solo óptimas: caption');

  const det = toLatexDetail(inst, { h: 0.1, n: 5, timeLimitSec: 60 });
  const line2 = det.split('\n').find((l) => l.startsWith('2 & ')) ?? '';
  // Id 2 no tiene z*_P3 probado: las desviaciones de las heurísticas llevan ‡.
  check(line2.startsWith('2 & err. & -- & 200{,}0 & 10{,}0 & 3{,}00 & 210{,}0$^{*}$ & 20{,}0 & 10{,}0\\,\\% & -- & -- & -- & 205{,}0 & 0{,}99$^{\\ddagger}$ & $<$\\,0{,}01 & 203{,}0 & 0{,}00$^{\\ddagger}$ & 0{,}07 \\\\'), `detalle: fila Id 2 → ${line2}`);
  const line1 = det.split('\n').find((l) => l.startsWith('1 & ')) ?? '';
  check(line1.startsWith('1 & 95{,}0 & 5{,}00 & 100{,}0 & 10{,}0 & 1{,}00 &'), `detalle: fila Id 1 → ${line1}`);
  // Heurísticas: k/W con W = instancias con z*_P3 probado (solo el Id 1).
  check(det.includes('\\# resueltas & \\multicolumn{2}{c}{1/2} & \\multicolumn{3}{c}{2/2} & \\multicolumn{3}{c}{1/2} & \\multicolumn{3}{c}{1/2} & \\multicolumn{3}{c}{0/1} & \\multicolumn{3}{c}{1/1}'), 'detalle: pie # resueltas (k/W)');
  check(det.includes('Desv. prom. & \\multicolumn{2}{c}{--} & \\multicolumn{3}{c}{--} & \\multicolumn{3}{c}{10{,}00\\,\\%}'), 'detalle: pie Desv. prom. (brecha de no óptimos)');
  check(det.includes('mejor solución conocida'), 'detalle: menciona referencias no probadas');
  check(!unescapedPct(det), 'detalle: sin % sin escapar');
  const detPending = toLatexDetail(inst, { h: 0.1, n: 10, timeLimitSec: null });
  check(/^2 & (\\ldots & ){16}\\ldots \\\\$/m.test(detPending), 'detalle: instancia pendiente con \\ldots en sus 17 columnas');
  // N = 10: sin z*_P3 probado → «--» (no «0/2»); General y DP sin ejecuciones → \ldots; con pendientes → †.
  check(detPending.includes('\\# resueltas & \\multicolumn{2}{c}{\\ldots} & \\multicolumn{3}{c}{1/2$^{\\dagger}$}'), 'detalle: pie con métodos pendientes');
  check(detPending.includes('\\multicolumn{3}{c}{\\ldots} & \\multicolumn{3}{c}{--$^{\\dagger}$} \\\\'), 'detalle: heurísticas sin z*_P3 probado → --');
  check(detPending.includes('Datos parciales: faltan ejecuciones'), 'detalle: nota del † en el pie');
  check(!detPending.includes('Límite de tiempo'), 'detalle: sin límite conocido no se menciona');
  const detH1 = toLatexDetail(inst, { h: 1, n: 5, timeLimitSec: 60 });
  check(detH1.includes('h = h_a = h_b = 1$') && detH1.includes('tab:tiempos-n5-h1}'), 'detalle h = 1: caption y etiqueta');

  // Tabla comparativa completa: una fila por Id dentro de cada N, con z y Seg. de cada método.
  const cmp = toLatexComparison(inst, groups, A.summarizeOverall(inst, 0.1, 'common'), { h: 0.1, timeLimitSec: 60 });
  check(cmp.includes('\\begin{tabular}{rr rr rr rr rr rr rr}') && !cmp.includes('longtable'), 'comparativa: tabular (sin longtable, que exige otro paquete)');
  eq(cmp.split('\\begin{table}').length - 1, 1, 'comparativa: 2 grupos de 2 Id caben en una sola tabla');
  {
    // Grilla completa (5 |Vc| × 10 Id): dos tablas, |Vc| 5–10 con el caption y 15–25 + Total como continuación.
    const full = A.buildInstances({
      ...fixture,
      records: [5, 10, 15, 20, 25].flatMap((n) => Array.from({ length: 10 }, (_, k) => A.METHOD_ORDER.map((m) => rec(m, n, k + 1, 0.1)))).flat(),
    });
    const tex = toLatexComparison(full, A.summarizeByN(full, 0.1), A.summarizeOverall(full, 0.1, 'common'), { h: 0.1, timeLimitSec: 60 });
    const [first, second, ...rest] = tex.split('\\begin{table}').slice(1);
    check(second !== undefined && rest.length === 0, 'comparativa completa: dos tablas');
    check(/^10 & 1 & /m.test(first) && !/^15 & 1 & /m.test(first) && /^15 & 1 & /m.test(second ?? '') && /^25 & 1 & /m.test(second ?? ''), 'comparativa completa: |Vc| 5–10 y luego 15–25');
    check(first.includes('\\caption{') && first.includes('\\label{tab:tiempos-comparativa-h0-1}'), 'comparativa completa: caption y etiqueta en la primera');
    check(!second?.includes('\\caption') && !second?.includes('\\label') && !!second?.includes('\\tablename~\\ref{tab:tiempos-comparativa-h0-1} (continuación)'), 'comparativa completa: la segunda es continuación');
    check(!first.includes('{Total}') && !!second?.includes('\\multicolumn{2}{l}{Total}'), 'comparativa completa: Total solo al final');
    check([first, second ?? ''].every((t) => t.includes('$|V_c|$ & Id & ')), 'comparativa completa: encabezado en cada tabla');
    check(tex.split('\\documentclass{article}').length === 2 && tex.split('\\TablaTSPPDfin\n').length === 2 && tex.endsWith('\\end{table}\n\n\\TablaTSPPDfin\n'), 'comparativa completa: un documento propio para las dos tablas');
  }
  // Se pega en cualquier preámbulo: reservas sin booktabs/graphicx y reducción al ancho de línea.
  for (const [tex, tag] of [[sum, 'resumen'], [det, 'detalle'], [cmp, 'comparativa']] as const) {
    // También en un proyecto vacío de Overleaf: arma su documento solo si aún no hay \documentclass y lo cierra al final.
    check(tex.startsWith('% Tabla generada por la Página Web 12') && tex.endsWith('\n\\TablaTSPPDfin\n'), `${tag}: encabezado y cierre del documento propio`);
    const pre = tex.slice(0, tex.indexOf('\\begin{table}'));
    check(pre.includes('\\ifx\\documentclass\\@twoclasseserror') && pre.indexOf('\\documentclass{article}') > pre.indexOf('\\else') && pre.includes('\\begin{document}\n\\fi'), `${tag}: \\documentclass solo si aún no hay documento`);
    eq(tex.split('\\documentclass{article}').length, 2, `${tag}: un solo encabezado`);
    check(tex.includes('\\providecommand{\\toprule}{\\hline}') && tex.includes('\\def\\cmidrule(#1)#2{\\cline{#2}}') && tex.includes('\\providecommand{\\resizebox}[3]{#3}'), `${tag}: reservas sin booktabs/graphicx`);
    check(tex.includes('\\resizebox{\\ifdim\\width>\\linewidth\\linewidth\\else\\width\\fi}{!}{%'), `${tag}: se reduce al ancho de línea`);
  }
  check(cmp.includes('\\cmidrule(lr){3-4}') && cmp.includes('\\cmidrule(lr){13-14}'), 'comparativa: bloques de 2 columnas desde la 3');
  const cmpRows = cmp.split('\n').filter((l) => /^(\d+)? & \d+ & /.test(l));
  eq(cmpRows.length, inst.filter((i) => A.sameH(i.h, 0.1)).length, 'comparativa: una fila por instancia de h = 0,1');
  check(cmpRows.includes('5 & 1 & 95{,}0 & 5{,}00 & 100{,}0 & 1{,}00 & 102{,}0 & 2{,}00 & 98{,}0 & 4{,}00 & 99{,}0 & $<$\\,0{,}01 & 98{,}0 & 0{,}05 \\\\'), `comparativa: fila N=5 Id 1 → ${cmpRows[0]}`);
  check(
    cmpRows.includes(' & 2 & err. & -- & 200{,}0 & 3{,}00 & 210{,}0$^{*}$ & 60{,}0\\,{\\scriptsize(10{,}0\\,\\%)} & -- & 60{,}0 & 205{,}0 & $<$\\,0{,}01 & 203{,}0 & 0{,}07 \\\\'),
    `comparativa: fila N=5 Id 2 (error, límite con y sin incumbente) → ${cmpRows[1]}`,
  );
  check(cmpRows.includes('10 & 1 & \\ldots & \\ldots & 300{,}5 & 7{,}00 & \\ldots & \\ldots & \\ldots & \\ldots & \\ldots & \\ldots & 300{,}0 & 0{,}20 \\\\'), 'comparativa: fila con pendientes');
  eq(cmp.split('\n').filter((l) => l.startsWith(' & \\emph{Prom.} & ')).length, 2, 'comparativa: una fila Prom. por N');
  check(/^ & \\emph\{Prom\.\} & 1\/2 & 5\{,\}00 & 2\/2 & 2\{,\}00 & 1\/2 & 31\{,\}0 & /m.test(cmp), 'comparativa: Prom. de N=5 igual al resumen');
  check(/^\\multicolumn\{2\}\{l\}\{Total\} & /m.test(cmp), 'comparativa: fila Total');
  check(cmp.includes('tab:tiempos-comparativa-h0-1}') && cmp.includes('$h = h_a = h_b = 0{,}1$'), 'comparativa: etiqueta y caption');
  check(!unescapedPct(cmp), 'comparativa: sin % sin escapar');
  const cmpOpt = toLatexComparison(inst, groups, A.summarizeOverall(inst, 0.1, 'common'), { h: 0.1, timeLimitSec: 60, timeMode: 'optimal' });
  check(/^ & \\emph\{Prom\.\} & 1\/2 & 5\{,\}00 & 2\/2 & 2\{,\}00 & 1\/2 & 2\{,\}00 & 1\/2 & 4\{,\}00 & /m.test(cmpOpt), 'comparativa solo óptimas: Prom. de N=5');
}

{
  // Modelo General sin ejecutar con N = 15 (registros 'skipped' por su alto costo computacional).
  const skip = (n: number, id: number) =>
    rec('general', n, id, 0.1, { status: 'skipped', optimal: false, objective: null, timeSec: null, handlingCost: null, totalDistance: null, config: { generalMaxN: 5 }, reason: 'No se ejecuta: alto costo computacional' });
  const recs2: BenchRecord[] = [];
  for (const id of [1, 2]) {
    for (const m of A.METHOD_ORDER) recs2.push(rec(m, 5, id, 0.1, { objective: m === 'general' ? 95 : 100, timeSec: 2 }));
    recs2.push(skip(15, id));
  }
  for (const m of ['p1', 'p2', 'p3', 'dp', 'ils'] as const) recs2.push(rec(m, 15, 1, 0.1, { objective: 200, timeSec: 4 }));
  for (const m of ['p1', 'p3', 'dp', 'ils'] as const) recs2.push(rec(m, 15, 2, 0.1, { objective: 210, timeSec: 6 })); // P2 de Id 2 pendiente
  const f2: BenchmarkFile = {
    ...fixture,
    meta: { ...(fixture.meta as NonNullable<BenchmarkFile['meta']>), generalMaxN: 5, grid: { customers: [5, 15], ids: [1, 2], h: [0.1], methods: [...A.METHOD_ORDER] } },
    records: recs2,
    count: recs2.length,
  };
  const inst2 = A.buildInstances(f2);
  const i15 = inst2.find((i) => i.numCustomers === 15 && i.instanceId === 1)!;
  eq(A.cellOf(i15, 'general').state, 'skipped', 'skipped: estado de la celda');
  const g15 = A.summarizeGroup(inst2, 0.1, 15).methods.general;
  eq([g15.expected, g15.done, g15.skipped, g15.optimal, g15.meanTimeSec], [0, 0, 2, 0, null], 'skipped: el grupo N=15 del General no espera ejecuciones');
  const p2g = A.summarizeGroup(inst2, 0.1, 15).methods.p2;
  eq([p2g.expected, p2g.done, p2g.skipped], [2, 1, 0], 'skipped: los demás métodos no cambian');
  const oc2 = A.summarizeOverall(inst2, 0.1, 'common');
  eq([oc2.general.expected, oc2.general.skipped, oc2.general.optimal, A.instancesOf(oc2)], [2, 1, 2, 3], 'skipped: Total común (N=5 ×2 + N=15 Id 1)');
  eq(A.skippedFromN(inst2, 'general', 0.1), 15, 'skippedFromN(general)');
  eq(A.skippedFromN(inst2, 'p1', 0.1), null, 'skippedFromN(p1)');
  eq(A.largestAllSolvedN(inst2, 'general', 0.1), 5, 'skipped: largestAllSolvedN no pasa de N=5');
  const prog2 = A.progressOf(f2, inst2);
  eq([prog2.expected, prog2.done, prog2.complete], [24, 23, false], 'skipped: cuenta como terminado en el avance');

  const groups2 = A.summarizeByN(inst2, 0.1);
  const cmp2 = toLatexComparison(inst2, groups2, oc2, { h: 0.1, timeLimitSec: 60 });
  // Columnas efectivas por fila: celdas + (k − 1) por cada \multicolumn{k}.
  const width = (line: string) => line.split(' & ').length + [...line.matchAll(/\\multicolumn\{(\d+)\}/g)].reduce((a, m) => a + Number(m[1]) - 1, 0);
  const dataLines = cmp2.split('\n').filter((l) => / \\\\$/.test(l) && !l.startsWith('\\label') && !l.includes('continuación'));
  check(dataLines.length > 0 && dataLines.every((l) => width(l) === 14), `skipped LaTeX: todas las filas con 14 columnas → ${dataLines.filter((l) => width(l) !== 14).join(' | ')}`);
  check(/^15 & 1 &  &  & 200\{,\}0 & 4\{,\}00 & /m.test(cmp2), 'skipped LaTeX: celdas del General en blanco');
  check(cmp2.includes(' & \\emph{Prom.} & \\multicolumn{2}{c}{\\textit{n.e.}$^{\\S}$} & '), 'skipped LaTeX: Prom. de N=15 con n.e.§');
  check(/^\\multicolumn\{2\}\{l\}\{Total\} & 2\/2\$\^\{\\S\}\$ & /m.test(cmp2), 'skipped LaTeX: Total del General marcado con §');
  check(cmp2.includes('no ejecutado con $|V_c| \\geq 15$') && cmp2.includes('alto costo computacional'), 'skipped LaTeX: nota § en el caption');
  const sum2 = toLatexSummary(groups2, oc2, { h: 0.1, timeLimitSec: 60 });
  check(/^15 & \\multicolumn\{2\}\{c\}\{\\textit\{n\.e\.\}\$\^\{\\S\}\$\} & /m.test(sum2) && sum2.includes('alto costo computacional'), 'skipped LaTeX resumen: fila N=15');
  const det2 = toLatexDetail(inst2, { h: 0.1, n: 15, timeLimitSec: 60 });
  check(det2.includes('\\# resueltas & \\multicolumn{2}{c}{\\textit{n.e.}$^{\\S}$} & ') && det2.includes('no ejecutado con $|V_c| \\geq 15$'), 'skipped LaTeX detalle: pie y nota');
  check(/^1 &  &  & 200\{,\}0 & /m.test(det2), 'skipped LaTeX detalle: celdas en blanco');

  const csv = toCsv(fixture);
  const rows = csv.trimEnd().split('\r\n');
  eq(rows.length, 1 + unique, 'CSV: encabezado + una fila por clave');
  const header = rows[0].split(';');
  check(header.includes('timeSec') && header.includes('gapPct') && header.includes('objective'), 'CSV: columnas');
  const p1row = rows.find((r) => r.startsWith('p1|5|1|0.1;'))?.split(';') ?? [];
  eq(p1row[header.indexOf('objective')], '100', 'CSV: última por clave y decimal «.»');
  const genErr = rows.find((r) => r.startsWith('general|5|2|0.1;'))?.split(';') ?? [];
  eq(genErr[header.indexOf('error')], 'GurobiError: Out of memory', 'CSV: mensaje de error');
  eq(toCsv(null).split('\r\n')[0], header.join(';'), 'CSV(null): solo encabezado');
  eq(rows.filter((r) => r.startsWith('p1|5|1|1;')).length, 1, 'CSV: h = 1 y 1.0 en una sola fila');
}

{
  // Hallazgos de revisión: referencias no probadas, «Prom.» comparable, ILS mejor vs por corrida,
  // límite de tiempo y grilla cuando meta describe solo la última invocación del script.
  const g = A.summarizeByN(inst, 0.1);
  const sum = toLatexSummary(g, A.summarizeOverall(inst, 0.1), { h: 0.1, timeLimitSec: 60 });
  // N = 5: el ILS se compara con una referencia no probada (Id 2) → ‡ y nota.
  check(/^5 & .* & 0\{,\}00\$\^\{\\ddagger\}\$ & 0\{,\}06 \\\\$/m.test(sum), 'resumen: ‡ en la desviación del ILS con referencias no probadas');
  check(sum.includes('$^{\\ddagger}$~Gurobi P3 no probó'), 'resumen: nota del ‡');
  check(sum.includes('mejor de sus corridas'), 'resumen: el ILS informa la mejor de sus corridas');

  // «Prom.» comparable: solo instancias que todos los métodos ya terminaron.
  const common = A.commonInstances(inst, 0.1);
  eq(common.map((i) => i.key), ['0.1|5|1', '0.1|5|2'], 'commonInstances(h=0.1): solo las que los seis métodos terminaron');
  const oc = A.summarizeOverall(inst, 0.1, 'common');
  eq([oc.p1.expected, oc.p1.done, oc.ils.expected, oc.ils.done], [2, 2, 2, 2], "summarizeOverall('common'): mismo conjunto en todas las columnas");
  approx(oc.p1.meanTimeSec, 2, "summarizeOverall('common') p1 (sin la N = 10 que solo terminó P1)");
  const sumCommon = toLatexSummary(g, oc, { h: 0.1, timeLimitSec: 60 });
  check(sumCommon.includes('Prom.: solo las 2 de 4 instancias'), 'resumen: nota de «Prom.» sobre instancias comunes');
  // Sin ningún registro no se exige ningún método: todas (pendientes), igual que las filas.
  eq(A.commonInstances(A.buildInstances(null), 'all').length, 150, 'commonInstances sin registros: todas, pendientes');

  // ILS: desviación de una corrida promedio (objectiveMean) frente a la mejor.
  const ilsFile: BenchmarkFile = {
    ...fixture,
    records: [
      rec('p3', 5, 1, 0.1, { objective: 100, timeSec: 2 }),
      rec('ils', 5, 1, 0.1, { objective: 100, objectiveMean: 101, hitsBest: 4, timeSec: 0.1 }),
      rec('ils', 5, 2, 0.1, { objective: 200, objectiveMean: 200, timeSec: 0.1 }),
      rec('p3', 5, 2, 0.1, { objective: 200, timeSec: 2 }),
    ],
  };
  const ilsStats = A.summarizeGroup(A.buildInstances(ilsFile), 0.1, 5).methods;
  eq(ilsStats.ils.meanDevPct, 0, 'ILS: la mejor corrida iguala z*_P3');
  approx(ilsStats.ils.meanRunDevPct, (1 + 0) / 2, 'ILS: desviación media por corrida (objectiveMean)');
  eq(ilsStats.dp.meanRunDevPct, null, 'meanRunDevPct solo del ILS');

  // Límite de tiempo: los registros mandan sobre meta (meta = última invocación, p. ej. --consolidate).
  const withLimit = (t: number) => (r: BenchRecord) => (A.isGurobiMethod(r.method) ? ({ ...r, config: { ...r.config, timeLimitSec: t } } as BenchRecord) : r);
  const meta7200 = { ...fixture, meta: { ...fixture.meta!, timeLimitSec: 1800 }, records: fixture.records.map(withLimit(7200)) };
  eq(A.timeLimitOf(meta7200), 7200, 'timeLimitOf: config de los registros antes que meta');
  eq(A.timeLimitsOf(meta7200), [7200], 'timeLimitsOf: un solo límite');
  const mixed = { ...fixture, records: fixture.records.map((r, k) => withLimit(k % 3 === 0 ? 600 : 1800)(r)) };
  eq(A.timeLimitsOf(mixed), [600, 1800], 'timeLimitsOf: límites mezclados');
  eq(A.timeLimitOf({ ...fixture, records: [] }), 60, 'timeLimitOf: sin registros Gurobi cae a meta');
  const mixedTex = toLatexSummary(g, A.summarizeOverall(inst, 0.1), { h: 0.1, timeLimitSec: 1800, timeLimits: [600, 1800] });
  check(mixedTex.includes('Límites de tiempo de Gurobi: 600 y 1.800\\,s según la ejecución'), 'resumen: avisa límites mezclados');

  // Grilla: una invocación parcial (reanudar con --customers 25) no debe ocultar N = 20.
  const resumed: BenchmarkFile = {
    ...fixture,
    meta: { ...fixture.meta!, grid: { customers: [25], ids: [...A.DEFAULT_GRID.ids], h: [0.1, 0.5, 1], methods: [...A.METHOD_ORDER] } },
    records: [rec('p1', 15, 1, 0.1), rec('p1', 25, 1, 0.1)],
  };
  eq(A.gridOf(resumed).customers, [5, 10, 15, 20, 25], 'gridOf: meta.grid parcial (registros fuera de ella) ∪ DEFAULT_GRID');
  eq(A.progressOf(resumed, A.buildInstances(resumed)).expected, 900, 'progressOf con meta.grid parcial: 900 esperados');
  eq(A.gridOf(fixture).customers, [5, 10], 'gridOf: meta.grid que cubre los registros se respeta');
}

{
  // Lector del servidor: un consolidado sin registros no es «un benchmark vacío» (cae al JSONL o a null).
  const os = await import('os');
  const api = (await import('./solutions-api.js')) as { readBenchmark?: (dir: string) => BenchmarkFile | null };
  if (typeof api.readBenchmark === 'function') {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-'));
    try {
      const dir = path.join(tmp, 'Benchmark');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'benchmark_tiempos.json'), JSON.stringify({ ...fixture, records: [] }));
      eq(api.readBenchmark(tmp), null, 'readBenchmark: consolidado vacío y sin JSONL → null');
      const lines = fixture.records.slice(0, 3).map((r) => JSON.stringify(r));
      fs.writeFileSync(path.join(dir, 'registros.jsonl'), lines.join('\n') + '\n{"key": "a medio escrib');
      const fromJsonl = api.readBenchmark(tmp);
      eq([fromJsonl?.count, fromJsonl?.meta], [3, null], 'readBenchmark: consolidado vacío → reconstruye desde registros.jsonl');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

console.log(`   ${checks} comprobaciones, ${failures} fallas`);

// =============================================================================================
// 2) DATOS REALES (Outputs/Benchmark, solo lectura)
// =============================================================================================
console.log('\n2) Datos reales en Outputs/Benchmark');
const jsonPath = path.join(benchDir, 'benchmark_tiempos.json');
const jsonlPath = path.join(benchDir, 'registros.jsonl');
const failuresBefore = failures;

/** Último registro por clave del JSONL (líneas corruptas o a medio escribir se ignoran). */
function readJsonl(file: string): { latest: Map<string, BenchRecord>; lines: number; bad: number } {
  const latest = new Map<string, BenchRecord>();
  let lines = 0;
  let bad = 0;
  if (!fs.existsSync(file)) return { latest, lines, bad };
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    lines++;
    try {
      const r = JSON.parse(line) as BenchRecord;
      latest.set(r.key, r);
    } catch {
      bad++;
    }
  }
  return { latest, lines, bad };
}

if (!fs.existsSync(jsonPath) && !fs.existsSync(jsonlPath)) {
  console.log('⚠ No hay resultados en Outputs/Benchmark/ (ejecuta notebooks/tsppd_h_benchmark.py). Se omite esta parte.');
} else {
  // El JSON se lee antes que el JSONL: el script agrega la línea y luego reescribe el JSON,
  // así que el JSONL contiene siempre al menos lo del JSON (puede tener más si corre en vivo).
  let jsonFile: BenchmarkFile | null = null;
  if (fs.existsSync(jsonPath)) {
    try {
      jsonFile = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as BenchmarkFile;
    } catch (err) {
      console.log(`  ⚠ benchmark_tiempos.json no se pudo leer (${(err as Error).message}); se usa solo el JSONL`);
    }
  }
  const { latest, lines, bad } = readJsonl(jsonlPath);
  const live = [...latest.values()];
  console.log(`   JSON: ${jsonFile ? jsonFile.records.length : '—'} registros · JSONL: ${lines} líneas, ${latest.size} claves, ${bad} corruptas`);

  // 2a) JSON coherente con el JSONL
  if (jsonFile) {
    eq(jsonFile.count, jsonFile.records.length, 'JSON: count = registros');
    let newer = 0;
    for (const r of jsonFile.records) {
      const l = latest.get(r.key);
      if (!l) {
        check(false, `JSON ${r.key}: no está en registros.jsonl`);
        continue;
      }
      if (l.finishedAt !== r.finishedAt) {
        newer++;
        continue;
      }
      check(l.status === r.status && near(l.timeSec, r.timeSec) && near(l.objective, r.objective), `JSON ${r.key}: distinto del JSONL`);
    }
    if (newer) console.log(`   (${newer} claves con una ejecución más nueva en el JSONL: el benchmark corre en vivo)`);
    check(latest.size >= jsonFile.records.length, 'JSONL tiene al menos las claves del JSON');
  }

  // 2b) Integridad de cada registro
  const gurobiSet = new Set<string>(A.GUROBI_METHODS);
  for (const r of live) {
    const tag = r.key;
    check(A.METHOD_ORDER.includes(r.method), `${tag}: método desconocido`);
    eq(r.key, A.benchKey(r.method, r.numCustomers, r.instanceId, r.h), `${tag}: clave ≠ método|N|Id|h`);
    if (r.status === 'error') {
      check(typeof r.error === 'string' && r.error.length > 0, `${tag}: error sin mensaje`);
      continue;
    }
    if (r.status === 'skipped') {
      // Solo el Modelo General se deja sin ejecutar (alto costo computacional), sin z ni tiempo.
      check(r.method === 'general' && r.objective == null && typeof r.reason === 'string', `${tag}: registro «skipped» inválido`);
      continue;
    }
    check(typeof r.timeSec === 'number' && r.timeSec >= 0, `${tag}: timeSec inválido`);
    if (gurobiSet.has(r.method)) {
      const g = r as BenchRecord & { gapPct?: number | null; bound?: number | null };
      if (r.optimal) {
        check(r.status === 'optimal' && typeof r.objective === 'number', `${tag}: óptimo sin objetivo`);
        check((g.gapPct ?? 0) <= 0.01 + 1e-9, `${tag}: óptimo con brecha ${g.gapPct} % (> MIPGap 0,01 %)`);
      }
      if (typeof r.objective === 'number' && typeof r.totalDistance === 'number' && typeof r.handlingCost === 'number')
        check(near(r.objective, r.totalDistance + r.handlingCost, 1e-6), `${tag}: Z ≠ ruteo + manipulación`);
      if (typeof r.objective === 'number' && typeof g.bound === 'number') check(g.bound <= r.objective + 1e-6, `${tag}: cota sobre la mejor entera`);
    } else {
      check(r.status === 'heuristic' && typeof r.objective === 'number', `${tag}: heurística sin objetivo`);
      if (typeof r.objective === 'number' && typeof r.totalDistance === 'number' && typeof r.handlingCost === 'number')
        check(near(r.objective, r.totalDistance + r.handlingCost, 1e-6), `${tag}: Z ≠ ruteo + manipulación`);
      if (r.method === 'ils') {
        const s = r as BenchRecord & { objectiveMean?: number; hitsBest?: number; runs?: number };
        check(typeof s.objectiveMean !== 'number' || s.objectiveMean >= (r.objective as number) - 1e-6, `${tag}: media < mejor corrida`);
        check(typeof s.hitsBest !== 'number' || (s.hitsBest >= 1 && s.hitsBest <= (s.runs ?? Infinity)), `${tag}: hitsBest fuera de rango`);
      }
    }
  }

  // 2c) Coherencia entre métodos de cada instancia (con la tolerancia MIPGap = 1e-4 de Gurobi)
  const tol = (z: number) => Math.max(A.COST_EPS, 1e-4 * Math.abs(z));
  const byInstance = new Map<string, Partial<Record<BenchMethod, BenchRecord>>>();
  for (const r of live) {
    const k = `${A.hKey(r.h)}|${r.numCustomers}|${r.instanceId}`;
    const m = byInstance.get(k) ?? {};
    m[r.method] = r;
    byInstance.set(k, m);
  }
  const zOpt = (r: BenchRecord | undefined) => (r && r.status === 'optimal' && typeof r.objective === 'number' ? r.objective : null);
  const zAny = (r: BenchRecord | undefined) => (r && r.status !== 'error' && typeof r.objective === 'number' ? r.objective : null);
  const tally = { instances: byInstance.size, p3Optimal: 0, dpHits: 0, ilsHits: 0, generalBelowP3: 0 };
  for (const [k, m] of byInstance) {
    const p3 = zOpt(m.p3);
    const p1 = zOpt(m.p1);
    const p2 = zOpt(m.p2);
    const gen = zOpt(m.general);
    const dp = zAny(m.dp);
    const ils = zAny(m.ils);
    if (p3 !== null) {
      tally.p3Optimal++;
      if (p1 !== null) check(p3 <= p1 + tol(p1), `${k}: z*_P3 ${p3} > z*_P1 ${p1}`);
      if (p2 !== null) check(p3 <= p2 + tol(p2), `${k}: z*_P3 ${p3} > z*_P2 ${p2}`);
      if (gen !== null) {
        check(gen <= p3 + tol(p3), `${k}: z*_General ${gen} > z*_P3 ${p3} (el General es una relajación)`);
        if (gen < p3 - A.COST_EPS) tally.generalBelowP3++;
      }
      if (dp !== null) {
        check(dp >= p3 - tol(p3), `${k}: DP ${dp} mejora el óptimo P3 ${p3}`);
        if (A.sameCost(dp, p3)) tally.dpHits++;
      }
      if (ils !== null) {
        check(ils >= p3 - tol(p3), `${k}: ILS ${ils} mejora el óptimo P3 ${p3}`);
        if (A.sameCost(ils, p3)) tally.ilsHits++;
      }
    }
    // ILS-2dir parte de las mismas dos soluciones iniciales que el Alg. 2.1 + DP y nunca empeora.
    if (dp !== null && ils !== null) check(ils <= dp + 1e-6, `${k}: ILS ${ils} peor que su solución inicial DP ${dp}`);
  }
  // Valores verificados a mano (Battarra et al. 2010, N=10 Id=1 h=0,1)
  const known = byInstance.get('0.1|10|1');
  if (known) {
    const expect = { p1: 349.7, p2: 350.6, p3: 340.8 } as const;
    for (const [m, z] of Object.entries(expect) as [BenchMethod, number][]) {
      const v = zOpt(known[m]);
      if (v !== null) check(A.sameCost(v, z), `N=10 Id=1 h=0,1 ${m}: ${v} ≠ ${z}`);
    }
  }

  // 2d) Agregación de la página vs recálculo independiente sobre el mismo conjunto (JSONL)
  const fileFromJsonl: BenchmarkFile = {
    title: 'jsonl',
    reference: '',
    generatedAt: '',
    meta: jsonFile?.meta ?? null,
    methods: [],
    count: live.length,
    records: live,
  };
  const instances = A.buildInstances(fileFromJsonl);
  const grid = A.gridOf(fileFromJsonl);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const refIndep = (m: Partial<Record<BenchMethod, BenchRecord>>) => {
    const p3 = zOpt(m.p3);
    if (p3 !== null) return p3;
    const zs = [zAny(m.p3), zAny(m.dp), zAny(m.ils)].filter((z): z is number => z !== null);
    return zs.length ? Math.min(...zs) : null;
  };
  let groupsCompared = 0;
  for (const h of grid.h) {
    const groups = A.summarizeByN(instances, h);
    for (const g of groups) {
      const recs = live.filter((r) => A.sameH(r.h, h) && r.numCustomers === g.numCustomers);
      for (const method of A.METHOD_ORDER) {
        const s = g.methods[method];
        const all = recs.filter((r) => r.method === method);
        const notRun = all.filter((r) => r.status === 'skipped');
        const mine = all.filter((r) => r.status !== 'skipped');
        const ok = mine.filter((r) => r.status !== 'error');
        const tag = `h=${h} N=${g.numCustomers} ${method}`;
        eq(s.done, mine.length, `${tag}: terminados`);
        eq(s.skipped, notRun.length, `${tag}: no ejecutadas`);
        eq(s.expected, g.instances - notRun.length, `${tag}: esperadas sin las no ejecutadas`);
        eq(s.errors, mine.length - ok.length, `${tag}: errores`);
        eq(s.optimal, ok.filter((r) => r.status === 'optimal').length, `${tag}: óptimos`);
        approx(s.meanTimeSec, mean(ok.map((r) => r.timeSec ?? NaN).filter(Number.isFinite)), `${tag}: tiempo medio`, 1e-9);
        if (gurobiSet.has(method)) {
          approx(s.meanTimeOptimalSec, mean(ok.filter((r) => r.status === 'optimal').map((r) => r.timeSec as number)), `${tag}: tiempo medio óptimos`);
          const feas = ok.filter((r) => r.status !== 'optimal' && typeof r.objective === 'number');
          eq(s.feasible, feas.length, `${tag}: factibles`);
          const gaps = feas.map((r) => {
            const x = r as BenchRecord & { gapPct?: number | null; bound?: number | null };
            return typeof x.gapPct === 'number' ? x.gapPct : typeof x.bound === 'number' ? (Math.abs(x.bound - (r.objective as number)) / Math.abs(r.objective as number)) * 100 : NaN;
          });
          approx(s.meanGapPct, mean(gaps.filter(Number.isFinite)), `${tag}: brecha media`);
        }
        const devs: number[] = [];
        let hits = 0;
        for (const r of ok) {
          const ref = refIndep(byInstance.get(`${A.hKey(r.h)}|${r.numCustomers}|${r.instanceId}`) ?? {});
          if (ref === null || typeof r.objective !== 'number') continue;
          const hit = Math.abs(r.objective - ref) <= A.COST_EPS;
          if (hit) hits++;
          devs.push(hit ? 0 : ((r.objective - ref) / ref) * 100);
        }
        approx(s.meanDevPct, mean(devs), `${tag}: desviación media`, 1e-9);
        eq([s.hitsRef, s.withRef], [hits, devs.length], `${tag}: coincidencias con la referencia`);
        if (method === 'ils') {
          const runDevs: number[] = [];
          for (const r of ok) {
            const ref = refIndep(byInstance.get(`${A.hKey(r.h)}|${r.numCustomers}|${r.instanceId}`) ?? {});
            const zMean = (r as BenchRecord & { objectiveMean?: number }).objectiveMean;
            if (ref === null || typeof r.objective !== 'number' || typeof zMean !== 'number') continue;
            runDevs.push(Math.abs(zMean - ref) <= A.COST_EPS ? 0 : ((zMean - ref) / ref) * 100);
          }
          approx(s.meanRunDevPct, mean(runDevs), `${tag}: desviación media por corrida`, 1e-9);
          if (s.meanDevPct !== null && s.meanRunDevPct !== null) check(s.meanRunDevPct >= s.meanDevPct - 1e-9, `${tag}: la corrida media no supera a la mejor`);
        }
      }
      groupsCompared++;
    }
  }
  // «Prom.» comparable: cada columna promedia exactamente las mismas instancias.
  for (const h of grid.h) {
    const oc = A.summarizeOverall(instances, h, 'common');
    const sel = instances.filter((i) => A.sameH(i.h, h));
    const present = A.METHOD_ORDER.filter((m) => sel.some((i) => i.records[m]));
    const nCommon = sel.filter((i) => present.every((m) => i.records[m])).length;
    for (const m of A.METHOD_ORDER) eq(oc[m].expected + oc[m].skipped, nCommon, `h=${h} Prom. común ${m}: instancias`);
    for (const m of present) eq(oc[m].done + oc[m].skipped, nCommon, `h=${h} Prom. común ${m}: todas terminadas o no ejecutadas`);
    eq(A.instancesOf(oc), nCommon, `h=${h} instancesOf(Prom. común)`);
  }

  const prog = A.progressOf(fileFromJsonl, instances);
  const inGrid = live.filter(
    (r) => grid.customers.includes(r.numCustomers) && grid.ids.includes(r.instanceId) && grid.h.some((h) => A.sameH(h, r.h)) && grid.methods.includes(r.method),
  ).length;
  eq(prog.done, inGrid, 'progressOf: terminados = claves del JSONL en la grilla');
  eq(prog.expected, grid.customers.length * grid.ids.length * grid.h.length * grid.methods.length, 'progressOf: esperados = producto de la grilla');
  if (jsonFile) {
    const pj = A.progressOf(jsonFile, A.buildInstances(jsonFile));
    check(pj.done <= prog.done, `progressOf(JSON) ${pj.done} ≤ progressOf(JSONL) ${prog.done}`);
    const csvRows = toCsv(jsonFile).trimEnd().split('\r\n').length - 1;
    eq(csvRows, new Set(jsonFile.records.map((r) => r.key)).size, 'CSV del JSON: una fila por clave');
  }

  // 2e) Lector del servidor (scripts/solutions-api.js), si ya está implementado
  const api = (await import('./solutions-api.js')) as Record<string, unknown>;
  if (typeof api.readBenchmark === 'function') {
    const viaApi = (api.readBenchmark as (dir: string) => BenchmarkFile | null)(outputsDir);
    check(viaApi !== null && Array.isArray(viaApi.records), 'readBenchmark devuelve un BenchmarkFile');
    if (viaApi && jsonFile) check(viaApi.records.length >= jsonFile.records.length, `readBenchmark: ${viaApi.records.length} registros < ${jsonFile.records.length} del JSON leído antes`);
  } else console.log('   (readBenchmark aún no existe en scripts/solutions-api.js: se omite esa comprobación)');

  console.log(
    '   Resumen:',
    JSON.stringify({ ...tally, groupsCompared, progress: `${prog.done}/${prog.expected} (${prog.pct.toFixed(1)} %)`, lastFinishedAt: prog.lastFinishedAt }),
  );
  console.log(`   ${failures - failuresBefore} fallas con los datos reales`);
}

console.log(failures === 0 ? `\n✓ Benchmark de tiempos: ${checks} comprobaciones correctas` : `\n✗ ${failures} fallas de ${checks} comprobaciones`);
process.exit(failures === 0 ? 0 : 1);
