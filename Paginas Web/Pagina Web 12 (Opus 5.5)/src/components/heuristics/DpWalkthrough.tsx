/**
 * Algoritmo 2.1 parada a parada: sobre una ruta fija, qué decide la programación dinámica
 * en cada cliente (Política 1 · compuerta o Política 2 · fondo), qué unidades mueve y cuánto
 * paga, frente a lo que pagó Gurobi en esa misma ruta.
 *
 * - Selector de ruta: la del ILS y las cuatro de Gurobi (General, P1, P2, P3). Por defecto, P3.
 * - Banda resumen: f(0) de la DP, Gurobi en la ruta, Políticas 1 y 2 puras y la cadena
 *   0 → j₁ → … → n de clientes donde la DP aplica Política 2.
 * - Tira de paradas (lista <ol>): carga al llegar y al salir (F cabina arriba, R compuerta
 *   abajo, alto ∝ Q), decisión, unidades movidas y costo, con el costo de Gurobi en la misma
 *   parada. Clic o ← → abren el detalle de cada parada.
 * - Lecturas calculadas y reglas de costo.
 * Todo proviene de Outputs/Erdogan2012/ (HeurStop, DPEvaluation, ILSBest): nada se recalcula.
 */
import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion, type Transition } from 'motion/react';
import { ArrowRight, ChevronRight, Route } from 'lucide-react';
import { MODELS, type ModelTone } from '../../lib/models';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtDelta, fmtKm, fmtPct } from '../../lib/format';
import { hoverLift, spring, springSnappy, staggerChild, staggerParent, tapPress } from '../../lib/motion';
import { Chip, Segmented, SpotlightCard } from '../ui';
import { COLOR, nodeLong, nodeShort } from '../analysis/chart';
import { joinEs } from '../analysis/compareData';
import type { ModelType } from '../../types/solution';
import type { HeurStop, StopPolicy } from '../../types/heuristics';
import { evalFor, gurobiFor, reversedTour, sameCost, sameTour, type HeurInstance } from './data';
import { HEUR_METHODS, METHOD_COLOR, MethodMark, type MethodTone } from './methods';

type RouteKey = 'ils' | ModelType;

const ROUTE_ORDER: RouteKey[] = ['ils', 'TSPPD-H', 'TSPPD-H_1', 'TSPPD-H_2', 'TSPPD-H_3'];
const DEFAULT_ROUTE: RouteKey = 'TSPPD-H_3';
const TITLE = 'La manipulación, parada a parada';

/** Nombre corto de cada ruta en frases ("misma ruta que el ILS, P1 y P2"). */
const ROUTE_NAME: Record<RouteKey, string> = {
  ils: 'el ILS',
  'TSPPD-H': 'General',
  'TSPPD-H_1': 'P1',
  'TSPPD-H_2': 'P2',
  'TSPPD-H_3': 'P3',
};
const ROUTE_TITLE: Record<RouteKey, string> = {
  ils: 'Ruta del ILS',
  'TSPPD-H': 'Ruta del Modelo General',
  'TSPPD-H_1': 'Ruta de la Política 1',
  'TSPPD-H_2': 'Ruta de la Política 2',
  'TSPPD-H_3': 'Ruta de la Política 3',
};

const POLICY_TEXT: Record<StopPolicy, { code: string; place: string; name: string; s: string }> = {
  1: { code: 'P1', place: 'compuerta', name: 'Política 1', s: '1' },
  2: { code: 'P2', place: 'fondo', name: 'Política 2', s: '0' },
};

// Geometría de la tira: cada fila tiene alto fijo para que el riel de etiquetas quede alineado.
const RAIL_W = 62;
const COL_MIN = 88;
const COL_GAP = 6;
const BAR_H = 120;
const ROW_GAP = 10;
const ROW = { head: 48, load: BAR_H, policy: 38, ops: 32, cost: 30 } as const;
/** La celda de Gurobi suma una línea con su decisión s_i cuando la ruta es la de P3. */
const gurobiRowH = (withPolicy: boolean) => (withPolicy ? 74 : 52);

/** Rayado rosa: unidades que se descargan y recargan en la parada (costo de manipulación). */
const MOVED_STYLE = {
  backgroundImage: 'repeating-linear-gradient(-45deg, rgb(251 113 133 / 0.95) 0 2px, transparent 2px 5px)',
  boxShadow: 'inset 0 0 0 1px rgb(251 113 133 / 0.9)',
} as const;

/* ───────────────────────── Datos de la ruta ───────────────────────── */

/** Lo que pagó Gurobi en la ruta mostrada. */
interface GurobiSide {
  model: ModelType;
  label: string;
  short: string;
  tone: ModelTone;
  total: number;
  /** Gurobi recorre exactamente esta ruta (si no, solo se compara el total). */
  sameRoute: boolean;
  /** Costo y operaciones por cliente (solo en la misma ruta y con evaluación DP). */
  stops: Record<string, { cost: number; ops: number }> | null;
  /** Decisión s_i por cliente (solo Política 3). */
  policies: Record<string, StopPolicy> | null;
  source: string | null;
}

interface RouteView {
  key: RouteKey;
  tone: MethodTone;
  tour: number[];
  distance: number;
  detail: HeurStop[];
  /** Manipulación óptima de la Política 3 en la ruta (f(0)). */
  dp: number;
  p1: number;
  p2: number;
  p2Customers: number[];
  /** f(0..n) de la DP; el ILS no la exporta y se toma de una evaluación con el mismo tour. */
  f: number[] | null;
  feasible: boolean;
  gurobi: GurobiSide | null;
}

const byPosition = (d: HeurStop[] | null | undefined) => [...(d ?? [])].sort((a, b) => a.position - b.position);

