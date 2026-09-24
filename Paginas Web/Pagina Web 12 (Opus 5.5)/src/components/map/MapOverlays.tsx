/** Superposiciones HTML del mapa: estado del viaje, leyenda con escala, cámara y avisos. */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Locate, LocateFixed, Pause, Play, RotateCcw, SkipBack, SkipForward, ZoomIn, ZoomOut } from 'lucide-react';
import { useSim } from '../../state/SimulationProvider';
import { fmtAuto, fmtKm } from '../../lib/format';
import { cn } from '../../lib/cn';
import { springSnappy } from '../../lib/motion';
import { Button, Kbd, Tooltip } from '../ui';
import { MAX_ZOOM, MIN_ZOOM } from './geometry';

const tag = (id: number) => (id === 0 ? 'D' : `C${id}`);

// ───────────────────────────────────────────────────────────── estado del viaje

export function MapHud() {
  const { mode, stepIndex, step, solution } = useSim();
  if (!solution) return null;
  const N = solution.steps.length;
  let key = 'i';
  let tone: 'idle' | 'live' | 'stop' | 'done' = 'idle';
  let main = 'En depósito';
  let sub = 'listo para partir';
  if (mode === 'transit' && step) {
    key = `t${stepIndex}`;
    tone = 'live';
    main = `Tramo ${stepIndex + 1}/${N}`;
    sub = `${tag(step.from)} → ${tag(step.to)} · ${fmtAuto(step.distance)} km`;
  } else if (mode === 'stop' && step) {
    key = `s${stepIndex}`;
    tone = 'stop';
    main = `Parada ${stepIndex + 1}/${N}`;
    sub = step.to === 0 ? 'Depósito · retorno' : (solution.nodes.find((n) => n.id === step.to)?.label ?? tag(step.to));
  } else if (mode === 'finished') {
    key = 'f';
    tone = 'done';
    main = 'Tour completado';
    sub = fmtKm(solution.totalDistance);
  }
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-24px)]">
      <div className="flex h-7 items-center gap-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 px-2.5 shadow-lg shadow-black/30 backdrop-blur-md">
        <span className="relative flex h-2 w-2 shrink-0">
          {tone === 'live' && <span className="absolute inset-0 animate-ping rounded-full bg-zinc-50 opacity-60" />}
          <span
            className={cn(
              'relative h-2 w-2 rounded-full',
              tone === 'live' && 'bg-zinc-50',
              tone === 'stop' && 'bg-zinc-50 ring-2 ring-zinc-50/25',
              tone === 'idle' && 'bg-zinc-500',
              tone === 'done' && 'bg-ok',
            )}
          />
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={key}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={springSnappy}
            className="num flex min-w-0 items-center gap-2 text-[11px] whitespace-nowrap"
          >
            <span className="text-zinc-100">{main}</span>
            <span className="truncate text-zinc-500">{sub}</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── leyenda

function Item({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {swatch}
      {children}
    </span>
  );
}

