/**
 * Geometría del mapa de ruta: arcos, pose del camión, cámara (zoom/paneo) y escala.
 * Todo en coordenadas del viewBox: el marco base VIEW_W × VIEW_H o, en lienzos angostos
 * o verticales, el marco adaptativo de `frameFor` (lib/layout).
 */
import { arcControl, BASE_H, BASE_W, quadAngle, quadPoint, type Point } from '../../lib/layout';
import type { SimMode } from '../../state/SimulationProvider';

export const VIEW_W = BASE_W;
export const VIEW_H = BASE_H;
export const CURVATURE = 0.14;
export const NODE_R = 15;
export const DEPOT_HALF = 14;
/** Holgura entre el borde del nodo y el centro del camión cuando está "atracado". */
const DOCK_GAP = 18;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Paleta SVG (hex del tema; los atributos de presentación no aceptan var()). */
export const INK = {
  alpha: '#fb923c',
  beta: '#22d3ee',
  handling: '#fb7185',
  p1: '#a78bfa',
  p2: '#a3e635',
  ok: '#34d399',
  z50: '#fafafa',
  z100: '#f4f4f5',
  z200: '#e4e4e7',
  z300: '#d4d4d8',
  z400: '#a1a1aa',
  z500: '#71717a',
  z600: '#52525b',
  z700: '#3f3f46',
  z800: '#27272a',
  z900: '#18181b',
  z950: '#09090b',
} as const;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const nodeRadius = (id: number) => (id === 0 ? DEPOT_HALF + 1 : NODE_R);
export const shortLabel = (id: number) => (id === 0 ? 'D' : `C${id}`);

// ───────────────────────────────────────────────────────────── arcos

export interface ArcGeom {
  from: Point;
  to: Point;
  ctrl: Point;
  d: string;
  /** Parámetros de la curva donde el camión queda atracado al salir / llegar. */
  t0: number;
  t1: number;
  mid: Point;
  angleMid: number;
  /** Centro de la píldora de distancia (desplazada sobre la normal, lado convexo). */
  label: Point;
}

export function arcGeom(from: Point, to: Point, fromId: number, toId: number): ArcGeom {
  const ctrl = arcControl(from, to, CURVATURE);
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const len = Math.max(1, chord * 1.04);
  let dFrom = nodeRadius(fromId) + DOCK_GAP;
  let dTo = nodeRadius(toId) + DOCK_GAP;
  const room = Math.max(0, len - 10);
  if (dFrom + dTo > room) {
    const f = room / (dFrom + dTo);
    dFrom *= f;
    dTo *= f;
  }
  const t0 = Math.min(0.5, dFrom / len);
  const t1 = Math.max(0.5, 1 - dTo / len);
  const mid = quadPoint(from, ctrl, to, 0.5);
  const nx = chord > 0 ? -(to.y - from.y) / chord : 0;
  const ny = chord > 0 ? (to.x - from.x) / chord : -1;
  const off = chord < 90 ? 15 : 13;
  return {
    from,
    to,
    ctrl,
    d: `M ${r2(from.x)} ${r2(from.y)} Q ${r2(ctrl.x)} ${r2(ctrl.y)} ${r2(to.x)} ${r2(to.y)}`,
    t0,
    t1,
    mid,
    angleMid: quadAngle(from, ctrl, to, 0.5),
    label: { x: mid.x + nx * off, y: mid.y + ny * off },
  };
}

/**
 * Reubica las píldoras de distancia para que no tapen nodos, sus etiquetas
 * (política arriba, demanda α/β abajo) ni otras píldoras. Prueba puntos a lo
 * largo del arco y a ambos lados de él; si ninguno queda libre, usa el de menor solape.
 */
export function placeArcLabels(arcs: ArcGeom[], positions: Point[], distances: number[]): ArcGeom[] {
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const overlap = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const obstacles: Box[] = positions.map((p, id) =>
    id === 0 ? { x0: p.x - 24, y0: p.y - 20, x1: p.x + 24, y1: p.y + 28 } : { x0: p.x - 29, y0: p.y - 34, x1: p.x + 29, y1: p.y + 32 },
  );
  const placed: Box[] = [];
  const candidates: [number, number][] = [
    [0.5, 1], [0.5, -1], [0.38, 1], [0.62, 1], [0.38, -1], [0.62, -1], [0.28, 1], [0.72, 1], [0.28, -1], [0.72, -1],
  ];
  return arcs.map((g, i) => {
    const w = 10 + String(distances[i] ?? '').length * 6.5;
    const h = 15;
    const chord = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
    const nx = chord > 0 ? -(g.to.y - g.from.y) / chord : 0;
    const ny = chord > 0 ? (g.to.x - g.from.x) / chord : -1;
    const off = chord < 90 ? 15 : 13;
    let best = g.label;
    let bestCost = Infinity;
    for (const [t, side] of candidates) {
      const p = quadPoint(g.from, g.ctrl, g.to, t);
      const c = { x: p.x + nx * off * side, y: p.y + ny * off * side };
      const box = { x0: c.x - w / 2 - 2, y0: c.y - h / 2 - 2, x1: c.x + w / 2 + 2, y1: c.y + h / 2 + 2 };
      const cost = [...obstacles, ...placed].reduce((a, o) => a + overlap(box, o), 0) + (t === 0.5 ? 0 : 0.5);
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
        if (cost <= 0.5) break;
      }
    }
    placed.push({ x0: best.x - w / 2, y0: best.y - h / 2, x1: best.x + w / 2, y1: best.y + h / 2 });
    return { ...g, label: best };
  });
}

