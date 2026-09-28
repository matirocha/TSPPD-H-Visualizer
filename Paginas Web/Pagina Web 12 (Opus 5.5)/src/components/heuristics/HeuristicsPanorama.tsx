/**
 * Panorama · todas las instancias: costo de manipulación de cada método en todas las
 * instancias de un tamaño.
 *  - «Gráfico»: tira de puntos, una fila por instancia y x = manipulación desde 0. Marcas
 *    Gurobi General ○ · P1 ● · P2 ■ · P3 ◆ y el ILS ★; las que coinciden se apilan. El
 *    Algoritmo 2.1 + DP sobre la ruta de P3 se verifica en una columna propia: ✓ si
 *    reproduce la manipulación de Gurobi P3; si no, «!» y su ▲ se dibuja en la tira.
 *  - «Tabla»: los mismos valores con Z* de P3, Z del ILS y su brecha.
 * Debajo: medias por método, cuántas veces el ILS alcanza el óptimo, cuántas rutas
 * comparten los cuatro modelos y lecturas calculadas de los datos (nunca texto fijo).
 * Pulsar una fila (o Enter) abre la instancia en el simulador y en toda la sección.
 */
import { Fragment, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import { ChartScatter, Check, Route, Table2, TriangleAlert } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import { MODELS } from '../../lib/models';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtDelta, fmtPct } from '../../lib/format';
import { spring, springSnappy, springSoft, staggerChild, staggerParent, tapPress } from '../../lib/motion';
import { Segmented, SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, TipHeader, clamp, niceScale, useElementWidth } from '../analysis/chart';
import { joinEs } from '../analysis/compareData';
import { customerCountsOf, evalFor, gurobiFor, relGap, reversedTour, sameCost, sameTour, type HeurInstance } from './data';
import { HEUR_METHODS, METHOD_COLOR, MethodMark, MethodMarkSvg, type MethodTone } from './methods';

type View = 'chart' | 'table';

interface MethodDef {
  tone: MethodTone;
  label: string;
  short: string;
}

/** Orden canónico: Gurobi (General, P1, P2, P3), Algoritmo 2.1 sobre la ruta de P3 e ILS. */
const METHODS: MethodDef[] = [
  ...MODELS.map((m) => ({ tone: m.tone, label: m.label, short: m.short })),
  { tone: 'dp', label: `${HEUR_METHODS.dp.short} (ruta P3)`, short: HEUR_METHODS.dp.short },
  { tone: 'ils', label: HEUR_METHODS.ils.short, short: HEUR_METHODS.ils.short },
];

/* ───────────────────────── Datos por instancia ───────────────────────── */

interface Cost {
  /** Manipulación. */
  h: number;
  /** Objetivo (distancia + manipulación). */
  z: number;
}

type RouteRel = 'same' | 'reversed' | 'other';

interface Row {
  instanceId: number;
  /** Costo unitario h del archivo (para el subtítulo). */
  hUnit: number | null;
  cost: Partial<Record<MethodTone, Cost>>;
  minH: number | null;
  maxH: number | null;
  /** Algoritmo 2.1 sobre la ruta P3 = manipulación de Gurobi P3 (null: sin evaluación). */
  dpMatch: boolean | null;
  /** (Z ILS − Z* P3) / Z* P3. */
  ilsGap: number | null;
  ilsOptimal: boolean | null;
  ilsRoute: RouteRel | null;
  /** Los cuatro modelos Gurobi recorren exactamente la misma secuencia (null: falta alguno). */
  shared: boolean | null;
  /** Modelos cuya ruta difiere de la de P3, y cómo. */
  divergent: { short: string; rel: RouteRel }[];
}

const routeRel = (a: number[], ref: number[]): RouteRel => (sameTour(a, ref) ? 'same' : reversedTour(a, ref) ? 'reversed' : 'other');

function buildRows(instances: HeurInstance[], n: number): Row[] {
  return instances
    .filter((x) => x.numCustomers === n)
    .sort((a, b) => a.instanceId - b.instanceId)
    .map((inst) => {
      const cost: Partial<Record<MethodTone, Cost>> = {};
      // Una manipulación ausente o no finita cuenta como «sin datos» (no rompe escala, medias ni min/max)
      const put = (tone: MethodTone, h: number, z: number) => {
        if (Number.isFinite(h)) cost[tone] = { h, z };
      };
      const tours: { short: string; tour: number[] }[] = [];
      for (const m of MODELS) {
        const g = gurobiFor(inst, m.id);
        if (!g) continue;
        put(m.tone, g.handlingCost, g.objectiveValue);
        if (g.tour) tours.push({ short: m.short, tour: g.tour });
      }
      const p3Eval = evalFor(inst, 'TSPPD-H_3');
      if (p3Eval) put('dp', p3Eval.handlingDP, p3Eval.objectiveDP);
      const ils = inst.ils?.best ?? null;
      if (ils) put('ils', ils.handlingCost, ils.objectiveValue);

      const hs = METHODS.flatMap((m) => {
        const c = cost[m.tone];
        return c ? [c.h] : [];
      });
      const p3 = cost.p3;
      const p3Tour = gurobiFor(inst, 'TSPPD-H_3')?.tour ?? null;
      const refTour = p3Tour ?? tours[0]?.tour ?? null;
      return {
        instanceId: inst.instanceId,
        hUnit: inst.dp?.h ?? inst.ils?.h ?? null,
        cost,
        minH: hs.length ? Math.min(...hs) : null,
        maxH: hs.length ? Math.max(...hs) : null,
        dpMatch: p3Eval ? sameCost(p3Eval.handlingDP, p3Eval.gurobiHandling) : null,
        ilsGap: ils && p3 ? relGap(ils.objectiveValue, p3.z) : null,
        ilsOptimal: ils && p3 ? sameCost(ils.objectiveValue, p3.z) : null,
        ilsRoute: ils && p3Tour ? routeRel(ils.tour, p3Tour) : null,
        shared: tours.length === MODELS.length ? tours.every((t) => sameTour(t.tour, tours[0].tour)) : null,
        divergent: refTour ? tours.filter((t) => !sameTour(t.tour, refTour)).map((t) => ({ short: t.short, rel: routeRel(t.tour, refTour) })) : [],
      };
    });
}

