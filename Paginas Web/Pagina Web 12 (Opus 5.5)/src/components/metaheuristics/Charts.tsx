/**
 * Gráficos de la sección «Metaheurísticas»: por |Vc|, el tiempo promedio (escala logarítmica) o la
 * desviación promedio respecto del Best del paper de los cinco métodos, con las cifras de
 * Erdoğan et al. (2012) como referencia.
 *
 * Codificación (nunca solo color):
 *  · color = familia (Dos fases ámbar, ILS azul, ITS fucsia) y forma = familia (▲ ● ■);
 *  · evaluación exacta = línea continua y marca rellena; heurística = línea discontinua y marca hueca;
 *  · paper: en «Tiempo», gris punteado con la forma de su familia (solo ILS e ITS exactos, Tabla 2);
 *    en «Desviación», el color del método, tenue y punteado, sobre las mismas instancias.
 *  · punto atenuado: a ese |Vc| aún le faltan instancias.
 * Dibujado a mano con las piezas de analysis/chart, como TimeChart.
 */
import { Fragment, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useInView } from 'motion/react';
import type { MetaDirection, MetaMethod, PaperFile } from '../../types/metaheuristics';
import { fmt } from '../../lib/format';
import { springSoft } from '../../lib/motion';
import { Segmented, SpotlightCard, Switch } from '../ui';
import { COLOR, ChartTooltip, TipHeader, clamp, niceStep, useElementWidth } from '../analysis/chart';
import { CardHead } from '../benchmark/shared';
import { fmtPctValue, fmtSec } from '../benchmark/format';
import { META_METHODS, summarizeByN, type InstanceRow, type NSummary } from './aggregate';
import { META_INFO, PAPER_COLOR, methodColor, methodDash } from './labels';
import { MetaMark, MetaMarkSvg, methodHollow, methodShape } from './shared';
import { hFor, hLabel } from './export';

/* ───────────────────────── Leyenda ───────────────────────── */

/** Métodos con tiempo publicado por |Vc| en el paper (Tabla 2). */
const PAPER_TIME_METHODS: MetaMethod[] = ['ils-exact', 'its-exact'];

/** Clave de leyenda: tramo de línea con la marca al centro. */
function SeriesKey({
  method,
  paper = false,
  faint = false,
}: {
  method: MetaMethod;
  /** Gris punteado del paper (vista «Tiempo»). */
  paper?: boolean;
  /** Color del método, tenue y punteado (paper en la vista «Desviación»). */
  faint?: boolean;
}) {
  const color = paper ? PAPER_COLOR : methodColor(method);
  const dash = paper || faint ? '1.5 3.5' : methodDash(method);
  return (
    <svg aria-hidden width={26} height={12} viewBox="0 0 26 12" className="shrink-0 overflow-visible">
      <line
        x1={1.5}
        x2={24.5}
        y1={6}
        y2={6}
        stroke={color}
        strokeWidth={paper || faint ? 1.5 : 2}
        strokeDasharray={dash}
        strokeLinecap="round"
        opacity={faint ? 0.6 : 1}
      />
      {!faint && (
        <MetaMarkSvg shape={methodShape(method)} color={color} hollow={!paper && methodHollow(method)} x={13} y={6} r={3.6} />
      )}
    </svg>
  );
}

/* ───────────────────────── Datos ───────────────────────── */

/** Vista del gráfico: tiempo promedio o desviación promedio vs Best. */
export type MetaChartView = 'time' | 'dev';
type View = MetaChartView;

interface Pt {
  i: number;
  n: number;
  v: number;
  /** Instancias con resultado / instancias del |Vc|. */
  done: number;
  total: number;
  partial: boolean;
}

interface Series {
  key: string;
  method: MetaMethod;
  source: 'ours' | 'paper';
  pts: (Pt | null)[];
}

const finitePos = (v: number | null): v is number => v !== null && Number.isFinite(v);

