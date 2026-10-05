/**
 * Informe en LaTeX de los dos benchmarks de la página: «¿Cuánto tarda cada método?» (sección
 * «Tiempos») y «¿Exacto o heurístico? ILS e ITS con hasta 200 clientes» (sección «Metaheurísticas»).
 * Lee los consolidados de Outputs/Benchmark y Outputs/BenchmarkErdogan2012 y escribe
 * Outputs/Informe/informe_benchmarks.tex con:
 *  · las mismas tablas que «Copiar LaTeX» de la página (export.ts de cada sección), sin el envoltorio
 *    que las vuelve un documento propio;
 *  · gráficos en pgfplots con las mismas cifras de las tablas (aggregate.ts de cada sección);
 *  · hallazgos con cifras calculadas de los registros (nunca escritas a mano);
 *  · en los anexos, la tabla comparativa por instancia de cada h y el detalle por instancia de las
 *    metaheurísticas en el formato de las Tablas 8–9 de Erdoğan et al. (2012).
 * Compila con cualquier distribución de LaTeX (pdflatex dos veces, latexmk o tectonic).
 *
 *   node scripts/build-report.ts        (desde la carpeta de la Página Web 12)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as B from '../src/components/benchmark/aggregate.ts';
import * as BE from '../src/components/benchmark/export.ts';
import * as A from '../src/components/metaheuristics/aggregate.ts';
import * as E from '../src/components/metaheuristics/export.ts';
import { fmtNum, fmtSec } from '../src/components/benchmark/format.ts';
import { META_INFO } from '../src/components/metaheuristics/labels.ts';
import type { BenchMethod, BenchmarkFile } from '../src/types/benchmark.ts';
import type { MetaDirection, MetaFile, MetaMethod, PaperFile } from '../src/types/metaheuristics.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const outputs = path.join(repo, 'Outputs');
const outDir = path.join(outputs, 'Informe');
const outFile = path.join(outDir, 'informe_benchmarks.tex');

const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
const bench = readJson<BenchmarkFile>(path.join(outputs, 'Benchmark', 'benchmark_tiempos.json'));
const meta = readJson<MetaFile>(path.join(outputs, 'BenchmarkErdogan2012', 'benchmark_metaheuristicas.json'));
const paper = readJson<PaperFile>(path.join(outputs, 'BenchmarkErdogan2012', 'paper_erdogan2012.json'));

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Cadena es-CL de los formateadores → LaTeX (4,89 → 4{,}89; −0,3 → $-$0{,}3; NBSP → ~). */
const tex = (s: string) => s.replace(/,/g, '{,}').replace(/−/g, '$-$').replace(/ /g, '~').replace(/</g, '$<$');
const num = (x: number | null, d = 2) => tex(fmtNum(x, d));
const sec = (x: number | null) => tex(fmtSec(x));
const pct = (x: number | null, d = 2) => `${num(x, d)}\\,\\%`;
const ratio = (x: number) => tex(fmtNum(x, x >= 10 ? 0 : 1));
const row = (cells: string[]) => cells.join(' & ') + ' \\\\';
const listEs = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const texText = (s: string) => s.replace(/[\\{}$&#%_^~]/g, (c) => `\\${c}`);

/** Líneas de reserva de texTable: el preámbulo de este documento ya carga booktabs y graphicx. */
const FALLBACK_LINE = /^(% Reserva por si|\\providecommand\{\\toprule\}|\\ifdefined\\cmidrule|\\providecommand\{\\resizebox\})/;

/** Las tablas de un texSnippet, sin el encabezado y el cierre que arman un documento propio. */
function tablesOf(snippet: string): string {
  const start = snippet.indexOf('\\makeatother\n') + '\\makeatother\n'.length;
  const end = snippet.lastIndexOf('\\TablaTSPPDfin');
  return snippet
    .slice(start, end)
    .split('\n')
    .filter((l) => !FALLBACK_LINE.test(l))
    .join('\n')
    .trim();
}

/**
 * Página apaisada que entra tras la página en curso (afterpage), sin cortar el texto que la precede.
 * `then` (p. ej., la figura que la acompaña) se encola después, para que no se adelante a la tabla.
 */
const landscape = (body: string, then = '') => ['\\afterpage{%', '\\begin{landscape}', body, '\\end{landscape}', then, '}'].join('\n');

/** Potencias de 10 que encierran los valores (ejes logarítmicos). */
function logRange(values: number[], floorAt = 1e-4): [number, number] {
  const v = values.filter((x) => x > 0);
  const lo = Math.max(floorAt, Math.min(...v));
  return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(Math.max(...v)))];
}

const coords = (pts: [number, number | null][], floorAt = 0) =>
  pts
    .filter((p): p is [number, number] => p[1] !== null && Number.isFinite(p[1]) && p[1] > floorAt - 1e-12)
    .map(([x, y]) => `(${x},${Number(y.toPrecision(6))})`)
    .join(' ');

const today = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

