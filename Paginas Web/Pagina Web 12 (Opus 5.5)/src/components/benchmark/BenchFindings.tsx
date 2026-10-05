/**
 * Cuatro cifras calculadas sobre los registros del h elegido (nunca escritas a mano), cada una con
 * a lo más una línea breve (la definición completa va en el `title`):
 * hasta qué N resuelve cada modelo Gurobi todas las instancias, cuántas veces el ILS iguala el
 * óptimo probado de la Política 3, cuánto más rápido es el ILS que P3 en el mayor N con datos
 * y cuánto tarda una evaluación del Algoritmo 2.1 + DP.
 */
import { useMemo, type ReactNode } from 'react';
import { CircleCheck, Timer, Zap } from 'lucide-react';
import type { BenchMethod, DPRecord } from '../../types/benchmark';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { SpotlightCard } from '../ui';
import { MethodMark } from '../heuristics/methods';
import { cellOf, GUROBI_METHODS, largestAllSolvedN, sameH, type BenchInstance, type GroupStats, type MethodStats, type Progress } from './aggregate';
import { fmtMs, fmtSec } from './format';
import { BENCH_INFO } from './labels';
import { CardHead, hText } from './shared';

/** 27 → «27», 4,26 → «4,3», 1 234 → «1.234». */
const fmtRatio = (r: number) => fmt(r, r >= 10 ? 0 : 1);

function Finding({
  icon,
  term,
  value,
  unit,
  note,
  title,
  className,
}: {
  icon: ReactNode;
  term: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  /** Definición completa (tooltip), para que la tarjeta muestre solo la cifra. */
  title?: string;
  className?: string;
}) {
  return (
    <div title={title} className={cn('flex min-w-0 flex-col bg-zinc-950/70 px-4 py-4', className)}>
      <dt className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        {icon}
        {term}
      </dt>
      <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span className="num text-[26px] leading-none font-semibold tracking-tight text-zinc-50">{value}</span>
        {unit && <span className="text-[12px] text-zinc-500">{unit}</span>}
      </dd>
      {note && <dd className="mt-2 text-[12px] leading-snug text-pretty text-zinc-500">{note}</dd>}
    </div>
  );
}