function buildSeries(groups: NSummary[], view: View, showPaper: boolean): { ours: Series[]; paper: Series[] } {
  const ours = META_METHODS.map(
    (m): Series => ({
      key: m,
      method: m,
      source: 'ours',
      pts: groups.map((g, i) => {
        const s = g.methods[m];
        const v = view === 'time' ? s.timeSec : s.devPct;
        if (!finitePos(v) || (view === 'time' && v <= 0)) return null;
        return { i, n: g.n, v, done: s.done, total: g.instances, partial: s.done < g.instances };
      }),
    }),
  );
  if (!showPaper) return { ours, paper: [] };
  const paper =
    view === 'time'
      ? PAPER_TIME_METHODS.map(
          (m): Series => ({
            key: `paper-${m}`,
            method: m,
            source: 'paper',
            pts: groups.map((g, i) => {
              const v = g.methods[m].paperTimeSec;
              return finitePos(v) && v > 0 ? { i, n: g.n, v, done: g.instances, total: g.instances, partial: false } : null;
            }),
          }),
        )
      : META_METHODS.map(
          (m): Series => ({
            key: `paper-${m}`,
            method: m,
            source: 'paper',
            pts: groups.map((g, i) => {
              const s = g.methods[m];
              const v = s.paperDevPct;
              return finitePos(v) ? { i, n: g.n, v, done: s.done, total: g.instances, partial: s.done < g.instances } : null;
            }),
          }),
        );
  return { ours, paper };
}

/* ───────────────────────── Escalas ───────────────────────── */

const HEIGHT = 300;
const TOP = 28;
const BOTTOM = 34;
const ML = 48;
const MR = 12;
const PAD_X = 16;
const PLOT_H = HEIGHT - TOP - BOTTOM;

/** Tick de segundos: 0,01 · 0,1 · 1 · 10 · 100 · 1.000. */
function secTick(v: number): string {
  if (v >= 1) return fmt(v, 0);
  return fmt(v, Math.min(6, Math.max(1, Math.ceil(-Math.log10(v) - 1e-9))));
}

interface YScale {
  ticks: number[];
  y: (v: number) => number;
  label: (v: number) => string;
  /** Línea de referencia más marcada (0 % en la desviación). */
  zero: number | null;
}

function logScale(values: number[]): YScale {
  const min = values.length ? Math.min(...values) : 0.01;
  const max = values.length ? Math.max(...values) : 1000;
  const loExp = Math.min(-2, Math.floor(Math.log10(min) + 1e-9));
  const hiExp = Math.max(3, Math.ceil(Math.log10(max) - 1e-9));
  const ticks: number[] = [];
  for (let e = loExp; e <= hiExp; e++) ticks.push(10 ** e);
  const lo = 10 ** loExp;
  return {
    ticks,
    y: (v) => TOP + PLOT_H * (1 - (Math.log10(Math.max(v, lo)) - loExp) / (hiExp - loExp)),
    label: secTick,
    zero: null,
  };
}

function linearScale(values: number[]): YScale {
  const lo0 = Math.min(0, ...values);
  const hi0 = Math.max(0.5, ...values);
  const step = niceStep(hi0 - lo0, 4);
  const hi = Math.max(step, Math.ceil(hi0 / step - 1e-9) * step);
  // Bajo 0 % (bajo el Best del paper) solo el margen necesario: no se fuerza un tramo entero de rejilla.
  const lo = lo0 < 0 ? Math.max(Math.floor(lo0 / step + 1e-9) * step, lo0 - 0.06 * (hi - lo0)) : 0;
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + step * 1e-6; k++) ticks.push(Number((k * step).toFixed(10)));
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return {
    ticks,
    y: (v) => TOP + PLOT_H * (1 - (v - lo) / (hi - lo)),
    label: (v) => fmtPctValue(v, dec),
    zero: lo < 0 ? 0 : null,
  };
}

/* ───────────────────────── Textos ───────────────────────── */

const valueText = (view: View, v: number | null) => (v === null ? '—' : view === 'time' ? `${fmtSec(v)} s` : fmtPctValue(v, 2));

function trendText(se: Series, view: View): string | null {
  const pts = se.pts.filter((p): p is Pt => p !== null);
  if (!pts.length) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const name = se.source === 'paper' ? `${META_INFO[se.method].label} del paper` : META_INFO[se.method].label;
  if (a === b) return `${name}: ${valueText(view, a.v)} con |Vc| = ${a.n}`;
  return `${name}: de ${valueText(view, a.v)} con |Vc| = ${a.n} a ${valueText(view, b.v)} con |Vc| = ${b.n}`;
}

