/**
 * Detalle por instancia, al estilo de las Tablas 2–4 de Battarra et al. (2010): para un h y
 * un N, una fila por Id con z, z^H y segundos de cada modelo Gurobi y z, desviación y segundos
 * de la heurística de dos fases (ruta TSP + Algoritmo 2.1 + DP) y del ILS. Un modelo no resuelto muestra su mejor entera con «*» y,
 * en la columna de segundos, el gap con la cota; al pie, resueltas, segundos y desviación.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { BenchMethod, GurobiRecord, ILSRecord } from '../../types/benchmark';
import { useCatalog } from '../../state/SimulationProvider';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { Segmented, SpotlightCard } from '../ui';
import { MethodMark } from '../heuristics/methods';
import { cellOf, isGurobiMethod, METHOD_ORDER, sameCost, sameH, summarizeGroup, type BenchInstance, type Cell, type MethodStats } from './aggregate';
import { fmtPctValue, fmtSec, fmtZ } from './format';
import { toLatexDetail } from './export';
import { BENCH_INFO } from './labels';
import { CardHead, CopyLatexButton, Pending, STICKY_CELL, STICKY_ROW_HOVER, hText } from './shared';

type Col = 'z' | 'zh' | 'dev' | 'sec';

const COLS: Record<BenchMethod, Col[]> = {
  general: ['z', 'sec'],
  p1: ['z', 'zh', 'sec'],
  p2: ['z', 'zh', 'sec'],
  p3: ['z', 'zh', 'sec'],
  dp: ['z', 'dev', 'sec'],
  ils: ['z', 'dev', 'sec'],
};

const COL_LABEL: Record<Col, ReactNode> = {
  z: 'z',
  zh: (
    <>
      z<sup>H</sup>
    </>
  ),
  dev: 'Desv. %',
  sec: 'Seg.',
};

const COL_TITLE: Record<Col, string> = {
  z: 'Costo total z = ruteo + manipulación',
  zh: 'Costo de manipulación z^H',
  dev: 'Desviación (Z − ref) / ref · 100 respecto de la Política 3',
  sec: 'Segundos; si Gurobi no probó el óptimo, gap entre la mejor entera y la cota',
};

/** Métodos que buscan en el espacio de la Política 3: se destaca el menor z entre ellos. */
const P3_SPACE: BenchMethod[] = ['p3', 'dp', 'ils'];

const STATUS_ES: Record<string, string> = {
  infeasible: 'infactible',
  inf_or_unbd: 'inf. o no acot.',
  unbounded: 'no acotado',
  interrupted: 'interrumpido',
  numeric: 'numérico',
  suboptimal: 'subóptimo',
  solution_limit: 'lím. sol.',
};
const statusText = (status: string | undefined) => (status ? (STATUS_ES[status] ?? status) : '—');

const hasZ = (c: Cell) => (c.state === 'optimal' || c.state === 'feasible' || c.state === 'heuristic') && c.objective !== null;

const TD = 'num border-b border-zinc-800/60 px-2.5 py-2 text-right align-top whitespace-nowrap';

/** Segunda línea de una celda: el dato que antes solo estaba en `title` (visible con teclado y en pantallas táctiles). */
function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block font-sans text-[10.5px] leading-4 font-normal text-zinc-500">{children}</span>;
}

/** TimeLimit con que se midió ese registro (puede diferir del límite general si se mezclan corridas). */
const recordLimit = (rec: GurobiRecord | null, fallback: number | null) => {
  const t = rec?.config?.timeLimitSec;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : fallback;
};

