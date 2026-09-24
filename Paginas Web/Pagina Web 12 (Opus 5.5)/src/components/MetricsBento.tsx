/**
 * HUD del simulador: bento asimétrico de cuatro instrumentos.
 *   Z* (anatomía del costo) · Recorrido · Manipulación LIFO · Carga a bordo
 * El contenedor lee las métricas en vivo (60 fps durante el tránsito) y reparte
 * valores primitivos a tarjetas memorizadas: las que no cambian no se re-renderizan.
 */
import { memo, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CircleCheck } from 'lucide-react';
import { stopHandlingUntil, useLiveMetrics, useSim, type SimMode } from '../state/SimulationProvider';
import { modelMeta, POLICY_INFO } from '../lib/models';
import { stepPolicy } from '../lib/policy';
import { fmt, fmtAuto, fmtKm, fmtPct } from '../lib/format';
import { cn } from '../lib/cn';
import { springSoft, staggerChild, staggerParent } from '../lib/motion';
import type { ModelType } from '../types/solution';
import { Chip, SpotlightCard } from './ui';
import { AnimatedNumber, SpringBar } from './chrome/Animated';

const nodeTag = (id: number) => (id === 0 ? 'D' : `C${id}`);
const fmt2 = (n: number) => fmt(n, 2);
const fmtInt = (n: number) => fmt(Math.round(n), 0);
const fmt1 = (n: number) => fmt(n, 1);
const fmtAuto1 = (n: number) => fmtAuto(n, 1);
const fmtPlus = (n: number) => `+${fmt(Math.max(0, n), 2)}`;

// ───────────────────────────────────────────────────────────── contenedor

export function MetricsBento() {
  const { solution, choreo, step, stop, mode, stepIndex, arrived, subStep, activeModel, actions } = useSim();
  const live = useLiveMetrics();

  const totals = useMemo(() => {
    if (!solution) return null;
    const customers = solution.nodes.filter((n) => !n.isDepot);
    return {
      sumAlpha: customers.reduce((a, n) => a + n.alpha, 0),
      sumBeta: customers.reduce((a, n) => a + n.beta, 0),
      totalOps: solution.steps.reduce((a, s) => a + s.handlingCount, 0),
      stepCosts: solution.steps.map((s) => s.handlingCost),
      stepLegs: solution.steps.map((s) => `${nodeTag(s.from)} → ${nodeTag(s.to)}`),
    };
  }, [solution]);

  if (!solution || !live || !totals) return null;

  // Tramos cuyo costo de manipulación ya se pagó por completo (misma regla que useLiveMetrics:
  // en P3 con s_i = 0 hay dos fases con costo; la parada cuenta como pagada tras la última).
  const n = solution.steps.length;
  const currentPaid =
    arrived && !!stop && !!choreo && !!step && step.handlingCount > 0 && stopHandlingUntil(stop, subStep, choreo, solution).ops >= step.handlingCount;
  const paidSteps = mode === 'finished' ? n : mode === 'initial' ? 0 : stepIndex + (currentPaid ? 1 : 0);
  const cursor = mode === 'initial' ? -1 : mode === 'finished' ? n : stepIndex;

  const policy = activeModel === 'TSPPD-H_3' ? stepPolicy(solution, step) : null;

  return (
    <motion.div
      role="region"
      aria-label="Indicadores de la solución"
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-4 lg:grid-cols-12"
    >
      <Cell className="col-span-2 lg:col-span-12 xl:col-span-5">
        <ObjectiveCard
          model={activeModel}
          z={solution.objectiveValue}
          routing={solution.totalDistance}
          handling={solution.handlingCost}
          zSoFar={live.zSoFar}
          tourRatio={live.tourRatio}
        />
      </Cell>
      <Cell className="col-span-1 lg:col-span-4 xl:col-span-2">
        <RouteCard
          traveled={live.traveledKm}
          total={live.totalKm}
          tourRatio={live.tourRatio}
          mode={mode}
          from={step?.from ?? 0}
          to={step?.to ?? 0}
          legKm={step?.distance ?? 0}
          stepNo={mode === 'initial' ? 0 : mode === 'finished' ? n : stepIndex + 1}
          stepCount={n}
          policy={policy}
        />
      </Cell>
      <Cell className="col-span-1 lg:col-span-4 xl:col-span-2">
        <HandlingCard
          h={solution.h}
          soFar={live.handlingSoFar}
          total={solution.handlingCost}
          ops={live.opsSoFar}
          totalOps={totals.totalOps}
          costs={totals.stepCosts}
          legs={totals.stepLegs}
          paidSteps={paidSteps}
          cursor={cursor}
          onSelectStep={actions.selectStep}
        />
      </Cell>
      <Cell className="col-span-2 lg:col-span-4 xl:col-span-3">
        <LoadCard
          capacity={solution.capacity}
          a={live.load.A}
          b={live.load.B}
          free={live.load.empty}
          ratio={live.loadRatio}
          sumAlpha={totals.sumAlpha}
          sumBeta={totals.sumBeta}
          served={live.customersServed}
          customers={solution.numCustomers}
        />
      </Cell>
    </motion.div>
  );
}

