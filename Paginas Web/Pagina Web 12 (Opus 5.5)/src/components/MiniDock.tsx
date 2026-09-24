import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Pause, Play, RotateCcw } from 'lucide-react';
import { useProgress, useSim } from '../state/SimulationProvider';
import { scrollBehavior, springSnappy } from '../lib/motion';
import { cn } from '../lib/cn';

/** Barra de avance del tour (se suscribe al progreso a 60 fps de forma aislada). */
function TourBar() {
  const { solution, stepIndex, arrived, mode } = useSim();
  const progress = useProgress();
  if (!solution) return null;
  const steps = solution.steps;
  const total = steps.reduce((a, s) => a + s.distance, 0) || 1;
  let done = 0;
  if (mode === 'finished') done = total;
  else if (mode !== 'initial') {
    for (let i = 0; i < stepIndex; i++) done += steps[i].distance;
    done += steps[stepIndex].distance * (arrived ? 1 : progress);
  }
  return (
    <span className="relative block h-1 w-24 overflow-hidden rounded-full bg-zinc-800 sm:w-32">
      <span className="absolute inset-y-0 left-0 rounded-full bg-zinc-100" style={{ width: `${(done / total) * 100}%` }} />
    </span>
  );
}

/**
 * Mini reproductor flotante: aparece cuando el usuario baja a Bitácora, Comparativa…
 * y el dock principal (sticky en #simulador) ya quedó fuera de la vista.
 */
export function MiniDock() {
  const { solution, status, mode, stepIndex, stop, actions } = useSim();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = document.getElementById('simulador');
    if (!section) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: '0px 0px -120px 0px' },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [solution]);

  if (!solution) return null;
  const playing = status === 'playing';
  const finished = mode === 'finished';
  const Icon = playing ? Pause : finished ? RotateCcw : Play;
  const where = mode === 'initial' ? 'Depósito' : stop?.label ?? '';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="Mini reproductor"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={springSnappy}
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/85 py-1.5 pr-1.5 pl-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={actions.toggle}
            aria-label={playing ? 'Pausar' : finished ? 'Repetir tour' : 'Reproducir'}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Icon className={cn('h-4 w-4', !playing && !finished && 'translate-x-px')} fill={playing || finished ? 'none' : 'currentColor'} />
          </button>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-baseline gap-2 text-xs whitespace-nowrap">
              <span className="num text-zinc-400">
                {mode === 'initial' ? 0 : stepIndex + 1}/{solution.steps.length}
              </span>
              <span className="max-w-[9rem] truncate font-medium text-zinc-100">{where}</span>
            </span>
            <TourBar />
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('simulador')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })}
            aria-label="Volver al simulador"
            title="Volver al simulador"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Simulador</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
