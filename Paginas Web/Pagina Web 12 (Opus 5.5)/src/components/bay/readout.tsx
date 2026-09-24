/**
 * Lectura del compartimiento: narrativa de la fase actual, inspector de slot/unidad
 * y tooltip flotante de cada unidad.
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ScanSearch, X } from 'lucide-react';
import type { BayView, Choreography, Phase, PhaseTone, StopPlan, Unit } from '../../lib/choreography';
import type { SimMode } from '../../state/SimulationProvider';
import type { SolutionData, StepData } from '../../types/solution';
import { cn } from '../../lib/cn';
import { fmt, fmtKm } from '../../lib/format';
import { springSnappy } from '../../lib/motion';
import { Chip, type ChipTone } from '../ui';
import {
  handlingsUntil,
  locate,
  nodeName,
  plural,
  vez,
  type Cursor,
  type EvacIndex,
  type Selection,
  type UnitPlace,
} from './model';

export const TONE_CHIP: Record<PhaseTone, ChipTone> = {
  neutral: 'neutral',
  alpha: 'alpha',
  beta: 'beta',
  handling: 'handling',
  success: 'ok',
};

export const TONE_BAR: Record<PhaseTone, string> = {
  neutral: 'bg-zinc-500',
  alpha: 'bg-alpha',
  beta: 'bg-beta',
  handling: 'bg-handling',
  success: 'bg-ok',
};

// ───────────────────────────────────────────── textos de unidad

/** "α a12 · destino Cliente 5 (parada 3) · manipulada 1 vez" / "β b4 · recogida en Cliente 2 (parada 1) · al depósito". */
export function unitHeadline(u: Unit, solution: SolutionData, stopNo: Map<number, number>, soFar: number): { head: string; rest: string } {
  const head = `${u.type === 'A' ? 'α' : 'β'} ${u.id}`;
  if (u.type === 'A') {
    const d = u.destination;
    const where =
      d === undefined ? 'sin destino asignado' : d === 0 ? 'regresa al depósito' : `destino ${nodeName(solution, d)} (parada ${stopNo.get(d) ?? '—'})`;
    return { head, rest: `${where} · ${soFar ? `manipulada ${vez(soFar)}` : 'sin manipular'}` };
  }
  const o = u.origin;
  const from = o === 0 ? 'cargada en el depósito' : `recogida en ${nodeName(solution, o)} (parada ${stopNo.get(o) ?? '—'})`;
  return { head, rest: `${from} · al depósito${soFar ? ` · manipulada ${vez(soFar)}` : ''}` };
}

function blockersBefore(bay: BayView, index: number): number {
  let n = 0;
  for (let i = 0; i < index; i++) if (bay.layout[i]) n++;
  return n;
}

export function placeText(place: UnitPlace, u: Unit, bay: BayView, stop: StopPlan | null): string {
  switch (place.where) {
    case 'slot': {
      const b = blockersBefore(bay, place.index);
      return `Slot #${place.index + 1} · ${b ? `${b} ${plural(b, 'unidad', 'unidades')} entre ella y la compuerta` : 'acceso directo a la compuerta'}`;
    }
    case 'dock':
      return 'En el andén temporal: evacuada, espera su reingreso';
    case 'handed':
      return u.type === 'A' && stop && !stop.isDepot ? `Entregada en ${stop.label}` : 'Descargada en el depósito';
    case 'awaiting':
      return `Espera en ${stop?.label ?? 'el cliente'} para subir al camión`;
    default:
      return 'Fuera del camión';
  }
}

// ───────────────────────────────────────────── tooltip flotante

export interface TipAnchor {
  x: number;
  top: number;
  bottom: number;
}

