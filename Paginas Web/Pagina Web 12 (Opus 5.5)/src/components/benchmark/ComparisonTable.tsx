/**
 * Tabla comparativa principal de la sección «Tiempos»: para un h, cada N (5…25) es un bloque con
 * una fila por Id que muestra, en cada método, el valor objetivo z y los segundos que tardó, como
 * las Tablas 2–4 de Battarra et al. (2010); al cerrar cada bloque, una fila «Prom.» (óptimas k/n y
 * segundos medios de Gurobi; desviación respecto de la Política 3 y segundos medios de las
 * heurísticas, como la Tabla 2 de Erdoğan et al. 2012) y al final un «Total». Todo sale de
 * aggregate.ts; aquí solo se presenta.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { BenchMethod, BenchmarkFile, GurobiRecord, ILSRecord } from '../../types/benchmark';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { Disclosure, Segmented, SpotlightCard } from '../ui';
import { MethodMark } from '../heuristics/methods';
import { cellOf, instancesOf, isGurobiMethod, METHOD_ORDER, sameCost, sameH, type BenchInstance, type Cell, type GroupStats, type MethodStats } from './aggregate';
import { fmtPctValue, fmtSec, fmtZ } from './format';
import { toCsv, toLatexComparison, toLatexSummary } from './export';
import { BENCH_INFO } from './labels';
import { CardHead, CopyLatexButton, CsvButton, Pending, STICKY_CELL, STICKY_ROW_HOVER, hText } from './shared';

export type TimeMode = 'all' | 'optimal';

/** Métodos que buscan en el espacio de la Política 3: en cada fila se destaca el menor z entre ellos. */
const P3_SPACE: BenchMethod[] = ['p3', 'dp', 'ils'];
const GUROBI_SPAN = METHOD_ORDER.filter(isGurobiMethod).length * 2;
const HEUR_SPAN = METHOD_ORDER.filter((m) => !isGurobiMethod(m)).length * 2;

const STATUS_ES: Record<string, string> = {
  time_limit: 'límite',
  infeasible: 'infactible',
  inf_or_unbd: 'inf. o no acot.',
  unbounded: 'no acotado',
  interrupted: 'interrumpido',
  numeric: 'numérico',
  suboptimal: 'subóptimo',
  solution_limit: 'lím. sol.',
};

const hasZ = (c: Cell) => (c.state === 'optimal' || c.state === 'feasible' || c.state === 'heuristic') && c.objective !== null;

const TD = 'num border-b border-zinc-800/60 px-2.5 py-2 text-right align-top whitespace-nowrap';

/** Segunda línea de una celda, visible (no solo en `title`). */
function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block font-sans text-[10.5px] leading-4 font-normal text-zinc-500">{children}</span>;
}

/** TimeLimit con que se midió ese registro (puede diferir del general si se mezclan corridas). */
const recordLimit = (rec: GurobiRecord | null, fallback: number | null) => {
  const t = rec?.config?.timeLimitSec;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : fallback;
};

/* ───────────────────────── Fila de una instancia ───────────────────────── */

/**
 * Bloque en blanco de un método que no se ejecuta en todo un N (alto costo computacional): una sola
 * celda que ocupa sus dos columnas y todas las filas del bloque, con la alusión al motivo.
 */
function NotRunBlock({ rows, reason }: { rows: number; reason: string }) {
  return (
    <td rowSpan={rows} colSpan={2} title={reason} className="border-b border-l border-zinc-800/60 border-l-zinc-800 bg-zinc-950/30 px-3 py-2 text-center align-middle">
      <span className="inline-block max-w-[13ch] text-[11.5px] leading-snug text-pretty text-zinc-500">
        No se ejecuta<span aria-hidden className="text-zinc-400"> §</span>
        <span className="sr-only">: alto costo computacional</span>
      </span>
    </td>
  );
}

const reasonOf = (inst: BenchInstance, method: BenchMethod) =>
  inst.records[method]?.reason ?? 'No se ejecuta por su alto costo computacional';

