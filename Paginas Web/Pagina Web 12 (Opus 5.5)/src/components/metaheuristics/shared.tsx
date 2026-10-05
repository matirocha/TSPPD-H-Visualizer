/**
 * Piezas visuales compartidas por las tarjetas de la sección «Metaheurísticas» (resumen, gráficos,
 * hallazgos y detalle por instancia). Codificación de cada método, nunca solo por color:
 *  · color y forma = familia (Dos fases ámbar ▲, ILS azul ●, ITS fucsia ■);
 *  · evaluación exacta = trazo continuo y marca rellena; heurística = trazo discontinuo y marca hueca;
 *  · lo publicado en el paper, en gris (PAPER_COLOR).
 */
import type { ReactNode } from 'react';
import type { MetaMethod } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { COLOR } from '../analysis/chart';
import { META_INFO, PAPER_COLOR, methodColor, type MetaFamily } from './labels';

/** Celda numérica de las tablas de la sección (resumen y detalle). */
export const TD_NUM = 'num border-b border-zinc-800/60 px-2.5 py-2 text-right align-top whitespace-nowrap';

/** Segunda línea de una celda, visible (no solo en `title`). */
export function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('mt-0.5 block font-sans text-[10.5px] leading-4 font-normal text-zinc-500', className)}>{children}</span>;
}

/* ───────────────────────── Marcas ───────────────────────── */

export type MetaShape = 'triangle' | 'circle' | 'square';

const FAMILY_SHAPE: Record<MetaFamily, MetaShape> = { twophase: 'triangle', ils: 'circle', its: 'square' };

/** Forma de la marca de un método (la de su familia). */
export const methodShape = (m: MetaMethod): MetaShape => FAMILY_SHAPE[META_INFO[m].family];
/** Marca hueca: evaluación heurística del vecindario. */
export const methodHollow = (m: MetaMethod) => META_INFO[m].evaluation === 'heuristic';

function shapePath(shape: MetaShape, x: number, y: number, r: number): string {
  if (shape === 'triangle') {
    const d = r * 1.3;
    return `M${x},${y - d}L${x + d * 1.02},${y + d * 0.78}L${x - d * 1.02},${y + d * 0.78}Z`;
  }
  if (shape === 'square') {
    const s = r * 0.88; // misma área aparente que el círculo
    return `M${x - s},${y - s}H${x + s}V${y + s}H${x - s}Z`;
  }
  return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
}

/**
 * Marca SVG de un método: rellena (exacta, dos fases) o hueca (heurística), con un anillo del color
 * de la superficie para separarla de las líneas que cruza. `ring="transparent"` en leyendas HTML.
 */
export function MetaMarkSvg({
  shape,
  color,
  hollow = false,
  x,
  y,
  r = 4,
  ring = COLOR.surface,
}: {
  shape: MetaShape;
  color: string;
  hollow?: boolean;
  x: number;
  y: number;
  r?: number;
  ring?: string;
}) {
  if (hollow) {
    const d = shapePath(shape, x, y, r - 0.5);
    const solidRing = ring !== 'transparent';
    return (
      <g>
        {solidRing && <path d={d} fill={ring} stroke={ring} strokeWidth={4.5} strokeLinejoin="round" />}
        <path d={d} fill={solidRing ? ring : 'none'} stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
      </g>
    );
  }
  return <path d={shapePath(shape, x, y, r)} fill={color} stroke={ring} strokeWidth={2} strokeLinejoin="round" paintOrder="stroke" />;
}

/** Marca HTML de un método (leyendas, tooltips, hallazgos). `paper`: la versión gris de lo publicado. */
export function MetaMark({ method, size = 12, paper = false }: { method: MetaMethod; size?: number; paper?: boolean }) {
  const shape = methodShape(method);
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 12 12" className="shrink-0 overflow-visible">
      <MetaMarkSvg
        shape={shape}
        color={paper ? PAPER_COLOR : methodColor(method)}
        hollow={!paper && methodHollow(method)}
        x={6}
        y={shape === 'triangle' ? 6.6 : 6}
        r={4.1}
        ring="transparent"
      />
    </svg>
  );
}

/** Muestra del trazo del método para encabezados de tabla: exacto = continuo y relleno; heurístico = discontinuo y hueco. */
export function MethodSwatch({ method }: { method: MetaMethod }) {
  const color = methodColor(method);
  const hollow = methodHollow(method);
  return (
    <svg aria-hidden width="20" height="8" viewBox="0 0 20 8" className="shrink-0 overflow-visible">
      <line x1="1" y1="4" x2="19" y2="4" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeDasharray={hollow ? '3 2.5' : undefined} />
      <circle cx="10" cy="4" r="2.75" fill={hollow ? COLOR.surface : color} stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