function GurobiCols({ cell, cols, timeLimit, best }: { cell: Cell; cols: Col[]; timeLimit: number | null; best: boolean }) {
  const rec = cell.record as GurobiRecord | null;
  const recLimit = recordLimit(rec, timeLimit);
  const limit = recLimit !== null ? `${fmt(recLimit, 0)} s` : 'el límite de tiempo';
  return (
    <>
      {cols.map((col, j) => {
        let content: ReactNode = '—';
        let title: string | undefined;
        let tone = 'text-zinc-300';
        if (col === 'z') {
          if (cell.objective !== null && (cell.state === 'optimal' || cell.state === 'feasible')) {
            content = (
              <>
                {fmtZ(cell.objective)}
                {cell.state === 'feasible' && (
                  <>
                    <span aria-hidden className="text-zinc-400">
                      *
                    </span>
                    <span className="sr-only"> (mejor entera, sin óptimo probado)</span>
                  </>
                )}
              </>
            );
            tone = best ? 'font-semibold text-zinc-50' : 'text-zinc-200';
            if (cell.state === 'feasible') title = 'Mejor solución entera al alcanzar el límite: no se probó su optimalidad';
          } else {
            tone = 'text-zinc-500';
            title = cell.state === 'no_solution' ? 'Sin solución entera' : undefined;
          }
        } else if (col === 'zh') {
          content = cell.handling !== null && cell.state !== 'no_solution' ? fmtZ(cell.handling) : '—';
          tone = cell.handling !== null ? 'text-zinc-400' : 'text-zinc-500';
        } else if (col === 'sec') {
          if (cell.state === 'optimal') {
            content = fmtSec(cell.timeSec);
            tone = 'text-zinc-300';
            if (rec?.nodeCount !== undefined) title = `Óptimo en ${fmtSec(cell.timeSec)} s · ${fmt(rec.nodeCount, 0)} nodos B&B`;
          } else if (cell.state === 'feasible') {
            const bound = rec?.bound;
            content = (
              <>
                <span className="sr-only">gap </span>
                {cell.gapPct !== null ? fmtPctValue(cell.gapPct, 1) : '—'}
                {bound !== null && bound !== undefined && <Sub>cota {fmtZ(bound)}</Sub>}
              </>
            );
            tone = 'text-zinc-200';
            title =
              `Alcanzó ${limit} sin probar el óptimo. Mejor entera ${fmtZ(cell.objective)}` +
              (bound !== null && bound !== undefined ? ` · cota ${fmtZ(bound)}` : '') +
              (cell.gapPct !== null ? ` · gap ${fmtPctValue(cell.gapPct, 2)}` : '') +
              (cell.timeSec !== null ? ` · ${fmtSec(cell.timeSec)} s` : '');
          } else {
            content = rec?.status === 'time_limit' ? 'límite' : statusText(rec?.status);
            tone = 'font-sans text-[12px] text-zinc-500';
            title =
              rec?.status === 'time_limit'
                ? `Sin solución entera al cumplir ${limit}${cell.timeSec !== null ? ` (${fmtSec(cell.timeSec)} s)` : ''}`
                : `Estado de Gurobi: ${statusText(rec?.status)}`;
          }
        }
        return (
          <td key={col} title={title} className={cn(TD, j === 0 && 'border-l border-l-zinc-800', tone)}>
            {content}
          </td>
        );
      })}
    </>
  );
}