function Line({ stroke, dash, opacity = 1, width = 2, glow }: { stroke: string; dash?: string; opacity?: number; width?: number; glow?: boolean }) {
  return (
    <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden className="shrink-0">
      {glow && <line x1="1" y1="4" x2="17" y2="4" stroke="#fafafa" strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round" />}
      <line x1="1" y1="4" x2="17" y2="4" stroke={stroke} strokeOpacity={opacity} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

function PolicyKey() {
  return (
    <>
      <span className="num rounded border border-p1/60 px-1 text-[9px] leading-[13px] font-bold text-p1">P1</span>
      <span className="num rounded border border-p2/60 px-1 text-[9px] leading-[13px] font-bold text-p2">P2</span>
    </>
  );
}

function ScaleBar({ scale }: { scale: { km: number; px: number } }) {
  return (
    <span className="flex items-center gap-1.5" title="Escala aproximada reconstruida desde la matriz c_ij">
      <span className="h-1.5 border-x border-b border-zinc-400 transition-[width] duration-300 ease-out" style={{ width: Math.round(scale.px) }} />
      <span className="num whitespace-nowrap text-zinc-300">{fmtAuto(scale.km)} km</span>
    </span>
  );
}

export function MapLegend({ p3, scale }: { p3: boolean; scale: { km: number; px: number } | null }) {
  return (
    <>
      {/* Compacta (< md), junto a los controles: la clave P1/P2 siempre; la escala solo si
          el lienzo deja sitio al lado del dock de zoom (container query del lienzo). */}
      {(p3 || scale) && (
        <div
          className={cn(
            'pointer-events-none absolute bottom-3 left-3 z-10 h-9 items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/75 px-2 text-[10px] text-zinc-400 shadow-lg shadow-black/30 backdrop-blur-md md:hidden',
            p3 ? 'flex' : 'hidden @min-[460px]:flex',
          )}
        >
          {scale && (
            <span className="hidden @min-[460px]:flex">
              <ScaleBar scale={scale} />
            </span>
          )}
          {p3 && (
            <span className="flex items-center gap-1" title="Decisión s_i de la Política 3 en cada cliente">
              {scale && <span aria-hidden className="mr-1 hidden h-3 w-px bg-zinc-800 @min-[460px]:block" />}
              <PolicyKey />
            </span>
          )}
        </div>
      )}
      <FullLegend p3={p3} scale={scale} />
    </>
  );
}

function FullLegend({ p3, scale }: { p3: boolean; scale: { km: number; px: number } | null }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-col gap-1 rounded-xl border border-zinc-800/80 bg-zinc-950/75 px-2.5 py-1.5 text-[10.5px] text-zinc-400 shadow-lg shadow-black/30 backdrop-blur-md md:flex">
      <div className="flex items-center gap-3">
        <Item swatch={<Line stroke="#d4d4d8" opacity={0.7} />}>recorrido</Item>
        <Item swatch={<Line stroke="#52525b" dash="3 4" width={1.5} />}>pendiente</Item>
        <Item swatch={<Line stroke="#fafafa" width={2.25} glow />}>tramo actual</Item>
      </div>
      <div className="flex h-4 items-center gap-3">
        {scale ? (
          <ScaleBar scale={scale} />
        ) : (
          <span className="text-zinc-500">esquema sin escala</span>
        )}
        {p3 && (
          <>
            <span aria-hidden className="h-3 w-px bg-zinc-800" />
            <span className="flex items-center gap-1">
              <PolicyKey />
              <span className="ml-0.5">decisión s_i</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── cámara

interface ZoomDockProps {
  zoom: number;
  follow: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onToggleFollow: () => void;
}

export function ZoomDock({ zoom, follow, onZoomIn, onZoomOut, onReset, onToggleFollow }: ZoomDockProps) {
  const pct = `${Math.round(zoom * 100)} %`;
  return (
    <div
      data-map-ui
      className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-950/85 p-0.5 shadow-lg shadow-black/40 backdrop-blur-md"
    >
      <Tooltip side="top" align="end" content="La cámara se centra en el camión mientras avanza (acerca a 200 % si el mapa está completo).">
        <Button
          variant={follow ? 'primary' : 'ghost'}
          size="sm"
          flat
          aria-pressed={follow}
          aria-label="Seguir camión"
          onClick={onToggleFollow}
          className="h-8 px-2.5"
        >
          {follow ? <LocateFixed className="h-3.5 w-3.5" /> : <Locate className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Seguir camión</span>
        </Button>
      </Tooltip>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-zinc-800" />
      <Button variant="ghost" size="icon-sm" flat aria-label="Alejar" title="Alejar (−)" disabled={zoom <= MIN_ZOOM + 0.001} onClick={onZoomOut}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="num w-11 select-none text-center text-[11px] text-zinc-300" role="status" aria-label={`Zoom ${pct}`}>
        {pct}
      </span>
      <Button variant="ghost" size="icon-sm" flat aria-label="Acercar" title="Acercar (+)" disabled={zoom >= MAX_ZOOM - 0.001} onClick={onZoomIn}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        flat
        aria-label="Restablecer vista"
        title="Restablecer vista (0)"
        disabled={zoom <= MIN_ZOOM + 0.001 && !follow}
        onClick={onReset}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── aviso de zoom con rueda

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

export function WheelHint({ show }: { show: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <AnimatePresence>
        {show && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={springSnappy}
            className="flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-950/85 px-3 py-2 text-[12px] text-zinc-300 shadow-xl shadow-black/50 backdrop-blur-md"
          >
            Mantén <Kbd>{MOD}</Kbd> y gira la rueda para hacer zoom
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── transporte compacto (pantalla completa)

export function MiniTransport() {
  const { status, actions } = useSim();
  const playing = status === 'playing';
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-0.5">
      <Button variant="ghost" size="icon-sm" flat aria-label="Parada anterior" title="Parada anterior (Shift + ←)" onClick={actions.prevStop}>
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button variant="primary" size="icon-sm" flat aria-label={playing ? 'Pausar' : 'Reproducir'} title="Reproducir / pausar (Espacio)" onClick={actions.toggle}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon-sm" flat aria-label="Siguiente parada" title="Siguiente parada (Shift + →)" onClick={actions.nextStop}>
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  );
}
