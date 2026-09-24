/**
 * Costo acumulado: cómo se construye Z* parada a parada.
 * - Gráfico principal: área apilada de distancia acumulada + manipulación acumulada (Z).
 * - Múltiplo pequeño: manipulación acumulada con su propia escala (misma x), para que la
 *   banda delgada de h se lea con claridad sin recurrir a un segundo eje y.
 * - Cursor en vivo: la posición del camión (km recorridos) proyectada sobre el eje de paradas.
 */
import { memo, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { motion, useInView } from 'motion/react';
import { useCatalog, useLiveMetrics, useSim } from '../../state/SimulationProvider';
import { fmt, fmtKm, fmtPct } from '../../lib/format';
import { springSoft } from '../../lib/motion';
import { SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, LegendItem, TipHeader, TipRow, clamp, niceScale, nodeLong, nodeShort, useElementWidth } from './chart';

const TOP = 16;
const MAIN_H = 128;
const GAP = 30;
const SUB_H = 40;
const AXIS_H = 22;
const ML = 34;
const MR = 14;
const HEIGHT = TOP + MAIN_H + GAP + SUB_H + AXIS_H;

interface Series {
  /** Distancia acumulada al llegar a la posición i (i = 0 depósito de salida). */
  cd: number[];
  /** Manipulación acumulada tras la parada i. */
  ch: number[];
  labels: string[];
  longLabels: string[];
  ops: number;
}

export function CostCurve() {
  const { solution, actions, selectedFilename } = useCatalog();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hover, setHover] = useState<number | null>(null);
  const [kbd, setKbd] = useState<number | null>(null);

  const series: Series | null = useMemo(() => {
    if (!solution) return null;
    const cd = [0];
    const ch = [0];
    const labels = ['D'];
    const longLabels = ['Salida del depósito'];
    let ops = 0;
    solution.steps.forEach((s, k) => {
      cd.push(cd[k] + s.distance);
      ch.push(ch[k] + s.handlingCost);
      labels.push(nodeShort(s.to));
      longLabels.push(s.to === 0 ? 'Regreso al depósito' : nodeLong(s.to));
      ops += s.handlingCount;
    });
    return { cd, ch, labels, longLabels, ops };
  }, [solution]);

  if (!solution || !series) return null;

  const { cd, ch, labels } = series;
  const N = cd.length - 1;
  const zStar = solution.objectiveValue;
  const zEnd = cd[N] + ch[N];
  const hTotal = ch[N];
  const main = niceScale(Math.max(zEnd, zStar, 1), 3);
  const subMax = hTotal > 0 ? hTotal : 1;
  const innerW = Math.max(0, width - ML - MR);
  const xOf = (i: number) => ML + (N > 0 ? (i / N) * innerW : 0);
  const yM = (v: number) => TOP + MAIN_H - (v / main.max) * MAIN_H;
  const subTop = TOP + MAIN_H + GAP;
  const yS = (v: number) => subTop + SUB_H - (v / subMax) * SUB_H;
  const axisY = subTop + SUB_H + 15;

  // Trazados
  let distLine = `M${xOf(0)},${yM(0)}`;
  let topLine = `M${xOf(0)},${yM(0)}`;
  let subLine = `M${xOf(0)},${yS(0)}`;
  for (let i = 1; i <= N; i++) {
    distLine += `L${xOf(i)},${yM(cd[i])}`;
    topLine += `L${xOf(i)},${yM(cd[i] + ch[i - 1])}L${xOf(i)},${yM(cd[i] + ch[i])}`;
    subLine += `L${xOf(i)},${yS(ch[i - 1])}L${xOf(i)},${yS(ch[i])}`;
  }
  const distArea = `${distLine}L${xOf(N)},${yM(0)}Z`;
  let bandBack = '';
  for (let i = N; i >= 0; i--) bandBack += `L${xOf(i)},${yM(cd[i])}`;
  const handBand = `${topLine}${bandBack}Z`;
  const subArea = `${subLine}L${xOf(N)},${yS(0)}Z`;

  const active = hover ?? kbd;
  const anchor = active !== null ? { x: xOf(active), y: yM(cd[active] + ch[active]) } : null;
  const labelEvery = innerW / Math.max(1, N) < 24 ? 2 : 1;
  const share = zStar > 0 ? hTotal / zStar : 0;

  const pick = (i: number) => {
    if (i <= 0) actions.reset();
    else actions.selectStep(i - 1);
  };
  const idxFromPointer = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    return clamp(Math.round(((px - ML) / Math.max(1, innerW)) * N), 0, N);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const i = kbd ?? 0;
    let next = i;
    if (e.key === 'ArrowRight') next = Math.min(N, i + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = N;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      pick(i);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    setKbd(next);
  };

  const readout =
    active !== null
      ? `${series.longLabels[active]}: Z acumulado ${fmt(cd[active] + ch[active])}, distancia ${fmtKm(cd[active])}, manipulación ${fmt(ch[active])}.`
      : '';

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <p className="eyebrow">Costo acumulado</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">Cómo se construye Z*</h3>

      <div className="mt-4 flex items-end justify-between gap-4 border-y border-zinc-800/70 py-3">
        <div className="min-w-0">
          <p className="text-[11.5px] text-zinc-500">Z* óptimo</p>
          <p className="mt-1 text-[30px] leading-none font-semibold tracking-tight text-zinc-50">{fmt(zStar)}</p>
        </div>
        <div className="min-w-0 text-right text-[12px] leading-5 text-zinc-400">
          <p>
            <span className="num text-zinc-200">{fmtKm(solution.totalDistance)}</span> distancia
          </p>
          <p>
            <span className="num text-zinc-200">+{fmt(solution.handlingCost)}</span> manipulación
          </p>
        </div>
      </div>

      <LiveReadout zStar={zStar} />

      <div
        ref={wrapRef}
        className="relative mt-3 w-full"
        style={{ height: HEIGHT }}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            tabIndex={0}
            role="group"
            aria-roledescription="gráfico interactivo"
            aria-labelledby="cost-curve-title cost-curve-desc"
            className="block cursor-crosshair overflow-visible rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-50/80 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-900"
            onPointerMove={(e) => setHover(idxFromPointer(e))}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => pick(idxFromPointer(e))}
            onFocus={() => setKbd((v) => v ?? 0)}
            onBlur={() => setKbd(null)}
            onKeyDown={onKey}
          >
            <title id="cost-curve-title">Costo acumulado por parada</title>
            <desc id="cost-curve-desc">
              {`Área apilada de distancia y manipulación acumuladas hasta Z* = ${fmt(zStar)}; debajo, la manipulación acumulada con su propia escala hasta ${fmt(hTotal)}. Flechas izquierda y derecha para recorrer las paradas, Enter para llevar el simulador a esa parada.`}
            </desc>

            {/* Rejilla principal */}
            <g aria-hidden>
              {main.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={ML}
                    x2={width - MR}
                    y1={yM(t) + (t === 0 ? 0.5 : 0)}
                    y2={yM(t) + (t === 0 ? 0.5 : 0)}
                    stroke={t === 0 ? COLOR.axis : COLOR.grid}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text x={ML - 8} y={yM(t) + 3.5} textAnchor="end" fill={COLOR.tick} fontSize={10.5} className="num">
                    {fmt(t, 0)}
                  </text>
                </g>
              ))}
              {/* Rejilla del múltiplo pequeño */}
              <line x1={ML} x2={width - MR} y1={yS(0) + 0.5} y2={yS(0) + 0.5} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />
              <line x1={ML} x2={width - MR} y1={yS(subMax)} y2={yS(subMax)} stroke={COLOR.grid} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={ML - 8} y={yS(0) + 3.5} textAnchor="end" fill={COLOR.tick} fontSize={10.5} className="num">
                0
              </text>
              {hTotal > 0 && (
                <text x={ML - 8} y={yS(subMax) + 3.5} textAnchor="end" fill={COLOR.tick} fontSize={10.5} className="num">
                  {fmt(subMax, subMax < 10 ? 1 : 0)}
                </text>
              )}
              <text x={ML} y={subTop - 10} fill={COLOR.label} fontSize={10.5}>
                Manipulación acumulada (escala propia)
              </text>
            </g>

            {/* Series (se vuelven a trazar al cambiar de solución) */}
            <g key={selectedFilename} aria-hidden>
              <motion.path
                d={distArea}
                fill={COLOR.dist}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 0.09 : 0 }}
                transition={springSoft}
              />
              <motion.path
                d={handBand}
                fill={COLOR.handling}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 0.55 : 0 }}
                transition={{ ...springSoft, delay: 0.2 }}
              />
              <motion.path
                d={distLine}
                fill="none"
                stroke={COLOR.dist}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: inView ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.4 }}
              />
              <motion.path
                d={topLine}
                fill="none"
                stroke={COLOR.handling}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: inView ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.4, delay: 0.1 }}
              />
              <motion.path
                d={subArea}
                fill={COLOR.handling}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 0.12 : 0 }}
                transition={springSoft}
              />
              <motion.path
                d={subLine}
                fill="none"
                stroke={COLOR.handling}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: inView ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.4, delay: 0.15 }}
              />
            </g>

            {/* Etiqueta final Z* */}
            <g aria-hidden>
              <circle cx={xOf(N)} cy={yM(zEnd)} r={4} fill={COLOR.ink} stroke={COLOR.surface} strokeWidth={2} />
              <text x={xOf(N) - 8} y={yM(zEnd) - 9} textAnchor="end" fill={COLOR.ink} fontSize={11} fontWeight={600} className="num">
                Z* {fmt(zStar)}
              </text>
              {hTotal > 0 && (
                <text x={xOf(N) - 6} y={yS(hTotal) + 14} textAnchor="end" fill={COLOR.ink} fontSize={10.5} fontWeight={500} className="num">
                  +{fmt(hTotal)}
                </text>
              )}
            </g>

            {/* Eje x: paradas */}
            <g aria-hidden>
              {labels.map((l, i) => {
                const strong = i === active;
                if (!strong && i % labelEvery !== 0 && i !== N) return null;
                return (
                  <text
                    key={i}
                    x={xOf(i)}
                    y={axisY}
                    textAnchor={i === 0 ? 'start' : i === N ? 'end' : 'middle'}
                    fill={strong ? COLOR.ink : COLOR.tick}
                    fontWeight={strong ? 600 : 400}
                    fontSize={10}
                    className="num"
                  >
                    {l}
                  </text>
                );
              })}
            </g>

            {/* Cursor en vivo del camión */}
            <CostCursor cd={cd} xOf={xOf} yM={yM} yS={yS} top={TOP - 4} bottom={subTop + SUB_H} />

            {/* Crosshair de exploración */}
            {active !== null && (
              <g aria-hidden>
                <line
                  x1={xOf(active)}
                  x2={xOf(active)}
                  y1={TOP - 6}
                  y2={subTop + SUB_H}
                  stroke={COLOR.label}
                  strokeOpacity={0.6}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <circle cx={xOf(active)} cy={yM(cd[active] + ch[active])} r={4} fill={COLOR.handling} stroke={COLOR.surface} strokeWidth={2} />
                <circle cx={xOf(active)} cy={yM(cd[active])} r={3.5} fill={COLOR.dist} stroke={COLOR.surface} strokeWidth={2} />
                <circle cx={xOf(active)} cy={yS(ch[active])} r={3.5} fill={COLOR.handling} stroke={COLOR.surface} strokeWidth={2} />
              </g>
            )}
          </svg>
        )}

        <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={14} minTop={0} maxBottom={HEIGHT}>
          {active !== null && (
            <>
              <TipHeader>
                {active === 0 ? 'Salida · D' : active === N ? 'Regreso · D' : `Parada ${active} · ${labels[active]}`}
              </TipHeader>
              <TipRow color={COLOR.ink} value={fmt(cd[active] + ch[active])} label="Z acumulado" />
              <TipRow color={COLOR.dist} value={fmtKm(cd[active])} label="distancia" />
              <TipRow
                color={COLOR.handling}
                dashed
                value={`+${fmt(ch[active])}`}
                label={active > 0 && ch[active] - ch[active - 1] > 1e-9 ? `manip. (+${fmt(ch[active] - ch[active - 1])} aquí)` : 'manipulación'}
              />
            </>
          )}
        </ChartTooltip>
        <span className="sr-only" aria-live="polite">
          {kbd !== null ? readout : ''}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendItem kind="area" color={COLOR.dist}>
          Distancia
        </LegendItem>
        <LegendItem kind="area" color={COLOR.handling}>
          Manipulación
        </LegendItem>
        <LegendItem kind="line" color={COLOR.ink}>
          Camión ahora
        </LegendItem>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-pretty text-zinc-400">
        La manipulación explica el <span className="num text-zinc-100">{fmtPct(share, 1)}</span> de Z*
        {series.ops > 0 ? (
          <>
            {' '}
            (<span className="num text-zinc-200">{series.ops}</span> {series.ops === 1 ? 'movimiento' : 'movimientos'} de unidades).
          </>
        ) : (
          '.'
        )}
      </p>
    </SpotlightCard>
  );
}