function HeuristicCols({ inst, cell, cols, best }: { inst: BenchInstance; cell: Cell; cols: Col[]; best: boolean }) {
  const ils = cell.method === 'ils' ? (cell.record as ILSRecord | null) : null;
  const unproven = inst.ref !== null && !inst.ref.proven;
  // ILS: z es la mejor de las corridas; si no todas la alcanzan, se muestra cuántas y la desviación
  // de una corrida promedio (objectiveMean), que es la que corresponde a su tiempo por corrida.
  const runs = ils?.runs;
  const allHit = !ils || typeof ils.hitsBest !== 'number' || !runs || ils.hitsBest >= runs;
  const ref = inst.ref?.value ?? null;
  const zMean = typeof ils?.objectiveMean === 'number' ? ils.objectiveMean : null;
  const runDev =
    zMean !== null && ref !== null && ref !== 0 && cell.objective !== null && !sameCost(zMean, cell.objective)
      ? sameCost(zMean, ref)
        ? 0
        : ((zMean - ref) / ref) * 100
      : null;
  return (
    <>
      {cols.map((col, j) => {
        let content: ReactNode = '—';
        let title: string | undefined;
        let tone = 'text-zinc-300';
        if (col === 'z') {
          content = (
            <>
              {fmtZ(cell.objective)}
              {!allHit && ils && (
                <Sub>
                  {ils.hitsBest}/{runs} corr.<span className="sr-only"> alcanzan este z</span>
                </Sub>
              )}
            </>
          );
          tone = best ? 'font-semibold text-zinc-50' : 'text-zinc-200';
          if (ils) {
            const parts = [`Mejor de ${ils.runs ?? '—'} corridas`];
            if (ils.objectiveMean !== undefined) parts.push(`media ${fmtZ(ils.objectiveMean)}`);
            if (ils.hitsBest !== undefined && ils.runs) parts.push(`${ils.hitsBest}/${ils.runs} alcanzan el mejor`);
            title = parts.join(' · ');
          }
        } else if (col === 'dev') {
          if (cell.devPct === null) {
            tone = 'text-zinc-500';
          } else {
            content = (
              <>
                {fmtPctValue(cell.devPct, 2)}
                {unproven && (
                  <>
                    <span aria-hidden className="text-zinc-500">
                      °
                    </span>
                    <span className="sr-only"> (referencia sin óptimo probado)</span>
                  </>
                )}
                {runDev !== null && (
                  <Sub>
                    <span className="sr-only">corrida </span>media {fmtPctValue(runDev, 2)}
                  </Sub>
                )}
              </>
            );
            tone = cell.hitsRef ? 'text-zinc-500' : 'text-zinc-100';
            title = unproven
              ? `Referencia sin óptimo probado: mejor Z conocido ${fmtZ(inst.ref?.value ?? null)}`
              : `Respecto de z*_P3 = ${fmtZ(inst.ref?.value ?? null)}`;
          }
        } else {
          content = fmtSec(cell.timeSec);
          if (ils && ils.timeMinSec !== undefined && ils.timeMaxSec !== undefined)
            title = `Media de ${ils.runs ?? '—'} corridas · mín. ${fmtSec(ils.timeMinSec)} s · máx. ${fmtSec(ils.timeMaxSec)} s`;
        }
        return (
          <td key={col} title={title} className={cn(TD, j === 0 && 'border-l border-l-zinc-800', tone)}>
            {content}
          </td>
        );
      })}
    </>
  );
}

function GroupCells({
  inst,
  method,
  timeLimit,
  bestZ,
  errorMark,
}: {
  inst: BenchInstance;
  method: BenchMethod;
  timeLimit: number | null;
  bestZ: number | null;
  /** Número de la nota al pie con el mensaje de error (si la celda es un error). */
  errorMark?: number;
}) {
  const cell = cellOf(inst, method);
  const cols = COLS[method];
  if (cell.state === 'skipped') {
    return (
      <td colSpan={cols.length} title={cell.record?.reason ?? 'No se ejecuta por su alto costo computacional'} className="border-b border-l border-zinc-800/60 border-l-zinc-800 px-2.5 py-2">
        <span className="sr-only">No se ejecuta: alto costo computacional</span>
      </td>
    );
  }
  if (cell.state === 'pending' || cell.state === 'error') {
    return (
      <td
        colSpan={cols.length}
        title={cell.state === 'error' ? (cell.record?.error ?? 'Error sin mensaje') : undefined}
        className="border-b border-l border-zinc-800/60 border-l-zinc-800 px-2.5 py-2 text-center align-top"
      >
        {cell.state === 'pending' ? (
          <Pending />
        ) : (
          <span className="font-mono text-[12px] text-handling">
            error<sup aria-hidden>{errorMark}</sup>
            <span className="sr-only">: {cell.record?.error ?? 'sin mensaje'}</span>
          </span>
        )}
      </td>
    );
  }
  const best = P3_SPACE.includes(method) && bestZ !== null && hasZ(cell) && sameCost(cell.objective as number, bestZ);
  return isGurobiMethod(method) ? (
    <GurobiCols cell={cell} cols={cols} timeLimit={timeLimit} best={best} />
  ) : (
    <HeuristicCols inst={inst} cell={cell} cols={cols} best={best} />
  );
}

/* ───────────────────────── Pie de tabla ───────────────────────── */

type FootRow = 'solved' | 'secs' | 'dev';

