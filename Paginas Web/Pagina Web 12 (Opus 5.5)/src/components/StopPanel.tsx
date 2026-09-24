/**
 * Panel de parada: narrativa y coreografía de lo que ocurre AHORA.
 * - Depósito (antes de partir): manifiesto de la carga inicial.
 * - Tránsito: avance del tramo en vivo y vista previa de la parada siguiente.
 * - Parada: stepper vertical de fases con detalle, costo y autoavance.
 * - Fin: resumen del tour (Z*, distancia, manipulación).
 */
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, FileText, Flag, Play, RotateCcw, ScrollText, SkipForward } from 'lucide-react';
import { useSim } from '../state/SimulationProvider';
import { useHover } from '../state/UIProvider';
import { cn } from '../lib/cn';
import { fmt, fmtKm } from '../lib/format';
import { spring, springSoft } from '../lib/motion';
import { sanitizeExplanation } from '../lib/sanitize';
import { Button, Chip, SpotlightCard } from './ui';
import { PhaseStepper } from './stop/PhaseStepper';
import { FinishedBody, InitialBody, LegProgress, OnBoard, PolicyCallout, StopKpis } from './stop/bodies';
import { PolicyChip, cleanExplanation, nodeLabel, plural, scrollToSection } from './stop/shared';

/** Título que resalta el nodo en el mapa al pasar el puntero (aislado para no re-renderizar el panel). */
function NodeTitle({ node, children }: { node: number | null; children: ReactNode }) {
  const { setHoverNode } = useHover();
  if (node === null) return <>{children}</>;
  return (
    <span onMouseEnter={() => setHoverNode(node)} onMouseLeave={() => setHoverNode(null)} className="cursor-default">
      {children}
    </span>
  );
}

