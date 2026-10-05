/**
 * Exportación de las tablas de tiempos: LaTeX (booktabs, con reservas para pegarlo en cualquier
 * documento; ver lib/latex.ts) para el informe y CSV con los registros.
 *  · toLatexComparison: una fila por Id dentro de cada |Vc|, con z y segundos de cada método
 *    y una fila «Prom.» por |Vc| (la tabla comparativa principal de la sección).
 *  · toLatexSummary: una fila por |Vc| + «Prom.» (estilo Erdoğan et al. 2012, Tabla 2).
 *  · toLatexDetail:  una fila por instancia (estilo Battarra et al. 2010, Tablas 2–4).
 * Los números van en formato es-CL con la coma decimal protegida para LaTeX (349{,}7).
 */
import type { BenchMethod, BenchRecord, BenchmarkFile, ILSRecord } from '../../types/benchmark';
import {
  METHOD_ORDER,
  benchKey,
  cellOf,
  gridOf,
  hKey,
  instancesOf,
  isGurobiMethod,
  sameH,
  type BenchInstance,
  type Cell,
  type GroupStats,
  type MethodStats,
} from './aggregate.ts';
import { fmtNum, fmtPctValue, fmtSec, fmtZ } from './format.ts';
import { texTable } from '../../lib/latex.ts';

// ---------------------------------------------------------------------------------------------
// Utilidades LaTeX (todo el texto es fijo; solo los números pasan por texNum)
// ---------------------------------------------------------------------------------------------

/** Convierte una cadena de los formateadores (es-CL) a LaTeX: 349,7 → 349{,}7; «4,2 %» → 4{,}2\,\%. */
function texNum(s: string): string {
  if (s === '—') return '--';
  return s
    .replace(/,/g, '{,}')
    .replace(/−/g, '$-$')
    .replace(/< ?/g, '$<$\\,')
    .replace(/ %/g, '\\,\\%')
    .replace(/(^|[^\\])%/g, '$1\\%')
    .replace(/ /g, '~');
}

const texH = (h: number) => texNum(fmtNum(h, Number.isInteger(h) ? 0 : (hKey(h).split('.')[1] ?? '').length));
const texSec = (s: number | null) => texNum(fmtSec(s));
const texZ = (z: number | null) => texNum(fmtZ(z));
const texPct = (p: number | null, decimals = 1) => texNum(fmtPctValue(p, decimals));
/** Desviación en una columna cuyo encabezado ya dice (\%). */
const texDev = (p: number | null) => texNum(fmtNum(p, 2));
const labelOf = (h: number) => hKey(h).replace(/\./g, '-');

const PENDING = '\\ldots';
const NONE = '--';
const DAGGER = '$^{\\dagger}$';
/** Desviación medida (en parte) contra una referencia que no es z*_P3 probado. */
const DDAGGER = '$^{\\ddagger}$';
/** Varias marcas en un solo superíndice ($^{\ddagger\dagger}$), sin «$$» entre ellas. */
const marks = (unproven: boolean, partial: boolean) =>
  unproven || partial ? `$^{${unproven ? '\\ddagger' : ''}${partial ? '\\dagger' : ''}}$` : '';
const LATEX_METHOD: Record<BenchMethod, string> = {
  general: 'General',
  p1: 'Política 1',
  p2: 'Política 2',
  p3: 'Política 3',
  dp: 'Dos fases',
  ils: 'ILS',
};

/** «a», «a y b», «a, b y c». */
const listEs = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Límite de Gurobi; si los registros mezclan límites (`all` con más de uno), se dicen todos. */
const timeLimitText = (t: number | null, all?: number[]) =>
  all && all.length > 1
    ? ` Límites de tiempo de Gurobi: ${listEs(all.map(texSec))}\\,s según la ejecución (se mezclan corridas con distinto límite).`
    : t === null
      ? ''
      : ` Límite de tiempo de Gurobi: ${texSec(t)}\\,s por modelo.`;

const UNPROVEN_NOTE =
  'Gurobi P3 no probó (o aún no prueba) el óptimo de parte de esas instancias: se comparan con la mejor solución conocida de la' +
  ' Política 3, que puede ser la del propio método, y el valor puede cambiar.';

/** \cmidrule de cada bloque de columnas, empezando en la columna `start`. */
function cmidrules(widths: number[], start = 2): string {
  let col = start;
  return widths
    .map((w) => {
      const rule = `\\cmidrule(lr){${col}-${col + w - 1}}`;
      col += w;
      return rule;
    })
    .join(' ');
}

