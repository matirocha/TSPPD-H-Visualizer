/**
 * Perfil de carga: unidades α / β a bordo durante cada tramo (barras apiladas)
 * frente a la capacidad Q, con una fila secundaria de manipulaciones por parada.
 * El tramo actual se marca con un selector que se desliza por resorte.
 */
import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useInView, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useProgress, useSim } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { fmt, fmtPct } from '../../lib/format';
import { spring, springSoft } from '../../lib/motion';
import { SpotlightCard } from '../ui';
import {
  COLOR,
  ChartTooltip,
  LegendItem,
  TipHeader,
  TipRow,
  columnPath,
  niceScale,
  nodeLong,
  nodeShort,
  useElementWidth,
} from './chart';

const TOP = 28;
const PLOT_H = 220;
const LABEL_H = 26;
const HROW_H = 46;
const ML = 34;
const MR = 50;
const HEIGHT = TOP + PLOT_H + LABEL_H + HROW_H + 4;
const BAR_SPRING = { stiffness: 320, damping: 32, mass: 0.9 };

interface Leg {
  k: number;
  from: number;
  to: number;
  a: number;
  b: number;
  load: number;
  ops: number;
  cost: number;
}

export function LoadProfile() {
  const { solution, stepIndex, mode, actions } = useSim();
  const { hoverNode, setHoverNode } = useHover();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const colRefs = useRef<(SVGGElement | null)[]>([]);

  const legs: Leg[] = useMemo(
    () =>
      solution?.steps.map((s, k) => ({
        k,
        from: s.from,
        to: s.to,
        a: s.aOnTruck,
        b: s.bOnTruck,
        load: s.aOnTruck + s.bOnTruck,
        ops: s.handlingCount,
        cost: s.handlingCost,
      })) ?? [],
    [solution],
  );

  const Q = solution?.capacity ?? 1;
  const stats = useMemo(() => {
    if (!legs.length) return null;
    const peak = legs.reduce((m, l) => (l.load > m.load ? l : m), legs[0]);
    const meanOcc = legs.reduce((acc, l) => acc + l.load / (Q || 1), 0) / legs.length;
    const ops = legs.reduce((acc, l) => acc + l.ops, 0);
    const stopsWithOps = legs.filter((l) => l.ops > 0).length;
    const maxOps = Math.max(0, ...legs.map((l) => l.ops));
    return { peak, meanOcc, ops, stopsWithOps, maxOps };
  }, [legs, Q]);

  if (!solution || !stats) return null;

  const N = legs.length;
  const yMax = Math.max(Q, ...legs.map((l) => l.load), 1);
  const scale = niceScale(Q, 4);
  const ticks = scale.ticks.filter((t) => t < Q - scale.step * 0.25);
  const innerW = Math.max(0, width - ML - MR);
  const band = innerW / N;
  const barW = Math.max(6, Math.min(24, band * 0.56));
  const cx = (k: number) => ML + band * (k + 0.5);
  const baseline = TOP + PLOT_H;
  const yOf = (v: number) => baseline - (v / yMax) * PLOT_H;
  const pxOf = (v: number) => (v / yMax) * PLOT_H;
  const labelY = baseline + 17;
  const hBase = baseline + LABEL_H + HROW_H - 6;
  const hMax = HROW_H - 20;
  const stemH = (ops: number) => (ops > 0 ? 6 + (ops / Math.max(1, stats.maxOps)) * (hMax - 6) : 0);

  const inProgress = mode === 'transit' || mode === 'stop';
  const current = inProgress ? stepIndex : null;
  const pointerIdx = hoverIdx ?? focusIdx;
  const externalIdx = pointerIdx === null && hoverNode !== null ? legs.findIndex((l) => l.to === hoverNode) : -1;
  const washIdx = pointerIdx ?? (externalIdx >= 0 ? externalIdx : null);
  const tabStop = focusIdx ?? current ?? 0;
  const firstMax = legs.findIndex((l) => l.ops === stats.maxOps && l.ops > 0);

  const active = pointerIdx !== null ? legs[pointerIdx] : null;
  const anchor = active ? { x: cx(active.k), y: (yOf(active.load) + baseline) / 2 } : null;

  const enter = (l: Leg) => {
    setHoverIdx(l.k);
    setHoverNode(l.to);
  };
  const leave = () => {
    setHoverIdx(null);
    setHoverNode(null);
  };
  const onKey = (e: KeyboardEvent<SVGGElement>, k: number) => {
    let next = k;
    if (e.key === 'ArrowRight') next = Math.min(N - 1, k + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, k - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = N - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      actions.selectStep(k);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    colRefs.current[next]?.focus();
  };

  const cur = current !== null ? legs[current] : null;
  const curTop = cur ? yOf(cur.load) : baseline;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Perfil de carga</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">Ocupación del camión en cada tramo</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1" aria-label="Leyenda">
          <LegendItem kind="bar" color={COLOR.alpha}>
            α a bordo
          </LegendItem>
          <LegendItem kind="bar" color={COLOR.beta}>
            β a bordo
          </LegendItem>
          <LegendItem kind="dash" color={COLOR.tick}>
            Capacidad Q
          </LegendItem>
          <LegendItem kind="dot" color={COLOR.handling}>
            Manipulaciones
          </LegendItem>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-4 border-y border-zinc-800/70 py-3 sm:max-w-xl">
        <div className="min-w-0">
          <dt className="text-[11.5px] text-zinc-500">Pico a bordo</dt>
          <dd className="mt-0.5 truncate text-sm text-zinc-100">
            <span className="num">
              {stats.peak.load}/{Q}
            </span>
            <span className="text-zinc-500"> · tramo {stats.peak.k + 1}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11.5px] text-zinc-500">Ocupación media</dt>
          <dd className="num mt-0.5 text-sm text-zinc-100">{fmtPct(stats.meanOcc)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11.5px] text-zinc-500">Manipulaciones</dt>
          <dd className="mt-0.5 truncate text-sm text-zinc-100">
            <span className="num">{stats.ops}</span>
            <span className="text-zinc-500">
              {' '}
              · {stats.stopsWithOps} {stats.stopsWithOps === 1 ? 'parada' : 'paradas'}
            </span>
          </dd>
        </div>
      </dl>

      <div ref={wrapRef} className="relative mt-4 w-full" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="group"
            aria-labelledby="load-profile-title load-profile-desc"
            className="block overflow-visible select-none"
          >
            <title id="load-profile-title">Perfil de carga por tramo</title>
            <desc id="load-profile-desc">
              {`Barras apiladas con las unidades α y β a bordo durante cada uno de los ${N} tramos, frente a la capacidad Q = ${Q}. Debajo, las manipulaciones realizadas en cada parada. Usa las flechas para recorrer los tramos y Enter para llevar el simulador a esa parada.`}
            </desc>

            {/* Rejilla y eje */}
            <g aria-hidden>
              {ticks.map((t) => (
                <g key={t}>
                  {t > 0 && <line x1={ML} x2={width - MR + 6} y1={yOf(t)} y2={yOf(t)} stroke={COLOR.grid} strokeWidth={1} shapeRendering="crispEdges" />}
                  <text x={ML - 8} y={yOf(t) + 3.5} textAnchor="end" fill={COLOR.tick} fontSize={10.5} className="num">
                    {t}
                  </text>
                </g>
              ))}
              <line x1={ML} x2={width - MR + 6} y1={baseline + 0.5} y2={baseline + 0.5} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />
            </g>

            {/* Resalte de columna (hover / teclado / hover cruzado desde el mapa) */}
            {washIdx !== null && (
              <motion.rect
                aria-hidden
                initial={false}
                animate={{ x: ML + band * washIdx + 2, width: Math.max(0, band - 4) }}
                transition={spring}
                y={TOP - 18}
                height={hBase - TOP + 24}
                rx={10}
                fill="rgb(255 255 255 / 0.035)"
              />
            )}

            {/* Pista de capacidad + barras apiladas */}
            {legs.map((l) => {
              const x = cx(l.k) - barW / 2;
              const dim = inProgress && l.k !== current && l.k !== pointerIdx ? 0.42 : 1;
              return (
                <g key={l.k} aria-hidden>
                  <path d={columnPath(x, barW, yOf(Q), baseline, true)} fill={COLOR.track} />
                  <motion.g initial={false} animate={{ opacity: dim }} transition={springSoft}>
                    <LoadColumn x={x} w={barW} hA={inView ? pxOf(l.a) : 0} hB={inView ? pxOf(l.b) : 0} baseline={baseline} />
                  </motion.g>
                </g>
              );
            })}

            {/* Capacidad Q (umbral) */}
            <g aria-hidden>
              <line
                x1={ML}
                x2={width - MR + 6}
                y1={yOf(Q)}
                y2={yOf(Q)}
                stroke={COLOR.tick}
                strokeWidth={1}
                strokeDasharray="4 4"
                shapeRendering="crispEdges"
              />
              <text x={width - MR + 10} y={yOf(Q) + 3.5} fill={COLOR.label} fontSize={10.5} className="num">
                Q = {Q}
              </text>
            </g>

            {/* Selector del tramo actual */}
            {cur && (
              <g aria-hidden>
                <motion.rect
                  initial={false}
                  animate={{ x: cx(cur.k) - barW / 2 - 3.5, y: curTop - 3.5, height: Math.max(10, baseline - curTop + 3.5) }}
                  transition={spring}
                  width={barW + 7}
                  rx={6.5}
                  fill="none"
                  stroke={COLOR.ink}
                  strokeWidth={1.5}
                />
                <motion.text
                  initial={false}
                  animate={{ x: cx(cur.k), y: curTop - 11 }}
                  transition={spring}
                  textAnchor="middle"
                  fill={COLOR.ink}
                  fontSize={11}
                  fontWeight={600}
                  className="num"
                >
                  {`${cur.load}/${Q}`}
                </motion.text>
                {mode === 'transit' && <LegProgress x={cx(cur.k) - barW / 2} w={barW} y={baseline + 3} />}
              </g>
            )}

            {/* Etiquetas del eje x: destino de cada tramo */}
            <g aria-hidden>
              {legs.map((l) => {
                const strong = l.k === current || l.k === pointerIdx;
                return (
                  <text
                    key={l.k}
                    x={cx(l.k)}
                    y={labelY}
                    textAnchor="middle"
                    fill={strong ? COLOR.ink : COLOR.label}
                    fontSize={band < 30 ? 9.5 : 10.5}
                    fontWeight={strong ? 600 : 400}
                    className="num"
                  >
                    {nodeShort(l.to)}
                  </text>
                );
              })}
            </g>

            {/* Fila secundaria: manipulaciones en la parada */}
            <g aria-hidden>
              <line x1={ML} x2={width - MR + 6} y1={hBase + 0.5} y2={hBase + 0.5} stroke={COLOR.grid} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={ML - 8} y={hBase + 3} textAnchor="end" fill={COLOR.tick} fontSize={9.5} className="num">
                manip.
              </text>
              {legs.map((l) => {
                const h = inView ? stemH(l.ops) : 0;
                const x = cx(l.k);
                const showLabel = l.ops > 0 && (l.k === firstMax || l.k === current || l.k === pointerIdx);
                if (l.ops === 0) return <circle key={l.k} cx={x} cy={hBase} r={1.75} fill={COLOR.axis} />;
                return (
                  <g key={l.k}>
                    <motion.rect
                      initial={{ y: hBase, height: 0 }}
                      animate={{ y: hBase - h, height: h }}
                      transition={{ ...springSoft, delay: inView ? 0.15 + l.k * 0.03 : 0 }}
                      x={x - 1}
                      width={2}
                      rx={1}
                      fill={COLOR.handling}
                      fillOpacity={0.55}
                    />
                    <motion.circle
                      initial={{ cy: hBase }}
                      animate={{ cy: hBase - h }}
                      transition={{ ...springSoft, delay: inView ? 0.15 + l.k * 0.03 : 0 }}
                      cx={x}
                      r={3.75}
                      fill={COLOR.handling}
                      stroke={COLOR.surface}
                      strokeWidth={2}
                    />
                    {showLabel && (
                      <text x={x + 7} y={hBase - h + 3.5} fill={COLOR.label} fontSize={10} className="num">
                        {l.ops}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Capa de interacción (objetivo = banda completa, no solo la barra) */}
            <g>
              {legs.map((l) => {
                const pct = fmtPct(l.load / (Q || 1));
                const label = `Tramo ${l.k + 1}, ${nodeLong(l.from)} a ${nodeLong(l.to)}: α ${l.a}, β ${l.b}, ${l.load} de ${Q} a bordo (${pct}); ${l.ops} manipulaciones (+${fmt(l.cost)}). Enter lleva el simulador a esta parada.`;
                return (
                  <g
                    key={l.k}
                    ref={(el) => {
                      colRefs.current[l.k] = el;
                    }}
                    role="button"
                    tabIndex={l.k === tabStop ? 0 : -1}
                    aria-label={label}
                    aria-current={l.k === current ? 'step' : undefined}
                    className="group cursor-pointer outline-none"
                    onPointerEnter={() => enter(l)}
                    onPointerLeave={leave}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => actions.selectStep(l.k)}
                    onFocus={() => {
                      setFocusIdx(l.k);
                      setHoverNode(l.to);
                    }}
                    onBlur={() => {
                      setFocusIdx(null);
                      setHoverNode(null);
                    }}
                    onKeyDown={(e) => onKey(e, l.k)}
                  >
                    <rect x={ML + band * l.k} y={0} width={band} height={HEIGHT} fill="transparent" />
                    <rect
                      x={ML + band * l.k + 2}
                      y={TOP - 18}
                      width={Math.max(0, band - 4)}
                      height={hBase - TOP + 24}
                      rx={10}
                      fill="none"
                      stroke={COLOR.ink}
                      strokeOpacity={0.7}
                      strokeWidth={1.5}
                      className="opacity-0 transition-opacity group-focus-visible:opacity-100"
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={barW / 2 + 14} minTop={0} maxBottom={HEIGHT}>
          {active && (
            <>
              <TipHeader aside={<span className="num text-[10.5px] text-zinc-500">{fmtPct(active.load / (Q || 1))}</span>}>
                Tramo {active.k + 1} · {nodeShort(active.from)} → {nodeShort(active.to)}
              </TipHeader>
              <TipRow color={COLOR.alpha} value={active.a} label="α a bordo" />
              <TipRow color={COLOR.beta} value={active.b} label="β a bordo" />
              <TipRow color={COLOR.tick} dashed value={`${active.load}/${Q}`} label="ocupación" />
              <TipRow
                color={COLOR.handling}
                value={active.ops}
                label={active.ops > 0 ? `manip. en ${nodeShort(active.to)} (+${fmt(active.cost)})` : `manip. en ${nodeShort(active.to)}`}
              />
            </>
          )}
        </ChartTooltip>
      </div>

      <p className="mt-auto pt-2 text-[12px] text-zinc-500">
        Carga medida durante el recorrido del arco (al llegar al destino). Selecciona un tramo para llevar el simulador a esa parada.
      </p>
    </SpotlightCard>
  );
}

/** Columna apilada α (base) + β (arriba) con alturas animadas por resorte en píxeles. */
const LoadColumn = memo(function LoadColumn({ x, w, hA, hB, baseline }: { x: number; w: number; hA: number; hB: number; baseline: number }) {
  const reduce = useReducedMotion();
  const sa = useSpring(0, BAR_SPRING);
  const sb = useSpring(0, BAR_SPRING);
  useEffect(() => {
    if (reduce) {
      sa.jump(hA);
      sb.jump(hB);
    } else {
      sa.set(hA);
      sb.set(hB);
    }
  }, [hA, hB, reduce, sa, sb]);

  const dA = useTransform(() => {
    const a = Math.max(0, sa.get());
    const b = Math.max(0, sb.get());
    const gap = a > 1 && b > 1 ? 1 : 0;
    return columnPath(x, w, baseline - a + gap, baseline, b <= 1);
  });
  const dB = useTransform(() => {
    const a = Math.max(0, sa.get());
    const b = Math.max(0, sb.get());
    const gap = a > 1 && b > 1 ? 1 : 0;
    const bottom = baseline - a - gap;
    return columnPath(x, w, bottom - Math.max(0, b - gap), bottom, true);
  });

  return (
    <>
      <motion.path d={dA} fill={COLOR.alpha} />
      <motion.path d={dB} fill={COLOR.beta} />
    </>
  );
});

/** Avance del tramo en curso (única pieza suscrita a 60 fps). */
const LegProgress = memo(function LegProgress({ x, w, y }: { x: number; w: number; y: number }) {
  const p = useProgress();
  return (
    <g>
      <rect x={x} y={y} width={w} height={2} rx={1} fill={COLOR.axis} />
      <rect x={x} y={y} width={w * Math.min(1, Math.max(0, p))} height={2} rx={1} fill={COLOR.ink} />
    </g>
  );
});
