/**
 * Cuerpos del panel de parada según el modo de la simulación:
 * carga inicial (depósito), tránsito (tramo en curso), resumen final,
 * más la tarjeta de decisión de la Política 3 y los micro-KPIs.
 */
import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CircleCheck, Split, Truck } from 'lucide-react';
import type { Choreography, StopPlan } from '../../lib/choreography';
import type { SolutionData, StepData } from '../../types/solution';
import { useProgress } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtKm, fmtPct } from '../../lib/format';
import { modelMeta, POLICY_INFO, TONE_CHIP } from '../../lib/models';
import { stepPolicy } from '../../lib/policy';
import { springSoft, staggerChild, staggerParent } from '../../lib/motion';
import { Chip } from '../ui';
import { POLICY_CALLOUT, SubS, nodeLabel, plural, shortLabel } from './shared';

// ───────────────────────────────────────────────────────────── carga inicial

interface Run {
  dest: number | null;
  count: number;
  start: number;
}

/** Agrupa los slots contiguos del camión por cliente de destino (índice 0 = compuerta). */
function manifestRuns(choreo: Choreography): Run[] {
  const runs: Run[] = [];
  choreo.initial.forEach((id, slot) => {
    const dest = id ? choreo.units[id]?.destination ?? -1 : null;
    const prev = runs[runs.length - 1];
    if (prev && prev.dest === dest) prev.count++;
    else runs.push({ dest, count: 1, start: slot });
  });
  return runs;
}