function buildViews(inst: HeurInstance | null): Partial<Record<RouteKey, RouteView>> {
  const out: Partial<Record<RouteKey, RouteView>> = {};
  if (!inst) return out;
  for (const m of MODELS) {
    const e = evalFor(inst, m.id);
    if (!e) continue;
    out[m.id] = {
      key: m.id,
      tone: m.tone,
      tour: e.tour ?? [],
      distance: e.totalDistance,
      detail: byPosition(e.detail),
      dp: e.handlingDP,
      p1: e.handlingP1,
      p2: e.handlingP2,
      p2Customers: e.policy2Customers ?? [],
      f: e.f ?? null,
      feasible: e.feasible ?? true,
      gurobi: {
        model: m.id,
        label: m.label,
        short: m.short,
        tone: m.tone,
        total: e.gurobiHandling,
        sameRoute: true,
        stops: e.gurobiStops ?? null,
        policies: e.gurobiPolicies ?? null,
        source: e.source ?? null,
      },
    };
  }
  const ils = inst.ils;
  const b = ils?.best;
  if (ils && b) {
    // El ILS aplica la Política 3: se compara con Gurobi P3 (por parada solo si es la misma ruta).
    const p3 = gurobiFor(inst, 'TSPPD-H_3');
    const p3e = evalFor(inst, 'TSPPD-H_3');
    const stopsFrom = p3e && sameTour(b.tour, p3e.tour) ? p3e : null;
    // Una evaluación DP con el mismo tour aporta f(0..n), la factibilidad y, si falta, el detalle.
    const twin = inst.dp?.evaluations?.find((e) => sameTour(e.tour, b.tour)) ?? null;
    out.ils = {
      key: 'ils',
      tone: 'ils',
      tour: b.tour ?? [],
      distance: b.totalDistance,
      detail: byPosition(b.detail?.length ? b.detail : twin?.detail),
      dp: b.handlingCost,
      p1: b.handlingP1,
      p2: b.handlingP2,
      p2Customers: b.policy2Customers ?? twin?.policy2Customers ?? [],
      f: twin?.f ?? null,
      feasible: twin?.feasible ?? true,
      gurobi: p3
        ? {
            model: 'TSPPD-H_3',
            label: 'Política 3',
            short: 'P3',
            tone: 'p3',
            total: p3.handlingCost,
            sameRoute: sameTour(b.tour, p3.tour),
            stops: stopsFrom?.gurobiStops ?? null,
            policies: stopsFrom?.gurobiPolicies ?? null,
            source: p3e?.source ?? ils.reference?.['TSPPD-H_3']?.source ?? null,
          }
        : null,
    };
  }
  return out;
}

/** Otras rutas del selector que recorren el mismo tour (o el mismo en sentido inverso). */
function kinship(key: RouteKey, tour: number[], inst: HeurInstance) {
  const same: string[] = [];
  const reversed: string[] = [];
  let total = 0;
  for (const k of ROUTE_ORDER) {
    const t = k === 'ils' ? inst.ils?.best?.tour : gurobiFor(inst, k)?.tour;
    if (!t) continue;
    total++;
    if (k === key) continue;
    if (sameTour(tour, t)) same.push(ROUTE_NAME[k]);
    else if (reversedTour(tour, t)) reversed.push(ROUTE_NAME[k]);
  }
  return { same, reversed, total };
}

type StopStatus = 'none' | 'match' | 'diff' | 'tie' | 'alt';

interface StopCompare {
  /** match: mismo costo · diff: otro costo · tie: otra decisión, mismo costo · alt: otra decisión y otro costo. */
  status: StopStatus;
  cost: number | null;
  ops: number | null;
  policy: StopPolicy | null;
}

function compareStop(row: HeurStop, g: GurobiSide | null): StopCompare {
  const s = g?.stops?.[String(row.customer)];
  if (!g || !s) return { status: 'none', cost: null, ops: null, policy: null };
  const policy = g.policies?.[String(row.customer)] ?? null;
  const eq = sameCost(s.cost, row.cost);
  const status: StopStatus = policy !== null && policy !== row.policy ? (eq ? 'tie' : 'alt') : eq ? 'match' : 'diff';
  return { status, cost: s.cost, ops: s.ops, policy };
}

interface Seg {
  key: string;
  units: number;
  className: string;
  /** Unidades de este bloque que se mueven en la parada (rayado desde el lado de la compuerta). */
  moved: number;
}

/**
 * Carga al llegar, de la cabina (F) a la compuerta (R): β del fondo, α que siguen a bordo,
 * α que se entregan aquí (las más cercanas a la compuerta) y β de la compuerta.
 */
function arrivalSegs(r: HeurStop): Seg[] {
  const delivered = Math.min(r.alpha, r.aArrival);
  const staying = Math.max(0, r.aArrival - delivered);
  return [
    { key: 'bf', units: r.bFrontArrival, className: 'bg-beta/45', moved: 0 },
    { key: 'a', units: staying, className: 'bg-alpha', moved: Math.min(r.opsA, staying) },
    { key: 'ad', units: delivered, className: 'bg-alpha/35', moved: 0 },
    { key: 'br', units: r.bRearArrival, className: 'bg-beta', moved: Math.min(r.opsB, r.bRearArrival) },
  ];
}

/** Carga al salir (mismas claves que al llegar para que las barras se transformen con resorte). */
function departureSegs(r: HeurStop): Seg[] {
  return [
    { key: 'bf', units: r.bFrontDeparture, className: 'bg-beta/45', moved: 0 },
    { key: 'a', units: r.aDeparture, className: 'bg-alpha', moved: 0 },
    { key: 'ad', units: 0, className: 'bg-alpha/35', moved: 0 },
    { key: 'br', units: r.bRearDeparture, className: 'bg-beta', moved: 0 },
  ];
}

const movedList = (r: HeurStop) => [r.opsA > 0 ? `${r.opsA} α` : null, r.opsB > 0 ? `${r.opsB} β` : null].filter((x): x is string => x !== null);

const loadText = (a: number, bf: number, br: number, cap: number) =>
  `${bf} β en el fondo, ${a} α y ${br} β en la compuerta (${a + bf + br} de ${cap})`;

function statusPhrase(c: StopCompare, dpCost: number): string {
  if (c.cost === null) return '';
  if (c.status === 'match') return 'igual que la DP';
  if (c.status === 'tie') return 'empate: mismo costo con la otra política';
  const d = `${fmtDelta(c.cost - dpCost)} frente a la DP`;
  return c.status === 'alt' ? `otra decisión, ${d}` : d;
}

/** Etiqueta accesible de una parada con todas las cifras. */
function stopAria(r: HeurStop, n: number, cap: number, c: StopCompare, g: GurobiSide | null): string {
  const moved = movedList(r);
  let s =
    `Parada ${r.position} de ${n}, ${nodeLong(r.customer)}: entrega ${r.alpha} α y recoge ${r.beta} β. ` +
    `Llega con ${loadText(r.aArrival, r.bFrontArrival, r.bRearArrival, cap)}. ` +
    `La DP aplica ${POLICY_TEXT[r.policy].name} (${POLICY_TEXT[r.policy].place}): ${moved.length ? `mueve ${joinEs(moved)}` : 'no mueve unidades'}, costo ${fmt(r.cost)}. ` +
    `Sale con ${loadText(r.aDeparture, r.bFrontDeparture, r.bRearDeparture, cap)}.`;
  if (g && c.cost !== null) {
    s += ` Gurobi ${g.label}: ${c.policy ? `${POLICY_TEXT[c.policy].name}, ` : ''}costo ${fmt(c.cost)} (${c.ops ?? 0} movimientos), ${statusPhrase(c, r.cost)}.`;
  }
  return s;
}

