import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { animate, cancelFrame, frame, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
import type { Point } from '../../lib/layout';
import type { Frame } from '../../lib/layout';
import { clampView, IDENTITY, type Dims, type View } from './geometry';

// ───────────────────────────────────────────────────────────── posiciones con resorte

const GLIDE = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 1 };

function samePoints(a: Point[], b: Point[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i].x - b[i].x) > 0.01 || Math.abs(a[i].y - b[i].y) > 0.01) return false;
  return true;
}

/**
 * Interpola las posiciones de los nodos con un resorte cuando cambia la disposición
 * (geométrica ↔ circular). Arcos, etiquetas y camión se derivan de estas posiciones,
 * así que todo el mapa "fluye" junto. Si cambia la instancia (`identity`), los nodos
 * son otros clientes: se reubican sin interpolar y entran con su propia animación.
 */
export function useAnimatedPoints(target: Point[], identity: string): Point[] {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const identityRef = useRef(identity);

  useEffect(() => {
    const from = displayRef.current;
    const sameInstance = identityRef.current === identity;
    identityRef.current = identity;
    if (reduce || !sameInstance || from.length !== target.length || samePoints(from, target)) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    const controls = animate(0, 1, {
      ...GLIDE,
      onUpdate: (t) => {
        const pts = from.map((p, i) => ({ x: p.x + (target[i].x - p.x) * t, y: p.y + (target[i].y - p.y) * t }));
        displayRef.current = pts;
        setDisplay(pts);
      },
      onComplete: () => {
        displayRef.current = target;
        setDisplay(target);
      },
    });
    return () => controls.stop();
  }, [target, identity, reduce]);

  // Primer render tras cambiar de instancia: usar ya las posiciones nuevas
  return display.length === target.length && identityRef.current === identity ? display : target;
}

// ───────────────────────────────────────────────────────────── cámara

const SOFT = { type: 'spring' as const, stiffness: 300, damping: 34, mass: 1 };
const SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 36, mass: 0.8 };
const FOLLOW = { type: 'spring' as const, stiffness: 320, damping: 34, mass: 1 };

export type ViewMotion = 'soft' | 'snappy' | 'follow' | 'instant';

export interface Viewport {
  mk: MotionValue<number>;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  /** Último objetivo solicitado (ya acotado). */
  viewRef: RefObject<View>;
  /** Zoom objetivo (estado React, para la lectura "150 %"). */
  zoom: number;
  setView: (v: View, how?: ViewMotion) => void;
}

/**
 * Zoom/paneo con valores de movimiento: el transform del grupo se escribe
 * directamente en el DOM, sin renders de React por cuadro. `frame` es el marco del
 * viewBox vigente: acota el paneo y, si cambia, la vista actual se vuelve a acotar.
 */
export function useViewport(frame: Dims): Viewport {
  const reduce = useReducedMotion();
  const mk = useMotionValue(1);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const viewRef = useRef<View>(IDENTITY);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const setView = useCallback(
    (next: View, how: ViewMotion = 'soft') => {
      const v = clampView(next, frameRef.current);
      viewRef.current = v;
      // El seguimiento del camión llama a esto en cada cuadro: solo re-renderiza si cambia el zoom.
      const z = Math.round(v.k * 100) / 100;
      if (z !== zoomRef.current) {
        zoomRef.current = z;
        setZoom(z);
      }
      if (how === 'instant' || reduce) {
        mk.jump(v.k);
        mx.jump(v.x);
        my.jump(v.y);
        return;
      }
      const t = how === 'snappy' ? SNAPPY : how === 'follow' ? FOLLOW : SOFT;
      if (Math.abs(mk.get() - v.k) > 1e-4) animate(mk, v.k, t);
      animate(mx, v.x, t);
      animate(my, v.y, t);
    },
    [mk, mx, my, reduce],
  );

  // Cambio de marco (giro del teléfono, entrar a pantalla completa): re-acotar sin animar
  useLayoutEffect(() => {
    setView(viewRef.current, 'instant');
  }, [frame.w, frame.h, setView]);

  return { mk, mx, my, viewRef, zoom, setView };
}

/**
 * Suscribe `cb` a los cambios de la cámara, agrupados en una sola llamada por cuadro
 * (paso "render" del planificador de Motion).
 */
export function useViewSubscription(vp: Pick<Viewport, 'mk' | 'mx' | 'my'>, cb: () => void) {
  const { mk, mx, my } = vp;
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useLayoutEffect(() => {
    const run = () => cbRef.current();
    const schedule = () => frame.render(run);
    const a = mk.on('change', schedule);
    const b = mx.on('change', schedule);
    const c = my.on('change', schedule);
    return () => {
      a();
      b();
      c();
      cancelFrame(run);
    };
  }, [mk, mx, my]);
}

/** Aplica la cámara al atributo transform de un grupo SVG. */
export function useApplyView(ref: RefObject<SVGGElement | null>, vp: Pick<Viewport, 'mk' | 'mx' | 'my'>) {
  const { mk, mx, my } = vp;
  const apply = useCallback(() => {
    ref.current?.setAttribute('transform', `translate(${mx.get()} ${my.get()}) scale(${mk.get()})`);
  }, [ref, mk, mx, my]);
  useLayoutEffect(apply, [apply]);
  useViewSubscription(vp, apply);
}

// ───────────────────────────────────────────────────────────── lienzo

export interface Stage {
  /** Tamaño del lienzo en px CSS. */
  w: number;
  h: number;
  /** Escala viewBox → px y desplazamiento del letterbox (preserveAspectRatio meet). */
  s: number;
  ox: number;
  oy: number;
}

/** Tamaño del lienzo en px CSS (0 × 0 hasta la primera medición). */
export function useCanvasSize(ref: RefObject<HTMLElement | null>): Dims {
  const [size, setSize] = useState<Dims>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Escala y letterbox del marco dentro del lienzo (preserveAspectRatio meet). */
export function stageOf(size: Dims, frame: Frame): Stage {
  if (!size.w || !size.h) return { w: frame.w, h: frame.h, s: 1, ox: 0, oy: 0 };
  const s = Math.min(size.w / frame.w, size.h / frame.h);
  return { w: size.w, h: size.h, s, ox: (size.w - frame.w * s) / 2, oy: (size.h - frame.h * s) / 2 };
}
