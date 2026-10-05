/**
 * Modelos de las tablas de la sección «Metaheurísticas» y su exportación a LaTeX y CSV.
 *  · summaryModel: modelo de la tabla «Resumen por |Vc|» (lo usan la tarjeta MetaSummaryTable, el
 *    LaTeX y el CSV, para que las tres muestren exactamente las mismas cifras).
 *  · toLatexSummary: una fila por |Vc| + «Prom.» con la desviación media (%) respecto del Best del
 *    paper y los segundos medios de los cinco métodos, y entre paréntesis la cifra del paper
 *    (estilo Erdoğan et al. 2012, Tablas 2–3), lista para pegar en la tesis (booktabs).
 *  · toCsvSummary: el mismo resumen en CSV (una o ambas direcciones).
 *  · toCsvInstances: una fila por instancia con Z y segundos de cada método y las cifras del paper.
 *  · Detalle por instancia (Tablas 8–9): columnas «1 dir.» / «2 dir.» de cada método, lecturas de
 *    nuestro Z y del paper, pie de cada columna (tiempo medio, Δ) y toLatexMetaDetail; lo usan la
 *    tarjeta MetaDetailTable y scripts/validate-metaheuristics.ts.
 * Los números de LaTeX van en formato es-CL con la coma decimal protegida (4{,}89); los CSV usan
 * «;» como separador y «.» decimal, como el CSV de la sección «Tiempos».
 */
import type { MetaDirection, MetaFile, MetaMethod, MetaMeta, PaperFile } from '../../types/metaheuristics';
import { fmtAuto, fmtDelta } from '../../lib/format.ts';
import { fmtNum, fmtSec } from '../benchmark/format.ts';
import {
  META_METHODS,
  devPct,
  paperZOf,
  summarizeByN,
  summarizeOverall,
  type DirResult,
  type InstanceRow,
  type MethodSummary,
} from './aggregate.ts';
import { META_INFO } from './labels.ts';

// ---------------------------------------------------------------------------------------------
// Modelo del resumen (compartido con la tarjeta)
// ---------------------------------------------------------------------------------------------

/**
 * h de cada |Vc| que reproduce los números del paper: 20/|Vc| exacto cuando lo es (1 · 0,5 · 0,125 ·
 * 0,1), redondeado a 2 decimales cuando no (0,33 · 0,17 · 0,14 · 0,11) y, en 80 y 100, la mitad
 * (0,125 y 0,1). Respaldo cuando aún no hay registros ni meta.h en el consolidado.
 */
export const PAPER_H: Readonly<Record<number, number>> = {
  20: 1,
  40: 0.5,
  60: 0.33,
  80: 0.125,
  100: 0.1,
  120: 0.17,
  140: 0.14,
  160: 0.125,
  180: 0.11,
  200: 0.1,
};

/** h sin ceros sobrantes y con hasta 3 decimales (0,125 no se redondea a 0,13). */
export const hLabel = (h: number) => fmtAuto(h, 3);

/**
 * Tiempo promedio de un método exacto en 1dir según las dos tablas del paper que lo publican: la
 * fila «Avg.» de la Tabla 2 (media de sus filas por |Vc|) y la fila «Time (s)» de la Tabla 9. El
 * paper no es consistente en ITS exacto (491,79 s frente a 471,79 s; en ILS exacto ambas dan
 * 1.002,61 s). null si coinciden (a 2 decimales) o si no hay cifras.
 */
export function paperTimeMismatch(paper: PaperFile | null, method: MetaMethod): { table2: number; table9: number } | null {
  if (!paper?.averages || !paper.timeRowTable9) return null;
  const pair =
    method === 'ils-exact'
      ? [paper.averages.ilsExact1dirTimeSec, paper.timeRowTable9.ilsE1]
      : method === 'its-exact'
        ? [paper.averages.itsExact1dirTimeSec, paper.timeRowTable9.itsE1]
        : null;
  if (!pair) return null;
  const [table2, table9] = pair;
  if (!Number.isFinite(table2) || !Number.isFinite(table9) || Math.abs(table2 - table9) < 0.005) return null;
  return { table2, table9 };
}