function footCell(s: MethodStats, col: Col, row: FootRow): { content: ReactNode; title?: string } | null {
  const gurobi = isGurobiMethod(s.method);
  // No se ejecutó en este tamaño (alto costo computacional): solo una marca en la primera fila del pie.
  if (s.expected === 0 && s.skipped > 0)
    return row === 'solved' && col === 'sec' ? { content: <span className="font-sans text-[11.5px] text-zinc-500">n.e. §</span>, title: 'No se ejecuta por su alto costo computacional' } : null;
  if (s.done === 0) return col === 'sec' ? { content: <Pending /> } : null;
  if (row === 'solved') {
    if (col !== 'sec') return null;
    if (gurobi) {
      const pending = s.expected - s.done;
      return {
        content: (
          <>
            {s.optimal}
            <span className="text-zinc-500">/{s.expected}</span>
            {pending > 0 && <Sub>{pending} pend.</Sub>}
          </>
        ),
        title: `${s.optimal} de ${s.expected} con óptimo probado${pending > 0 ? ` · ${pending} pendientes` : ''}`,
      };
    }
    // Heurísticas: k/W = instancias que igualan z*_P3 entre las W que lo tienen probado.
    if (s.withProvenRef === 0) return { content: '—', title: 'Ninguna instancia con el óptimo de la Política 3 probado: no hay con qué comparar' };
    return {
      content: (
        <>
          {s.hitsProvenRef}
          <span className="text-zinc-500">/{s.withProvenRef}</span>
        </>
      ),
      title: `${s.hitsProvenRef} de ${s.withProvenRef} instancias con óptimo probado alcanzan z*_P3`,
    };
  }
  if (row === 'secs') {
    if (col !== 'sec') return null;
    const v = gurobi ? s.meanTimeOptimalSec : s.meanTimeSec;
    return { content: v === null ? '—' : fmtSec(v), title: gurobi ? 'Promedio de las resueltas a optimalidad' : 'Promedio de todas las ejecuciones' };
  }
  // Gap (Gurobi, de las no resueltas) o desviación media (heurísticas).
  if (gurobi) {
    if (col !== 'sec') return null;
    return s.meanGapPct === null ? { content: '—' } : { content: fmtPctValue(s.meanGapPct, 1), title: 'Gap medio de las que llegaron al límite con solución' };
  }
  if (col !== 'dev') return null;
  if (s.meanDevPct === null) return { content: '—' };
  const unproven = s.withRef > s.withProvenRef;
  return {
    content: (
      <>
        {fmtPctValue(s.meanDevPct, 2)}
        {unproven && (
          <>
            <span aria-hidden className="text-zinc-500">
              °
            </span>
            <span className="sr-only"> (con referencias sin óptimo probado)</span>
          </>
        )}
      </>
    ),
    title: 'Desviación media respecto de la Política 3',
  };
}

/** Rótulos neutros: cada fila del pie mide algo distinto en Gurobi y en las heurísticas (nota bajo la tabla). */
const FOOT_LABEL: Record<FootRow, string> = {
  solved: 'Óptimas · = P3',
  secs: 'Seg. prom.',
  dev: 'Gap · Desv.',
};

/* ───────────────────────── Tabla ───────────────────────── */