export function BenchFindings({
  instances,
  groups,
  overall,
  h,
  progress,
}: {
  instances: BenchInstance[];
  groups: GroupStats[];
  overall: Record<BenchMethod, MethodStats>;
  h: number;
  progress: Progress;
}) {
  const solved = useMemo(
    () =>
      GUROBI_METHODS.map((m) => {
        const n = largestAllSolvedN(instances, m, h);
        // El tamaño siguiente de la grilla: ¿se resolvió parcialmente o sigue en curso?
        const next = groups.find((g) => g.numCustomers > (n ?? 0));
        const s = next?.methods[m] ?? null;
        const known = !!s && (s.done > 0 || (s.expected === 0 && s.skipped > 0));
        return { m, n, next: next && s && known ? { n: next.numCustomers, s } : next ? { n: next.numCustomers, s: null } : null };
      }),
    [instances, groups, h],
  );

  // Solo instancias con el óptimo de la Política 3 probado por Gurobi.
  const ils = {
    withProven: overall.ils.withProvenRef,
    hits: overall.ils.hitsProvenRef,
    dpWith: overall.dp.withProvenRef,
    dpHits: overall.dp.hitsProvenRef,
  };

  const speed = useMemo(() => {
    for (let k = groups.length - 1; k >= 0; k--) {
      const g = groups[k];
      const p3 = g.methods.p3;
      const il = g.methods.ils;
      if (p3.meanTimeSec !== null && il.meanTimeSec !== null && il.meanTimeSec > 0 && p3.meanTimeSec > 0) {
        return {
          n: g.numCustomers,
          p3: p3.meanTimeSec,
          ils: il.meanTimeSec,
          ratio: p3.meanTimeSec / il.meanTimeSec,
          censored: p3.feasible + p3.noSolution > 0,
          partial: p3.done < p3.expected || il.done < il.expected,
        };
      }
    }
    return null;
  }, [groups]);

  const dp = useMemo(() => {
    const byN = new Map<number, number[]>();
    for (const inst of instances) {
      if (!sameH(inst.h, h)) continue;
      const rec = cellOf(inst, 'dp').record as DPRecord | null;
      if (!rec || rec.status === 'error' || typeof rec.dpTimeMs !== 'number') continue;
      const list = byN.get(inst.numCustomers) ?? [];
      list.push(rec.dpTimeMs);
      byN.set(inst.numCustomers, list);
    }
    const rows = [...byN.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, xs]) => ({ n, ms: xs.reduce((a, b) => a + b, 0) / xs.length }));
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    const two = groups.find((g) => g.numCustomers === last.n)?.methods.dp.meanTimeSec ?? null;
    return { last, two };
  }, [instances, groups, h]);

  const partial = !progress.complete;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <CardHead
        eyebrow="Hallazgos"
        title={
          <>
            Lo que muestran los tiempos · <span className="num">h = {hText(h)}</span>
          </>
        }
        note={partial ? `Provisional: ${progress.done} de ${progress.expected} ejecuciones.` : undefined}
      />

      {/* Columnas según el ancho real de la tarjeta (container queries), no el de la ventana: entre lg y xl
          la tarjeta ocupa 5/12 y cuatro columnas quedarían de ~64 px. */}
      <div className="@container mt-5 flex flex-1 flex-col">
      <dl className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-800/80 @xs:grid-cols-2">
        <div
          title="Mayor N en que Gurobi probó el óptimo de todas las instancias (y las de todo N menor)"
          className="@container flex min-w-0 flex-col bg-zinc-950/70 px-4 py-4 @xs:col-span-2"
        >
          <dt className="flex items-center gap-1.5 text-[12px] text-zinc-400">
            <CircleCheck className="h-3.5 w-3.5 text-ok" aria-hidden />
            Mayor N resuelto completo
          </dt>
          <dd className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 @[25rem]:grid-cols-4">
            {solved.map(({ m, n, next }) => (
              <div key={m} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-zinc-300">
                  <MethodMark tone={BENCH_INFO[m].tone} size={10} />
                  {BENCH_INFO[m].label}
                </p>
                <p className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-[12px] text-zinc-500">N =</span>
                  <span className="num text-[24px] leading-none font-semibold tracking-tight text-zinc-50">{n ?? '—'}</span>
                </p>
                {next && (
                  <p className="mt-1 text-[11.5px] leading-snug text-zinc-500">
                    {next.s !== null && next.s.expected === 0 && next.s.skipped > 0 ? (
                      <>
                        N ≥ <span className="num">{next.n}</span>: no se ejecuta
                      </>
                    ) : next.s === null ? (
                      <>
                        N = <span className="num">{next.n}</span>: sin registros
                      </>
                    ) : (
                      <>
                        N = <span className="num">{next.n}</span>: <span className="num text-zinc-400">{next.s.optimal}</span>/
                        <span className="num">{next.s.expected}</span> ópt.
                        {next.s.done < next.s.expected && <> · {next.s.expected - next.s.done} pend.</>}
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </dd>
        </div>

        <Finding
          icon={<MethodMark tone="ils" size={12} />}
          term="ILS = óptimo de Gurobi P3"
          title="Instancias con el óptimo de la Política 3 probado por Gurobi en que el ILS lo alcanza"
          value={
            ils.withProven === 0 ? (
              '—'
            ) : (
              <>
                {ils.hits}
                <span className="text-zinc-500">/{ils.withProven}</span>
              </>
            )
          }
          unit={ils.withProven === 0 ? undefined : 'instancias'}
          note={
            ils.withProven > 0 && (
              <>
                Dos fases: <span className="num text-zinc-300">{ils.dpHits}</span>/<span className="num">{ils.dpWith}</span>
              </>
            )
          }
        />

        <Finding
          icon={<Zap className="h-3.5 w-3.5 text-ils" aria-hidden />}
          term={speed ? `ILS frente a P3 con N = ${speed.n}` : 'ILS frente a P3'}
          title={speed?.partial ? 'Con las instancias registradas hasta ahora' : undefined}
          // Si algún P3 se cortó por el límite, su media es una cota inferior del tiempo real.
          value={speed ? `${speed.censored ? (speed.ratio >= 1 ? '≥ ' : '≤ ') : ''}${fmtRatio(speed.ratio >= 1 ? speed.ratio : 1 / speed.ratio)}×` : '—'}
          unit={speed ? (speed.ratio >= 1 ? 'más rápido' : 'más lento') : undefined}
          note={
            speed && (
              <>
                P3 {speed.censored ? '≥ ' : ''}
                <span className="num text-zinc-300">{fmtSec(speed.p3)} s</span> · ILS <span className="num text-zinc-300">{fmtSec(speed.ils)} s</span>
              </>
            )
          }
        />

        <Finding
          className="@xs:col-span-2"
          icon={<Timer className="h-3.5 w-3.5 text-dp" aria-hidden />}
          term="Una evaluación del Alg. 2.1 + DP"
          title="Manipulación óptima de la Política 3 sobre un tour fijo; el ILS la llama en cada vecino"
          value={dp ? fmtMs(dp.last.ms) : '—'}
          unit={dp ? `ms con N = ${dp.last.n}` : undefined}
          note={
            dp?.two != null && (
              <>
                Dos fases completas: <span className="num text-zinc-300">{fmtSec(dp.two)} s</span>
              </>
            )
          }
        />
      </dl>
      </div>
    </SpotlightCard>
  );
}