export function StopPanel() {
  const { solution, choreo, mode, step, stop, stepIndex, subStep, status, speed, activeModel, actions } = useSim();
  const [detailOpen, setDetailOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const detailId = useId();

  const explanation = useMemo(
    () => (step?.explanation ? cleanExplanation(sanitizeExplanation(step.explanation)) : ''),
    [step],
  );

  if (!solution || !choreo || !step || !stop) {
    return (
      <SpotlightCard className="grid h-full min-h-[360px] place-items-center p-6 xl:h-[440px]">
        <p className="text-sm text-zinc-500">Preparando la parada…</p>
      </SpotlightCard>
    );
  }

  const N = solution.steps.length;
  const lastStep = stepIndex >= N - 1;
  const lastPhase = subStep >= stop.phases.length - 1;
  const playing = status === 'playing';
  const p3Stop = activeModel === 'TSPPD-H_3' && !stop.isDepot && stop.policy !== null;
  const fromLabel = nodeLabel(solution, step.from);
  const toLabel = nodeLabel(solution, step.to);
  const totalKm = solution.totalDistance || solution.steps.reduce((a, s) => a + s.distance, 0);
  // Como en la Página 10, el detalle del solver está disponible siempre que exista
  // (antes de partir muestra el primer tramo; al terminar, el retorno al depósito).
  const canDetail = !!explanation;

  const eyebrow =
    mode === 'initial'
      ? 'Depósito · antes de partir'
      : mode === 'transit'
        ? `En tránsito · tramo ${stepIndex + 1} de ${N}`
        : mode === 'stop'
          ? `Parada ${stepIndex + 1} de ${N}`
          : 'Tour completado';
  const title = mode === 'initial' ? nodeLabel(solution, 0) : mode === 'finished' ? 'De vuelta en el depósito' : stop.label;
  const titleNode = mode === 'initial' || mode === 'finished' ? 0 : stop.to;
  const titleKey = mode === 'initial' ? 'initial' : mode === 'finished' ? 'finished' : `s${stepIndex}`;

  return (
    <SpotlightCard className="flex h-full min-h-[360px] flex-col overflow-hidden xl:h-[440px]" role="region" aria-label="Panel de la parada">
      {/* ── Encabezado */}
      <header className="border-b border-zinc-800/70 px-5 pt-4 pb-3.5">
        <div className="flex min-h-7 items-center justify-between gap-3 sm:h-7">
          <p className="eyebrow flex min-w-0 items-center gap-2 sm:truncate">
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                playing ? 'animate-soft-pulse bg-zinc-100' : mode === 'finished' ? 'bg-ok' : 'bg-zinc-600',
              )}
            />
            <span className="sm:truncate">{eyebrow}</span>
          </p>
          {canDetail && (
            <Button
              variant="ghost"
              size="xs"
              flat
              aria-expanded={detailOpen}
              aria-controls={detailId}
              onClick={() => setDetailOpen((v) => !v)}
              className={cn('-mr-1.5', detailOpen && 'bg-zinc-800/70 text-zinc-50')}
              title="Explicación completa generada por el solver para este tramo"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Detalle del solver</span>
              <span className="sm:hidden">Detalle</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', detailOpen && 'rotate-180')} />
            </Button>
          )}
        </div>

        <div className="relative mt-1 h-8 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h3
              key={titleKey}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={spring}
              className="truncate text-2xl leading-8 font-semibold tracking-tight text-zinc-50"
            >
              <NodeTitle node={titleNode}>{title}</NodeTitle>
            </motion.h3>
          </AnimatePresence>
        </div>

        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
          {mode === 'finished' ? (
            <Chip tone="neutral">
              {N} {plural(N, 'tramo', 'tramos')} · {fmtKm(totalKm)}
            </Chip>
          ) : (
            <Chip tone="neutral" title={mode === 'initial' ? 'Primer tramo del tour' : 'Tramo actual'}>
              {mode === 'initial' && <span className="text-zinc-500">1er tramo ·</span>}
              {fromLabel} <ArrowRight className="h-3 w-3 text-zinc-500" aria-label="hacia" /> {toLabel} · {fmtKm(step.distance)}
            </Chip>
          )}
          {(mode === 'transit' || mode === 'stop') && <PolicyChip model={activeModel} stop={stop} />}
        </div>
      </header>

      {/* ── Detalle del solver (desplegable) */}
      <AnimatePresence initial={false}>
        {canDetail && detailOpen && (
          <motion.div
            id={detailId}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            className="shrink-0 overflow-hidden border-b border-zinc-800/70 bg-zinc-950/40"
          >
            <div className="max-h-[132px] overflow-y-auto px-5 py-3 scrollbar-thin">
              <p className="eyebrow mb-1.5">Tramo {stepIndex + 1} · solver</p>
              <div
                className="max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-300"
                dangerouslySetInnerHTML={{ __html: explanation }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cuerpo según el modo */}
      <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3.5 scrollbar-thin">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${stepIndex}-${mode}`}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10, transition: { duration: 0.12 } }}
            transition={spring}
          >
            {mode === 'initial' && <InitialBody solution={solution} choreo={choreo} />}

            {mode === 'transit' && (
              <div className="space-y-4">
                <LegProgress step={step} fromLabel={fromLabel} toLabel={toLabel} playing={playing} />
                <OnBoard step={step} capacity={solution.capacity} />
                <div>
                  <p className="eyebrow mb-1.5">Al llegar a {stop.label}</p>
                  <p className="text-[13px] leading-relaxed text-pretty text-zinc-400">
                    {stop.isDepot ? (
                      <>
                        Descargar <span className="num font-medium text-beta">{stop.delivered.length} β</span> y cerrar el tour.
                      </>
                    ) : (
                      <>
                        Entregar <span className="num font-medium text-alpha">{step.deliverA} α</span> · recoger{' '}
                        <span className="num font-medium text-beta">{step.pickupB} β</span> ·{' '}
                        {step.handlingCount > 0 ? (
                          <span className="num font-medium text-handling">
                            {step.handlingCount} {plural(step.handlingCount, 'manipulación', 'manipulaciones')} (+{fmt(step.handlingCost)})
                          </span>
                        ) : (
                          <span className="text-zinc-300">sin manipulaciones</span>
                        )}
                        .
                      </>
                    )}
                  </p>
                </div>
                {p3Stop && <PolicyCallout stop={stop} variant="compact" />}
                <div>
                  <p className="eyebrow mb-1">
                    Secuencia prevista · {stop.phases.length} {plural(stop.phases.length, 'fase', 'fases')}
                  </p>
                  <PhaseStepper
                    stop={stop}
                    choreo={choreo}
                    solution={solution}
                    current={0}
                    preview
                    playing={false}
                    speed={speed}
                    onSelect={actions.setSubStep}
                  />
                </div>
              </div>
            )}

            {mode === 'stop' && (
              <div className="space-y-3">
                {p3Stop && <PolicyCallout stop={stop} variant={subStep === 0 ? 'full' : 'line'} />}
                <PhaseStepper
                  stop={stop}
                  choreo={choreo}
                  solution={solution}
                  current={subStep}
                  playing={playing}
                  speed={speed}
                  onSelect={actions.setSubStep}
                  scrollRef={bodyRef}
                />
              </div>
            )}

            {mode === 'finished' && <FinishedBody solution={solution} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Pie: micro-KPIs + controles */}
      <footer className="space-y-2.5 border-t border-zinc-800/70 px-5 py-3">
        {(mode === 'transit' || mode === 'stop') && <StopKpis step={step} stop={stop} />}

        {mode === 'initial' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={actions.play}>
              <Play className="h-3.5 w-3.5 fill-current" />
              Iniciar ruta
            </Button>
            <Button variant="ghost" size="sm" onClick={actions.nextStop}>
              Ver primera parada
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="num ml-auto hidden text-[11px] text-zinc-500 sm:inline">
              {N} {plural(N, 'tramo', 'tramos')} · {fmtKm(totalKm)}
            </span>
          </div>
        )}

        {mode === 'transit' && (
          <div className="flex items-center gap-2">
            <span className="num text-[11px] text-zinc-500">
              Tramo {stepIndex + 1}/{N}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={actions.nextStop} title="Detener el camión en la llegada">
              <SkipForward className="h-3.5 w-3.5" />
              Saltar a la llegada
            </Button>
          </div>
        )}

        {mode === 'stop' && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => actions.setSubStep(0)}
              disabled={subStep === 0}
              aria-label="Repetir la parada desde la llegada"
              title="Repetir la parada"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={actions.prevSubStep} aria-label="Sub-paso anterior" title="Sub-paso anterior (←)">
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="num mx-auto text-[11px] whitespace-nowrap text-zinc-500" aria-live="polite">
              <span className="hidden sm:inline">Sub-paso </span>
              <span className="text-zinc-200">
                {subStep + 1}/{stop.phases.length}
              </span>
            </span>
            <Button variant="primary" size="sm" onClick={actions.nextSubStep} className="min-w-[124px]" title="Siguiente sub-paso (→)">
              {!lastPhase ? (
                <>
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              ) : lastStep ? (
                <>
                  <Flag className="h-3.5 w-3.5" />
                  Finalizar tour
                </>
              ) : (
                <>
                  Continuar ruta
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        )}

        {mode === 'finished' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={actions.play}>
              <RotateCcw className="h-3.5 w-3.5" />
              Repetir tour
            </Button>
            <Button variant="ghost" size="sm" onClick={() => scrollToSection('bitacora')}>
              <ScrollText className="h-3.5 w-3.5" />
              Ver bitácora
            </Button>
          </div>
        )}
      </footer>
    </SpotlightCard>
  );
}