export function InitialBody({ solution, choreo }: { solution: SolutionData; choreo: Choreography }) {
  const { hoverNode, setHoverNode } = useHover();
  const runs = useMemo(() => manifestRuns(choreo), [choreo]);
  const Q = choreo.capacity;
  const sumA = solution.steps.reduce((a, s) => a + s.deliverA, 0);
  const sumB = solution.steps.reduce((a, s) => a + s.pickupB, 0);
  const sequence = solution.steps.filter((s) => s.to !== 0);
  const maxA = Math.max(1, ...sequence.map((s) => s.deliverA));
  const general = (solution.model ?? 'TSPPD-H') === 'TSPPD-H';
  let customerRun = 0;

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={staggerChild}>
        <p className="eyebrow">Carga inicial</p>
        <p className="mt-1.5 max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-400">
          El camión sale con <span className="num font-semibold text-alpha">Σα = {sumA}</span> unidades de entrega (
          <span className="num text-zinc-200">
            {sumA}/{Q}
          </span>
          ).{' '}
          {general
            ? 'El modelo general decide la posición de cada unidad; aquí se ve la asignación que eligió el solver.'
            : 'Se cargan en orden inverso de entrega: la mercancía del primer cliente queda junto a la compuerta.'}{' '}
          En la ruta se recogerán <span className="num font-semibold text-beta">Σβ = {sumB}</span>.
        </p>
      </motion.div>

      {/* Manifiesto: el compartimiento de compuerta (izq.) a cabina (der.), agrupado por destino */}
      <motion.div variants={staggerChild}>
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
          <span>Compuerta</span>
          <span>Cabina</span>
        </div>
        <div
          className="flex h-9 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
          role="img"
          aria-label={`Carga inicial: ${runs
            .filter((r) => r.dest !== null)
            .map((r) => `${r.count} α para ${r.dest! > 0 ? nodeLabel(solution, r.dest!) : 'sin destino'}`)
            .join(', ')}`}
        >
          {runs.map((run) => {
            const w = `${(run.count / Q) * 100}%`;
            if (run.dest === null) return <span key={run.start} className="hatch h-full" style={{ width: w }} />;
            const alt = customerRun++ % 2 === 1;
            const lit = hoverNode !== null && hoverNode === run.dest;
            const dim = hoverNode !== null && hoverNode !== run.dest;
            return (
              <span
                key={run.start}
                onMouseEnter={() => run.dest! > 0 && setHoverNode(run.dest)}
                onMouseLeave={() => setHoverNode(null)}
                title={`${run.count} α para ${run.dest! > 0 ? nodeLabel(solution, run.dest!) : 'sin destino'} · slots ${run.start + 1}–${run.start + run.count}`}
                className={cn(
                  'relative grid h-full place-items-center border-r border-zinc-950/70 font-mono text-[10px] font-semibold text-zinc-950 transition-opacity duration-200',
                  alt ? 'bg-alpha/70' : 'bg-alpha',
                  dim && 'opacity-35',
                  lit && 'shadow-[inset_0_0_0_2px_rgb(250_250_250)]',
                )}
                style={{ width: w }}
              >
                {run.count / Q >= 0.07 && run.dest! > 0 && shortLabel(run.dest!)}
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Secuencia de entregas */}
      <motion.div variants={staggerChild}>
        <p className="eyebrow mb-2">Secuencia de entregas</p>
        <ol className="flex flex-wrap items-end gap-x-1 gap-y-2">
          {sequence.map((s, i) => (
            <li key={s.stepIndex} className="flex items-end gap-1">
              <button
                type="button"
                onMouseEnter={() => setHoverNode(s.to)}
                onMouseLeave={() => setHoverNode(null)}
                onFocus={() => setHoverNode(s.to)}
                onBlur={() => setHoverNode(null)}
                title={`${nodeLabel(solution, s.to)}: entrega ${s.deliverA} α · recoge ${s.pickupB} β`}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-md px-1 pt-1 pb-0.5 transition-colors hover:bg-zinc-800/50',
                  hoverNode === s.to && 'bg-zinc-800/60',
                )}
              >
                <span className="flex h-6 items-end" aria-hidden>
                  <span className="w-5 rounded-t-[3px] bg-alpha/80" style={{ height: `${Math.max(3, (s.deliverA / maxA) * 24)}px` }} />
                </span>
                <span className="num text-[11px] text-zinc-200">{shortLabel(s.to)}</span>
                <span className="num text-[10px] text-alpha">{s.deliverA}</span>
              </button>
              {i < sequence.length - 1 && <ArrowRight className="mb-5 h-3 w-3 text-zinc-700" aria-hidden />}
            </li>
          ))}
        </ol>
      </motion.div>
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────── tránsito

/** Avance del tramo en vivo (única pieza suscrita a 60 fps). */
export const LegProgress = memo(function LegProgress({
  step,
  fromLabel,
  toLabel,
  playing,
}: {
  step: StepData;
  fromLabel: string;
  toLabel: string;
  playing: boolean;
}) {
  const progress = useProgress();
  const pct = Math.round(progress * 100);
  const remaining = Math.max(0, step.distance * (1 - progress));
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-3.5">
      <p className="eyebrow">Rumbo a {toLabel}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="num text-3xl font-semibold tracking-tight text-zinc-50" aria-live="off">
          {pct}
          <span className="ml-0.5 text-base font-normal text-zinc-500">%</span>
        </p>
        <p className="num text-right text-xs text-zinc-400">
          {fmtAuto(remaining, 1)} km restantes
          <span className="block text-[11px] text-zinc-500">{playing ? 'en movimiento' : 'en pausa'}</span>
        </p>
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avance del tramo">
        <div className="absolute inset-y-0 left-0 rounded-full bg-zinc-100" style={{ width: `${progress * 100}%` }} />
        <div
          className="absolute top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border border-zinc-600 bg-zinc-950 text-zinc-100 shadow-lg shadow-black/50"
          style={{ left: `${progress * 100}%` }}
          aria-hidden
        >
          <Truck className="h-3 w-3" />
        </div>
      </div>
      <div className="mt-2.5 flex justify-between font-mono text-[10.5px] text-zinc-500">
        <span>{fromLabel}</span>
        <span className="text-zinc-300">{toLabel}</span>
      </div>
    </div>
  );
});

/** Ocupación del camión durante el tramo (α | β | libre). */
export function OnBoard({ step, capacity }: { step: StepData; capacity: number }) {
  const a = step.aOnTruck;
  const b = step.bOnTruck;
  const Q = Math.max(1, capacity);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">A bordo</p>
        <p className="num text-[11px] text-zinc-400">
          <span className="text-alpha">{a} α</span> · <span className="text-beta">{b} β</span> ·{' '}
          <span className="text-zinc-200">
            {a + b}/{capacity}
          </span>
        </p>
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <motion.span className="h-full bg-alpha" initial={false} animate={{ width: `${(a / Q) * 100}%` }} transition={springSoft} />
        <motion.span className="h-full bg-beta" initial={false} animate={{ width: `${(b / Q) * 100}%` }} transition={springSoft} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Política 3

/**
 * Decisión s_i de la Política 3 en la parada.
 * full = regla + consecuencia (llegada) · compact = regla (vista previa) · line = solo el título.
 */
export function PolicyCallout({ stop, variant = 'full' }: { stop: StopPlan; variant?: 'full' | 'compact' | 'line' }) {
  if (!stop.policy) return null;
  const info = POLICY_INFO[stop.policy];
  const tone = POLICY_CALLOUT[stop.policy];
  return (
    <div className={cn('rounded-xl border px-3 py-2', tone.box)}>
      <div className="flex items-center gap-2">
        <Split className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} aria-hidden />
        <p className="min-w-0 text-[13px] font-medium tracking-tight text-pretty text-zinc-50 sm:truncate">
          <span className="text-zinc-400">{variant === 'compact' ? 'Decisión prevista' : 'Decisión del modelo'} · </span>
          {info.title}
        </p>
        <Chip tone={tone.chip} className="ml-auto">
          <SubS text={info.s} />
        </Chip>
      </div>
      <AnimatePresence initial={false}>
        {variant !== 'line' && (
          <motion.div
            key="rule"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            className="overflow-hidden"
          >
            <p className="max-w-[65ch] pt-1 text-[12.5px] leading-snug text-pretty text-zinc-300">{info.rule}</p>
            {variant === 'full' && (
              <p className="max-w-[65ch] pt-0.5 pb-0.5 text-[12px] leading-snug text-pretty text-zinc-500">{info.consequence}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── micro-KPIs

export function StopKpis({ step, stop }: { step: StepData; stop: StopPlan }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Operaciones de la parada">
      {stop.isDepot ? (
        <Chip tone="beta">Descarga β {stop.delivered.length}</Chip>
      ) : (
        <>
          <Chip tone={step.deliverA > 0 ? 'alpha' : 'muted'}>Entrega α {step.deliverA}</Chip>
          <Chip tone={step.pickupB > 0 ? 'beta' : 'muted'}>Recolección β {step.pickupB}</Chip>
        </>
      )}
      {step.handlingCount > 0 ? (
        <Chip tone="handling" className="sm:ml-auto">
          Manipulación {step.handlingCount} {plural(step.handlingCount, 'op', 'ops')} (+{fmt(step.handlingCost)})
        </Chip>
      ) : (
        <Chip tone="muted" className="sm:ml-auto">
          Sin penalización LIFO
        </Chip>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── resumen final

export function FinishedBody({ solution }: { solution: SolutionData }) {
  const meta = modelMeta(solution.model);
  const dist = solution.totalDistance || solution.steps.reduce((a, s) => a + s.distance, 0);
  const handling = solution.handlingCost;
  const ops = solution.steps.reduce((a, s) => a + s.handlingCount, 0);
  const z = solution.objectiveValue || dist + handling;
  const served = solution.steps.filter((s) => s.to !== 0).length;
  const distShare = z > 0 ? Math.min(1, dist / z) : 1;
  const p3 = solution.model === 'TSPPD-H_3';
  const p1Count = p3 ? solution.steps.filter((s) => s.to !== 0 && stepPolicy(solution, s) === 1).length : 0;

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="grid grid-cols-6 gap-2.5">
      <motion.div variants={staggerChild} className="col-span-6 rounded-xl border border-zinc-800 bg-zinc-950/45 p-4 sm:col-span-4 sm:row-span-2">
        <div className="flex items-center gap-2">
          <CircleCheck className="h-4 w-4 text-ok" aria-hidden />
          <p className="eyebrow text-zinc-400">Z* · valor objetivo</p>
        </div>
        <p className="num mt-2 text-4xl font-semibold tracking-tight text-zinc-50">{fmt(z)}</p>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
          <motion.span
            className="h-full bg-zinc-100"
            initial={{ width: 0 }}
            animate={{ width: `${distShare * 100}%` }}
            transition={{ ...springSoft, delay: 0.15 }}
          />
          <motion.span
            className="h-full bg-handling"
            initial={{ width: 0 }}
            animate={{ width: `${(1 - distShare) * 100}%` }}
            transition={{ ...springSoft, delay: 0.25 }}
          />
        </div>
        <p className="num mt-2 text-[11px] text-zinc-500">
          <span className="text-zinc-300">distancia {fmtPct(distShare, 1)}</span> ·{' '}
          <span className="text-handling">manipulación {fmtPct(1 - distShare, 1)}</span>
        </p>
      </motion.div>
      <motion.div variants={staggerChild} className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 sm:col-span-2">
        <p className="eyebrow">Distancia</p>
        <p className="num mt-1 text-lg font-semibold text-zinc-100">{fmtKm(dist)}</p>
      </motion.div>
      <motion.div variants={staggerChild} className="col-span-3 rounded-xl border border-handling/25 bg-handling/[0.05] p-3 sm:col-span-2">
        <p className="eyebrow">Manipulación</p>
        <p className="num mt-1 text-lg font-semibold text-handling">{fmt(handling)}</p>
        <p className="num text-[11px] text-zinc-500">
          {ops} {plural(ops, 'operación', 'operaciones')}
        </p>
      </motion.div>
      <motion.div
        variants={staggerChild}
        className="col-span-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2.5"
      >
        <p className="text-[13px] text-zinc-300">
          <span className="num font-semibold text-zinc-50">
            {served}/{solution.numCustomers || served}
          </span>{' '}
          clientes atendidos
        </p>
        <span className={cn('inline-flex h-5 items-center rounded-md border px-1.5 font-mono text-[11px]', TONE_CHIP[meta.tone])}>{meta.label}</span>
        {p3 && (
          <span className="num text-[11px] text-zinc-500">
            <span className="text-p1">{p1Count}× P1</span> · <span className="text-p2">{served - p1Count}× P2</span>
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
