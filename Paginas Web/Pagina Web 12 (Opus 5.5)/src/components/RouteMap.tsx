/**
 * Mapa de ruta — instrumento principal del simulador.
 *
 * - Disposición geométrica (MDS desde c_ij, a escala) o circular, con transición por resorte.
 * - Cámara con zoom 100–400 % (botones, Ctrl/⌘ + rueda, doble clic, teclado + / − / 0),
 *   paneo por arrastre y modo "Seguir camión".
 * - Arcos por estado (recorrido / en curso con estela / pendiente), flecha y distancia.
 * - Nodos con estado de visita, orden en el tour, demanda α/β y decisión P1/P2 (Política 3).
 * - Resaltado cruzado con el compartimiento (useHover) y ficha flotante por nodo.
 * - Camión en vista cenital con franja de composición de carga; solo esa capa (y la estela)
 *   se suscriben al progreso de 60 fps.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize2, Minimize2, Orbit, Route, Waypoints } from 'lucide-react';
import { useCatalog, useSim } from '../state/SimulationProvider';
import { useHover, useUI } from '../state/UIProvider';
import { computeLayout, frameFor, ringGeometry } from '../lib/layout';
import { nodePolicy } from '../lib/policy';
import { fmtKm } from '../lib/format';
import { cn } from '../lib/cn';
import { spring } from '../lib/motion';
import type { StepData } from '../types/solution';
import { Button, Kbd, Segmented, SpotlightCard, Tooltip } from './ui';
import { NodePopover } from './NodePopover';
import {
  arcGeom,
  centerOn,
  clamp,
  IDENTITY,
  MAX_ZOOM,
  niceKm,
  placeArcLabels,
  unitsPerKm,
  zoomAt,
  type Pose,
} from './map/geometry';
import { stageOf, useAnimatedPoints, useApplyView, useCanvasSize, useViewport } from './map/hooks';
import { ArcsLayer, GuidesLayer, MapDefs, NodesLayer, TrailLayer, TruckLayer, type ArcItem, type ArcState, type NodeState } from './map/MapLayers';
import { MapHud, MapLegend, WheelHint, ZoomDock } from './map/MapOverlays';
import { Transport } from './Transport';
import { lockScroll } from '../lib/overlay';
import { useTabTrap } from '../hooks/useTabTrap';

const EMPTY_STEPS: StepData[] = [];
/** En teléfonos la tarjeta es más alta: el lienzo queda vertical y el marco adaptativo gana escala. */
const HEIGHT = 'h-[440px] sm:h-[360px] xl:h-[440px]';

interface FollowProps {
  follow: boolean;
  setFollow: (v: boolean) => void;
}

export function RouteMap() {
  const { solution } = useCatalog();
  const { focusPanel } = useUI();
  const [follow, setFollow] = useState(false);
  const full = focusPanel === 'map';
  // El bloqueo de scroll sigue a focusPanel (no a la animación de salida del overlay),
  // y al salir el foco vuelve al botón que abrió la pantalla completa.
  useLayoutEffect(() => {
    if (!full) return;
    const unlock = lockScroll();
    return () => {
      unlock();
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-map-fullscreen-toggle]')?.focus({ preventScroll: true }));
    };
  }, [full]);
  if (!solution) return null;
  return (
    <>
      {full ? (
        <div aria-hidden className={cn(HEIGHT, 'rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/20')} />
      ) : (
        <MapCard fullscreen={false} follow={follow} setFollow={setFollow} />
      )}
      {createPortal(<AnimatePresence>{full && <FullscreenMap key="map-fullscreen" follow={follow} setFollow={setFollow} />}</AnimatePresence>, document.body)}
    </>
  );
}

// ───────────────────────────────────────────────────────────── pantalla completa

function FullscreenMap({ follow, setFollow }: FollowProps) {
  const { setFocusPanel } = useUI();
  const boxRef = useRef<HTMLDivElement>(null);
  // Foco dentro del panel y Tab confinado a él (sin role="dialog", para que los
  // atajos globales de reproducción sigan activos).
  useEffect(() => {
    boxRef.current?.focus({ preventScroll: true });
  }, []);
  useTabTrap(boxRef, true);
  return (
    <>
      <motion.div
        aria-hidden
        className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setFocusPanel(null)}
      />
      <motion.div
        ref={boxRef}
        tabIndex={-1}
        className="fixed inset-3 z-[60] outline-none md:inset-6"
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.16 } }}
        transition={spring}
      >
        <MapCard fullscreen follow={follow} setFollow={setFollow} />
      </motion.div>
    </>
  );
}

