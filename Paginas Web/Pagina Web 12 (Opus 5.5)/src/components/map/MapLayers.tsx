/**
 * Capas SVG del mapa de ruta. Las capas estáticas (guías, arcos, nodos) están
 * memoizadas y NO se suscriben al progreso; solo TrailLayer y TruckLayer lo hacen.
 */
import { memo, useEffect, type CSSProperties, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Warehouse } from 'lucide-react';
import type { Point } from '../../lib/layout';
import type { NodeDef } from '../../types/solution';
import { fmtAuto } from '../../lib/format';
import { POLICY_INFO } from '../../lib/models';
import { useLiveMetrics, useProgress, useSim } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { clamp, DEPOT_HALF, INK, NODE_R, niceKm, truckPose, VIEW_H, VIEW_W, type ArcGeom, type Pose } from './geometry';

export interface MapIds {
  dots: string;
  glow: string;
  beam: string;
  strip: string;
}

const EASE_SPRING = 'cubic-bezier(0.34, 1.36, 0.64, 1)';
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const COLOR_T: CSSProperties = { transition: `fill 320ms ${EASE_OUT}, stroke 320ms ${EASE_OUT}, opacity 320ms ${EASE_OUT}` };
const PING: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };

function halo(on: boolean): CSSProperties {
  return {
    ...PING,
    opacity: on ? 1 : 0,
    transform: on ? 'scale(1)' : 'scale(0.82)',
    transition: `opacity 220ms ${EASE_OUT}, transform 420ms ${EASE_SPRING}`,
  };
}

// ───────────────────────────────────────────────────────────── guías de fondo

interface GuidesProps {
  mode: 'geo' | 'ring';
  center: Point;
  /** Unidades del viewBox por km (solo modo geométrico). */
  upk: number | null;
  maxKm: number;
  /** Anillo de la disposición circular (círculo, o elipse en marcos estrechos). */
  ring: { rx: number; ry: number };
  dotsId: string;
}

export const GuidesLayer = memo(function GuidesLayer({ mode, center, upk, maxKm, ring, dotsId }: GuidesProps) {
  const rings: number[] = [];
  if (mode === 'geo' && upk && maxKm > 0) {
    const step = niceKm(maxKm / 3);
    for (let r = step; r <= maxKm * 1.08 && rings.length < 5; r += step) rings.push(r);
  }
  const labelAngle = (-38 * Math.PI) / 180;
  return (
    <g pointerEvents="none">
      {/* Retícula holgada: cubre cualquier marco (base o adaptativo) también al desplazar */}
      <rect x={-VIEW_W * 2} y={-VIEW_W * 2} width={VIEW_W * 5} height={VIEW_W * 5} fill={`url(#${dotsId})`} />
      <AnimatePresence initial={false}>
        <motion.g key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {mode === 'geo' && upk
            ? rings.map((km) => {
                const R = km * upk;
                return (
                  <g key={km}>
                    <circle cx={center.x} cy={center.y} r={R} fill="none" stroke={INK.z800} strokeWidth={1} strokeDasharray="2 6" />
                    <text
                      x={center.x + R * Math.cos(labelAngle)}
                      y={center.y + R * Math.sin(labelAngle)}
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={8.5}
                      className="font-mono"
                      fill={INK.z400}
                      stroke={INK.z950}
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {fmtAuto(km)} km
                    </text>
                  </g>
                );
              })
            : mode === 'ring' && (
                <ellipse cx={center.x} cy={center.y} rx={ring.rx} ry={ring.ry} fill="none" stroke={INK.z800} strokeWidth={1} strokeDasharray="2 6" />
              )}
        </motion.g>
      </AnimatePresence>
    </g>
  );
});

// ───────────────────────────────────────────────────────────── arcos

export type ArcState = 'done' | 'current' | 'todo';

export interface ArcItem {
  key: string;
  g: ArcGeom;
  state: ArcState;
  distance: number;
  from: number;
  to: number;
}

const ARC: Record<ArcState, { stroke: string; opacity: number; width: number; dash?: string; chevron: string; text: string }> = {
  done: { stroke: INK.z300, opacity: 0.7, width: 2, chevron: INK.z300, text: INK.z300 },
  current: { stroke: INK.z50, opacity: 0.42, width: 1.75, dash: '5 4', chevron: INK.z50, text: INK.z50 },
  todo: { stroke: INK.z700, opacity: 1, width: 1.5, dash: '3 5', chevron: INK.z600, text: INK.z400 },
};

const label = (id: number) => (id === 0 ? 'Depósito' : `C${id}`);