function Cell({ className, children }: { className: string; children: ReactNode }) {
  return (
    <motion.div variants={staggerChild} className={cn('min-w-0', className)}>
      {children}
    </motion.div>
  );
}

function CardShell({ className, children }: { className?: string; children: ReactNode }) {
  return <SpotlightCard className={cn('flex h-full min-h-[104px] flex-col px-4 py-3.5', className)}>{children}</SpotlightCard>;
}

// ───────────────────────────────────────────────────────────── 1 · Z*

interface ObjectiveProps {
  model: ModelType;
  z: number;
  routing: number;
  handling: number;
  zSoFar: number;
  tourRatio: number;
}

const ObjectiveCard = memo(function ObjectiveCard({ model, z, routing, handling, zSoFar }: ObjectiveProps) {
  const meta = modelMeta(model);
  const zRatio = z > 0 ? Math.min(1, zSoFar / z) : 0;
  const total = routing + handling || 1;
  const routingShare = routing / total;
  const handlingShare = handling / total;

  return (
    <CardShell className="gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="eyebrow">
          Función objetivo <span className="normal-case">Z*</span>
        </span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Chip tone="ok" title="Solución exacta: óptimo global certificado por Gurobi">
            <CircleCheck aria-hidden className="h-3 w-3" />
            Óptimo Gurobi
          </Chip>
          <Chip tone={meta.tone} title={`${meta.name} · ${meta.equations}`}>
            <span className="xl:hidden 2xl:inline">{meta.name}</span>
            <span className="hidden xl:inline 2xl:hidden">{meta.label}</span>
          </Chip>
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <p className="shrink-0">
          <span className="sr-only">Z* = </span>
          <AnimatedNumber value={z} from={0} format={fmt2} className="text-4xl font-semibold leading-none tracking-tight text-zinc-50" />
        </p>

        {/* Anatomía del costo: ruteo vs manipulación */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div
            role="img"
            aria-label={`Ruteo ${fmtPct(routingShare, 1)} y manipulación ${fmtPct(handlingShare, 1)} de Z*`}
            className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-zinc-800"
          >
            <motion.span
              className="h-full rounded-l-full bg-zinc-200 last:rounded-r-full"
              initial={false}
              animate={{ width: `${routingShare * 100}%` }}
              transition={springSoft}
            />
            {handling > 0 && <span className="h-full min-w-[3px] flex-1 rounded-r-full bg-handling" />}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] leading-4 text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-200" />
              Ruteo <span className="num text-zinc-200">{fmtKm(routing)}</span>
              <span className="num text-zinc-500">{fmtPct(routingShare, 1)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-handling" />
              Manipulación <span className="num text-handling">{fmt(handling, 2)}</span>
              <span className="num text-zinc-500">{fmtPct(handlingShare, 1)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] leading-4 text-zinc-500">
            <span className="shrink-0">Acumulado ahora</span>
            <AnimatedNumber value={zSoFar} format={fmt2} className="shrink-0 text-zinc-200" />
            {/* Fracción de Z* ya acumulada (la misma lectura que la Bitácora) */}
            <SpringBar value={zRatio} className="h-1 min-w-8 flex-1" barClassName="bg-zinc-300" />
            <span className="num w-10 shrink-0 text-right text-zinc-400" title="Parte de Z* ya acumulada">
              {fmtPct(zRatio)}
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  );
});

// ───────────────────────────────────────────────────────────── 2 · Recorrido

interface RouteProps {
  traveled: number;
  total: number;
  tourRatio: number;
  mode: SimMode;
  from: number;
  to: number;
  legKm: number;
  stepNo: number;
  stepCount: number;
  policy: 1 | 2 | null;
}

const MODE_DOT: Record<SimMode, string> = {
  initial: 'bg-zinc-600',
  transit: 'bg-zinc-50 animate-soft-pulse',
  stop: 'bg-transparent ring-1 ring-inset ring-zinc-300',
  finished: 'bg-ok',
};
const MODE_TEXT: Record<SimMode, string> = {
  initial: 'Listo para partir',
  transit: 'En tránsito',
  stop: 'Detenido en la parada',
  finished: 'Tour completo',
};

const RouteCard = memo(function RouteCard({ traveled, total, tourRatio, mode, from, to, legKm, stepNo, stepCount, policy }: RouteProps) {
  const info = policy ? POLICY_INFO[policy] : null;
  return (
    <CardShell className="gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Recorrido</span>
        <span className="num text-[11px] text-zinc-500" title="Tramo actual / total de tramos">
          <span className="sr-only">Tramo </span>
          {stepNo}/{stepCount}
        </span>
      </div>

      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
        <AnimatedNumber
          value={traveled}
          format={mode === 'transit' ? fmt1 : fmtAuto1}
          className="text-xl font-semibold leading-7 tracking-tight text-zinc-50 sm:text-2xl"
        />
        <span className="num text-[13px] text-zinc-500">/ {fmtKm(total)}</span>
      </p>

      <div className="mt-auto flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 text-zinc-400">
        <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', MODE_DOT[mode])} />
        <span className="sr-only">{MODE_TEXT[mode]}: </span>
        {mode === 'finished' ? (
          <span className="min-w-0 truncate">Tour completo · de vuelta en D</span>
        ) : (
          <span className="min-w-0 truncate">
            <span className="hidden sm:inline xl:hidden 2xl:inline">Tramo </span>
            <span className="num text-zinc-200">
              {nodeTag(from)} → {nodeTag(to)}
            </span>{' '}
            <span className="text-zinc-500">·</span> <span className="num">{fmtKm(legKm)}</span>
          </span>
        )}
        {info && mode !== 'finished' && (
          <Chip tone={policy === 1 ? 'p1' : 'p2'} className="ml-auto h-4 px-1 text-[10px]" title={`Decisión en ${nodeTag(to)}: ${info.title} (${info.s})`}>
            {info.code}
          </Chip>
        )}
      </div>
      <SpringBar value={tourRatio} className="h-[3px]" barClassName="bg-zinc-100" />
    </CardShell>
  );
});

// ───────────────────────────────────────────────────────────── 3 · Manipulación

interface HandlingProps {
  h: number;
  soFar: number;
  total: number;
  ops: number;
  totalOps: number;
  costs: number[];
  legs: string[];
  paidSteps: number;
  cursor: number;
  onSelectStep: (stepIndex: number) => void;
}

const HandlingCard = memo(function HandlingCard({ h, soFar, total, ops, totalOps, costs, legs, paidSteps, cursor, onSelectStep }: HandlingProps) {
  const max = Math.max(...costs, 0);
  return (
    <CardShell className="gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">
          Manipulación<span className="hidden sm:inline xl:hidden 2xl:inline"> LIFO</span>
        </span>
        <span className="num hidden shrink-0 text-[11px] text-zinc-500 sm:inline" title="Costo unitario por unidad manipulada">
          h = {fmtAuto(h, 2)}
        </span>
      </div>

      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
        <AnimatedNumber value={soFar} format={fmtPlus} className="text-xl font-semibold leading-7 tracking-tight text-handling sm:text-2xl" />
        <span className="num text-[13px] text-zinc-500">de {fmt(total, 2)}</span>
      </p>

      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="shrink-0 text-[11.5px] leading-4 text-zinc-400">
          {totalOps > 0 ? (
            <>
              <span className="num text-zinc-200">
                {ops} / {totalOps}
              </span>{' '}
              ops
            </>
          ) : (
            'Sin manipulaciones'
          )}
        </span>

        {/* Histograma: costo h por tramo; clic → saltar a esa parada */}
        {max > 0 && (
          <div role="group" aria-label="Costo de manipulación por parada" className="flex h-5 min-w-0 max-w-[132px] flex-1 items-end justify-end gap-px">
            {costs.map((c, i) => {
              const paid = i < paidSteps;
              const isCursor = i === cursor;
              const label = `Parada ${i + 1} · ${legs[i]} · ${c > 0 ? `+${fmt(c, 2)}` : 'sin manipulación'}`;
              return (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  title={label}
                  aria-label={`Ir a la parada ${i + 1}: ${legs[i]}, ${c > 0 ? `manipulación +${fmt(c, 2)}` : 'sin manipulación'}`}
                  onClick={() => onSelectStep(i)}
                  className="group/bar flex h-full min-w-0 max-w-[7px] flex-1 items-end focus-visible:outline-1"
                >
                  <motion.span
                    initial={false}
                    animate={{ height: c > 0 ? `${Math.max(22, (c / max) * 100)}%` : '2px' }}
                    transition={springSoft}
                    className={cn(
                      'block w-full rounded-[1.5px] transition-colors duration-200',
                      c > 0
                        ? paid
                          ? 'bg-handling group-hover/bar:bg-handling/80'
                          : 'bg-zinc-700 group-hover/bar:bg-zinc-500'
                        : paid
                          ? 'bg-zinc-500'
                          : 'bg-zinc-800 group-hover/bar:bg-zinc-600',
                      isCursor && 'ring-1 ring-zinc-200/70 ring-offset-1 ring-offset-zinc-900',
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </CardShell>
  );
});

// ───────────────────────────────────────────────────────────── 4 · Carga

interface LoadProps {
  capacity: number;
  a: number;
  b: number;
  free: number;
  ratio: number;
  sumAlpha: number;
  sumBeta: number;
  served: number;
  customers: number;
}

const LoadCard = memo(function LoadCard({ capacity, a, b, free, ratio, sumAlpha, sumBeta, served, customers }: LoadProps) {
  const q = capacity || 1;
  const aPct = (a / q) * 100;
  const bPct = (b / q) * 100;
  return (
    <CardShell className="gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="eyebrow">
          Carga<span className="xl:hidden 2xl:inline"> a bordo</span> · <span className="normal-case">Q</span> = {capacity}
        </span>
        <span className="text-[11.5px] leading-4 text-zinc-500" title="Clientes cuya parada ya terminó">
          <span className="hidden sm:inline xl:hidden min-[1600px]:inline">Clientes atendidos</span>
          <span className="sm:hidden xl:inline min-[1600px]:hidden">Atendidos</span>{' '}
          <span className="num text-zinc-200">
            {served}/{customers}
          </span>
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="flex items-baseline">
          <AnimatedNumber value={a + b} format={fmtInt} className="text-xl font-semibold leading-7 tracking-tight text-zinc-50 sm:text-2xl" />
          <span className="num text-xl font-semibold leading-7 tracking-tight text-zinc-500 sm:text-2xl">/{capacity}</span>
        </p>
        <span className="num text-[13px] text-zinc-400">{fmtPct(ratio)}</span>
      </div>

      {/* Medidor de capacidad α | β | libre */}
      <div
        role="meter"
        aria-label="Ocupación del compartimiento"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={a + b}
        aria-valuetext={`${a + b} de ${capacity} unidades: α ${a}, β ${b}, libres ${free}`}
        className="relative mt-auto h-2.5 overflow-hidden rounded-full bg-zinc-800"
      >
        <motion.span
          className="absolute inset-y-0 left-0 bg-alpha"
          initial={false}
          animate={{ width: `${aPct}%` }}
          transition={springSoft}
        />
        <motion.span
          className="absolute inset-y-0 bg-beta"
          initial={false}
          animate={{ left: `${aPct}%`, width: `${bPct}%` }}
          transition={springSoft}
        />
        {[0.25, 0.5, 0.75].map((t) => (
          <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-zinc-950/70" style={{ left: `${t * 100}%` }} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] leading-4 text-zinc-400">
        <span className="flex items-center gap-2">
          <Legend swatch="bg-alpha" label="α" value={a} />
          <Legend swatch="bg-beta" label="β" value={b} />
          <Legend swatch="bg-zinc-700" label="libres" value={free} />
        </span>
        <span className="num text-zinc-500" title="Demanda total de la instancia">
          Σα <span className="text-alpha">{sumAlpha}</span> <span className="text-zinc-700">·</span> Σβ <span className="text-beta">{sumBeta}</span>
        </span>
      </div>
    </CardShell>
  );
});

function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden className={cn('h-2 w-2 rounded-[3px]', swatch)} />
      {label} <span className="num text-zinc-200">{value}</span>
    </span>
  );
}