interface SizeSummary {
  means: { m: MethodDef; mean: number | null; count: number }[];
  ils: { checks: number; optimal: number; maxGap: number | null; routeChecks: number; sameRoute: number; reversedRoute: number };
  routes: { checks: number; shared: number; divergentRows: Row[] };
  dp: { checks: number; matches: number; mismatchIds: number[] };
  general: { checks: number; below: number };
}

const generalBelowP3 = (r: Row) => {
  const g = r.cost.general;
  const p = r.cost.p3;
  return !!g && !!p && g.h < p.h && !sameCost(g.h, p.h);
};

function summarizeRows(rows: Row[]): SizeSummary {
  const means = METHODS.map((m) => {
    const xs = rows.flatMap((r) => {
      const c = r.cost[m.tone];
      return c ? [c.h] : [];
    });
    return { m, mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, count: xs.length };
  });
  const ilsRows = rows.filter((r) => r.ilsOptimal !== null);
  const gaps = rows.flatMap((r) => (r.ilsGap === null ? [] : [r.ilsGap]));
  const routeRows = rows.filter((r) => r.shared !== null);
  const dpRows = rows.filter((r) => r.dpMatch !== null);
  const genRows = rows.filter((r) => r.cost.general && r.cost.p3);
  return {
    means,
    ils: {
      checks: ilsRows.length,
      optimal: ilsRows.filter((r) => r.ilsOptimal).length,
      maxGap: gaps.length ? Math.max(...gaps) : null,
      routeChecks: rows.filter((r) => r.ilsRoute !== null).length,
      sameRoute: rows.filter((r) => r.ilsRoute === 'same').length,
      reversedRoute: rows.filter((r) => r.ilsRoute === 'reversed').length,
    },
    routes: { checks: routeRows.length, shared: routeRows.filter((r) => r.shared).length, divergentRows: routeRows.filter((r) => !r.shared) },
    dp: {
      checks: dpRows.length,
      matches: dpRows.filter((r) => r.dpMatch).length,
      mismatchIds: dpRows.filter((r) => !r.dpMatch).map((r) => r.instanceId),
    },
    general: { checks: genRows.length, below: genRows.filter(generalBelowP3).length },
  };
}

/* ───────────────────────── Textos derivados ───────────────────────── */

/** Brecha relativa con signo (0,00 % si es despreciable). */
const fmtGap = (g: number) => (Math.abs(g) < 5e-5 ? fmtPct(0, 2) : `${g > 0 ? '+' : '−'}${fmtPct(Math.abs(g), 2)}`);
const gapText = (r: Row) => (r.ilsGap === null ? '—' : fmtGap(r.ilsGap));

const divergentText = (r: Row) =>
  joinEs(r.divergent.map((d) => `${d.short} ${d.rel === 'reversed' ? 'en sentido inverso' : 'con otra ruta'}`));

function routeNote(r: Row): string {
  if (r.shared === null) return 'Faltan rutas Gurobi para comparar';
  if (r.shared) return 'Misma ruta en los cuatro modelos Gurobi';
  return `Rutas distintas: ${divergentText(r)}`;
}

/** Etiqueta accesible de una fila del gráfico: todos los valores, sin depender del tooltip. */
function rowLabel(r: Row, n: number): string {
  const parts = METHODS.map((m) => {
    const c = r.cost[m.tone];
    if (!c) return `${m.label} sin datos`;
    let s = `${m.label} ${fmt(c.h)} (Z ${fmt(c.z)})`;
    if (m.tone === 'dp' && r.dpMatch !== null) s += r.dpMatch ? ', igual a P3' : ', distinta de P3';
    if (m.tone === 'ils' && r.ilsGap !== null) s += `, brecha ${gapText(r)} frente al Z* de P3`;
    return s;
  });
  return `Instancia ${r.instanceId} de ${n} clientes. Manipulación: ${parts.join('; ')}. ${routeNote(r)}. Enter para abrirla en el simulador.`;
}

/* ───────────────────────── Tarjeta ───────────────────────── */

