import type { ModelTone } from '../../lib/models';

/** Línea de acento por modelo (P3 = mitad violeta, mitad lima). */
export const TONE_ACCENT: Record<ModelTone, string> = {
  general: 'bg-zinc-100',
  p1: 'bg-p1',
  p2: 'bg-p2',
  p3: 'bg-[linear-gradient(90deg,var(--color-p1)_0_50%,var(--color-p2)_50%_100%)]',
};

/** Texto del modelo (P3 usa blanco: su identidad la da el chip bicolor). */
export const TONE_TEXT: Record<ModelTone, string> = {
  general: 'text-zinc-50',
  p1: 'text-p1',
  p2: 'text-p2',
  p3: 'text-zinc-50',
};