export const ArcsLayer = memo(function ArcsLayer({ items, hoverNode, entranceKey }: { items: ArcItem[]; hoverNode: number | null; entranceKey: string }) {
  return (
    <g>
      {items.map((it, i) => {
        const s = ARC[it.state];
        const lit = hoverNode !== null && (it.from === hoverNode || it.to === hoverNode);
        const stroke = lit && it.state === 'todo' ? INK.z500 : s.stroke;
        const opacity = lit ? 1 : s.opacity;
        const text = fmtAuto(it.distance);
        const w = text.length * 6.1 + 11;
        return (
          <motion.g
            key={`${entranceKey}-${it.key}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.12 + i * 0.03 }}
          >
            <title>{`${label(it.from)} → ${label(it.to)} · ${text} km`}</title>
            <path d={it.g.d} fill="none" stroke="transparent" strokeWidth={12} pointerEvents="stroke" />
            <path
              d={it.g.d}
              fill="none"
              strokeLinecap="round"
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              className={it.state === 'current' ? 'animate-dash-flow' : undefined}
              style={{ ...COLOR_T, stroke, opacity }}
              pointerEvents="none"
            />
            <path
              d="M -3 -3.4 L 1.6 0 L -3 3.4"
              transform={`translate(${it.g.mid.x} ${it.g.mid.y}) rotate(${it.g.angleMid})`}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ ...COLOR_T, stroke: lit && it.state === 'todo' ? INK.z400 : s.chevron }}
              pointerEvents="none"
            />
            <g transform={`translate(${it.g.label.x} ${it.g.label.y})`} pointerEvents="none">
              <rect
                x={-w / 2}
                y={-7.5}
                width={w}
                height={15}
                rx={7.5}
                fill={INK.z950}
                fillOpacity={0.9}
                strokeWidth={1}
                style={{ ...COLOR_T, stroke: it.state === 'current' ? 'rgb(250 250 250 / 0.5)' : lit ? INK.z600 : INK.z800 }}
              />
              <text textAnchor="middle" dy="0.35em" fontSize={10} fontWeight={500} className="font-mono" style={{ ...COLOR_T, fill: s.text }}>
                {text}
              </text>
            </g>
          </motion.g>
        );
      })}
    </g>
  );
});

// ───────────────────────────────────────────────────────────── estela del tramo actual (60 fps)

export const TrailLayer = memo(function TrailLayer({ arcs }: { arcs: ArcGeom[] }) {
  const { mode, stepIndex } = useSim();
  const progress = useProgress();
  if (mode !== 'transit') return null;
  const g = arcs[stepIndex];
  if (!g) return null;
  const t = clamp(g.t0 + (g.t1 - g.t0) * progress, 0, 1);
  if (t <= 0.002) return null;
  const dash = `${t} 1`;
  return (
    <g pointerEvents="none">
      <path d={g.d} pathLength={1} strokeDasharray={dash} fill="none" stroke={INK.z50} strokeOpacity={0.1} strokeWidth={8} />
      <path d={g.d} pathLength={1} strokeDasharray={dash} fill="none" stroke={INK.z50} strokeWidth={2.25} />
    </g>
  );
});

// ───────────────────────────────────────────────────────────── nodos

export type NodeState = 'idle' | 'visited' | 'target' | 'current';

const CUSTOMER: Record<NodeState, { fill: string; stroke: string; sw: number; text: string }> = {
  idle: { fill: INK.z900, stroke: INK.z600, sw: 1.5, text: INK.z300 },
  visited: { fill: INK.z800, stroke: INK.z300, sw: 1.5, text: INK.z100 },
  target: { fill: INK.z900, stroke: INK.z50, sw: 2, text: INK.z50 },
  current: { fill: INK.z50, stroke: INK.z50, sw: 2, text: INK.z950 },
};

const BADGE: Record<NodeState, { fill: string; stroke: string; text: string }> = {
  idle: { fill: INK.z950, stroke: INK.z700, text: INK.z400 },
  visited: { fill: INK.z300, stroke: INK.z300, text: INK.z900 },
  target: { fill: INK.z950, stroke: INK.z50, text: INK.z50 },
  current: { fill: INK.z950, stroke: INK.z50, text: INK.z50 },
};

const STATE_TEXT: Record<NodeState, string> = {
  idle: 'Pendiente.',
  visited: 'Visitado.',
  target: 'Próximo destino.',
  current: 'El camión está aquí.',
};

interface MapNodeProps {
  node: NodeDef;
  x: number;
  y: number;
  index: number;
  state: NodeState;
  order: number | undefined;
  policy: 1 | 2 | null;
  hovered: boolean;
  related: 'A' | 'B' | null;
  inspected: boolean;
  onEnter: (id: number) => void;
  onLeave: (id: number) => void;
  onActivate: (id: number) => void;
  /** Foco por teclado: la cámara se desplaza si el nodo quedó fuera de vista con zoom. */
  onReveal: (id: number) => void;
}

const MapNode = memo(function MapNode({ node, x, y, index, state, order, policy, hovered, related, inspected, onEnter, onLeave, onActivate, onReveal }: MapNodeProps) {
  const id = node.id;
  const isDepot = id === 0;
  const r = isDepot ? DEPOT_HALF : NODE_R;
  const c = CUSTOMER[state];
  const b = BADGE[state];
  const pol = policy ? POLICY_INFO[policy] : null;
  const relColor = related === 'A' ? INK.alpha : related === 'B' ? INK.beta : INK.z50;
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onActivate(id);
    }
  };
  const aria = isDepot
    ? `Depósito. Inicio y fin del tour. Carga inicial α ${node.alpha}, retorno β ${node.beta}. ${state === 'current' ? 'El camión está aquí.' : ''}`
    : `${node.label}. Parada ${order ?? '—'} del tour. Entrega α ${node.alpha}, recoge β ${node.beta}.${pol ? ` Decisión ${pol.code}.` : ''} ${STATE_TEXT[state]}`;

  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.05 + index * 0.035 }}
      >
        <g
          data-map-node={id}
          role="button"
          tabIndex={0}
          aria-label={aria}
          aria-pressed={inspected}
          className="group cursor-pointer outline-none"
          onPointerEnter={() => onEnter(id)}
          onPointerLeave={() => onLeave(id)}
          onFocus={(e) => {
            onEnter(id);
            if (e.currentTarget.matches(':focus-visible')) onReveal(id);
          }}
          onBlur={(e) => {
            if (!e.currentTarget.matches(':hover')) onLeave(id);
          }}
          onClick={() => onActivate(id)}
          onKeyDown={onKey}
        >
          {/* Área de impacto ampliada */}
          <circle r={r + 11} fill="transparent" />

          {/* Resaltado cruzado desde el compartimiento (unidad α → destino, β → origen) */}
          <circle r={r + 9} fill={relColor} fillOpacity={0.1} stroke={relColor} strokeWidth={2} style={halo(related !== null)} />
          {/* Hover / inspección */}
          {isDepot ? (
            <rect x={-r - 7} y={-r - 7} width={(r + 7) * 2} height={(r + 7) * 2} rx={13} fill={INK.z50} fillOpacity={0.06} stroke={INK.z50} strokeOpacity={0.35} style={halo(hovered || inspected)} />
          ) : (
            <circle r={r + 7} fill={INK.z50} fillOpacity={0.06} stroke={INK.z50} strokeOpacity={0.35} style={halo(hovered || inspected)} />
          )}
          {/* Foco de teclado */}
          <circle r={r + 5.5} fill="none" stroke={INK.z50} strokeWidth={2} className="opacity-0 transition-opacity group-focus-visible:opacity-100" />

          {/* Estado de la parada */}
          {state === 'target' &&
            (isDepot ? (
              <rect x={-r - 3} y={-r - 3} width={(r + 3) * 2} height={(r + 3) * 2} rx={10} fill="none" stroke={INK.z50} strokeWidth={1.5} className="animate-ring-ping" style={PING} />
            ) : (
              <circle r={r + 3} fill="none" stroke={INK.z50} strokeWidth={1.5} className="animate-ring-ping" style={PING} />
            ))}
          {state === 'current' &&
            (isDepot ? (
              <rect x={-r - 4.5} y={-r - 4.5} width={(r + 4.5) * 2} height={(r + 4.5) * 2} rx={11} fill="none" stroke={INK.z50} strokeOpacity={0.35} strokeWidth={1.25} />
            ) : (
              <circle r={r + 4.5} fill="none" stroke={INK.z50} strokeOpacity={0.35} strokeWidth={1.25} />
            ))}

          {isDepot ? (
            <>
              <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={8} fill={INK.z50} />
              <Warehouse x={-8} y={-8} size={16} color={INK.z950} strokeWidth={2.1} aria-hidden focusable="false" />
              <text y={r + 13} textAnchor="middle" dy="0.35em" fontSize={8.5} letterSpacing="0.14em" className="font-mono" fill={INK.z400} stroke={INK.z950} strokeWidth={3} paintOrder="stroke">
                DEPÓSITO
              </text>
            </>
          ) : (
            <>
              <circle r={r} strokeWidth={c.sw} style={{ ...COLOR_T, fill: c.fill, stroke: c.stroke }} />
              <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={600} className="font-mono" style={{ ...COLOR_T, fill: c.text }}>
                C{id}
              </text>

              {/* Orden de visita en el tour */}
              {order !== undefined && (
                <g transform={`translate(${r * 0.76} ${-r * 0.76})`}>
                  <circle r={6.5} strokeWidth={1} style={{ ...COLOR_T, fill: b.fill, stroke: b.stroke }} />
                  <text textAnchor="middle" dy="0.35em" fontSize={7.5} fontWeight={700} className="font-mono" style={{ ...COLOR_T, fill: b.text }}>
                    {order}
                  </text>
                </g>
              )}

              {/* Decisión de la Política 3 */}
              {pol && (
                <g transform={`translate(0 ${-(r + 12)})`}>
                  <rect x={-11} y={-6.5} width={22} height={13} rx={4} fill={INK.z950} stroke={pol.color} strokeOpacity={0.75} strokeWidth={1} />
                  <text textAnchor="middle" dy="0.35em" fontSize={8.5} fontWeight={700} className="font-mono" fill={pol.color}>
                    {pol.code}
                  </text>
                </g>
              )}

              {/* Demanda α / β */}
              <text y={r + 12} textAnchor="middle" dy="0.35em" fontSize={9.5} fontWeight={500} className="font-mono" stroke={INK.z950} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
                <tspan fill={node.alpha > 0 ? INK.alpha : INK.z400}>α{node.alpha}</tspan>
                <tspan dx={4} fill={node.beta > 0 ? INK.beta : INK.z400}>
                  β{node.beta}
                </tspan>
              </text>
            </>
          )}
        </g>
      </motion.g>
    </g>
  );
});

interface NodesLayerProps {
  nodes: NodeDef[];
  positions: Point[];
  states: NodeState[];
  order: Record<number, number>;
  policies: (1 | 2 | null)[];
  hoverNode: number | null;
  related: { id: number; type: 'A' | 'B' } | null;
  inspected: number | null;
  entranceKey: string;
  onEnter: (id: number) => void;
  onLeave: (id: number) => void;
  onActivate: (id: number) => void;
  onReveal: (id: number) => void;
}

export const NodesLayer = memo(function NodesLayer(p: NodesLayerProps) {
  // El depósito se dibuja al final para quedar por encima de los arcos que convergen en él.
  const ordered = [...p.nodes.map((n, i) => ({ n, i }))].sort((a, b) => (a.n.id === 0 ? 1 : 0) - (b.n.id === 0 ? 1 : 0));
  return (
    <g>
      {ordered.map(({ n, i }) => {
        const pos = p.positions[n.id] ?? p.positions[i];
        if (!pos) return null;
        return (
          <MapNode
            key={`${p.entranceKey}-${n.id}`}
            node={n}
            x={pos.x}
            y={pos.y}
            index={i}
            state={p.states[n.id] ?? 'idle'}
            order={p.order[n.id]}
            policy={p.policies[n.id] ?? null}
            hovered={p.hoverNode === n.id}
            related={p.related && p.related.id === n.id ? p.related.type : null}
            inspected={p.inspected === n.id}
            onEnter={p.onEnter}
            onLeave={p.onLeave}
            onActivate={p.onActivate}
            onReveal={p.onReveal}
          />
        );
      })}
    </g>
  );
});

// ───────────────────────────────────────────────────────────── camión (60 fps)

const STRIP_X = -14.5;
const STRIP_W = 20;

/** Camión en vista cenital, orientado hacia +x (cabina adelante, compuerta LIFO atrás). */
const TruckGlyph = memo(function TruckGlyph({ a, b, q, moving, ids }: { a: number; b: number; q: number; moving: boolean; ids: MapIds }) {
  const wa = q > 0 ? (STRIP_W * Math.min(a, q)) / q : 0;
  const wb = q > 0 ? (STRIP_W * Math.min(b, Math.max(0, q - a))) / q : 0;
  return (
    <g>
      {/* Haz de los focos */}
      <path d="M 15.5 -4 L 44 -13 L 44 13 L 15.5 4 Z" fill={`url(#${ids.beam})`} style={{ opacity: moving ? 1 : 0, transition: `opacity 500ms ${EASE_OUT}` }} />
      {/* Ruedas */}
      <g fill={INK.z600}>
        <rect x={-14.5} y={-7.5} width={5} height={1.9} rx={0.95} />
        <rect x={-14.5} y={5.6} width={5} height={1.9} rx={0.95} />
        <rect x={-7.5} y={-7.5} width={5} height={1.9} rx={0.95} />
        <rect x={-7.5} y={5.6} width={5} height={1.9} rx={0.95} />
        <rect x={9.6} y={-7} width={4} height={1.7} rx={0.85} />
        <rect x={9.6} y={5.3} width={4} height={1.7} rx={0.85} />
      </g>
      {/* Caja de carga */}
      <rect x={-17} y={-6} width={24} height={12} rx={2.4} fill={INK.z100} />
      {/* Compuerta trasera (única puerta, LIFO) */}
      <rect x={-17} y={-5} width={1.5} height={10} rx={0.75} fill={INK.z400} />
      {/* Composición de la carga: α | β | libre */}
      <g clipPath={`url(#${ids.strip})`}>
        <rect x={STRIP_X} y={-1.4} width={STRIP_W} height={2.8} fill={INK.z300} />
        {wa > 0 && <rect x={STRIP_X} y={-1.4} width={wa} height={2.8} fill={INK.alpha} style={{ transition: `width 380ms ${EASE_OUT}` }} />}
        {wb > 0 && <rect x={STRIP_X + wa} y={-1.4} width={wb} height={2.8} fill={INK.beta} style={{ transition: `width 380ms ${EASE_OUT}, x 380ms ${EASE_OUT}` }} />}
      </g>
      {/* Enganche + cabina */}
      <rect x={7} y={-2} width={1.4} height={4} fill={INK.z400} />
      <rect x={8.2} y={-5.4} width={7} height={10.8} rx={2.6} fill={INK.z200} />
      <rect x={12.3} y={-4.1} width={2.1} height={8.2} rx={1} fill={INK.z800} />
    </g>
  );
});

interface TruckLayerProps {
  arcs: ArcGeom[];
  positions: Point[];
  ids: MapIds;
  onPose: (pose: Pose) => void;
}

export const TruckLayer = memo(function TruckLayer({ arcs, positions, ids, onPose }: TruckLayerProps) {
  const { mode, stepIndex, bay, choreo, solution } = useSim();
  const progress = useProgress();
  const live = useLiveMetrics();
  const { hoverUnit } = useHover();
  const depot = positions[0] ?? { x: VIEW_W / 2, y: VIEW_H / 2 };
  const { pose } = truckPose(arcs, mode, stepIndex, progress, depot);

  useEffect(() => {
    onPose(pose);
  });

  const q = choreo?.capacity ?? solution?.capacity ?? 0;
  const load = live?.load ?? { A: 0, B: 0, empty: q };

  // Conector hacia el nodo relacionado con la unidad resaltada (si sigue a bordo)
  let connector = null;
  if (hoverUnit && choreo && bay?.layout.includes(hoverUnit)) {
    const u = choreo.units[hoverUnit];
    const nodeId = u ? (u.type === 'A' ? u.destination : u.origin) : undefined;
    const p = nodeId !== undefined && nodeId !== 0 ? positions[nodeId] : undefined;
    if (u && p) {
      connector = (
        <line
          x1={pose.x}
          y1={pose.y}
          x2={p.x}
          y2={p.y}
          stroke={u.type === 'A' ? INK.alpha : INK.beta}
          strokeWidth={1.25}
          strokeDasharray="2 4"
          strokeLinecap="round"
          opacity={0.85}
        />
      );
    }
  }

  return (
    <g pointerEvents="none">
      {connector}
      <g transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle})`} filter={`url(#${ids.glow})`}>
        <TruckGlyph a={load.A} b={load.B} q={q} moving={mode === 'transit'} ids={ids} />
      </g>
    </g>
  );
});

/** Definiciones SVG compartidas (patrón de puntos, brillo del camión, haz, recorte de la franja). */
export function MapDefs({ ids }: { ids: MapIds }) {
  return (
    <defs>
      <pattern id={ids.dots} width={22} height={22} patternUnits="userSpaceOnUse">
        <circle cx={1} cy={1} r={0.85} fill="#ffffff" fillOpacity={0.075} />
      </pattern>
      <filter id={ids.glow} x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
        <feDropShadow dx={0} dy={1.5} stdDeviation={1.6} floodColor="#000000" floodOpacity={0.75} />
        <feDropShadow dx={0} dy={0} stdDeviation={4.5} floodColor="#ffffff" floodOpacity={0.26} />
      </filter>
      <linearGradient id={ids.beam} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
      </linearGradient>
      <clipPath id={ids.strip}>
        <rect x={STRIP_X} y={-1.4} width={STRIP_W} height={2.8} rx={1.4} />
      </clipPath>
    </defs>
  );
}
