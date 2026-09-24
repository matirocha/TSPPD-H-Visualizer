/**
 * Posiciones de los nodos en el mapa.
 * - 'geo': MDS clásico sobre la matriz de distancias c_ij → recupera la geometría
 *   real de la instancia (salvo rotación/reflejo), así la longitud visual de cada
 *   arco es proporcional a su costo.
 * - 'ring': depósito al centro y clientes en círculo (disposición de la Página 10); en
 *   marcos bajos o angostos el círculo se estira a elipse para que las etiquetas no choquen.
 */
export interface Point {
  x: number;
  y: number;
}

export type MapLayoutMode = 'geo' | 'ring';

/** Autovector dominante de una matriz simétrica por iteración de potencias. */
function powerIteration(M: number[][], deflate: number[][] = [], iters = 200): { vec: number[]; val: number } {
  const n = M.length;
  let v = Array.from({ length: n }, (_, i) => 1 + ((i * 7919) % 13) / 13);
  let val = 0;
  for (let it = 0; it < iters; it++) {
    let w = M.map((row) => row.reduce((acc, m, j) => acc + m * v[j], 0));
    for (const u of deflate) {
      const dot = w.reduce((a, x, i) => a + x * u[i], 0);
      w = w.map((x, i) => x - dot * u[i]);
    }
    const norm = Math.hypot(...w) || 1;
    const next = w.map((x) => x / norm);
    val = next.reduce((a, x, i) => a + x * M[i].reduce((acc, m, j) => acc + m * next[j], 0), 0);
    v = next;
  }
  return { vec: v, val };
}

/** MDS clásico (Torgerson) → coordenadas 2D. */
export function mdsCoordinates(dist: number[][]): Point[] {
  const n = dist.length;
  const D2 = dist.map((row) => row.map((d) => (d > 1e6 ? 0 : d * d)));
  const rowMean = D2.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const total = rowMean.reduce((a, b) => a + b, 0) / n;
  const B = D2.map((r, i) => r.map((d, j) => -0.5 * (d - rowMean[i] - rowMean[j] + total)));
  const e1 = powerIteration(B);
  const e2 = powerIteration(B, [e1.vec]);
  const s1 = Math.sqrt(Math.max(e1.val, 0));
  const s2 = Math.sqrt(Math.max(e2.val, 0));
  return e1.vec.map((x, i) => ({ x: x * s1, y: e2.vec[i] * s2 }));
}

/** Márgenes del lienzo. El inferior es mayor: ahí flotan la leyenda y los controles de zoom. */
export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MAP_PAD: Pad = { top: 58, right: 60, bottom: 86, left: 60 };

/** Huella de la pila de etiquetas de un nodo (unidades del viewBox). */
const LABEL_W = 60;
const LABEL_H = 70;

/**
 * Escala puntos al rectángulo útil manteniendo proporción, y separa nodos muy próximos.
 * La separación usa una métrica elíptica (dy pesa más) porque cada nodo apila
 * etiquetas en vertical: política arriba, demanda α/β abajo.
 */
export function fitToBox(points: Point[], width: number, height: number, pad: Pad = MAP_PAD, minGap = 44, obstacles: Rect[] = []): Point[] {
  if (points.length === 0) return [];
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  // El MDS es invariante a rotaciones: se elige el ángulo que más agranda la escala
  // dentro del lienzo (la geometría no se deforma y los nodos quedan más separados).
  let best = points;
  let bestScale = -Infinity;
  for (let deg = 0; deg < 180; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rot = points.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
    const spanX = Math.max(...rot.map((p) => p.x)) - Math.min(...rot.map((p) => p.x)) || 1;
    const spanY = Math.max(...rot.map((p) => p.y)) - Math.min(...rot.map((p) => p.y)) || 1;
    const scale = Math.min(innerW / spanX, innerH / spanY);
    if (scale > bestScale * 1.0001) {
      bestScale = scale;
      best = rot;
    }
  }
  // Depósito en la mitad superior para una lectura estable entre instancias
  if (best.length > 1 && best[0].y > best.reduce((a, p) => a + p.y, 0) / best.length) best = best.map((p) => ({ x: p.x, y: -p.y }));

  const xs = best.map((p) => p.x);
  const ys = best.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = pad.left + (innerW - spanX * scale) / 2;
  const offY = pad.top + (innerH - spanY * scale) / 2;
  const pts = best.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }));

  return relax(pts, width, height, pad, minGap, obstacles);
}