export interface SummaryCell {
  method: MetaMethod;
  /** Resumen de aggregate.ts (scope 'done' por |Vc|; 'common' en Prom.). */
  s: MethodSummary;
  /** Instancias del grupo (10 por |Vc|; todas en Prom.). */
  instances: number;
  /** Ejecuciones con error de este método en el grupo (no entran en los promedios). */
  errors: number;
  /**
   * Desviación media del paper (mismo método y dirección). Sobre las mismas instancias que la
   * nuestra; si aún no terminó ninguna, sobre todas las del grupo (`paperDevAll`).
   */
  paperDev: number | null;
  paperDevAll: boolean;
  /** Segundos del paper (ver MethodSummary.paperTimeSec); null si no se publican. */
  paperTime: number | null;
  /** Tiempo del paper estimado: 2dir por |Vc| = 2 × el de 1dir de la Tabla 2. */
  paperTimeEstimated: boolean;
  /** Menor desviación de la fila (solo si todos los métodos promedian la misma cantidad de instancias). */
  best: boolean;
}

export interface SummaryRow {
  /** null en la fila «Prom.». */
  n: number | null;
  h: number | null;
  instances: number;
  /** Todas las instancias del grupo tienen los cinco métodos en esta dirección. */
  complete: boolean;
  cells: Record<MetaMethod, SummaryCell>;
}

export interface SummaryModel {
  dir: MetaDirection;
  byN: SummaryRow[];
  /** Fila «Prom.»: summarizeOverall(…, 'common'), las instancias que todos los métodos terminaron. */
  overall: SummaryRow;
  totalInstances: number;
  /** Instancias que promedia «Prom.» (las que todos los métodos ya terminaron en esta dirección). */
  commonInstances: number;
}

/** Promedio, o null sin valores. */
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Desviación media del paper sobre todas las instancias de `list` que están en el paper. */
function paperDevOver(list: InstanceRow[], m: MetaMethod, dir: MetaDirection): number | null {
  const devs: number[] = [];
  for (const r of list) {
    if (!r.paper) continue;
    const d = devPct(paperZOf(r.paper[m], dir), r.best);
    if (d !== null) devs.push(d);
  }
  return mean(devs);
}

/** Métodos con la menor desviación (a 2 decimales), si las columnas son comparables. */
function markBest(cells: Record<MetaMethod, SummaryCell>) {
  const done = META_METHODS.map((m) => cells[m].s.done);
  const devs = META_METHODS.map((m) => cells[m].s.devPct);
  if (!done.every((d) => d > 0 && d === done[0]) || devs.some((d) => d === null)) return;
  const key = (d: number) => Math.round(d * 100);
  const min = Math.min(...devs.map((d) => key(d as number)));
  for (const m of META_METHODS) cells[m].best = key(cells[m].s.devPct as number) === min;
}

function makeRow(
  n: number | null,
  h: number | null,
  list: InstanceRow[],
  methods: Record<MetaMethod, MethodSummary>,
  dir: MetaDirection,
  complete: boolean,
): SummaryRow {
  const cells = {} as Record<MetaMethod, SummaryCell>;
  for (const m of META_METHODS) {
    const s = methods[m];
    const fallback = s.done === 0;
    const paperDev = fallback ? paperDevOver(list, m, dir) : s.paperDevPct;
    cells[m] = {
      method: m,
      s,
      instances: list.length,
      errors: list.reduce((a, r) => a + r.cells[m].errors, 0),
      paperDev,
      paperDevAll: fallback && paperDev !== null,
      paperTime: s.paperTimeSec,
      // Por |Vc| el paper solo publica 1dir (Tabla 2); la fila Prom. usa la fila «Time (s)» de la Tabla 9 (ambas columnas).
      paperTimeEstimated: n !== null && dir === '2dir' && s.paperTimeSec !== null,
      best: false,
    };
  }
  markBest(cells);
  return { n, h, instances: list.length, complete, cells };
}

const finiteH = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** h de un |Vc|: el de los registros, el de meta.h o el de las Tablas 8–9 (PAPER_H). */
export function hFor(n: number, fromRows: number | null, meta?: MetaMeta | null): number | null {
  if (finiteH(fromRows)) return fromRows;
  const fromMeta = meta?.h?.[String(n)];
  if (finiteH(fromMeta)) return fromMeta;
  return PAPER_H[n] ?? null;
}

