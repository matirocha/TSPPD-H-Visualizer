/**
 * ILS · Algoritmo 4.2 — cómo converge la búsqueda en la instancia cargada.
 * - Cabecera: Z de ILS-2dir (distancia + manipulación) y su brecha con el Z* de Gurobi P3.
 * - Traza de la corrida reportada (la mejor de las semillas): mejor costo hasta cada iteración (escalón) en las dos
 *   direcciones del ciclo TSP, el óptimo local de cada iteración (puntos tenues: la
 *   exploración) y la referencia Z* de Gurobi P3. El eje x admite escala logarítmica
 *   porque casi toda la mejora ocurre en las primeras iteraciones y el resto suele ser plano.
 * - Detalle en pestañas (una a la vez, para que la tarjeta no crezca): lectura de la traza,
 *   indicadores por dirección y robustez entre corridas (semillas) con ILS-1dir frente a ILS-2dir.
 * Todo sale de ILS_<n>_Clientes_ID<id>_H_<h>.json; nada se recalcula en el navegador.
 */
import { memo, useId, useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Check, Terminal } from 'lucide-react';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtDelta, fmtKm, fmtPct } from '../../lib/format';
import { spring, springSoft } from '../../lib/motion';
import type { ILSDirection, ILSFile, TourCost } from '../../types/heuristics';
import { Chip, Segmented, SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, LegendItem, Swatch, TipHeader, TipRow, clamp, niceStep, useElementWidth } from '../analysis/chart';
import { gurobiFor, relGap, sameCost, type HeurInstance } from './data';
import { HEUR_COLOR, HEUR_METHODS, METHOD_COLOR, MethodMark, MethodMarkSvg } from './methods';

const TOP = 16;
const PLOT_H = 150;
const AXIS_H = 36;
const HEIGHT = TOP + PLOT_H + AXIS_H;
const ML = 42;
const MR = 14;
/** Ancho aproximado de un carácter de Geist Mono a 10,5 px (para evitar choques de etiquetas). */
const CHAR_W = 6.3;
/** Texto de ejes: zinc-500 ajustado del sistema (≥ 4,5:1 sobre la tarjeta). */
const TICK_TEXT = '#8b8b94';

type XMode = 'log' | 'lin';
type Detail = 'lectura' | 'direcciones' | 'corridas';

interface DirStyle {
  color: string;
  width: number;
  dash?: string;
  label: string;
  name: string;
  short: string;
}

/** Dirección 1: azul ILS sólido y grueso · dirección 2: azul claro discontinuo, dibujada encima. */
const DIR_STYLE: Record<1 | 2, DirStyle> = {
  1: { color: HEUR_COLOR.ils, width: 2.5, label: 'Dirección 1 (ciclo TSP)', name: 'ciclo TSP', short: 'D1' },
  2: { color: '#bfdbfe', width: 1.5, dash: '4 4', label: 'Dirección 2 (inverso)', name: 'inverso', short: 'D2' },
};

interface Trace {
  dir: ILSDirection;
  style: DirStyle;
  /** Mejor costo tras la iteración k (k = 0: tour inicial; k ≥ 1: history[k − 1]). */
  best: number[];
  /** Óptimo local alcanzado en la iteración k (índice k − 1). */
  local: number[];
}

interface YDomain {
  lo: number;
  hi: number;
}

export function IlsConvergence({ inst }: { inst: HeurInstance | null }) {
  // Sin `best` el archivo está incompleto: la cabecera y las corridas no tienen qué mostrar.
  if (!inst || !inst.ils || !inst.ils.best) return <EmptyCard inst={inst} />;
  return <IlsCard inst={inst} ils={inst.ils} />;
}

/* ───────────────────────── Datos ───────────────────────── */

function buildTraces(ils: ILSFile): Trace[] {
  const dirs = Array.isArray(ils.directions) ? ils.directions.filter((d) => Number.isFinite(d?.initial?.objectiveValue)) : [];
  return dirs
    .sort((a, b) => a.direction - b.direction)
    .map((dir) => ({
      dir,
      style: DIR_STYLE[dir.direction] ?? DIR_STYLE[1],
      best: [dir.initial.objectiveValue, ...(dir.history ?? [])],
      local: [...(dir.localOptima ?? [])],
    }));
}

/**
 * Dominio y: de un poco bajo min(mejor, Z* P3) a un poco sobre el máximo de los escalones
 * (costos iniciales). Los óptimos locales no lo amplían: si quedan arriba se marcan en el borde.
 * El margen inferior deja sitio a la etiqueta de la referencia bajo su línea.
 */