/** Rectángulo en unidades del viewBox. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Extensión vertical de la pila de etiquetas respecto del centro del nodo. */
const STACK_ABOVE = 34;
const STACK_BELOW = 33;

/**
 * Relajación suave: separa solo los nodos cuyas "pilas de etiquetas" se tocarían, sin
 * deformar la geometría global. Cada nodo ocupa un rectángulo LABEL_W × LABEL_H
 * (política arriba, círculo, demanda α/β abajo); ante un choque se empuja por el eje de
 * menor penetración. Además se mantiene una distancia mínima entre centros, y ninguna
 * pila queda bajo un panel flotante (`obstacles`: HUD, leyenda, controles de zoom), que
 * siempre toca un borde: el nodo sale hacia el interior por el lado más barato.
 */
function relax(pts: Point[], width: number, height: number, pad: Pad, minGap: number, obstacles: Rect[] = []): Point[] {
  /** Preferencia por separar en horizontal (mover en y deforma más la lectura del mapa). */
  const VERT = 1.2;
  // Nunca tan cerca del borde como para recortar la pila de etiquetas
  const left = Math.max(pad.left * 0.6, LABEL_W / 2 + 4);
  const right = width - Math.max(pad.right * 0.6, LABEL_W / 2 + 4);
  const top = Math.max(pad.top * 0.75, LABEL_H / 2 + 2);
  const bottom = height - Math.max(pad.bottom * 0.75, LABEL_H / 2 + 2);
  const clampX = (x: number) => Math.min(right, Math.max(left, x));
  const clampY = (y: number) => Math.min(bottom, Math.max(top, y));
  for (let it = 0; it < 160; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const penX = LABEL_W - Math.abs(dx);
        const penY = LABEL_H - Math.abs(dy);
        if (penX > 0 && penY > 0) {
          if (penX * VERT < penY) {
            const s = (dx >= 0 ? 1 : -1) * (penX / 2 + 0.5);
            pts[i].x -= s;
            pts[j].x += s;
          } else {
            const s = (dy >= 0 ? 1 : -1) * (penY / 2 + 0.5);
            pts[i].y -= s;
            pts[j].y += s;
          }
          moved = true;
          continue;
        }
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < minGap) {
          const push = (minGap - d) / 2;
          pts[i].x -= (dx / d) * push;
          pts[i].y -= (dy / d) * push;
          pts[j].x += (dx / d) * push;
          pts[j].y += (dy / d) * push;
          moved = true;
        }
      }
    }
    for (const p of pts) {
      for (const o of obstacles) {
        const penX = Math.min(p.x + LABEL_W / 2, o.x1) - Math.max(p.x - LABEL_W / 2, o.x0);
        const penY = Math.min(p.y + STACK_BELOW, o.y1) - Math.max(p.y - STACK_ABOVE, o.y0);
        if (penX <= 0 || penY <= 0) continue;
        // Salidas posibles: alejarse del borde que toca el panel
        const outX = o.x0 <= 0 ? o.x1 - (p.x - LABEL_W / 2) : o.x1 >= width ? -(p.x + LABEL_W / 2 - o.x0) : Infinity;
        const outY = o.y0 <= 0 ? o.y1 - (p.y - STACK_ABOVE) : o.y1 >= height ? -(p.y + STACK_BELOW - o.y0) : Infinity;
        if (Math.abs(outX) * VERT < Math.abs(outY)) p.x += outX + Math.sign(outX) * 0.5;
        else p.y += outY + Math.sign(outY) * 0.5;
        moved = true;
      }
      p.x = clampX(p.x);
      p.y = clampY(p.y);
    }
    if (!moved) break;
  }
  return pts;
}

