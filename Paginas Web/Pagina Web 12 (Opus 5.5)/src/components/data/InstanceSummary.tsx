import { Fragment, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Braces, Check, Copy, Package, Route, Server } from 'lucide-react';
import { useSim } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { modelMeta } from '../../lib/models';
import { nodePolicy } from '../../lib/policy';
import { fmt, fmtAuto, fmtPct } from '../../lib/format';
import { springSnappy, staggerChild } from '../../lib/motion';
import { cn } from '../../lib/cn';
import { Button, Chip, SpotlightCard } from '../ui';
import { useCopy } from '../model/useCopy';
import { instanceFacts, jumpToSimulator, nodeLabel } from './instance';

function Param({ label, sym, value, sub, children }: { label: string; sym?: ReactNode; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-zinc-900/80 px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-[11.5px] text-zinc-400">
        {sym && <span className="num text-zinc-300">{sym}</span>}
        {label}
      </dt>
      <dd className="num text-[22px] leading-tight font-medium tracking-tight text-zinc-50">{value}</dd>
      {children}
      {sub && <dd className="truncate text-[11.5px] text-zinc-400">{sub}</dd>}
    </div>
  );
}

/** Escalonado rápido: el tour puede tener 20+ elementos. */
const tourStagger = { hidden: {}, show: { transition: { staggerChildren: 0.022, delayChildren: 0.05 } } };

const SOURCE: Record<'api' | 'static', { label: string; icon: typeof Server }> = {
  api: { label: 'API en vivo · Outputs/', icon: Server },
  static: { label: 'Empaquetado · public/solutions', icon: Package },
};