function yDomain(traces: Trace[], p3z: number | null): YDomain | null {
  const bests = traces.flatMap((t) => t.best).filter(Number.isFinite);
  if (!bests.length) return null;
  let lo = Math.min(...bests, ...traces.flatMap((t) => t.local).filter(Number.isFinite));
  let hi = Math.max(...bests);
  if (p3z !== null && Number.isFinite(p3z)) {
    lo = Math.min(lo, p3z);
    hi = Math.max(hi, p3z);
  }
  const span = hi - lo > 1e-9 ? hi - lo : Math.max(Math.abs(hi) * 0.02, 1);
  return { lo: lo - span * 0.18, hi: hi + span * 0.1 };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Al menos una dirección utilizable (con tour inicial) trae su traza. */
const hasTraceData = (traces: Trace[]) => traces.some((t) => t.best.length > 1);

function seedsText(seeds: number[]): string {
  const s = [...seeds].sort((a, b) => a - b);
  if (s.length > 1 && s.every((v, i) => i === 0 || v === s[i - 1] + 1)) return `${s[0]}–${s[s.length - 1]}`;
  return s.join(', ');
}

/* ───────────────────────── Tarjeta ───────────────────────── */

function IlsCard({ inst, ils }: { inst: HeurInstance; ils: ILSFile }) {
  const [mode, setMode] = useState<XMode>('log');
  const [detail, setDetail] = useState<Detail>('lectura');
  const runs = ils.runsSummary?.objectives?.length ?? 0;
  const p3 = gurobiFor(inst, 'TSPPD-H_3');
  const p3z = p3?.objectiveValue ?? null;
  const traces = useMemo(() => buildTraces(ils), [ils]);
  const hasTrace = hasTraceData(traces);
  const domain = useMemo(() => yDomain(traces, p3z), [traces, p3z]);
  const clipped = domain ? sum(traces.map((t) => t.local.filter((v) => v > domain.hi).length)) : 0;
  const showChart = hasTrace && domain !== null && traces.length > 0;
  // Sin traza solo existe la pestaña de corridas (evita una pestaña deshabilitada "activa" al cambiar de instancia).
  const shownDetail: Detail = hasTrace ? detail : 'corridas';
  // Semilla de la corrida reportada; params.seed es la semilla inicial (la de la corrida 1), no la de la mejor.
  const seed = ils.best?.seed;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">ILS · Algoritmo 4.2</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">Cómo converge la búsqueda</h3>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Instancia <span className="num text-zinc-300">{ils.instanceId}</span> · <span className="num text-zinc-300">{ils.numCustomers}</span>{' '}
            clientes
            {seed !== undefined && (
              <>
                {' '}
                · mejor corrida: semilla <span className="num text-zinc-300">{seed}</span>
              </>
            )}
          </p>
        </div>
        {showChart && (
          <Segmented<XMode>
            ariaLabel="Escala del eje de iteraciones"
            size="xs"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'log', label: 'Log', ariaLabel: 'Escala logarítmica', title: 'Expande las primeras iteraciones' },
              { value: 'lin', label: 'Lineal', ariaLabel: 'Escala lineal', title: 'Todas las iteraciones con el mismo ancho' },
            ]}
          />
        )}
      </div>

      <Headline ils={ils} p3={p3} />

      {showChart && domain ? (
        <>
          <ConvergenceChart
            traces={traces}
            domain={domain}
            p3z={p3z}
            mode={mode}
            bestDirection={ils.best.direction}
            revealKey={`${ils.filename ?? `${ils.numCustomers}-${ils.instanceId}`}-${mode}`}
          />
          <ChartLegend traces={traces} p3z={p3z} clipped={clipped} bestDirection={ils.best.direction} />
        </>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-[13px] text-zinc-500">
          <Terminal className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          El archivo no incluye la traza de las direcciones del ILS; vuelve a ejecutar el script para regenerarla.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-zinc-800/70 pt-4">
        <p className="eyebrow">Detalle</p>
        <Segmented<Detail>
          ariaLabel="Detalle del ILS"
          size="xs"
          value={shownDetail}
          onChange={setDetail}
          options={[
            { value: 'lectura', label: 'Lectura', disabled: !hasTrace, title: 'Qué muestra la traza' },
            { value: 'direcciones', label: 'Por dirección', disabled: !hasTrace, title: 'Indicadores de cada dirección del ciclo TSP' },
            { value: 'corridas', label: runs > 0 ? `${fmt(runs, 0)} corridas` : 'Corridas', title: 'Robustez entre semillas e ILS-1dir frente a ILS-2dir' },
          ]}
        />
      </div>
      <div className="min-w-0">
        {shownDetail === 'lectura' && domain && (
          <TraceInsights traces={traces} nRand={ils.params?.nRand} clipped={clipped} p3z={p3z} />
        )}
        {shownDetail === 'direcciones' && (
          <DirectionFacts traces={traces} n={ils.numCustomers} bestDirection={ils.best.direction} maxTries={ils.params?.maxRandomTries} />
        )}
        {shownDetail === 'corridas' && <RunsBlock ils={ils} p3z={p3z} />}
      </div>
      <Footnote ils={ils} directions={traces.length} />
    </SpotlightCard>
  );
}

/* ───────────────────────── Cabecera ───────────────────────── */

function Headline({ ils, p3 }: { ils: ILSFile; p3: TourCost | null }) {
  const b = ils.best;
  return (
    <div className="mt-4 border-y border-zinc-800/70 py-3">
      <p className="flex items-center gap-1.5 text-[11.5px] text-zinc-500">
        <MethodMark tone="ils" size={11} />Z de ILS-2dir · mejor de las dos direcciones: dir. <span className="num">{b.direction}</span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="num text-[30px] leading-none font-semibold tracking-tight text-zinc-50">{fmt(b.objectiveValue)}</p>
        <GapChip z={b.objectiveValue} p3z={p3?.objectiveValue ?? null} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] leading-5 text-zinc-400">
        <p>
          <span className="num text-zinc-200">{fmtKm(b.totalDistance)}</span> distancia +{' '}
          <span className="num text-zinc-200">{fmt(b.handlingCost)}</span> manipulación
        </p>
        {p3 && (
          <p>
            Gurobi P3: <span className="num text-zinc-200">{fmt(p3.objectiveValue)}</span>{' '}
            <span className="text-zinc-500">
              (<span className="num">{fmtKm(p3.totalDistance)}</span> + <span className="num">{fmt(p3.handlingCost)}</span>)
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function GapChip({ z, p3z }: { z: number; p3z: number | null }) {
  if (p3z === null) return <Chip tone="muted">sin Gurobi P3</Chip>;
  if (sameCost(z, p3z))
    return (
      <Chip tone="ok">
        <Check className="h-3 w-3" aria-hidden />= óptimo P3
      </Chip>
    );
  const g = relGap(z, p3z);
  return (
    <Chip tone={z < p3z ? 'ok' : 'neutral'}>
      {/* Sin Z* positivo la brecha relativa no existe: se muestra la diferencia absoluta. */}
      {g === null ? fmtDelta(z - p3z) : `${z > p3z ? '+' : '−'}${fmtPct(Math.abs(g), 2)}`} vs Z* P3
    </Chip>
  );
}

/* ───────────────────────── Gráfico de convergencia ───────────────────────── */

function xFraction(k: number, n: number, mode: XMode): number {
  if (n <= 0) return 0;
  return mode === 'log' ? Math.log1p(Math.max(0, k)) / Math.log1p(n) : k / n;
}

function xInverse(t: number, n: number, mode: XMode): number {
  return mode === 'log' ? Math.expm1(t * Math.log1p(n)) : t * n;
}

/** Marcas del eje x: 1-2-5 × 10^k en escala log, paso "limpio" en lineal; sin choques y con N al final. */
function xTicksOf(n: number, mode: XMode, xOf: (k: number) => number): number[] {
  const cand: number[] = [0];
  if (mode === 'log') {
    for (let p = 1; p <= n; p *= 10) for (const m of [1, 2, 5]) if (m * p <= n) cand.push(m * p);
  } else {
    const step = Math.max(1, Math.round(niceStep(n, 4)));
    for (let v = step; v <= n; v += step) cand.push(v);
  }
  if (cand[cand.length - 1] !== n) cand.push(n);
  const out: number[] = [];
  for (const c of cand) if (!out.length || xOf(c) - xOf(out[out.length - 1]) >= 26) out.push(c);
  if (out[out.length - 1] !== n) {
    if (out.length > 1 && xOf(n) - xOf(out[out.length - 1]) < 26) out.pop();
    out.push(n);
  }
  return out;
}

function yTicksOf({ lo, hi }: YDomain): number[] {
  const step = niceStep(hi - lo, 3);
  const out: number[] = [];
  for (let i = Math.ceil(lo / step - 1e-9); i * step <= hi + 1e-9; i++) out.push(Number((i * step).toFixed(10)));
  return out;
}

/** Escalón "después": el mejor costo cambia justo en la iteración que lo mejora. */
function stepPath(vals: number[], xOf: (k: number) => number, yOf: (v: number) => number): string {
  if (!vals.length) return '';
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(xOf(0))},${f(yOf(vals[0]))}`;
  for (let k = 1; k < vals.length; k++) if (vals[k] !== vals[k - 1]) d += `H${f(xOf(k))}V${f(yOf(vals[k]))}`;
  if (vals.length > 1) d += `H${f(xOf(vals.length - 1))}`;
  return d;
}

interface DotSet {
  key: number;
  style: DirStyle;
  inside: [number, number][];
  /** x de los óptimos locales que quedan sobre la escala (marcados en el borde superior). */
  above: number[];
}

interface Geom {
  xOf: (k: number) => number;
  yOf: (v: number) => number;
  xTicks: number[];
  yTicks: number[];
  lines: { key: number; d: string; style: DirStyle }[];
  dots: DotSet[];
}

function buildGeom(traces: Trace[], domain: YDomain, width: number, n: number, mode: XMode): Geom {
  const nx = Math.max(1, n);
  const innerW = Math.max(0, width - ML - MR);
  const xOf = (k: number) => ML + xFraction(k, nx, mode) * innerW;
  const yOf = (v: number) => TOP + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * PLOT_H;
  const lines = traces.map((t) => ({ key: t.dir.direction, d: stepPath(t.best, xOf, yOf), style: t.style }));
  const dots = traces.map((t): DotSet => {
    const seen = new Set<string>();
    const inside: [number, number][] = [];
    const above: number[] = [];
    t.local.forEach((v, i) => {
      const x = xOf(i + 1);
      const over = v > domain.hi;
      const y = over ? TOP : yOf(v);
      // Muchas iteraciones caen en el mismo píxel (traza plana): una sola marca por posición.
      const key = `${over ? 'o' : 'i'}${Math.round(x * 2)}:${Math.round(y * 2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (over) above.push(x);
      else inside.push([x, y]);
    });
    return { key: t.dir.direction, style: t.style, inside, above };
  });
  return { xOf, yOf, xTicks: xTicksOf(nx, mode, xOf), yTicks: yTicksOf(domain), lines, dots };
}