// ───────────────────────────────────────────────────────────── marco del viewBox

/** Marco de dibujo: tamaño del viewBox, márgenes útiles y paneles flotantes, en sus unidades. */
export interface Frame {
  w: number;
  h: number;
  pad: Pad;
  /** Huella de los paneles HTML sobre el lienzo (HUD, leyenda, zoom) que las etiquetas esquivan. */
  obstacles: Rect[];
  /** Clave estable para memorizar (cambia solo si cambia el marco). */
  key: string;
}

export const BASE_W = 720;
export const BASE_H = 440;
export const BASE_FRAME: Frame = { w: BASE_W, h: BASE_H, pad: MAP_PAD, obstacles: [], key: 'base' };

/**
 * Paneles flotantes del mapa en px del lienzo (máximos razonables, con 6 px de aire):
 * HUD arriba a la izquierda, leyenda abajo a la izquierda y cámara abajo a la derecha.
 * Los anchos siguen los puntos de quiebre de MapOverlays (md: leyenda completa; sm:
 * rótulo "Seguir camión"), aproximados por el ancho del lienzo.
 */
function overlayRects(cw: number, ch: number): Rect[] {
  const E = 12 + 6;
  const legend = cw >= 700 ? { w: 282, h: 52 } : { w: 180, h: 36 };
  const zoomW = cw >= 560 ? 290 : 186;
  return [
    { x0: 0, y0: 0, x1: Math.min(236, cw - 24) + E, y1: 28 + E },
    { x0: 0, y0: ch - legend.h - E, x1: legend.w + E, y1: ch },
    { x0: cw - zoomW - E, y0: ch - 38 - E, x1: cw, y1: ch },
  ];
}

/** Lleva los paneles de px del lienzo a unidades del marco (considera el letterbox). */
function withObstacles(f: Frame, cw: number, ch: number): Frame {
  const s = Math.min(cw / f.w, ch / f.h);
  const ox = (cw - f.w * s) / 2;
  const oy = (ch - f.h * s) / 2;
  const q = (v: number) => Math.round(v / 4) * 4;
  const obstacles = overlayRects(cw, ch).map((r) => ({
    x0: q((r.x0 - ox) / s),
    y0: q((r.y0 - oy) / s),
    x1: q((r.x1 - ox) / s),
    y1: q((r.y1 - oy) / s),
  }));
  const sig = obstacles.map((o) => [o.x0, o.y0, o.x1, o.y1].join(',')).join(';');
  return { ...f, obstacles, key: f.key + '|' + sig };
}

/** Escala mínima deseada (viewBox → px): por debajo, textos de 11 u quedan < 8,5 px. */
const S_TARGET = 0.8;

/**
 * Elige el marco del viewBox para un lienzo de `cw × ch` px.
 * - Escritorio o lienzo apaisado holgado: el marco fijo 720 × 440 (sin cambios).
 * - Lienzo angosto (teléfono) o vertical (pantalla completa en vertical): el marco
 *   adopta la proporción del lienzo —sin franjas vacías— y una escala de al menos
 *   S_TARGET, así nodos y etiquetas conservan un tamaño legible. Si con esa escala no
 *   caben `nodeCount` pilas de etiquetas, la escala baja hasta que quepan.
 * Los márgenes reservan, en px reales, la franja del HUD (arriba) y la de controles
 * (abajo), más media pila de etiquetas.
 */