// ───────────────────────────────────────────────────────────── camión

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

function poseOn(g: ArcGeom, t: number): Pose {
  const p = quadPoint(g.from, g.ctrl, g.to, t);
  return { x: p.x, y: p.y, angle: quadAngle(g.from, g.ctrl, g.to, t) };
}

function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Fracción inicial del tramo en que el camión "gira" desde su muelle anterior. */
const BLEND = 0.2;

/**
 * Pose del camión y fracción recorrida del arco actual.
 * El camión se atraca junto al nodo (no encima) para no tapar su etiqueta;
 * al partir, mezcla suavemente desde el muelle de llegada hacia el nuevo arco.
 */
export function truckPose(arcs: ArcGeom[], mode: SimMode, stepIndex: number, progress: number, depot: Point): { pose: Pose; trail: number } {
  if (!arcs.length) return { pose: { x: depot.x, y: depot.y, angle: 0 }, trail: 0 };
  const k = clamp(stepIndex, 0, arcs.length - 1);
  if (mode === 'initial') return { pose: poseOn(arcs[0], arcs[0].t0), trail: 0 };
  if (mode === 'finished') {
    const last = arcs[arcs.length - 1];
    return { pose: poseOn(last, last.t1), trail: 1 };
  }
  const g = arcs[k];
  if (mode === 'stop') return { pose: poseOn(g, g.t1), trail: 1 };
  const p = clamp(progress, 0, 1);
  const t = g.t0 + (g.t1 - g.t0) * p;
  let pose = poseOn(g, t);
  if (p < BLEND) {
    const prev = k > 0 ? poseOn(arcs[k - 1], arcs[k - 1].t1) : poseOn(g, g.t0);
    const b = easeInOut(p / BLEND);
    pose = { x: lerp(prev.x, pose.x, b), y: lerp(prev.y, pose.y, b), angle: lerpAngle(prev.angle, pose.angle, b) };
  }
  return { pose, trail: t };
}

// ───────────────────────────────────────────────────────────── cámara

export interface View {
  k: number;
  x: number;
  y: number;
}

export const IDENTITY: View = { k: 1, x: 0, y: 0 };

/** Tamaño del marco (viewBox) sobre el que opera la cámara. */
export interface Dims {
  w: number;
  h: number;
}

export const BASE_DIMS: Dims = { w: VIEW_W, h: VIEW_H };

/** Limita el zoom a [1, 4] y el paneo para que el mapa siempre cubra el lienzo. */
export function clampView(v: View, f: Dims = BASE_DIMS): View {
  const k = clamp(v.k, MIN_ZOOM, MAX_ZOOM);
  return { k, x: clamp(v.x, f.w - f.w * k, 0), y: clamp(v.y, f.h - f.h * k, 0) };
}

/** Zoom manteniendo fijo el punto (px, py) del viewBox. */
export function zoomAt(v: View, px: number, py: number, k: number, f: Dims = BASE_DIMS): View {
  const nk = clamp(k, MIN_ZOOM, MAX_ZOOM);
  const r = nk / v.k;
  return clampView({ k: nk, x: px - (px - v.x) * r, y: py - (py - v.y) * r }, f);
}

export function centerOn(v: View, p: Point, k = v.k, f: Dims = BASE_DIMS): View {
  return clampView({ k, x: f.w / 2 - k * p.x, y: f.h / 2 - k * p.y }, f);
}

// ───────────────────────────────────────────────────────────── escala (modo geométrico)

/** Unidades del viewBox por km (mediana de |p_i − p_j| / c_ij). */
export function unitsPerKm(points: Point[], dist?: number[][]): number | null {
  if (!dist || dist.length !== points.length) return null;
  const ratios: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = dist[i]?.[j];
      if (!d || d <= 0 || d > 1e6) continue;
      ratios.push(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) / d);
    }
  }
  if (!ratios.length) return null;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}

const NICE = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/** Valor "redondo" más cercano (en escala logarítmica). */
export function niceKm(target: number): number {
  if (!(target > 0)) return NICE[0];
  let best = NICE[0];
  for (const s of NICE) if (Math.abs(Math.log(s / target)) < Math.abs(Math.log(best / target))) best = s;
  return best;
}
