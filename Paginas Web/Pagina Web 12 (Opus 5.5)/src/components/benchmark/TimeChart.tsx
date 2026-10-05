/**
 * Tiempo medio por método frente a N (escala logarítmica), para el h elegido. Una serie por
 * método con su marca (○ ● ■ ◆ ▲ ★) y una línea punteada en el límite de tiempo de Gurobi.
 * Dos avisos que no alteran la forma de la marca (la del Modelo General ya es hueca):
 *  · una flecha ↑ sobre el punto si alguna ejecución terminada no fue óptima (el promedio es una
 *    cota inferior: «≥», como en la tabla);
 *  · punto atenuado y tramo de línea discontinuo si al grupo le faltan ejecuciones (datos parciales).
 * Dibujado a mano, como CostCurve, con las piezas de analysis/chart.
 */
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useInView } from 'motion/react';
import type { BenchMethod } from '../../types/benchmark';
import { fmt } from '../../lib/format';
import { springSoft } from '../../lib/motion';
import { SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, LegendItem, TipHeader, clamp, useElementWidth } from '../analysis/chart';
import { METHOD_COLOR, MethodMark, MethodMarkSvg } from '../heuristics/methods';
import { isGurobiMethod, METHOD_ORDER, type GroupStats, type MethodStats } from './aggregate';
import { fmtSec } from './format';
import { BENCH_INFO } from './labels';
import { CardHead, hText } from './shared';

const HEIGHT = 300;
const TOP = 30;
const BOTTOM = 34;
const ML = 52;
const MR = 14;
const PAD_X = 20;
const PLOT_H = HEIGHT - TOP - BOTTOM;

interface Pt {
  method: BenchMethod;
  i: number;
  n: number;
  v: number;
  s: MethodStats;
  /** Alguna ejecución terminada no fue óptima (Gurobi): el promedio es una cota inferior («≥»). */
  censored: boolean;
  /** Faltan ejecuciones de ese grupo: el promedio es provisional. */
  partial: boolean;
}

/** Etiqueta de un tick en segundos (0,001 · 1 · 1.800). */
function tickText(v: number): string {
  if (v >= 1) return fmt(v, 0);
  const dec = Math.min(6, Math.max(1, Math.ceil(-Math.log10(v) - 1e-9)));
  return fmt(v, dec);
}

/**
 * Flecha ↑ sobre una marca: el promedio incluye ejecuciones cortadas por el límite, así que el
 * tiempo real es mayor («≥»). Va aparte de la marca para no cambiar la forma de ningún método.
 */