// ---------------------------------------------------------------------------------------------
// 1 · ¿Cuánto tarda cada método? (sección «Tiempos»)
// ---------------------------------------------------------------------------------------------

const instances = B.buildInstances(bench);
const grid = B.gridOf(bench);
const timeLimit = B.timeLimitOf(bench);
const timeLimits = B.timeLimitsOf(bench);
const bm = bench.meta;
const hs = grid.h;

/** Estilo pgfplots de cada método (misma familia de colores que la página, más oscuros para imprimir). */
const BENCH_STYLE: Record<BenchMethod, string> = {
  general: 'color=cGeneral, mark=o, thick',
  p1: 'color=cP1, mark=*, thick',
  p2: 'color=cP2, mark=square*, thick',
  p3: 'color=cP3, mark=diamond*, thick, mark size=2.6pt',
  dp: 'color=cDos, mark=triangle*, thick, mark size=2.6pt',
  ils: 'color=cILS, mark=star, thick, mark size=2.8pt',
};
const BENCH_LABEL: Record<BenchMethod, string> = {
  general: 'General',
  p1: 'Política 1',
  p2: 'Política 2',
  p3: 'Política 3',
  dp: 'Dos fases',
  ils: 'ILS-2dir',
};

function benchSummaryTables(): string {
  return hs
    .map((h) => {
      const groups = B.summarizeByN(instances, h);
      const overall = B.summarizeOverall(instances, h, 'common');
      return tablesOf(BE.toLatexSummary(groups, overall, { h, timeLimitSec: timeLimit, timeLimits }));
    })
    .join('\n\n');
}

function benchComparisonTables(): string {
  return hs
    .map((h) => {
      const groups = B.summarizeByN(instances, h);
      const overall = B.summarizeOverall(instances, h, 'common');
      return tablesOf(BE.toLatexComparison(instances, groups, overall, { h, timeLimitSec: timeLimit, timeLimits }));
    })
    .join('\n\n\\clearpage\n');
}

function benchTimeFigure(): string {
  const all: number[] = [];
  const panels = hs.map((h, k) => {
    const groups = B.summarizeByN(instances, h);
    const plots = B.METHOD_ORDER.map((m) => {
      const pts = groups.map((g): [number, number | null] => [g.numCustomers, g.methods[m].meanTimeSec]);
      for (const [, y] of pts) if (y !== null) all.push(y);
      return `\\addplot[${BENCH_STYLE[m]}] coordinates {${coords(pts)}};` + (k === 0 ? `\n\\addlegendentry{${BENCH_LABEL[m]}}` : '');
    });
    const limit = timeLimit === null ? '' : `\n\\addplot[gray, densely dashed, forget plot] coordinates {(3,${timeLimit}) (27,${timeLimit})};`;
    const opts = [`title={$h = ${num(h, h === 1 ? 0 : 1)}$}`, ...(k === 0 ? ['legend to name=leyTiempos'] : [])];
    return [`\\nextgroupplot[${opts.join(', ')}]`, ...plots].join('\n') + limit;
  });
  const [ymin, ymax] = logRange([...all, timeLimit ?? 1]);
  const xs = grid.customers.join(',');
  return [
    '\\begin{figure}[htbp]',
    '\\centering',
    '\\begin{tikzpicture}',
    '\\begin{groupplot}[',
    '  group style={group size=3 by 1, horizontal sep=0.45cm, y descriptions at=edge left},',
    `  width=0.37\\linewidth, height=6.2cm, ymode=log, ymin=${ymin}, ymax=${ymax}, xmin=3, xmax=27, xtick={${xs}},`,
    '  xlabel={$|V_c|$}, ylabel={Tiempo medio (s)}, grid=major, grid style={gray!18},',
    '  tick label style={font=\\footnotesize}, label style={font=\\small}, title style={font=\\small},',
    '  legend columns=6, legend style={font=\\footnotesize, draw=none, column sep=6pt},',
    ']',
    ...panels,
    '\\end{groupplot}',
    '\\end{tikzpicture}',
    '',
    '\\smallskip',
    '\\pgfplotslegendfromname{leyTiempos}',
    `\\caption{Tiempo medio por instancia (s, escala logarítmica) de cada método según el número de clientes $|V_c|$, para cada $h = h_a = h_b$. La línea discontinua gris es el límite de Gurobi (${sec(timeLimit)}\\,s): las ejecuciones que lo alcanzan cuentan con su tiempo, así que en esos puntos el promedio es una cota inferior. El Modelo General solo se ejecuta hasta $|V_c| = ${bm?.generalMaxN ?? 10}$. ILS-2dir: tiempo medio por corrida.}`,
    '\\label{fig:tiempos}',
    '\\end{figure}',
  ].join('\n');
}