function RunCells({ inst, method, best, timeLimit }: { inst: BenchInstance; method: BenchMethod; best: boolean; timeLimit: number | null }) {
  const cell = cellOf(inst, method);
  if (cell.state === 'skipped') {
    // Instancia suelta sin ejecutar (si es todo el bloque, lo dibuja NotRunBlock).
    return (
      <td colSpan={2} title={reasonOf(inst, method)} className="border-b border-l border-zinc-800/60 border-l-zinc-800 px-2.5 py-2">
        <span className="sr-only">No se ejecuta: alto costo computacional</span>
      </td>
    );
  }
  if (cell.state === 'pending' || cell.state === 'error') {
    const msg = cell.record?.error ?? 'Error sin mensaje';
    return (
      <td colSpan={2} title={cell.state === 'error' ? msg : undefined} className="border-b border-l border-zinc-800/60 border-l-zinc-800 px-2.5 py-2 text-center align-top">
        {cell.state === 'pending' ? (
          <Pending />
        ) : (
          <span className="font-mono text-[12px] text-handling">
            error<span className="sr-only">: {msg}</span>
          </span>
        )}
      </td>
    );
  }

  const gurobi = isGurobiMethod(method);
  const rec = gurobi ? (cell.record as GurobiRecord | null) : null;
  const ils = method === 'ils' ? (cell.record as ILSRecord | null) : null;
  const limit = recordLimit(rec, timeLimit);
  const limitText = limit !== null ? `${fmt(limit, 0)} s` : 'el límite de tiempo';

  // ── z ──
  let z: ReactNode = '—';
  let zTitle: string | undefined;
  let zTone = 'text-zinc-500';
  if (hasZ(cell)) {
    zTone = best ? 'font-semibold text-zinc-50' : 'text-zinc-200';
    z = fmtZ(cell.objective);
    if (cell.state === 'feasible') {
      z = (
        <>
          {fmtZ(cell.objective)}
          <span aria-hidden className="text-zinc-400">
            *
          </span>
          <span className="sr-only"> (mejor entera, sin óptimo probado)</span>
          {cell.gapPct !== null && <Sub>gap {fmtPctValue(cell.gapPct, 1)}</Sub>}
        </>
      );
      zTitle =
        `Mejor solución entera al cumplir ${limitText}, sin óptimo probado` +
        (rec?.bound !== null && rec?.bound !== undefined ? ` · cota ${fmtZ(rec.bound)}` : '') +
        (cell.gapPct !== null ? ` · gap ${fmtPctValue(cell.gapPct, 2)}` : '');
    } else if (ils) {
      const runs = ils.runs;
      const allHit = typeof ils.hitsBest !== 'number' || !runs || ils.hitsBest >= runs;
      if (!allHit) {
        z = (
          <>
            {fmtZ(cell.objective)}
            <Sub>
              {ils.hitsBest}/{runs} corr.<span className="sr-only"> alcanzan este z</span>
            </Sub>
          </>
        );
      }
      zTitle = [`Mejor de ${runs ?? '—'} corridas`, ils.objectiveMean !== undefined ? `media ${fmtZ(ils.objectiveMean)}` : null]
        .filter(Boolean)
        .join(' · ');
    } else if (cell.state === 'optimal') {
      zTitle = 'Óptimo probado por Gurobi';
    }
  } else if (cell.state === 'no_solution') {
    z = (
      <>
        —<Sub>sin sol.</Sub>
      </>
    );
    zTitle = 'Sin solución entera';
  }

  // ── Seg. ──
  const stopped = gurobi && cell.state !== 'optimal';
  const sec: ReactNode = (
    <>
      {fmtSec(cell.timeSec)}
      {stopped && <Sub>{rec?.status ? (STATUS_ES[rec.status] ?? rec.status) : '—'}</Sub>}
    </>
  );
  let secTitle: string | undefined;
  if (cell.state === 'optimal' && rec?.nodeCount !== undefined) secTitle = `Óptimo en ${fmtSec(cell.timeSec)} s · ${fmt(rec.nodeCount, 0)} nodos B&B`;
  else if (stopped && rec?.status === 'time_limit') secTitle = `Se detuvo al cumplir ${limitText} sin probar el óptimo`;
  else if (ils && ils.timeMinSec !== undefined && ils.timeMaxSec !== undefined)
    secTitle = `Media de ${ils.runs ?? '—'} corridas · mín. ${fmtSec(ils.timeMinSec)} s · máx. ${fmtSec(ils.timeMaxSec)} s`;
  else if (method === 'dp') secTitle = 'Tour TSP + reubicación del depósito + manipulación óptima (DP)';

  return (
    <>
      <td title={zTitle} className={cn(TD, 'border-l border-l-zinc-800', zTone)}>
        {z}
      </td>
      <td title={secTitle} className={cn(TD, stopped ? 'text-zinc-400' : 'text-zinc-300')}>
        {sec}
      </td>
    </>
  );
}