/** Filas por |Vc| (summarizeByN, scope 'done') y «Prom.» (summarizeOverall, scope 'common'). */
export function summaryModel(rows: InstanceRow[], paper: PaperFile | null, dir: MetaDirection, file?: MetaFile | null): SummaryModel {
  const meta = file?.meta ?? null;
  const byN = summarizeByN(rows, dir, paper, 'done').map((g) =>
    makeRow(
      g.n,
      hFor(g.n, g.h, meta),
      rows.filter((r) => r.n === g.n),
      g.methods,
      dir,
      g.complete,
    ),
  );
  const overallMethods = summarizeOverall(rows, dir, paper, 'common');
  const common = overallMethods[META_METHODS[0]].done;
  const overall = makeRow(null, null, rows, overallMethods, dir, rows.length > 0 && common === rows.length);
  return { dir, byN, overall, totalInstances: rows.length, commonInstances: common };
}

// ---------------------------------------------------------------------------------------------
// LaTeX
// ---------------------------------------------------------------------------------------------

/**
 * Cadena es-CL de los formateadores → LaTeX: 4,89 → 4{,}89; −0,3 → $-$0{,}3; +0,12 → $+$0{,}12;
 * «< 0,01» → $<$\,0{,}01; «4,2 %» → 4{,}2\,\%.
 */
function texNum(s: string): string {
  if (s === '—') return '--';
  return s
    .replace(/,/g, '{,}')
    .replace(/−/g, '$-$')
    .replace(/\+/g, '$+$')
    .replace(/<[  ]?/g, '$<$\\,')
    .replace(/[  ]%/g, '\\,\\%')
    .replace(/(^|[^\\])%/g, '$1\\%')
    .replace(/ /g, '~');
}

const texDev = (p: number | null) => texNum(fmtNum(p, 2));
const texSec = (s: number | null) => texNum(fmtSec(s));
const texH = (h: number | null) => (h === null ? '--' : texNum(hLabel(h)));
const row = (cells: string[]) => cells.join(' & ') + ' \\\\';

const PENDING = '\\ldots';
const DAGGER = '$^{\\dagger}$';
const ERDOGAN = 'Erdo\\u{g}an et al.~(2012)';

/** \cmidrule de cada bloque de 2 columnas, desde la columna `start`. */
const cmidrules = (blocks: number, start: number) =>
  Array.from({ length: blocks }, (_, i) => `\\cmidrule(lr){${start + 2 * i}-${start + 2 * i + 1}}`).join(' ');

interface TexFlags {
  partial: boolean;
  errors: number;
  estimated: boolean;
  /** Alguna desviación del paper se promedió sobre todo el tamaño (aún sin resultados nuestros). */
  paperAll: boolean;
}

/** Desv. y Seg. de un método: la nuestra (negrita si es la mejor de la fila) y, entre paréntesis, la del paper. */
function texCells(c: SummaryCell, flags: TexFlags, prom = false): [string, string] {
  const paperSmall = (s: string) => ` {\\scriptsize(${s})}`;
  // Los errores se cuentan en las filas por |Vc|; la fila Prom. no los vuelve a sumar.
  if (!prom) flags.errors += c.errors;
  let dev: string;
  let sec: string;
  if (c.s.done === 0) {
    dev = PENDING;
    sec = PENDING;
  } else {
    dev = texDev(c.s.devPct);
    if (c.best) dev = `\\textbf{${dev}}`;
    // En Prom. la parcialidad la explica el caption («solo las k de N instancias»).
    if (!prom && c.s.done < c.instances) {
      dev += DAGGER;
      flags.partial = true;
    }
    sec = texSec(c.s.timeSec);
  }
  if (c.paperDev !== null) {
    if (c.paperDevAll) flags.paperAll = true;
    dev += paperSmall(texDev(c.paperDev));
  }
  if (c.paperTime !== null) {
    if (c.paperTimeEstimated) flags.estimated = true;
    sec += paperSmall((c.paperTimeEstimated ? '$\\approx$' : '') + texSec(c.paperTime));
  }
  return [dev, sec];
}

const DIR_TEXT: Record<MetaDirection, string> = {
  '1dir': 'una dirección (1dir: corrida desde el tour TSP)',
  '2dir': 'dos direcciones (2dir: la mejor de las corridas desde el tour TSP y desde el tour invertido)',
};

/**
 * Resumen por |Vc| en una dirección: |Vc| | h | por método «Desv. (%)» y «Seg.», con la cifra del
 * paper entre paréntesis; al final, «Prom.» sobre las instancias que todos los métodos terminaron.
 * `file` (opcional) aporta el hardware, el runtime y Niter para el caption.
 */
