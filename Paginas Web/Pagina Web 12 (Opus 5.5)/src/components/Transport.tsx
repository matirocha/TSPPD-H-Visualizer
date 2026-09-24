/**
 * Dock de reproducción fijo al pie: controles de transporte, línea de tiempo
 * proporcional a la distancia (con decisiones P3 y manipulaciones), velocidad,
 * modo continuo y lectura de la parada actual.
 */
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useSim } from '../state/SimulationProvider';
import type { AnimationSpeed } from '../types/solution';
import { cn } from '../lib/cn';
import { springSoft } from '../lib/motion';
import { Button, Segmented, Switch } from './ui';
import { Timeline } from './transport/Timeline';

const CONTINUOUS_HINT = 'ON: avanza solo por todas las paradas · OFF: se detiene al llegar a cada parada';

const SPEEDS: AnimationSpeed[] = [0.5, 1, 1.5, 2];
const speedText = (v: AnimationSpeed) => `${String(v).replace('.', ',')}×`;

const SPEED_OPTIONS: { value: AnimationSpeed; label: ReactNode; ariaLabel: string; title: string }[] = SPEEDS.map((v) => ({
  value: v,
  label: <span>{speedText(v)}</span>,
  ariaLabel: `Velocidad ${speedText(v)}`,
  title: `Velocidad ${speedText(v)} ( [ / ] )`,
}));

function Readout({ className }: { className?: string }) {
  const { solution, mode, stepIndex, status } = useSim();
  const N = solution?.steps.length ?? 0;
  const k = mode === 'initial' ? 0 : stepIndex + 1;
  const label =
    mode === 'initial'
      ? 'en depósito'
      : mode === 'transit'
        ? status === 'playing'
          ? 'en ruta'
          : 'en pausa'
        : mode === 'stop'
          ? status === 'playing'
            ? 'operando'
            : 'detenido'
          : 'completado';
  return (
    <div className={cn('min-w-[68px] flex-col items-end leading-tight', className)} aria-live="polite">
      <span className="num text-xs whitespace-nowrap text-zinc-400">
        Parada{' '}
        <span className="text-zinc-50">
          {k}/{N}
        </span>
      </span>
      <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
        <span
          aria-hidden
          className={cn(
            'h-1 w-1 rounded-full',
            status === 'playing' ? 'animate-soft-pulse bg-zinc-100' : mode === 'finished' ? 'bg-ok' : 'bg-zinc-600',
          )}
        />
        {label}
      </span>
    </div>
  );
}

/**
 * `embedded`: versión sin posicionamiento sticky para los paneles a pantalla completa
 * (mapa y compartimiento), que así conservan todos los controles de reproducción.
 */
export function Transport({ embedded = false }: { embedded?: boolean } = {}) {
  const { solution, mode, status, speed, continuous, stepIndex, arrived, actions } = useSim();
  if (!solution) return null;

  const N = solution.steps.length;
  const playing = status === 'playing';
  const finished = mode === 'finished';
  const atStart = mode === 'initial' && !playing;
  const playLabel = playing ? 'Pausar' : finished ? 'Repetir' : mode === 'initial' ? 'Iniciar ruta' : 'Reanudar';
  const PlayIcon = playing ? Pause : finished ? RotateCcw : Play;

  return (
    // Sticky dentro de #simulador: acompaña mientras se recorre el escenario y, al final,
    // descansa bajo el compartimiento sin taparlo. Fuera del simulador aparece <MiniDock/>.
    <div
      className={embedded ? 'shrink-0' : 'pointer-events-none sticky bottom-0 z-50 pt-2 pb-3'}
      role="region"
      aria-label={embedded ? 'Reproducción del tour (pantalla completa)' : 'Reproducción del tour'}
    >
      <motion.div
        initial={embedded ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className={cn(
          'pointer-events-auto rounded-2xl border border-zinc-800 px-3 py-2.5',
          embedded ? 'bg-zinc-900/60' : 'mx-auto max-w-[1200px] bg-zinc-950/80 shadow-2xl shadow-black/50 backdrop-blur-xl',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap">
          {/* Transporte */}
          <div className="order-1 flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" flat onClick={actions.reset} disabled={atStart} aria-label="Reiniciar tour" title="Reiniciar tour (R)">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              flat
              onClick={actions.prevStop}
              disabled={mode === 'initial'}
              aria-label="Parada anterior"
              title="Parada anterior (Shift + ←)"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={actions.toggle}
              aria-label={playLabel}
              title={`${playLabel} (Espacio)`}
              className="sm:min-w-[122px]"
            >
              <motion.span
                key={playLabel}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springSoft}
                className="inline-flex"
              >
                <PlayIcon className={cn('h-3.5 w-3.5', !finished && 'fill-current')} />
              </motion.span>
              <span className="hidden sm:inline">{playLabel}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              flat
              onClick={actions.nextStop}
              disabled={finished || (stepIndex >= N - 1 && arrived)}
              aria-label="Parada siguiente"
              title="Parada siguiente (Shift + →)"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>

          <span aria-hidden className="order-1 hidden h-6 w-px bg-zinc-800 lg:block" />

          {/* Línea de tiempo (segunda fila bajo lg) */}
          <div className="order-3 flex w-full min-w-0 items-center gap-3 px-1 lg:order-2 lg:w-auto lg:flex-1 lg:px-0">
            <Timeline />
            <Readout className="flex lg:hidden" />
          </div>

          {/* Velocidad · continuo · lectura */}
          <div className="order-2 ml-auto flex items-center gap-2.5 lg:order-3 lg:ml-0">
            <span aria-hidden className="hidden h-6 w-px bg-zinc-800 lg:block" />
            <Segmented<AnimationSpeed>
              size="xs"
              options={SPEED_OPTIONS}
              value={speed}
              onChange={actions.setSpeed}
              ariaLabel="Velocidad de reproducción"
              className="hidden sm:inline-flex"
            />
            <Button
              variant="outline"
              size="xs"
              flat
              onClick={() => actions.setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
              aria-label={`Velocidad ${speedText(speed)}; pulsa para cambiar`}
              className="num min-w-[44px] sm:hidden"
            >
              {speedText(speed)}
            </Button>
            <Switch
              checked={continuous}
              onChange={actions.setContinuous}
              label="Continuo"
              title={CONTINUOUS_HINT}
              className="hidden sm:inline-flex"
            />
            <Switch
              checked={continuous}
              onChange={actions.setContinuous}
              label="Modo continuo"
              showLabel={false}
              title={CONTINUOUS_HINT}
              className="sm:hidden"
            />
            <span aria-hidden className="hidden h-6 w-px bg-zinc-800 lg:block" />
            <Readout className="hidden lg:flex" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