/* ───────────────────────── Filas «Prom.» y «Total» ───────────────────────── */

interface StatView {
  main: ReactNode;
  sub?: string;
  title?: string;
  muted?: boolean;
}

/** Columna z de un resumen: óptimas k/n (Gurobi) o desviación media respecto de P3 (heurísticas). */
function firstView(s: MethodStats): StatView {
  if (s.done === 0) return { main: <Pending /> };
  const pending = Math.max(0, s.expected - s.done);
  if (isGurobiMethod(s.method)) {
    const notes: string[] = [];
    const why: string[] = [`${s.optimal} de ${s.expected} con óptimo probado`];
    if (s.feasible > 0 && s.meanGapPct !== null) {
      notes.push(`gap ${fmtPctValue(s.meanGapPct, 1)}`);
      why.push(`${s.feasible} llegaron al límite con solución entera (gap medio ${fmtPctValue(s.meanGapPct, 1)})`);
    }
    if (s.noSolution > 0) {
      notes.push(`${s.noSolution} sin sol.`);
      why.push(`${s.noSolution} sin solución entera`);
    }
    if (s.errors > 0) {
      notes.push(`${s.errors} ${s.errors === 1 ? 'error' : 'errores'}`);
      why.push(`${s.errors} con error`);
    }
    if (pending > 0) {
      notes.push(`${pending} pend.`);
      why.push(`${pending} pendientes`);
    }
    return {
      main: (
        <>
          {s.optimal}
          <span className="text-zinc-500">/{s.expected}</span>
          <span className="font-sans text-[11px] text-zinc-500"> ópt.</span>
        </>
      ),
      sub: notes.join(' · ') || undefined,
      title: why.join(' · '),
    };
  }
  if (s.meanDevPct === null) return { main: '—', muted: true, title: 'Sin referencia de la Política 3 con qué comparar' };
  const unproven = s.withRef - s.withProvenRef;
  const hits = s.method === 'ils' && s.withProvenRef > 0 ? `= P3 en ${s.hitsProvenRef}/${s.withProvenRef}` : undefined;
  return {
    main: (
      <>
        <span className="font-sans text-[11px] text-zinc-500">desv. </span>
        {fmtPctValue(s.meanDevPct, 2)}
        {unproven > 0 && (
          <>
            <span aria-hidden className="text-zinc-500">
              °
            </span>
            <span className="sr-only"> (con referencias sin óptimo probado)</span>
          </>
        )}
      </>
    ),
    muted: s.meanDevPct < 0.005,
    sub: hits,
    title:
      (s.method === 'ils' ? 'Desviación media de la mejor de las corridas respecto de z*_P3. ' : 'Desviación media respecto de z*_P3. ') +
      (unproven > 0
        ? `${unproven} de ${s.withRef} instancias se comparan con el mejor z conocido: Gurobi P3 aún no prueba su óptimo`
        : `Las ${s.withRef} instancias se comparan con el óptimo probado de Gurobi P3`),
  };
}

/** Columna Seg. de un resumen: tiempo medio (todas las terminadas o solo las óptimas). */
function secView(s: MethodStats, mode: TimeMode): StatView {
  if (s.done === 0) return { main: <Pending /> };
  const gurobi = isGurobiMethod(s.method);
  const pending = Math.max(0, s.expected - s.done);
  const v = gurobi && mode === 'optimal' ? s.meanTimeOptimalSec : s.meanTimeSec;
  if (v === null) return { main: '—', muted: true, title: gurobi && mode === 'optimal' ? 'Ninguna ejecución resuelta a optimalidad' : undefined };
  const censored = gurobi && mode === 'all' && s.feasible + s.noSolution > 0;
  return {
    main: (
      <>
        {censored && (
          <span className="text-zinc-500" aria-hidden>
            ≥{' '}
          </span>
        )}
        {censored && <span className="sr-only">al menos </span>}
        {fmtSec(v)}
      </>
    ),
    sub: !gurobi && pending > 0 ? `${s.done - s.errors} de ${s.expected}` : undefined,
    title: censored
      ? 'Incluye ejecuciones que alcanzaron el límite de tiempo: el promedio real sería mayor'
      : s.maxTimeSec !== null
        ? `Máximo: ${fmtSec(s.maxTimeSec)} s`
        : undefined,
  };
}

