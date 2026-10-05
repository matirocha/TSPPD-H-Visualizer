/**
 * Informe en LaTeX de los dos benchmarks de la página: «¿Cuánto tarda cada método?» (sección
 * «Tiempos») y «¿Exacto o heurístico? ILS e ITS con hasta 200 clientes» (sección «Metaheurísticas»).
 * Lee los consolidados de Outputs/Benchmark y Outputs/BenchmarkErdogan2012 y escribe
 * Outputs/Informe/informe_benchmarks.tex, un informe breve (poco texto) con:
 *  · las mismas tablas que «Copiar LaTeX» de la página (export.ts de cada sección), sin el envoltorio
 *    que las vuelve un documento propio y con un caption corto (recaption);
 *  · gráficos en pgfplots con las mismas cifras de las tablas (aggregate.ts de cada sección);
 *  · hallazgos de una frase, con cifras calculadas de los registros (nunca escritas a mano);
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
/** h como en los títulos: 1 sin decimales, 0,1 y 0,5 con uno. */
const hNum = (h: number) => num(h, h === 1 ? 0 : 1);
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
 * Cambia el \caption{…} de cada tabla de `tables` por el que arma `make` a partir del cuerpo de esa
 * tabla sin su caption (para anotar solo los símbolos que de verdad aparecen: ‡, §, *, †).
 */
function recaption(tables: string, make: (body: string) => string): string {
  let out = '';
  let from = 0;
  for (let at = tables.indexOf('\\caption{'); at !== -1; at = tables.indexOf('\\caption{', from)) {
    let depth = 0;
    let end = at + '\\caption'.length;
    for (; end < tables.length; end++) {
      if (tables[end] === '{') depth++;
      else if (tables[end] === '}' && --depth === 0) break;
    }
    const tableEnd = tables.indexOf('\\end{table}', end);
    const body = tables.slice(end + 1, tableEnd === -1 ? undefined : tableEnd);
    out += tables.slice(from, at) + `\\caption{${make(body)}}`;
    from = end + 1;
  }
  return out + tables.slice(from);
}

/** Primer |Vc| sin Modelo General (nota «§» de los cuadros de tiempos). */
const generalFrom = () => grid.customers.find((n) => n > (bench.meta?.generalMaxN ?? 10)) ?? null;

/** Notas de los símbolos de los cuadros de tiempos que aparecen en `body`. */
function benchNotes(body: string): string {
  const notes: string[] = [];
  if (body.includes('$^{*}$')) notes.push('$^{*}$~sin óptimo probado al llegar al límite (gap entre paréntesis)');
  if (body.includes('\\ddagger')) notes.push('$^{\\ddagger}$~P3 sin óptimo probado en parte de las instancias: se compara con su mejor solución conocida');
  const nGen = generalFrom();
  if (body.includes('\\S}') && nGen !== null) notes.push(`$^{\\S}$~n.e.: Modelo General no ejecutado con $|V_c| \\geq ${nGen}$`);
  return notes.length ? ` ${notes.join('; ')}.` : '';
}

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
      return recaption(
        tablesOf(BE.toLatexSummary(groups, overall, { h, timeLimitSec: timeLimit, timeLimits })),
        (body) =>
          `Resumen por $|V_c|$ con $h = ${hNum(h)}$. Gurobi: Ópt.\\ = instancias con óptimo probado (límite ${sec(timeLimit)}\\,s), Seg.\\ = tiempo medio (s). Heurísticas: Desv.\\ = desviación media (\\%) respecto de $z^{*}_{P3}$.` +
          benchNotes(body),
      );
    })
    .join('\n\n');
}