/** Hallazgos de la sección «Tiempos», con cifras calculadas sobre los registros de cada h. */
function benchFindings(): string {
  const hText = (h: number) => `$h = ${num(h, h === 1 ? 0 : 1)}$`;
  const items: string[] = [];

  // 1 · Hasta qué |Vc| resuelve cada modelo todas las instancias.
  const solved = hs.map((h) => {
    const parts = B.GUROBI_METHODS.map((m) => {
      const n = B.largestAllSolvedN(instances, m, h);
      return `${BENCH_LABEL[m]} (${n === null ? '--' : n})`;
    });
    return `${hText(h)}: ${listEs(parts)}`;
  });
  // La última frase solo si ningún modelo llega más lejos con un h mayor (h ascendente).
  const harder = B.GUROBI_METHODS.every((m) =>
    hs.every((h, i) => i === 0 || (B.largestAllSolvedN(instances, m, h) ?? 0) <= (B.largestAllSolvedN(instances, m, hs[i - 1]) ?? 0)),
  );
  items.push(
    `\\textbf{Hasta qué tamaño resuelve Gurobi todas las instancias.} Mayor $|V_c|$ con todas sus instancias (y las de los tamaños menores) resueltas a optimalidad dentro de ${sec(timeLimit)}\\,s: ${solved.join('; ')}.` +
      (harder ? ' Con un $h$ mayor ningún modelo llega más lejos: el costo de manipulación hace más difícil probar el óptimo.' : ''),
  );

  // 2 · Instancias resueltas a optimalidad por modelo y h.
  const opt = hs.map((h) => {
    const s = B.summarizeOverall(instances, h);
    return `${hText(h)}: ${listEs(B.GUROBI_METHODS.map((m) => `${BENCH_LABEL[m]} (${s[m].optimal}/${s[m].expected})`))}`;
  });
  items.push(
    `\\textbf{Instancias resueltas a optimalidad} (el Modelo General, sobre las que se ejecutan): ${opt.join('; ')}.`,
  );

  // 3 · Calidad del ILS y de dos fases frente a z*_P3 probado.
  const quality = hs.map((h) => {
    const s = B.summarizeOverall(instances, h);
    return `${hText(h)}: ILS iguala $z^{*}_{P3}$ en ${s.ils.hitsProvenRef} de ${s.ils.withProvenRef} y dos fases en ${s.dp.hitsProvenRef} de ${s.dp.withProvenRef} (desviación media de dos fases ${pct(s.dp.meanDevPct)})`;
  });
  items.push(
    `\\textbf{Calidad de las heurísticas.} Instancias en que la heurística alcanza el óptimo probado de la Política 3: ${quality.join('; ')}. En ninguna instancia con óptimo probado el ILS queda sobre $z^{*}_{P3}$ más allá de la tolerancia.`,
  );

  // 4 · Velocidad en el mayor |Vc|.
  const nMax = Math.max(...grid.customers);
  // Si P3 llega al límite en alguna instancia, su promedio (y la razón) es una cota inferior.
  const speed = hs.map((h) => {
    const g = B.summarizeGroup(instances, h, nMax).methods;
    const r = g.p3.meanTimeSec !== null && g.ils.meanTimeSec ? g.p3.meanTimeSec / g.ils.meanTimeSec : null;
    const capped = g.p3.done - g.p3.optimal;
    const note = capped > 0 ? `; P3 llega al límite en ${capped} de ${g.p3.done}` : '';
    return `${hText(h)}: ILS ${sec(g.ils.meanTimeSec)}\\,s por corrida frente a ${sec(g.p3.meanTimeSec)}\\,s de P3${r === null ? '' : ` (${capped > 0 ? 'al menos ' : ''}${ratio(r)} veces menos${note})`}`;
  });
  const dpMax = Math.max(...hs.map((h) => B.summarizeGroup(instances, h, nMax).methods.dp.meanTimeSec ?? 0));
  items.push(
    `\\textbf{Tiempo con $|V_c| = ${nMax}$.} ${speed.join('; ')}. Dos fases tarda a lo más ${sec(dpMax)}\\,s por instancia (ruta TSP + Algoritmo~2.1 + DP).`,
  );

  // Hallazgo 3: comprobación de la afirmación «nunca queda sobre z*_P3» antes de escribirla.
  const ilsMisses = hs.reduce((a, h) => {
    const s = B.summarizeOverall(instances, h).ils;
    return a + (s.withProvenRef - s.hitsProvenRef);
  }, 0);
  if (ilsMisses > 0) items[2] = items[2].replace(/ En ninguna instancia[^.]*\./, '');

  return ['\\begin{itemize}', ...items.map((i) => `  \\item ${i}`), '\\end{itemize}'].join('\n');
}

// ---------------------------------------------------------------------------------------------
// 2 · ¿Exacto o heurístico? (sección «Metaheurísticas»)
// ---------------------------------------------------------------------------------------------

const rows = A.buildInstances(meta, paper);
const sizes = A.gridOf(meta).sizes;
const DIRS: MetaDirection[] = ['1dir', '2dir'];
const DIR_TEX: Record<MetaDirection, string> = { '1dir': '1~dir.', '2dir': '2~dir.' };

