/**
 * Marca por modelo con codificación doble (color + forma), porque General (blanco) y
 * P3 (turquesa) quedan cerca bajo protanopía: General ○ · P1 ● · P2 ■ · P3 ◆.
 */
import { TONE_COLOR, type ModelTone } from '../../lib/models';
import { COLOR } from './chart';

export function ModelMarkSvg({ tone, x, y, r = 4.5, ring = COLOR.surface }: { tone: ModelTone; x: number; y: number; r?: number; ring?: string }) {
  const c = TONE_COLOR[tone];
  if (tone === 'general')
    return <circle cx={x} cy={y} r={r - 0.5} fill={ring} stroke={c} strokeWidth={2} />;
  if (tone === 'p1') return <circle cx={x} cy={y} r={r} fill={c} stroke={ring} strokeWidth={2} paintOrder="stroke" />;
  if (tone === 'p2') {
    const s = r * 1.7;
    return <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={1.5} fill={c} stroke={ring} strokeWidth={2} paintOrder="stroke" />;
  }
  const d = r * 1.3;
  return <path d={`M${x},${y - d}L${x + d},${y}L${x},${y + d}L${x - d},${y}Z`} fill={c} stroke={ring} strokeWidth={2} strokeLinejoin="round" paintOrder="stroke" />;
}

/** Versión HTML (leyendas y tarjetas). */
export function ModelMark({ tone, size = 12 }: { tone: ModelTone; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 12 12" className="shrink-0 overflow-visible">
      <ModelMarkSvg tone={tone} x={6} y={6} r={4.25} ring="transparent" />
    </svg>
  );
}