/* ───────────────────────── Componente ───────────────────────── */

/** Direcciones del gráfico (y de los hallazgos, que comparten la elección). */
const DIRECTIONS: { value: MetaDirection; label: string; title: string }[] = [
  { value: '1dir', label: '1dir', title: 'Una dirección: corrida desde el tour TSP' },
  { value: '2dir', label: '2dir', title: 'Dos direcciones: la mejor de las corridas desde el tour TSP y desde el tour invertido' },
];

export function MetaCharts({
  rows,
  paper,
  dir,
  onDir,
  defaultView = 'time',
}: {
  rows: InstanceRow[];
  paper: PaperFile | null;
  dir: MetaDirection;
  /** Cambia la dirección del gráfico y de los hallazgos. */
  onDir: (d: MetaDirection) => void;
  /** Vista inicial: «Tiempo» (por defecto) o «Desviación». */
  defaultView?: MetaChartView;
}) {
  const uid = useId();
  const [view, setView] = useState<View>(defaultView);
  const [showPaper, setShowPaper] = useState(false);
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hover, setHover] = useState<number | null>(null);
  const [kbd, setKbd] = useState<number | null>(null);

  const groups = useMemo(() => summarizeByN(rows, dir, paper, 'done'), [rows, dir, paper]);
  const hasPaper = !!paper;
  const { ours, paper: paperSeries } = useMemo(() => buildSeries(groups, view, showPaper && hasPaper), [groups, view, showPaper, hasPaper]);
  const all = useMemo(() => [...ours, ...paperSeries], [ours, paperSeries]);

  const values = all.flatMap((se) => se.pts.flatMap((p) => (p ? [p.v] : [])));
  const oursCount = ours.reduce((a, se) => a + se.pts.filter(Boolean).length, 0);
  const scale = view === 'time' ? logScale(values) : linearScale(values);

  const ns = groups.map((g) => g.n);
  const innerW = Math.max(0, width - ML - MR);
  const span = Math.max(0, innerW - 2 * PAD_X);
  const colW = ns.length > 1 ? span / (ns.length - 1) : span;
  const xOf = (i: number) => ML + PAD_X + (ns.length > 1 ? i * colW : span / 2);
  // Separación horizontal mínima entre métodos en un mismo |Vc| (el paper va alineado con su método).
  const dodge = clamp(colW / 22, 0, 3.5);
  const dx = (m: MetaMethod) => (META_METHODS.indexOf(m) - (META_METHODS.length - 1) / 2) * dodge;

  const active = hover ?? kbd;
  const anchor = active !== null ? { x: xOf(active), y: TOP + PLOT_H / 2 } : null;

  const idxFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (ns.length <= 1) return 0;
    return clamp(Math.round((e.clientX - r.left - ML - PAD_X) / Math.max(1, colW)), 0, ns.length - 1);
  };
  const lastWithData = () => {
    for (let i = ns.length - 1; i >= 0; i--) if (all.some((se) => se.pts[i])) return i;
    return ns.length - 1;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const last = ns.length - 1;
    const i = kbd ?? lastWithData();
    let next = i;
    if (e.key === 'ArrowRight') next = Math.min(last, i + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') {
      setKbd(null);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    setKbd(next);
  };

  /** Tramos entre puntos consecutivos con dato, separados en completos y con instancias pendientes. */
  const pathsOf = (se: Series) => {
    const xy = (p: Pt) => `${(xOf(p.i) + dx(se.method)).toFixed(2)},${scale.y(p.v).toFixed(2)}`;
    let full = '';
    let partial = '';
    for (let j = 1; j < se.pts.length; j++) {
      const a = se.pts[j - 1];
      const b = se.pts[j];
      if (!a || !b) continue;
      const seg = `M${xy(a)}L${xy(b)}`;
      if (a.partial || b.partial) partial += seg;
      else full += seg;
    }
    return { full, partial };
  };
  const anyPartial = ours.some((se) => se.pts.some((p) => p?.partial));
  const paperShown = paperSeries.some((se) => se.pts.some(Boolean));

  const viewLabel = view === 'time' ? 'Tiempo promedio' : 'Desviación promedio respecto del Best del paper';
  const summary = (() => {
    const parts = all.map((se) => trendText(se, view)).filter((t): t is string => t !== null);
    const head = `${viewLabel} por |Vc| con ${dir}${view === 'time' ? ', escala logarítmica' : ''}.`;
    return parts.length ? `${head} ${parts.join('; ')}.` : `${head} Aún sin datos.`;
  })();

  const paperCell = (g: NSummary, m: MetaMethod): number | null => {
    if (!hasPaper) return null;
    if (view === 'time') return PAPER_TIME_METHODS.includes(m) ? g.methods[m].paperTimeSec : null;
    return g.methods[m].paperDevPct;
  };
  const oursCell = (g: NSummary, m: MetaMethod) => (view === 'time' ? g.methods[m].timeSec : g.methods[m].devPct);

  const readout =
    kbd !== null && groups[kbd]
      ? `|Vc| = ${ns[kbd]}: ` +
        META_METHODS.map((m) => {
          const g = groups[kbd];
          const p = showPaper ? paperCell(g, m) : null;
          const approx = view === 'time' && dir === '2dir' ? 'aprox. ' : '';
          return `${META_INFO[m].label} ${valueText(view, oursCell(g, m))}${p !== null ? `, paper ${approx}${valueText(view, p)}` : ''}`;
        }).join('; ')
      : '';

  const paperTimeNote = dir === '2dir' ? 'Tabla 2 ×2, estimado' : 'Tabla 2';
  const emptyText =
    view === 'dev' && !hasPaper
      ? 'Sin las cifras del paper no hay Best con que calcular la desviación.'
      : `Aún no hay resultados con ${dir}${view === 'dev' ? ' para calcular la desviación' : ''}.`;

  const descId = `${uid}-desc`;
  const showEndLabels = view === 'time' && width >= 420;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <CardHead
        eyebrow={
          <>
            Por tamaño · <span className="num normal-case">{dir}</span>
          </>
        }
        title={view === 'time' ? 'Tiempo promedio por |Vc|' : 'Desviación promedio respecto del Best del paper'}
        note={
          view === 'time'
            ? 'Segundos por instancia, escala logarítmica.'
            : '(Z − Best) / Best · 100, con Best = mejor solución conocida del paper.'
        }
        actions={
          <>
            <Segmented<MetaDirection>
              ariaLabel="Dirección del tour del gráfico y los hallazgos"
              size="xs"
              value={dir}
              onChange={(d) => {
                onDir(d);
                setHover(null);
              }}
              options={DIRECTIONS.map((d) => ({ value: d.value, label: d.label, ariaLabel: d.title, title: d.title }))}
            />
            <Segmented
              ariaLabel="Métrica del gráfico"
              size="xs"
              value={view}
              onChange={(v) => {
                setView(v);
                setHover(null);
              }}
              options={[
                { value: 'time', label: 'Tiempo' },
                { value: 'dev', label: 'Desviación' },
              ]}
            />
            {hasPaper && <Switch checked={showPaper} onChange={setShowPaper} label="Paper" title="Mostrar las cifras del paper" />}
          </>
        }
      />

      <div ref={wrapRef} className="relative mt-5 w-full" style={{ height: HEIGHT }} onPointerLeave={() => setHover(null)}>
        {values.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-zinc-800 px-6 text-center text-[13px] text-pretty text-zinc-500">
            {emptyText}
          </div>
        ) : (
          width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              role="img"
              tabIndex={0}
              aria-label={summary}
              aria-describedby={descId}
              className="block cursor-crosshair touch-pan-y overflow-visible rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-50/80 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-900"
              onPointerMove={(e) => setHover(idxFromPointer(e))}
              onPointerDown={(e) => setHover(idxFromPointer(e))}
              onFocus={() => setKbd((v) => v ?? lastWithData())}
              onBlur={() => setKbd(null)}
              onKeyDown={onKey}
            >
              <desc id={descId}>
                Flechas izquierda y derecha para recorrer los tamaños; la tabla de datos sigue al gráfico.
              </desc>

              {/* Rejilla y ejes */}
              <g aria-hidden>
                {scale.ticks.map((t) => {
                  const y = Math.round(scale.y(t)) + 0.5;
                  const isZero = scale.zero !== null && Math.abs(t - scale.zero) < 1e-9;
                  return (
                    <g key={t}>
                      <line
                        x1={ML}
                        x2={width - MR}
                        y1={y}
                        y2={y}
                        stroke={isZero ? COLOR.axis : COLOR.grid}
                        strokeWidth={1}
                        shapeRendering="crispEdges"
                      />
                      <text x={ML - 8} y={y + 3.5} textAnchor="end" fill={COLOR.tick} fontSize={10.5} className="num">
                        {scale.label(t)}
                      </text>
                    </g>
                  );
                })}
                <line x1={ML} x2={width - MR} y1={TOP + PLOT_H + 0.5} y2={TOP + PLOT_H + 0.5} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={0} y={TOP - 14} fill={COLOR.label} fontSize={10.5}>
                  {view === 'time' ? 'segundos · escala log' : 'desviación vs Best (%)'}
                </text>
                {ns.map((n, i) => (
                  <text
                    key={n}
                    x={xOf(i)}
                    y={TOP + PLOT_H + 18}
                    textAnchor="middle"
                    fill={i === active ? COLOR.ink : COLOR.tick}
                    fontWeight={i === active ? 600 : 400}
                    fontSize={10.5}
                    className="num"
                  >
                    {n}
                  </text>
                ))}
                <text x={width - MR} y={HEIGHT - 1} textAnchor="end" fill={COLOR.label} fontSize={10.5}>
                  clientes |Vc|
                </text>
              </g>

              {/* Crosshair */}
              {active !== null && (
                <line
                  aria-hidden
                  x1={Math.round(xOf(active)) + 0.5}
                  x2={Math.round(xOf(active)) + 0.5}
                  y1={TOP - 4}
                  y2={TOP + PLOT_H}
                  stroke={COLOR.label}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              )}

              {/* Series: se vuelven a trazar al cambiar de vista, dirección o paper. */}
              <g key={`${view}-${dir}-${showPaper ? 1 : 0}`} aria-hidden>
                {/* Paper primero (debajo de lo nuestro) */}
                {paperSeries.map((se, k) => {
                  const { full, partial } = pathsOf(se);
                  const color = view === 'time' ? PAPER_COLOR : methodColor(se.method);
                  const baseOpacity = view === 'time' ? 0.85 : 0.5;
                  return (
                    <motion.g
                      key={se.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: inView ? 1 : 0 }}
                      transition={{ ...springSoft, delay: 0.1 + k * 0.04 }}
                    >
                      {full && (
                        <path d={full} fill="none" stroke={color} strokeOpacity={baseOpacity} strokeWidth={1.5} strokeDasharray="1.5 3.5" strokeLinecap="round" />
                      )}
                      {partial && (
                        <path
                          d={partial}
                          fill="none"
                          stroke={color}
                          strokeOpacity={baseOpacity * 0.6}
                          strokeWidth={1.5}
                          strokeDasharray="1.5 3.5"
                          strokeLinecap="round"
                        />
                      )}
                      {se.pts.map((p) => {
                        if (!p) return null;
                        const x = xOf(p.i) + dx(se.method);
                        const y = scale.y(p.v);
                        if (view === 'time')
                          return (
                            <MetaMarkSvg key={p.i} shape={methodShape(se.method)} color={PAPER_COLOR} x={x} y={y} r={p.i === active ? 4 : 3.4} />
                          );
                        return <circle key={p.i} cx={x} cy={y} r={p.i === active ? 2.6 : 2} fill={color} opacity={p.partial ? 0.35 : 0.6} />;
                      })}
                    </motion.g>
                  );
                })}

                {ours.map((se, k) => {
                  const { full, partial } = pathsOf(se);
                  const color = methodColor(se.method);
                  const dash = methodDash(se.method);
                  return (
                    <g key={se.key}>
                      {full &&
                        (dash ? (
                          // pathLength reescribe stroke-dasharray: el discontinuo aparece por opacidad.
                          <motion.path
                            d={full}
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            strokeDasharray={dash}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: inView ? 0.9 : 0 }}
                            transition={{ ...springSoft, delay: 0.15 + k * 0.05 }}
                          />
                        ) : (
                          <motion.path
                            d={full}
                            fill="none"
                            stroke={color}
                            strokeOpacity={0.9}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: inView ? 1 : 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.2, delay: k * 0.05 }}
                          />
                        ))}
                      {partial && (
                        <motion.path
                          d={partial}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray={dash}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: inView ? 0.4 : 0 }}
                          transition={{ ...springSoft, delay: 0.2 + k * 0.05 }}
                        />
                      )}
                    </g>
                  );
                })}
                {ours.map((se, k) => (
                  <motion.g
                    key={`${se.key}-pts`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: inView ? 1 : 0 }}
                    transition={{ ...springSoft, delay: 0.15 + k * 0.05 }}
                  >
                    {se.pts.map((p) =>
                      p ? (
                        <g key={p.i} opacity={p.partial ? 0.5 : 1}>
                          <MetaMarkSvg
                            shape={methodShape(se.method)}
                            color={methodColor(se.method)}
                            hollow={methodHollow(se.method)}
                            x={xOf(p.i) + dx(se.method)}
                            y={scale.y(p.v)}
                            r={p.i === active ? 5 : 4.2}
                          />
                        </g>
                      ) : null,
                    )}
                  </motion.g>
                ))}

                {/* Rótulos directos de las líneas del paper (solo tiempo: dos líneas grises que la leyenda no distingue por color) */}
                {showEndLabels &&
                  paperSeries.map((se) => {
                    const last = [...se.pts].reverse().find((p): p is Pt => p !== null);
                    if (!last) return null;
                    const x = xOf(last.i) + dx(se.method);
                    const y = scale.y(last.v);
                    const above = se.method === 'ils-exact';
                    return (
                      <text
                        key={`${se.key}-label`}
                        x={x - 8}
                        y={above ? y - 9 : y + 15}
                        textAnchor="end"
                        fill={COLOR.label}
                        fontSize={10.5}
                        stroke={COLOR.surface}
                        strokeWidth={3}
                        paintOrder="stroke"
                        strokeLinejoin="round"
                      >
                        paper · {META_INFO[se.method].short}
                      </text>
                    );
                  })}
              </g>
            </svg>
          )
        )}

        <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={16} minTop={0} maxBottom={HEIGHT} className="max-w-[300px]">
          {active !== null && groups[active] && (
            <TooltipBody g={groups[active]} view={view} dir={dir} paperCell={paperCell} oursCell={oursCell} hasPaper={hasPaper && showPaper} />
          )}
        </ChartTooltip>
        <span className="sr-only" aria-live="polite">
          {readout}
        </span>
      </div>

      {/* Leyenda: lo nuestro y lo del paper por separado */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Nuestro</span>
          {META_METHODS.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400" title={META_INFO[m].title}>
              <SeriesKey method={m} />
              {META_INFO[m].label}
            </span>
          ))}
        </div>
        {hasPaper && showPaper && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Paper</span>
            {view === 'time' ? (
              PAPER_TIME_METHODS.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400"
                  title="Otra máquina (C, Core 2 Quad 2,83 GHz): compara razones, no segundos. Los heurísticos no tienen tiempo publicado por |Vc|."
                >
                  <SeriesKey method={m} paper />
                  {META_INFO[m].label} <span className="text-zinc-500">({paperTimeNote})</span>
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
                <span className="inline-flex items-center gap-0.5">
                  {(['twophase', 'ils-exact', 'its-exact'] as const).map((m) => (
                    <SeriesKey key={m} method={m} faint />
                  ))}
                </span>
                punteado tenue, mismo color
              </span>
            )}
          </div>
        )}
        {(anyPartial || (paperShown && oursCount === 0)) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {anyPartial && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
                <svg aria-hidden width={12} height={12} viewBox="0 0 12 12" className="shrink-0 overflow-visible">
                  <circle cx={6} cy={6} r={4} fill={COLOR.label} opacity={0.5} />
                </svg>
                atenuado: |Vc| incompleto
              </span>
            )}
            {paperShown && oursCount === 0 && <span className="text-[12px] text-zinc-500">Aún sin resultados con {dir}.</span>}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>
          {viewLabel} por |Vc| con {dir}
          {view === 'time' ? ', en segundos' : ', en porcentaje'}; nuestro resultado y el del paper
        </caption>
        <thead>
          <tr>
            <th scope="col">|Vc|</th>
            {META_METHODS.map((m) => (
              <Fragment key={m}>
                <th scope="col">{META_INFO[m].label}</th>
                <th scope="col">{META_INFO[m].label}, paper</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.n}>
              <th scope="row">{g.n}</th>
              {META_METHODS.map((m) => {
                const s = g.methods[m];
                const v = oursCell(g, m);
                const p = paperCell(g, m);
                return (
                  <Fragment key={m}>
                    <td>
                      {v === null ? 'sin datos' : valueText(view, v)}
                      {s.done > 0 && s.done < g.instances ? ` (${s.done} de ${g.instances} instancias)` : ''}
                    </td>
                    <td>{p === null ? 'no publicado' : `${valueText(view, p)}${view === 'time' && dir === '2dir' ? ' (estimado)' : ''}`}</td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </SpotlightCard>
  );
}

function TooltipBody({
  g,
  view,
  dir,
  paperCell,
  oursCell,
  hasPaper,
}: {
  g: NSummary;
  view: View;
  dir: MetaDirection;
  paperCell: (g: NSummary, m: MetaMethod) => number | null;
  oursCell: (g: NSummary, m: MetaMethod) => number | null;
  hasPaper: boolean;
}) {
  const anyPartial = META_METHODS.some((m) => g.methods[m].done < g.instances);
  // Mismo h y formato que el resumen y el detalle: el de los registros o, sin ellos, el de las Tablas 8–9.
  const h = hFor(g.n, g.h);
  return (
    <>
      <TipHeader aside={h !== null ? <span className="num text-[11px] text-zinc-500">h = {hLabel(h)}</span> : undefined}>
        |Vc| = {g.n} · {dir}
      </TipHeader>
      <div className="grid grid-cols-[auto_auto_auto_auto_auto] items-center gap-x-2.5 text-[12px] leading-5">
        <span />
        <span />
        <span className="text-right text-[10.5px] text-zinc-500">nuestro</span>
        <span className="text-right text-[10.5px] text-zinc-500">{hasPaper ? 'paper' : ''}</span>
        <span className="text-right text-[10.5px] text-zinc-500">{anyPartial ? 'inst.' : ''}</span>
        {META_METHODS.map((m) => {
          const s = g.methods[m];
          const v = oursCell(g, m);
          const p = hasPaper ? paperCell(g, m) : null;
          return (
            <Fragment key={m}>
              <MetaMark method={m} size={10} />
              <span className="whitespace-nowrap text-zinc-300">{META_INFO[m].short}</span>
              <span className="num text-right font-medium whitespace-nowrap text-zinc-50">{valueText(view, v)}</span>
              <span className="num text-right whitespace-nowrap text-zinc-400">
                {hasPaper ? (p === null ? '—' : `${view === 'time' && dir === '2dir' ? '≈ ' : ''}${valueText(view, p)}`) : ''}
              </span>
              <span className="num text-right text-[11px] whitespace-nowrap text-zinc-500">
                {anyPartial ? `${s.done}/${g.instances}` : ''}
              </span>
            </Fragment>
          );
        })}
      </div>
      {hasPaper && (
        <p className="mt-1.5 max-w-[34ch] border-t border-zinc-800 pt-1.5 text-[11px] leading-snug text-zinc-500">
          {view === 'time'
            ? `Paper: Tabla 2, solo exactos${dir === '2dir' ? ' (2dir ≈ 2 × 1dir)' : ''}; otra máquina y otro lenguaje.`
            : 'Paper: Tablas 8–9, mismo método y dirección sobre las mismas instancias.'}
        </p>
      )}
    </>
  );
}