const META_STYLE: Record<MetaMethod, string> = {
  twophase: 'color=cDos, mark=triangle*, thick, mark size=2.6pt',
  'ils-heuristic': 'color=cILS, mark=o, thick, densely dashed, mark options={solid}',
  'ils-exact': 'color=cILS, mark=*, thick',
  'its-heuristic': 'color=cITS, mark=square, thick, densely dashed, mark options={solid}',
  'its-exact': 'color=cITS, mark=square*, thick',
};

function metaFigure(): string {
  const byDir = Object.fromEntries(DIRS.map((d) => [d, A.summarizeByN(rows, d, paper, 'done')])) as Record<MetaDirection, A.NSummary[]>;
  const times = DIRS.flatMap((d) => byDir[d].flatMap((g) => A.META_METHODS.map((m) => g.methods[m].timeSec ?? 0)));
  const devs = DIRS.flatMap((d) => byDir[d].flatMap((g) => A.META_METHODS.map((m) => g.methods[m].devPct ?? 0)));
  const [tmin, tmax] = logRange(times, 1e-2);
  const dmax = Math.ceil(Math.max(...devs) + 0.5);
  const dmin = Math.min(0, Math.floor(Math.min(...devs)));
  const panel = (d: MetaDirection, view: 'dev' | 'time', first: boolean) => {
    const opts =
      view === 'dev'
        ? [`title={Desviación · ${DIR_TEX[d]}}`, `ymin=${dmin}, ymax=${dmax}`, 'ylabel={Desv. media (\\%)}']
        : [`title={Tiempo · ${DIR_TEX[d]}}`, `ymode=log, ymin=${tmin}, ymax=${tmax}`, 'ylabel={Tiempo medio (s)}'];
    if (first) opts.push('legend to name=leyMeta');
    const plots = A.META_METHODS.map((m) => {
      const pts = byDir[d].map((g): [number, number | null] => [g.n, view === 'dev' ? g.methods[m].devPct : g.methods[m].timeSec]);
      return `\\addplot[${META_STYLE[m]}] coordinates {${coords(pts, view === 'dev' ? -Infinity : 0)}};` + (first ? `\n\\addlegendentry{${META_INFO[m].label}}` : '');
    });
    return [`\\nextgroupplot[${opts.join(', ')}]`, ...plots].join('\n');
  };
  return [
    '\\begin{figure}[htbp]',
    '\\centering',
    '\\begin{tikzpicture}',
    '\\begin{groupplot}[',
    '  group style={group size=2 by 2, horizontal sep=1.6cm, vertical sep=2.3cm},',
    `  width=0.49\\linewidth, height=5.6cm, xmin=10, xmax=210, xtick={${sizes.join(',')}},`,
    '  xlabel={$|V_c|$}, grid=major, grid style={gray!18},',
    '  tick label style={font=\\footnotesize}, label style={font=\\small}, title style={font=\\small},',
    '  legend columns=5, legend style={font=\\footnotesize, draw=none, column sep=6pt},',
    ']',
    panel('1dir', 'dev', true),
    panel('2dir', 'dev', false),
    panel('1dir', 'time', false),
    panel('2dir', 'time', false),
    '\\end{groupplot}',
    '\\end{tikzpicture}',
    '',
    '\\smallskip',
    '\\pgfplotslegendfromname{leyMeta}',
    `\\caption{Desviación media respecto del \\emph{Best} del paper (arriba) y tiempo medio por instancia en segundos, escala logarítmica (abajo), según $|V_c|$, con una dirección (izquierda) y con dos (derecha). Mismas cifras que el Cuadro~\\ref{tab:metaheuristicas-resumen}. Trazo continuo y marca rellena: evaluación exacta del vecindario (Algoritmo~2.1 + DP); discontinuo y marca hueca: evaluación heurística lineal (\\S2.2).}`,
    '\\label{fig:metaheuristicas}',
    '\\end{figure}',
  ].join('\n');
}