export function DetailTable({
  instances,
  customers,
  h,
  timeLimit,
  timeLimits,
}: {
  instances: BenchInstance[];
  customers: number[];
  h: number;
  timeLimit: number | null;
  timeLimits?: number[];
}) {
  const { meta } = useCatalog();
  const fallback = meta && customers.includes(meta.numCustomers) ? meta.numCustomers : (customers[0] ?? 5);
  const [picked, setPicked] = useState<number | null>(null);
  const n = picked !== null && customers.includes(picked) ? picked : fallback;

  const rows = useMemo(
    () => instances.filter((x) => sameH(x.h, h) && x.numCustomers === n).sort((a, b) => a.instanceId - b.instanceId),
    [instances, h, n],
  );
  const stats = useMemo(() => summarizeGroup(instances, h, n), [instances, h, n]);
  const bestByRow = useMemo(
    () =>
      rows.map((inst) => {
        const zs = P3_SPACE.map((m) => cellOf(inst, m))
          .filter(hasZ)
          .map((c) => c.objective as number);
        return zs.length ? Math.min(...zs) : null;
      }),
    [rows],
  );
  const notRun = useMemo(() => new Set(METHOD_ORDER.filter((m) => rows.length > 0 && rows.every((r) => cellOf(r, m).state === 'skipped'))), [rows]);
  const anyUnproven = rows.some((r) => r.ref !== null && !r.ref.proven && (cellOf(r, 'dp').devPct !== null || cellOf(r, 'ils').devPct !== null));
  const limitText =
    timeLimits && timeLimits.length > 1
      ? `el límite de tiempo de su ejecución (${timeLimits.map((t) => fmt(t, 0)).join(' o ')} s)`
      : timeLimit !== null
        ? `${fmt(timeLimit, 0)} s`
        : 'el límite de tiempo';
  // Errores de este (h, N), numerados como notas al pie: el mensaje debe verse sin depender de `title`.
  const errors = useMemo(
    () =>
      rows.flatMap((inst) =>
        METHOD_ORDER.flatMap((m) => {
          const r = inst.records[m];
          return r && r.status === 'error' ? [{ key: `${inst.key}|${m}`, id: inst.instanceId, method: m, message: r.error ?? 'Error sin mensaje' }] : [];
        }),
      ),
    [rows],
  );
  const errorMark = (inst: BenchInstance, m: BenchMethod) => {
    const k = errors.findIndex((e) => e.key === `${inst.key}|${m}`);
    return k < 0 ? undefined : k + 1;
  };

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead
        eyebrow="Detalle de un tamaño · manipulación z^H y desviación respecto de P3"
        title={
          <>
            Las <span className="num">{rows.length}</span> instancias de <span className="num">{n}</span> clientes con{' '}
            <span className="num">h = {hText(h)}</span>
          </>
        }
        note="En cada fila se destaca el menor z entre los métodos que buscan dentro de la Política 3 (Gurobi P3, dos fases e ILS)."
        actions={
          <>
            {customers.length > 1 && (
              <Segmented<number>
                ariaLabel="Cantidad de clientes"
                size="xs"
                value={n}
                onChange={setPicked}
                options={customers.map((c) => ({ value: c, label: `N = ${c}` }))}
              />
            )}
            <CopyLatexButton what="Tabla de detalle" getText={() => toLatexDetail(instances, { h, n, timeLimitSec: timeLimit, timeLimits })} />
          </>
        }
      />

      {rows.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-500">No hay instancias de {n} clientes en la grilla.</p>
      ) : (
        <div className="scrollbar-thin -mx-1 mt-5 overflow-x-auto px-1">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <caption className="sr-only">
              Detalle de las instancias de {n} clientes con h = {hText(h)}: costo total z, costo de manipulación z^H y segundos de cada modelo Gurobi;
              z, desviación respecto de la Política 3 y segundos de la heurística de dos fases y del ILS-2dir.
            </caption>
            <thead>
              <tr className="text-[12px]">
                <td className={STICKY_CELL} />
                {METHOD_ORDER.map((m) => (
                  <th
                    key={m}
                    scope="colgroup"
                    colSpan={COLS[m].length}
                    title={BENCH_INFO[m].title}
                    className="border-l border-l-zinc-800 px-2.5 pb-1.5 text-left font-medium"
                  >
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <MethodMark tone={BENCH_INFO[m].tone} size={11} />
                      <span className="text-zinc-200">{BENCH_INFO[m].label}</span>
                    </span>
                  </th>
                ))}
              </tr>
              <tr className="text-[11px] text-zinc-500">
                <th scope="col" className={cn(STICKY_CELL, 'border-b border-zinc-800 pr-4 pb-2 text-left font-medium')}>
                  Id
                </th>
                {METHOD_ORDER.flatMap((m) =>
                  COLS[m].map((col, j) => (
                    <th
                      key={`${m}-${col}`}
                      scope="col"
                      title={COL_TITLE[col]}
                      className={cn('border-b border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap', j === 0 && 'border-l border-l-zinc-800')}
                    >
                      {COL_LABEL[col]}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((inst, i) => (
                <tr key={inst.key} className="group/row transition-colors hover:bg-zinc-800/25">
                  <th scope="row" className={cn(STICKY_CELL, STICKY_ROW_HOVER, 'border-b border-zinc-800/60 py-2 pr-4 text-left align-top font-normal')}>
                    <span className="num text-zinc-100">{inst.instanceId}</span>
                  </th>
                  {METHOD_ORDER.map((m) =>
                    notRun.has(m) ? (
                      i === 0 ? (
                        <td
                          key={m}
                          rowSpan={rows.length}
                          colSpan={COLS[m].length}
                          title={inst.records[m]?.reason ?? 'No se ejecuta por su alto costo computacional'}
                          className="border-b border-l border-zinc-800/60 border-l-zinc-800 bg-zinc-950/30 px-3 py-2 text-center align-middle"
                        >
                          <span className="inline-block max-w-[13ch] text-[11.5px] leading-snug text-pretty text-zinc-500">
                            No se ejecuta: alto costo computacional<span aria-hidden className="text-zinc-400"> §</span>
                          </span>
                        </td>
                      ) : null
                    ) : (
                      <GroupCells key={m} inst={inst} method={m} timeLimit={timeLimit} bestZ={bestByRow[i]} errorMark={errorMark(inst, m)} />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="text-[12.5px]">
              {(['solved', 'secs', 'dev'] as FootRow[]).map((row, r) => (
                <tr key={row}>
                  <th
                    scope="row"
                    className={cn(STICKY_CELL, 'pr-4 text-left align-top font-sans text-[12px] font-medium whitespace-nowrap text-zinc-300', r === 0 ? 'pt-3 pb-1' : 'py-1')}
                  >
                    {FOOT_LABEL[row]}
                  </th>
                  {METHOD_ORDER.flatMap((m) =>
                    COLS[m].map((col, j) => {
                      const c = footCell(stats.methods[m], col, row);
                      return (
                        <td
                          key={`${m}-${col}`}
                          title={c?.title}
                          className={cn(
                            'num px-2.5 text-right align-top whitespace-nowrap text-zinc-100',
                            r === 0 ? 'pt-3 pb-1' : 'py-1',
                            j === 0 && 'border-l border-l-zinc-800',
                          )}
                        >
                          {c?.content ?? null}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-[110ch] text-[12px] leading-relaxed text-pretty text-zinc-500">
        <span className="text-zinc-400">*</span> mejor solución entera al cumplir {limitText} sin probar su optimalidad; en esa fila la columna{' '}
        <span className="text-zinc-400">Seg.</span> muestra el gap (en %) entre esa solución y la cota inferior, como en Battarra et al.{' '}
        <span className="text-zinc-400">límite</span>: llegó al límite sin solución entera. Seg. de las dos fases: ruta TSP + Algoritmo 2.1 + DP; del ILS:
        promedio por corrida, y su z es el mejor de las corridas (debajo, cuántas lo alcanzan si no fueron todas, y la desviación de una corrida
        promedio).
        {anyUnproven && (
          <>
            {' '}
            <span className="text-zinc-400">°</span> desviación respecto del mejor Z conocido, porque Gurobi P3 no probó el óptimo (puede ser el del
            propio método).
          </>
        )}{' '}
        {notRun.size > 0 && (
          <>
            <span className="text-zinc-400">§</span> El Modelo General no se ejecuta con {n} clientes por su alto costo computacional (ver «Cómo se
            midió»).{' '}
          </>
        )}
        Pie: en los modelos Gurobi, óptimas de las {rows.length}, segundos promedio de las óptimas y gap medio de las que llegaron al límite; en el
        las dos fases y el ILS, instancias que igualan z*<sub>P3</sub> entre las que lo tienen probado, segundos promedio de todas sus
        ejecuciones y desviación media.
      </p>
      {errors.length > 0 && (
        <ol className="mt-3 space-y-1 text-[12px] leading-relaxed text-zinc-400" aria-label="Errores de esta tabla">
          {errors.map((e, k) => (
            <li key={e.key} className="flex gap-2">
              <span className="num shrink-0 text-handling">{k + 1}</span>
              <span className="min-w-0 break-words">
                Id <span className="num">{e.id}</span> · {BENCH_INFO[e.method].label}: <span className="font-mono text-[11.5px] text-zinc-300">{e.message}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </SpotlightCard>
  );
}