// ───────────────────────────────────────────────────────────── tarjeta del mapa

function arcStateAt(i: number, mode: string, k: number): ArcState {
  if (mode === 'initial') return 'todo';
  if (mode === 'finished') return 'done';
  if (i < k) return 'done';
  if (i === k) return mode === 'stop' ? 'done' : 'current';
  return 'todo';
}

function LayoutHelp() {
  return (
    <span className="block space-y-1">
      <span className="block">
        <span className="font-medium text-zinc-50">Geométrico:</span> posiciones reconstruidas por MDS desde la matriz c_ij; las longitudes son proporcionales a las distancias reales.
      </span>
      <span className="block">
        <span className="font-medium text-zinc-50">Circular:</span> disposición radial esquemática, depósito al centro. Atajo <span className="font-mono">G</span>.
      </span>
    </span>
  );
}

interface MapCardProps extends FollowProps {
  fullscreen: boolean;
}

function MapCard({ fullscreen, follow, setFollow }: MapCardProps) {
  const { solution, choreo, mode, stepIndex } = useSim();
  const { mapLayout, setMapLayout, inspectedNode, inspectNode, setFocusPanel } = useUI();
  const { hoverNode, hoverUnit, setHoverNode } = useHover();

  const nodes = solution?.nodes;
  const n = nodes?.length ?? 0;

  // ── Lienzo y marco: en teléfonos o en vertical el viewBox adopta la proporción del
  // lienzo (frameFor) para que nodos y etiquetas no se encojan con franjas vacías.
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const size = useCanvasSize(canvasRef);
  const measured = size.w > 0;
  const nextFrame = useMemo(() => frameFor(size.w, size.h, n), [size.w, size.h, n]);
  // Identidad estable mientras no cambie el contenido (redimensionar en escritorio no re-dispone)
  const frame = useMemo(() => nextFrame, [nextFrame.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const stage = useMemo(() => stageOf(size, frame), [size, frame]);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const vp = useViewport(frame);
  const { setView, viewRef, zoom, mk, mx, my } = vp;
  useApplyView(viewportRef, vp);

  const uid = `map${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ids = useMemo(() => ({ dots: `${uid}-dots`, glow: `${uid}-glow`, beam: `${uid}-beam`, strip: `${uid}-strip` }), [uid]);

  // ── Geometría (se espera a medir el lienzo: así el primer cuadro ya usa el marco final)
  const dist = solution?.distMatrix;
  const steps = solution?.steps ?? EMPTY_STEPS;
  const entranceKey = solution ? `${solution.numCustomers}-${solution.instanceId}` : 'none';
  const target = useMemo(
    () => (n && measured ? computeLayout(mapLayout, n, dist, frame.w, frame.h, frame.pad, frame.obstacles) : []),
    [mapLayout, n, dist, frame, measured],
  );
  const positions = useAnimatedPoints(target, entranceKey);
  const geoTarget = useMemo(() => (n && measured ? computeLayout('geo', n, dist, frame.w, frame.h, frame.pad, frame.obstacles) : []), [n, dist, frame, measured]);
  const upk = useMemo(() => (dist && dist.length === n && n > 2 && geoTarget.length ? unitsPerKm(geoTarget, dist) : null), [geoTarget, dist, n]);
  const guideMode: 'geo' | 'ring' = mapLayout === 'geo' && upk ? 'geo' : 'ring';
  const maxKm = useMemo(() => (dist?.[0] ?? []).reduce((m, d) => (d < 1e6 && d > m ? d : m), 0), [dist]);
  // Mismo anillo (círculo o elipse) que computeLayout('ring'), para que la guía coincida con los nodos
  const ring = useMemo(() => ringGeometry(Math.max(n, 2), frame.w, frame.h, frame.pad), [n, frame]);

  const arcs = useMemo(
    () =>
      positions.length
        ? placeArcLabels(
            steps.map((s) => arcGeom(positions[s.from] ?? positions[0], positions[s.to] ?? positions[0], s.from, s.to)),
            positions,
            steps.map((s) => s.distance),
          )
        : [],
    [steps, positions],
  );
  const arcItems = useMemo<ArcItem[]>(
    () => steps.map((s, i) => ({ key: `${i}-${s.from}-${s.to}`, g: arcs[i], state: arcStateAt(i, mode, stepIndex), distance: s.distance, from: s.from, to: s.to })).filter((a) => a.g),
    [steps, arcs, mode, stepIndex],
  );

  // ── Estado de los nodos
  const states = useMemo<NodeState[]>(() => {
    const st: NodeState[] = Array.from({ length: n }, () => 'idle');
    if (!n) return st;
    if (mode === 'initial') {
      st[0] = 'current';
      return st;
    }
    if (mode === 'finished') {
      st.fill('visited');
      st[0] = 'current';
      return st;
    }
    for (let i = 0; i < stepIndex && i < steps.length; i++) st[steps[i].to] = 'visited';
    const cur = steps[stepIndex];
    if (cur) st[cur.to] = mode === 'stop' ? 'current' : 'target';
    return st;
  }, [n, steps, mode, stepIndex]);

  const order = useMemo(() => {
    const o: Record<number, number> = {};
    solution?.tour.forEach((id, i) => {
      if (id !== 0 && o[id] === undefined) o[id] = i;
    });
    return o;
  }, [solution]);

  const policies = useMemo(() => {
    const p: (1 | 2 | null)[] = [];
    if (solution) for (const node of solution.nodes) p[node.id] = nodePolicy(solution, node.id);
    return p;
  }, [solution]);
  const isP3 = solution?.model === 'TSPPD-H_3';

  const related = useMemo(() => {
    if (!hoverUnit || !choreo) return null;
    const u = choreo.units[hoverUnit];
    if (!u) return null;
    const id = u.type === 'A' ? u.destination : u.origin;
    if (id === undefined || id === 0) return null;
    return { id, type: u.type };
  }, [hoverUnit, choreo]);

  // ── Interacción con nodos
  const inspectedRef = useRef(inspectedNode);
  inspectedRef.current = inspectedNode;
  const suppressClick = useRef(false);
  const onEnter = useCallback((id: number) => setHoverNode(id), [setHoverNode]);
  const onLeave = useCallback(() => setHoverNode(null), [setHoverNode]);
  const onActivate = useCallback(
    (id: number) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      inspectNode(inspectedRef.current === id ? null : id);
    },
    [inspectNode],
  );
  const closePopover = useCallback(() => inspectNode(null), [inspectNode]);

  // ── Cámara: seguimiento del camión
  const followRef = useRef(follow);
  followRef.current = follow;
  const poseRef = useRef<Pose | null>(null);
  const onPose = useCallback(
    (p: Pose) => {
      poseRef.current = p;
      const v = viewRef.current;
      if (!followRef.current || v.k <= 1.001) return;
      const next = centerOn(v, p, v.k, frameRef.current);
      if (Math.abs(next.x - v.x) > 0.05 || Math.abs(next.y - v.y) > 0.05) setView(next, 'follow');
    },
    [setView, viewRef],
  );

  useEffect(() => {
    if (!follow) return;
    const p = poseRef.current;
    if (!p) return;
    const v = viewRef.current;
    setView(centerOn(v, p, v.k > 1.001 ? v.k : 2, frameRef.current));
  }, [follow, setView, viewRef]);

  const zoomBy = useCallback(
    (f: number, at?: { x: number; y: number }) => {
      const v = viewRef.current;
      const nk = v.k * f;
      const fr = frameRef.current;
      if (followRef.current && poseRef.current && nk > 1.001) setView(centerOn(v, poseRef.current, nk, fr), 'snappy');
      else {
        // De vuelta al mapa completo: seguir al camión deja de tener sentido
        if (followRef.current && nk <= 1.001) setFollow(false);
        setView(zoomAt(v, at?.x ?? fr.w / 2, at?.y ?? fr.h / 2, nk, fr), 'snappy');
      }
    },
    [setView, viewRef, setFollow],
  );
  const resetView = useCallback(() => {
    setFollow(false);
    setView(IDENTITY);
  }, [setFollow, setView]);

  // Tab sobre un nodo fuera de vista (con zoom): la cámara lo trae al centro
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const onReveal = useCallback(
    (id: number) => {
      const v = viewRef.current;
      const p = positionsRef.current[id];
      if (!p || v.k <= 1.001) return;
      const sx = v.x + v.k * p.x;
      const sy = v.y + v.k * p.y;
      const f = frameRef.current;
      const M = 28;
      if (sx >= M && sx <= f.w - M && sy >= M && sy <= f.h - M) return;
      if (followRef.current) setFollow(false);
      setView(centerOn(v, p, v.k, f), 'snappy');
    },
    [setView, viewRef, setFollow],
  );

  const PAN_STEP = 48;
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const v = viewRef.current;
      if (followRef.current) setFollow(false);
      setView({ k: v.k, x: v.x + dx, y: v.y + dy }, 'snappy');
    },
    [setView, viewRef, setFollow],
  );

  // ── Aviso "Ctrl + rueda" (como máximo cada 8 s)
  const [hint, setHint] = useState(false);
  const hintTimer = useRef(0);
  const lastHint = useRef(0);
  const flashHint = useCallback(() => {
    const now = performance.now();
    if (now - lastHint.current < 8000) return;
    lastHint.current = now;
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 1500);
  }, []);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    const st = stageRef.current;
    if (!el) return { x: frameRef.current.w / 2, y: frameRef.current.h / 2 };
    const r = el.getBoundingClientRect();
    return { x: (clientX - r.left - st.ox) / st.s, y: (clientY - r.top - st.oy) / st.s };
  }, []);

  // ── Ctrl/⌘ + rueda (listener no pasivo; la rueda simple sigue desplazando la página)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-map-popover]')) return;
      if (!(e.ctrlKey || e.metaKey)) {
        flashHint();
        return;
      }
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const f = Math.exp(clamp(-e.deltaY * unit * 0.0025, -0.5, 0.5));
      zoomBy(f, toViewBox(e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [flashHint, zoomBy, toViewBox]);

  // ── Arrastre para desplazar (solo con zoom > 100 %)
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; active: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const isUiTarget = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('[data-map-ui],[data-map-popover]');

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isUiTarget(e.target)) return;
    suppressClick.current = false;
    const v = viewRef.current;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, active: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const v = viewRef.current;
    if (v.k <= 1.001) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.active) {
      if (Math.hypot(dx, dy) < 4) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      if (followRef.current) setFollow(false);
    }
    const s = stageRef.current.s || 1;
    setView({ k: v.k, x: d.vx + dx / s, y: d.vy + dy / s }, 'instant');
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.active) {
      // Ignora el clic sintético que sigue al arrastre (y solo ese)
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    // Clic simple en el fondo: cierra la ficha
    if (!cancelled && !(e.target as Element | null)?.closest?.('[data-map-node],[data-map-ui],[data-map-popover]')) inspectNode(null);
  };

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element | null)?.closest?.('[data-map-node],[data-map-ui],[data-map-popover]')) return;
    const v = viewRef.current;
    if (v.k >= MAX_ZOOM - 0.01) resetView();
    else zoomBy(2, toViewBox(e.clientX, e.clientY));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isUiTarget(e.target)) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(1.5);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomBy(1 / 1.5);
    } else if (e.key === '0') {
      e.preventDefault();
      resetView();
    } else if (e.target === e.currentTarget && viewRef.current.k > 1.001 && e.key.startsWith('Arrow')) {
      // Flechas sobre el lienzo enfocado: desplazan la vista (no el tour)
      e.preventDefault();
      e.stopPropagation();
      const d = e.shiftKey ? PAN_STEP * 2.5 : PAN_STEP;
      if (e.key === 'ArrowLeft') panBy(d, 0);
      else if (e.key === 'ArrowRight') panBy(-d, 0);
      else if (e.key === 'ArrowUp') panBy(0, d);
      else if (e.key === 'ArrowDown') panBy(0, -d);
    }
  };

  // ── Escala visible (modo geométrico)
  const scale = useMemo(() => {
    if (guideMode !== 'geo' || !upk) return null;
    const pxPerKm = upk * zoom * (stage.s || 1);
    const km = niceKm(64 / pxPerKm);
    return { km, px: km * pxPerKm };
  }, [guideMode, upk, zoom, stage.s]);

  if (!solution || !nodes) return null;

  const inspected = inspectedNode !== null && inspectedNode < n && positions[inspectedNode] ? inspectedNode : null;
  const zoomed = zoom > 1.001;

  return (
    <SpotlightCard
      plain
      data-map-card
      className={cn('relative flex flex-col overflow-hidden', fullscreen ? 'h-full bg-zinc-950/95 shadow-2xl shadow-black/60' : HEIGHT)}
      role={fullscreen ? 'region' : undefined}
      aria-label={fullscreen ? 'Mapa de ruta en pantalla completa' : undefined}
    >
      {/* Encabezado */}
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden h-8 w-8 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 min-[360px]:grid">
            <Route className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm leading-5 font-semibold tracking-tight text-zinc-50">Mapa de ruta</h3>
            <p className="num truncate text-[11px] leading-4 text-zinc-500">
              Tour óptimo · {steps.length} arcos · {fmtKm(solution.totalDistance)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip side="bottom" align="end" content={<LayoutHelp />}>
            <Segmented
              size="sm"
              ariaLabel="Disposición del mapa"
              value={mapLayout}
              onChange={setMapLayout}
              options={[
                {
                  value: 'geo',
                  ariaLabel: 'Geométrico',
                  label: (
                    <>
                      <Waypoints className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">Geométrico</span>
                    </>
                  ),
                },
                {
                  value: 'ring',
                  ariaLabel: 'Circular',
                  label: (
                    <>
                      <Orbit className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">Circular</span>
                    </>
                  ),
                },
              ]}
            />
          </Tooltip>
          {fullscreen && (
            <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 md:flex">
              <Kbd>Esc</Kbd> salir
            </span>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
            title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa (M)'}
            data-map-fullscreen-toggle={fullscreen ? undefined : ''}
            onClick={() => setFocusPanel(fullscreen ? null : 'map')}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Lienzo */}
      <div
        ref={canvasRef}
        data-map-canvas
        role="group"
        aria-roledescription="mapa"
        aria-label="Mapa interactivo del tour. Ctrl + rueda o las teclas + y − para zoom, 0 para restablecer. Con zoom, arrastra o usa las flechas para desplazar. Tab recorre los nodos y Enter abre su ficha."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        className={cn(
          '@container relative min-h-0 flex-1 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500/70',
          'bg-[radial-gradient(ellipse_at_50%_45%,rgb(255_255_255/0.035),transparent_70%)]',
          zoomed ? 'touch-none' : 'touch-auto',
          zoomed && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        <svg
          className="absolute inset-0 h-full w-full select-none"
          viewBox={`0 0 ${frame.w} ${frame.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Tour del camión sobre la red de clientes"
        >
          <MapDefs ids={ids} />
          <g ref={viewportRef}>
            <GuidesLayer mode={guideMode} center={positions[0] ?? { x: ring.cx, y: ring.cy }} upk={upk} maxKm={maxKm} ring={ring} dotsId={ids.dots} />
            <ArcsLayer items={arcItems} hoverNode={hoverNode} entranceKey={entranceKey} />
            <TrailLayer arcs={arcs} />
            <NodesLayer
              nodes={nodes}
              positions={positions}
              states={states}
              order={order}
              policies={policies}
              hoverNode={hoverNode}
              related={related}
              inspected={inspected}
              entranceKey={entranceKey}
              onEnter={onEnter}
              onLeave={onLeave}
              onActivate={onActivate}
              onReveal={onReveal}
            />
            <TruckLayer arcs={arcs} positions={positions} ids={ids} onPose={onPose} />
          </g>
        </svg>

        <MapHud />
        <MapLegend p3={isP3} scale={scale} />
        <ZoomDock
          zoom={zoom}
          follow={follow}
          onZoomIn={() => zoomBy(1.5)}
          onZoomOut={() => zoomBy(1 / 1.5)}
          onReset={resetView}
          onToggleFollow={() => setFollow(!follow)}
        />
        <WheelHint show={hint} />

        <AnimatePresence>
          {inspected !== null && (
            <NodePopover key={inspected} nodeId={inspected} anchor={positions[inspected]} mk={mk} mx={mx} my={my} stage={stage} onClose={closePopover} />
          )}
        </AnimatePresence>
      </div>

      {/* En pantalla completa se conservan todos los controles de reproducción */}
      {fullscreen && (
        <div className="border-t border-zinc-800/80 p-3">
          <Transport embedded />
        </div>
      )}
    </SpotlightCard>
  );
}