/** Hallazgos de la sección «Metaheurísticas» (sobre las instancias que los cinco métodos terminaron). */
function metaFindings(): string {
  const ov = Object.fromEntries(DIRS.map((d) => [d, A.summarizeOverall(rows, d, paper, 'common')])) as Record<MetaDirection, Record<MetaMethod, A.MethodSummary>>;
  const items: string[] = [];
  const label = (m: MetaMethod) => META_INFO[m].label;

  // 1 · Menor desviación por dirección (nuestra y del paper).
  const bestOf = (d: MetaDirection, key: 'devPct' | 'paperDevPct') =>
    A.META_METHODS.reduce((b, m) => ((ov[d][m][key] ?? Infinity) < (ov[d][b][key] ?? Infinity) ? m : b), A.META_METHODS[0]);
  items.push(
    '\\textbf{Método con menor desviación.} ' +
      DIRS.map((d) => {
        const ours = bestOf(d, 'devPct');
        const pap = bestOf(d, 'paperDevPct');
        return `En ${DIR_TEX[d]}, ${label(ours)} (${pct(ov[d][ours].devPct)} respecto del \\emph{Best}; en el paper, ${label(pap)} con ${pct(ov[d][pap].paperDevPct)})`;
      }).join('. ') +
      '. Como en el paper, la familia ITS queda por delante del ILS y la evaluación exacta mejora a la heurística dentro de cada familia.',
  );
  // La última frase solo se deja si los datos la respaldan en ambas direcciones.
  const itsAhead = DIRS.every((d) => Math.max(ov[d]['its-exact'].devPct ?? Infinity, ov[d]['its-heuristic'].devPct ?? Infinity) < Math.min(ov[d]['ils-exact'].devPct ?? -Infinity, ov[d]['ils-heuristic'].devPct ?? -Infinity));
  const exactBetter = DIRS.every(
    (d) => (ov[d]['its-exact'].devPct ?? Infinity) < (ov[d]['its-heuristic'].devPct ?? -Infinity) && (ov[d]['ils-exact'].devPct ?? Infinity) < (ov[d]['ils-heuristic'].devPct ?? -Infinity),
  );
  if (!itsAhead || !exactBetter) items[0] = items[0].replace(/ Como en el paper,[^.]*\./, '');

  // 2 · Exacto / heurístico: razón de tiempos (1 dir.) frente a la del paper (Tabla 9).
  const t9 = paper.timeRowTable9;
  const famRatio = (fam: 'ils' | 'its') => {
    const e = ov['1dir'][`${fam}-exact`].timeSec;
    const h = ov['1dir'][`${fam}-heuristic`].timeSec;
    const ours = e !== null && h ? e / h : null;
    const pap = fam === 'ils' ? t9.ilsE1 / t9.ilsH1 : t9.itsE1 / t9.itsH1;
    return `${fam.toUpperCase()}: exacto ${sec(e)}\\,s frente a heurístico ${sec(h)}\\,s, ${ours === null ? '--' : ratio(ours)} veces (paper: ${ratio(pap)} veces, fila \\emph{Time (s)} de la Tabla~9)`;
  };
  items.push(`\\textbf{Costo de la evaluación exacta (1~dir.).} ${famRatio('ils')}; ${famRatio('its')}.`);

  // 3 · Efecto de la segunda dirección.
  const drop = A.META_METHODS.map((m) => {
    const d1 = ov['1dir'][m].devPct;
    const d2 = ov['2dir'][m].devPct;
    return `${label(m)} ${d1 === null || d2 === null ? '--' : `${num(d1)} $\\to$ ${num(d2)}`}`;
  });
  items.push(`\\textbf{De 1~dir.\\ a 2~dir.} La desviación media (\\%) baja en todos los métodos: ${listEs(drop)}; el tiempo de las metaheurísticas casi se duplica, igual que en el paper.`);
  const allDrop = A.META_METHODS.every((m) => (ov['2dir'][m].devPct ?? Infinity) <= (ov['1dir'][m].devPct ?? -Infinity));
  if (!allDrop) items[2] = items[2].replace(' baja en todos los métodos', ' cambia así');

  // 4 · Mejores que el Best del paper.
  const below = rows.filter((r) => r.ourBest !== null && r.best !== null && r.ourBest < r.best - E.Z_TOL);
  const bySize = sizes
    .map((n) => [n, below.filter((r) => r.n === n).length] as const)
    .filter(([, k]) => k > 0)
    .map(([n, k]) => `${k} con $|V_c| = ${n}$`);
  items.push(
    `\\textbf{Bajo el \\emph{Best} del paper.} En ${below.length} de ${rows.length} instancias alguna de nuestras corridas encuentra un valor menor que la mejor solución conocida publicada${bySize.length ? ` (${listEs(bySize)})` : ''}; ITS exacto con 2~dir.\\ lo logra en ${ov['2dir']['its-exact'].beatsBest}.`,
  );

  // 5 · Diferencias con el paper: cota de la diferencia de desviación en los métodos que la reproducen
  // y, en ITS exacto, cuántas veces mejora la solución inicial (alguna dirección) en cada mitad de la grilla.
  const itsE = ov['2dir']['its-exact'];
  const close: MetaMethod[] = ['twophase', 'ils-heuristic', 'ils-exact'];
  const maxGap = Math.max(...close.flatMap((m) => DIRS.map((d) => Math.abs((ov[d][m].devPct ?? 0) - (ov[d][m].paperDevPct ?? 0)))));
  const improves = (list: A.InstanceRow[]) => {
    const ours = list.filter((r) => r.cells['its-exact'].dir1?.improved || r.cells['its-exact'].dir2?.improved).length;
    const pap = list.filter(
      (r) => r.paper && (r.paper['its-exact'].z1 < r.paper.twophase.z1 - E.Z_TOL || r.paper['its-exact'].zRev < r.paper.twophase.zRev - E.Z_TOL),
    ).length;
    return { ours, pap, of: list.length };
  };
  const small = improves(rows.filter((r) => r.n < sizes[half]));
  const large = improves(rows.filter((r) => r.n >= sizes[half]));
  items.push(
    `\\textbf{Diferencia con el paper.} ${listEs(close.map(label))} reproducen las desviaciones del paper con diferencias menores a ${num(Math.floor(maxGap * 100 + 1) / 100)} puntos porcentuales en ambas direcciones. ITS exacto queda más lejos (${pct(itsE.devPct)} frente a ${pct(itsE.paperDevPct)} en 2~dir.): con $|V_c| \\geq ${sizes[half]}$ nuestra corrida mejora la solución inicial en ${large.ours} de ${large.of} instancias y la del paper en ${large.pap} de ${large.of} (con $|V_c| < ${sizes[half]}$, en ${small.ours} y ${small.pap} de ${small.of}).`,
  );

  return ['\\begin{itemize}', ...items.map((i) => `  \\item ${i}`), '\\end{itemize}'].join('\n');
}