interface MarkLabel {
  key: number;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  text: string;
  color: string;
}

/** Etiquetas "D1 · it. k" junto a cada mejor: a la derecha del punto y apiladas si chocan. */
function placeLabels(marks: { key: number; x: number; y: number; text: string; color: string }[], width: number): MarkLabel[] {
  const placed: (MarkLabel & { x0: number; x1: number })[] = [];
  for (const m of [...marks].sort((a, b) => a.x - b.x)) {
    const w = m.text.length * CHAR_W;
    let anchor: 'start' | 'end' = 'start';
    let x = m.x + 7;
    if (x + w > width - MR) {
      anchor = 'end';
      x = m.x - 7;
    }
    const x0 = anchor === 'start' ? x : x - w;
    const x1 = x0 + w;
    const hits = (yy: number) => placed.some((p) => x0 < p.x1 + 4 && x1 > p.x0 - 4 && Math.abs(yy - p.y) < 13);
    let y = m.y - 8;
    for (let guard = 0; hits(y) && guard < 6; guard++) y -= 13;
    placed.push({ ...m, x, y: Math.max(TOP + 8, y), anchor, x0, x1 });
  }
  return placed;
}

/** Capa estática (puntos + escalones), memorizada para que el cursor no la vuelva a dibujar. */
const SeriesLayer = memo(function SeriesLayer({
  geom,
  clipId,
  revealKey,
  width,
  shown,
  reduce,
}: {
  geom: Geom;
  clipId: string;
  revealKey: string;
  width: number;
  shown: boolean;
  reduce: boolean;
}) {
  return (
    <>
      <defs>
        {/* Revelado de izquierda a derecha (respeta los trazos discontinuos, a diferencia de pathLength) */}
        <clipPath id={clipId}>
          <motion.rect
            key={revealKey}
            x={0}
            y={0}
            height={HEIGHT}
            initial={{ width: reduce ? width : 0 }}
            animate={{ width: shown || reduce ? width : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.4 }}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} aria-hidden>
        {geom.dots.map((ds) => (
          <g key={`d${ds.key}`}>
            {ds.inside.map(([x, y], i) =>
              ds.style.dash ? (
                <circle key={i} cx={x} cy={y} r={2.2} fill="none" stroke={ds.style.color} strokeOpacity={0.5} strokeWidth={1} />
              ) : (
                <circle key={i} cx={x} cy={y} r={1.9} fill={ds.style.color} fillOpacity={0.4} />
              ),
            )}
            {ds.above.map((x, i) => (
              <path key={`a${i}`} d={`M${x - 2.6},${TOP + 1.5}L${x},${TOP - 3}L${x + 2.6},${TOP + 1.5}Z`} fill={ds.style.color} fillOpacity={0.75} />
            ))}
          </g>
        ))}
        {geom.lines.map((l) => (
          <path
            key={`l${l.key}`}
            d={l.d}
            fill="none"
            stroke={l.style.color}
            strokeWidth={l.style.width}
            strokeDasharray={l.style.dash}
            strokeLinejoin="round"
            strokeLinecap={l.style.dash ? 'butt' : 'round'}
          />
        ))}
      </g>
    </>
  );
});