export function frameFor(cw: number, ch: number, nodeCount: number): Frame {
  if (!cw || !ch) return BASE_FRAME;
  const s0 = Math.min(cw / BASE_W, ch / BASE_H);
  const portrait = ch > cw * 1.05;
  const narrow = cw < 600;
  if (!portrait && !(narrow && s0 < S_TARGET)) return withObstacles(BASE_FRAME, cw, ch);

  const hudPx = 44;
  const controlsPx = cw >= 700 ? 66 : 50;
  const make = (s: number): Frame => {
    const w = Math.round(cw / s);
    const h = Math.round(ch / s);
    // La relajación admite nodos hasta el 75 % del margen (relax): se dimensiona para que
    // incluso ahí la pila de etiquetas (34 u arriba, 33 u abajo) no quede bajo el HUD ni
    // bajo la leyenda y los controles de zoom.
    const pad: Pad = {
      top: (hudPx / s + 34) / 0.75,
      right: 10 / s + 30,
      bottom: (controlsPx / s + 33) / 0.75,
      left: 10 / s + 30,
    };
    return { w, h, pad, obstacles: [], key: `${w}x${h}` };
  };
  const fits = (f: Frame) => {
    const iw = f.w - f.pad.left - f.pad.right;
    const ih = f.h - f.pad.top - f.pad.bottom;
    return iw >= 200 && ih >= 170 && iw * ih >= nodeCount * LABEL_W * LABEL_H * 2;
  };
  // Misma densidad que el escritorio (área ≈ 720 × 440), pero nunca por debajo de S_TARGET
  let s = Math.max(S_TARGET, Math.sqrt((cw * ch) / (BASE_W * BASE_H)));
  for (; s > s0 + 1e-3; s -= 0.02) {
    const f = make(s);
    if (fits(f)) return withObstacles(f, cw, ch);
  }
  return withObstacles(portrait ? make(Math.max(s0, 0.3)) : BASE_FRAME, cw, ch);
}

export function computeLayout(
  mode: MapLayoutMode,
  nodeCount: number,
  dist: number[][] | undefined,
  width: number,
  height: number,
  pad: Pad = MAP_PAD,
  obstacles: Rect[] = [],
): Point[] {
  if (mode === 'geo' && dist && dist.length === nodeCount && nodeCount > 2) {
    return fitToBox(mdsCoordinates(dist), width, height, pad, 44, obstacles);
  }
  const ring = ringGeometry(nodeCount, width, height, pad);
  const customers = nodeCount - 1;
  const pts: Point[] = [{ x: ring.cx, y: ring.cy }];
  for (let i = 0; i < customers; i++) {
    const a = (2 * Math.PI * i) / customers - Math.PI / 2;
    pts.push({ x: ring.cx + ring.rx * Math.cos(a), y: ring.cy + ring.ry * Math.sin(a) });
  }
  return relax(pts, width, height, pad, 44, obstacles);
}

/** Separación mínima entre clientes vecinos del anillo (≈ diagonal de la pila de etiquetas). */
const RING_GAP = 92;

/**
 * Anillo de la disposición circular, centrado en el área útil: un círculo si caben los
 * clientes con separación RING_GAP; si no (marcos bajos o angostos), una elipse que se
 * estira por el eje largo.
 */
export function ringGeometry(nodeCount: number, width: number, height: number, pad: Pad = MAP_PAD) {
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const r = Math.min(innerW, innerH) / 2;
  const need = (RING_GAP * Math.max(nodeCount - 1, 1)) / (2 * Math.PI);
  let rx = r;
  let ry = r;
  if (r < need) {
    if (innerW >= innerH) rx = Math.min(innerW / 2, need);
    else ry = Math.min(innerH / 2, need);
  }
  return { cx: pad.left + innerW / 2, cy: pad.top + innerH / 2, rx, ry };
}

/** Punto de control de un arco cuadrático suave entre dos nodos. */
export function arcControl(from: Point, to: Point, curvature = 0.14): Point {
  return {
    x: (from.x + to.x) / 2 - (to.y - from.y) * curvature,
    y: (from.y + to.y) / 2 + (to.x - from.x) * curvature,
  };
}

export function arcPath(from: Point, to: Point, curvature = 0.14): string {
  const c = arcControl(from, to, curvature);
  return `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`;
}

export function quadPoint(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/** Ángulo (grados) de la tangente de la curva en t. */
export function quadAngle(from: Point, control: Point, to: Point, t: number): number {
  const dx = 2 * (1 - t) * (control.x - from.x) + 2 * t * (to.x - control.x);
  const dy = 2 * (1 - t) * (control.y - from.y) + 2 * t * (to.y - control.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