function CensorArrow({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const y0 = y - r * 1.5 - 1.5;
  const y1 = y0 - 8;
  return (
    <path
      d={`M${x},${y0}L${x},${y1}M${x - 2.6},${y1 + 2.8}L${x},${y1}L${x + 2.6},${y1 + 2.8}`}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Estado corto de un método en un N: óptimas (Gurobi) o aciertos de la referencia P3 (ILS). */
function statusLine(s: MethodStats): string {
  if (isGurobiMethod(s.method)) return `${s.optimal}/${s.expected} ópt.`;
  if (s.method === 'ils' && s.withProvenRef > 0) return `= P3 ${s.hitsProvenRef}/${s.withProvenRef}`;
  return '';
}

const pendingOf = (s: MethodStats) => Math.max(0, s.expected - s.done);
/** Grupo en que el método no se ejecuta (alto costo computacional). */
const notRunIn = (s: MethodStats) => s.expected === 0 && s.skipped > 0;

export function TimeChart({ groups, h, timeLimit }: { groups: GroupStats[]; h: number; timeLimit: number | null }) {
  const uid = useId();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hover, setHover] = useState<number | null>(null);
  const [kbd, setKbd] = useState<number | null>(null);

  const ns = useMemo(() => groups.map((g) => g.numCustomers), [groups]);
  const series = useMemo(
    () =>
      METHOD_ORDER.map((m) => ({
        method: m,
        pts: groups.map((g, i): Pt | null => {
          const s = g.methods[m];
          const v = s.meanTimeSec;
          if (v === null || !Number.isFinite(v)) return null;
          const finished = s.done - s.errors;
          return { method: m, i, n: g.numCustomers, v, s, censored: isGurobiMethod(m) && s.optimal < finished, partial: s.done < s.expected };
        }),
      })),
    [groups],
  );

  const values = series.flatMap((se) => se.pts.flatMap((p) => (p && p.v > 0 ? [p.v] : [])));
  const minV = values.length ? Math.min(...values) : 1e-3;
  const maxV = values.length ? Math.max(...values) : 1;
  const loExp = Math.min(-3, Math.floor(Math.log10(minV)));
  const lo = 10 ** loExp;
  const topVal = Math.max(timeLimit ?? 10 ** Math.ceil(Math.log10(Math.max(maxV, 1))), maxV);
  const topLog = Math.log10(topVal) + 0.14;
  const yOf = (v: number) => TOP + PLOT_H * (1 - (Math.log10(Math.max(v, lo)) - loExp) / (topLog - loExp));

  const ticks: number[] = [];
  for (let e = loExp; e <= Math.floor(Math.log10(topVal) + 1e-9); e++) ticks.push(10 ** e);
  const limitY = timeLimit !== null ? yOf(timeLimit) : null;
  const shownTicks = limitY === null ? ticks : ticks.filter((t) => Math.abs(yOf(t) - limitY) >= 14 || Math.abs(t - (timeLimit as number)) < 1e-9);
  if (timeLimit !== null && !shownTicks.some((t) => Math.abs(t - timeLimit) < 1e-9)) shownTicks.push(timeLimit);

  const innerW = Math.max(0, width - ML - MR);
  const span = Math.max(0, innerW - 2 * PAD_X);
  const colW = ns.length > 1 ? span / (ns.length - 1) : span;
  const xOf = (i: number) => ML + PAD_X + (ns.length > 1 ? i * colW : span / 2);
  const dodge = clamp(colW / 24, 0, 4);
  const dx = (k: number) => (k - (METHOD_ORDER.length - 1) / 2) * dodge;

  const active = hover ?? kbd;
  const anchor = active !== null ? { x: xOf(active), y: TOP + PLOT_H / 2 } : null;

  const idxFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (ns.length <= 1) return 0;
    return clamp(Math.round((px - ML - PAD_X) / Math.max(1, colW)), 0, ns.length - 1);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const last = ns.length - 1;
    const i = kbd ?? 0;
    let next = i;
    if (e.key === 'ArrowRight') next = Math.min(last, i + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    e.stopPropagation();
    setKbd(next);
  };

  /** Tramos entre puntos consecutivos: continuos si ambos grupos están completos, discontinuos si no. */
  const pathsOf = (pts: (Pt | null)[], k: number) => {
    const xy = (p: Pt) => `${(xOf(p.i) + dx(k)).toFixed(2)},${yOf(p.v).toFixed(2)}`;
    let full = '';
    let partial = '';
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1];
      const b = pts[j];
      if (!a || !b) continue;
      const seg = `M${xy(a)}L${xy(b)}`;
      if (a.partial || b.partial) partial += seg;
      else full += seg;
    }
    return { full, partial };
  };
  const anyCensored = series.some((se) => se.pts.some((p) => p?.censored));
  const anyPartial = series.some((se) => se.pts.some((p) => p?.partial));

  const readout =
    kbd !== null && groups[kbd]
      ? `N = ${ns[kbd]}: ` +
        METHOD_ORDER.map((m) => {
          const s = groups[kbd].methods[m];
          return `${BENCH_INFO[m].label} ${s.meanTimeSec === null ? 'sin datos' : `${fmtSec(s.meanTimeSec)} s`}`;
        }).join('; ')
      : '';

  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <CardHead
        eyebrow="Tiempo medio frente a N"
        title={
          <>
            Cómo crece el tiempo con los clientes · <span className="num">h = {hText(h)}</span>
          </>
        }
        note="Escala logarítmica: cada línea de la grilla es 10 veces más tiempo. Las ejecuciones cortadas por el límite cuentan con su tiempo."
      />

      <div ref={wrapRef} className="relative mt-5 w-full" style={{ height: HEIGHT }} onPointerLeave={() => setHover(null)}>
        {values.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-zinc-800 text-[13px] text-zinc-500">
            Aún no hay tiempos registrados con h = {hText(h)}.
          </div>
        ) : (
          width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              role="img"
              tabIndex={0}
              aria-labelledby={titleId}
              aria-describedby={descId}
              className="block cursor-crosshair overflow-visible rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-50/80 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-900"
              onPointerMove={(e) => setHover(idxFromPointer(e))}
              onFocus={() => setKbd((v) => v ?? ns.length - 1)}
              onBlur={() => setKbd(null)}
              onKeyDown={onKey}
            >
              <title id={titleId}>{`Tiempo medio por método frente a N con h = ${hText(h)}`}</title>
              <desc id={descId}>
                {`Escala logarítmica de ${tickText(lo)} a ${tickText(topVal)} segundos${
                  timeLimit !== null ? `, con el límite de ${fmt(timeLimit, 0)} s marcado con una línea punteada` : ''
                }. Flechas izquierda y derecha para recorrer los tamaños; la tabla de datos sigue al gráfico.`}
              </desc>

              {/* Rejilla y eje y (log) */}
              <g aria-hidden>
                {shownTicks.map((t) => {
                  const y = Math.round(yOf(t)) + 0.5;
                  const isLimit = timeLimit !== null && Math.abs(t - timeLimit) < 1e-9;
                  return (
                    <g key={t}>
                      {!isLimit && <line x1={ML} x2={width - MR} y1={y} y2={y} stroke={COLOR.grid} strokeWidth={1} shapeRendering="crispEdges" />}
                      <text x={ML - 8} y={y + 3.5} textAnchor="end" fill={isLimit ? COLOR.label : COLOR.tick} fontSize={10.5} className="num">
                        {tickText(t)}
                      </text>
                    </g>
                  );
                })}
                <line
                  x1={ML}
                  x2={width - MR}
                  y1={TOP + PLOT_H + 0.5}
                  y2={TOP + PLOT_H + 0.5}
                  stroke={COLOR.axis}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={0} y={TOP - 14} fill={COLOR.label} fontSize={10.5}>
                  segundos · escala log
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
                  clientes N
                </text>
              </g>

              {/* Límite de tiempo */}
              {limitY !== null && (
                <g aria-hidden>
                  <line
                    x1={ML}
                    x2={width - MR}
                    y1={Math.round(limitY) + 0.5}
                    y2={Math.round(limitY) + 0.5}
                    stroke={COLOR.label}
                    strokeOpacity={0.7}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    shapeRendering="crispEdges"
                  />
                  <text x={width - MR} y={limitY - 6} textAnchor="end" fill={COLOR.label} fontSize={10.5}>
                    límite {fmt(timeLimit, 0)} s
                  </text>
                </g>
              )}

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

              {/* Series (se vuelven a trazar al cambiar h) */}
              <g key={h} aria-hidden>
                {series.map((se, k) => {
                  const { full, partial } = pathsOf(se.pts, k);
                  const color = METHOD_COLOR[BENCH_INFO[se.method].tone];
                  return (
                    <g key={se.method}>
                      {full && (
                        <motion.path
                          d={full}
                          fill="none"
                          stroke={color}
                          strokeOpacity={0.75}
                          strokeWidth={1.75}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: inView ? 1 : 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.2, delay: k * 0.05 }}
                        />
                      )}
                      {/* Discontinuo: pathLength reescribe stroke-dasharray, así que aquí se anima la opacidad. */}
                      {partial && (
                        <motion.path
                          d={partial}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.5}
                          strokeDasharray="3 3.5"
                          strokeLinecap="round"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: inView ? 0.55 : 0 }}
                          transition={{ ...springSoft, delay: 0.2 + k * 0.05 }}
                        />
                      )}
                    </g>
                  );
                })}
                {series.map((se, k) => (
                  <motion.g
                    key={`${se.method}-pts`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: inView ? 1 : 0 }}
                    transition={{ ...springSoft, delay: 0.15 + k * 0.05 }}
                  >
                    {se.pts.map((p) => {
                      if (!p) return null;
                      const tone = BENCH_INFO[p.method].tone;
                      const x = xOf(p.i) + dx(k);
                      const y = yOf(p.v);
                      const r = p.i === active ? 5.5 : 4.5;
                      return (
                        <g key={p.i} opacity={p.partial ? 0.5 : 1}>
                          <MethodMarkSvg tone={tone} x={x} y={y} r={r} />
                          {p.censored && <CensorArrow x={x} y={y} r={r} color={METHOD_COLOR[tone]} />}
                        </g>
                      );
                    })}
                  </motion.g>
                ))}
              </g>
            </svg>
          )
        )}

        <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={16} minTop={0} maxBottom={HEIGHT}>
          {active !== null && groups[active] && (
            <>
              <TipHeader aside={<span className="num text-[11px] text-zinc-500">h = {hText(h)}</span>}>N = {ns[active]}</TipHeader>
              <div className="grid grid-cols-[auto_auto_auto_auto] items-center gap-x-2 text-[12px] leading-5">
                {METHOD_ORDER.map((m) => {
                  const s = groups[active].methods[m];
                  return (
                    <div key={m} className="contents">
                      <MethodMark tone={BENCH_INFO[m].tone} size={10} />
                      <span className="text-zinc-300">{BENCH_INFO[m].short}</span>
                      <span className="num text-right font-medium text-zinc-50">{s.meanTimeSec === null ? '—' : `${fmtSec(s.meanTimeSec)} s`}</span>
                      <span className="num text-[11px] text-zinc-500">{statusLine(s)}</span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const pending = METHOD_ORDER.reduce((a, m) => a + pendingOf(groups[active].methods[m]), 0);
                return pending > 0 ? (
                  <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[11px] text-zinc-500">
                    Faltan <span className="num text-zinc-300">{pending}</span> ejecuciones con este N
                  </p>
                ) : null;
              })()}
            </>
          )}
        </ChartTooltip>
        <span className="sr-only" aria-live="polite">
          {readout}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {METHOD_ORDER.map((m) => {
          // Sin puntos desde el N en que no se ejecuta (alto costo computacional): se dice en la leyenda.
          const ran = groups.filter((g) => !notRunIn(g.methods[m])).map((g) => g.numCustomers);
          const cut = groups.some((g) => notRunIn(g.methods[m])) && ran.length > 0 ? Math.max(...ran) : null;
          return (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400"
              title={cut !== null ? `${BENCH_INFO[m].title}. No se ejecuta con N > ${cut} por su alto costo computacional` : BENCH_INFO[m].title}
            >
              <MethodMark tone={BENCH_INFO[m].tone} size={11} />
              {BENCH_INFO[m].label}
              {cut !== null && <span className="text-zinc-500">(solo N ≤ {cut}: alto costo computacional)</span>}
            </span>
          );
        })}
        {anyCensored && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
            <svg aria-hidden width={12} height={14} viewBox="0 0 12 14" className="shrink-0 overflow-visible">
              <CensorArrow x={6} y={18} r={2} color={COLOR.label} />
            </svg>
            ≥: incluye ejecuciones cortadas por el límite
          </span>
        )}
        {anyPartial && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
            <svg aria-hidden width={22} height={12} viewBox="0 0 22 12" className="shrink-0 overflow-visible">
              <line x1={1} x2={21} y1={6} y2={6} stroke={COLOR.label} strokeWidth={1.5} strokeDasharray="3 3.5" strokeLinecap="round" />
              <circle cx={11} cy={6} r={3.2} fill={COLOR.label} opacity={0.5} />
            </svg>
            datos parciales (faltan ejecuciones)
          </span>
        )}
        {timeLimit !== null && (
          <LegendItem kind="dash" color={COLOR.label}>
            límite de tiempo
          </LegendItem>
        )}
      </div>

      <table className="sr-only">
        <caption>Tiempo medio en segundos por método y cantidad de clientes, h = {hText(h)}</caption>
        <thead>
          <tr>
            <th scope="col">N</th>
            {METHOD_ORDER.map((m) => (
              <th key={m} scope="col">
                {BENCH_INFO[m].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.numCustomers}>
              <th scope="row">{g.numCustomers}</th>
              {METHOD_ORDER.map((m) => {
                const s = g.methods[m];
                const notes = [statusLine(s), pendingOf(s) > 0 ? `${pendingOf(s)} pendientes` : ''].filter(Boolean).join(', ');
                return (
                  <td key={m}>
                    {notRunIn(s) ? 'no se ejecuta (alto costo computacional)' : s.meanTimeSec === null ? 'sin datos' : `${fmtSec(s.meanTimeSec)} s`}
                    {notes ? ` (${notes})` : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </SpotlightCard>
  );
}