/** Proyección de los km recorridos sobre el eje de paradas (0…N). */
function positionOf(cd: number[], km: number): number {
  const N = cd.length - 1;
  if (km <= 0) return 0;
  for (let k = 0; k < N; k++) {
    if (km <= cd[k + 1] + 1e-9) {
      const d = cd[k + 1] - cd[k];
      return d > 0 ? k + (km - cd[k]) / d : k + 1;
    }
  }
  return N;
}

/** Cursor del camión: se suscribe a las métricas en vivo (60 fps) de forma aislada. */
const CostCursor = memo(function CostCursor({
  cd,
  xOf,
  yM,
  yS,
  top,
  bottom,
}: {
  cd: number[];
  xOf: (i: number) => number;
  yM: (v: number) => number;
  yS: (v: number) => number;
  top: number;
  bottom: number;
}) {
  const live = useLiveMetrics();
  if (!live) return null;
  const x = xOf(positionOf(cd, live.traveledKm));
  return (
    <g aria-hidden pointerEvents="none">
      <line x1={x} x2={x} y1={top} y2={bottom} stroke={COLOR.ink} strokeOpacity={0.45} strokeWidth={1} />
      <circle cx={x} cy={yM(live.zSoFar)} r={4.5} fill={COLOR.ink} stroke={COLOR.surface} strokeWidth={2} />
      <circle cx={x} cy={yS(live.handlingSoFar)} r={3.5} fill={COLOR.ink} stroke={COLOR.surface} strokeWidth={2} />
    </g>
  );
});

/** Lectura textual del avance (Z parcial) — aislada por depender de las métricas en vivo. */
const LiveReadout = memo(function LiveReadout({ zStar }: { zStar: number }) {
  const live = useLiveMetrics();
  const { mode } = useSim();
  if (!live) return null;
  const ratio = zStar > 0 ? Math.min(1, live.zSoFar / zStar) : 0;
  const text =
    mode === 'initial'
      ? 'El camión aún no sale del depósito.'
      : mode === 'finished'
        ? 'Tour completo: se alcanzó Z*.'
        : 'Acumulado hasta la posición actual del camión.';
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-[12px]">
          <span className="truncate text-zinc-500">{text}</span>
          <span className="num shrink-0 text-zinc-200">
            {fmt(live.zSoFar)} <span className="text-zinc-500">· {fmtPct(ratio)}</span>
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
          <div className="h-full rounded-full bg-zinc-100" style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
    </div>
  );
});
