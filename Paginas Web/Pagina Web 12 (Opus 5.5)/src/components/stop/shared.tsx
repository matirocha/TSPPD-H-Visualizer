/**
 * Piezas compartidas del panel de parada y del dock de reproducción:
 * iconografía por tipo de fase, mapas de tono (clases literales para Tailwind),
 * conteos por fase y utilidades de rotulado.
 */
import {
  ArrowRightToLine,
  ArrowUpFromLine,
  Flag,
  MapPin,
  MoveHorizontal,
  PackageCheck,
  PackagePlus,
  Truck,
  Undo2,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { Choreography, Phase, PhaseKind, PhaseTone, StopPlan } from '../../lib/choreography';
import { POLICY_INFO } from '../../lib/models';
import type { ModelType, SolutionData } from '../../types/solution';
import { Chip, type ChipTone } from '../ui';
import { scrollBehavior } from '../../lib/motion';

export const PHASE_ICON: Record<PhaseKind, LucideIcon> = {
  initial: Truck,
  arrive: MapPin,
  evac: ArrowUpFromLine,
  'evac-b': ArrowUpFromLine,
  'evac-a': ArrowUpFromLine,
  'deliver-a': PackageCheck,
  compact: MoveHorizontal,
  'load-b-front': ArrowRightToLine,
  'reload-a': Undo2,
  'reload-b': Undo2,
  'pickup-b': PackagePlus,
  'unload-b': Warehouse,
  complete: Flag,
};

/** Casilla del icono de fase (texto + fondo + borde). */
export const TONE_TILE: Record<PhaseTone, string> = {
  neutral: 'text-zinc-200 bg-zinc-800/80 border-zinc-700/70',
  alpha: 'text-alpha bg-alpha/12 border-alpha/35',
  beta: 'text-beta bg-beta/12 border-beta/35',
  handling: 'text-handling bg-handling/12 border-handling/35',
  success: 'text-ok bg-ok/12 border-ok/35',
};

/** Barra sólida del tono (autoavance, rellenos). */
export const TONE_BAR: Record<PhaseTone, string> = {
  neutral: 'bg-zinc-200',
  alpha: 'bg-alpha',
  beta: 'bg-beta',
  handling: 'bg-handling',
  success: 'bg-ok',
};

export const TONE_TO_CHIP: Record<PhaseTone, ChipTone> = {
  neutral: 'muted',
  alpha: 'alpha',
  beta: 'beta',
  handling: 'handling',
  success: 'ok',
};

/** Clases de la tarjeta de decisión de la Política 3. */
export const POLICY_CALLOUT: Record<1 | 2, { box: string; icon: string; chip: ChipTone }> = {
  1: { box: 'border-p1/35 bg-p1/[0.06]', icon: 'text-p1', chip: 'p1' },
  2: { box: 'border-p2/35 bg-p2/[0.06]', icon: 'text-p2', chip: 'p2' },
};

/** Rótulo corto de nodo para instrumentos densos: D, C1, C10… */
export const shortLabel = (id: number) => (id === 0 ? 'D' : `C${id}`);

export function nodeLabel(solution: SolutionData, id: number): string {
  return solution.nodes.find((n) => n.id === id)?.label ?? (id === 0 ? 'Depósito' : `Cliente ${id}`);
}

export interface PhaseCounts {
  A: number;
  B: number;
  slide: number;
  /** Costo de manipulación imputado en esta fase (unidades evacuadas × h). */
  cost: number;
}

/** Cuenta las unidades que se mueven en la fase y su costo (h_a / h_b por tipo). */
export function phaseCounts(phase: Phase, choreo: Choreography, solution: SolutionData): PhaseCounts {
  const hA = solution.h_a ?? solution.h;
  const hB = solution.h_b ?? solution.h;
  let A = 0;
  let B = 0;
  let slide = 0;
  let cost = 0;
  for (const [id, motion] of Object.entries(phase.motions)) {
    if (motion === 'slide') {
      slide++;
      continue;
    }
    const type = choreo.units[id]?.type ?? 'A';
    if (type === 'A') A++;
    else B++;
    if (motion === 'evac') cost += type === 'A' ? hA : hB;
  }
  if (phase.costedUnits > 0 && cost === 0) cost = phase.costedUnits * solution.h;
  return { A, B, slide, cost };
}

/** "s_i = 1" → s<sub>i</sub> = 1 */
export function SubS({ text }: { text: string }) {
  const m = /^s_i(.*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      s<sub className="text-[0.72em] leading-none">i</sub>
      {m[1]}
    </>
  );
}

/** Chip de política de la parada: decisión s_i (P3), política fija (P1/P2) o posiciones libres (General). */
export function PolicyChip({ model, stop, size = 'xs' }: { model: ModelType; stop: StopPlan | null; size?: 'xs' | 'sm' }) {
  if (!stop || stop.isDepot) return null;
  if (model === 'TSPPD-H') {
    return (
      <Chip tone="general" size={size}>
        Posiciones libres
      </Chip>
    );
  }
  const p: 1 | 2 = stop.policy ?? (model === 'TSPPD-H_2' ? 2 : 1);
  const info = POLICY_INFO[p];
  if (model === 'TSPPD-H_3') {
    return (
      <Chip tone={p === 1 ? 'p1' : 'p2'} size={size} title={`Decisión del modelo: ${info.title}`}>
        {info.code} · <SubS text={info.s} />
      </Chip>
    );
  }
  return (
    <Chip tone={p === 1 ? 'p1' : 'p2'} size={size} title="Política fija del modelo">
      {info.title}
    </Chip>
  );
}

/** Explicación del solver sin emojis ni flechas decorativas (el resto ya viene saneado). */
export function cleanExplanation(html: string): string {
  return html
    .replace(/[➔➜➞]/g, '→')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}