/* ───────────────────────── Componente ───────────────────────── */

export function DpWalkthrough({ inst }: { inst: HeurInstance | null }) {
  const views = useMemo(() => buildViews(inst), [inst]);
  // La ruta elegida se conserva al cambiar de instancia (si existe en la nueva).
  const [route, setRoute] = useState<RouteKey>(DEFAULT_ROUTE);

  if (!inst) {
    return <EmptyCard message="No hay resultados del Algoritmo 2.1 ni del ILS para la instancia cargada: el recorrido parada a parada aparecerá cuando se generen." />;
  }
  const available = ROUTE_ORDER.filter((k) => views[k]);
  if (!available.length) {
    return <EmptyCard message="Esta instancia no tiene evaluaciones del Algoritmo 2.1 sobre las rutas de Gurobi ni una ruta del ILS." />;
  }
  const key = views[route] ? route : views[DEFAULT_ROUTE] ? DEFAULT_ROUTE : available[0];

  // key = instancia: la selección de parada y la animación de entrada se reinician al cambiarla.
  return <Walkthrough key={inst.key} inst={inst} views={views} routeKey={key} onRoute={setRoute} />;
}

function Walkthrough({
  inst,
  views,
  routeKey,
  onRoute,
}: {
  inst: HeurInstance;
  views: Partial<Record<RouteKey, RouteView>>;
  routeKey: RouteKey;
  onRoute: (k: RouteKey) => void;
}) {
  const view = views[routeKey]!;
  const uid = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const visible = useInView(stripRef, { once: true, margin: '-60px' });
  const reduce = useReducedMotion();
  const barT: Transition = reduce ? { duration: 0 } : spring;
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [selPos, setSelPos] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number | null>(null);

  const detail = view.detail;
  const n = detail.length;
  const g = view.gurobi;
  const perStop = !!g?.stops;
  const withPolicy = !!g?.policies && perStop;
  const cmps = useMemo(() => detail.map((r) => compareStop(r, g)), [detail, g]);
  const maxLoad = Math.max(0, ...detail.flatMap((r) => [r.aArrival + r.bFrontArrival + r.bRearArrival, r.aDeparture + r.bFrontDeparture + r.bRearDeparture]));
  const cap = inst.dp?.capacity ?? inst.ils?.capacity ?? maxLoad;
  const px = BAR_H / Math.max(cap, maxLoad, 1);
  const maxCost = Math.max(0, ...detail.map((r) => r.cost), ...cmps.map((c) => c.cost ?? 0));
  const h = inst.dp?.h ?? inst.ils?.h ?? null;
  const hA = inst.dp?.h_a ?? inst.ils?.h_a ?? null;
  const hB = inst.dp?.h_b ?? inst.ils?.h_b ?? null;
  const kin = kinship(routeKey, view.tour, inst);

  // Parada por defecto: la más cara para la DP (la primera si ninguna cuesta).
  const defaultPos = detail.reduce<HeurStop | null>((b, r) => (!b || r.cost > b.cost + 1e-9 ? r : b), null)?.position ?? 1;
  const active = selPos !== null && detail.some((r) => r.position === selPos) ? selPos : defaultPos;
  const shown = hoverPos ?? active;
  const shownIdx = Math.max(0, detail.findIndex((r) => r.position === shown));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight') next = Math.min(n - 1, i + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    // El teclado manda: un hover previo no debe tapar la parada enfocada en el detalle.
    setHoverPos(null);
    btnRefs.current[next]?.focus();
  };

  const hasTie = cmps.some((c) => c.status === 'tie');
  // "†" solo cuando el total coincide (óptimo alternativo); si no, la diferencia ya se lee como Δ.
  const altOptimum = cmps.some((c) => c.status === 'alt') && !!g && sameCost(g.total, view.dp);
  const gRowH = gurobiRowH(withPolicy);
  const gridMin = RAIL_W + n * COL_MIN + n * COL_GAP;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      {/* Encabezado + selector de ruta */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">{HEUR_METHODS.dp.label}</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">{TITLE}</h3>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Instancia <span className="num text-zinc-300">{inst.instanceId}</span> · <span className="num text-zinc-300">{inst.numCustomers}</span>{' '}
            clientes · Q = <span className="num text-zinc-300">{cap}</span>
            {h !== null && (
              <>
                {' '}
                · h = <span className="num text-zinc-300">{fmt(h, 2)}</span> por unidad movida
              </>
            )}
          </p>
        </div>
        <div className="-m-1 max-w-full overflow-x-auto p-1 scrollbar-thin">
          <Segmented<RouteKey>
            ariaLabel="Ruta evaluada"
            size="xs"
            value={routeKey}
            onChange={onRoute}
            options={ROUTE_ORDER.map((k) => ({
              value: k,
              disabled: !views[k],
              ariaLabel: ROUTE_TITLE[k],
              title: views[k] ? ROUTE_TITLE[k] : `${ROUTE_TITLE[k]}: sin evaluación en esta instancia`,
              label:
                k === 'ils' ? (
                  <>
                    <span className="sm:hidden">ILS</span>
                    <span className="hidden sm:inline">Ruta ILS</span>
                  </>
                ) : k === 'TSPPD-H' ? (
                  <>
                    <span className="sm:hidden">Gen</span>
                    <span className="hidden sm:inline">General</span>
                  </>
                ) : (
                  ROUTE_NAME[k]
                ),
            }))}
          />
        </div>
      </div>

      {/* Qué otras rutas coinciden con la seleccionada */}
      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-zinc-400">
        <Route className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        <span className="text-zinc-200">{ROUTE_TITLE[routeKey]}</span>
        <span className="text-zinc-500">·</span>
        <span className="num text-zinc-300">{fmtKm(view.distance)}</span>
        <span className="text-zinc-500">·</span>
        <span>
          {kin.total > 2 && kin.same.length === kin.total - 1
            ? `los ${kin.total} métodos recorren esta misma ruta: toda la diferencia entre ellos es manipulación`
            : kin.same.length
              ? `misma ruta que ${joinEs(kin.same)}`
              : 'ningún otro método recorre esta ruta'}
          {kin.reversed.length > 0 && ` · ${joinEs(kin.reversed)} la ${kin.reversed.length > 1 ? 'recorren' : 'recorre'} en sentido inverso`}
        </span>
        {!view.feasible && <Chip tone="handling">excede Q en algún tramo</Chip>}
      </p>

      <Summary view={view} />

      {n === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-3.5 text-[13px] text-zinc-400">
          Esta ruta no trae el detalle por parada de la DP.
        </p>
      ) : (
        <>
          {/* Leyenda de la tira */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-zinc-800/70 py-2.5">
            <LegendBlock className="bg-beta/45">β fondo</LegendBlock>
            <LegendBlock className="bg-alpha">α a bordo</LegendBlock>
            <LegendBlock className="bg-alpha/35">α que se entregan</LegendBlock>
            <LegendBlock className="bg-beta">β compuerta</LegendBlock>
            <LegendBlock style={MOVED_STYLE}>se mueven (manipulación)</LegendBlock>
            <span className="text-[11.5px] text-zinc-500">
              Barra ancha: al llegar · delgada: al salir · F cabina arriba, R compuerta abajo · alto total = Q ={' '}
              <span className="num">{cap}</span>
            </span>
          </div>

          {/* Tira de paradas */}
          <div
            ref={stripRef}
            className="relative -mx-1 mt-3 overflow-x-auto px-1 py-1 scrollbar-thin"
            onPointerLeave={() => setHoverPos(null)}
          >
            <div className="flex" style={{ minWidth: gridMin, gap: COL_GAP }}>
              <Rail cap={cap} g={perStop ? g : null} gRowH={gRowH} />
              <motion.ol
                aria-label={`Paradas de la ${ROUTE_TITLE[routeKey].replace(/^Ruta/, 'ruta')}, en orden de visita`}
                className="grid min-w-0 flex-1"
                style={{ gridTemplateColumns: `repeat(${n}, minmax(${COL_MIN}px, 1fr))`, gap: COL_GAP }}
                variants={staggerParent}
                initial="hidden"
                animate={visible ? 'show' : 'hidden'}
              >
                {detail.map((r, i) => (
                  <StopColumn
                    key={r.position}
                    row={r}
                    index={i}
                    n={n}
                    cap={cap}
                    px={px}
                    maxCost={maxCost}
                    cmp={cmps[i]}
                    g={perStop ? g : null}
                    withPolicy={withPolicy}
                    altMark={altOptimum}
                    gRowH={gRowH}
                    active={r.position === active}
                    visible={visible}
                    transition={barT}
                    staggerDelay={reduce ? 0 : 0.03 * i}
                    markerId={`${uid}-stop`}
                    buttonRef={(el) => {
                      btnRefs.current[i] = el;
                    }}
                    onSelect={() => setSelPos(r.position)}
                    onHover={() => setHoverPos(r.position)}
                    onKey={(e) => onKey(e, i)}
                  />
                ))}
              </motion.ol>
            </div>
          </div>

          <StopInspector row={detail[shownIdx]} n={n} cap={cap} cmp={cmps[shownIdx]} g={perStop ? g : null} dpTotal={view.dp} hA={hA} hB={hB} />
        </>
      )}

      {/* Lecturas + reglas */}
      <div className="mt-5 grid grid-cols-1 gap-6 border-t border-zinc-800/70 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Readings view={view} cmps={cmps} />
        <Rules hA={hA} hB={hB} hasTie={hasTie} hasAlt={altOptimum} g={perStop ? g : null} />
      </div>
    </SpotlightCard>
  );
}