function ConvergenceChart({
  traces,
  domain,
  p3z,
  mode,
  bestDirection,
  revealKey,
}: {
  traces: Trace[];
  domain: YDomain;
  p3z: number | null;
  mode: XMode;
  bestDirection: number;
  revealKey: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const reduce = useReducedMotion() ?? false;
  const [hover, setHover] = useState<number | null>(null);
  const [kbdRaw, setKbd] = useState<number | null>(null);

  const N = Math.max(0, ...traces.map((t) => t.best.length - 1));
  // El gráfico no se remonta al cambiar de instancia: una iteración elegida antes puede quedar fuera de 0..N.
  const kbd = kbdRaw === null ? null : Math.min(kbdRaw, N);
  const geom = useMemo(() => buildGeom(traces, domain, width, N, mode), [traces, domain, width, N, mode]);
  const { xOf, yOf } = geom;
  const innerW = Math.max(0, width - ML - MR);
  const plotBottom = TOP + PLOT_H;
  const clipped = sum(traces.map((t) => t.local.filter((v) => v > domain.hi).length));

  const bestAt = (k: number): number | null => {
    const vs = traces.map((t) => t.best[k]).filter((v): v is number => typeof v === 'number');
    return vs.length ? Math.min(...vs) : null;
  };
  const active = hover !== null ? Math.min(hover, N) : kbd;
  const activeBest = active !== null ? bestAt(active) : null;
  const anchor = active !== null && activeBest !== null ? { x: xOf(active), y: yOf(activeBest) } : null;

  // Marcas del mejor de cada dirección (★ la que reporta ILS-2dir) y sus etiquetas.
  const marks = traces.map((t) => {
    const k = clamp(t.dir.bestIteration, 0, t.best.length - 1);
    return { t, k, x: xOf(k), y: yOf(t.best[k]), star: t.dir.direction === bestDirection };
  });
  const labels = placeLabels(
    marks.map((m) => ({ key: m.t.dir.direction, x: m.x, y: m.y, text: `${m.t.style.short} · it. ${fmt(m.k, 0)}`, color: m.t.style.color })),
    width,
  );
  const yRef = p3z !== null ? yOf(p3z) : null;
  const refLabelBelow = yRef !== null && yRef + 15 <= plotBottom - 3;

  const kFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const t = clamp((px - ML) / Math.max(1, innerW), 0, 1);
    const k0 = clamp(Math.floor(xInverse(t, Math.max(1, N), mode)), 0, N);
    const k1 = Math.min(N, k0 + 1);
    // Se elige la iteración más cercana en píxeles (en escala log los pasos no son uniformes).
    return Math.abs(xOf(k1) - px) < Math.abs(xOf(k0) - px) ? k1 : k0;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const i = kbd ?? 0;
    let next: number;
    if (e.key === 'ArrowRight') next = i + (e.shiftKey ? 10 : 1);
    else if (e.key === 'ArrowLeft') next = i - (e.shiftKey ? 10 : 1);
    else if (e.key === 'PageUp') next = i + 10;
    else if (e.key === 'PageDown') next = i - 10;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = N;
    else return;
    e.preventDefault();
    e.stopPropagation();
    setKbd(clamp(next, 0, N));
  };

  const readout =
    active === null
      ? ''
      : `${active === 0 ? 'Tour inicial' : `Iteración ${fmt(active, 0)}`}: ${traces
          .map((t) => {
            const b = t.best[active];
            const l = active > 0 ? t.local[active - 1] : undefined;
            return `dirección ${t.dir.direction}, mejor ${b === undefined ? 'sin datos' : fmt(b)}${l !== undefined ? `, óptimo local ${fmt(l)}` : ''}`;
          })
          .join('; ')}.`;

  const desc = [
    `Mejor costo acumulado del ILS por iteración, de 0 a ${fmt(N, 0)}, con el eje de iteraciones en escala ${mode === 'log' ? 'logarítmica' : 'lineal'}.`,
    ...traces.map(
      (t) =>
        `${t.style.label}: de ${fmt(t.best[0])} a ${fmt(t.best[t.best.length - 1])}, mejor en la iteración ${fmt(t.dir.bestIteration, 0)}.`,
    ),
    `Los puntos tenues son el óptimo local de cada iteración${
      clipped > 0 ? `; ${fmt(clipped, 0)} quedan fuera de escala y se marcan con triángulos en el borde superior` : ''
    }.`,
    p3z !== null ? `Línea de referencia: Z* de Gurobi P3 = ${fmt(p3z)}.` : '',
    'Flechas izquierda y derecha recorren las iteraciones; con Mayúsculas o Re Pág y Av Pág, de 10 en 10; Inicio y Fin van a los extremos.',
  ]
    .filter(Boolean)
    .join(' ');

  const bestHere = active !== null ? traces.filter((t) => t.dir.bestIteration === active).map((t) => t.style.short) : [];

  return (
    <div ref={wrapRef} className="relative mt-4 w-full" style={{ height: HEIGHT }} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          tabIndex={0}
          role="group"
          aria-roledescription="gráfico interactivo"
          aria-labelledby={`${uid}-t ${uid}-d`}
          className="block cursor-crosshair touch-pan-y overflow-visible rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-50/80 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-900"
          onPointerMove={(e) => setHover(kFromPointer(e))}
          onPointerDown={(e) => setHover(kFromPointer(e))}
          onMouseDown={(e) => e.preventDefault()}
          onFocus={() => setKbd((v) => v ?? 0)}
          onBlur={() => setKbd(null)}
          onKeyDown={onKey}
        >
          <title id={`${uid}-t`}>Convergencia del ILS por iteración</title>
          <desc id={`${uid}-d`}>{desc}</desc>

          {/* Rejilla y ejes */}
          <g aria-hidden>
            {geom.yTicks.map((t) => (
              <g key={t}>
                <line x1={ML} x2={width - MR} y1={yOf(t)} y2={yOf(t)} stroke={COLOR.grid} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={ML - 8} y={yOf(t) + 3.5} textAnchor="end" fill={TICK_TEXT} fontSize={10.5} className="num">
                  {fmtAuto(t, 2)}
                </text>
              </g>
            ))}
            <line x1={ML} x2={width - MR} y1={plotBottom + 0.5} y2={plotBottom + 0.5} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />
            {geom.xTicks.map((k) => (
              <g key={k}>
                <line x1={xOf(k)} x2={xOf(k)} y1={plotBottom} y2={plotBottom + 4} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />
                <text
                  x={xOf(k)}
                  y={plotBottom + 15}
                  textAnchor="middle"
                  fill={active === k ? COLOR.ink : TICK_TEXT}
                  fontWeight={active === k ? 600 : 400}
                  fontSize={10}
                  className="num"
                >
                  {fmt(k, 0)}
                </text>
              </g>
            ))}
            <text x={ML} y={plotBottom + 31} fill={COLOR.label} fontSize={10.5}>
              {mode === 'log' ? 'Iteración (escala logarítmica) →' : 'Iteración →'}
            </text>
          </g>

          {/* Referencia Z* Gurobi P3: banda tenue bajo las series (se ve como halo cuando coinciden) */}
          {yRef !== null && (
            <g aria-hidden>
              <line x1={ML} x2={width - MR} y1={yRef} y2={yRef} stroke={METHOD_COLOR.p3} strokeOpacity={0.16} strokeWidth={7} strokeLinecap="round" />
              <line x1={ML} x2={width - MR} y1={yRef} y2={yRef} stroke={METHOD_COLOR.p3} strokeOpacity={0.9} strokeWidth={1} strokeDasharray="2 3" />
            </g>
          )}

          <SeriesLayer geom={geom} clipId={`${uid}-clip`} revealKey={revealKey} width={width} shown={inView} reduce={reduce} />

          {yRef !== null && p3z !== null && (
            <text
              aria-hidden
              x={width - MR}
              y={refLabelBelow ? yRef + 15 : yRef - 7}
              textAnchor="end"
              fill={METHOD_COLOR.p3}
              fontSize={10.5}
              className="num"
              stroke={COLOR.surface}
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              Z* Gurobi P3 · {fmt(p3z)}
            </text>
          )}

          {/* Mejor de cada dirección */}
          <motion.g
            aria-hidden
            key={`m-${revealKey}`}
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: inView || reduce ? 1 : 0 }}
            transition={{ ...springSoft, delay: reduce ? 0 : 0.45 }}
          >
            {[...marks]
              .sort((a, b) => Number(a.star) - Number(b.star))
              .map((m) =>
                m.star ? (
                  <MethodMarkSvg key={m.t.dir.direction} tone="ils" x={m.x} y={m.y} r={4.4} />
                ) : (
                  <circle key={m.t.dir.direction} cx={m.x} cy={m.y} r={3.5} fill={m.t.style.color} stroke={COLOR.surface} strokeWidth={2} />
                ),
              )}
            {labels.map((l) => (
              <text
                key={l.key}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
                fill={l.color}
                fontSize={10.5}
                fontWeight={500}
                className="num"
                stroke={COLOR.surface}
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {l.text}
              </text>
            ))}
          </motion.g>

          {/* Cursor de exploración */}
          {active !== null && (
            <g aria-hidden pointerEvents="none">
              <line
                x1={xOf(active)}
                x2={xOf(active)}
                y1={TOP - 6}
                y2={plotBottom}
                stroke={COLOR.label}
                strokeOpacity={0.6}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              {active > 0 &&
                traces.map((t) => {
                  const v = t.local[active - 1];
                  if (v === undefined) return null;
                  return (
                    <circle
                      key={`lo${t.dir.direction}`}
                      cx={xOf(active)}
                      cy={v > domain.hi ? TOP : yOf(v)}
                      r={3}
                      fill={t.style.dash ? COLOR.surface : t.style.color}
                      stroke={t.style.color}
                      strokeWidth={1.5}
                    />
                  );
                })}
              {traces.map((t) => {
                const v = t.best[active];
                if (v === undefined) return null;
                return <circle key={`b${t.dir.direction}`} cx={xOf(active)} cy={yOf(v)} r={4} fill={t.style.color} stroke={COLOR.surface} strokeWidth={2} />;
              })}
            </g>
          )}
        </svg>
      )}

      <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={14} minTop={0} maxBottom={HEIGHT}>
        {active !== null && (
          <>
            <TipHeader aside={bestHere.length ? <span className="text-[10.5px] text-ils">mejor {bestHere.join(' · ')}</span> : undefined}>
              {active === 0 ? 'Tour inicial' : `Iteración ${fmt(active, 0)}`}
            </TipHeader>
            {traces.map((t) =>
              t.best[active] === undefined ? null : (
                <TipRow
                  key={`b${t.dir.direction}`}
                  color={t.style.color}
                  dashed={!!t.style.dash}
                  value={fmt(t.best[active])}
                  label={`mejor · dir. ${t.dir.direction}`}
                />
              ),
            )}
            {active > 0 &&
              traces.map((t) =>
                t.local[active - 1] === undefined ? null : (
                  <TipDotRow
                    key={`l${t.dir.direction}`}
                    color={t.style.color}
                    hollow={!!t.style.dash}
                    value={fmt(t.local[active - 1])}
                    label={`óptimo local · dir. ${t.dir.direction}`}
                  />
                ),
              )}
            {p3z !== null && activeBest !== null && (
              <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[11px] text-zinc-400">
                {sameCost(activeBest, p3z)
                  ? 'Igual al Z* de Gurobi P3'
                  : `${fmtDelta(activeBest - p3z)}${
                      relGap(activeBest, p3z) === null ? '' : ` (${activeBest > p3z ? '+' : '−'}${fmtPct(Math.abs(relGap(activeBest, p3z) ?? 0), 2)})`
                    } frente al Z* de Gurobi P3`}
              </p>
            )}
          </>
        )}
      </ChartTooltip>
      <span className="sr-only" aria-live="polite">
        {kbd !== null ? readout : ''}
      </span>
    </div>
  );
}

