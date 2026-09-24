/**
 * Ficha flotante de un nodo del mapa: demanda α/β, tramos de entrada y salida,
 * carga a bordo al llegar y al salir, decisión s_i (Política 3), manipulaciones
 * en la parada y acceso directo a la parada en la simulación.
 *
 * Se posiciona en HTML sobre el SVG a partir de la posición en pantalla del nodo
 * (sigue la cámara del mapa sin renders de React) y se mantiene dentro del lienzo.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, type MotionValue } from 'motion/react';
import { ArrowRight, ChevronRight, Container, CornerDownLeft, PackageMinus, PackagePlus, RotateCcw, Shuffle, Warehouse, X } from 'lucide-react';
import { useSim } from '../state/SimulationProvider';
import { nodePolicy } from '../lib/policy';
import { POLICY_INFO } from '../lib/models';
import { fmt, fmtAuto } from '../lib/format';
import { cn } from '../lib/cn';
import { spring } from '../lib/motion';
import type { Point } from '../lib/layout';
import { Button, Chip, type ChipTone } from './ui';
import { clamp, nodeRadius } from './map/geometry';
import { useViewSubscription, type Stage } from './map/hooks';

type Side = 'right' | 'left' | 'below' | 'above';

export interface NodePopoverProps {
  nodeId: number;
  /** Posición del nodo en coordenadas del viewBox. */
  anchor: Point;
  mk: MotionValue<number>;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  stage: Stage;
  onClose: () => void;
}

const MARGIN = 8;
const GAP = 6;

const ORIGIN: Record<Side, { originX: number; originY: number }> = {
  right: { originX: 0, originY: 0.5 },
  left: { originX: 1, originY: 0.5 },
  below: { originX: 0.5, originY: 0 },
  above: { originX: 0.5, originY: 1 },
};

const tag = (id: number) => (id === 0 ? 'D' : `C${id}`);