/* ───────────────────────── Resumen ───────────────────────── */

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

/** Diferencia frente a la DP (valor y porcentaje sobre la DP). */
function VsDp({ value, dp }: { value: number; dp: number }) {
  if (sameCost(value, dp)) return <>igual a la DP</>;
  const d = value - dp;
  return (
    <>
      <Em>{fmtDelta(d)}</Em> {d > 0 ? 'sobre' : 'bajo'} la DP
      {dp > 0 && (
        <span className="text-zinc-500">
          {' '}
          ({d > 0 ? '+' : '−'}
          {fmtPct(Math.abs(d) / dp)})
        </span>
      )}
    </>
  );
}

function Stat({ term, value, note, className }: { term: ReactNode; value: ReactNode; note: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col bg-zinc-950/70 px-4 py-3.5', className)}>
      <dt className="flex items-center gap-1.5 text-[12px] text-zinc-400">{term}</dt>
      <dd className="num mt-2 text-[22px] leading-none font-semibold tracking-tight text-zinc-50">{value}</dd>
      <dd className="mt-2 text-[12px] leading-snug text-pretty text-zinc-400">{note}</dd>
    </div>
  );
}

function Summary({ view }: { view: RouteView }) {
  const g = view.gurobi;
  return (
    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-800/80 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.7fr)]">
      <Stat
        term={
          <>
            <MethodMark tone="dp" size={11} />
            DP · f(0)
          </>
        }
        value={fmt(view.dp)}
        note="Manipulación óptima de la Política 3 en esta ruta."
      />
      {g ? (
        <Stat
          term={
            <>
              <MethodMark tone={g.tone} size={11} />
              Gurobi {g.short}
              <span className="text-zinc-500">· {g.sameRoute ? 'esta ruta' : 'otra ruta'}</span>
            </>
          }
          value={fmt(g.total)}
          note={
            g.sameRoute ? (
              g.model === 'TSPPD-H' && g.total < view.dp && !sameCost(g.total, view.dp) ? (
                <>
                  <VsDp value={g.total} dp={view.dp} />: sin política fija, reubica libremente.
                </>
              ) : (
                <VsDp value={g.total} dp={view.dp} />
              )
            ) : (
              <>Su óptimo recorre otra ruta: solo se compara el total.</>
            )
          }
        />
      ) : (
        <Stat term="Gurobi" value="—" note="Sin solución Gurobi para comparar." />
      )}
      <Stat
        term={
          <>
            <Chip tone="p1">P1</Chip>
            pura
          </>
        }
        value={fmt(view.p1)}
        note={<VsDp value={view.p1} dp={view.dp} />}
      />
      <Stat
        term={
          <>
            <Chip tone="p2">P2</Chip>
            pura
          </>
        }
        value={fmt(view.p2)}
        note={<VsDp value={view.p2} dp={view.dp} />}
      />
      <div className="col-span-2 flex min-w-0 flex-col bg-zinc-950/70 px-4 py-3.5 lg:col-span-1">
        <dt className="text-[12px] text-zinc-400">Cadena de la DP · 0 → j₁ → … → n</dt>
        <dd className="mt-2">
          <DpChain view={view} />
        </dd>
      </div>
    </dl>
  );
}