export function HeuristicsPanorama({ instances }: { instances: HeurInstance[] }) {
  const { meta, actions } = useCatalog();
  const counts = useMemo(() => customerCountsOf(instances), [instances]);
  // Estado derivado: sigue al tamaño cargado en el simulador, pero el usuario puede cambiarlo.
  const curN = meta?.numCustomers ?? counts[counts.length - 1] ?? 10;
  const [n, setN] = useState(curN);
  const [prevCur, setPrevCur] = useState(curN);
  if (curN !== prevCur) {
    setPrevCur(curN);
    setN(curN);
  }
  const [view, setView] = useState<View>('chart');

  const rows = useMemo(() => buildRows(instances, n), [instances, n]);
  const summary = useMemo(() => summarizeRows(rows), [rows]);
  const currentIdx = meta?.numCustomers === n ? rows.findIndex((r) => r.instanceId === meta?.instanceId) : -1;
  const hUnits = [...new Set(rows.flatMap((r) => (r.hUnit === null ? [] : [r.hUnit])))];
  const select = (id: number) => actions.selectInstance(n, id);
  const showCounts = counts.length > 1 || !counts.includes(n);

  return (
    <SpotlightCard className="@container flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Panorama</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">Manipulación en todas las instancias</h3>
          {rows.length > 0 && (
            <p className="mt-1 text-[12.5px] text-zinc-500">
              <span className="num text-zinc-300">{rows.length}</span> instancias de <span className="num text-zinc-300">{n}</span> clientes
              {hUnits.length === 1 && (
                <>
                  {' '}
                  · h = <span className="num text-zinc-300">{fmt(hUnits[0], 2)}</span>
                </>
              )}{' '}
              · pulsa una fila para abrirla
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showCounts && (
            <Segmented<number>
              ariaLabel="Cantidad de clientes"
              size="xs"
              value={n}
              onChange={setN}
              options={counts.map((c) => ({ value: c, label: `${c} clientes` }))}
            />
          )}
          <Segmented<View>
            ariaLabel="Vista del panorama"
            size="xs"
            value={view}
            onChange={setView}
            options={[
              {
                value: 'chart',
                label: (
                  <>
                    <ChartScatter className="h-3 w-3" aria-hidden />
                    Gráfico
                  </>
                ),
              },
              {
                value: 'table',
                label: (
                  <>
                    <Table2 className="h-3 w-3" aria-hidden />
                    Tabla
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>

      <Legend view={view} mismatch={summary.dp.mismatchIds.length > 0} />

      {rows.length === 0 ? (
        <p className="py-6 text-sm text-zinc-500">No hay instancias con {n} clientes.</p>
      ) : (
        // Con la tarjeta a lo ancho (≥ 64rem): gráfico o tabla a la izquierda, resumen y lecturas a la derecha.
        <div className="@5xl:grid @5xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] @5xl:items-start @5xl:gap-8">
          {/* Cambio de vista: la nueva entra con resorte (sin esperar la salida de la anterior). */}
          <motion.div key={view} className="min-w-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springSoft}>
            {view === 'chart' ? (
              <StripChart rows={rows} n={n} currentIdx={currentIdx} onSelect={select} />
            ) : (
              <HandlingTable rows={rows} n={n} currentIdx={currentIdx} onSelect={select} />
            )}
          </motion.div>
          <div className="@container min-w-0">
            <SummaryBlock s={summary} total={rows.length} />
            <Readings s={summary} />
          </div>
        </div>
      )}
    </SpotlightCard>
  );
}

function Legend({ view, mismatch }: { view: View; mismatch: boolean }) {
  const item = 'inline-flex items-center gap-1.5 text-[12px] text-zinc-400';
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-zinc-800/70 py-2.5" role="group" aria-label="Leyenda">
      {view === 'chart' ? (
        <>
          {METHODS.filter((m) => m.tone !== 'dp').map((m) => (
            <span key={m.tone} className={item}>
              <MethodMark tone={m.tone} />
              {m.label}
            </span>
          ))}
          <span className={item}>
            <MethodMark tone="dp" />
            {HEUR_METHODS.dp.short} en la ruta P3:
            <Check className="h-3 w-3 text-ok" aria-hidden />
            igual a P3{mismatch && ' · ! difiere'}
          </span>
        </>
      ) : (
        <>
          <span className={item}>
            <span className="num font-medium text-zinc-50">0,0</span> menor manipulación de la fila
          </span>
          <span className={item}>
            <Check className="h-3 w-3 text-ok" aria-hidden />
            {HEUR_METHODS.dp.short} reproduce P3
          </span>
          <span className={item}>Brecha = (Z ILS − Z* P3) / Z* P3</span>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Gráfico: tira de puntos ───────────────────────── */

const ROW_H = 32;
const TOP = 6;
const AXIS_H = 36;
const ML = 64;
/** Columna de verificación del Algoritmo 2.1 a la derecha del área de trazado. */
const CHECK_W = 46;
/** Espejos de --color-ok y del zinc-500 ajustado (AA) de index.css, para texto y marcas SVG. */
const OK = '#34d399';
const TEXT_MUTED = '#8b8b94';

interface ViewProps {
  rows: Row[];
  n: number;
  currentIdx: number;
  onSelect: (instanceId: number) => void;
}

function StripChart({ rows, n, currentIdx, onSelect }: ViewProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const rowRefs = useRef<(SVGGElement | null)[]>([]);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  const maxH = Math.max(0, ...rows.map((r) => r.maxH ?? 0));
  const scale = niceScale(Math.max(maxH, 0.5), 4);
  const plotR = Math.max(ML + 40, width - CHECK_W);
  const xOf = (h: number) => ML + (h / scale.max) * (plotR - ML);
  const checkX = width - CHECK_W / 2 + 6;
  const bodyH = rows.length * ROW_H;
  const height = TOP + bodyH + AXIS_H;
  const pointerIdx = hoverIdx ?? focusIdx;
  // Si cambian las filas (otro tamaño con menos instancias), un índice enfocado viejo no debe dejar el gráfico sin parada de Tab
  const tabStop = focusIdx !== null && focusIdx < rows.length ? focusIdx : currentIdx >= 0 ? currentIdx : 0;

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onSelect(rows[i].instanceId);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    rowRefs.current[next]?.focus();
  };

  const active = pointerIdx !== null ? (rows[pointerIdx] ?? null) : null;
  const anchor =
    active && pointerIdx !== null ? { x: clamp(xOf(active.maxH ?? 0) + 10, ML, width), y: TOP + pointerIdx * ROW_H + ROW_H / 2 } : null;

  return (
    <>
      <div ref={wrapRef} className="relative mt-3 w-full" style={{ height }} onPointerLeave={() => setHoverIdx(null)}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-labelledby={`${titleId} ${descId}`}
            className="block overflow-visible select-none"
          >
            <title id={titleId}>{`Costo de manipulación por método, instancias de ${n} clientes`}</title>
            <desc id={descId}>
              Una fila por instancia; cada marca es un método ubicado según su costo de manipulación, desde cero. La columna de la derecha indica si
              el Algoritmo 2.1 sobre la ruta de P3 reproduce la manipulación de Gurobi P3. Flechas arriba y abajo para recorrer, Enter para abrir
              la instancia en el simulador.
            </desc>

            {/* Rejilla vertical, eje y cabecera de la columna del Algoritmo 2.1 */}
            <g aria-hidden>
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={xOf(t)}
                    x2={xOf(t)}
                    y1={TOP}
                    y2={TOP + bodyH}
                    stroke={t === 0 ? COLOR.axis : COLOR.grid}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={xOf(t)}
                    y={TOP + bodyH + 15}
                    textAnchor={t === 0 ? 'start' : t === scale.max ? 'end' : 'middle'}
                    fill={TEXT_MUTED}
                    fontSize={10.5}
                    className="num"
                  >
                    {fmtAuto(t, 2)}
                  </text>
                </g>
              ))}
              <text x={ML} y={TOP + bodyH + 30} fill={COLOR.label} fontSize={10.5}>
                Costo de manipulación →
              </text>
              <line x1={plotR + 13} x2={plotR + 13} y1={TOP} y2={TOP + bodyH} stroke={COLOR.grid} strokeDasharray="2 3" />
              <MethodMarkSvg tone="dp" x={checkX - 15} y={TOP + bodyH + 11.2} r={3} />
              <text x={checkX - 7.5} y={TOP + bodyH + 15} fill={COLOR.label} fontSize={10.5}>
                = P3
              </text>
            </g>

            {rows.map((r, i) => (
              <StripRow
                key={r.instanceId}
                row={r}
                y={TOP + i * ROW_H}
                width={width}
                xOf={xOf}
                checkX={checkX}
                current={i === currentIdx}
                highlighted={i === pointerIdx}
                visible={inView}
                index={i}
              />
            ))}

            {/* Capa de interacción por fila (roving tabindex) */}
            <g>
              {rows.map((r, i) => (
                <g
                  key={r.instanceId}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  role="button"
                  tabIndex={i === tabStop ? 0 : -1}
                  aria-current={i === currentIdx ? 'true' : undefined}
                  aria-label={rowLabel(r, n)}
                  className="group cursor-pointer outline-none"
                  onPointerEnter={() => setHoverIdx(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(r.instanceId)}
                  onFocus={() => setFocusIdx(i)}
                  onBlur={() => setFocusIdx(null)}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  <rect x={0} y={TOP + i * ROW_H} width={width} height={ROW_H} fill="transparent" />
                  <rect
                    x={1}
                    y={TOP + i * ROW_H + 1}
                    width={Math.max(0, width - 2)}
                    height={ROW_H - 2}
                    rx={8}
                    fill="none"
                    stroke={COLOR.ink}
                    strokeOpacity={0.7}
                    strokeWidth={1.5}
                    className="opacity-0 transition-opacity group-focus-visible:opacity-100"
                  />
                </g>
              ))}
            </g>
          </svg>
        )}

        <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={8} minTop={-40} maxBottom={height} className="max-w-[290px]">
          {active && <RowTip row={active} n={n} />}
        </ChartTooltip>
      </div>

      <table className="sr-only">
        <caption>{`Manipulación y Z por método en las instancias de ${n} clientes`}</caption>
        <thead>
          <tr>
            <th scope="col">Instancia</th>
            {METHODS.map((m) => (
              <th key={m.tone} scope="col">
                {m.label}
              </th>
            ))}
            <th scope="col">Brecha del ILS frente a Z* de P3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.instanceId}>
              <th scope="row">{r.instanceId}</th>
              {METHODS.map((m) => {
                const c = r.cost[m.tone];
                const tail = m.tone === 'dp' && r.dpMatch !== null ? (r.dpMatch ? ', igual a P3' : ', distinta de P3') : '';
                return <td key={m.tone}>{c ? `${fmt(c.h)} (Z ${fmt(c.z)})${tail}` : 'sin datos'}</td>;
              })}
              <td>{gapText(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Fila de la tira: banda, rango, marcas (apiladas cuando coinciden) y verificación del Alg. 2.1. */
function StripRow({
  row,
  y,
  width,
  xOf,
  checkX,
  current,
  highlighted,
  visible,
  index,
}: {
  row: Row;
  y: number;
  width: number;
  xOf: (h: number) => number;
  checkX: number;
  current: boolean;
  highlighted: boolean;
  visible: boolean;
  index: number;
}) {
  const cy = y + ROW_H / 2;
  // El ▲ del Alg. 2.1 solo se dibuja si no coincide con P3 (si coincide, basta el ✓ de la columna).
  const marks = METHODS.flatMap((m) => {
    const c = row.cost[m.tone];
    if (!c || (m.tone === 'dp' && row.dpMatch !== false)) return [];
    return [{ tone: m.tone, x: xOf(c.h) }];
  }).sort((a, b) => a.x - b.x);

  // Apilado vertical de marcas coincidentes (separación mínima 9 px); el paso se comprime si son muchas.
  const placed: { tone: MethodTone; x: number; dy: number }[] = [];
  let group: typeof marks = [];
  const flush = () => {
    const step = group.length > 1 ? Math.min(7, (ROW_H - 12) / (group.length - 1)) : 0;
    group.forEach((g, j) => placed.push({ ...g, dy: (j - (group.length - 1) / 2) * step }));
    group = [];
  };
  for (const mk of marks) {
    if (group.length && mk.x - group[group.length - 1].x >= 9) flush();
    group.push(mk);
  }
  flush();

  const delay = visible ? 0.035 * index : 0;

  return (
    <g aria-hidden>
      {(current || highlighted) && (
        <rect x={0} y={y + 1} width={width} height={ROW_H - 2} rx={8} fill={current ? 'rgb(255 255 255 / 0.055)' : 'rgb(255 255 255 / 0.03)'} />
      )}
      {current && <rect x={0} y={y + 7} width={3} height={ROW_H - 14} rx={1.5} fill={COLOR.ink} />}
      <text x={12} y={cy + 3.5} fill={current ? COLOR.ink : COLOR.label} fontSize={11} fontWeight={current ? 600 : 400}>
        Inst. <tspan className="num">{row.instanceId}</tspan>
      </text>
      {row.minH !== null && row.maxH !== null ? (
        <line x1={xOf(row.minH)} x2={xOf(row.maxH)} y1={cy} y2={cy} stroke={current || highlighted ? COLOR.tick : COLOR.axis} strokeWidth={1} />
      ) : (
        <text x={xOf(0) + 6} y={cy + 3.5} fill={TEXT_MUTED} fontSize={10.5}>
          sin datos
        </text>
      )}
      {placed.map(({ tone, x, dy }, j) => (
        <motion.g
          key={tone}
          initial={{ opacity: 0, x: xOf(0), y: cy }}
          animate={visible ? { opacity: 1, x, y: cy + dy } : { opacity: 0, x: xOf(0), y: cy }}
          transition={{ ...spring, delay: delay + (visible ? 0.025 * j : 0) }}
        >
          <MethodMarkSvg tone={tone} x={0} y={0} r={4.5} />
        </motion.g>
      ))}
      <DpCheck match={row.dpMatch} x={checkX} y={cy} visible={visible} delay={delay + 0.2} />
    </g>
  );
}

/** ✓ si el Alg. 2.1 reproduce a P3, «!» si difiere, — si falta la evaluación. */
function DpCheck({ match, x, y, visible, delay }: { match: boolean | null; x: number; y: number; visible: boolean; delay: number }) {
  if (match === null)
    return (
      <text x={x} y={y + 3.5} textAnchor="middle" fill={TEXT_MUTED} fontSize={11}>
        —
      </text>
    );
  if (match)
    return (
      <motion.path
        d={`M${x - 4.5},${y + 0.2}L${x - 1.3},${y + 3.4}L${x + 4.8},${y - 3.6}`}
        fill="none"
        stroke={OK}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={visible ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ ...springSoft, delay: visible ? delay : 0 }}
      />
    );
  return (
    <g>
      <circle cx={x} cy={y} r={6.5} fill="rgb(251 113 133 / 0.14)" stroke={COLOR.handling} strokeWidth={1.25} />
      <text x={x} y={y + 3.6} textAnchor="middle" fill={COLOR.handling} fontSize={10} fontWeight={700}>
        !
      </text>
    </g>
  );
}

/** Contenido del tooltip: cada método con su manipulación y su Z. */
function RowTip({ row, n }: { row: Row; n: number }) {
  return (
    <>
      <TipHeader aside={<span className="font-mono text-[10.5px] text-zinc-500">manip. · Z</span>}>
        Instancia {row.instanceId} · {n} clientes
      </TipHeader>
      <div className="grid grid-cols-[12px_auto_minmax(0,1fr)_auto] items-center gap-x-2 text-[12px] leading-5">
        {METHODS.map((m) => {
          const c = row.cost[m.tone];
          const best = !!c && row.minH !== null && sameCost(c.h, row.minH);
          return (
            <Fragment key={m.tone}>
              <MethodMark tone={m.tone} size={10} />
              <span className={cn('num text-right font-medium', best ? 'text-zinc-50' : 'text-zinc-300')}>{c ? fmt(c.h) : '—'}</span>
              <span className="flex min-w-0 items-center gap-1 text-zinc-400">
                <span className="truncate">{m.label}</span>
                {m.tone === 'dp' && row.dpMatch === true && <Check className="h-3 w-3 shrink-0 text-ok" aria-hidden />}
                {m.tone === 'dp' && row.dpMatch === false && <span className="shrink-0 text-handling">≠ P3</span>}
              </span>
              <span className="num text-right text-zinc-500">{c ? fmt(c.z) : ''}</span>
            </Fragment>
          );
        })}
      </div>
      <div className="mt-1.5 space-y-0.5 border-t border-zinc-800 pt-1.5 text-[11px] leading-4 text-zinc-500">
        {row.ilsGap !== null && (
          <p>
            ILS: brecha <span className="num text-zinc-300">{gapText(row)}</span> frente al Z* de P3
          </p>
        )}
        <p>{routeNote(row)}</p>
        <p>Clic para abrir en el simulador</p>
      </div>
    </>
  );
}

/* ───────────────────────── Tabla ───────────────────────── */

const TD = 'num border-t border-zinc-800/60 px-2.5 py-1.5 text-right whitespace-nowrap';
const TH = 'px-2.5 pt-1 pb-2 text-right font-medium whitespace-nowrap';
const TH_GROUP = 'px-2.5 pt-2.5 pb-1 text-center font-mono text-[10px] font-medium tracking-[0.12em] whitespace-nowrap text-zinc-500 uppercase';

function HandlingTable({ rows, n, currentIdx, onSelect }: ViewProps) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Flechas entre los botones de fila (Tab sigue recorriéndolos en orden).
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else return;
    e.preventDefault();
    btnRefs.current[next]?.focus();
  };
  // Separadores de grupo: primera columna Gurobi (0) y primera heurística (4).
  const groupStart = (j: number) => j === 0 || j === 4;

  return (
    <motion.div layoutScroll className="scrollbar-thin mt-3 overflow-x-auto overflow-y-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/30">
      <table className="w-full min-w-[660px] border-separate border-spacing-0 text-[12.5px]">
        <caption className="sr-only">
          {`Costo de manipulación por método en las ${rows.length} instancias de ${n} clientes, con el Z* de Gurobi P3, el Z del ILS y su brecha relativa. El botón de cada fila abre la instancia en el simulador; flechas arriba y abajo para moverte entre filas.`}
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="pb-2 pl-3 pr-2 text-left align-bottom text-[11px] font-medium text-zinc-400">
              Inst.
            </th>
            <th scope="colgroup" colSpan={4} className={cn(TH_GROUP, 'border-l border-zinc-800/60')}>
              Gurobi · manipulación
            </th>
            <th scope="colgroup" colSpan={2} className={cn(TH_GROUP, 'border-l border-zinc-800/60')}>
              Erdoğan (2012) · manipulación
            </th>
            <th scope="colgroup" colSpan={3} className={cn(TH_GROUP, 'border-l border-zinc-800/60')}>
              Objetivo
            </th>
          </tr>
          <tr className="text-[11px] text-zinc-400">
            {METHODS.map((m, j) => (
              <th key={m.tone} scope="col" className={cn(TH, groupStart(j) && 'border-l border-zinc-800/60')}>
                <span className="inline-flex items-center justify-end gap-1.5">
                  <MethodMark tone={m.tone} size={10} />
                  {m.tone === 'dp' ? (
                    <>
                      {m.short} <span className="text-zinc-500">(ruta P3)</span>
                    </>
                  ) : (
                    m.short
                  )}
                </span>
              </th>
            ))}
            <th scope="col" className={cn(TH, 'border-l border-zinc-800/60')}>
              <span className="inline-flex items-center justify-end gap-1.5">
                <MethodMark tone="p3" size={10} />Z* P3
              </span>
            </th>
            <th scope="col" className={TH}>
              <span className="inline-flex items-center justify-end gap-1.5">
                <MethodMark tone="ils" size={10} />Z ILS
              </span>
            </th>
            <th scope="col" className={cn(TH, 'pr-3')} title="(Z ILS − Z* P3) / Z* P3">
              Brecha
            </th>
          </tr>
        </thead>
        <motion.tbody variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
          {rows.map((r, i) => {
            const current = i === currentIdx;
            const p3 = r.cost.p3;
            const ils = r.cost.ils;
            return (
              <motion.tr
                key={r.instanceId}
                variants={staggerChild}
                onClick={() => onSelect(r.instanceId)}
                className={cn(
                  'cursor-pointer transition-colors duration-150',
                  current ? '[&>*]:bg-zinc-800/40' : 'hover:[&>*]:bg-zinc-800/25',
                )}
              >
                <th scope="row" className="relative border-t border-zinc-800/60 py-1 pr-2 pl-3 text-left font-normal">
                  {current && (
                    <motion.span
                      layoutId="heur-panorama-current"
                      transition={spring}
                      aria-hidden
                      className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-zinc-50"
                    />
                  )}
                  <motion.button
                    ref={(el: HTMLButtonElement | null) => {
                      btnRefs.current[i] = el;
                    }}
                    type="button"
                    title="Abrir en el simulador"
                    aria-current={current ? 'true' : undefined}
                    whileTap={tapPress}
                    transition={springSnappy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(r.instanceId);
                    }}
                    onKeyDown={(e) => onKey(e, i)}
                    className={cn(
                      '-ml-1 inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[12.5px] whitespace-nowrap transition-colors duration-150',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-50',
                      current ? 'font-medium text-zinc-50' : 'text-zinc-300 hover:text-zinc-50',
                    )}
                  >
                    Inst. <span className="num">{r.instanceId}</span>
                  </motion.button>
                </th>
                {METHODS.map((m, j) => {
                  const c = r.cost[m.tone];
                  const best = !!c && r.minH !== null && sameCost(c.h, r.minH);
                  return (
                    <td
                      key={m.tone}
                      className={cn(TD, groupStart(j) && 'border-l', best ? 'font-medium text-zinc-50' : 'text-zinc-400')}
                    >
                      {c ? (
                        <span className="inline-flex items-center justify-end gap-1">
                          {m.tone === 'dp' && r.dpMatch === true && <Check className="h-3 w-3 text-ok" aria-hidden />}
                          {m.tone === 'dp' && r.dpMatch === false && <TriangleAlert className="h-3 w-3 text-handling" aria-hidden />}
                          {fmt(c.h)}
                          {best && <span className="sr-only"> (menor de la fila)</span>}
                          {m.tone === 'dp' && r.dpMatch !== null && (
                            <span className="sr-only">{r.dpMatch ? ' (igual a P3)' : ' (distinta de P3)'}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  );
                })}
                <td className={cn(TD, 'border-l text-zinc-300')}>{p3 ? fmt(p3.z) : '—'}</td>
                <td className={cn(TD, 'text-zinc-300')}>{ils ? fmt(ils.z) : '—'}</td>
                <td className={cn(TD, 'pr-3', r.ilsGap === null ? 'text-zinc-500' : r.ilsOptimal ? 'text-ok' : 'text-handling')}>{gapText(r)}</td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </motion.div>
  );
}

/* ───────────────────────── Resumen del tamaño ───────────────────────── */

function SummaryBlock({ s, total }: { s: SizeSummary; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const p3Mean = s.means.find((x) => x.m.tone === 'p3')?.mean ?? null;
  const top = Math.max(0, ...s.means.map((x) => x.mean ?? 0));

  const deltaVsP3 = (m: MethodDef, mean: number | null) => {
    if (m.tone === 'p3') return 'ref.';
    if (mean === null || p3Mean === null) return '—';
    if (sameCost(mean, p3Mean)) return '= P3';
    if (p3Mean <= 0) return '—';
    return `${fmtDelta(((mean - p3Mean) / p3Mean) * 100, 0)} %`;
  };

  const divergent = s.routes.divergentRows;
  const routeNoteText =
    s.routes.checks === 0
      ? 'Faltan soluciones Gurobi para comparar rutas.'
      : divergent.length === 0
        ? 'Entre los modelos Gurobi, toda la diferencia es de manipulación.'
        : `Difieren en Inst. ${joinEs(divergent.map((r) => `${r.instanceId} (${divergentText(r)})`))}${
            // Sin instancias de ruta común no hay «demás» de las que hablar
            s.routes.shared === 0 ? '.' : `; en ${s.routes.shared === 1 ? 'la otra' : 'las demás'}, toda la diferencia es de manipulación.`
          }`;

  let ilsNote: ReactNode = 'Sin resultados del ILS con referencia P3.';
  if (s.ils.checks > 0) {
    ilsNote = (
      <>
        Brecha máx. <span className="num text-zinc-200">{s.ils.maxGap === null ? '—' : fmtGap(s.ils.maxGap)}</span>
        {s.ils.routeChecks > 0 && (
          <>
            {' '}
            · misma ruta que P3 en <span className="num text-zinc-200">{s.ils.sameRoute}</span>/<span className="num">{s.ils.routeChecks}</span>
            {/* sameRoute excluye las invertidas: se cuentan aparte, no «dentro» de las iguales */}
            {s.ils.reversedRoute > 0 && (
              <>
                {' '}
                y en <span className="num text-zinc-200">{s.ils.reversedRoute}</span> más en sentido inverso
              </>
            )}
          </>
        )}
        .
      </>
    );
  }

  return (
    <div ref={ref} className="mt-5 grid grid-cols-1 gap-3 @xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 py-3.5">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]">
          <span className="text-zinc-300">Manipulación media</span>
          <span className="text-zinc-500">
            <span className="num">{total}</span> instancias · Δ frente a P3
          </span>
        </p>
        <ul className="mt-3 space-y-2">
          {s.means.map(({ m, mean, count }) => (
            <li key={m.tone} className="grid grid-cols-[6.25rem_minmax(1.5rem,1fr)_auto_3rem] items-center gap-x-2.5 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 text-zinc-300">
                <MethodMark tone={m.tone} size={11} />
                <span className="truncate">{m.tone === 'dp' ? HEUR_METHODS.dp.short : m.label}</span>
              </span>
              <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: METHOD_COLOR[m.tone] }}
                  initial={{ width: '0%' }}
                  animate={{ width: inView && mean !== null && top > 0 ? `${(mean / top) * 100}%` : '0%' }}
                  transition={spring}
                />
              </span>
              <span className="num text-right text-zinc-100">
                {fmt(mean)}
                {count > 0 && count < total && (
                  <span className="text-zinc-500">
                    {' '}
                    ({count}/{total})
                  </span>
                )}
              </span>
              <span className="num text-right text-zinc-500">{deltaVsP3(m, mean)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11.5px] text-zinc-500">{HEUR_METHODS.dp.short}: manipulación óptima de la Política 3 sobre la ruta de P3.</p>
      </div>

      <dl className="grid grid-cols-1 gap-3 @md:grid-cols-2 @xl:grid-cols-1">
        <MiniStat
          icon={<MethodMark tone="ils" size={12} />}
          term="ILS alcanza el Z* de P3"
          value={s.ils.optimal}
          of={s.ils.checks}
          unit="instancias"
          note={ilsNote}
        />
        <MiniStat
          icon={<Route className="h-3.5 w-3.5 text-zinc-300" aria-hidden />}
          term="Ruta común a los cuatro modelos"
          value={s.routes.shared}
          of={s.routes.checks}
          unit="instancias"
          note={routeNoteText}
        />
      </dl>
    </div>
  );
}

function MiniStat({ icon, term, value, of, unit, note }: { icon: ReactNode; term: string; value: number; of: number; unit: string; note: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        {icon}
        {term}
      </dt>
      <dd className="mt-1.5 flex items-baseline gap-1">
        <span className="num text-[22px] leading-none font-semibold tracking-tight text-zinc-50">{value}</span>
        <span className="num text-[13px] text-zinc-500">/{of}</span>
        <span className="ml-1 text-[12px] text-zinc-500">{unit}</span>
      </dd>
      <dd className="mt-1.5 text-[12px] leading-relaxed text-pretty text-zinc-400">{note}</dd>
    </div>
  );
}

/* ───────────────────────── Lectura de los datos ───────────────────────── */

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

/** «un 55 % menos» / «un 12 % más» según el signo del ahorro relativo. */
const lessMore = (rel: number) => (
  <>
    un <Em>{fmtPct(Math.abs(rel))}</Em> {rel >= 0 ? 'menos' : 'más'}
  </>
);

/** Lecturas calculadas: verificación del Alg. 2.1, General frente a P3 y P3 frente a P1/P2. */
function Readings({ s }: { s: SizeSummary }) {
  const mean = (tone: MethodTone) => s.means.find((x) => x.m.tone === tone)?.mean ?? null;
  const items: ReactNode[] = [];

  if (s.dp.checks > 0) {
    items.push(
      s.dp.matches === s.dp.checks ? (
        <>
          Sobre la ruta de P3, el <span className="text-zinc-100">{HEUR_METHODS.dp.label}</span> reproduce la manipulación de Gurobi P3 en{' '}
          {s.dp.checks === 1 ? (
            'la única instancia evaluada'
          ) : (
            <>
              las <Em>{s.dp.checks}</Em> instancias
            </>
          )}
          : la DP llega al mismo óptimo que el modelo exacto.
        </>
      ) : (
        <>
          El <span className="text-zinc-100">{HEUR_METHODS.dp.label}</span> reproduce la manipulación de Gurobi P3 en <Em>{s.dp.matches}</Em> de{' '}
          <Em>{s.dp.checks}</Em> rutas; difiere en Inst. <Em>{joinEs(s.dp.mismatchIds.map(String))}</Em>. Conviene revisar esos archivos.
        </>
      ),
    );
  }

  const g = mean('general');
  const p3 = mean('p3');
  if (s.general.checks > 0 && g !== null && p3 !== null) {
    items.push(
      s.general.below > 0 ? (
        <>
          El <span className="text-zinc-100">Modelo General</span> manipula menos que P3 en <Em>{s.general.below}</Em> de <Em>{s.general.checks}</Em>{' '}
          instancias (media <Em>{fmt(g)}</Em> frente a <Em>{fmt(p3)}</Em>). Es lo esperable: sin política puede acomodar la carga libremente, y la
          Política 3 (la que optimiza el Algoritmo 2.1) es una restricción.
        </>
      ) : (
        <>
          El <span className="text-zinc-100">Modelo General</span> no manipula menos que P3 en ninguna de las <Em>{s.general.checks}</Em> instancias:
          aquí la Política 3 no le resta margen.
        </>
      ),
    );
  }

  const p1 = mean('p1');
  const p2 = mean('p2');
  if (p3 !== null && p1 !== null && p2 !== null && p1 > 0 && p2 > 0) {
    const r1 = 1 - p3 / p1;
    const r2 = 1 - p3 / p2;
    items.push(
      <>
        En promedio, P3 manipula {lessMore(r1)} que P1 y {lessMore(r2)} que P2
        {r1 > 0 && r2 > 0 ? ': elegir la política cliente a cliente ahorra movimientos de carga frente a fijar una sola.' : '.'}
      </>,
    );
  }

  if (!items.length) return null;
  return (
    <div className="mt-5 border-t border-zinc-800/70 pt-4">
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