const row = (cells: string[]) => cells.join(' & ') + ' \\\\';

// ---------------------------------------------------------------------------------------------
// Tabla resumen por |Vc|
// ---------------------------------------------------------------------------------------------

/** Modelo no ejecutado por su alto costo computacional (registros 'skipped'). */
const SECT = '$^{\\S}$';
/** Columnas de un método que no se ejecutó en todo el grupo: un bloque «n.e.§». */
const notRun = (width: number) => `\\multicolumn{${width}}{c}{\\textit{n.e.}${SECT}}`;

interface Flags {
  partial: boolean;
  unproven: boolean;
  skipped: boolean;
}

/** Nota «§» de los captions: desde qué |Vc| no se ejecuta el Modelo General. */
const skippedNote = (from: number | null) =>
  ` ${SECT}~n.e.: Modelo General no ejecutado` +
  (from !== null ? ` con $|V_c| \\geq ${from}$` : '') +
  ' por su alto costo computacional (formulación indexada por posiciones de carga); en los totales, solo sus instancias ejecutadas.';

/** Menor |Vc| cuyo grupo no ejecutó el Modelo General (para la nota «§»). */
const skippedFromGroups = (groups: GroupStats[]) =>
  groups.find((g) => g.methods.general.skipped > 0 && g.methods.general.expected === 0)?.numCustomers ?? null;

/**
 * Celdas «resumen» de un método en un grupo: Gurobi → óptimas k/n y segundos medios; heurísticas →
 * desviación media (%) y segundos medios. Anota en `flags` si hubo datos parciales (†),
 * desviaciones contra referencias no probadas (‡) o instancias no ejecutadas (§). Un método que no
 * se ejecutó en todo el grupo devuelve UNA celda que ocupa sus dos columnas.
 */
function statCells(s: MethodStats, onlyOptimal: boolean, flags: Flags): string[] {
  if (s.skipped > 0) flags.skipped = true;
  if (s.expected === 0 && s.skipped > 0) return [notRun(2)];
  if (s.done === 0) return [PENDING, PENDING];
  const mark = s.done < s.expected ? DAGGER : '';
  if (s.done < s.expected) flags.partial = true;
  const sect = s.skipped > 0 ? SECT : '';
  if (isGurobiMethod(s.method)) return [`${s.optimal}/${s.expected}${mark}${sect}`, texSec(onlyOptimal ? s.meanTimeOptimalSec : s.meanTimeSec)];
  // ‡: parte de las desviaciones no es contra z*_P3 probado (P3 sin óptimo o aún sin correr).
  const unproven = s.meanDevPct !== null && s.withRef > s.withProvenRef;
  if (unproven) flags.unproven = true;
  return [texDev(s.meanDevPct) + marks(unproven, s.done < s.expected), texSec(s.meanTimeSec)];
}

/**
 * Resumen por |Vc| para un h: General/P1/P2/P3 → «Ópt.» (k/n) y «Seg.»; dos fases e ILS →
 * «Desv. (%)» respecto de la referencia de la Política 3 y «Seg.». Grupos incompletos llevan †.
 * `timeMode` (como el selector «Tiempo medio» de la tabla web): 'all' (por defecto) promedia todo
 * lo terminado y las ejecuciones que tocaron el límite cuentan con su tiempo (Erdoğan); 'optimal'
 * promedia solo las resueltas a optimalidad (Battarra, «Avg. seconds»).
 */