export function NodePopover({ nodeId, anchor, mk, mx, my, stage, onClose }: NodePopoverProps) {
  const { solution, choreo, actions, mode, stepIndex } = useSim();
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const focusInside = useRef(false);
  const [side, setSide] = useState<Side>('right');
  const titleId = useId();

  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // ── Posicionamiento (lado preferido: derecha → izquierda → abajo → arriba)
  const size = useRef({ w: 0, h: 0 });
  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const st = stageRef.current;
    const a = anchorRef.current;
    const k = mk.get();
    const sx = st.ox + st.s * (mx.get() + k * a.x);
    const sy = st.oy + st.s * (my.get() + k * a.y);
    const rr = (nodeRadius(nodeId) + 9) * k * st.s;
    if (!size.current.w) size.current = { w: el.offsetWidth, h: el.offsetHeight };
    const pw = size.current.w;
    const ph = size.current.h;
    const maxL = Math.max(MARGIN, st.w - pw - MARGIN);
    const maxT = Math.max(MARGIN, st.h - ph - MARGIN);
    let next: Side = 'right';
    let left = sx + rr + GAP;
    let top = sy - ph / 2;
    if (left + pw > st.w - MARGIN) {
      const alt = sx - rr - GAP - pw;
      if (alt >= MARGIN) {
        left = alt;
        next = 'left';
      } else {
        left = sx - pw / 2;
        if (sy + rr + GAP + ph <= st.h - MARGIN) {
          top = sy + rr + GAP;
          next = 'below';
        } else {
          top = sy - rr - GAP - ph;
          next = 'above';
        }
      }
    }
    left = clamp(left, MARGIN, maxL);
    top = clamp(top, MARGIN, maxT);
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    setSide((s) => (s === next ? s : next));
  }, [mk, mx, my, nodeId]);

  // Tras cada render (anclaje, lienzo o contenido cambiaron): re-medir y reubicar
  useLayoutEffect(() => {
    size.current = { w: 0, h: 0 };
    place();
  });

  // La cámara se mueve sin renders de React: reubicar una vez por cuadro
  useViewSubscription({ mk, mx, my }, place);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      size.current = { w: 0, h: 0 };
      place();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [place]);

  // ── Foco: entra al abrir, vuelve al nodo al cerrar si seguía dentro
  useEffect(() => {
    innerRef.current?.focus({ preventScroll: true });
    return () => {
      if (focusInside.current) {
        document.querySelector<SVGGElement>(`[data-map-node="${nodeId}"]`)?.focus({ preventScroll: true });
      }
    };
  }, [nodeId]);

  // ── Clic fuera de la tarjeta del mapa (el lienzo gestiona sus propios clics de fondo
  //    y los controles del encabezado no cierran la ficha: al cambiar de disposición, la sigue)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || wrapRef.current?.contains(t)) return;
      if (t.closest('[data-map-card]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  const node = solution?.nodes.find((n) => n.id === nodeId);
  if (!solution || !node) return null;

  const steps = solution.steps;
  const N = steps.length;
  const isDepot = nodeId === 0;
  const inIdx = isDepot ? N - 1 : steps.findIndex((s) => s.to === nodeId);
  const outIdx = isDepot ? 0 : steps.findIndex((s) => s.from === nodeId);
  const inStep = steps[inIdx];
  const outStep = steps[outIdx];
  const plan = choreo?.stops[inIdx];
  const policy = nodePolicy(solution, nodeId);
  const info = policy ? POLICY_INFO[policy] : null;
  const Q = solution.capacity;
  const here = mode === 'stop' && stepIndex === inIdx;

  let status: { text: string; tone: ChipTone };
  if (isDepot) {
    if (mode === 'initial') status = { text: 'Camión cargado aquí', tone: 'solid' };
    else if (mode === 'finished' || here) status = { text: 'Tour cerrado', tone: 'ok' };
    else if (mode === 'transit' && stepIndex === N - 1) status = { text: 'Camión regresando', tone: 'neutral' };
    else status = { text: 'Camión en ruta', tone: 'muted' };
  } else if (here) status = { text: 'Camión aquí', tone: 'solid' };
  else if (mode === 'finished' || inIdx < stepIndex) status = { text: 'Visitado', tone: 'neutral' };
  else if (mode === 'transit' && inIdx === stepIndex) status = { text: 'Próximo destino', tone: 'neutral' };
  else status = { text: 'Pendiente', tone: 'muted' };

  const handledTitle = plan ? `Manipuladas: α ${plan.handled.A} · β ${plan.handled.B}` : undefined;
  const handles = !!inStep && inStep.handlingCount > 0;
  const stats = isDepot
    ? [
        { key: 'a', icon: PackageMinus, iconColor: 'text-alpha', label: 'α inicial', value: fmtAuto(node.alpha), sub: 'uds. salen', color: 'text-alpha' },
        { key: 'b', icon: PackagePlus, iconColor: 'text-beta', label: 'β retorno', value: fmtAuto(node.beta), sub: 'uds. vuelven', color: 'text-beta' },
        { key: 'q', icon: Container, iconColor: 'text-zinc-400', label: 'Capacidad', value: fmtAuto(Q), sub: 'slots LIFO', color: 'text-zinc-100' },
      ]
    : [
        { key: 'a', icon: PackageMinus, iconColor: 'text-alpha', label: 'α entrega', value: fmtAuto(node.alpha), sub: 'uds.', color: 'text-alpha' },
        { key: 'b', icon: PackagePlus, iconColor: 'text-beta', label: 'β recoge', value: fmtAuto(node.beta), sub: 'uds.', color: 'text-beta' },
        {
          key: 'h',
          icon: Shuffle,
          iconColor: handles ? 'text-handling' : 'text-zinc-500',
          label: 'Manipul.',
          value: fmtAuto(inStep?.handlingCount ?? 0),
          sub: inStep && inStep.handlingCost > 0 ? `+${fmt(inStep.handlingCost, 2)}` : 'sin costo',
          color: handles ? 'text-handling' : 'text-zinc-400',
        },
      ];

  const loads = isDepot
    ? [
        { label: 'Parte', a: outStep?.aOnTruck ?? 0, b: outStep?.bOnTruck ?? 0 },
        { label: 'Regresa', a: inStep?.aOnTruck ?? 0, b: inStep?.bOnTruck ?? 0 },
      ]
    : [
        { label: 'Llega', a: inStep?.aOnTruck ?? 0, b: inStep?.bOnTruck ?? 0 },
        { label: 'Sale', a: outStep?.aOnTruck ?? 0, b: outStep?.bOnTruck ?? 0 },
      ];

  return (
    <div ref={wrapRef} data-map-popover className="absolute left-0 top-0 z-30 w-[min(292px,calc(100%-16px))] will-change-transform">
      <motion.div
        ref={innerRef}
        role="region"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
        transition={spring}
        style={{ ...ORIGIN[side], maxHeight: Math.max(160, stage.h - MARGIN * 2) }}
        onFocus={() => (focusInside.current = true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusInside.current = false;
        }}
        className="overflow-y-auto rounded-2xl border border-zinc-700/70 bg-zinc-900/95 shadow-2xl shadow-black/60 outline-none backdrop-blur-xl scrollbar-thin"
      >
        {/* Encabezado */}
        <div className="flex items-start gap-3 p-3.5 pb-3">
          <div
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
              isDepot ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : here ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700 bg-zinc-950 text-zinc-100',
            )}
          >
            {isDepot ? <Warehouse className="h-[18px] w-[18px]" aria-hidden /> : <span className="num text-[13px] font-semibold">{tag(nodeId)}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h4 id={titleId} className="truncate text-sm font-semibold tracking-tight text-zinc-50">
              {node.label}
            </h4>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip tone="neutral">{isDepot ? `Inicio y fin · ${N} tramos` : `Parada ${inIdx + 1} de ${N}`}</Chip>
              <Chip tone={status.tone} mono={false}>
                {status.text}
              </Chip>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha del nodo"
            className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-3.5 pb-3.5">
          {/* Demanda y manipulaciones */}
          <dl className="grid grid-cols-3 gap-1.5">
            {stats.map((s) => (
              <div key={s.key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-2.5 py-2" title={s.key === 'h' ? handledTitle : undefined}>
                <dt className="text-[10.5px] leading-none whitespace-nowrap text-zinc-500">{s.label}</dt>
                <dd className="mt-1.5 flex items-center justify-between gap-1">
                  <span className={cn('num text-[17px] font-semibold leading-none', s.color)}>{s.value}</span>
                  <s.icon className={cn('h-3.5 w-3.5 shrink-0 opacity-80', s.iconColor)} aria-hidden />
                </dd>
                <dd className="num mt-1 truncate text-[10.5px] leading-none text-zinc-500">{s.sub}</dd>
              </div>
            ))}
          </dl>

          {/* Vecindad en el tour */}
          {inStep && outStep && (
            <div>
              <p className="eyebrow mb-1.5">{isDepot ? 'Cierre y apertura del tour' : 'Tramos en el tour'}</p>
              <div className="flex items-center gap-1" aria-label={`Llega desde ${tag(inStep.from)} (${fmtAuto(inStep.distance)} km), sale hacia ${tag(outStep.to)} (${fmtAuto(outStep.distance)} km)`}>
                <NodeTag id={inStep.from} />
                <Leg km={inStep.distance} />
                <NodeTag id={nodeId} active />
                <Leg km={outStep.distance} />
                <NodeTag id={outStep.to} />
              </div>
            </div>
          )}

          {/* Carga a bordo */}
          <div className="space-y-1.5">
            {loads.map((l, i) => (
              <LoadBar key={l.label} label={l.label} a={l.a} b={l.b} q={Q} delay={0.06 + i * 0.05} />
            ))}
          </div>

          {/* Decisión de la Política 3 */}
          {info && (
            <div className={cn('rounded-xl border p-2.5', policy === 1 ? 'border-p1/30 bg-p1/[0.06]' : 'border-p2/30 bg-p2/[0.06]')}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={policy === 1 ? 'p1' : 'p2'}>
                  {info.code} · {info.s}
                </Chip>
                <span className="text-[11px] text-zinc-400">{info.title}</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-pretty text-zinc-300">{info.rule}</p>
            </div>
          )}

          {/* Acciones: fijas al pie para que la principal quede visible aunque la ficha se desplace */}
          <div className="sticky bottom-0 z-10 -mx-3.5 -mb-3.5 border-t border-zinc-800/70 bg-zinc-900/95 px-3.5 pt-2.5 pb-3.5">
            {isDepot ? (
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    actions.reset();
                    onClose();
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reiniciar tour
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    actions.selectStep(N - 1);
                    onClose();
                  }}
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  Ver retorno
                </Button>
              </div>
            ) : (
              inIdx >= 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    actions.selectStep(inIdx);
                    onClose();
                  }}
                >
                  {here ? 'Repetir esta parada' : 'Ir a esta parada'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function NodeTag({ id, active }: { id: number; active?: boolean }) {
  return (
    <span
      className={cn(
        'num inline-flex h-6 min-w-7 shrink-0 items-center justify-center rounded-md border px-1.5 text-[11px] font-medium',
        active ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700/80 bg-zinc-950/60 text-zinc-300',
      )}
    >
      {tag(id)}
    </span>
  );
}

function Leg({ km }: { km: number }) {
  return (
    <span className="flex min-w-0 flex-1 items-center text-zinc-500">
      <span className="h-px flex-1 bg-zinc-700" />
      <span className="num px-1 text-[10.5px] whitespace-nowrap text-zinc-400">{fmtAuto(km)} km</span>
      <span className="h-px flex-1 bg-zinc-700" />
      <ChevronRight className="-ml-1.5 h-3 w-3 shrink-0" aria-hidden />
    </span>
  );
}

function LoadBar({ label, a, b, q, delay }: { label: string; a: number; b: number; q: number; delay: number }) {
  const pa = q > 0 ? Math.min(1, a / q) : 0;
  const pb = q > 0 ? Math.min(1 - pa, b / q) : 0;
  return (
    <div className="flex items-center gap-2" aria-label={`${label}: α ${a}, β ${b} de ${q}`}>
      <span className="w-12 shrink-0 text-[11px] text-zinc-500">{label}</span>
      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <motion.span className="h-full bg-alpha" initial={{ width: 0 }} animate={{ width: `${pa * 100}%` }} transition={{ ...spring, delay }} />
        <motion.span className="h-full bg-beta" initial={{ width: 0 }} animate={{ width: `${pb * 100}%` }} transition={{ ...spring, delay: delay + 0.04 }} />
      </div>
      <span className="num w-[74px] shrink-0 text-right text-[11px]">
        <span className="text-alpha">{a}</span>
        <span className="text-zinc-500"> · </span>
        <span className="text-beta">{b}</span>
        <span className="text-zinc-500">/{q}</span>
      </span>
    </div>
  );
}