export function toLatexSummary(rows: InstanceRow[], paper: PaperFile | null, dir: MetaDirection, file?: MetaFile | null): string {
  const model = summaryModel(rows, paper, dir, file);
  const flags: TexFlags = { partial: false, errors: 0, estimated: false, paperAll: false };
  const body = model.byN.map((r) =>
    row([String(r.n), texH(r.h), ...META_METHODS.flatMap((m) => texCells(r.cells[m], flags))]),
  );
  const prom = row(['\\multicolumn{2}{l}{Prom.}', ...META_METHODS.flatMap((m) => texCells(model.overall.cells[m], flags, true))]);
  const nCols = 2 + META_METHODS.length * 2;

  const meta = file?.meta ?? null;
  const nIter = meta?.params?.nIter ?? 200;
  const nIterIts = meta?.params?.nIterIts ?? Math.floor(Math.sqrt(nIter));
  const machine = meta
    ? ` Nuestros tiempos: segundos de pared en ${meta.runtime}${meta.cpu ? ` (${meta.cpu})` : ''}, ${meta.workers} ejecuciones en paralelo (\\emph{worker threads} de Node.js), un hilo cada una.`
    : '';
  const partialProm = model.commonInstances < model.totalInstances;
  // Fila «Time (s)» de la Tabla 9: solo con las 100 instancias del paper terminadas (summarizeOverall).
  const promPaperTime = META_METHODS.some((m) => model.overall.cells[m].paperTime !== null);
  const itsGap = model.overall.cells['its-exact'].paperTime !== null ? paperTimeMismatch(paper, 'its-exact') : null;
  const paperTimeText =
    '; tiempo publicado: por $|V_c|$ solo para ILS e ITS exactos en una dirección (Tabla~2' +
    (flags.estimated ? '; $\\approx$: en 2dir, estimado como el doble' : '') +
    '); en Prom., para los cuatro ILS e ITS, fila \\emph{Time (s)} de la Tabla~9, promedio de sus 100 instancias' +
    (dir === '2dir' ? ' (en 2dir, suma de sus dos columnas)' : '') +
    (paper && !promPaperTime ? ', que se muestra solo cuando cada método terminó esas 100 instancias' : '') +
    (itsGap
      ? `. Para ITS exacto en una dirección el paper no es consistente: la Tabla~9 da ${texNum(fmtNum(itsGap.table9, 2))}\\,s y la fila \\emph{Avg.} de la Tabla~2, ${texNum(fmtNum(itsGap.table2, 2))}\\,s, sobre las mismas instancias; en Prom. se usa la Tabla~9`
      : '') +
    '. El paper midió en un Intel Core~2 Quad de 2{,}83\\,GHz con código C, por lo que los tiempos no son comparables 1:1 entre máquinas.';

  const caption =
    `Desviación media (\\%) respecto de la mejor solución conocida y tiempo medio por instancia (s), por número de clientes $|V_c|$, con ${DIR_TEXT[dir]}` +
    ` de cinco métodos en las instancias de ${ERDOGAN} (10 por tamaño; por dirección, ILS con $N_{iter} = ${nIter}$ e ITS con` +
    ` $\\lfloor\\sqrt{N_{iter}}\\rfloor = ${nIterIts}$ iteraciones externas).` +
    ` Desv.\\ $= (z - \\mathit{Best})/\\mathit{Best} \\cdot 100$, con $\\mathit{Best}$ la mejor solución conocida publicada en las Tablas~8--9 de ${ERDOGAN}.` +
    ' Seg.: incluye el tour TSP' +
    (dir === '2dir' ? ' y las corridas de ambas direcciones.' : '.') +
    machine +
    ' Dos fases: tour TSP con el depósito reubicado y manipulación óptima (Algoritmo~2.1 + DP), la \\emph{initial solution} del paper;' +
    ' ILS (Algoritmo~4.2) e ITS (Algoritmo~4.3) heurísticos evalúan el vecindario con la estimación lineal (\\S2.2) y los exactos con el Algoritmo~2.1 + DP.' +
    ` Entre paréntesis, la cifra del paper con el mismo método y dirección: desviación sobre las mismas instancias` +
    (flags.paperAll ? ' (sobre todas las del tamaño mientras no haya resultados nuestros)' : '') +
    paperTimeText +
    ' En negrita, la menor desviación de la fila.' +
    (flags.partial ? ` ${DAGGER}~Promedio parcial: el benchmark aún no termina todas las instancias de ese tamaño.` : '') +
    (flags.errors === 1 ? ' Se excluye 1 ejecución con error.' : flags.errors > 1 ? ` Se excluyen ${flags.errors} ejecuciones con error.` : '') +
    (partialProm
      ? ` Prom.: solo las ${model.commonInstances} de ${model.totalInstances} instancias que todos los métodos ya terminaron, para comparar las columnas sobre el mismo conjunto.`
      : '');

  return [
    '% Tabla generada por la Página Web 12 (sección «Metaheurísticas»). Requiere \\usepackage{booktabs,graphicx}.',
    '\\begin{table}[htbp]',
    '\\centering',
    '\\small',
    `\\caption{${caption}}`,
    `\\label{tab:metaheuristicas-resumen-${dir}}`,
    '\\resizebox{\\textwidth}{!}{%',
    `\\begin{tabular}{rr${' rr'.repeat(META_METHODS.length)}}`,
    '\\toprule',
    row(['', '', ...META_METHODS.map((m) => `\\multicolumn{2}{c}{${META_INFO[m].label}}`)]),
    cmidrules(META_METHODS.length, 3),
    row(['$|V_c|$', '$h$', ...META_METHODS.flatMap(() => ['Desv.\\,(\\%)', 'Seg.'])]),
    '\\midrule',
    ...(body.length ? body : [`\\multicolumn{${nCols}}{c}{Sin datos} \\\\`]),
    '\\midrule',
    prom,
    '\\bottomrule',
    '\\end{tabular}%',
    '}',
    '\\end{table}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Detalle por instancia (Tablas 8–9)
// ---------------------------------------------------------------------------------------------

/** Vista de la tabla de detalle: nuestros Z, las cifras del paper o nuestro − paper. */
export type MetaDetailView = 'ours' | 'paper' | 'delta';
/** Columna «1 dir.» (corrida desde el tour TSP) o «2 dir.» (desde el tour invertido, por sí sola). */
export type DetailDir = 1 | 2;

export interface DetailCol {
  method: MetaMethod;
  dir: DetailDir;
  key: string;
}

/** Las 10 columnas de las Tablas 8–9, en su orden: cada método con «1 dir.» y «2 dir.». */
export const DETAIL_COLS: readonly DetailCol[] = META_METHODS.flatMap((method) =>
  ([1, 2] as const).map((dir): DetailCol => ({ method, dir, key: `${method}-${dir}` })),
);

/** Tolerancia de las comparaciones de Z con las cifras del paper (publicadas con 2 decimales). */
export const Z_TOL = 0.005;

type PaperTimeKey = keyof PaperFile['timeRowTable9'];
/** Columnas de la fila «Time (s)» de la Tabla 9 (el paper no publica el tiempo de la solución inicial). */
export const PAPER_TIME_COLS: Partial<Record<MetaMethod, readonly [PaperTimeKey, PaperTimeKey]>> = {
  'ils-heuristic': ['ilsH1', 'ilsH2'],
  'ils-exact': ['ilsE1', 'ilsE2'],
  'its-heuristic': ['itsH1', 'itsH2'],
  'its-exact': ['itsE1', 'itsE2'],
};

type ColRef = { method: MetaMethod; dir: DetailDir };

/** Nuestro resultado en esa columna (null: pendiente o con error). */
export const detailResult = (r: InstanceRow, c: ColRef): DirResult | null => (c.dir === 1 ? r.cells[c.method].dir1 : r.cells[c.method].dir2);

/** Cifra del paper en esa columna: «1 dir.» = z1, «2 dir.» = la corrida desde el tour invertido (zRev). */
export const detailPaper = (r: InstanceRow, c: ColRef): number | null =>
  r.paper ? (c.dir === 1 ? r.paper[c.method].z1 : r.paper[c.method].zRev) : null;

/** Segundos de una columna: ILS e ITS, la dirección sin el tour TSP; dos fases, tour TSP + reubicación del depósito. */
export const detailSec = (r: InstanceRow, c: { method: MetaMethod }, res: DirResult) =>
  c.method === 'twophase' ? (r.tspSec ?? 0) + res.sec : res.sec;

/** Mínimo de los valores presentes (null si no hay ninguno). */
export function minOf(xs: readonly (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.min(...v) : null;
}

/** Pie de una columna del detalle sobre las instancias de un |Vc|. */
export interface DetailFoot {
  /** Segundos medios de la columna (detailSec) y en cuántas instancias. */
  sec: number | null;
  secDone: number;
  /** Diferencia media nuestro − paper y conteos con Z menor / mayor que el paper (± Z_TOL). */
  delta: number | null;
  better: number;
  worse: number;
  compared: number;
}

export function detailFoot(list: readonly InstanceRow[], c: DetailCol): DetailFoot {
  const secs: number[] = [];
  const deltas: number[] = [];
  let better = 0;
  let worse = 0;
  for (const r of list) {
    const res = detailResult(r, c);
    if (!res) continue;
    secs.push(detailSec(r, c, res));
    const pz = detailPaper(r, c);
    if (pz === null) continue;
    const d = res.z - pz;
    deltas.push(d);
    if (d < -Z_TOL) better++;
    else if (d > Z_TOL) worse++;
  }
  return { sec: mean(secs), secDone: secs.length, delta: mean(deltas), better, worse, compared: deltas.length };
}

/**
 * Tabla de detalle de un |Vc| en LaTeX (booktabs), en la vista elegida: Id | Best | por método
 * «1 dir.» y «2 dir.» y, al pie, el tiempo medio (o la fila «Time (s)» de la Tabla 9 en la vista Paper).
 */
export function toLatexMetaDetail(
  rows: readonly InstanceRow[],
  opts: { n: number; view: MetaDetailView; paper: PaperFile | null; h?: number | null },
): string {
  const { n, view, paper } = opts;
  const list = rows.filter((r) => r.n === n).sort((a, b) => a.id - b.id);
  const inPaper = list.some((r) => r.paper !== null);
  const tableNo = inPaper ? (n <= 100 ? '8' : '9') : '8--9';
  let star = false;
  let pending = false;
  let errors = false;

  const body = list.map((r) => {
    const min =
      view === 'paper' ? minOf(DETAIL_COLS.map((c) => detailPaper(r, c))) : minOf(DETAIL_COLS.map((c) => detailResult(r, c)?.z ?? null));
    const cells = DETAIL_COLS.map((c) => {
      const res = detailResult(r, c);
      const pz = detailPaper(r, c);
      if (view === 'paper') {
        if (pz === null) return '--';
        const s = texNum(fmtNum(pz, 2));
        return min !== null && pz <= min + Z_TOL ? `\\textbf{${s}}` : s;
      }
      if (!res) {
        if (r.cells[c.method].errors > 0) {
          errors = true;
          return '\\textit{error}';
        }
        pending = true;
        return PENDING;
      }
      if (view === 'delta') return pz === null ? '--' : texNum(fmtDelta(res.z - pz, 2));
      let s = texNum(fmtNum(res.z, 2));
      if (min !== null && res.z <= min + Z_TOL) s = `\\textbf{${s}}`;
      if (r.best !== null && res.z < r.best - Z_TOL) {
        s += '$^{*}$';
        star = true;
      }
      return s;
    });
    return row([String(r.id), r.best === null ? '--' : texNum(fmtNum(r.best, 2)), ...cells]);
  });

  const foot: string[] = [];
  if (view === 'paper') {
    if (paper)
      foot.push(
        row([
          'Time (s)',
          '',
          ...DETAIL_COLS.map((c) => {
            const k = PAPER_TIME_COLS[c.method];
            return k ? texSec(paper.timeRowTable9[k[c.dir - 1]]) : '--';
          }),
        ]),
      );
  } else {
    const fs = DETAIL_COLS.map((c) => detailFoot(list, c));
    if (view === 'delta')
      foot.push(row(['$\\Delta$ prom.', '', ...fs.map((f) => (f.compared ? texNum(fmtDelta(f.delta as number, 2)) : PENDING))]));
    foot.push(
      row([
        'Tiempo (s)',
        '',
        ...DETAIL_COLS.map((c, i) => (fs[i].secDone ? texSec(fs[i].sec) + (c.method === 'twophase' ? DAGGER : '') : PENDING)),
      ]),
    );
  }

  const h = opts.h ?? null;
  const where = `$|V_c| = ${n}$` + (h !== null ? ` y $h_a = h_b = ${texH(h)}$` : '');
  const dirs =
    ' 1~dir.: corrida desde el tour TSP; 2~dir.: corrida desde el tour TSP invertido, por sí sola (el resultado con dos direcciones es el mínimo de ambas columnas).' +
    ' Best: mejor solución conocida publicada en el paper.';
  // Orientación: solo las filas «paper» tienen la dirección 1 alineada con la columna 1 dir. del paper.
  const aligned = list.filter((r) => r.orientation === 'paper').map((r) => r.id);
  const unaligned = list.filter(
    (r) => r.orientation !== 'paper' && META_METHODS.some((m) => r.cells[m].dir1 !== null || r.cells[m].dir2 !== null),
  ).length;
  const orientation = (delta: boolean) =>
    unaligned === 0
      ? ''
      : ' Orientación: ' +
        (aligned.length
          ? `en ${aligned.length === 1 ? 'la instancia' : 'las instancias'} ${aligned.join(', ')} nuestra dirección~1 reproduce la solución inicial de la columna 1~dir. del paper (mismo tour en la misma orientación); en las demás,`
          : 'con este tamaño nuestro tour no reproduce ninguna solución inicial del paper, así que') +
        ' la dirección~1 es la orientación por convención y sus columnas pueden corresponder a las opuestas del paper' +
        (delta ? ', de modo que $\\Delta$ puede reflejar la orientación y no la calidad' : '') +
        ' (el mínimo de ambas direcciones no depende de ella).';
  const ourTime =
    ' Tiempo (s): promedio por columna en segundos de pared; ILS e ITS: solución inicial + metaheurística de esa dirección, sin el tour TSP;' +
    ` ${DAGGER}dos fases: tour TSP + reubicación del depósito.`;
  const marks = (pending ? ` ${PENDING}: pendiente.` : '') + (errors ? ' \\textit{error}: la ejecución falló.' : '');
  const caption =
    view === 'paper'
      ? `Cifras publicadas en la Tabla ${tableNo} de ${ERDOGAN} con ${where}.${dirs} En negrita, el menor valor de la fila.` +
        (paper ? ' Time (s): fila de la Tabla 9, promedio de las 100 instancias de las Tablas 8--9 (Intel Core 2 Quad 2{,}83~GHz).' : '')
      : view === 'delta'
        ? `Diferencia nuestro $-$ paper del valor objetivo por instancia con ${where}, columna a columna (Tabla ${tableNo} de ${ERDOGAN}).${dirs}` +
          ' Negativo: nuestro $Z$ es menor (mejor). $\\Delta$ prom.: diferencia media de la columna.' +
          orientation(true) +
          ourTime +
          marks
        : `Valor objetivo $Z$ por instancia con ${where}, en el formato de la Tabla ${tableNo} de ${ERDOGAN}.${dirs} En negrita, el menor $Z$ de la fila.` +
          (star ? ' $^{*}$Menor que el Best del paper.' : '') +
          orientation(false) +
          ourTime +
          marks;

  const nCols = 2 + DETAIL_COLS.length;
  return [
    '% Tabla generada por la Página Web 12 (sección «Metaheurísticas»). Requiere \\usepackage{booktabs,graphicx}.',
    '\\begin{table}[htbp]',
    '\\centering',
    '\\small',
    `\\caption{${caption}}`,
    `\\label{tab:metaheuristicas-detalle-n${n}${view === 'ours' ? '' : `-${view}`}}`,
    '\\resizebox{\\textwidth}{!}{%',
    `\\begin{tabular}{rr${' rr'.repeat(META_METHODS.length)}}`,
    '\\toprule',
    row(['', '', ...META_METHODS.map((m) => `\\multicolumn{2}{c}{${META_INFO[m].label}}`)]),
    cmidrules(META_METHODS.length, 3),
    row(['Id', 'Best', ...DETAIL_COLS.map((c) => `${c.dir}~dir.`)]),
    '\\midrule',
    ...(body.length ? body : [`\\multicolumn{${nCols}}{c}{Sin instancias} \\\\`]),
    ...(foot.length ? ['\\midrule', ...foot] : []),
    '\\bottomrule',
    '\\end{tabular}%',
    '}',
    '\\end{table}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

/** Redondea para que el CSV no arrastre ruido de coma flotante (2005.0700000000002). */
const round = (v: number | null | undefined, decimals: number) =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** decimals) / 10 ** decimals;

function csvValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
  else if (typeof v === 'boolean') s = v ? 'true' : 'false';
  else s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv = (header: string[], lines: unknown[][]) =>
  [header.join(';'), ...lines.map((l) => l.map(csvValue).join(';'))].join('\r\n') + '\r\n';

/** Prefijo de columnas de un método: ils-exact → ils_exact. */
const col = (m: MetaMethod) => m.replace(/-/g, '_');

/**
 * Resumen por |Vc| y «Prom.» (n = «prom», solo instancias comunes) en CSV. Sin `dir`, ambas
 * direcciones apiladas (columna dir). Desviaciones en %, tiempos en segundos.
 */
export function toCsvSummary(rows: InstanceRow[], paper: PaperFile | null, dir?: MetaDirection, file?: MetaFile | null): string {
  const dirs: MetaDirection[] = dir ? [dir] : ['1dir', '2dir'];
  const header = [
    'dir',
    'n',
    'h',
    'instances',
    'complete',
    ...META_METHODS.flatMap((m) =>
      ['done', 'errors', 'dev_pct', 'avg_z', 'time_sec', 'paper_dev_pct', 'paper_dev_all', 'paper_time_sec', 'paper_time_estimated', 'improved', 'beats_paper', 'beats_best', 'best'].map(
        (k) => `${col(m)}_${k}`,
      ),
    ),
  ];
  const lines: unknown[][] = [];
  for (const d of dirs) {
    const model = summaryModel(rows, paper, d, file);
    for (const r of [...model.byN, model.overall]) {
      lines.push([
        d,
        r.n ?? 'prom',
        r.h,
        r.n === null ? model.commonInstances : r.instances,
        r.complete,
        ...META_METHODS.flatMap((m) => {
          const c = r.cells[m];
          return [
            c.s.done,
            c.errors,
            round(c.s.devPct, 4),
            round(c.s.avgZ, 4),
            round(c.s.timeSec, 4),
            round(c.paperDev, 4),
            c.paperDevAll,
            round(c.paperTime, 4),
            c.paperTimeEstimated,
            c.s.improved,
            c.s.beatsPaper,
            c.s.beatsBest,
            c.best,
          ];
        }),
      ]);
    }
  }
  return csv(header, lines);
}

/**
 * Una fila por instancia (todas las de la grilla, también las pendientes, con celdas vacías):
 * n, id, h, Best del paper, tour TSP y, por método, z1 (1dir), zrev (corrida desde el tour
 * invertido, sola), z2 (2dir = mín. de ambas), t1 y t2 (segundos con el tour TSP), dev1 y dev2
 * (% vs Best), errores y las cifras del paper (z1, zrev = «2 dir.» de las Tablas 8–9, z2, dev1, dev2).
 */
export function toCsvInstances(rows: InstanceRow[]): string {
  const header = [
    'n',
    'id',
    'h',
    'best',
    'our_best',
    'orientation',
    'tsp_length',
    'tsp_sec',
    ...META_METHODS.flatMap((m) =>
      ['z1', 'zrev', 'z2', 't1', 't2', 'dev1', 'dev2', 'errors', 'paper_z1', 'paper_zrev', 'paper_z2', 'paper_dev1', 'paper_dev2'].map(
        (k) => `${col(m)}_${k}`,
      ),
    ),
  ];
  const lines = [...rows]
    .sort((a, b) => a.n - b.n || a.id - b.id)
    .map((r) => [
      r.n,
      r.id,
      r.h ?? PAPER_H[r.n] ?? null,
      r.best,
      r.ourBest,
      r.orientation,
      r.tspLength,
      round(r.tspSec, 6),
      ...META_METHODS.flatMap((m) => {
        const c = r.cells[m];
        const p = r.paper?.[m] ?? null;
        return [
          c.z1,
          c.dir2?.z ?? null,
          c.z2,
          round(c.t1, 6),
          round(c.t2, 6),
          round(devPct(c.z1, r.best), 4),
          round(devPct(c.z2, r.best), 4),
          c.errors,
          p?.z1 ?? null,
          p?.zRev ?? null,
          p?.z2 ?? null,
          round(p ? devPct(p.z1, r.best) : null, 4),
          round(p ? devPct(p.z2, r.best) : null, 4),
        ];
      }),
    ]);
  return csv(header, lines);
}