/** Puntos de la DP donde se aplica Política 2, con f(j): lo que queda por manipular desde ahí. */
function DpChain({ view }: { view: RouteView }) {
  const posOf = new Map(view.detail.map((r) => [r.customer, r.position]));
  // Sufijos del costo por parada (= f(j) en la cadena) si el archivo no trae f.
  const suffix: number[] = [];
  let acc = 0;
  for (let k = view.detail.length; k >= 0; k--) {
    suffix[k] = acc;
    const r = view.detail[k - 1];
    if (r) acc += r.cost;
  }
  const fAt = (pos: number) => view.f?.[pos] ?? suffix[pos] ?? null;
  const nodes = [{ id: 0, pos: 0 }, ...view.p2Customers.map((c) => ({ id: c, pos: posOf.get(c) ?? null }))];
  const others = view.detail.length - view.p2Customers.length;
  const p2Labels = view.p2Customers.map(nodeShort);

  return (
    <>
      <ol aria-label="Cadena de puntos con Política 2" className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {nodes.map((nd, i) => {
          const f = nd.pos !== null ? fAt(nd.pos) : null;
          return (
            <li key={`${nd.id}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden />}
              <span
                className={cn(
                  'inline-flex flex-col items-center rounded-lg border px-2 py-1',
                  nd.id === 0 ? 'border-zinc-700 bg-zinc-900' : 'border-p2/35 bg-p2/10',
                )}
              >
                <span className="num text-[12px] leading-4 font-medium text-zinc-50">{nd.id === 0 ? 'D' : nodeShort(nd.id)}</span>
                {f !== null && nd.pos !== null && (
                  <span className="num text-[10.5px] leading-4 text-zinc-400">
                    f({nd.pos}) {fmt(f)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[12px] leading-snug text-zinc-400">
        {p2Labels.length === 0
          ? 'La DP no aplica Política 2 en esta ruta.'
          : others === 0
            ? 'Política 2 en todas las paradas.'
            : p2Labels.length === 1
              ? `Política 2 solo al cierre (${p2Labels[0]}); Política 1 en las demás.`
              : `Política 2 en ${joinEs(p2Labels)}; Política 1 en las demás.`}
      </p>
    </>
  );
}

/* ───────────────────────── Tira de paradas ───────────────────────── */

function LegendBlock({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
      <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', className)} style={style} />
      {children}
    </span>
  );
}

/** Riel de etiquetas (fijo al desplazar la tira en pantallas angostas). */
function Rail({ cap, g, gRowH }: { cap: number; g: GurobiSide | null; gRowH: number }) {
  const row = 'flex items-center justify-end';
  return (
    <div
      aria-hidden
      className="sticky left-0 z-10 flex shrink-0 flex-col border border-transparent pt-2.5 pr-2 text-right text-[10.5px] leading-tight text-zinc-500"
      style={{ width: RAIL_W, gap: ROW_GAP, backgroundColor: COLOR.surface }}
    >
      <span className="flex items-end justify-end pb-0.5" style={{ height: ROW.head }}>
        Parada
      </span>
      <span className="flex flex-col items-end justify-between" style={{ height: ROW.load }}>
        <span>
          <span className="font-mono font-medium text-zinc-200">F</span>
          <br />
          cabina
        </span>
        <span className="num">Q {cap}</span>
        <span>
          compuerta
          <br />
          <span className="font-mono font-medium text-zinc-200">R</span>
        </span>
      </span>
      <span className={row} style={{ height: ROW.policy }}>
        Decisión
      </span>
      <span className={row} style={{ height: ROW.ops }}>
        Mueve
      </span>
      <span className={cn(row, 'gap-1')} style={{ height: ROW.cost }}>
        <MethodMark tone="dp" size={10} />
        DP
      </span>
      {g && (
        <span className="flex flex-col items-end justify-center gap-0.5" style={{ height: gRowH }}>
          <span className="inline-flex items-center gap-1">
            <MethodMark tone={g.tone} size={10} />
            Gurobi
          </span>
          <span className="font-mono text-zinc-400">{g.short}</span>
          <span>Δ vs DP</span>
        </span>
      )}
    </div>
  );
}

/** Barra vertical de carga: bloques apilados de la cabina (arriba) a la compuerta (abajo). */
function LoadBar({ segs, px, width, visible, transition }: { segs: Seg[]; px: number; width: number; visible: boolean; transition: Transition }) {
  let acc = 0;
  return (
    <span aria-hidden className="relative block overflow-hidden rounded-[5px] bg-zinc-800/45 ring-1 ring-zinc-700/50 ring-inset" style={{ width, height: BAR_H }}>
      {segs.map((s) => {
        const top = acc * px;
        acc += s.units;
        return (
          <motion.span
            key={s.key}
            className={cn('absolute inset-x-0 block shadow-[inset_0_-1px_0_rgb(17_17_20)]', s.className)}
            initial={false}
            animate={{ top: visible ? top : 0, height: visible ? s.units * px : 0 }}
            transition={transition}
          >
            {s.moved > 0 && s.units > 0 && (
              <span className="absolute inset-x-0 bottom-0 block" style={{ height: `${(s.moved / s.units) * 100}%`, ...MOVED_STYLE }} />
            )}
          </motion.span>
        );
      })}
    </span>
  );
}

function CostBar({ value, max, color, visible, transition }: { value: number; max: number; color: string; visible: boolean; transition: Transition }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <span aria-hidden className="relative block h-1 w-full overflow-hidden rounded-full bg-zinc-800/80">
      <motion.span
        className="absolute inset-y-0 left-0 block rounded-full"
        style={{ backgroundColor: color, minWidth: value > 0 && visible ? 2 : 0 }}
        initial={false}
        animate={{ width: `${visible ? pct : 0}%` }}
        transition={transition}
      />
    </span>
  );
}

function MiniPolicy({ policy }: { policy: StopPolicy }) {
  return (
    <span
      className={cn(
        'num inline-flex h-4 items-center rounded-[5px] border px-1 text-[10px] font-medium',
        policy === 1 ? 'border-p1/35 bg-p1/12 text-p1' : 'border-p2/35 bg-p2/12 text-p2',
      )}
    >
      {POLICY_TEXT[policy].code}
    </span>
  );
}

function StopColumn({
  row,
  index,
  n,
  cap,
  px,
  maxCost,
  cmp,
  g,
  withPolicy,
  altMark,
  gRowH,
  active,
  visible,
  transition,
  staggerDelay,
  markerId,
  buttonRef,
  onSelect,
  onHover,
  onKey,
}: {
  row: HeurStop;
  index: number;
  n: number;
  cap: number;
  px: number;
  maxCost: number;
  cmp: StopCompare;
  g: GurobiSide | null;
  withPolicy: boolean;
  /** Marca "†" (óptimo alternativo, explicado en las reglas). */
  altMark: boolean;
  gRowH: number;
  active: boolean;
  visible: boolean;
  transition: Transition;
  staggerDelay: number;
  markerId: string;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onHover: () => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const t: Transition = { ...transition, delay: staggerDelay };
  const moved = [
    row.opsA > 0 ? { k: 'a', text: `${row.opsA} α`, cls: 'text-alpha' } : null,
    row.opsB > 0 ? { k: 'b', text: `${row.opsB} β`, cls: 'text-beta' } : null,
  ].filter((x): x is { k: string; text: string; cls: string } => x !== null);
  const differs = cmp.status === 'diff' || cmp.status === 'alt';

  return (
    <motion.li variants={staggerChild} className="min-w-0">
      <motion.button
        ref={buttonRef}
        type="button"
        tabIndex={active ? 0 : -1}
        aria-pressed={active}
        aria-label={stopAria(row, n, cap, cmp, g)}
        data-index={index}
        onClick={onSelect}
        onFocus={onSelect}
        onPointerEnter={onHover}
        onKeyDown={onKey}
        whileHover={hoverLift}
        whileTap={tapPress}
        transition={springSnappy}
        className={cn(
          'relative flex w-full flex-col items-stretch rounded-xl border px-1.5 pt-2.5 pb-2.5 text-center transition-colors duration-150',
          active ? 'border-zinc-500/70 bg-zinc-800/45' : 'border-zinc-800/80 bg-zinc-950/30 hover:border-zinc-700 hover:bg-zinc-900/60',
        )}
        style={{ gap: ROW_GAP }}
      >
        {active && (
          <motion.span layoutId={markerId} transition={spring} aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-zinc-50" />
        )}

        {/* Posición, cliente y demandas */}
        <span className="flex flex-col items-center justify-end" style={{ height: ROW.head }}>
          <span className="num text-[10.5px] leading-none text-zinc-500">#{row.position}</span>
          <span className="mt-1 text-[14px] leading-none font-semibold tracking-tight text-zinc-50">{nodeShort(row.customer)}</span>
          <span className="num mt-1.5 text-[11px] leading-none">
            <span className="text-alpha">α{row.alpha}</span> <span className="text-beta">β{row.beta}</span>
          </span>
        </span>

        {/* Carga al llegar (ancha) y al salir (delgada) */}
        <span className="flex items-stretch justify-center gap-1.5" style={{ height: ROW.load }}>
          <LoadBar segs={arrivalSegs(row)} px={px} width={26} visible={visible} transition={t} />
          <LoadBar segs={departureSegs(row)} px={px} width={10} visible={visible} transition={t} />
        </span>

        {/* Decisión de la DP */}
        <span className="flex flex-col items-center justify-center gap-1" style={{ height: ROW.policy }}>
          <Chip tone={row.policy === 1 ? 'p1' : 'p2'}>{POLICY_TEXT[row.policy].code}</Chip>
          <span className="text-[10.5px] leading-none text-zinc-400">{POLICY_TEXT[row.policy].place}</span>
        </span>

        {/* Unidades movidas */}
        <span className="num flex flex-col items-center justify-center text-[11px] leading-4" style={{ height: ROW.ops }}>
          {moved.length ? (
            moved.map((m) => (
              <span key={m.k} className={m.cls}>
                {m.text}
              </span>
            ))
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </span>

        {/* Costo de la DP */}
        <span className="flex flex-col justify-center gap-1.5" style={{ height: ROW.cost }}>
          <span className={cn('num text-[13px] leading-none font-medium', row.cost > 1e-9 ? 'text-handling' : 'text-zinc-500')}>{fmt(row.cost)}</span>
          <CostBar value={row.cost} max={maxCost} color={COLOR.handling} visible={visible} transition={t} />
        </span>

        {/* Gurobi en la misma parada */}
        {g && (
          <span
            className={cn(
              'flex flex-col items-stretch justify-center gap-1.5 rounded-lg border px-1',
              differs ? 'border-dashed border-zinc-500/80 bg-zinc-800/50' : 'border-transparent bg-zinc-900/40',
            )}
            style={{ height: gRowH }}
          >
            {cmp.cost === null ? (
              <span className="text-[10.5px] text-zinc-500">sin dato</span>
            ) : (
              <>
                <span className="num text-[12.5px] leading-none text-zinc-100">{fmt(cmp.cost)}</span>
                <CostBar value={cmp.cost} max={maxCost} color={METHOD_COLOR[g.tone]} visible={visible} transition={t} />
                {withPolicy && cmp.policy && (
                  <span className="flex justify-center">
                    <MiniPolicy policy={cmp.policy} />
                  </span>
                )}
                <span className="num text-[10.5px] leading-none">
                  {cmp.status === 'match' ? (
                    <span className="text-zinc-500">= DP</span>
                  ) : cmp.status === 'tie' ? (
                    <span className="font-sans text-zinc-200">empate*</span>
                  ) : (
                    <span className="text-zinc-100">
                      {fmtDelta(cmp.cost - row.cost)}
                      {cmp.status === 'alt' && altMark && '†'}
                    </span>
                  )}
                </span>
              </>
            )}
          </span>
        )}
      </motion.button>
    </motion.li>
  );
}

/* ───────────────────────── Detalle de la parada ───────────────────────── */

function LoadReadout({ title, a, bf, br, cap }: { title: string; a: number; bf: number; br: number; cap: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2">
      <p className="text-[11px] text-zinc-500">{title}</p>
      <p className="num mt-0.5 text-[12.5px] text-zinc-300">
        <span className="text-beta">{bf} β</span> fondo · <span className="text-alpha">{a} α</span> · <span className="text-beta">{br} β</span> compuerta
        <span className="text-zinc-500">
          {' '}
          · {a + bf + br}/{cap}
        </span>
      </p>
    </div>
  );
}

/** Qué hace la DP en la parada y por qué cuesta lo que cuesta (reglas de simulate_policies). */
function decisionText(r: HeurStop): string {
  if (r.policy === 1) {
    const pick = r.beta > 0 ? ` Las ${r.beta} β recogidas quedan en la compuerta.` : '';
    if (r.alpha > 0 && r.bRearArrival > 0)
      return `Política 1: las ${r.alpha} α que se entregan quedan detrás de ${r.bRearArrival} β de la compuerta, que se descargan y recargan.${pick}`;
    if (r.alpha > 0) return `Política 1: la compuerta está libre, se entregan ${r.alpha} α sin mover nada.${pick}`;
    return `Política 1: sin entregas, las β de la compuerta no estorban.${pick}`;
  }
  if (r.opsA + r.opsB > 0) {
    const parts = movedList(r).map((x) => (x.endsWith('β') ? `${x} de la compuerta` : `${x} que siguen a bordo`));
    // Solo se recargan α si se descargó alguna (en la última parada ya no quedan a bordo).
    const reload = r.opsA > 0 ? ' y se recargan las α' : '';
    return `Política 2: se descargan ${joinEs(parts)}; las ${r.bFrontDeparture} β quedan al fondo${reload}.`;
  }
  if (r.bRearArrival + r.beta === 0) return 'Política 2 sin costo: no hay β que reubicar.';
  return `Política 2 sin costo: no quedan α a bordo ni β en la compuerta; las ${r.beta} β recogidas van al fondo.`;
}

function StopInspector({
  row,
  n,
  cap,
  cmp,
  g,
  dpTotal,
  hA,
  hB,
}: {
  row: HeurStop;
  n: number;
  cap: number;
  cmp: StopCompare;
  g: GurobiSide | null;
  dpTotal: number;
  hA: number | null;
  hB: number | null;
}) {
  const note =
    cmp.status === 'match'
      ? 'igual que la DP.'
      : cmp.status === 'tie'
        ? 'empate: otra decisión, mismo costo en esta parada.'
        : cmp.status === 'diff'
          ? g?.model === 'TSPPD-H'
            ? `${fmtDelta((cmp.cost ?? 0) - row.cost)} frente a la DP (sin política fija).`
            : g?.model === 'TSPPD-H_1' || g?.model === 'TSPPD-H_2'
              ? `${fmtDelta((cmp.cost ?? 0) - row.cost)} frente a la DP (aplica ${g.label} en todas las paradas).`
              : `${fmtDelta((cmp.cost ?? 0) - row.cost)} frente a la DP.`
          : `${fmtDelta((cmp.cost ?? 0) - row.cost)} frente a la DP con otra decisión${g && sameCost(g.total, dpTotal) ? '; el total coincide (óptimo alternativo)' : ''}.`;

  return (
    <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="num text-[11px] text-zinc-500">
          Parada {row.position} de {n}
        </span>
        <span className="text-[14px] font-medium tracking-tight text-zinc-50">{nodeLong(row.customer)}</span>
        <span className="num text-[12px] text-zinc-400">
          entrega <span className="text-alpha">{row.alpha} α</span> · recoge <span className="text-beta">{row.beta} β</span>
        </span>
        <Chip tone={row.policy === 1 ? 'p1' : 'p2'}>
          {POLICY_TEXT[row.policy].code} · {POLICY_TEXT[row.policy].place}
        </Chip>
        <span className="ml-auto text-[12px] text-zinc-400">
          costo DP <span className="num text-[15px] font-medium text-handling">{fmt(row.cost)}</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
        <LoadReadout title="Al llegar" a={row.aArrival} bf={row.bFrontArrival} br={row.bRearArrival} cap={cap} />
        <ArrowRight className="hidden h-4 w-4 text-zinc-500 sm:block" aria-hidden />
        <LoadReadout title="Al salir" a={row.aDeparture} bf={row.bFrontDeparture} br={row.bRearDeparture} cap={cap} />
      </div>

      <p className="mt-3 max-w-[90ch] text-[12.5px] leading-relaxed text-pretty text-zinc-400">
        {decisionText(row)}
        {hA !== null && hB !== null && row.opsA + row.opsB > 0 && (
          <>
            {' '}
            <span className="num whitespace-nowrap text-zinc-300">
              {row.opsA} × {fmtAuto(hA)} + {row.opsB} × {fmtAuto(hB)} = {fmt(row.cost)}
            </span>
          </>
        )}
      </p>

      {g && cmp.cost !== null && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-zinc-800/70 pt-2.5 text-[12.5px] text-zinc-400">
          <MethodMark tone={g.tone} size={11} />
          <span className="text-zinc-200">Gurobi {g.label}</span>
          {cmp.policy && (
            <>
              <MiniPolicy policy={cmp.policy} />
              <span className="num text-zinc-500">
                s<sub>i</sub> = {POLICY_TEXT[cmp.policy].s}
              </span>
            </>
          )}
          <span>
            paga <Em>{fmt(cmp.cost)}</Em> ({cmp.ops ?? 0} mov.) · {note}
          </span>
        </p>
      )}
      <p className="mt-2 text-[11px] text-zinc-500">Otra parada: clic en su columna o ← → con el foco en la tira.</p>
    </div>
  );
}

/* ───────────────────────── Lecturas y reglas ───────────────────────── */

/** Lecturas calculadas a partir de la ruta mostrada (nunca texto fijo con cifras). */
function Readings({ view, cmps }: { view: RouteView; cmps: StopCompare[] }) {
  const { dp, gurobi: g, detail } = view;
  const n = detail.length;
  const items: ReactNode[] = [];

  // 1 · Total frente a Gurobi
  if (g) {
    const d = g.total - dp;
    if (!g.sameRoute) {
      items.push(
        <>
          El ILS recorre una ruta distinta de la de Gurobi P3: la DP le asigna <Em>{fmt(dp)}</Em> de manipulación frente a <Em>{fmt(g.total)}</Em>{' '}
          de Gurobi.
        </>,
      );
    } else if (sameCost(g.total, dp)) {
      items.push(
        g.model === 'TSPPD-H_3' ? (
          <>
            La DP reproduce la manipulación óptima de Gurobi P3 en esta ruta: <Em>{fmt(dp)}</Em>
            {view.key === 'ils' ? ' (el ILS encontró la misma ruta que Gurobi P3)' : ''}.
          </>
        ) : (
          <>
            En esta ruta la DP y Gurobi {g.label} manipulan lo mismo: <Em>{fmt(dp)}</Em>.
          </>
        ),
      );
    } else if (d > 0) {
      items.push(
        <>
          Sobre la misma ruta, elegir la política parada a parada cuesta <Em>{fmt(dp)}</Em> frente a <Em>{fmt(g.total)}</Em> de Gurobi {g.label}:{' '}
          <Em>{fmt(d)}</Em> menos (<Em>−{fmtPct(d / g.total)}</Em>).
        </>,
      );
    } else {
      items.push(
        g.model === 'TSPPD-H' ? (
          <>
            El Modelo General manipula <Em>{fmt(g.total)}</Em>, <Em>{fmt(-d)}</Em> menos que la DP: no está limitado a las Políticas 1 y 2 y puede
            ubicar cada unidad donde convenga. La Política 3 es una restricción, no un error de la DP.
          </>
        ) : (
          <>
            Gurobi {g.label} manipula <Em>{fmt(g.total)}</Em>, <Em>{fmt(-d)}</Em> menos que la DP en esta ruta.
          </>
        ),
      );
    }
  }

  // 2 · Políticas puras frente a la combinación de la DP
  const bestPure = Math.min(view.p1, view.p2);
  if (sameCost(dp, bestPure)) {
    const which = sameCost(view.p1, view.p2) ? 'ambas políticas puras' : view.p1 < view.p2 ? 'la Política 1 pura' : 'la Política 2 pura';
    items.push(
      <>
        Con una sola política la ruta costaría <Em>{fmt(view.p1)}</Em> (P1) o <Em>{fmt(view.p2)}</Em> (P2): aquí la mejor combinación coincide con{' '}
        {which}.
      </>,
    );
  } else {
    items.push(
      <>
        Con una sola política la ruta costaría <Em>{fmt(view.p1)}</Em> (P1) o <Em>{fmt(view.p2)}</Em> (P2); combinando ambas, la DP baja a{' '}
        <Em>{fmt(dp)}</Em>, un <Em>{fmtPct(bestPure > 0 ? (bestPure - dp) / bestPure : 0)}</Em> menos que la mejor política pura.
      </>,
    );
  }

  // 3 · Parada más cara
  const top = detail.reduce<HeurStop | null>((b, r) => (!b || r.cost > b.cost + 1e-9 ? r : b), null);
  if (top && top.cost > 1e-9) {
    const moved = movedList(top);
    items.push(
      <>
        La parada más cara para la DP es <span className="text-zinc-100">{nodeLong(top.customer)}</span> (#<span className="num">{top.position}</span>):
        con {POLICY_TEXT[top.policy].name} mueve {joinEs(moved)} y paga <Em>{fmt(top.cost)}</Em>, el <Em>{fmtPct(dp > 0 ? top.cost / dp : 0)}</Em> del
        total.
      </>,
    );
  } else if (n > 0) {
    items.push(<>La DP no necesita mover ninguna unidad en esta ruta.</>);
  }

  // 4 · Comparación parada a parada con Gurobi
  if (g?.stops && n > 0) {
    const pairs = detail.map((r, i) => ({ r, c: cmps[i] }));
    const differ = pairs.filter((x) => x.c.status === 'diff' || x.c.status === 'alt');
    const ties = pairs.filter((x) => x.c.status === 'tie');
    if (!differ.length && !ties.length) {
      items.push(
        <>
          Gurobi {g.label} paga exactamente lo mismo que la DP en las <Em>{n}</Em> paradas.
        </>,
      );
    } else if (!differ.length) {
      items.push(
        <>
          Gurobi decide distinto en {joinEs(ties.map((x) => nodeShort(x.r.customer)))}, pero con el mismo costo:{' '}
          {ties.length === 1 ? 'es un empate' : 'son empates'}.
        </>,
      );
    } else {
      const worst = differ.reduce((b, x) => (Math.abs((x.c.cost ?? 0) - x.r.cost) > Math.abs((b.c.cost ?? 0) - b.r.cost) ? x : b));
      const alt = differ.some((x) => x.c.status === 'alt') && sameCost(g.total, dp);
      items.push(
        <>
          Gurobi {g.label} paga distinto en <Em>{differ.length}</Em> de <Em>{n}</Em> paradas; la mayor diferencia está en{' '}
          {nodeShort(worst.r.customer)} (#<span className="num">{worst.r.position}</span>): <Em>{fmt(worst.c.cost ?? 0)}</Em> frente a{' '}
          <Em>{fmt(worst.r.cost)}</Em> de la DP.
          {alt && ' El total coincide: Gurobi llegó al mismo óptimo con otra secuencia de políticas.'}
        </>,
      );
    }
  }

  return (
    <div className="min-w-0">
      <p className="eyebrow">Lectura de los datos</p>
      <ol className="mt-3 space-y-2.5">
        {items.map((node, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-pretty text-zinc-400">
            <span className="num mt-[1px] shrink-0 text-[11px] text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
            <span className="max-w-[65ch]">{node}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Rules({ hA, hB, hasTie, hasAlt, g }: { hA: number | null; hB: number | null; hasTie: boolean; hasAlt: boolean; g: GurobiSide | null }) {
  const li = 'flex gap-2.5 text-[12.5px] leading-relaxed text-pretty text-zinc-400';
  return (
    <div className="min-w-0">
      <p className="eyebrow">Cómo cobra la DP</p>
      <ul className="mt-3 space-y-2.5">
        <li className={li}>
          <Chip tone="p1" className="mt-0.5">
            P1
          </Chip>
          <span>
            <span className="text-zinc-200">Compuerta.</span> Si el cliente recibe entregas (α<sub>i</sub> &gt; 0), las β de la compuerta estorban: se
            descargan y recargan, h<sub>b</sub> c/u. Las β recogidas quedan en la compuerta.
          </span>
        </li>
        <li className={li}>
          <Chip tone="p2" className="mt-0.5">
            P2
          </Chip>
          <span>
            <span className="text-zinc-200">Fondo.</span> Si hay β que reubicar, se descargan las β de la compuerta (h<sub>b</sub> c/u) y las α que
            siguen a bordo (h<sub>a</sub> c/u); todas las β pasan al fondo y se recargan las α.
          </span>
        </li>
        <li className={li}>
          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
          <span>
            f(i) = min<sub>j</sub> {'{'} p<sub>ij</sub> + f(j) {'}'}, f(n) = 0, con p<sub>ij</sub> = Política 1 en i+1…j−1 y Política 2 en j. La última
            parada siempre cierra la cadena con Política 2, sin costo extra si allí hay entrega (α<sub>n</sub> &gt; 0): ambas políticas mueven las
            mismas β de la compuerta y, tras entregar, ya no quedan α a bordo que mover (h<sub>a</sub>·0).
            {hA !== null && hB !== null && (
              <>
                {' '}
                Aquí h<sub>a</sub> = <span className="num text-zinc-300">{fmtAuto(hA)}</span> y h<sub>b</sub> ={' '}
                <span className="num text-zinc-300">{fmtAuto(hB)}</span>.
              </>
            )}
          </span>
        </li>
        {hasTie && (
          <li className={li}>
            <span className="w-4 shrink-0 text-center text-zinc-200">*</span>
            <span>
              <span className="text-zinc-200">Empate:</span> Gurobi y la DP eligen distinto en esa parada, pero pagan lo mismo en ella.
            </span>
          </li>
        )}
        {hasAlt && (
          <li className={li}>
            <span className="w-4 shrink-0 text-center text-zinc-200">†</span>
            <span>
              <span className="text-zinc-200">Óptimo alternativo:</span> Gurobi elige otra decisión con otro costo en la parada, pero el total de la ruta
              es el mismo; el costo se reparte distinto entre las paradas.
            </span>
          </li>
        )}
        {g?.source && (
          <li className="pl-[26px] text-[11.5px] text-zinc-500">
            Costo por parada de Gurobi: <span className="font-mono break-all">{g.source}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

/* ───────────────────────── Estado vacío ───────────────────────── */

function EmptyCard({ message }: { message: string }) {
  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <p className="eyebrow">{HEUR_METHODS.dp.label}</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">{TITLE}</h3>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-3.5">
        <Route className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-400">{message}</p>
      </div>
    </SpotlightCard>
  );
}