export function InstanceSummary() {
  const { solution, meta, source, activeModel, actions, mode, stepIndex, arrived } = useSim();
  const { hoverNode, setHoverNode } = useHover();
  const { copied, copy } = useCopy();
  const facts = useMemo(() => (solution ? instanceFacts(solution) : null), [solution]);

  if (!solution || !facts) return null;

  const Q = solution.capacity;
  const filename = meta?.filename ?? `${solution.instance}.json`;
  const model = modelMeta(activeModel);
  const peakStep = solution.steps[facts.peakStep];
  const showHaHb = solution.h_a !== undefined && solution.h_b !== undefined;
  const src = source ? SOURCE[source] : null;
  const SrcIcon = src?.icon ?? Server;

  // Posición del camión en la secuencia: nodo k del tour (0 = salida del depósito).
  const liveIndex =
    mode === 'initial' ? 0 : mode === 'finished' ? solution.tour.length - 1 : arrived ? stepIndex + 1 : null;
  const liveArrow = mode === 'transit' ? stepIndex : null;

  const goTo = (k: number) => jumpToSimulator(() => (k === 0 ? actions.reset() : actions.selectStep(k - 1)));

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Parámetros */}
        <section className="min-w-0 lg:col-span-5" aria-label="Parámetros de la instancia">
          <p className="eyebrow">Parámetros</p>
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
            <Param label="Capacidad" sym="Q" value={Q} sub="unidades por camión" />
            <Param
              label="Costo por operación"
              sym="h"
              value={fmtAuto(solution.h, 3)}
              sub={showHaHb ? `h_a = ${fmtAuto(solution.h_a!, 3)} · h_b = ${fmtAuto(solution.h_b!, 3)}` : 'por unidad manipulada'}
            />
            <Param label="Tramos" value={solution.steps.length} sub={`${solution.numCustomers} clientes + retorno`} />
            <Param
              label="Entregas"
              sym={
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-alpha" />Σα
                </span>
              }
              value={facts.sumAlpha}
              sub="salen del depósito"
            />
            <Param
              label="Recogidas"
              sym={
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-beta" />Σβ
                </span>
              }
              value={facts.sumBeta}
              sub="vuelven al depósito"
            />
            <Param
              label="Carga pico"
              value={
                <>
                  {facts.peakLoad}
                  <span className="text-[14px] text-zinc-400">/{Q}</span>
                </>
              }
              sub={peakStep ? `${nodeLabel(peakStep.from)} → ${nodeLabel(peakStep.to)} · ${fmtPct(Q ? facts.peakLoad / Q : 0)}` : undefined}
            >
              <dd aria-hidden className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                <motion.span
                  className="block h-full rounded-full bg-zinc-200"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.min(100, (facts.peakLoad / (Q || 1)) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 300, damping: 34 }}
                />
              </dd>
            </Param>
          </dl>
        </section>

        {/* Tour y archivo */}
        <section className="flex min-w-0 flex-col gap-6 lg:col-span-7" aria-label="Tour y archivo de la solución">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow flex items-center gap-2">
                <Route aria-hidden className="h-3.5 w-3.5" />
                Secuencia del tour
              </p>
              <span className="num text-[11.5px] text-zinc-400">
                {fmtAuto(solution.totalDistance)} de ruteo · {fmt(solution.handlingCost, 2)} de manipulación
              </span>
            </div>
            <motion.ol
              key={filename}
              variants={tourStagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              aria-label="Orden de visita"
              className="mt-3 flex flex-wrap items-center gap-y-2"
            >
              {solution.tour.map((id, k) => {
                const live = liveIndex === k;
                const policy = nodePolicy(solution, id);
                return (
                  <Fragment key={`${id}-${k}`}>
                    {k > 0 && (
                      <motion.li variants={staggerChild} aria-hidden className="px-1">
                        <ArrowRight
                          className={cn(
                            'h-3 w-3 transition-colors',
                            liveArrow === k - 1 ? 'animate-soft-pulse text-zinc-50' : 'text-zinc-500',
                          )}
                        />
                      </motion.li>
                    )}
                    <motion.li variants={staggerChild}>
                      <motion.button
                        type="button"
                        whileHover={{ y: -2, scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        transition={springSnappy}
                        onClick={() => goTo(k)}
                        onMouseEnter={() => setHoverNode(id)}
                        onMouseLeave={() => setHoverNode(null)}
                        onFocus={() => setHoverNode(id)}
                        onBlur={() => setHoverNode(null)}
                        aria-label={`${k === 0 ? 'Salida' : `Parada ${k}`}: ${id === 0 ? 'depósito' : `cliente ${id}`}`}
                        aria-current={live ? 'step' : undefined}
                        className={cn(
                          'num inline-flex h-7 min-w-8 items-center justify-center rounded-xl border px-2 text-[12px] font-medium transition-colors',
                          id === 0
                            ? 'border-zinc-200 bg-zinc-100 text-zinc-950'
                            : cn(
                                'bg-zinc-900 text-zinc-100',
                                policy === 1 ? 'border-p1/45' : policy === 2 ? 'border-p2/45' : 'border-zinc-700',
                              ),
                          (hoverNode === id || live) && id !== 0 && 'bg-zinc-800 text-zinc-50',
                          live && 'ring-2 ring-zinc-50/80 ring-offset-2 ring-offset-zinc-900',
                        )}
                      >
                        {id === 0 ? 'D' : id}
                      </motion.button>
                    </motion.li>
                  </Fragment>
                );
              })}
            </motion.ol>
            {activeModel === 'TSPPD-H_3' && (
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] border border-p1/60" /> s_i = 1
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] border border-p2/60" /> s_i = 0
                </span>
              </p>
            )}
          </div>

          <div className="mt-auto grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 py-1.5 pr-1.5 pl-3">
              <Braces aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-400">Archivo de la solución</p>
                <code className="num block truncate text-[12.5px] text-zinc-100" title={filename}>
                  {filename}
                </code>
              </div>
              <Button
                variant="secondary"
                size="xs"
                flat
                onClick={() => void copy('file', filename)}
                aria-label={copied === 'file' ? 'Nombre copiado' : 'Copiar nombre del archivo'}
                className="w-[5.75rem]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied === 'file' ? 'ok' : 'copy'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={springSnappy}
                    className="inline-flex items-center gap-1.5"
                  >
                    {copied === 'file' ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === 'file' ? 'Copiado' : 'Copiar'}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:justify-center">
              <Chip tone={model.tone} size="sm">
                {model.label}
              </Chip>
              {src && (
                <Chip tone="muted" size="sm" mono={false} title="Origen de los datos">
                  <SrcIcon aria-hidden className="h-3 w-3" />
                  {src.label}
                </Chip>
              )}
            </div>
          </div>
        </section>
      </div>
    </SpotlightCard>
  );
}
