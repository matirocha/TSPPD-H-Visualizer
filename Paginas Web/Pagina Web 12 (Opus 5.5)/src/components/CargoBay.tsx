/**
 * Compartimiento LIFO — el instrumento central del simulador.
 *
 * Cada unidad (pallet α o β) es un objeto con identidad estable en todo el tour:
 * se renderiza con un `layoutId` derivado de `unit.id` y, cuando cambia de contenedor
 * (slot → andén → slot, slot → cliente, cliente → slot), vuela con un resorte físico.
 * La compuerta trasera (slot 1) queda a la izquierda y la cabina (slot Q) a la derecha.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, FileText, MapPin, Maximize2, Minimize2, Warehouse } from 'lucide-react';
import { sanitizeExplanation } from '../lib/sanitize';
import { StopKpis } from './stop/bodies';
import { cleanExplanation } from './stop/shared';
import { Transport } from './Transport';
import { useSim, type SimMode } from '../state/SimulationProvider';
import { useHover, useUI } from '../state/UIProvider';
import { countLayout, type BayView, type Choreography, type Phase, type StopPlan } from '../lib/choreography';
import type { SolutionData } from '../types/solution';
import { cn } from '../lib/cn';
import { springSnappy, springSoft } from '../lib/motion';
import { POLICY_INFO } from '../lib/models';
import { lockScroll } from '../lib/overlay';
import { useTabTrap } from '../hooks/useTabTrap';
import { useMediaQuery } from './chrome/hooks';
import { Button, Chip, Kbd, SpotlightCard, type ChipTone } from './ui';
import {
  UNIT_RGB,
  buildEvacIndex,
  handlingsUntil,
  isRelated,
  locate,
  nodeName,
  phaseDelays,
  stopNumbers,
  unitTag,
  type Cursor,
  type Selection,
} from './bay/model';
import { CabBlock, DoorBlock, Legend, Rolling, SLOT_GAP, SlotCell, SlotRuler, Token, type GlyphMode } from './bay/pieces';
import { FloatingTip, Inspector, Narrative, TONE_BAR, TONE_CHIP, placeText, unitHeadline, type TipAnchor } from './bay/readout';

/**
 * Seguimiento de visibilidad entre renders: qué unidades estaban visibles y en qué
 * "generación". Una unidad que reaparece (tras un salto o un reinicio) recibe una
 * generación nueva y, por lo tanto, un layoutId nuevo: aparece en su sitio en vez de
 * volar desde una posición obsoleta.
 */
interface Track {
  key: string;
  shown: Set<string>;
  gen: Map<string, number>;
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_GEN: ReadonlyMap<string, number> = new Map<string, number>();

// ═════════════════════════════════════════════════════════════ contenedor

export function CargoBay() {
  const { solution, choreo, bay, selectedFilename } = useSim();
  const { focusPanel, setFocusPanel } = useUI();
  const fullscreen = focusPanel === 'bay';
  const ready = !!(solution && choreo && bay);
  const solutionKey = solution ? `${solution.instance}|${solution.model ?? ''}` : selectedFilename;

  // Espacio de nombres de layoutId único por carga de solución (evita vuelos entre soluciones).
  const epochRef = useRef({ key: '', n: 0 });
  if (epochRef.current.key !== solutionKey) epochRef.current = { key: solutionKey, n: epochRef.current.n + 1 };
  // Dos espacios de nombres alternados bastan (épocas consecutivas nunca coinciden) y
  // evitan que el mapa global de layoutIds de Motion crezca con cada cambio de solución.
  const groupId = `cargo-${epochRef.current.n % 2}`;

  const keyRef = useRef(solutionKey);
  keyRef.current = solutionKey;

  // Selección del inspector (slot o unidad), invalidada al cambiar de solución.
  const [selState, setSelState] = useState<{ key: string; sel: Selection | null }>({ key: '', sel: null });
  const selection = selState.key === solutionKey ? selState.sel : null;
  const clearSelection = useCallback(() => setSelState({ key: keyRef.current, sel: null }), []);
  const toggleSlot = useCallback(
    (index: number) =>
      setSelState((prev) => {
        const cur = prev.key === keyRef.current ? prev.sel : null;
        const same = cur?.kind === 'slot' && cur.index === index;
        return { key: keyRef.current, sel: same ? null : { kind: 'slot', index } };
      }),
    [],
  );
  const toggleUnit = useCallback(
    (id: string) =>
      setSelState((prev) => {
        const cur = prev.key === keyRef.current ? prev.sel : null;
        const same = cur?.kind === 'unit' && cur.id === id;
        return { key: keyRef.current, sel: same ? null : { kind: 'unit', id } };
      }),
    [],
  );

  // Esc cierra primero el inspector (antes que la pantalla completa).
  // Si el mapa ocupa la pantalla, el inspector está oculto y no debe consumir el Esc.
  useEffect(() => {
    if (!selection || focusPanel === 'map') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
      e.stopPropagation();
      clearSelection();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selection, clearSelection, focusPanel]);

  // Unidades visibles en el último render (para distinguir "aparece" de "se traslada").
  const trackRef = useRef<Track>({ key: '', shown: new Set(), gen: new Map() });

  // Alto de la tarjeta para reservar el espacio mientras está en pantalla completa.
  const cardRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(252);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || fullscreen) return;
    heightRef.current = el.offsetHeight;
    const ro = new ResizeObserver(() => {
      heightRef.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen, ready]);