function benchComparisonTables(): string {
  return hs
    .map((h) => {
      const groups = B.summarizeByN(instances, h);
      const overall = B.summarizeOverall(instances, h, 'common');
      return recaption(
        tablesOf(BE.toLatexComparison(instances, groups, overall, { h, timeLimitSec: timeLimit, timeLimits })),
        (body) =>
          `Valor objetivo $z$ y tiempo (s) por instancia con $h = ${hNum(h)}$. ILS: mejor de ${bm?.ils?.runs ?? 10} corridas y tiempo medio por corrida. Prom.: Gurobi, óptimos $k/n$ y tiempo medio; heurísticas, desviación media (\\%) respecto de $z^{*}_{P3}$ y tiempo medio.` +
          benchNotes(body),
      );
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
    '\\begin{figure}[!t]',
    '\\centering',
    '\\begin{tikzpicture}',
    '\\begin{groupplot}[',
    '  group style={group size=3 by 1, horizontal sep=0.45cm, y descriptions at=edge left},',
    `  width=0.37\\linewidth, height=5.2cm, ymode=log, ymin=${ymin}, ymax=${ymax}, xmin=3, xmax=27, xtick={${xs}},`,
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
    `\\caption{Tiempo medio por instancia (s, escala log.) según $|V_c|$ para cada $h$. Línea gris: límite de Gurobi (${sec(timeLimit)}\\,s).}`,
    '\\label{fig:tiempos}',
    '\\end{figure}',
  ].join('\n');
}

/** Hallazgos de la sección «Tiempos»: una frase cada uno, con cifras calculadas de los registros. */
function benchFindings(): string {
  const hText = (h: number) => `$h = ${hNum(h)}$`;
  const items: string[] = [];

  // 1 · Hasta qué |Vc| resuelve cada modelo todas las instancias (y las de los tamaños menores).
  const solved = hs.map((h) => {
    const parts = B.GUROBI_METHODS.map((m) => `${BENCH_LABEL[m]} ${B.largestAllSolvedN(instances, m, h) ?? '--'}`);
    return `${hText(h)}: ${parts.join(', ')}`;
  });
  items.push(`\\textbf{Mayor $|V_c|$ con todo resuelto a optimalidad.} ${solved.join('; ')}.`);

  // 2 · Calidad de las heurísticas frente a z*_P3 probado.
  const quality = hs.map((h) => {
    const s = B.summarizeOverall(instances, h);
    return `${hText(h)}: ILS ${s.ils.hitsProvenRef}/${s.ils.withProvenRef}, dos fases ${s.dp.hitsProvenRef}/${s.dp.withProvenRef} (desv.\\ ${pct(s.dp.meanDevPct)})`;
  });
  items.push(`\\textbf{Instancias con óptimo probado en que la heurística alcanza $z^{*}_{P3}$.} ${quality.join('; ')}.`);

  // 3 · Velocidad en el mayor |Vc|. Si P3 llega al límite en alguna instancia, la razón es una cota inferior.
  const nMax = Math.max(...grid.customers);
  const speed = hs.map((h) => {
    const g = B.summarizeGroup(instances, h, nMax).methods;
    const r = g.p3.meanTimeSec !== null && g.ils.meanTimeSec ? g.p3.meanTimeSec / g.ils.meanTimeSec : null;
    const capped = g.p3.done > g.p3.optimal;
    return `${hText(h)}: ILS ${sec(g.ils.meanTimeSec)}\\,s frente a ${sec(g.p3.meanTimeSec)}\\,s de P3${r === null ? '' : ` (${capped ? '$\\geq$ ' : ''}$\\times$${ratio(r)})`}`;
  });
  items.push(`\\textbf{Tiempo con $|V_c| = ${nMax}$.} ${speed.join('; ')}.`);

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
    '  group style={group size=2 by 2, horizontal sep=1.6cm, vertical sep=1.9cm},',
    `  width=0.49\\linewidth, height=4.6cm, xmin=10, xmax=210, xtick={${sizes.join(',')}},`,
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
    `\\caption{Desviación media (\\%) respecto del \\emph{Best} del paper (arriba) y tiempo medio por instancia (s, escala log., abajo) según $|V_c|$, con 1 y 2 direcciones. Trazo continuo: evaluación exacta; discontinuo: heurística.}`,
    '\\label{fig:metaheuristicas}',
    '\\end{figure}',
  ].join('\n');
}