/**
 * Detalle por instancia en el formato de las Tablas 8–9 del paper: |Vc| | Id | Best | por método
 * «1 dir.» (corrida desde el tour TSP) y «2 dir.» (desde el tour invertido, por sí sola). La segunda
 * parte cierra, como la Tabla 9, con el tiempo medio por columna de las 100 instancias y el del paper.
 */
function metaDetailTable(part: 1 | 2, partSizes: number[]): string {
  const cols = E.DETAIL_COLS;
  let star = false;
  const blocks = partSizes.map((n) => {
    const list = rows.filter((r) => r.n === n).sort((a, b) => a.id - b.id);
    return list
      .map((r, k) => {
        const zs = cols.map((c) => E.detailResult(r, c)?.z ?? null);
        const min = E.minOf(zs);
        const cells = zs.map((z) => {
          if (z === null) return '\\ldots';
          let s = num(z);
          if (min !== null && z <= min + E.Z_TOL) s = `\\textbf{${s}}`;
          if (r.best !== null && z < r.best - E.Z_TOL) {
            s += '$^{*}$';
            star = true;
          }
          return s;
        });
        return row([k === 0 ? String(n) : '', String(r.id), r.best === null ? '--' : num(r.best), ...cells]);
      })
      .join('\n');
  });
  const foot: string[] = [];
  if (part === 2) {
    const all = rows.filter((r) => sizes.includes(r.n));
    foot.push(
      '\\midrule',
      row(['\\multicolumn{3}{l}{Tiempo (s)}', ...cols.map((c) => sec(E.detailFoot(all, c).sec))]),
      row([
        '\\multicolumn{3}{l}{Paper (s)}',
        ...cols.map((c) => {
          const k = E.PAPER_TIME_COLS[c.method];
          return k ? sec(paper.timeRowTable9[k[c.dir - 1]]) : '--';
        }),
      ]),
    );
  }
  const range = `$|V_c| = ${partSizes[0]}$ a $${partSizes[partSizes.length - 1]}$`;
  const caption =
    part === 1
      ? `Resultados por instancia de dos fases, ILS e ITS ($N_{iter} = ${meta.meta?.params?.nIter ?? 200}$), en el formato de las Tablas~8--9 de Erdo\\u{g}an et al.~(2012) (primera parte: ${range}). Valor objetivo $z$; 1~dir.: corrida desde el tour TSP; 2~dir.: corrida desde el tour TSP invertido, por sí sola, como en el paper (el resultado con dos direcciones del Cuadro~\\ref{tab:metaheuristicas-resumen} es el mínimo de ambas columnas). Best: mejor solución conocida publicada en el paper. En negrita, el menor $z$ de la fila${star ? '; $^{*}$menor que el Best del paper' : ''}. Nuestra dirección~1 reproduce la orientación de la columna 1~dir.\\ del paper en ${rows.filter((r) => r.orientation === 'paper').length} de las ${rows.length} instancias; en las demás, la orientación por convención puede corresponder a la opuesta, lo que no afecta el mínimo de ambas columnas.`
      : `Resultados por instancia de dos fases, ILS e ITS en el formato de las Tablas~8--9 de Erdo\\u{g}an et al.~(2012) (segunda parte: ${range}); notación del Cuadro~\\ref{tab:metaheuristicas-detalle-1}${star ? '; $^{*}$menor que el Best del paper' : ''}. Tiempo (s): promedio de las ${rows.length} instancias por columna, en segundos de pared; ILS e ITS sin el tour TSP, dos fases con el tour TSP y la reubicación del depósito. Paper (s): fila \\emph{Time (s)} de su Tabla~9 (Intel Core~2 Quad de 2{,}83\\,GHz, código C; el paper no publica el tiempo de la solución inicial).`;
  return [
    '\\begin{table}[!htbp]',
    '\\centering',
    '\\scriptsize',
    '\\setlength{\\tabcolsep}{3.2pt}',
    `\\caption{${caption}}`,
    `\\label{tab:metaheuristicas-detalle-${part}}`,
    '\\resizebox{\\ifdim\\width>\\linewidth\\linewidth\\else\\width\\fi}{!}{%',
    `\\begin{tabular}{rrr${' rr'.repeat(A.META_METHODS.length)}}`,
    '\\toprule',
    row(['', '', '', ...A.META_METHODS.map((m) => `\\multicolumn{2}{c}{${META_INFO[m].label}}`)]),
    A.META_METHODS.map((_, i) => `\\cmidrule(lr){${4 + 2 * i}-${5 + 2 * i}}`).join(' '),
    row(['$|V_c|$', 'Id', 'Best', ...cols.map((c) => `${c.dir}~dir.`)]),
    '\\midrule',
    blocks.join('\n\\addlinespace\n'),
    ...foot,
    '\\bottomrule',
    '\\end{tabular}%',
    '}',
    '\\end{table}',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------------------------

const mm = meta.meta;
const nIter = mm?.params?.nIter ?? 200;
const nIterIts = mm?.params?.nIterIts ?? Math.floor(Math.sqrt(nIter));
const hBySize = sizes.map((n) => `${n}: ${tex(E.hLabel(E.hFor(n, rows.find((r) => r.n === n && r.h !== null)?.h ?? null, mm) ?? 0))}`);
const half = Math.ceil(sizes.length / 2);
const benchRecords = bench.records.length;
const metaRecords = meta.records.length;

const doc = String.raw`% Informe generado por scripts/build-report.ts (Página Web 12) a partir de Outputs/Benchmark y
% Outputs/BenchmarkErdogan2012. No editar a mano: vuelve a generarlo con
%   node scripts/build-report.ts
\documentclass[11pt,a4paper]{article}
\usepackage{iftex}
\ifPDFTeX
  \usepackage[T1]{fontenc}
  \usepackage{lmodern}
\else
  \usepackage{fontspec}
\fi
% Sin es-tabla: nuestras tablas son «Cuadro N», para no confundirlas con las «Tablas N» del paper.
\usepackage[spanish,es-noshorthands,es-nodecimaldot]{babel}
\usepackage[margin=2.2cm]{geometry}
\usepackage{booktabs,graphicx,pdflscape,afterpage,amsmath,microtype}
\usepackage[font=small,labelfont=bf]{caption}
\usepackage{xcolor}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\usepgfplotslibrary{groupplots}
\pgfplotsset{/pgf/number format/use comma, /pgf/number format/1000 sep={.}}
\usepackage[hidelinks]{hyperref}
\definecolor{cGeneral}{HTML}{71717A}
\definecolor{cP1}{HTML}{7C3AED}
\definecolor{cP2}{HTML}{4D7C0F}
\definecolor{cP3}{HTML}{0E7490}
\definecolor{cDos}{HTML}{D97706}
\definecolor{cILS}{HTML}{2563EB}
\definecolor{cITS}{HTML}{C026D3}
\setlength{\parskip}{0.45em}
\setlength{\parindent}{0pt}

\title{Benchmarks del TSPPD-H\\[4pt]\large Tiempos de cómputo de los modelos exactos y metaheurísticas ILS e ITS}
\author{Taller de Investigación}
\date{${today}}

\begin{document}
\maketitle

Este informe reúne los dos benchmarks de la Página Web~12. El primero, \emph{¿Cuánto tarda cada método?}, compara el tiempo de cómputo de los cuatro modelos exactos resueltos con Gurobi frente a la heurística de dos fases y al ILS, en las instancias de Battarra et al.~(2010) con 5 a 25 clientes. El segundo, \emph{¿Exacto o heurístico?}, replica las Tablas~8 y~9 de Erdo\u{g}an et al.~(2012): la solución inicial de dos fases y, a partir de ella, el ILS y el ITS con evaluación exacta o heurística del vecindario, en instancias de 20 a 200 clientes, con una y con dos direcciones del tour. Todas las cifras salen de los registros consolidados (${benchRecords} y ${metaRecords} ejecuciones, respectivamente) con las mismas funciones que usa la página, y las tablas son las que exporta su botón \emph{Copiar LaTeX}.

\tableofcontents

\section{¿Cuánto tarda cada método?}
\label{sec:tiempos}

\subsection{Configuración}
\begin{itemize}
  \item \textbf{Instancias:} Battarra et al.~(2010), $|V_c| \in \{${grid.customers.join(', ')}\}$, Id ${grid.ids[0]} a ${grid.ids[grid.ids.length - 1]}, con $h = h_a = h_b \in \{${hs.map((h) => num(h, h === 1 ? 0 : 1)).join('; ')}\}$: ${instances.length} combinaciones de instancia y $h$.
  \item \textbf{Modelos exactos (Gurobi ${texText(bm?.gurobi ?? '')}):} Modelo General y las formulaciones de las Políticas~1, 2 y~3 (TSPPD-H$_1$, H$_2$ y H$_3$), con límite de ${sec(timeLimit)}\,s y ${bm?.threads ?? 1} hilo por modelo (${bm?.workers ?? '--'} modelos en paralelo). El Modelo General solo se ejecuta hasta $|V_c| = ${bm?.generalMaxN ?? 10}$ por su alto costo computacional.
  \item \textbf{Dos fases:} ruta TSP con el depósito reubicado y, sobre ella, la manipulación óptima de la Política~3 con el Algoritmo~2.1 + DP.
  \item \textbf{ILS-2dir:} Algoritmo~4.2 de Erdo\u{g}an et al.~(2012) con evaluación exacta, $N_{iter} = ${bm?.ils?.nIter ?? 200}$ y ${bm?.ils?.runs ?? 10} corridas por instancia (se informa la mejor y el tiempo medio por corrida).
  \item \textbf{Equipo:} ${texText(bm?.cpu ?? '')}, ${texText(bm?.os ?? '')}, Python ${texText(bm?.python ?? '')}.
\end{itemize}
La desviación de las heurísticas se mide respecto de $z^{*}_{P3}$, el óptimo de la Política~3 probado por Gurobi; donde Gurobi no lo prueba, contra la mejor solución conocida de esa política (marca $^{\ddagger}$ en los cuadros).

\subsection{Resultados por número de clientes}
Los Cuadros~\ref{tab:tiempos-resumen-h0-1}, \ref{tab:tiempos-resumen-h0-5} y~\ref{tab:tiempos-resumen-h1} resumen cada $h$ por $|V_c|$, y la Figura~\ref{fig:tiempos} muestra los tiempos medios. El detalle por instancia está en el Anexo~\ref{anx:tiempos}.

${benchSummaryTables()}

${benchTimeFigure()}

\subsection{Hallazgos}
${benchFindings()}

\clearpage
\section{¿Exacto o heurístico? ILS e ITS con hasta 200 clientes}
\label{sec:metaheuristicas}

\subsection{Configuración}
\begin{itemize}
  \item \textbf{Instancias:} las de Erdo\u{g}an et al.~(2012), $|V_c| \in \{${sizes.join(', ')}\}$, Id 1 a 10 (${rows.length} instancias), con el $h = h_a = h_b$ que reproduce sus Tablas~8--9 (${hBySize.join('; ')}).
  \item \textbf{Métodos:} dos fases (la \emph{initial solution} del paper), ILS (Algoritmo~4.2) e ITS (Algoritmo~4.3) con evaluación heurística lineal del vecindario (\S2.2) o exacta (Algoritmo~2.1 + DP). ILS con $N_{iter} = ${nIter}$; ITS con $\lfloor\sqrt{N_{iter}}\rfloor = ${nIterIts}$ iteraciones externas de ${nIterIts} iteraciones de Tabu Search.
  \item \textbf{Direcciones:} 1~dir.\ es una corrida desde el tour TSP; 2~dir.\ es la mejor de esa corrida y de otra igual desde el tour invertido (Tabla~3 del paper). En el detalle por instancia, como en las Tablas~8--9, la columna 2~dir.\ es solo la corrida desde el tour invertido.
  \item \textbf{Equipo:} ${texText(mm?.cpu ?? '')}, ${texText(mm?.runtime ?? '')}, ${mm?.workers ?? '--'} ejecuciones en paralelo (un hilo cada una). El paper usó un Intel Core~2 Quad de 2{,}83\,GHz con código C: se comparan razones entre métodos, no segundos.
\end{itemize}
La desviación es $(z - \mathit{Best})/\mathit{Best} \cdot 100$, con $\mathit{Best}$ la mejor solución conocida publicada en las Tablas~8--9 del paper.

\subsection{Resumen por número de clientes}
El Cuadro~\ref{tab:metaheuristicas-resumen} pone las dos direcciones lado a lado, como las Tablas~3 y 8--9 del paper, y debajo de cada fila la cifra del paper con el mismo método y dirección. La Figura~\ref{fig:metaheuristicas} muestra las mismas cifras y los Cuadros~\ref{tab:metaheuristicas-detalle-1} y~\ref{tab:metaheuristicas-detalle-2} (Anexo~\ref{anx:metaheuristicas}) el detalle por instancia.

${landscape(tablesOf(E.toLatexSummary(rows, paper, meta)), `${metaFigure()}\n\\clearpage`)}

\subsection{Hallazgos}
${metaFindings()}

\clearpage
\appendix
\section{Tiempos: tabla comparativa por instancia}
\label{anx:tiempos}
Valor objetivo y tiempo de cada método en cada instancia, para cada $h$.

${benchComparisonTables()}

\clearpage
\section{Metaheurísticas: detalle por instancia}
\label{anx:metaheuristicas}

${metaDetailTable(1, sizes.slice(0, half))}

${metaDetailTable(2, sizes.slice(half))}

\end{document}
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, doc, 'utf-8');
console.log(`✓ ${path.relative(repo, outFile)} (${(doc.length / 1024).toFixed(0)} KB)`);