  // Pantalla completa: bloqueo de scroll, foco dentro (Tab confinado) y retorno del foco al salir.
  const overlayRef = useRef<HTMLDivElement>(null);
  useTabTrap(overlayRef, fullscreen);
  useLayoutEffect(() => {
    if (!fullscreen) return;
    const unlock = lockScroll();
    overlayRef.current?.focus({ preventScroll: true });
    return () => {
      unlock();
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-bay-fullscreen]')?.focus({ preventScroll: true }));
    };
  }, [fullscreen]);

  if (!solution || !choreo || !bay) {
    return (
      <SpotlightCard plain className="p-4" aria-busy="true">
        <p className="eyebrow">Compartimiento LIFO</p>
        <div className="mt-3 h-[196px] animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40" />
      </SpotlightCard>
    );
  }

  const body = (
    <BayBody
      key={groupId}
      fullscreen={fullscreen}
      groupId={groupId}
      solutionKey={solutionKey}
      solution={solution}
      choreo={choreo}
      bay={bay}
      selection={selection}
      toggleSlot={toggleSlot}
      toggleUnit={toggleUnit}
      clearSelection={clearSelection}
      trackRef={trackRef}
    />
  );

  if (!fullscreen) {
    return (
      <SpotlightCard plain ref={cardRef} className="relative p-4" aria-label="Compartimiento LIFO del camión">
        {body}
      </SpotlightCard>
    );
  }

  return (
    <>
      <div
        aria-hidden
        className="surface grid place-items-center border-dashed text-[13px] text-zinc-500"
        style={{ height: heightRef.current }}
      >
        <span className="flex items-center gap-2">
          Compartimiento en pantalla completa · <Kbd>Esc</Kbd> para volver
        </span>
      </div>
      {createPortal(
        <>
          <motion.div
            aria-hidden
            className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFocusPanel(null)}
          />
          <motion.div
            ref={overlayRef}
            layoutScroll
            tabIndex={-1}
            role="region"
            aria-label="Compartimiento LIFO en pantalla completa"
            className="scrollbar-thin fixed inset-3 z-[60] flex flex-col overflow-y-auto rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-4 shadow-2xl shadow-black/60 outline-none md:inset-6 md:p-6"
          >
            {body}
          </motion.div>
        </>,
        document.body,
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════ cuerpo

interface BodyProps {
  fullscreen: boolean;
  groupId: string;
  solutionKey: string;
  solution: SolutionData;
  choreo: Choreography;
  bay: BayView;
  selection: Selection | null;
  toggleSlot: (index: number) => void;
  toggleUnit: (id: string) => void;
  clearSelection: () => void;
  trackRef: RefObject<Track>;
}

type Tip = ({ kind: 'slot'; slot: number } | { kind: 'token'; id: string; where: 'dock' | 'handed' | 'awaiting' }) & TipAnchor;

function BayBody({
  fullscreen,
  groupId,
  solutionKey,
  solution,
  choreo,
  bay,
  selection,
  toggleSlot,
  toggleUnit,
  clearSelection,
  trackRef,
}: BodyProps) {
  const { mode, phase, stop, step, stepIndex, subStep, actions } = useSim();
  const { setFocusPanel } = useUI();
  const { hoverNode, hoverUnit, setHoverUnit } = useHover();
  const Q = choreo.capacity;
  // En teléfonos la compuerta y la cabina no crecen en pantalla completa: el ancho es para los slots
  const wide = useMediaQuery('(min-width: 768px)');
  const bigFrame = fullscreen && wide;

  // ── derivados
  const counts = useMemo(() => countLayout(choreo, bay.layout), [choreo, bay.layout]);
  const evacIndex = useMemo(() => buildEvacIndex(choreo), [choreo]);
  const stopNo = useMemo(() => stopNumbers(solution), [solution]);
  const delays = useMemo(() => phaseDelays(bay), [bay]);
  const cursor: Cursor = { mode, stepIndex, subStep };

  /** Unidades evacuadas en esta parada hasta la fase actual (rayado "manipulada"). */
  const handledHere = useMemo(() => {
    const s = new Set<string>();
    if (!stop || (mode !== 'stop' && mode !== 'finished')) return s;
    const last = Math.min(subStep, stop.phases.length - 1);
    for (let j = 0; j <= last; j++) for (const [id, m] of Object.entries(stop.phases[j].motions)) if (m === 'evac') s.add(id);
    return s;
  }, [stop, mode, subStep]);

  /** Resaltado cruzado con el mapa: α con destino / β con origen en el nodo apuntado. */
  const related = useMemo(() => {
    if (hoverNode === null || hoverNode === 0) return null;
    const s = new Set<string>();
    for (const u of Object.values(choreo.units)) if (isRelated(u, hoverNode)) s.add(u.id);
    return s;
  }, [choreo, hoverNode]);

  const relatedOnBoard = useMemo(() => {
    if (!related) return null;
    let A = 0;
    let B = 0;
    for (const id of bay.layout) {
      if (!id || !related.has(id)) continue;
      if (choreo.units[id].type === 'A') A++;
      else B++;
    }
    return { A, B };
  }, [related, bay.layout, choreo]);

  const selectedUnit = selection?.kind === 'unit' ? selection.id : null;
  const dimOf = (id: string) => related !== null && !related.has(id);
  const emphOf = (id: string) => id === hoverUnit || id === selectedUnit || (related?.has(id) ?? false);

  // ── medidas: ancho de slot (glifos) y alto del camión
  const gridRef = useRef<HTMLDivElement>(null);
  const [slotW, setSlotW] = useState(0);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const w = (el.clientWidth - SLOT_GAP * (Q - 1)) / Q;
      setSlotW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [Q]);

  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight));
  useEffect(() => {
    if (!fullscreen) return;
    const onResize = () => setVh(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fullscreen]);

  const slotH = fullscreen ? Math.round(Math.min(160, Math.max(104, vh * 0.16))) : 60;
  const frameH = slotH + 10;
  const glyph: GlyphMode = fullscreen
    ? slotW >= 30
      ? 'full'
      : slotW >= 15
        ? 'vertical'
        : 'none'
    : slotW >= 30
      ? 'full'
      : slotW >= 22
        ? 'glyph'
        : 'none';
  const tokenSize = fullscreen ? 20 : 14;
  // Tope de fichas por zona (máx. 55 en el andén y 52 en un cliente en las 80 soluciones).
  const cap = fullscreen ? 144 : 60;

  // ── tooltip de unidad (anclado a un slot o a una ficha)
  const [tip, setTip] = useState<Tip | null>(null);

  const onSlotEnter = useCallback((slot: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ kind: 'slot', slot, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  }, []);
  const makeTokenEnter = useCallback(
    (where: 'dock' | 'handed' | 'awaiting') => (id: string, el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setTip({ kind: 'token', id, where, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
    },
    [],
  );
  const onDockEnter = useMemo(() => makeTokenEnter('dock'), [makeTokenEnter]);
  const onHandedEnter = useMemo(() => makeTokenEnter('handed'), [makeTokenEnter]);
  const onAwaitEnter = useMemo(() => makeTokenEnter('awaiting'), [makeTokenEnter]);
  const tipRef = useRef(tip);
  tipRef.current = tip;
  const onLeave = useCallback(() => {
    if (!tipRef.current) return;
    setTip(null);
    setHoverUnit(null);
  }, [setHoverUnit]);

  const tipPlace = tip && tip.kind === 'token' ? locate(bay, tip.id) : null;
  const tipValid = !!tip && (tip.kind === 'slot' || tipPlace?.where === tip.where);
  const tipUnitId = !tip || !tipValid ? null : tip.kind === 'slot' ? bay.layout[tip.slot] ?? null : tip.id;

  // Sincroniza la unidad apuntada con el resaltado global (mapa, bitácora…).
  useEffect(() => {
    if (tip && tipValid) setHoverUnit(tipUnitId);
    else if (tip && !tipValid) {
      setTip(null);
      setHoverUnit(null);
    }
  }, [tip, tipValid, tipUnitId, setHoverUnit]);

  // Al desmontar (p. ej. al entrar/salir de pantalla completa) se limpia el hover propio.
  useEffect(
    () => () => {
      if (tipRef.current) setHoverUnit(null);
    },
    [setHoverUnit],
  );

  // ── navegación por teclado dentro de la tira (tabindex itinerante)
  const [roving, setRoving] = useState(0);
  const activeSlot = selection?.kind === 'slot' ? selection.index : Math.min(roving, Q - 1);
  const onGridKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const idx = Number((e.target as HTMLElement).dataset.slot);
      if (Number.isNaN(idx)) return;
      let next = idx;
      if (e.key === 'ArrowRight') next = Math.min(Q - 1, idx + 1);
      else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = Q - 1;
      else return;
      e.preventDefault();
      e.stopPropagation();
      setRoving(next);
      gridRef.current?.querySelector<HTMLElement>(`[data-slot="${next}"]`)?.focus();
    },
    [Q],
  );
  const onPickSlot = useCallback(
    (i: number) => {
      setRoving(i);
      toggleSlot(i);
    },
    [toggleSlot],
  );

  // ── apariciones: unidades que no estaban visibles en el render anterior
  const track = trackRef.current;
  const sameKey = track.key === solutionKey;
  const prevShown: ReadonlySet<string> = sameKey ? track.shown : EMPTY_SET;
  const prevGen: ReadonlyMap<string, number> = sameKey ? track.gen : EMPTY_GEN;
  const shownNow = new Set<string>();
  const nextGen = new Map<string, number>();
  /**
   * layoutId = id + paridad de la generación; registra además la unidad como visible.
   * Basta alternar dos claves: una unidad que reaparece usa la clave distinta de la que
   * acaba de desmontarse (sin vuelo desde su posición vieja), y Motion no acumula una
   * entrada nueva en su mapa global de layoutIds por cada salto o reinicio.
   */
  const lid = (id: string) => {
    shownNow.add(id);
    if (prevShown.has(id)) return `${id}.${(prevGen.get(id) ?? 0) % 2}`;
    let g = nextGen.get(id);
    if (g === undefined) {
      g = (prevGen.get(id) ?? 0) + 1;
      nextGen.set(id, g);
    }
    return `${id}.${g % 2}`;
  };
  // Se confirma en fase de layout (antes de cualquier re-render síncrono) y es idempotente.
  useLayoutEffect(() => {
    const gen = sameKey ? track.gen : new Map<string, number>();
    for (const [id, g] of nextGen) gen.set(id, g);
    trackRef.current = { key: solutionKey, shown: shownNow, gen };
  });

  // ── celdas
  const cells: ReactNode[] = [];
  for (let i = 0; i < Q; i++) {
    const id = bay.layout[i] ?? null;
    const u = id ? choreo.units[id] : undefined;
    const layoutKey = u ? lid(u.id) : '';
    const m = id ? bay.motions[id] ?? null : null;
    const label = u
      ? `Slot ${i + 1}: ${u.type === 'A' ? 'α' : 'β'} ${u.id}, ${
          u.type === 'A'
            ? `destino ${u.destination === undefined ? 'sin asignar' : nodeName(solution, u.destination)}`
            : `recogida en ${nodeName(solution, u.origin)}`
        }`
      : `Slot ${i + 1}: vacío`;
    cells.push(
      <SlotCell
        key={i}
        index={i}
        unitId={u ? u.id : null}
        layoutKey={layoutKey}
        type={u ? u.type : null}
        tag={u ? unitTag(u) : ''}
        motion={m}
        handled={!!id && handledHere.has(id)}
        dim={!!id && dimOf(id)}
        emph={!!id && emphOf(id)}
        glyph={glyph}
        big={fullscreen}
        delay={id ? delays.get(id) ?? 0 : 0}
        enter={id && !prevShown.has(id) ? ((Q - 1 - i) / Math.max(1, Q - 1)) * 0.35 : null}
        selected={selection?.kind === 'slot' && selection.index === i}
        tabbable={i === activeSlot}
        label={label}
        onEnter={onSlotEnter}
        onLeave={onLeave}
        onPick={onPickSlot}
      />,
    );
  }

  const renderTokens = (ids: string[], variant: 'dock' | 'delivered' | 'awaiting', onEnter: (id: string, el: HTMLElement) => void) =>
    ids.map((id, k) => {
      const u = choreo.units[id];
      if (!u) return null;
      return (
        <Token
          key={id}
          id={id}
          layoutKey={lid(id)}
          type={u.type}
          variant={variant}
          size={tokenSize}
          dim={dimOf(id)}
          emph={emphOf(id)}
          delay={delays.get(id) ?? 0}
          enter={prevShown.has(id) ? null : Math.min(0.25, k * 0.025)}
          tabbable={k === 0}
          onEnter={onEnter}
          onLeave={onLeave}
          onPick={toggleUnit}
        />
      );
    });

  // ── zonas
  const dockShown = bay.dock.slice(0, cap);
  const dockOverflow = bay.dock.length - dockShown.length;
  const handedShown = bay.handedOver.slice(0, cap);
  const awaitingShown = bay.awaiting.slice(0, Math.max(0, cap - handedShown.length));
  const zoneOverflow = bay.handedOver.length + bay.awaiting.length - handedShown.length - awaitingShown.length;
  const dockTokens = renderTokens(dockShown, 'dock', onDockEnter);
  const handedTokens = renderTokens(handedShown, 'delivered', onHandedEnter);
  const awaitingTokens = renderTokens(awaitingShown, 'awaiting', onAwaitEnter);

  const doorOpen = mode === 'stop' && !!phase && phase.kind !== 'arrive' && phase.kind !== 'complete' && phase.kind !== 'compact';

  // ── tooltip
  let tipContent: ReactNode = null;
  if (tip && tipValid) {
    const u = tipUnitId ? choreo.units[tipUnitId] : undefined;
    if (u) {
      const soFar = handlingsUntil(evacIndex, u.id, cursor);
      const { head, rest } = unitHeadline(u, solution, stopNo, soFar);
      const place = tip.kind === 'slot' ? ({ where: 'slot', index: tip.slot } as const) : locate(bay, u.id);
      const m = bay.motions[u.id];
      tipContent = (
        <>
          <p>
            <span className={cn('font-mono font-semibold', u.type === 'A' ? 'text-alpha' : 'text-beta')}>{head}</span>
            <span className="text-zinc-300"> · {rest}</span>
          </p>
          <p className="mt-0.5 text-zinc-400">
            {placeText(place, u, bay, stop)}
            {m === 'evac' ? ' · EVAC' : m === 'deliver' || m === 'unload' ? ' · SALE' : m === 'pickup' || m === 'reload' ? ' · ENTRA' : ''}
          </p>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">Clic para inspeccionar</p>
        </>
      );
    } else if (tip.kind === 'slot') {
      tipContent = (
        <>
          <p>
            <span className="font-mono font-semibold text-zinc-100">Slot #{tip.slot + 1}</span>
            <span className="text-zinc-400"> · vacío</span>
          </p>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">Clic para inspeccionar</p>
        </>
      );
    }
  }

  // ── encabezado
  const total = solution.steps.length;
  const title =
    mode === 'initial'
      ? 'En el depósito'
      : mode === 'finished'
        ? 'De vuelta en el depósito'
        : mode === 'transit'
          ? `Rumbo a ${stop?.label ?? '—'}`
          : stop?.label ?? '—';
  const subtitle = mode === 'stop' || mode === 'transit' ? `parada ${stepIndex + 1}/${total}` : mode === 'initial' ? 'carga inicial' : null;
  const policy = stop && !stop.isDepot && (mode === 'stop' || mode === 'transit') ? stop.policy : null;
  const isP3 = choreo.model === 'TSPPD-H_3';

  const narrKey = selection ? 'inspector' : `${mode}-${stepIndex}-${mode === 'stop' ? subStep : 0}`;
  const atLastPhase = mode === 'stop' && !!stop && subStep >= stop.phases.length - 1;
  const nextLabel = atLastPhase ? (stepIndex >= total - 1 ? 'Finalizar tour' : 'Continuar ruta') : 'Siguiente sub-paso';

  return (
    <LayoutGroup id={groupId}>
      <div className={cn('flex flex-col', fullscreen ? 'min-h-full gap-5' : 'gap-3')}>
        {/* ── Encabezado */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="min-w-0">
            <p className="eyebrow">Compartimiento LIFO</p>
            <h3
              className={cn(
                'mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 font-semibold tracking-tight text-zinc-50',
                fullscreen ? 'text-lg' : 'text-[15px]',
              )}
            >
              <span className="truncate">{title}</span>
              {subtitle && <span className="num text-xs font-normal text-zinc-500">{subtitle}</span>}
              {policy && (
                <span
                  className={cn('inline-flex h-5 items-center self-center rounded-md border px-1.5 font-mono text-[11px] font-medium', POLICY_INFO[policy].chip)}
                  title={POLICY_INFO[policy].rule}
                >
                  {POLICY_INFO[policy].code}
                  {isP3 && <span className="ml-1 opacity-70">{POLICY_INFO[policy].s}</span>}
                </span>
              )}
            </h3>
          </div>

          <div className="relative flex flex-wrap items-center gap-1.5">
            <Chip tone="neutral" title="Capacidad del compartimiento">
              Q = {Q}
            </Chip>
            <Chip tone="alpha" title="Unidades α a bordo">
              α <Rolling value={counts.A} />
            </Chip>
            <Chip tone="beta" title="Unidades β a bordo">
              β <Rolling value={counts.B} />
            </Chip>
            <Chip tone="muted" title="Slots libres">
              libres <Rolling value={counts.empty} />
            </Chip>
            {bay.dock.length > 0 && (
              <Chip tone="handling" title="Unidades en el andén temporal">
                andén <Rolling value={bay.dock.length} />
              </Chip>
            )}
            <PhaseChip mode={mode} phase={phase} stop={stop} subStep={subStep} />
            {/* popLayout: al cambiar de nodo, el chip saliente no empuja al entrante (sin salto de fila) */}
            <AnimatePresence mode="popLayout" initial={false}>
              {hoverNode !== null && hoverNode !== 0 && relatedOnBoard && (
                <motion.span
                  key={hoverNode}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={springSnappy}
                  className="inline-flex"
                >
                  <Chip tone="solid">
                    {nodeName(solution, hoverNode)} · {relatedOnBoard.A} α · {relatedOnBoard.B} β
                  </Chip>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Legend className={fullscreen ? 'flex' : 'hidden xl:flex'} />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                flat
                onClick={actions.prevSubStep}
                disabled={mode === 'initial'}
                aria-label="Sub-paso anterior"
                title="Sub-paso anterior (←)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size={fullscreen && nextLabel !== 'Siguiente sub-paso' ? 'xs' : 'icon-sm'}
                flat
                onClick={actions.nextSubStep}
                disabled={mode === 'finished'}
                aria-label={nextLabel}
                title={`${nextLabel} (→)`}
              >
                {fullscreen && nextLabel !== 'Siguiente sub-paso' && <span>{nextLabel}</span>}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant={fullscreen ? 'secondary' : 'outline'}
              size="icon-sm"
              data-bay-fullscreen
              onClick={() => setFocusPanel(fullscreen ? null : 'bay')}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver compartimiento en pantalla completa'}
              title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa (B)'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* ── Riel de fases (solo en pantalla completa: el panel de parada queda oculto) */}
        {fullscreen && mode === 'stop' && stop && <PhaseRail stop={stop} subStep={subStep} onPick={actions.setSubStep} />}

        <div className={cn('flex flex-col', fullscreen ? 'flex-1 justify-center gap-6' : 'gap-3')}>
          {/* ── Tira del camión: compuerta | slots | cabina */}
          <div className="flex items-start gap-1.5">
            <DoorBlock open={doorOpen} height={frameH} big={bigFrame} />
            <motion.div layoutScroll className="scrollbar-thin min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-1">
              <div style={{ minWidth: Q * 12 + (Q - 1) * SLOT_GAP + 10 }}>
                <div
                  className="relative rounded-xl border border-zinc-700/80 bg-zinc-950/60 p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.04),inset_0_-12px_24px_-16px_rgb(0_0_0/0.7)]"
                  style={{ height: frameH }}
                >
                  {/* Luz que entra por la compuerta abierta */}
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-[24%] rounded-l-xl"
                    style={{ background: 'linear-gradient(90deg, rgb(250 250 250 / 0.11), rgb(250 250 250 / 0.03) 45%, transparent)' }}
                    initial={false}
                    animate={{ opacity: doorOpen ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                  <div
                    ref={gridRef}
                    role="group"
                    aria-label={`Slots del compartimiento: de la compuerta (slot 1) a la cabina (slot ${Q})`}
                    onKeyDown={onGridKey}
                    className="relative grid h-full"
                    style={{ gridTemplateColumns: `repeat(${Q}, minmax(12px, 1fr))`, columnGap: SLOT_GAP }}
                  >
                    {cells}
                  </div>
                </div>
                <SlotRuler capacity={Q} slotW={slotW} inset={5} />
              </div>
            </motion.div>
            <CabBlock height={frameH} capacity={Q} maxWidth={bigFrame ? 112 : 76} />
          </div>

          {/* ── Zonas (andén / parada) + lectura de fase o inspector */}
          <div className={cn('flex flex-col lg:flex-row lg:items-stretch', fullscreen ? 'gap-4' : 'gap-3')}>
            <div className={cn('flex min-w-0 flex-wrap gap-3', fullscreen ? 'lg:w-[58%]' : 'lg:w-[54%]')}>
              {/* Andén temporal */}
              <div
                className={cn(
                  'hatch relative min-w-[min(100%,210px)] flex-1 rounded-xl border border-dashed px-3 py-2 transition-colors duration-300',
                  bay.dock.length ? 'border-handling/55 bg-handling/[0.05]' : 'border-handling/25',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow text-handling/90">Andén temporal</span>
                  {bay.dock.length > 0 && (
                    <span className="num text-[11px] text-zinc-300">
                      <Rolling value={bay.dock.length} /> en espera
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-[3px]" style={{ minHeight: tokenSize }}>
                  <AnimatePresence initial={false}>{dockTokens}</AnimatePresence>
                  {dockOverflow > 0 && <span className="num ml-1 text-[10.5px] text-zinc-400">+{dockOverflow}</span>}
                  {bay.dock.length === 0 && <span className="text-[11.5px] leading-none text-zinc-500">Sin unidades en espera</span>}
                </div>
              </div>

              {/* Cliente / depósito */}
              <StopZone
                mode={mode}
                stop={stop}
                stepIndex={stepIndex}
                solution={solution}
                choreo={choreo}
                bay={bay}
                counts={counts}
                tokenSize={tokenSize}
                overflow={zoneOverflow}
                handedTokens={handedTokens}
                awaitingTokens={awaitingTokens}
              />
            </div>

            <div
              className={cn(
                'relative min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 transition-colors duration-200',
                selection ? 'border-zinc-600/80 bg-zinc-900/70' : 'border-zinc-800/80 bg-zinc-950/40',
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={narrKey}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3, transition: { duration: 0.1 } }}
                  transition={springSoft}
                  className="h-full"
                >
                  {selection ? (
                    <Inspector
                      selection={selection}
                      bay={bay}
                      choreo={choreo}
                      solution={solution}
                      stop={stop}
                      cursor={cursor}
                      evacIndex={evacIndex}
                      stopNo={stopNo}
                      fullscreen={fullscreen}
                      onClose={clearSelection}
                    />
                  ) : (
                    <Narrative
                      mode={mode}
                      phase={phase}
                      stop={stop}
                      step={step}
                      subStep={subStep}
                      solution={solution}
                      choreo={choreo}
                      counts={counts}
                      fullscreen={fullscreen}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Pantalla completa: contadores de la parada, detalle del solver y reproducción */}
        {fullscreen && <FullscreenFooter />}
      </div>

      {tip && tipValid && tipContent && <FloatingTip anchor={tip}>{tipContent}</FloatingTip>}
    </LayoutGroup>
  );
}

// ═════════════════════════════════════════════════════════════ piezas del cuerpo

function PhaseChip({ mode, phase, stop, subStep }: { mode: SimMode; phase: Phase | null; stop: StopPlan | null; subStep: number }) {
  let tone: ChipTone = 'neutral';
  let text = 'Carga inicial';
  let counter: string | null = null;
  let pulse = false;
  if (mode === 'finished') {
    tone = 'ok';
    text = 'Tour completado';
  } else if (mode === 'transit') {
    tone = 'muted';
    text = 'En tránsito';
    pulse = true;
  } else if (mode === 'stop' && phase) {
    tone = TONE_CHIP[phase.tone];
    text = phase.short;
    counter = stop ? `${subStep + 1}/${stop.phases.length}` : null;
  }
  return (
    <motion.span
      key={`${mode}-${text}-${counter ?? ''}`}
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSnappy}
      className="inline-flex"
    >
      <Chip tone={tone}>
        {pulse && <span aria-hidden className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-current" />}
        {text}
        {counter && <span className="opacity-60">{counter}</span>}
      </Chip>
    </motion.span>
  );
}

function PhaseRail({ stop, subStep, onPick }: { stop: StopPlan; subStep: number; onPick: (j: number) => void }) {
  return (
    <div aria-label="Fases de la parada" className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
      {stop.phases.map((ph, j) => {
        const active = j === subStep;
        return (
          <button
            key={`${ph.kind}-${j}`}
            type="button"
            onClick={() => onPick(j)}
            aria-current={active ? 'step' : undefined}
            title={ph.title}
            className={cn(
              'relative inline-flex h-7 items-center rounded-[10px] px-2.5 text-xs font-medium transition-colors duration-150',
              active ? 'text-zinc-950' : j < subStep ? 'text-zinc-300 hover:text-zinc-50' : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            {active && <motion.span layoutId="bay-phase-pill" transition={springSnappy} className="absolute inset-0 rounded-[10px] bg-zinc-100" />}
            <span className="relative flex items-center gap-1.5">
              <span className="num text-[10px] opacity-60">{j + 1}</span>
              <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONE_BAR[ph.tone])} />
              {ph.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface StopZoneProps {
  mode: SimMode;
  stop: StopPlan | null;
  stepIndex: number;
  solution: SolutionData;
  choreo: Choreography;
  bay: BayView;
  counts: { A: number; B: number; empty: number };
  tokenSize: number;
  overflow: number;
  handedTokens: ReactNode[];
  awaitingTokens: ReactNode[];
}

function StopZone({ mode, stop, stepIndex, solution, choreo, bay, counts, tokenSize, overflow, handedTokens, awaitingTokens }: StopZoneProps) {
  const atDepot = mode === 'initial' || mode === 'finished' || !!stop?.isDepot;
  const Icon = atDepot ? Warehouse : MapPin;
  const label = mode === 'initial' || mode === 'finished' ? 'Depósito' : stop?.label ?? '—';
  const eyebrow =
    mode === 'initial' ? 'Origen' : mode === 'finished' ? 'Fin del tour' : mode === 'transit' ? 'Próxima parada' : `Parada ${stepIndex + 1}`;
  const step = solution.steps[stepIndex];

  let handedA = 0;
  let handedB = 0;
  for (const id of bay.handedOver) {
    if (choreo.units[id]?.type === 'A') handedA++;
    else handedB++;
  }

  let summary: ReactNode;
  let ghosts: { A: number; B: number } | null = null;
  if (mode === 'initial') {
    summary = `${counts.A} α cargadas`;
  } else if (mode === 'transit') {
    if (stop?.isDepot) {
      summary = `Descargará ${counts.B} β`;
      ghosts = { A: 0, B: counts.B };
    } else {
      summary = `Entregará ${step?.deliverA ?? 0} α · Recogerá ${step?.pickupB ?? 0} β`;
      ghosts = { A: step?.deliverA ?? 0, B: step?.pickupB ?? 0 };
    }
  } else if (atDepot) {
    summary = (
      <>
        Descargadas <Rolling value={handedB} /> β{handedA > 0 && <> · {handedA} α</>}
      </>
    );
  } else {
    summary = (
      <>
        Entregadas <Rolling value={handedA} /> α · Por recoger <Rolling value={bay.awaiting.length} /> β
      </>
    );
  }

  const ghostCap = 48;
  const ghostA = ghosts ? Math.min(ghosts.A, ghostCap) : 0;
  const ghostB = ghosts ? Math.min(ghosts.B, Math.max(0, ghostCap - ghostA)) : 0;
  const empty = handedTokens.length === 0 && awaitingTokens.length === 0;

  return (
    <div className="relative min-w-[min(100%,210px)] flex-1 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          <span className="eyebrow shrink-0">{eyebrow}</span>
          <span className="text-[12px] font-medium whitespace-nowrap text-zinc-200">{label}</span>
        </span>
        <span className="num shrink-0 text-[11px] text-zinc-400">{summary}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-[3px]" style={{ minHeight: tokenSize }}>
        <AnimatePresence initial={false}>{handedTokens}</AnimatePresence>
        {handedTokens.length > 0 && awaitingTokens.length > 0 && <span aria-hidden className="mx-1 h-3 w-px self-center bg-zinc-700" />}
        <AnimatePresence initial={false}>{awaitingTokens}</AnimatePresence>
        {overflow > 0 && <span className="num ml-1 text-[10.5px] text-zinc-400">+{overflow}</span>}
        {empty && ghosts && ghostA + ghostB > 0 && (
          <>
            {Array.from({ length: ghostA }, (_, k) => (
              <span
                key={`ga${k}`}
                aria-hidden
                className="block shrink-0 rounded-[3px] border border-dashed"
                style={{ width: tokenSize, height: tokenSize, borderColor: `rgb(${UNIT_RGB.A} / 0.45)` }}
              />
            ))}
            {ghostA > 0 && ghostB > 0 && <span aria-hidden className="mx-1 h-3 w-px self-center bg-zinc-800" />}
            {Array.from({ length: ghostB }, (_, k) => (
              <span
                key={`gb${k}`}
                aria-hidden
                className="block shrink-0 rounded-[3px] border border-dashed"
                style={{ width: tokenSize, height: tokenSize, borderColor: `rgb(${UNIT_RGB.B} / 0.45)` }}
              />
            ))}
          </>
        )}
        {empty && (!ghosts || ghostA + ghostB === 0) && (
          <span className="text-[11.5px] leading-none text-zinc-500">
            {mode === 'initial'
              ? 'Punto de partida y de retorno del tour'
              : mode === 'transit'
                ? 'Sin movimientos de carga previstos'
                : 'Sin entregas ni recogidas en esta fase'}
          </span>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════ pie en pantalla completa

/**
 * En pantalla completa el panel de parada queda oculto: se repiten aquí sus contadores,
 * el detalle del solver y el dock de reproducción completo (paridad con la Página 10).
 */
function FullscreenFooter() {
  const { step, stop, mode } = useSim();
  const [open, setOpen] = useState(false);
  const html = useMemo(() => (step?.explanation ? cleanExplanation(sanitizeExplanation(step.explanation)) : ''), [step]);
  const showKpis = (mode === 'transit' || mode === 'stop') && !!step && !!stop;
  return (
    <div className="mt-auto flex flex-col gap-3">
      {(showKpis || html) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showKpis && step && stop ? <StopKpis step={step} stop={stop} /> : <span />}
          {html && (
            <Button variant="ghost" size="xs" flat onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <FileText className="h-3.5 w-3.5" />
              {open ? 'Ocultar detalle del solver' : 'Detalle del solver'}
            </Button>
          )}
        </div>
      )}
      {open && html && (
        <div
          className="max-w-[90ch] rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-[13px] leading-relaxed text-zinc-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      <Transport embedded />
    </div>
  );
}