/** Fila del tooltip con clave de punto (óptimos locales), gemela de TipRow. */
function TipDotRow({ color, hollow, value, label }: { color: string; hollow: boolean; value: ReactNode; label: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-[1px] text-[12px] leading-5">
      <span aria-hidden className="flex w-3 shrink-0 justify-center">
        <span className="h-1.5 w-1.5 rounded-full" style={hollow ? { boxShadow: `inset 0 0 0 1px ${color}` } : { backgroundColor: color }} />
      </span>
      <span className="num font-medium text-zinc-50">{value}</span>
      <span className="text-zinc-400">{label}</span>
    </div>
  );
}

function ChartLegend({ traces, p3z, clipped, bestDirection }: { traces: Trace[]; p3z: number | null; clipped: number; bestDirection: number }) {
  const item = 'inline-flex items-center gap-1.5 text-[12px] text-zinc-400';
  // El punto sin estrella es el mejor de la dirección que NO reporta ILS-2dir (puede ser la 1 si gana la 2).
  const other = traces.find((t) => t.dir.direction !== bestDirection);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {traces.map((t) => (
        <LegendItem key={t.dir.direction} kind={t.style.dash ? 'dash' : 'line'} color={t.style.color}>
          {t.style.label}
        </LegendItem>
      ))}
      <span className={item}>
        <span aria-hidden className="inline-flex items-center gap-0.5">
          {traces.map((t) => (
            <span
              key={t.dir.direction}
              className="h-1.5 w-1.5 rounded-full"
              style={t.style.dash ? { boxShadow: `inset 0 0 0 1px ${t.style.color}` } : { backgroundColor: t.style.color }}
            />
          ))}
        </span>
        Óptimo local de cada iteración
      </span>
      {p3z !== null && (
        <LegendItem kind="dash" color={METHOD_COLOR.p3}>
          Z* Gurobi P3
        </LegendItem>
      )}
      <span className={item}>
        <MethodMark tone="ils" size={11} />
        Mejor ILS-2dir
      </span>
      {traces.length > 1 && other && (
        <span className={item}>
          <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-zinc-900" style={{ backgroundColor: other.style.color }} />
          Mejor de la otra dirección
        </span>
      )}
      {clipped > 0 && (
        <span className={item}>
          <svg aria-hidden width={8} height={8} viewBox="0 0 8 8">
            <path d="M0.5,7L4,1L7.5,7Z" fill={HEUR_COLOR.ils} />
          </svg>
          <span>
            <span className="num text-zinc-200">{fmt(clipped, 0)}</span> óptimos locales fuera de escala
          </span>
        </span>
      )}
    </div>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

/** Lectura calculada de la traza: qué hizo cada dirección y qué muestran los óptimos locales. */
function TraceInsights({ traces, nRand, clipped, p3z }: { traces: Trace[]; nRand: number | undefined; clipped: number; p3z: number | null }) {
  const items: ReactNode[] = [];

  for (const t of traces) {
    const d = t.dir;
    const start = t.best[0];
    const end = t.best[t.best.length - 1];
    const iters = t.best.length - 1;
    if (iters === 0) continue; // dirección sin traza
    const atRef = p3z !== null && sameCost(end, p3z) ? <>, que es el Z* de Gurobi P3</> : null;
    const name = <span className="text-zinc-100">{t.style.label}</span>;
    if (sameCost(start, end)) {
      items.push(
        <>
          {name}: parte en <Em>{fmt(start)}</Em>
          {atRef}
          {atRef && ','} y no mejora en {iters === 1 ? 'la única iteración' : <>las <Em>{fmt(iters, 0)}</Em> iteraciones</>}.
        </>,
      );
    } else {
      const rest = iters - d.bestIteration;
      items.push(
        <>
          {name}: baja de <Em>{fmt(start)}</Em> a <Em>{fmt(end)}</Em>
          {start > 0 && (
            <>
              {' '}
              (<Em>−{fmtPct((start - end) / start, 1)}</Em>)
            </>
          )}
          {atRef}
          {atRef && ','} con <Em>{fmt(d.improvements, 0)}</Em> {d.improvements === 1 ? 'mejora, en la iteración' : 'mejoras; la última en la iteración'}{' '}
          <Em>{fmt(d.bestIteration, 0)}</Em>
          {rest > 0 && (
            <>
              {' '}
              y las <Em>{fmt(rest, 0)}</Em> siguientes no mejoran
            </>
          )}
          .
        </>,
      );
    }
  }

  const total = sum(traces.map((t) => t.local.length));
  if (total > 0) {
    const repeat = sum(traces.map((t) => t.local.filter((v) => sameCost(v, t.best[t.best.length - 1])).length));
    const others = traces.flatMap((t) => t.local.filter((v) => !sameCost(v, t.best[t.best.length - 1])));
    const both = traces.length === 2 ? ' (ambas direcciones)' : '';
    items.push(
      repeat === total ? (
        <>
          Los <Em>{fmt(total, 0)}</Em> óptimos locales{both} tienen el mismo costo que el mejor de su dirección: tras cada perturbación
          {nRand !== undefined && (
            <>
              {' '}
              (N<sub>rand</sub> = <Em>{fmt(nRand, 0)}</Em>)
            </>
          )}
          , la búsqueda local termina en ese valor.
        </>
      ) : (
        <>
          <Em>{fmt(repeat, 0)}</Em> de <Em>{fmt(total, 0)}</Em> óptimos locales{both} igualan al mejor de su dirección;{' '}
          {sameCost(Math.min(...others), Math.max(...others)) ? (
            <>
              {others.length === 1 ? 'el otro vale' : 'los demás valen'} <Em>{fmt(Math.min(...others))}</Em>
            </>
          ) : (
            <>
              los demás van de <Em>{fmt(Math.min(...others))}</Em> a <Em>{fmt(Math.max(...others))}</Em>
            </>
          )}
          {clipped > 0 && (
            <>
              {' '}
              (<Em>{fmt(clipped, 0)}</Em> fuera de escala)
            </>
          )}
          .
        </>
      ),
    );
  }

  return (
    <div className="mt-3">
      <ol className="space-y-2">
        {items.map((node, i) => (
          <li key={i} className="flex gap-3 text-[12.5px] leading-relaxed text-pretty text-zinc-400">
            <span className="num mt-[1px] shrink-0 text-[11px] text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
            <span className="max-w-[65ch]">{node}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ───────────────────────── Indicadores por dirección ───────────────────────── */

function Val({ v, sub, strong }: { v: ReactNode; sub?: ReactNode; strong?: boolean }) {
  return (
    <>
      <span className={cn('num', strong ? 'font-medium text-zinc-50' : 'text-zinc-200')}>{v}</span>
      {sub !== undefined && <span className="num mt-0.5 block text-[11px] text-zinc-500">{sub}</span>}
    </>
  );
}

function RowLabel({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      {children}
      {sub !== undefined && <span className="mt-0.5 block text-[11px] text-zinc-500">{sub}</span>}
    </>
  );
}

function DirectionFacts({
  traces,
  n,
  bestDirection,
  maxTries,
}: {
  traces: Trace[];
  n: number;
  bestDirection: number;
  maxTries: number | undefined;
}) {
  const rows: { key: string; label: ReactNode; cell: (d: ILSDirection) => ReactNode }[] = [
    {
      key: 'init',
      label: <RowLabel sub="TSP + reubicación del depósito">Z inicial</RowLabel>,
      cell: (d) => <Val v={fmt(d.initial.objectiveValue)} sub={`${fmtKm(d.initial.totalDistance)} + ${fmt(d.initial.handlingCost)}`} />,
    },
    {
      key: 'shift',
      // depotShift es el desplazamiento k del ciclo (0 = sin rotar), no una posición 1..n del tour.
      label: <RowLabel sub="desplazamiento k (0 = sin rotar) · posiciones factibles">Rotación del depósito</RowLabel>,
      cell: (d) => <Val v={fmt(d.initial.depotShift, 0)} sub={`${fmt(d.initial.feasibleShifts, 0)}/${fmt(n, 0)} factibles`} />,
    },
    {
      key: 'best',
      label: <RowLabel sub="iteración · cambio frente al inicial">Mejor Z</RowLabel>,
      cell: (d) => (
        <Val
          strong
          v={fmt(d.best.objectiveValue)}
          sub={`it. ${fmt(d.bestIteration, 0)} · ${fmtDelta(d.best.objectiveValue - d.initial.objectiveValue)}`}
        />
      ),
    },
    { key: 'impr', label: 'Mejoras aceptadas', cell: (d) => <Val v={fmt(d.improvements, 0)} /> },
    { key: 'ls', label: 'Movimientos de búsqueda local', cell: (d) => <Val v={fmt(d.localSearchMoves, 0)} /> },
    { key: 'dp', label: <RowLabel sub="evaluación exacta">Llamadas a la DP</RowLabel>, cell: (d) => <Val v={fmt(d.dpCalls, 0)} /> },
    // neighborsScanned incluye los vecinos podados sin llamar a la DP.
    { key: 'nb', label: 'Vecinos examinados', cell: (d) => <Val v={fmt(d.neighborsScanned, 0)} /> },
    {
      key: 'disc',
      label: (
        <RowLabel sub={maxTries !== undefined ? `sin movimiento factible en ${fmt(maxTries, 0)} intentos` : 'sin movimiento factible'}>
          Perturbaciones omitidas
        </RowLabel>
      ),
      cell: (d) => <Val v={fmt(d.discardedRandomMoves, 0)} />,
    },
    { key: 'time', label: 'Tiempo', cell: (d) => <Val v={`${fmt(d.timeSec, 2)} s`} /> },
  ];

  return (
    <div className="mt-3">
      <div className="scrollbar-thin overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/30">
        <table className="w-full min-w-[300px] border-separate border-spacing-0 text-[12.5px]">
          <caption className="sr-only">Indicadores del ILS en cada dirección del ciclo TSP (corrida reportada)</caption>
          <thead>
            <tr className="text-[11px] text-zinc-400">
              <th scope="col" className="border-b border-zinc-800 px-3 py-2 text-left align-bottom font-medium">
                Indicador
              </th>
              {traces.map((t) => (
                <th key={t.dir.direction} scope="col" className="border-b border-zinc-800 px-3 py-2 text-right align-bottom font-medium">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <Swatch kind={t.style.dash ? 'dash' : 'line'} color={t.style.color} />
                    <span className="text-zinc-200">Dir. {t.dir.direction}</span>
                    {t.dir.direction === bestDirection && (
                      <>
                        <MethodMark tone="ils" size={10} />
                        <span className="sr-only">(la que reporta ILS-2dir)</span>
                      </>
                    )}
                  </span>
                  <span className="block font-normal text-zinc-500">{t.style.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>*]:border-b-0">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="border-b border-zinc-800/60 px-3 py-1.5 text-left align-top font-normal text-zinc-400">
                  {r.label}
                </th>
                {traces.map((t) => (
                  <td key={t.dir.direction} className="border-b border-zinc-800/60 px-3 py-1.5 text-right align-top whitespace-nowrap">
                    {r.cell(t.dir)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────────────────── Robustez entre corridas ───────────────────────── */

function RunsBlock({ ils, p3z }: { ils: ILSFile; p3z: number | null }) {
  const rs = ils.runsSummary;
  const objectives = rs?.objectives ?? [];
  const R = objectives.length;
  if (!rs || R === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-zinc-800 px-4 py-3.5 text-[13px] text-zinc-500">
        El archivo no incluye el resumen de corridas del ILS.
      </div>
    );
  }

  const seeds = rs.seeds ?? [];
  const oneDir = rs.oneDirObjectives ?? [];
  // Resumen del archivo; si falta algún campo se deriva de los Z por corrida.
  const zMin = Number.isFinite(rs.min) ? rs.min : Math.min(...objectives);
  const zMean = Number.isFinite(rs.mean) ? rs.mean : sum(objectives) / R;
  const zMax = Number.isFinite(rs.max) ? rs.max : Math.max(...objectives);
  const hits = Number.isFinite(rs.hitsBest) ? rs.hitsBest : objectives.filter((z) => z <= zMin + 1e-6).length;
  const minGap = p3z === null ? null : relGap(zMin, p3z);
  const pairs = objectives.map((z, i) => ({ z, one: oneDir[i] })).filter((p) => typeof p.one === 'number');
  const improved = pairs.filter((p) => p.z < p.one && !sameCost(p.z, p.one)).length;
  const mean1 = oneDir.length ? sum(oneDir) / oneDir.length : null;
  const oneZ = ils.oneDir?.objectiveValue;
  const twoZ = ils.best.objectiveValue;
  const minNote =
    p3z === null ? undefined : sameCost(zMin, p3z) ? (
      <span className="text-ok">= Z* P3</span>
    ) : minGap === null ? (
      `${fmtDelta(zMin - p3z)} vs Z* P3`
    ) : (
      `${zMin > p3z ? '+' : '−'}${fmtPct(Math.abs(minGap), 2)} vs Z* P3`
    );

  return (
    <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-100">Robustez entre corridas</p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            <span className="num text-zinc-300">{fmt(R, 0)}</span> corridas de ILS-2dir
            {seeds.length > 0 && (
              <>
                {' '}
                · semillas <span className="num text-zinc-300">{seedsText(seeds)}</span>
              </>
            )}
          </p>
        </div>
        <Chip tone={hits === R ? 'ok' : 'neutral'}>
          {hits === R && <Check className="h-3 w-3" aria-hidden />}
          {fmt(hits, 0)}/{fmt(R, 0)} en el mínimo
        </Chip>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <RunStat term="Mínimo" value={fmt(zMin)} note={minNote} />
        <RunStat term="Media" value={fmt(zMean)} />
        <RunStat term="Máximo" value={fmt(zMax)} />
      </dl>

      <RunsStrip objectives={objectives} seeds={seeds} p3z={p3z} mean={zMean} hits={hits} />

      <div className="mt-3 border-t border-zinc-800/70 pt-3">
        <p className="text-[12px] font-medium text-zinc-300">ILS-1dir frente a ILS-2dir</p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <RunStat
            term={
              <>
                ILS-1dir <span className="text-zinc-500">· solo dirección 1</span>
              </>
            }
            value={oneZ === undefined ? '—' : fmt(oneZ)}
            note={mean1 !== null ? `media ${fmt(mean1)}` : undefined}
          />
          <RunStat
            term={
              <>
                ILS-2dir <span className="text-zinc-500">· mejor de ambas</span>
              </>
            }
            value={fmt(twoZ)}
            note={`media ${fmt(zMean)}`}
          />
        </dl>
        <p className="mt-2.5 text-[12px] leading-relaxed text-pretty text-zinc-400">
          {oneZ !== undefined && !sameCost(oneZ, twoZ) && (
            <>
              En la corrida reportada, recorrer también el ciclo inverso ahorra <Em>{fmt(oneZ - twoZ)}</Em>.{' '}
            </>
          )}
          {pairs.length === 0 ? (
            'Sin valores de ILS-1dir por corrida.'
          ) : improved === 0 ? (
            <>
              La segunda dirección no mejora a ILS-1dir en ninguna de las <Em>{fmt(pairs.length, 0)}</Em> corridas.
            </>
          ) : (
            <>
              La segunda dirección mejora a ILS-1dir en <Em>{fmt(improved, 0)}</Em> de <Em>{fmt(pairs.length, 0)}</Em> corridas.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function RunStat({ term, value, note }: { term: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
      <dt className="truncate text-[11px] text-zinc-400">{term}</dt>
      <dd className="num mt-0.5 text-[15px] font-medium text-zinc-50">{value}</dd>
      {note !== undefined && <dd className="num mt-0.5 truncate text-[11px] text-zinc-500">{note}</dd>}
    </div>
  );
}

const STRIP_H = 86;
const STRIP_BASE = 62;
const STRIP_PAD = 16;

/** Tira de puntos de Wilkinson: el Z de cada corrida; los valores que coinciden se apilan. */
function RunsStrip({ objectives, seeds, p3z, mean, hits }: { objectives: number[]; seeds: number[]; p3z: number | null; mean: number; hits: number }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-40px' });

  const all = p3z !== null ? [...objectives, p3z] : objectives;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = hi - lo > 1e-9 ? (hi - lo) * 0.12 : Math.max(Math.abs(lo) * 0.002, 0.25);
  const d0 = lo - pad;
  const d1 = hi + pad;
  const innerW = Math.max(0, width - 2 * STRIP_PAD);
  const xOf = (v: number) => STRIP_PAD + ((v - d0) / (d1 - d0)) * innerW;

  // Corridas a menos de 6 px se apilan hacia arriba sobre la posición media del grupo.
  const sorted = objectives.map((v, i) => ({ v, seed: seeds[i], x: xOf(v) })).sort((a, b) => a.x - b.x);
  const stacks: { x: number; items: typeof sorted }[] = [];
  for (const o of sorted) {
    const last = stacks[stacks.length - 1];
    if (last && o.x - last.items[last.items.length - 1].x < 6) last.items.push(o);
    else stacks.push({ x: o.x, items: [o] });
  }
  for (const s of stacks) s.x = sum(s.items.map((o) => o.x)) / s.items.length;
  const maxStack = Math.max(1, ...stacks.map((s) => s.items.length));
  const step = Math.min(7, (STRIP_BASE - 22) / maxStack);
  const r = clamp(step / 2 + 0.5, 2, 3.2);

  const oMin = Math.min(...objectives);
  const oMax = Math.max(...objectives);
  const anchorAt = (x: number, w: number): 'start' | 'middle' | 'end' => (x - w / 2 < 0 ? 'start' : x + w / 2 > width ? 'end' : 'middle');
  const bottom: { x: number; text: string }[] = [];
  if (sameCost(oMin, oMax)) bottom.push({ x: xOf(oMin), text: objectives.length > 1 ? `${fmt(oMin)} en todas` : fmt(oMin) });
  else if (xOf(oMax) - xOf(oMin) < 90) bottom.push({ x: (xOf(oMin) + xOf(oMax)) / 2, text: `${fmt(oMin)} – ${fmt(oMax)}` });
  else bottom.push({ x: xOf(oMin), text: `mín ${fmt(oMin)}` }, { x: xOf(oMax), text: `máx ${fmt(oMax)}` });

  const label = `Z de ILS-2dir en ${fmt(objectives.length, 0)} corridas: mínimo ${fmt(oMin)}, media ${fmt(mean)}, máximo ${fmt(oMax)}; ${fmt(hits, 0)} alcanzan el mínimo${
    p3z !== null ? `. Referencia: Z* de Gurobi P3 ${fmt(p3z)}` : ''
  }.`;

  return (
    <div ref={wrapRef} className="relative mt-3 w-full" style={{ height: STRIP_H }}>
      {width > 0 && (
        <svg width={width} height={STRIP_H} viewBox={`0 0 ${width} ${STRIP_H}`} role="img" aria-label={label} className="block overflow-visible select-none">
          <line x1={STRIP_PAD} x2={width - STRIP_PAD} y1={STRIP_BASE + 0.5} y2={STRIP_BASE + 0.5} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />

          {p3z !== null && (
            <g>
              <line x1={xOf(p3z)} x2={xOf(p3z)} y1={13} y2={STRIP_BASE + 4} stroke={METHOD_COLOR.p3} strokeOpacity={0.9} strokeWidth={1} strokeDasharray="2 3" />
              <text x={xOf(p3z)} y={9} textAnchor={anchorAt(xOf(p3z), 44)} fill={METHOD_COLOR.p3} fontSize={10.5} className="num">
                Z* P3
              </text>
            </g>
          )}

          {stacks.map((s, si) => {
            const topY = STRIP_BASE - 4 - (s.items.length - 1) * step;
            const countRight = s.x + 34 < width;
            return (
              <g key={si}>
                {s.items.map((o, j) => (
                  <motion.g
                    key={`${o.seed}-${j}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                    transition={{ ...spring, delay: 0.05 + (si * 3 + j) * 0.03 }}
                  >
                    <circle cx={s.x} cy={STRIP_BASE - 4 - j * step} r={r} fill={HEUR_COLOR.ils} stroke={COLOR.surface} strokeWidth={1}>
                      <title>{`Semilla ${o.seed ?? '—'}: ${fmt(o.v)}`}</title>
                    </circle>
                  </motion.g>
                ))}
                {s.items.length > 1 && (
                  <text
                    x={countRight ? s.x + r + 5 : s.x - r - 5}
                    y={topY + 3.5}
                    textAnchor={countRight ? 'start' : 'end'}
                    fill={COLOR.label}
                    fontSize={10.5}
                    className="num"
                  >
                    ×{fmt(s.items.length, 0)}
                  </text>
                )}
              </g>
            );
          })}

          {bottom.map((b, i) => (
            <text key={i} x={b.x} y={STRIP_BASE + 16} textAnchor={anchorAt(b.x, b.text.length * CHAR_W)} fill={TICK_TEXT} fontSize={10.5} className="num">
              {b.text}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ───────────────────────── Parámetros y estados ───────────────────────── */

function Footnote({ ils, directions }: { ils: ILSFile; directions: number }) {
  const p = ils.params;
  const R = ils.runsSummary?.objectives?.length ?? 0;
  const N = (children: ReactNode) => <span className="num text-zinc-300">{children}</span>;
  return (
    <p className="mt-5 border-t border-zinc-800/70 pt-4 text-[11.5px] leading-relaxed text-pretty text-zinc-500">
      {p && (
        <>
          N<sub>iter</sub> = {N(fmt(p.nIter, 0))} · N<sub>rand</sub> = {N(fmt(p.nRand, 0))} (d·|V<sub>c</sub>| = {N(fmtAuto(p.d, 2))}·
          {N(ils.numCustomers)}, redondeado, mín. 1) · vecindario {p.neighborhood} · evaluación {p.evaluation} · tour inicial: {p.tspMethod} ·{' '}
        </>
      )}
      tiempo total {N(`${fmt(ils.timeSec, 2)} s`)}
      {R > 0 && (
        <>
          {' '}
          ({fmt(R, 0)} {R === 1 ? 'corrida' : 'corridas'} × {fmt(directions, 0)} {directions === 1 ? 'dirección' : 'direcciones'})
        </>
      )}
      . {HEUR_METHODS.ils.reference} · {HEUR_METHODS.ils.script}
      {ils.filename && (
        <>
          {' '}
          → <span className="font-mono text-zinc-400">{ils.filename}</span>
        </>
      )}
    </p>
  );
}

function EmptyCard({ inst }: { inst: HeurInstance | null }) {
  const cmd = inst
    ? `python notebooks/tsppd_h_alg42_ils.py --customers ${inst.numCustomers} --id ${inst.instanceId}`
    : 'python notebooks/tsppd_h_alg42_ils.py --customers 5 10 --all-ids';
  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <p className="eyebrow">ILS · Algoritmo 4.2</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">Cómo converge la búsqueda</h3>
      <div className="mt-5 flex flex-1 flex-col items-start justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-8">
        <Terminal className="h-4 w-4 text-zinc-400" aria-hidden />
        <p className="max-w-[60ch] text-[13px] leading-relaxed text-pretty text-zinc-400">
          {inst ? (
            <>
              No hay resultados del ILS para la instancia <span className="num text-zinc-200">{inst.instanceId}</span> de{' '}
              <span className="num text-zinc-200">{inst.numCustomers}</span> clientes.
            </>
          ) : (
            'No hay resultados de las heurísticas para la instancia cargada.'
          )}{' '}
          Genéralos desde la raíz del repositorio y pulsa recargar:
        </p>
        <code className="block w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-[12px] whitespace-pre text-zinc-200 scrollbar-thin">
          {cmd}
        </code>
      </div>
    </SpotlightCard>
  );
}