export function FloatingTip({ anchor, children }: { anchor: TipAnchor; children: ReactNode }) {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const below = anchor.top < 120;
  const half = Math.min(144, vw / 2 - 8);
  const left = Math.min(vw - half - 8, Math.max(half + 8, anchor.x));
  return createPortal(
    <div
      className="pointer-events-none fixed z-[90]"
      style={{ left, top: below ? anchor.bottom + 8 : anchor.top - 8, transform: `translate(-50%, ${below ? '0' : '-100%'})` }}
    >
      <motion.div
        role="tooltip"
        initial={{ opacity: 0, y: below ? -4 : 4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springSnappy}
        className="w-max max-w-[288px] rounded-xl border border-zinc-700/80 bg-zinc-900/95 px-2.5 py-1.5 text-[11.5px] leading-snug text-zinc-200 shadow-xl shadow-black/50 backdrop-blur-md"
      >
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

// ───────────────────────────────────────────── narrativa de la fase

export interface NarrativeProps {
  mode: SimMode;
  phase: Phase | null;
  stop: StopPlan | null;
  step: StepData | null;
  subStep: number;
  solution: SolutionData;
  choreo: Choreography;
  counts: { A: number; B: number; empty: number };
  fullscreen: boolean;
}

export function Narrative({ mode, phase, stop, step, subStep, solution, choreo, counts, fullscreen }: NarrativeProps) {
  const Q = choreo.capacity;
  let tone: PhaseTone = 'neutral';
  let eyebrow = '';
  let title = '';
  let detail = '';
  let costUnits = 0;
  let cost = 0;

  if (mode === 'stop' && phase && stop) {
    tone = phase.tone;
    eyebrow = `Fase ${subStep + 1}/${stop.phases.length}`;
    title = phase.title;
    detail = phase.detail;
    costUnits = phase.costedUnits;
    for (const [id, m] of Object.entries(phase.motions)) {
      if (m !== 'evac') continue;
      cost += choreo.units[id]?.type === 'A' ? solution.h_a ?? solution.h : solution.h_b ?? solution.h;
    }
  } else if (mode === 'transit' && stop) {
    eyebrow = 'En tránsito';
    title = `${nodeName(solution, stop.from)} → ${stop.label}`;
    const onboard = `a bordo ${counts.A} α y ${counts.B} β (${counts.A + counts.B}/${Q})`;
    const next = stop.isDepot
      ? `al llegar se descargan las ${counts.B} β recolectadas.`
      : `al llegar: entregar ${step?.deliverA ?? 0} α y recoger ${step?.pickupB ?? 0} β` +
        (step && step.handlingCount > 0 ? `, con ${step.handlingCount} manipulaciones LIFO.` : ', sin manipulaciones.');
    detail = `${step ? `${fmtKm(step.distance)} · ` : ''}${onboard}; ${next}`;
  } else if (mode === 'initial') {
    eyebrow = 'Depósito';
    title = 'Carga inicial';
    detail =
      `El camión sale con ${counts.A} α (${counts.A}/${Q} slots). La compuerta trasera (slot 1) es el único acceso: ` +
      'lo último en entrar es lo primero en salir. Toca o pasa el cursor sobre un pallet para ver su destino.';
  } else {
    tone = 'success';
    eyebrow = 'Depósito';
    title = phase?.title ?? 'Tour completado';
    detail = phase?.detail ?? 'El camión volvió al depósito con todas las demandas satisfechas.';
  }

  return (
    <div className="flex h-full gap-3">
      <span aria-hidden className={cn('w-[3px] shrink-0 rounded-full', TONE_BAR[tone])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="num shrink-0 text-[11px] uppercase tracking-[0.12em] text-zinc-500">{eyebrow}</span>
          <p className={cn('min-w-0 font-semibold tracking-tight text-zinc-100', fullscreen ? 'text-base' : 'text-[13.5px]')}>{title}</p>
          {costUnits > 0 && (
            <Chip tone="handling" className="ml-auto">
              {costUnits} manip. · +{fmt(cost)}
            </Chip>
          )}
        </div>
        <p
          title={fullscreen ? undefined : detail}
          className={cn(
            'mt-1 text-pretty text-zinc-400',
            fullscreen ? 'max-w-[80ch] text-[14px] leading-relaxed' : 'line-clamp-2 max-w-[110ch] text-[12.5px] leading-snug',
          )}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── inspector

export interface InspectorProps {
  selection: Selection;
  bay: BayView;
  choreo: Choreography;
  solution: SolutionData;
  stop: StopPlan | null;
  cursor: Cursor;
  evacIndex: EvacIndex;
  stopNo: Map<number, number>;
  fullscreen: boolean;
  onClose: () => void;
}

interface Row {
  label: string;
  value: string;
}

export function Inspector({ selection, bay, choreo, solution, stop, cursor, evacIndex, stopNo, fullscreen, onClose }: InspectorProps) {
  const Q = choreo.capacity;
  const unitId = selection.kind === 'slot' ? bay.layout[selection.index] ?? null : selection.id;
  const unit = unitId ? choreo.units[unitId] : undefined;
  const place: UnitPlace | null = unit ? (selection.kind === 'slot' ? { where: 'slot', index: selection.index } : locate(bay, unit.id)) : null;

  const heading = selection.kind === 'slot' ? `Slot #${selection.index + 1}` : `Unidad ${selection.id}`;
  let contentTone: ChipTone = 'muted';
  let content = 'vacío';
  if (unit) {
    contentTone = unit.type === 'A' ? 'alpha' : 'beta';
    content = unit.type === 'A' ? 'α · entrega' : 'β · recogida';
  }

  const rows: Row[] = [];
  if (unit && place) {
    const soFar = handlingsUntil(evacIndex, unit.id, cursor);
    const total = evacIndex[unit.id]?.length ?? 0;
    const route =
      unit.type === 'A'
        ? `Depósito → ${unit.destination === undefined ? '—' : nodeName(solution, unit.destination)}${
            unit.destination ? ` · parada ${stopNo.get(unit.destination) ?? '—'}` : ''
          }`
        : `${nodeName(solution, unit.origin)}${unit.origin ? ` · parada ${stopNo.get(unit.origin) ?? '—'}` : ''} → Depósito`;
    const loadedStep = unit.loadedAtStep >= 0 ? solution.steps[unit.loadedAtStep] : undefined;
    const loaded = loadedStep ? `Parada ${unit.loadedAtStep + 1} · ${nodeName(solution, loadedStep.to)}` : 'Carga inicial · depósito';
    if (selection.kind === 'unit') rows.push({ label: 'Ubicación', value: placeText(place, unit, bay, stop) });
    rows.push({ label: 'Origen → destino', value: route });
    rows.push({ label: 'Cargada en', value: loaded });
    rows.push({ label: 'Manipulaciones', value: `${soFar} hasta ahora · ${total} en el tour` });
    if (selection.kind === 'slot') {
      const b = blockersBefore(bay, selection.index);
      rows.push({ label: 'Acceso', value: b ? `${b} ${plural(b, 'ud.', 'uds.')} delante (hacia la compuerta)` : 'Directo a la compuerta' });
    }
  } else if (selection.kind === 'slot') {
    const occ = bay.layout.filter(Boolean).length;
    rows.push({ label: 'Estado', value: 'Libre' });
    rows.push({ label: 'Posición', value: `Slot ${selection.index + 1} de ${Q}` });
    rows.push({ label: 'Desde la compuerta', value: `${selection.index} ${plural(selection.index, 'slot', 'slots')} hacia el fondo` });
    rows.push({ label: 'Ocupación', value: `${occ}/${Q} slots` });
  } else {
    rows.push({ label: 'Ubicación', value: 'Fuera de la vista actual' });
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ScanSearch className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
        <span className={cn('font-semibold tracking-tight text-zinc-50', fullscreen ? 'text-base' : 'text-[13.5px]')}>{heading}</span>
        <Chip tone={contentTone}>{content}</Chip>
        {unit && selection.kind === 'slot' && <Chip tone="muted">{unit.id}</Chip>}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar inspector"
          title="Cerrar (Esc)"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{r.label}</dt>
            <dd className={cn('mt-0.5 truncate text-zinc-200', fullscreen ? 'text-[13.5px]' : 'text-[12.5px]')} title={r.value}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