/** Hallazgos de la sección «Metaheurísticas» (instancias que los cinco métodos terminaron): una frase cada uno. */
function metaFindings(): string {
  const ov = Object.fromEntries(DIRS.map((d) => [d, A.summarizeOverall(rows, d, paper, 'common')])) as Record<MetaDirection, Record<MetaMethod, A.MethodSummary>>;
  const items: string[] = [];
  const label = (m: MetaMethod) => META_INFO[m].label;

  // 1 · Menor z medio por dirección (mismas instancias para todos los métodos), con su desviación y la del
  // paper, y en cuántas instancias alguna corrida nuestra queda bajo el Best del paper.
  const below = rows.filter((r) => r.ourBest !== null && r.best !== null && r.ourBest < r.best - E.Z_TOL).length;
  const bestOf = (d: MetaDirection) => A.META_METHODS.reduce((b, m) => ((ov[d][m].avgZ ?? Infinity) < (ov[d][b].avgZ ?? Infinity) ? m : b), A.META_METHODS[0]);
  items.push(
    '\\textbf{Mejor método.} ' +
      DIRS.map((d) => {
        const m = bestOf(d);
        return `${DIR_TEX[d]}: ${label(m)}, $z$ medio ${num(ov[d][m].avgZ)} (desv.\\ ${pct(ov[d][m].devPct)}; paper ${pct(ov[d][m].paperDevPct)})`;
      }).join('; ') +
      `. Bajo el \\emph{Best} del paper en ${below} de ${rows.length} instancias.`,
  );

  // 2 · Exacto / heurístico: razón de tiempos (1 dir.) frente a la del paper (Tabla 9).
  const t9 = paper.timeRowTable9;
  const famRatio = (fam: 'ils' | 'its') => {
    const e = ov['1dir'][`${fam}-exact`].timeSec;
    const h = ov['1dir'][`${fam}-heuristic`].timeSec;
    const pap = fam === 'ils' ? t9.ilsE1 / t9.ilsH1 : t9.itsE1 / t9.itsH1;
    return `${fam.toUpperCase()} $\\times$${e !== null && h ? ratio(e / h) : '--'} (paper $\\times$${ratio(pap)})`;
  };
  items.push(`\\textbf{Costo de la evaluación exacta frente a la heurística (1~dir.).} ${famRatio('ils')}; ${famRatio('its')}.`);

  // 3 · Efecto de la segunda dirección: rango de la baja (%) del z medio entre los cinco métodos.
  const drops = A.META_METHODS.map((m) => {
    const z1 = ov['1dir'][m].avgZ;
    const z2 = ov['2dir'][m].avgZ;
    return z1 && z2 !== null ? ((z1 - z2) / z1) * 100 : null;
  }).filter((d): d is number => d !== null);
  // «Casi se duplica» solo si la razón de tiempos 2 dir. / 1 dir. de las cuatro metaheurísticas está entre 1,6 y 2,2.
  const doubles = A.META_METHODS.filter((m) => m !== 'twophase').every((m) => {
    const t1 = ov['1dir'][m].timeSec;
    const t2 = ov['2dir'][m].timeSec;
    return t1 !== null && t2 !== null && t1 > 0 && t2 / t1 >= 1.6 && t2 / t1 <= 2.2;
  });
  if (drops.length)
    items.push(
      `\\textbf{De 1 a 2~dir.} El $z$ medio baja entre ${pct(Math.min(...drops))} y ${pct(Math.max(...drops))} según el método` +
        (doubles ? '; en ILS e ITS el tiempo casi se duplica.' : '.'),
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
    `Detalle por instancia (${range}), formato de las Tablas~8--9 de Erdo\\u{g}an et al.~(2012): $z$ de cada método; 1~dir.: desde el tour TSP; 2~dir.: desde el tour invertido. En negrita, el menor $z$ de la fila` +
    (star ? '; $^{*}$~menor que el Best del paper.' : '.') +
    (part === 2 ? ' Tiempo (s): media de las ' + rows.length + ' instancias; Paper (s): fila \\emph{Time (s)} de su Tabla~9.' : '');
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

/** Resumen por |Vc| de las metaheurísticas (el de «Copiar LaTeX») con un caption corto. */
function metaSummaryTable(): string {
  return recaption(tablesOf(E.toLatexSummary(rows, paper, meta)), (body) => {
    const notes = [
      'Entre paréntesis, la cifra del paper con el mismo método y dirección',
      ...(body.includes('$\\approx$') ? ['$\\approx$: tiempo estimado (2 $\\times$ 1~dir.)'] : []),
      ...(body.includes('\\dagger') ? ['$^{\\dagger}$~promedio parcial'] : []),
    ];
    return `Valor objetivo medio $z$ y tiempo medio por instancia (s) según $|V_c|$, con 1 y 2 direcciones. ${notes.join('; ')}. En negrita, el menor $z$ medio de la fila en cada dirección.`;
  });
}

// ---------------------------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------------------------

const mm = meta.meta;
const nIter = mm?.params?.nIter ?? 200;
const nIterIts = mm?.params?.nIterIts ?? Math.floor(Math.sqrt(nIter));
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
\usepackage{booktabs,graphicx,pdflscape,amsmath,microtype}
\usepackage[font=small,labelfont=bf]{caption}
\usepackage{xcolor}
\usepackage{placeins}
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
% Páginas solo de tablas (continuaciones, anexos): arriba, no centradas en la página.
\makeatletter
\setlength{\@fptop}{0pt}
\makeatother

\title{Benchmarks del TSPPD-H\\[4pt]\large Tiempos de cómputo de los modelos exactos y metaheurísticas ILS e ITS}
\author{Taller de Investigación}
\date{${today}}

\begin{document}
\maketitle

Resultados de los dos benchmarks de la Página Web~12, calculados de los registros consolidados (${benchRecords} y ${metaRecords} ejecuciones). Las tablas son las de \emph{Copiar LaTeX} de la página.

\section{¿Cuánto tarda cada método?}
\label{sec:tiempos}

Instancias de Battarra et al.~(2010) con $|V_c| \in \{${grid.customers.join(', ')}\}$, 10 por tamaño, y $h = h_a = h_b \in \{${hs.map(hNum).join('; ')}\}$. Gurobi ${texText(bm?.gurobi ?? '')} con límite de ${sec(timeLimit)}\,s y ${bm?.threads ?? 1} hilo por modelo; dos fases = ruta TSP + Algoritmo~2.1 + DP; ILS-2dir con $N_{iter} = ${bm?.ils?.nIter ?? 200}$. Equipo: ${texText(bm?.cpu ?? '')}.

${benchSummaryTables()}

${benchTimeFigure()}

\FloatBarrier
${benchFindings()}

\section{¿Exacto o heurístico? ILS e ITS con hasta 200 clientes}
\label{sec:metaheuristicas}

Instancias de Erdo\u{g}an et al.~(2012) con $|V_c| = ${sizes[0]}$ a $${sizes[sizes.length - 1]}$ (${rows.length} en total). ILS con $N_{iter} = ${nIter}$ e ITS con ${nIterIts} iteraciones externas; evaluación del vecindario heurística (lineal, \S2.2) o exacta (Algoritmo~2.1 + DP). 1~dir.: desde el tour TSP; 2~dir.: la mejor de esa corrida y otra desde el tour invertido. Equipo: ${texText(mm?.cpu ?? '')}, ${texText(mm?.runtime ?? '')}; el paper usó un Core~2 Quad de 2{,}83\,GHz, así que se comparan razones de tiempo, no segundos.

${metaFigure()}

\FloatBarrier
${metaFindings()}

\clearpage
\begin{landscape}
${metaSummaryTable()}
\end{landscape}

\clearpage
\appendix
\section{Tiempos: detalle por instancia}
\label{anx:tiempos}

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
