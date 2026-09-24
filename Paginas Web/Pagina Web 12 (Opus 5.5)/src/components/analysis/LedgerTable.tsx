/**
 * Bitácora tabular del tour: una fila por tramo (arco de la solución óptima).
 * Es además la "vista de tabla" de los dos gráficos superiores (todo valor es legible sin hover).
 */
import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUp, MousePointerClick } from 'lucide-react';
import { useSim } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { stepPolicy } from '../../lib/policy';
import { POLICY_INFO } from '../../lib/models';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtPct } from '../../lib/format';
import { spring, staggerChild, staggerParent, scrollBehavior } from '../../lib/motion';
import { Button, Chip, SpotlightCard } from '../ui';
import { nodeLong, nodeShort } from './chart';

type RowStatus = 'done' | 'now' | 'todo';

export function LedgerTable() {
  const { solution, stepIndex, mode, actions } = useSim();
  const { hoverNode, setHoverNode } = useHover();
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const rows = useMemo(() => {
    if (!solution) return [];
    let z = 0;
    return solution.steps.map((s, k) => {
      z += s.distance + s.handlingCost;
      return { k, s, z, policy: s.to === 0 ? null : stepPolicy(solution, s) };
    });
  }, [solution]);

  const totals = useMemo(() => {
    const t = { dist: 0, a: 0, b: 0, ops: 0, cost: 0 };
    for (const { s } of rows) {
      t.dist += s.distance;
      t.a += s.deliverA;
      t.b += s.pickupB;
      t.ops += s.handlingCount;
      t.cost += s.handlingCost;
    }
    return t;
  }, [rows]);

  if (!solution) return null;

  const Q = solution.capacity || 1;
  const model = solution.model ?? 'TSPPD-H';
  const inProgress = mode === 'transit' || mode === 'stop';
  const current = inProgress ? stepIndex : null;
  const statusOf = (k: number): RowStatus =>
    mode === 'finished' ? 'done' : mode === 'initial' ? 'todo' : k < stepIndex ? 'done' : k === stepIndex ? 'now' : 'todo';
  const tabStop = current ?? 0;

  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, k: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      actions.selectStep(k);
      return;
    }
    let next = k;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, k + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, k - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    rowRefs.current[next]?.focus();
  };

  const toSimulator = () => document.getElementById('simulador')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });

  return (
    <SpotlightCard plain className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="eyebrow">Bitácora completa</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-zinc-400">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            {rows.length} tramos · pulsa una fila para llevar el simulador a esa parada.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toSimulator}>
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          Ir al simulador
        </Button>
      </div>

      <motion.div layoutScroll className="scrollbar-thin max-h-[640px] overflow-auto">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-[13px]">
          <caption className="sr-only">
            Bitácora del tour, tramo por tramo: distancia, unidades entregadas y recogidas, carga a bordo, manipulaciones, política y costo
            acumulado. Enfoca una fila y pulsa Enter para llevar el simulador a esa parada; flechas arriba y abajo para moverte.
          </caption>
          <thead>
            <tr className="text-[11px] font-medium text-zinc-500">
              <Th className="w-14 pl-5 sm:pl-6">#</Th>
              <Th>Tramo</Th>
              <Th align="right">Distancia</Th>
              <Th align="right">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-[3px] bg-alpha" />α entregadas
                </span>
              </Th>
              <Th align="right">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-[3px] bg-beta" />β recogidas
                </span>
              </Th>
              <Th>A bordo en el tramo</Th>
              <Th align="right">Manipulaciones</Th>
              <Th>Política</Th>
              <Th align="right" className="pr-5 sm:pr-6">
                Z acumulado
              </Th>
            </tr>
          </thead>
          <motion.tbody variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
            {rows.map(({ k, s, z, policy }) => {
              const status = statusOf(k);
              const isCurrent = k === current;
              const linked = !isCurrent && hoverNode !== null && hoverNode === s.to;
              const load = s.aOnTruck + s.bOnTruck;
              const aPct = (s.aOnTruck / Q) * 100;
              const bPct = (s.bOnTruck / Q) * 100;
              return (
                <motion.tr
                  key={k}
                  ref={(el) => {
                    rowRefs.current[k] = el;
                  }}
                  variants={staggerChild}
                  tabIndex={k === tabStop ? 0 : -1}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => actions.selectStep(k)}
                  onMouseDown={(e) => e.preventDefault()}
                  onKeyDown={(e) => onKey(e, k)}
                  onPointerEnter={() => setHoverNode(s.to)}
                  onPointerLeave={() => setHoverNode(null)}
                  onFocus={() => setHoverNode(s.to)}
                  onBlur={() => setHoverNode(null)}
                  className={cn(
                    'group cursor-pointer outline-none transition-colors duration-150',
                    '[&>td]:border-b [&>td]:border-zinc-800/60 [&>td]:py-2.5',
                    'hover:[&>td]:bg-zinc-800/25 focus-visible:[&>td]:bg-zinc-800/50',
                    'focus-visible:[&>td]:shadow-[inset_0_1px_0_0_rgb(250_250_250/0.55),inset_0_-1px_0_0_rgb(250_250_250/0.55)]',
                    isCurrent && '[&>td]:bg-zinc-800/40 hover:[&>td]:bg-zinc-800/45',
                    linked && '[&>td]:bg-zinc-800/25',
                  )}
                >
                  <td className="relative pl-5 sm:pl-6">
                    {isCurrent && (
                      <motion.span
                        layoutId="ledger-current-marker"
                        transition={spring}
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-zinc-50"
                      />
                    )}
                    <span className="flex items-center gap-2.5 pr-3">
                      <StatusDot status={status} />
                      <span className={cn('num text-[12px]', isCurrent ? 'text-zinc-50' : 'text-zinc-500')}>{String(k + 1).padStart(2, '0')}</span>
                    </span>
                  </td>
                  <td className="pr-4">
                    <span className="num inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-zinc-400" title={nodeLong(s.from)}>
                        {nodeShort(s.from)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-500" aria-hidden />
                      <span className={cn('font-medium', isCurrent ? 'text-zinc-50' : 'text-zinc-200')} title={nodeLong(s.to)}>
                        {nodeShort(s.to)}
                      </span>
                    </span>
                  </td>
                  <td className="num pr-4 text-right text-zinc-200">
                    {fmtAuto(s.distance, 1)}
                    <span className="text-zinc-500"> km</span>
                  </td>
                  <td className="num pr-4 text-right">
                    <Qty value={s.deliverA} />
                  </td>
                  <td className="num pr-4 text-right">
                    <Qty value={s.pickupB} />
                  </td>
                  <td className="pr-4">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="relative h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-800"
                        role="img"
                        aria-label={`α ${s.aOnTruck}, β ${s.bOnTruck} de ${Q}`}
                      >
                        <span className="absolute inset-y-0 left-0 bg-alpha" style={{ width: `${aPct}%` }} />
                        {s.bOnTruck > 0 && (
                          <span
                            className="absolute inset-y-0 bg-beta"
                            style={{
                              left: `calc(${aPct}% + ${s.aOnTruck > 0 ? 2 : 0}px)`,
                              width: `max(0px, calc(${bPct}% - ${s.aOnTruck > 0 ? 2 : 0}px))`,
                            }}
                          />
                        )}
                      </span>
                      <span className="num whitespace-nowrap text-zinc-200">
                        {load}
                        <span className="text-zinc-500">/{Q}</span>
                      </span>
                      <span className="num text-[11.5px] text-zinc-500">{fmtPct(load / Q)}</span>
                    </span>
                  </td>
                  <td className="num pr-4 text-right whitespace-nowrap">
                    {s.handlingCount > 0 ? (
                      <>
                        <span className="text-zinc-100">{s.handlingCount}</span>
                        <span className="ml-2 text-handling">+{fmt(s.handlingCost)}</span>
                      </>
                    ) : (
                      <span className="text-zinc-500">0</span>
                    )}
                  </td>
                  <td className="pr-4">
                    <PolicyCell model={model} policy={policy} />
                  </td>
                  <td className={cn('num pr-5 text-right sm:pr-6', isCurrent ? 'font-medium text-zinc-50' : 'text-zinc-300')}>{fmt(z)}</td>
                </motion.tr>
              );
            })}
          </motion.tbody>
          <tfoot>
            <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:z-10 [&>td]:border-t [&>td]:border-zinc-700/80 [&>td]:bg-zinc-900/95 [&>td]:py-3 [&>td]:backdrop-blur-md">
              <td className="pl-5 text-[11px] font-medium text-zinc-500 sm:pl-6" colSpan={2}>
                <span className="eyebrow text-zinc-400">Σ Total del tour</span>
              </td>
              <td className="num pr-4 text-right text-zinc-50">
                {fmtAuto(totals.dist, 1)}
                <span className="text-zinc-500"> km</span>
              </td>
              <td className="num pr-4 text-right text-zinc-50">{totals.a}</td>
              <td className="num pr-4 text-right text-zinc-50">{totals.b}</td>
              <td className="pr-4 text-[12px] text-zinc-500">Q = {Q}</td>
              <td className="num pr-4 text-right whitespace-nowrap">
                <span className="text-zinc-50">{totals.ops}</span>
                <span className="ml-2 text-handling">+{fmt(totals.cost)}</span>
              </td>
              <td className="pr-4" />
              <td className="pr-5 text-right sm:pr-6">
                <span className="num font-semibold text-zinc-50">Z* {fmt(solution.objectiveValue)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </motion.div>
    </SpotlightCard>
  );
}

