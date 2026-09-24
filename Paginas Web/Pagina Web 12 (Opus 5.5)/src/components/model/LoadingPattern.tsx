import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { ModelType } from '../../types/solution';
import { cn } from '../../lib/cn';
import { spring } from '../../lib/motion';
import { Tex } from './Tex';

type Kind = 'A' | 'B' | 'E';

interface Segment {
  /** Identidad estable del bloque: permite animar su desplazamiento entre políticas. */
  key: string;
  kind: Kind;
  grow: number;
  label: string;
  variable: string;
  hint?: string;
}

/**
 * Bloques desde el frente (F, cabina) hasta la compuerta (R), como en el paper:
 * (F, a…a, b…b, R) etc. El bloque β "B1" es el mismo en P1, P2 y P3, de modo que
 * al cambiar de pestaña se ve cómo viaja de la compuerta al fondo.
 */
const SEGMENTS: Record<Exclude<ModelType, 'TSPPD-H'>, Segment[]> = {
  'TSPPD-H_1': [
    { key: 'A', kind: 'A', grow: 5, label: 'α … α', variable: 'y_{ij}' },
    { key: 'B1', kind: 'B', grow: 3, label: 'β … β', variable: 'z_{ij}' },
  ],
  'TSPPD-H_2': [
    { key: 'B1', kind: 'B', grow: 3, label: 'β … β', variable: 'z_{ij}' },
    { key: 'A', kind: 'A', grow: 5, label: 'α … α', variable: 'y_{ij}' },
  ],
  'TSPPD-H_3': [
    { key: 'B1', kind: 'B', grow: 2.4, label: 'β … β', variable: 'w_{ij}', hint: 's_i = 0' },
    { key: 'A', kind: 'A', grow: 4, label: 'α … α', variable: 'y_{ij}' },
    { key: 'B2', kind: 'B', grow: 2.4, label: 'β … β', variable: 'z_{ij}', hint: 's_i = 1' },
  ],
};

/** Modelo general: posiciones libres, cualquier mezcla de a, b y huecos (ejemplo ilustrativo). */
const FREE: Kind[] = ['A', 'B', 'A', 'A', 'E', 'B', 'A', 'B', 'E', 'A', 'B', 'A'];

const KIND_CLASS: Record<Kind, string> = {
  A: 'border-alpha/45 bg-alpha/18 text-alpha',
  B: 'border-beta/40 bg-beta/14 text-beta',
  E: 'border-dashed border-zinc-700 bg-transparent text-zinc-500',
};

const PALLET_TEXTURE =
  'bg-[repeating-linear-gradient(90deg,transparent_0_9px,rgb(255_255_255/0.07)_9px_10px)]';

function Cab() {
  return (
    <div aria-hidden className="relative flex w-9 shrink-0 flex-col items-center justify-center rounded-l-[14px] rounded-r-md border border-zinc-700 bg-zinc-800/80">
      <span className="absolute top-1.5 left-1.5 h-2.5 w-4 rounded-sm bg-zinc-600/70" />
      <span className="mt-3 font-mono text-[11px] font-semibold text-zinc-200">F</span>
    </div>
  );
}

function Gate() {
  return (
    <div aria-hidden className="flex w-6 shrink-0 flex-col items-center justify-center gap-1">
      <span className="h-full w-[3px] rounded-full bg-zinc-100 shadow-[0_0_12px_rgb(255_255_255/0.35)]" />
    </div>
  );
}

export function LoadingPattern({ model }: { model: ModelType }) {
  const free = model === 'TSPPD-H';
  const segments = free ? null : SEGMENTS[model];

  return (
    <figure className="min-w-0">
      <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-zinc-400">
        <span>Frente (cabina)</span>
        <span>Compuerta (R)</span>
      </div>

      <div className="flex h-16 items-stretch gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-1.5">
        <Cab />
        <LayoutGroup id="loading-pattern">
          <div className="relative flex min-w-0 flex-1 items-stretch gap-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {free
                ? FREE.map((kind, i) => (
                    <motion.div
                      key={`free-${i}`}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1, transition: { ...spring, delay: i * 0.02 } }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={cn('min-w-0 flex-1 rounded-md border', KIND_CLASS[kind])}
                    />
                  ))
                : segments!.map((s) => (
                    <motion.div
                      key={s.key}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={spring}
                      style={{ flexGrow: s.grow, flexBasis: 0 }}
                      className={cn(
                        'flex min-w-0 items-center justify-center overflow-hidden rounded-xl border font-mono text-xs font-semibold',
                        KIND_CLASS[s.kind],
                        PALLET_TEXTURE,
                      )}
                    >
                      <span className="truncate px-1">{s.label}</span>
                    </motion.div>
                  ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
        <Gate />
      </div>

      {/* Variables asociadas a cada bloque */}
      <div className="mt-2 flex gap-1.5 px-1.5 text-[12px] text-zinc-400">
        <span className="w-9 shrink-0" />
        {free ? (
          <div className="flex flex-1 items-center justify-between">
            <span className="num text-[11px] text-zinc-500">k = Q</span>
            <span className="text-zinc-400">
              <Tex tex="a_{ij}^k,\ b_{ij}^k" /> por posición
            </span>
            <span className="num text-[11px] text-zinc-500">k = 1</span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 gap-1">
            {segments!.map((s) => (
              <motion.div
                key={s.key}
                layout
                transition={spring}
                style={{ flexGrow: s.grow, flexBasis: 0 }}
                className="flex min-w-0 flex-col items-center gap-0.5 text-center"
              >
                <Tex tex={s.variable} className="text-zinc-300" />
                {s.hint && <span className="num truncate text-[10.5px] text-zinc-500">{s.hint}</span>}
              </motion.div>
            ))}
          </div>
        )}
        <span className="w-6 shrink-0" />
      </div>

      <figcaption className="sr-only">
        {free
          ? 'Modelo general: cada posición k del camión puede contener una unidad a, una b o quedar libre.'
          : `Patrón de carga desde el frente hasta la compuerta: ${segments!.map((s) => s.label).join(', ')}.`}
      </figcaption>
    </figure>
  );
}
