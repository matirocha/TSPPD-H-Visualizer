/**
 * Utilidades compartidas por los gráficos SVG de Bitácora y Comparativa:
 * medición responsiva, escalas "limpias", tooltip con resorte y piezas de leyenda.
 * Los gráficos se dibujan a mano (sin librerías) para mantener nitidez y control total.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { springSnappy } from '../../lib/motion';

/** Colores para SVG (espejo de los tokens de index.css). El texto nunca usa estos tonos. */
export const COLOR = {
  alpha: '#fb923c',
  beta: '#22d3ee',
  handling: '#fb7185',
  dist: '#d4d4d8',
  ink: '#fafafa',
  label: '#a1a1aa',
  tick: '#71717a',
  axis: '#3f3f46',
  grid: '#27272a',
  track: 'rgb(39 39 42 / 0.38)',
  /** Superficie efectiva de la tarjeta (zinc-900/60 sobre #09090b): anillo de separación de marcas. */
  surface: '#111114',
} as const;

export const nodeShort = (id: number) => (id === 0 ? 'D' : `C${id}`);
export const nodeLong = (id: number) => (id === 0 ? 'Depósito' : `Cliente ${id}`);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Paso "limpio" (1 · 2 · 2,5 · 5 × 10^k) para ~`target` divisiones. */
export function niceStep(max: number, target = 4): number {
  if (!(max > 0)) return 1;
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * pow;
}

/** Escala 0 → máximo redondeado hacia arriba, con sus marcas. */
export function niceScale(max: number, target = 4): { max: number; step: number; ticks: number[] } {
  const step = niceStep(max, target);
  const top = Math.max(step, Math.ceil(max / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step * 1e-6; i++) ticks.push(Number((i * step).toFixed(10)));
  return { max: top, step, ticks };
}

/** Ancho del contenedor (ResizeObserver) para dibujar el SVG a resolución real. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Trazado de una columna con extremo de datos redondeado (4 px) y base recta. */
export function columnPath(x: number, w: number, top: number, bottom: number, roundTop: boolean): string {
  const h = Math.max(0, bottom - top);
  const r = roundTop ? Math.min(4, h, w / 2) : 0;
  const t = bottom - h;
  return `M${x},${bottom}V${t + r}Q${x},${t} ${x + r},${t}H${x + w - r}Q${x + w},${t} ${x + w},${t + r}V${bottom}Z`;
}

// ─────────────────────────────────────────────────────────────── Tooltip

export interface TipAnchor {
  x: number;
  y: number;
}

/**
 * Tooltip flotante que se desliza con resorte entre marcas. Se sitúa sobre el ancla
 * y se voltea hacia abajo si no cabe; se limita al ancho del gráfico.
 * Es decorativo para lectores de pantalla (la misma información vive en aria-label / tabla).
 */
export function ChartTooltip({
  anchor,
  bounds,
  children,
  className,
  offset = 12,
  placement = 'top',
  minTop = -4,
  maxBottom,
}: {
  anchor: TipAnchor | null;
  /** Ancho disponible (px) del contenedor relativo. */
  bounds: number;
  children: ReactNode;
  className?: string;
  offset?: number;
  /** 'top': sobre el ancla (se voltea abajo si no cabe). 'side': a la derecha (o izquierda) del ancla. */
  placement?: 'top' | 'side';
  minTop?: number;
  maxBottom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 180, h: 84 });
  const last = useRef<TipAnchor>({ x: 0, y: 0 });
  if (anchor) last.current = anchor;
  const a = last.current;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (Math.abs(w - size.w) > 0.5 || Math.abs(h - size.h) > 0.5) setSize({ w, h });
  });

  let left: number;
  let top: number;
  if (placement === 'side') {
    const right = a.x + offset;
    left = right + size.w <= bounds ? right : a.x - offset - size.w;
    left = clamp(left, 0, Math.max(0, bounds - size.w));
    top = a.y - size.h / 2;
    if (maxBottom !== undefined) top = Math.min(top, maxBottom - size.h);
    top = Math.max(minTop, top);
  } else {
    left = clamp(a.x - size.w / 2, 0, Math.max(0, bounds - size.w));
    const above = a.y - size.h - offset;
    top = above < minTop ? a.y + offset : above;
  }

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-0 left-0 z-30 w-max max-w-[260px] rounded-xl border border-zinc-700/80 bg-zinc-900/95 px-3 py-2.5',
        'shadow-2xl shadow-black/50 backdrop-blur-md',
        className,
      )}
      initial={false}
      animate={{ x: left, y: top, opacity: anchor ? 1 : 0, scale: anchor ? 1 : 0.97 }}
      transition={springSnappy}
    >
      {children}
    </motion.div>
  );
}

export function TipHeader({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-4 border-b border-zinc-800 pb-1.5">
      <span className="font-mono text-[10.5px] tracking-wide text-zinc-400 uppercase">{children}</span>
      {aside}
    </div>
  );
}

/** Fila del tooltip: clave de línea corta + valor (fuerte) + etiqueta (secundaria). */
export function TipRow({ color, value, label, dashed }: { color?: string; value: ReactNode; label: ReactNode; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-[1px] text-[12px] leading-5">
      {color ? (
        <span
          aria-hidden
          className="h-0.5 w-3 shrink-0 rounded-full"
          style={
            dashed
              ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` }
              : { backgroundColor: color }
          }
        />
      ) : (
        <span aria-hidden className="w-3 shrink-0" />
      )}
      <span className="num font-medium text-zinc-50">{value}</span>
      <span className="text-zinc-400">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Leyenda

export type SwatchKind = 'bar' | 'line' | 'dash' | 'dot' | 'area';

export function Swatch({ kind, color }: { kind: SwatchKind; color: string }) {
  if (kind === 'bar') return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />;
  if (kind === 'dot') return <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
  if (kind === 'area')
    return (
      <span
        aria-hidden
        className="h-2.5 w-3.5 shrink-0 rounded-[3px] border-t-2"
        style={{ borderColor: color, backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)` }}
      />
    );
  if (kind === 'dash')
    return (
      <span
        aria-hidden
        className="h-px w-4 shrink-0"
        style={{ backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`, height: 1.5 }}
      />
    );
  return <span aria-hidden className="h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export function LegendItem({ kind, color, children }: { kind: SwatchKind; color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
      <Swatch kind={kind} color={color} />
      {children}
    </span>
  );
}
