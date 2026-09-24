/**
 * Línea de tiempo del tour proporcional a la DISTANCIA.
 * Cada tramo es un segmento de ancho ∝ c_ij; los marcadores son las paradas,
 * las barras rosadas sobre ellos, las manipulaciones LIFO de cada parada y,
 * en la Política 3, el punto de color la decisión s_i del cliente.
 *
 * Clic / arrastre: posiciona el camión (con imán de ±6 px sobre las paradas).
 * Teclado: ←/→ parada anterior/siguiente · Inicio reinicia · Fin última parada.
 * Solo <LiveLayer> se suscribe al avance a 60 fps.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useProgress, useSim, type SimMode } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { POLICY_INFO } from '../../lib/models';
import { cn } from '../../lib/cn';
import { fmt, fmtKm } from '../../lib/format';
import { springSnappy } from '../../lib/motion';
import { SubS, shortLabel } from '../stop/shared';

const SNAP_PX = 6;
const LABEL_CHAR_PX = 5.7;

interface Leg {
  k: number;
  from: number;
  to: number;
  start: number;
  end: number;
  distance: number;
  deliverA: number;
  pickupB: number;
  handlingCount: number;
  handlingCost: number;
  policy: 1 | 2 | null;
  isDepot: boolean;
  unload: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Etiquetas visibles sin solaparse (voraz de izquierda a derecha; la última siempre). */
function visibleLabels(xs: number[], texts: string[], width: number): boolean[] {
  const n = xs.length;
  const shown = new Array<boolean>(n).fill(false);
  if (width <= 0) return shown;
  const span = (i: number): [number, number] => {
    const w = texts[i].length * LABEL_CHAR_PX + 2;
    if (i === 0) return [0, w];
    if (i === n - 1) return [width - w, width];
    return [xs[i] - w / 2, xs[i] + w / 2];
  };
  let right = -Infinity;
  for (let i = 0; i < n; i++) {
    const [l, r] = span(i);
    if (l >= right + 4) {
      shown[i] = true;
      right = r;
    }
  }
  if (!shown[n - 1]) {
    const [l] = span(n - 1);
    shown[n - 1] = true;
    for (let i = n - 2; i >= 0 && shown[i] && span(i)[1] > l - 4; i--) shown[i] = false;
  }
  return shown;
}

// ───────────────────────────────────────────────────────────── capa en vivo (60 fps)

interface LiveLayerProps {
  legs: Leg[];
  total: number;
  stepIndex: number;
  arrived: boolean;
  mode: SimMode;
  smooth: boolean;
  sliderRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

const LiveLayer = memo(function LiveLayer({ legs, total, stepIndex, arrived, mode, smooth, sliderRef, children }: LiveLayerProps) {
  const progress = useProgress();
  const leg = legs[stepIndex];
  const km = !leg ? 0 : mode === 'initial' ? 0 : leg.start + leg.distance * (arrived ? 1 : progress);
  const pct = total > 0 ? clamp((km / total) * 100, 0, 100) : 0;
  const legPct = Math.round((arrived ? 1 : progress) * 100);
  // Decisión s_i de la parada (solo relevante en Política 3; en P1/P2 es fija)
  const pol = leg && !leg.isDepot && leg.policy ? ` · ${POLICY_INFO[leg.policy].code} (${POLICY_INFO[leg.policy].s})` : '';

  const valueText = !leg
    ? ''
    : mode === 'initial'
      ? 'Depósito, antes de partir'
      : mode === 'finished'
        ? `Tour completado, ${fmtKm(total)}`
        : arrived
          ? `Parada ${stepIndex + 1}: llegada a ${shortLabel(leg.to)}${pol}`
          : `Tramo ${stepIndex + 1}: ${shortLabel(leg.from)} → ${shortLabel(leg.to)}, ${legPct} %${pol}`;
  const kmRounded = Math.round(km);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    el.setAttribute('aria-valuenow', String(kmRounded));
    el.setAttribute('aria-valuetext', valueText);
  }, [kmRounded, valueText, sliderRef]);