function StatCells({
  stats,
  mode,
  strong,
  ranUpTo,
}: {
  stats: Record<BenchMethod, MethodStats>;
  mode: TimeMode;
  strong?: boolean;
  /** Mayor N en que se ejecutó cada método con instancias sin ejecutar (para la nota del total). */
  ranUpTo?: Partial<Record<BenchMethod, number | null>>;
}) {
  return (
    <>
      {METHOD_ORDER.flatMap((m) => {
        const s = stats[m];
        // Sin ninguna ejecución en el grupo (alto costo computacional): en blanco.
        if (s.expected === 0 && s.skipped > 0) {
          return [
            <td
              key={`${m}-ne`}
              colSpan={2}
              title="No se ejecuta por su alto costo computacional"
              className={cn('border-l border-l-zinc-800 px-2.5 py-2', strong ? 'pt-3' : 'border-b border-zinc-800')}
            >
              <span className="sr-only">No se ejecuta: alto costo computacional</span>
            </td>,
          ];
        }
        const views = [firstView(s), secView(s, mode)];
        // Total con instancias sin ejecutar: se aclara que promedia solo las ejecutadas.
        const upTo = ranUpTo?.[m];
        if (s.skipped > 0) {
          const note = upTo != null ? `solo N ≤ ${upTo} §` : 'solo las ejecutadas §';
          views[0] = { ...views[0], sub: [views[0].sub, note].filter(Boolean).join(' · ') };
        }
        return views.map((c, j) => (
          <td
            key={`${m}-${j}`}
            title={c.title}
            className={cn('num px-2.5 py-2 text-right align-top whitespace-nowrap', strong ? 'pt-3' : 'border-b border-zinc-800', j === 0 && 'border-l border-l-zinc-800')}
          >
            <span className={cn('block', c.muted ? 'text-zinc-500' : strong ? 'font-medium text-zinc-50' : 'font-medium text-zinc-100')}>{c.main}</span>
            {c.sub && <span className="mt-0.5 block font-sans text-[10.5px] leading-4 text-zinc-500">{c.sub}</span>}
          </td>
        ));
      })}
    </>
  );
}

/* ───────────────────────── Tabla ───────────────────────── */