export function toLatexSummary(
  groups: GroupStats[],
  overall: Record<BenchMethod, MethodStats>,
  opts: { h: number; timeLimitSec: number | null; timeMode?: 'all' | 'optimal'; timeLimits?: number[] },
): string {
  const onlyOptimal = opts.timeMode === 'optimal';
  const flags: Flags = { partial: false, unproven: false, skipped: false };
  const cellsFor = (s: MethodStats) => statCells(s, onlyOptimal, flags);
  const body = groups.map((g) => row([String(g.numCustomers), ...METHOD_ORDER.flatMap((m) => cellsFor(g.methods[m]))]));
  const total = row(['Prom.', ...METHOD_ORDER.flatMap((m) => cellsFor(overall[m]))]);
  const nCols = 1 + METHOD_ORDER.length * 2;
  const h = texH(opts.h);
  // «Prom.» sobre menos instancias que las filas: solo las que todos los métodos ya terminaron.
  const rowsInst = groups.reduce((a, g) => a + g.instances, 0);
  const promInst = instancesOf(overall);

  const caption =
    `Tiempo de cómputo y calidad por número de clientes $|V_c|$ para $h = h_a = h_b = ${h}$.` +
    timeLimitText(opts.timeLimitSec, opts.timeLimits) +
    ' Modelos Gurobi: \\emph{Ópt.} = instancias resueltas a optimalidad; \\emph{Seg.} = tiempo medio en segundos' +
    (onlyOptimal
      ? ' de las ejecuciones resueltas a optimalidad (-- si ninguna).'
      : ' sobre las ejecuciones terminadas (las que alcanzan el límite cuentan con su tiempo).') +
    ' Heurísticas: \\emph{Desv.} = desviación media (\\%) respecto de $z^{*}_{P3}$, el óptimo de la Política 3 probado por Gurobi;' +
    ' ILS: desviación de la mejor de sus corridas y tiempo medio por corrida.' +
    (flags.unproven ? ` ${DDAGGER}~${UNPROVEN_NOTE}` : '') +
    (flags.partial ? ` ${DAGGER}~Datos parciales: el benchmark aún no termina ese grupo.` : '') +
    (flags.skipped ? skippedNote(skippedFromGroups(groups)) : '') +
    (promInst < rowsInst
      ? ` Prom.: solo las ${promInst} de ${rowsInst} instancias que todos los métodos ya terminaron, para comparar las columnas sobre el mismo conjunto.`
      : '');

  return texTable({
    section: 'Tiempos',
    setup: ['\\small', '\\setlength{\\tabcolsep}{4pt}'],
    caption,
    label: `tab:tiempos-resumen-h${labelOf(opts.h)}`,
    spec: `r${' rr'.repeat(METHOD_ORDER.length)}`,
    rows: [
      '\\toprule',
      row(['', ...METHOD_ORDER.map((m) => `\\multicolumn{2}{c}{${LATEX_METHOD[m]}}`)]),
      cmidrules(METHOD_ORDER.map(() => 2)),
      row(['$|V_c|$', ...METHOD_ORDER.flatMap((m) => (isGurobiMethod(m) ? ['Ópt.', 'Seg.'] : ['Desv.\\,(\\%)', 'Seg.']))]),
      '\\midrule',
      ...(body.length ? body : [`\\multicolumn{${nCols}}{c}{Sin datos} \\\\`]),
      '\\midrule',
      total,
      '\\bottomrule',
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Tabla comparativa completa: una fila por Id dentro de cada |Vc|, con z y segundos por método
// ---------------------------------------------------------------------------------------------

/** z y Seg. de una ejecución. Gurobi sin óptimo probado: z con asterisco y el gap junto al tiempo. */
function compareCells(c: Cell): string[] {
  switch (c.state) {
    case 'skipped':
      return ['', ''];
    case 'pending':
      return [PENDING, PENDING];
    case 'error':
      return ['err.', NONE];
    case 'no_solution':
      return [NONE, texSec(c.timeSec)];
    case 'optimal':
    case 'heuristic':
      return [texZ(c.objective), texSec(c.timeSec)];
    case 'feasible':
      return [texZ(c.objective) + '$^{*}$', texSec(c.timeSec) + (c.gapPct === null ? '' : `\\,{\\scriptsize(${texPct(c.gapPct, 1)})}`)];
  }
}

/**
 * Filas por parte de la tabla comparativa para que cada una quepa en una página: la primera, con el
 * caption (largo y siempre en \normalsize), 2 bloques de 10 Id + «Prom.»; las continuaciones, 3.
 */
const COMPARISON_PART_ROWS = { first: 22, rest: 33 };

/**
 * Tabla comparativa para un h: por cada |Vc| una fila por Id con z y Seg. de los seis métodos y
 * una fila «Prom.» (Gurobi: óptimas k/n y segundos medios; heurísticas: desviación media respecto
 * de la Política 3 y segundos medios); al final, «Total» sobre `overall` (las instancias que todos
 * los métodos terminaron). En vez de longtable (otro paquete en el preámbulo, y se salía del margen)
 * los bloques de |Vc| se reparten en tablas de hasta COMPARISON_PART_ROWS filas, cada una con el
 * encabezado y reducida al ancho de línea; la segunda en adelante dice «Tabla N (continuación)».
 */
export function toLatexComparison(
  instances: BenchInstance[],
  groups: GroupStats[],
  overall: Record<BenchMethod, MethodStats>,
  opts: { h: number; timeLimitSec: number | null; timeMode?: 'all' | 'optimal'; timeLimits?: number[] },
): string {
  const onlyOptimal = opts.timeMode === 'optimal';
  const flags: Flags = { partial: false, unproven: false, skipped: false };
  const nCols = 2 + METHOD_ORDER.length * 2;
  const ilsRuns = instances.map((i) => (i.records.ils as ILSRecord | undefined)?.runs).find((r): r is number => typeof r === 'number');

  // Un bloque por |Vc| (filas por Id, regla y «Prom.»), repartidos en partes sin pasar de COMPARISON_PART_ROWS filas.
  const parts: { lines: string[]; rows: number }[][] = [];
  for (const g of groups) {
    const insts = instances.filter((i) => sameH(i.h, opts.h) && i.numCustomers === g.numCustomers).sort((a, b) => a.instanceId - b.instanceId);
    const block = {
      lines: [
        ...insts.map((inst, k) => row([k === 0 ? String(g.numCustomers) : '', String(inst.instanceId), ...METHOD_ORDER.flatMap((m) => compareCells(cellOf(inst, m)))])),
        '\\cmidrule(l){2-' + nCols + '}',
        row(['', '\\emph{Prom.}', ...METHOD_ORDER.flatMap((m) => statCells(g.methods[m], onlyOptimal, flags))]),
      ],
      rows: insts.length + 1,
    };
    const last = parts[parts.length - 1];
    const limit = parts.length === 1 ? COMPARISON_PART_ROWS.first : COMPARISON_PART_ROWS.rest;
    if (last && last.reduce((a, b) => a + b.rows, 0) + block.rows <= limit) last.push(block);
    else parts.push([block]);
  }
  if (!parts.length) parts.push([]);
  const total = row(['\\multicolumn{2}{l}{Total}', ...METHOD_ORDER.flatMap((m) => statCells(overall[m], onlyOptimal, flags))]);
  const rowsInst = groups.reduce((a, g) => a + g.instances, 0);
  const promInst = instancesOf(overall);
  const h = texH(opts.h);

  const caption =
    `Valor objetivo $z$ y tiempo de cómputo por instancia para $h = h_a = h_b = ${h}$.` +
    timeLimitText(opts.timeLimitSec, opts.timeLimits) +
    ' $z$: costo total (ruteo + manipulación); Seg.: tiempo en segundos (Gurobi: \\emph{Runtime}, sin construir el modelo).' +
    ' $z^{*}$: mejor solución entera al alcanzar el límite, sin óptimo probado; entre paréntesis, el gap con la cota inferior.' +
    ' --: sin solución entera.' +
    ` Dos fases: ruta TSP con el depósito reubicado y, sobre ella, la manipulación óptima de la Política 3 con el Algoritmo~2.1\\,+\\,DP; ILS: mejor $z$ de ${ilsRuns ?? 'sus'} corridas y tiempo medio por corrida.` +
    ' Filas \\emph{Prom.}: en los modelos Gurobi, instancias resueltas a optimalidad ($k/n$) y tiempo medio' +
    (onlyOptimal ? ' de las resueltas a optimalidad;' : ' de las ejecuciones terminadas (las que alcanzan el límite cuentan con su tiempo);') +
    ' en las heurísticas, desviación media (\\%) respecto de $z^{*}_{P3}$ y tiempo medio.' +
    (flags.unproven ? ` ${DDAGGER}~${UNPROVEN_NOTE}` : '') +
    (flags.partial ? ` ${DAGGER}~Datos parciales: el benchmark aún no termina ese grupo.` : '') +
    (flags.skipped ? skippedNote(skippedFromGroups(groups)) : '') +
    (promInst < rowsInst ? ` Total: solo las ${promInst} de ${rowsInst} instancias que todos los métodos ya terminaron.` : '');

  const head = [
    '\\toprule',
    row(['', '', ...METHOD_ORDER.map((m) => `\\multicolumn{2}{c}{${LATEX_METHOD[m]}}`)]),
    cmidrules(METHOD_ORDER.map(() => 2), 3),
    row(['$|V_c|$', 'Id', ...METHOD_ORDER.flatMap(() => ['$z$', 'Seg.'])]),
    '\\midrule',
  ];

  return parts
    .map((part, i) =>
      texTable({
        section: 'Tiempos',
        setup: ['\\footnotesize', '\\setlength{\\tabcolsep}{3pt}'],
        caption,
        label: `tab:tiempos-comparativa-h${labelOf(opts.h)}`,
        spec: `rr${' rr'.repeat(METHOD_ORDER.length)}`,
        continued: i > 0,
        rows: [
          ...head,
          ...(part.length ? part.flatMap((b, j) => (j ? ['\\midrule', ...b.lines] : b.lines)) : [`\\multicolumn{${nCols}}{c}{Sin datos} \\\\`]),
          ...(i === parts.length - 1 ? ['\\midrule', total] : []),
          '\\bottomrule',
        ],
      }),
    )
    .join('\n');
}

// ---------------------------------------------------------------------------------------------
// Tabla por instancia (Battarra et al. 2010, Tablas 2–4)
// ---------------------------------------------------------------------------------------------

/** Columnas por método en la tabla de detalle. */
const DETAIL_HEAD: Record<BenchMethod, string[]> = {
  general: ['$z$', 'Seg.'],
  p1: ['$z$', '$z^{H}$', 'Seg.'],
  p2: ['$z$', '$z^{H}$', 'Seg.'],
  p3: ['$z$', '$z^{H}$', 'Seg.'],
  dp: ['$z$', 'Desv.\\,(\\%)', 'Seg.'],
  ils: ['$z$', 'Desv.\\,(\\%)', 'Seg.'],
};

function detailCells(c: Cell, unproven: boolean): string[] {
  const width = DETAIL_HEAD[c.method].length;
  const fill = (first: string, rest: string) => [first, ...Array.from({ length: width - 1 }, () => rest)];
  const withHandling = width === 3 && isGurobiMethod(c.method);
  switch (c.state) {
    case 'skipped':
      return fill('', '');
    case 'pending':
      return fill(PENDING, PENDING);
    case 'error':
      return fill('err.', NONE);
    case 'no_solution':
      return fill(NONE, NONE);
    case 'optimal':
      return withHandling ? [texZ(c.objective), texZ(c.handling), texSec(c.timeSec)] : [texZ(c.objective), texSec(c.timeSec)];
    case 'feasible': {
      const z = texZ(c.objective) + '$^{*}$';
      const gap = c.gapPct === null ? NONE : texPct(c.gapPct, 1);
      return withHandling ? [z, texZ(c.handling), gap] : [z, gap];
    }
    case 'heuristic':
      return [texZ(c.objective), texDev(c.devPct) + (unproven && c.devPct !== null ? DDAGGER : ''), texSec(c.timeSec)];
  }
}

/** Valor del pie en un bloque de columnas de un método. */
const span = (m: BenchMethod, text: string) => `\\multicolumn{${DETAIL_HEAD[m].length}}{c}{${text}}`;

/**
 * Detalle para un h y un |Vc|: Id | General z, Seg. | P1 z, z^H, Seg. | P2 … | P3 … |
 * Dos fases z, Desv., Seg. | ILS z, Desv., Seg. Gurobi no óptimo: z con asterisco y la brecha
 * en «Seg.»; sin solución «--»; pendiente «\ldots». Pie: # resueltas, Seg. prom., Desv. prom.
 */
export function toLatexDetail(
  instances: BenchInstance[],
  opts: { h: number; n: number; timeLimitSec: number | null; timeLimits?: number[] },
): string {
  const insts = instances.filter((i) => sameH(i.h, opts.h) && i.numCustomers === opts.n).sort((a, b) => a.instanceId - b.instanceId);
  const cells = insts.map((inst) => METHOD_ORDER.map((m) => cellOf(inst, m)));
  const byMethod = (m: BenchMethod) => cells.map((r) => r[METHOD_ORDER.indexOf(m)]);
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const isUnproven = (i: BenchInstance) => i.ref !== null && !i.ref.proven;
  const body = insts.map((inst, k) => row([String(inst.instanceId), ...cells[k].flatMap((c) => detailCells(c, isUnproven(inst)))]));
  const unproven = insts.some((i, k) => isUnproven(i) && cells[k].some((c) => !isGurobiMethod(c.method) && c.devPct !== null));

  // Un método sin ninguna ejecución terminada no tiene pie («\ldots»); con alguna pendiente, † en el conteo.
  const noneDone = (m: BenchMethod) => byMethod(m).every((c) => c.state === 'pending');
  // Método no ejecutado en todo el tamaño (alto costo computacional): su pie es «n.e.§».
  const allSkipped = (m: BenchMethod) => cells.length > 0 && byMethod(m).every((c) => c.state === 'skipped');
  const skippedAny = METHOD_ORDER.some(allSkipped);
  const somePending = (m: BenchMethod) => byMethod(m).some((c) => c.state === 'pending');
  let partial = false;
  const solved = METHOD_ORDER.map((m) => {
    const cs = byMethod(m);
    if (allSkipped(m)) return span(m, `\\textit{n.e.}${SECT}`);
    if (noneDone(m)) return span(m, PENDING);
    const mark = somePending(m) ? DAGGER : '';
    if (mark) partial = true;
    if (isGurobiMethod(m)) return span(m, `${cs.filter((c) => c.state === 'optimal').length}/${insts.length}${mark}`);
    // Heurísticas: k/W, con W = instancias con z*_P3 probado (sin óptimo probado no hay con qué comparar).
    const withProven = cs.filter((c, i) => c.devPct !== null && insts[i].ref?.proven);
    return span(m, (withProven.length ? `${withProven.filter((c) => c.hitsRef).length}/${withProven.length}` : NONE) + mark);
  });
  const avgSec = METHOD_ORDER.map((m) => {
    const cs = byMethod(m);
    if (allSkipped(m)) return span(m, '');
    if (noneDone(m)) return span(m, PENDING);
    const t = isGurobiMethod(m) ? mean(cs.filter((c) => c.state === 'optimal').map((c) => c.timeSec)) : mean(cs.filter((c) => c.state === 'heuristic').map((c) => c.timeSec));
    return span(m, texSec(t));
  });
  const avgDev = METHOD_ORDER.map((m) => {
    const cs = byMethod(m);
    if (allSkipped(m)) return span(m, '');
    if (noneDone(m)) return span(m, PENDING);
    if (isGurobiMethod(m)) return span(m, texPct(mean(cs.filter((c) => c.state === 'feasible').map((c) => c.gapPct)), 2));
    const d = mean(cs.map((c) => c.devPct));
    const partRef = cs.some((c, i) => c.devPct !== null && isUnproven(insts[i]));
    return span(m, texPct(d, 2) + (d !== null && partRef ? DDAGGER : ''));
  });

  const widths = METHOD_ORDER.map((m) => DETAIL_HEAD[m].length);
  const nCols = 1 + widths.reduce((a, b) => a + b, 0);
  const ilsRuns = insts.map((i) => (i.records.ils as ILSRecord | undefined)?.runs).find((r): r is number => typeof r === 'number');
  const h = texH(opts.h);

  const caption =
    `Resultados por instancia para $|V_c| = ${opts.n}$ y $h = h_a = h_b = ${h}$.` +
    timeLimitText(opts.timeLimitSec, opts.timeLimits) +
    ' $z$: costo total (ruteo + manipulación); $z^{H}$: costo de manipulación; Seg.: tiempo en segundos.' +
    ' $z^{*}$: mejor solución entera al alcanzar el límite; en ese caso la columna Seg. muestra la brecha (\\%) con la cota inferior.' +
    ' Desv.: $(z - z^{*}_{P3})/z^{*}_{P3} \\cdot 100$, con $z^{*}_{P3}$ el óptimo de la Política 3 probado por Gurobi' +
    (unproven ? `; ${DDAGGER}~sin óptimo probado, contra la mejor solución conocida de esa política (puede ser la del propio método)` : '') +
    `. ILS: mejor $z$ de ${ilsRuns ?? 'las'} corridas y tiempo medio por corrida.` +
    ' Pie: \\# resueltas = óptimos probados de cada modelo Gurobi; en las heurísticas, $k/W$ = instancias que alcanzan $z^{*}_{P3}$' +
    ' entre las $W$ en que Gurobi lo probó (-- si ninguna);' +
    ' Seg. prom. = media de los resueltos (heurísticas: de todas); Desv. prom. = brecha media de los no resueltos (heurísticas: desviación media).' +
    (partial ? ` ${DAGGER}~Datos parciales: faltan ejecuciones de ese método.` : '') +
    (skippedAny ? skippedNote(opts.n) : '');

  return texTable({
    section: 'Tiempos',
    setup: ['\\small'],
    caption,
    label: `tab:tiempos-n${opts.n}-h${labelOf(opts.h)}`,
    spec: `r${METHOD_ORDER.map((m) => ' ' + 'r'.repeat(DETAIL_HEAD[m].length)).join('')}`,
    rows: [
      '\\toprule',
      row(['', ...METHOD_ORDER.map((m) => `\\multicolumn{${DETAIL_HEAD[m].length}}{c}{${LATEX_METHOD[m]}}`)]),
      cmidrules(widths),
      row(['Id', ...METHOD_ORDER.flatMap((m) => DETAIL_HEAD[m])]),
      '\\midrule',
      ...(body.length ? body : [`\\multicolumn{${nCols}}{c}{Sin instancias} \\\\`]),
      '\\midrule',
      row(['\\# resueltas', ...solved]),
      row(['Seg. prom.', ...avgSec]),
      row(['Desv. prom.', ...avgDev]),
      '\\bottomrule',
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

type Getter = (r: BenchRecord) => unknown;
const field =
  (name: string): Getter =>
  (r) =>
    (r as unknown as Record<string, unknown>)[name];

const CSV_COLUMNS: [string, Getter][] = [
  ['key', (r) => benchKey(r.method, r.numCustomers, r.instanceId, r.h)],
  ['method', field('method')],
  ['label', field('label')],
  ['h', field('h')],
  ['numCustomers', field('numCustomers')],
  ['instanceId', field('instanceId')],
  ['status', field('status')],
  ['optimal', field('optimal')],
  ['timeSec', field('timeSec')],
  ['objective', field('objective')],
  ['totalDistance', field('totalDistance')],
  ['handlingCost', field('handlingCost')],
  ['bound', field('bound')],
  ['gapPct', field('gapPct')],
  ['buildSec', field('buildSec')],
  ['solCount', field('solCount')],
  ['nodeCount', field('nodeCount')],
  ['numVars', field('numVars')],
  ['numBinVars', field('numBinVars')],
  ['numConstrs', field('numConstrs')],
  ['tspMethod', field('tspMethod')],
  ['tspTimeSec', field('tspTimeSec')],
  ['dpCalls', field('dpCalls')],
  ['dpTimeMs', field('dpTimeMs')],
  ['runs', field('runs')],
  ['nRand', field('nRand')],
  ['objectiveMean', field('objectiveMean')],
  ['objectiveMax', field('objectiveMax')],
  ['hitsBest', field('hitsBest')],
  ['timeMinSec', field('timeMinSec')],
  ['timeMaxSec', field('timeMaxSec')],
  ['totalTimeSec', field('totalTimeSec')],
  ['timeLimitSec', (r) => r.config?.timeLimitSec],
  ['threads', (r) => r.parallel?.threads ?? r.config?.threads],
  ['workers', (r) => r.parallel?.workers],
  ['finishedAt', field('finishedAt')],
  ['error', field('error')],
  ['tour', (r) => (Array.isArray(r.tour) ? r.tour.join(' ') : null)],
];

function csvValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
  else if (typeof v === 'boolean') s = v ? 'true' : 'false';
  else if (typeof v === 'string') s = v;
  else s = JSON.stringify(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Una fila por registro (la última por clave), ordenadas por h, |Vc|, Id y método; separador «;»,
 * decimal «.», saltos CRLF. Sin BOM: quien descargue el archivo puede anteponer '﻿' para Excel.
 */
export function toCsv(file: BenchmarkFile | null): string {
  const grid = gridOf(file);
  const latest = new Map<string, BenchRecord>();
  for (const r of file?.records ?? []) {
    if (!r || !METHOD_ORDER.includes(r.method) || typeof r.h !== 'number') continue;
    const h = grid.h.find((x) => sameH(x, r.h)) ?? r.h;
    latest.set(benchKey(r.method, r.numCustomers, r.instanceId, h), r);
  }
  const rows = [...latest.values()].sort(
    (a, b) => a.h - b.h || a.numCustomers - b.numCustomers || a.instanceId - b.instanceId || METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
  );
  const lines = [CSV_COLUMNS.map(([name]) => name).join(';'), ...rows.map((r) => CSV_COLUMNS.map(([, get]) => csvValue(get(r))).join(';'))];
  return lines.join('\r\n') + '\r\n';
}