function Th({ children, align = 'left', className }: { children: ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 py-2.5 pr-4 font-medium whitespace-nowrap backdrop-blur-md',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Qty({ value }: { value: number }) {
  return value > 0 ? <span className="text-zinc-100">{value}</span> : <span className="text-zinc-500">—</span>;
}

const STATUS_TEXT: Record<RowStatus, string> = { now: 'Tramo actual', done: 'Recorrido', todo: 'Pendiente' };

function StatusDot({ status }: { status: RowStatus }) {
  return (
    <span className="relative grid h-2.5 w-2.5 shrink-0 place-items-center">
      {status === 'now' && <span aria-hidden className="absolute inset-0 animate-ring-ping rounded-full bg-zinc-50/40" />}
      <span
        aria-hidden
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'now' && 'bg-zinc-50',
          status === 'done' && 'bg-zinc-500',
          status === 'todo' && 'border border-zinc-600',
        )}
      />
      <span className="sr-only">{STATUS_TEXT[status]}</span>
    </span>
  );
}

function PolicyCell({ model, policy }: { model: string; policy: 1 | 2 | null }) {
  if (model === 'TSPPD-H' || policy === null) return <span className="text-zinc-500">—</span>;
  const info = POLICY_INFO[policy];
  const hybrid = model === 'TSPPD-H_3';
  return (
    <Chip tone={policy === 1 ? 'p1' : 'p2'} title={`${info.title}. ${info.rule}`}>
      {info.code}
      {hybrid && <span className="opacity-75">· sᵢ = {policy === 1 ? 1 : 0}</span>}
    </Chip>
  );
}