export function ComparisonTable({
  instances,
  groups,
  overall,
  h,
  timeLimit,
  timeLimits,
  file,
}: {
  instances: BenchInstance[];
  groups: GroupStats[];
  /** Fila «Total»: summarizeOverall(…, 'common'), las instancias que todos los métodos terminaron. */
  overall: Record<BenchMethod, MethodStats>;
  h: number;
  timeLimit: number | null;
  timeLimits?: number[];
  file: BenchmarkFile | null;
}) {
  const [mode, setMode] = useState<TimeMode>('all');
  const blocks = useMemo(
    () =>
      groups.map((g) => {
        const rows = instances.filter((x) => sameH(x.h, h) && x.numCustomers === g.numCustomers).sort((a, b) => a.instanceId - b.instanceId);
        const best = rows.map((inst) => {
          const zs = P3_SPACE.map((m) => cellOf(inst, m))
            .filter(hasZ)
            .map((c) => c.objective as number);
          return zs.length ? Math.min(...zs) : null;
        });
        const notRun = new Set(METHOD_ORDER.filter((m) => rows.length > 0 && rows.every((inst) => cellOf(inst, m).state === 'skipped')));
        return { g, rows, best, notRun };
      }),
    [groups, instances, h],
  );
  const limitText =
    timeLimits && timeLimits.length > 1
      ? `${timeLimits.map((t) => fmt(t, 0)).join(' o ')} s (los registros mezclan límites)`
      : timeLimit !== null
        ? `${fmt(timeLimit, 0)} s`
        : 'el límite de tiempo';
  const rowsInst = groups.reduce((a, g) => a + g.instances, 0);
  const totalInst = instancesOf(overall);
  const totalPartial = totalInst < rowsInst;
  const latexOpts = { h, timeLimitSec: timeLimit, timeMode: mode, timeLimits };
  const ranUpTo = useMemo(() => {
    const out: Partial<Record<BenchMethod, number | null>> = {};
    for (const m of METHOD_ORDER) {
      const ran = blocks.filter((b) => !b.notRun.has(m) && b.g.methods[m].expected > 0).map((b) => b.g.numCustomers);
      if (blocks.some((b) => b.notRun.has(m))) out[m] = ran.length ? Math.max(...ran) : null;
    }
    return out;
  }, [blocks]);
  const notRunFrom = useMemo(() => {
    const ns = blocks.filter((b) => b.notRun.size > 0).map((b) => b.g.numCustomers);
    return ns.length ? Math.min(...ns) : null;
  }, [blocks]);

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead
        eyebrow="Tabla comparativa · estilo Battarra et al. (2010)"
        title={
          <>
            Costo z y segundos por instancia · <span className="num">h = {hText(h)}</span>
          </>
        }
        actions={
          <>
            <span className="text-[12px] text-zinc-500">Tiempo medio</span>
            <Segmented<TimeMode>
              ariaLabel="Tiempo medio de los modelos Gurobi en las filas Prom."
              size="xs"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'all', label: 'Todas', title: 'Todas las ejecuciones terminadas (las que llegan al límite cuentan con su tiempo)' },
                { value: 'optimal', label: 'Solo óptimas', title: 'Solo las ejecuciones resueltas a optimalidad (como «Avg. seconds» de Battarra et al.)' },
              ]}
            />
            <CopyLatexButton what="Tabla comparativa" getText={() => toLatexComparison(instances, groups, overall, latexOpts)} />
            <CopyLatexButton what="Resumen por N" label="LaTeX resumen" getText={() => toLatexSummary(groups, overall, latexOpts)} />
            <CsvButton filename="benchmark_tiempos.csv" getText={() => toCsv(file)} />
          </>
        }
      />

      <div className="scrollbar-thin -mx-1 mt-5 overflow-x-auto px-1">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">
            Valor objetivo z y segundos de cada método en cada instancia con h = {hText(h)}, agrupadas por cantidad de clientes N, con una fila de
            promedios por N y un total.
          </caption>
          <thead>
            <tr className="text-[10.5px] text-zinc-500">
              <td className={STICKY_CELL} />
              <th scope="colgroup" colSpan={GUROBI_SPAN} className="border-l border-l-zinc-800 px-2.5 pb-1 text-left font-mono font-normal tracking-[0.12em] uppercase">
                Gurobi · modelos exactos
              </th>
              <th scope="colgroup" colSpan={HEUR_SPAN} className="border-l border-l-zinc-800 px-2.5 pb-1 text-left font-mono font-normal tracking-[0.12em] uppercase">
                Heurísticas · Erdoğan et al.
              </th>
            </tr>
            <tr className="text-[12px]">
              <td className={STICKY_CELL} />
              {METHOD_ORDER.map((m) => (
                <th key={m} scope="colgroup" colSpan={2} title={BENCH_INFO[m].title} className="border-l border-l-zinc-800 px-2.5 pt-1 pb-1.5 text-left font-medium">
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
              {METHOD_ORDER.flatMap((m) => [
                <th
                  key={`${m}-z`}
                  scope="col"
                  title="Valor objetivo z = ruteo + manipulación"
                  className="border-b border-l border-zinc-800 border-l-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap"
                >
                  z
                </th>,
                <th
                  key={`${m}-s`}
                  scope="col"
                  title={
                    isGurobiMethod(m)
                      ? 'Segundos de Gurobi (Runtime, sin construir el modelo)'
                      : m === 'ils'
                        ? 'Segundos promedio de una ejecución ILS-2dir'
                        : 'Segundos de las dos fases: ruta TSP + reubicación del depósito + Algoritmo 2.1 + DP'
                  }
                  className="border-b border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap"
                >
                  Seg.
                </th>,
              ])}
            </tr>
          </thead>
          {blocks.map(({ g, rows, best, notRun }) => (
            <tbody key={g.numCustomers}>
              <tr className="bg-zinc-900/60">
                <th
                  scope="rowgroup"
                  title={`${g.numCustomers} clientes · ${rows.length} instancias`}
                  className={cn(STICKY_CELL, 'border-b border-zinc-800 py-2 pr-4 text-left align-bottom font-normal whitespace-nowrap')}
                >
                  <span className="text-[13px] font-semibold tracking-tight text-zinc-50">
                    N = <span className="num">{g.numCustomers}</span>
                  </span>
                  <span className="sr-only"> clientes, {rows.length} instancias</span>
                </th>
                {/* Con 50 filas por h la cabecera queda lejos: cada bloque repite qué método es cada par de columnas. */}
                {METHOD_ORDER.map((m) => (
                  <td key={m} colSpan={2} aria-hidden className="border-b border-l border-zinc-800 border-l-zinc-800 px-2.5 py-2 align-bottom">
                    <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap text-zinc-400">
                      <MethodMark tone={BENCH_INFO[m].tone} size={10} />
                      {BENCH_INFO[m].short}
                      <span className="text-zinc-600">{notRun.has(m) ? '· no se ejecuta §' : '· z · Seg.'}</span>
                    </span>
                  </td>
                ))}
              </tr>
              {rows.map((inst, i) => (
                <tr key={inst.key} className="group/row transition-colors hover:bg-zinc-800/25">
                  <th scope="row" className={cn(STICKY_CELL, STICKY_ROW_HOVER, 'border-b border-zinc-800/60 py-2 pr-4 text-left align-top font-normal')}>
                    <span className="sr-only">N = {g.numCustomers}, Id </span>
                    <span className="num text-zinc-100">{inst.instanceId}</span>
                  </th>
                  {METHOD_ORDER.map((m) => {
                    if (notRun.has(m)) return i === 0 ? <NotRunBlock key={m} rows={rows.length} reason={reasonOf(inst, m)} /> : null;
                    const c = cellOf(inst, m);
                    const isBest = P3_SPACE.includes(m) && best[i] !== null && hasZ(c) && sameCost(c.objective as number, best[i] as number);
                    return <RunCells key={m} inst={inst} method={m} best={isBest} timeLimit={timeLimit} />;
                  })}
                </tr>
              ))}
              <tr className="bg-zinc-900/30">
                <th scope="row" className={cn(STICKY_CELL, 'border-b border-zinc-800 py-2 pr-4 text-left align-top text-[12px] font-medium text-zinc-300')}>
                  Prom.<span className="sr-only"> N = {g.numCustomers}</span>
                </th>
                <StatCells stats={g.methods} mode={mode} />
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th
                scope="row"
                title={totalPartial ? `Promedio de las ${totalInst} instancias (de ${rowsInst}) que todos los métodos ya terminaron` : undefined}
                className={cn(STICKY_CELL, 'pt-3 pr-4 text-left align-top text-[12px] font-medium text-zinc-200')}
              >
                Total
                {totalPartial && (
                  <span className="mt-0.5 block text-[10.5px] leading-4 font-normal whitespace-nowrap text-zinc-500">
                    <span className="num">{totalInst}</span> de <span className="num">{rowsInst}</span> inst.
                  </span>
                )}
              </th>
              <StatCells stats={overall} mode={mode} strong ranUpTo={ranUpTo} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-zinc-500">
        <span className="text-zinc-300">Negrita</span>: menor z de la fila · <span className="text-zinc-300">*</span>: sin óptimo probado ·{' '}
        <span className="text-zinc-300">«…»</span>: pendiente
      </p>
      <Disclosure summary="Notas de la tabla" className="mt-3">
        <ul className="space-y-1">
          <li>
            <span className="text-zinc-300">z</span>: ruteo + manipulación; en negrita, el menor entre los métodos de la Política 3 (Gurobi P3, dos
            fases e ILS).
          </li>
          <li>
            <span className="text-zinc-300">*</span>: Gurobi llegó a {limitText} sin probar el óptimo; z es su mejor solución entera y debajo va el gap.
          </li>
          <li>
            <span className="text-zinc-300">Seg.</span>: Runtime de Gurobi («límite» si se detuvo por tiempo); en el ILS, media por corrida y z = mejor
            corrida.
          </li>
          <li>
            <span className="text-zinc-300">Prom.</span>: Gurobi, óptimas/n y tiempo medio («≥» si incluye cortes por límite); heurísticas, desviación
            media respecto de z*<sub>P3</sub>. <span className="text-zinc-300">°</span>: algunas referencias usan el mejor z conocido.
          </li>
          {notRunFrom !== null && (
            <li>
              <span className="text-zinc-300">§</span>: el Modelo General no se ejecuta con N ≥ {notRunFrom} (alto costo computacional); el Total
              promedia solo donde se ejecutó.
            </li>
          )}
          <li>
            <span className="text-zinc-300">Total</span>: {totalPartial ? 'solo las instancias que todos los métodos ya terminaron.' : 'todas las instancias.'}
          </li>
        </ul>
      </Disclosure>
    </SpotlightCard>
  );
}