  const ease = smooth ? '380ms cubic-bezier(0.16, 1, 0.3, 1)' : '0ms';
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)`, transition: `clip-path ${ease}` }}
      >
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-[2px] z-20 h-[24px] w-0"
        style={{ left: `${pct}%`, transition: `left ${ease}` }}
      >
        <span className="absolute inset-y-0 -left-px w-0.5 rounded-full bg-white shadow-[0_0_12px_rgb(255_255_255/0.45)]" />
        <span className="absolute top-[10px] left-0 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-zinc-950 bg-white shadow-lg shadow-black/60 transition-transform duration-150 group-hover/tl:scale-110 group-focus-visible/tl:scale-110" />
      </div>
    </>
  );
});

// ───────────────────────────────────────────────────────────── línea de tiempo

export function Timeline({ className }: { className?: string }) {
  const { solution, choreo, stepIndex, arrived, mode, status, actions } = useSim();
  const { hoverNode, setHoverNode } = useHover();
  const sliderRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverLeg, setHoverLeg] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, moved: false, wasPlaying: false, raf: 0, downX: 0, pendingX: 0, lastKey: '' });

  const model = solution?.model ?? 'TSPPD-H';
  const p3 = model === 'TSPPD-H_3';

  const legs = useMemo<Leg[]>(() => {
    if (!solution) return [];
    let acc = 0;
    return solution.steps.map((s, k) => {
      const stop = choreo?.stops[k];
      const leg: Leg = {
        k,
        from: s.from,
        to: s.to,
        start: acc,
        end: acc + s.distance,
        distance: s.distance,
        deliverA: s.deliverA,
        pickupB: s.pickupB,
        handlingCount: s.handlingCount,
        handlingCost: s.handlingCost,
        policy: stop?.policy ?? null,
        isDepot: s.to === 0,
        unload: s.to === 0 ? stop?.delivered.length ?? s.bOnTruck : 0,
      };
      acc += s.distance;
      return leg;
    });
  }, [solution, choreo]);

  const total = legs.length ? legs[legs.length - 1].end : 0;
  const maxHandling = useMemo(() => Math.max(1, ...legs.map((l) => l.handlingCount)), [legs]);
  /** Fronteras: 0 = salida del depósito; b ≥ 1 = llegada del tramo b − 1. */
  const boundaries = useMemo(() => [0, ...legs.map((l) => l.end)], [legs]);
  const boundaryLabels = useMemo(() => ['D', ...legs.map((l) => shortLabel(l.to))], [legs]);
  const xs = useMemo(() => boundaries.map((b) => (total > 0 ? (b / total) * width : 0)), [boundaries, total, width]);
  const shownLabels = useMemo(() => visibleLabels(xs, boundaryLabels, width), [xs, boundaryLabels, width]);

  const hasLegs = legs.length > 0;
  useLayoutEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasLegs]);

  useEffect(() => () => cancelAnimationFrame(drag.current.raf), []);

  // ── Mapeo x → (tramo, fracción) con imán sobre las paradas
  const locate = useCallback(
    (clientX: number) => {
      const el = sliderRef.current;
      if (!el || !total || !legs.length) return null;
      const rect = el.getBoundingClientRect();
      const W = rect.width || 1;
      const x = clamp(clientX - rect.left, 0, W);
      let snap = -1;
      let best = SNAP_PX + 0.01;
      boundaries.forEach((b, i) => {
        const dx = Math.abs((b / total) * W - x);
        if (dx <= best) {
          best = dx;
          snap = i;
        }
      });
      const km = (x / W) * total;
      let k = legs.findIndex((l) => km < l.end);
      if (k < 0) k = legs.length - 1;
      const frac = legs[k].distance > 0 ? clamp((km - legs[k].start) / legs[k].distance, 0, 1) : 1;
      return { x, W, snap, k, frac };
    },
    [boundaries, legs, total],
  );

  const apply = useCallback(
    (clientX: number) => {
      const hit = locate(clientX);
      if (!hit) return;
      let key: string;
      if (hit.snap === 0) key = 'start';
      else if (hit.snap > 0) key = `stop:${hit.snap - 1}`;
      else key = `seek:${hit.k}:${hit.frac.toFixed(3)}`;
      if (key === drag.current.lastKey) return;
      drag.current.lastKey = key;
      if (hit.snap === 0) actions.seek(0, 0);
      else if (hit.snap > 0) actions.selectStep(hit.snap - 1);
      else actions.seek(hit.k, hit.frac);
    },
    [actions, locate],
  );

  const moveGhost = (clientX: number) => {
    const hit = locate(clientX);
    const ghost = ghostRef.current;
    if (!hit || !ghost) return hit;
    const gx = hit.snap >= 0 ? (boundaries[hit.snap] / total) * hit.W : hit.x;
    ghost.style.transform = `translateX(${gx}px)`;
    ghost.dataset.snap = hit.snap >= 0 ? 'true' : 'false';
    return hit;
  };

  const updateHover = (leg: number | null) => {
    setHoverLeg((prev) => (prev === leg ? prev : leg));
  };

  // Resaltado cruzado con el mapa: el tramo bajo el puntero ilumina su destino.
  useEffect(() => {
    if (hoverLeg === null) return;
    const to = legs[hoverLeg]?.to;
    if (to !== undefined) setHoverNode(to);
    return () => setHoverNode(null);
  }, [hoverLeg, legs, setHoverNode]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    drag.current.active = true;
    drag.current.moved = false;
    drag.current.wasPlaying = status === 'playing';
    drag.current.lastKey = '';
    drag.current.downX = e.clientX;
    drag.current.pendingX = e.clientX;
    moveGhost(e.clientX);
    apply(e.clientX);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const hit = moveGhost(e.clientX);
    if (drag.current.active) {
      if (!drag.current.moved) {
        if (Math.abs(e.clientX - drag.current.downX) < 3) return;
        drag.current.moved = true;
        setDragging(true);
      }
      drag.current.pendingX = e.clientX;
      if (!drag.current.raf) {
        drag.current.raf = requestAnimationFrame(() => {
          drag.current.raf = 0;
          apply(drag.current.pendingX);
        });
      }
    }
    if (hit) updateHover(hit.snap > 0 ? hit.snap - 1 : hit.k);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.raf) {
      cancelAnimationFrame(drag.current.raf);
      drag.current.raf = 0;
      apply(drag.current.pendingX);
    }
    const el = e.currentTarget;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    setDragging(false);
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside || e.pointerType !== 'mouse') updateHover(null);
    if (drag.current.wasPlaying) actions.play();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
      case 'PageDown':
        actions.prevStop();
        break;
      case 'ArrowRight':
      case 'ArrowUp':
      case 'PageUp':
        actions.nextStop();
        break;
      case 'Home':
        actions.reset();
        break;
      case 'End':
        actions.selectStep(legs.length - 1);
        break;
      case ' ':
        actions.toggle();
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  if (!solution || !legs.length) return null;

  const reached = (b: number) => b === 0 || mode === 'finished' || b - 1 < stepIndex || (b - 1 === stepIndex && arrived);
  const pctOf = (km: number) => `${(km / total) * 100}%`;
  const segWidth = (l: Leg) => `max(0px, calc(${(l.distance / total) * 100}% - 1px))`;
  const hovered = hoverLeg !== null ? legs[hoverLeg] : null;
  const tipX = hovered && width > 0 ? clamp(((hovered.start + hovered.distance / 2) / total) * width, Math.min(118, width / 2), Math.max(width - 118, width / 2)) : 0;

  return (
    <div
      ref={sliderRef}
      role="slider"
      tabIndex={0}
      aria-label="Línea de tiempo del tour (proporcional a la distancia)"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        if (!drag.current.active) updateHover(null);
      }}
      className={cn(
        'group/tl relative h-10 min-w-0 flex-1 cursor-pointer touch-none rounded-md select-none focus-visible:outline-offset-4',
        className,
      )}
    >
      {/* Riel base */}
      {legs.map((l) => (
        <span
          key={`base-${l.k}`}
          aria-hidden
          className={cn(
            'absolute top-[14px] h-2 rounded-[2px] transition-colors duration-150',
            hoverLeg === l.k ? 'bg-zinc-600' : l.k === stepIndex && mode === 'transit' ? 'bg-zinc-700' : 'bg-zinc-800',
          )}
          style={{ left: pctOf(l.start), width: segWidth(l) }}
        />
      ))}

      {/* Recorrido (recortado hasta el cabezal) + cabezal */}
      <LiveLayer legs={legs} total={total} stepIndex={stepIndex} arrived={arrived} mode={mode} smooth={status !== 'playing' && !dragging} sliderRef={sliderRef}>
        {legs.map((l) => (
          <span
            key={`fill-${l.k}`}
            className="absolute top-[14px] h-2 rounded-[2px] bg-zinc-100"
            style={{ left: pctOf(l.start), width: segWidth(l) }}
          />
        ))}
      </LiveLayer>

      {/* Manipulaciones: barras ∝ ops sobre cada parada */}
      {legs.map((l) =>
        l.handlingCount > 0 ? (
          <span
            key={`h-${l.k}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute bottom-[28px] w-[3px] -translate-x-1/2 rounded-t-[1px] transition-colors',
              reached(l.k + 1) ? 'bg-handling' : 'bg-handling/45',
            )}
            style={{ left: pctOf(l.end), height: `${Math.max(2, Math.round((l.handlingCount / maxHandling) * 11))}px` }}
          />
        ) : null,
      )}

      {/* Marcadores de parada */}
      {boundaries.map((b, i) => {
        const leg = i > 0 ? legs[i - 1] : null;
        const depot = i === 0 || !!leg?.isDepot;
        const isCur = i > 0 && i - 1 === stepIndex && arrived && mode !== 'finished';
        const lit = (hoverNode !== null && (i === 0 ? hoverNode === 0 : leg?.to === hoverNode)) || (hoverLeg !== null && hoverLeg === i - 1);
        const policyColor = p3 && leg && !leg.isDepot && leg.policy ? POLICY_INFO[leg.policy].color : null;
        const on = reached(i);
        return (
          <span
            key={`m-${i}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-[18px] z-10 -translate-x-1/2 -translate-y-1/2 ring-2 ring-zinc-950 transition-[scale,background-color,opacity] duration-200',
              // P3: la decisión se lee también por la forma (● P1 · ◆ P2), no solo por el color
              depot ? 'h-[7px] w-[7px] rounded-[2px]' : policyColor && leg?.policy === 2 ? 'h-[7px] w-[7px] rotate-45 rounded-[1px]' : 'h-[7px] w-[7px] rounded-full',
              !policyColor && (on ? 'bg-zinc-100' : 'bg-zinc-500'),
              (isCur || lit) && 'scale-[1.45]',
              lit && 'ring-zinc-300/70',
            )}
            style={{
              left: `${(b / total) * 100}%`,
              ...(policyColor ? { backgroundColor: policyColor, opacity: on ? 1 : 0.6 } : null),
            }}
          />
        );
      })}

      {/* Rótulos (los que se solapan se ocultan; aparecen al pasar el puntero) */}
      {boundaries.map((b, i) => {
        const lit = hoverLeg !== null ? hoverLeg === i - 1 : false;
        const litNode = hoverNode !== null && (i === 0 ? hoverNode === 0 : legs[i - 1]?.to === hoverNode);
        const isCur = i > 0 && i - 1 === stepIndex && (arrived || mode === 'transit');
        const show = shownLabels[i] || lit || litNode;
        if (!show) return null;
        const edge = i === 0 ? 'left' : i === boundaries.length - 1 ? 'right' : 'center';
        const emph = lit || litNode;
        return (
          <span
            key={`l-${i}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-[27px] font-mono text-[9px] leading-3 whitespace-nowrap transition-colors',
              edge === 'center' && '-translate-x-1/2',
              edge === 'right' && '-translate-x-full',
              emph ? 'z-10 rounded-[3px] bg-zinc-950 px-0.5 text-zinc-50' : isCur ? 'text-zinc-200' : 'text-zinc-500',
            )}
            style={{ left: `${(b / total) * 100}%` }}
          >
            {boundaryLabels[i]}
          </span>
        );
      })}

      {/* Guía fantasma bajo el puntero (DOM directo, sin renders) */}
      <span
        ref={ghostRef}
        aria-hidden
        data-snap="false"
        className="pointer-events-none absolute top-[4px] left-0 h-[22px] w-px bg-zinc-400/50 opacity-0 transition-opacity duration-150 group-hover/tl:opacity-100 data-[snap=true]:bg-zinc-100"
      />

      {/* Tooltip del tramo */}
      <AnimatePresence>
        {hovered && !dragging && (
          <motion.div
            key="tip"
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={springSnappy}
            className="pointer-events-none absolute bottom-full z-30 mb-3 w-max max-w-[260px] -translate-x-1/2 rounded-xl border border-zinc-700/80 bg-zinc-900/95 px-2.5 py-1.5 text-[11.5px] leading-snug text-zinc-200 shadow-xl shadow-black/50 backdrop-blur-md"
            style={{ left: tipX }}
          >
            <p className="num text-zinc-50">
              Tramo {hovered.k + 1} · {shortLabel(hovered.from)} → {shortLabel(hovered.to)} · {fmtKm(hovered.distance)}
            </p>
            <p className="num mt-0.5 text-zinc-400">
              {hovered.isDepot ? (
                <span className="text-beta">descarga β {hovered.unload}</span>
              ) : (
                <>
                  <span className="text-alpha">α {hovered.deliverA}</span> · <span className="text-beta">β {hovered.pickupB}</span>
                </>
              )}{' '}
              ·{' '}
              {hovered.handlingCount > 0 ? (
                <span className="text-handling">
                  {hovered.handlingCount} manip. (+{fmt(hovered.handlingCost)})
                </span>
              ) : (
                <span>sin manip.</span>
              )}
            </p>
            {p3 && hovered.policy && !hovered.isDepot && (
              <p className="num mt-1 flex items-center gap-1.5 text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: POLICY_INFO[hovered.policy].color }} />
                {POLICY_INFO[hovered.policy].code} · <SubS text={POLICY_INFO[hovered.policy].s} />
                <span className="text-zinc-500">· {hovered.policy === 1 ? 'compuerta' : 'fondo'}</span>
              </p>
            )}
            <p className="mt-1 text-[10.5px] text-zinc-500">Clic para ir · arrastra para recorrer</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
