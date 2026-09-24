/**
 * Stepper vertical de la coreografía de una parada: cada fase física
 * (llegada, evacuación, entrega, recarga, recogida…) es una fila con su icono,
 * su conteo de unidades y, en la fila actual, el detalle y el costo imputado.
 */
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, MoveHorizontal } from 'lucide-react';
import type { Choreography, StopPlan } from '../../lib/choreography';
import type { SolutionData } from '../../types/solution';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { springSoft, scrollBehavior } from '../../lib/motion';
import { Chip } from '../ui';
import { PHASE_ICON, TONE_BAR, TONE_TILE, TONE_TO_CHIP, phaseCounts } from './shared';

export interface PhaseStepperProps {
  stop: StopPlan;
  choreo: Choreography;
  solution: SolutionData;
  /** Fase actual (subStep). Se ignora en modo vista previa. */
  current: number;
  /** Vista previa (en tránsito): todas las filas atenuadas, sin fila expandida. */
  preview?: boolean;
  playing: boolean;
  speed: number;
  onSelect: (index: number) => void;
  /** Contenedor con scroll para mantener visible la fila actual. */
  scrollRef?: RefObject<HTMLDivElement | null>;
}

type RowState = 'done' | 'current' | 'future';

export function PhaseStepper({ stop, choreo, solution, current, preview, playing, speed, onSelect, scrollRef }: PhaseStepperProps) {
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const counts = useMemo(() => stop.phases.map((p) => phaseCounts(p, choreo, solution)), [stop, choreo, solution]);
  const last = stop.phases.length - 1;

  // Mantiene la fila actual a la vista dentro del panel (sin mover la página).
  useEffect(() => {
    if (preview) return;
    const container = scrollRef?.current;
    if (!container) return;
    const t = window.setTimeout(() => {
      const row = rowRefs.current[current];
      if (!row) return;
      if (current === 0) {
        container.scrollTo({ top: 0, behavior: scrollBehavior() });
        return;
      }
      const c = container.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      const tooHigh = r.top < c.top + 8;
      const tooLow = r.bottom > c.bottom - 8;
      if (tooHigh || tooLow) {
        const delta = tooHigh ? r.top - c.top - 12 : Math.min(r.bottom - c.bottom + 12, r.top - c.top - 12);
        container.scrollBy({ top: delta, behavior: scrollBehavior() });
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [current, preview, scrollRef, stop.stepIndex]);

  return (
    <ol className="relative" aria-label={`Fases de la parada en ${stop.label}`}>
      {stop.phases.map((phase, i) => {
        const state: RowState = preview ? 'future' : i < current ? 'done' : i === current ? 'current' : 'future';
        const Icon = PHASE_ICON[phase.kind];
        const c = counts[i];
        const moved = c.A + c.B;
        const isCurrent = state === 'current';
        const reload = phase.kind === 'reload-a' || phase.kind === 'reload-b';
        const title =
          preview ? `Ir a «${phase.title}»` : i === 0 && current > 0 ? 'Repetir la parada desde la llegada' : phase.title;

        return (
          <li
            key={`${stop.stepIndex}-${i}`}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className="relative"
          >
            {i < last && (
              <span aria-hidden className="absolute top-[36px] -bottom-[4px] left-[21.5px] w-px overflow-hidden bg-zinc-800">
                <motion.span
                  className="absolute inset-0 origin-top bg-zinc-500"
                  initial={false}
                  animate={{ scaleY: !preview && i < current ? 1 : 0 }}
                  transition={springSoft}
                />
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={isCurrent ? 'step' : undefined}
              title={title}
              className={cn(
                'group relative flex w-full items-start gap-3 rounded-xl px-2 py-1 text-left transition-colors duration-150',
                isCurrent ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/30',
              )}
            >
              <span
                className={cn(
                  'relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl border transition-[opacity,box-shadow] duration-200',
                  state === 'done' ? 'border-zinc-700/70 bg-zinc-800 text-zinc-300' : TONE_TILE[phase.tone],
                  state === 'future' && 'opacity-55 group-hover:opacity-90',
                  isCurrent && 'shadow-[0_0_0_3px_rgb(9_9_11),0_0_0_4px_rgb(244_244_245/0.18)]',
                )}
              >
                {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Icon className="h-3.5 w-3.5" />}
              </span>

              <span className="min-w-0 flex-1 py-1">
                <span className="flex min-h-5 items-center gap-2">
                  <span
                    className={cn(
                      'min-w-0 tracking-tight transition-colors sm:truncate',
                      isCurrent ? 'text-[13.5px] font-semibold text-zinc-50' : 'text-[13px] font-medium',
                      state === 'done' && 'text-zinc-400',
                      state === 'future' && 'text-zinc-500 group-hover:text-zinc-300',
                    )}
                  >
                    {isCurrent ? phase.title : phase.short}
                  </span>
                  <span className={cn('ml-auto flex shrink-0 items-center gap-1', state === 'future' && 'opacity-60')}>
                    {c.slide > 0 && (
                      <Chip tone="muted" title={`${c.slide} unidades se reacomodan sin costo`}>
                        <MoveHorizontal className="h-3 w-3" />
                        {c.slide}
                      </Chip>
                    )}
                    {moved > 0 && (
                      <Chip tone={TONE_TO_CHIP[phase.tone]}>
                        {c.A > 0 && c.B > 0 ? `${c.A}α · ${c.B}β` : c.A > 0 ? `${c.A} α` : `${c.B} β`}
                      </Chip>
                    )}
                    <span className="num w-5 text-right text-[10px] text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                </span>

                <AnimatePresence initial={false}>
                  {isCurrent && (
                    <motion.span
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={springSoft}
                      className="block overflow-hidden"
                    >
                      <span className="block max-w-[65ch] pt-1 text-[12.5px] leading-relaxed text-pretty text-zinc-400">
                        {phase.detail}
                      </span>
                      {c.cost > 0 && (
                        <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-zinc-400">
                          <Chip tone="handling">+{fmt(c.cost)}</Chip>
                          de manipulación
                          <span className="num text-zinc-500">
                            ({phase.costedUnits} × h)
                          </span>
                        </span>
                      )}
                      {reload && (
                        <span className="mt-1.5 block text-[11.5px] text-zinc-500">
                          Recarga desde el andén: el costo ya se imputó al evacuar.
                        </span>
                      )}
                      {playing && (
                        <span className="mt-2.5 block h-[3px] overflow-hidden rounded-full bg-zinc-800" aria-hidden>
                          <motion.span
                            key={`${stop.stepIndex}-${i}-${speed}`}
                            className={cn('block h-full origin-left rounded-full', TONE_BAR[phase.tone])}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: phase.durationMs / speed / 1000, ease: 'linear' }}
                          />
                        </span>
                      )}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
