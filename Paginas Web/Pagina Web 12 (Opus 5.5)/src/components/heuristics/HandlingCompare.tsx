/**
 * Esta instancia · Manipulación: Gurobi frente al Algoritmo 2.1 en la misma ruta.
 *
 * Gráfico de pesas (dumbbell) dibujado a mano. Cada fila fija la ruta que encontró un
 * modelo Gurobi (General ○, P1 ●, P2 ■, P3 ◆) y compara la manipulación que pagó Gurobi
 * con la que obtiene el Algoritmo 2.1 + DP (▲, la mejor Política 3 para esa ruta) sobre
 * esa MISMA ruta; el tramo que las une es la diferencia (ámbar si la DP ahorra). La última
 * fila es el ILS (★, Algoritmo 4.2), que además busca la ruta. La línea discontinua marca
 * la manipulación de Gurobi P3: el óptimo exacto con el que ambas heurísticas se contrastan.
 * Las marcas que coinciden se apilan (como en Panorama). Cifras y lecturas se derivan de
 * los archivos de Outputs/Erdogan2012/; nada se recalcula en el navegador.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useInView, type Transition } from 'motion/react';
import { Check, CircleAlert } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import { MODELS, type ModelMeta } from '../../lib/models';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtDelta, fmtKm, fmtPct } from '../../lib/format';
import { spring, springSnappy, springSoft } from '../../lib/motion';
import { Chip, SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, LegendItem, TipHeader, TipRow, clamp, niceScale, nodeShort, useElementWidth } from '../analysis/chart';
import { joinEs } from '../analysis/compareData';
import type { DPEvaluation, ILSFile, TourCost } from '../../types/heuristics';
import type { ModelType } from '../../types/solution';
import { COST_EPS, evaluationsInOrder, gurobiFor, relGap, reversedTour, sameCost, sameTour, type HeurInstance } from './data';
import { HEUR_METHODS, METHOD_COLOR, MethodMark, MethodMarkSvg, type MethodTone } from './methods';

// ─────────────────────────────────────────────────────────────── Geometría

const ROW_H = 46;
/** Encabezados de columnas y etiqueta de la referencia P3. */
const TOP = 26;
/** Separación antes de la fila del ILS (otro tipo de método: también busca la ruta). */
const SEP = 14;
const AXIS_H = 40;
/** Desplazamiento vertical de las marcas que coinciden (se apilan). */
const STACK = 5.5;
const COMPACT_BELOW = 540;

/** zinc-500 del sistema (ajustado a AA en index.css): texto terciario dentro del SVG. */
const MUTED = '#8b8b94';
const OK = '#34d399';
/** Tramo cuando la DP manipula más que Gurobi (no es un ahorro). */
const NEUTRAL = '#71717a';

/** Ancho aproximado de un texto monoespaciado (para colocar etiquetas sin medir el DOM). */
const textW = (s: string, size: number) => s.length * size * 0.6;
const routeText = (tour: number[] | null | undefined) => (tour ?? []).map(nodeShort).join(' → ');
const signedPct = (g: number | null) => (g === null ? '—' : `${g > 0 ? '+' : g < 0 ? '−' : ''}${fmtPct(Math.abs(g), 2)}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─────────────────────────────────────────────────────────────── Datos

/** Relación de una ruta con la de Gurobi P3 (referencia de la instancia). */
type RouteRel = 'ref' | 'same' | 'reversed' | 'other' | 'unknown';

const REL_TEXT: Record<RouteRel, { long: string; short: string }> = {
  ref: { long: 'ruta de referencia', short: 'ref.' },
  same: { long: 'misma ruta que P3', short: '= P3' },
  reversed: { long: 'P3 invertida', short: 'P3 inv.' },
  other: { long: 'ruta distinta', short: 'otra ruta' },
  unknown: { long: '', short: '' },
};

const NAME_OF: Record<ModelType, string> = {
  'TSPPD-H': 'el modelo general',
  'TSPPD-H_1': 'la Política 1',
  'TSPPD-H_2': 'la Política 2',
  'TSPPD-H_3': 'la Política 3',
};
const ROUTE_OF: Record<ModelType, string> = {
  'TSPPD-H': 'del modelo general',
  'TSPPD-H_1': 'de la Política 1',
  'TSPPD-H_2': 'de la Política 2',
  'TSPPD-H_3': 'de la Política 3',
};

interface GurobiRow {
  kind: 'gurobi';
  id: ModelType;
  model: ModelMeta;
  /** Solución Gurobi (desde la evaluación DP o, si falta, desde la referencia del ILS). */
  g: TourCost | null;
  e: DPEvaluation | null;
  rel: RouteRel;
}
interface IlsRow {
  kind: 'ils';
  id: 'ils';
  ils: ILSFile;
  rel: RouteRel;
}
type Row = GurobiRow | IlsRow;
type EvalRow = GurobiRow & { g: TourCost; e: DPEvaluation };

interface View {
  inst: HeurInstance;
  rows: Row[];
  gurobi: GurobiRow[];
  ilsRow: IlsRow | null;
  /** Solución Gurobi P3: referencia de rutas y de manipulación. */
  p3: TourCost | null;
  p3Eval: DPEvaluation | null;
  maxValue: number;
  capacity: number | null;
  h: number | null;
}

function relationTo(tour: number[] | undefined, ref: number[] | undefined): RouteRel {
  if (!tour || !ref) return 'unknown';
  if (sameTour(tour, ref)) return 'same';
  if (reversedTour(tour, ref)) return 'reversed';
  return 'other';
}

function buildView(inst: HeurInstance | null): View | null {
  if (!inst || (!inst.dp && !inst.ils)) return null;
  const p3 = gurobiFor(inst, 'TSPPD-H_3');
  const gurobi = evaluationsInOrder(inst).map(({ model, evaluation }): GurobiRow => {
    const g = gurobiFor(inst, model.id);
    const rel: RouteRel = model.id === 'TSPPD-H_3' ? (g ? 'ref' : 'unknown') : relationTo(g?.tour, p3?.tour);
    return { kind: 'gurobi', id: model.id, model, g, e: evaluation, rel };
  });
  // Sin `best` el archivo ILS no aporta una solución que dibujar
  const ilsRow: IlsRow | null = inst.ils?.best ? { kind: 'ils', id: 'ils', ils: inst.ils, rel: relationTo(inst.ils.best.tour, p3?.tour) } : null;
  if (!gurobi.some((r) => r.g) && !ilsRow) return null;

  const values: number[] = [];
  for (const r of gurobi) {
    if (r.g) values.push(r.g.handlingCost);
    if (r.e) values.push(r.e.handlingDP);
  }
  if (ilsRow) values.push(ilsRow.ils.best.handlingCost);
  if (p3) values.push(p3.handlingCost);
  // Un campo ausente (NaN) no debe arrastrar la escala a NaN
  const finite = values.filter(Number.isFinite);

  return {
    inst,
    rows: ilsRow ? [...gurobi, ilsRow] : gurobi,
    gurobi,
    ilsRow,
    p3,
    p3Eval: gurobi.find((r) => r.id === 'TSPPD-H_3')?.e ?? null,
    maxValue: Math.max(0, ...finite),
    capacity: inst.dp?.capacity ?? inst.ils?.capacity ?? null,
    h: inst.dp?.h ?? inst.ils?.h ?? null,
  };
}

const isEval = (r: GurobiRow): r is EvalRow => !!r.g && !!r.e;

/** Modelo a cargar en el simulador al activar la fila (el ILS solo si su ruta es la de P3). */
function targetOf(r: Row, p3: TourCost | null): ModelType | null {
  if (r.kind === 'gurobi') return r.g ? r.id : null;
  return r.rel === 'same' && p3 ? 'TSPPD-H_3' : null;
}

/** Primera iteración (y dirección) en que el ILS alcanza su mejor Z. */
function earliestHit(ils: ILSFile): { it: number; dir: 1 | 2 } | null {
  const z = ils.best.objectiveValue;
  // Orden estable: ante empate de iteración gana la dirección 1 (orden del archivo)
  const hits = (ils.directions ?? [])
    .filter((d) => !!d.best && Number.isFinite(d.bestIteration) && sameCost(d.best.objectiveValue, z))
    .sort((a, b) => a.bestIteration - b.bestIteration);
  if (hits.length) return { it: hits[0].bestIteration, dir: hits[0].direction };
  return ils.best.bestIteration !== undefined ? { it: ils.best.bestIteration, dir: ils.best.direction } : null;
}

/**
 * `best` y `directions` describen la MEJOR de las corridas (menor Z; ante empate, menor
 * semilla): la iteración de `earliestHit` es la de esa corrida, no la de todas.
 */
function reportedRun(ils: ILSFile): { seed: number; runs: number } | null {
  const runs = ils.runsSummary?.objectives?.length ?? 0;
  return runs > 1 && Number.isFinite(ils.best.seed) ? { seed: ils.best.seed, runs } : null;
}

/** Niter de los parámetros (null si el archivo no lo trae). */
const nIterOf = (ils: ILSFile): number | null => (Number.isFinite(ils.params?.nIter) ? ils.params.nIter : null);

// ─────────────────────────────────────────────────────────────── Tarjeta

export function HandlingCompare({ inst }: { inst: HeurInstance | null }) {
  const view = useMemo(() => buildView(inst), [inst]);

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Esta instancia · Manipulación</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">
            {inst ? (
              <>
                Instancia <span className="num">{inst.instanceId}</span> · <span className="num">{inst.numCustomers}</span> clientes
              </>
            ) : (
              'Gurobi frente al Algoritmo 2.1'
            )}
          </h3>
          {view && (
            <p className="mt-1 text-[12.5px] text-zinc-500">
              Q = <span className="num text-zinc-300">{view.capacity === null ? '—' : fmtAuto(view.capacity)}</span> · h ={' '}
              <span className="num text-zinc-300">{fmt(view.h, 2)}</span> por unidad manipulada
            </p>
          )}
        </div>
        {view?.p3Eval && <ValidationChip e={view.p3Eval} />}
      </div>

      {view ? (
        <>
          <p className="mt-3 max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-400">
            Cada fila fija la ruta de un modelo Gurobi y recalcula su manipulación con el{' '}
            <span className="text-zinc-200">{HEUR_METHODS.dp.label}</span>, la mejor Política 3 posible en esa ruta. El{' '}
            <span className="text-zinc-200">ILS</span> busca además la ruta.
          </p>
          <HandlingChart view={view} />
          <Insights view={view} />
        </>
      ) : (
        <EmptyNote />
      )}
    </SpotlightCard>
  );
}

/** Validación de la implementación: la DP en la ruta de P3 debe reproducir a Gurobi P3. */
function ValidationChip({ e }: { e: DPEvaluation }) {
  const ok = sameCost(e.handlingDP, e.gurobiHandling);
  return ok ? (
    <Chip tone="ok" size="sm" title={`En la ruta de P3 la DP obtiene ${fmt(e.handlingDP)}, igual que Gurobi`}>
      <Check className="h-3 w-3" aria-hidden />
      Alg. 2.1 = Gurobi P3
    </Chip>
  ) : (
    <Chip tone="handling" size="sm" title={`En la ruta de P3 la DP obtiene ${fmt(e.handlingDP)} y Gurobi ${fmt(e.gurobiHandling)}`}>
      <CircleAlert className="h-3 w-3" aria-hidden />
      Alg. 2.1 ≠ Gurobi P3
    </Chip>
  );
}

function EmptyNote() {
  const tones: MethodTone[] = [...MODELS.map((m) => m.tone), 'dp', 'ils'];
  return (
    <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-12 text-center">
      <span className="flex items-center gap-1.5 opacity-60" aria-hidden>
        {tones.map((t) => (
          <MethodMark key={t} tone={t} size={11} />
        ))}
      </span>
      <p className="text-[13.5px] text-zinc-300">Sin resultados de las heurísticas para esta instancia.</p>
      <p className="max-w-[48ch] text-[12.5px] leading-relaxed text-pretty text-zinc-500">
        Cuando existan sus archivos DP_ e ILS_ en Outputs/Erdogan2012/, aquí se compararán con las cuatro soluciones de Gurobi.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Gráfico

interface Layout {
  compact: boolean;
  ML: number;
  plotRight: number;
  /** Límite derecho para etiquetas junto a las marcas (antes de las columnas de valores). */
  limit: number;
  zX: number;
  distX: number | null;
  xOf: (v: number) => number;
}

function marksX(r: Row, xOf: (v: number) => number): number[] {
  if (r.kind === 'ils') return [xOf(r.ils.best.handlingCost)];
  if (!r.g) return [xOf(0)];
  return r.e ? [xOf(r.g.handlingCost), xOf(r.e.handlingDP)] : [xOf(r.g.handlingCost)];
}

function HandlingChart({ view }: { view: View }) {
  const { activeModel, actions } = useCatalog();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const visible = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [pressIdx, setPressIdx] = useState<number | null>(null);
  const rowRefs = useRef<(SVGGElement | null)[]>([]);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  const { rows, p3, inst } = view;
  const compact = width > 0 && width < COMPACT_BELOW;
  const ML = compact ? 74 : 132;
  const MR = compact ? 64 : 148;
  const scale = niceScale(Math.max(view.maxValue, 0.5), compact ? 3 : 4);
  const innerW = Math.max(0, width - ML - MR);
  const plotRight = ML + innerW;
  const xOf = (v: number) => ML + (clamp(Number.isFinite(v) ? v : 0, 0, scale.max) / scale.max) * innerW;
  const lay: Layout = { compact, ML, plotRight, limit: plotRight + 8, zX: width - 3, distX: compact ? null : width - 78, xOf };

  const rowTop = (i: number) => TOP + i * ROW_H + (rows[i]?.kind === 'ils' ? SEP : 0);
  const plotBottom = rowTop(rows.length - 1) + ROW_H;
  const height = plotBottom + AXIS_H;
  const ilsIdx = rows.findIndex((r) => r.kind === 'ils');

  const currentIdx = rows.findIndex((r) => r.kind === 'gurobi' && r.id === activeModel && !!r.g);
  const pointerIdx = hoverIdx ?? focusIdx;
  // Un índice enfocado que ya no existe (otra instancia sin fila ILS) dejaría el gráfico sin parada de Tab
  const tabStop = focusIdx !== null && focusIdx < rows.length ? focusIdx : currentIdx >= 0 ? currentIdx : 0;

  const activate = (i: number) => {
    const target = rows[i] ? targetOf(rows[i], p3) : null;
    if (target) actions.selectModel(target);
  };
  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      activate(i);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    rowRefs.current[next]?.focus();
  };

  const active = pointerIdx !== null ? (rows[pointerIdx] ?? null) : null;
  const anchor =
    active && pointerIdx !== null
      ? { x: clamp(Math.max(...marksX(active, xOf)) + 12, ML, width), y: rowTop(pointerIdx) + ROW_H / 2 }
      : null;

  const withEval = view.gurobi.filter(isEval);
  const anySaving = withEval.some((r) => r.g.handlingCost - r.e.handlingDP > COST_EPS);
  const anyHigher = withEval.some((r) => r.e.handlingDP - r.g.handlingCost > COST_EPS);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-zinc-800/70 py-2.5" role="group" aria-label="Leyenda">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
          <span className="inline-flex items-center gap-[3px]">
            {MODELS.map((m) => (
              <MethodMark key={m.id} tone={m.tone} size={11} />
            ))}
          </span>
          Gurobi (su propia política)
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
          <MethodMark tone="dp" />
          {HEUR_METHODS.dp.label} en la misma ruta
        </span>
        {view.ilsRow && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
            <MethodMark tone="ils" />
            ILS (Algoritmo 4.2)
          </span>
        )}
        {p3 && (
          <LegendItem kind="dash" color={METHOD_COLOR.p3}>
            Manipulación de Gurobi P3
          </LegendItem>
        )}
        {anySaving && (
          <LegendItem kind="line" color={METHOD_COLOR.dp}>
            Ahorro de la DP
          </LegendItem>
        )}
        {anyHigher && (
          <LegendItem kind="line" color={NEUTRAL}>
            DP por encima
          </LegendItem>
        )}
        <span className="text-[11.5px] text-zinc-500">Escala: 0 → {fmtAuto(scale.max, 2)}</span>
      </div>

      <div
        ref={wrapRef}
        className="relative mt-3 w-full"
        style={{ height }}
        onPointerLeave={() => {
          setHoverIdx(null);
          setPressIdx(null);
        }}
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-labelledby={`${titleId} ${descId}`}
            className="block overflow-visible select-none"
          >
            <title id={titleId}>{`Manipulación por ruta en la instancia ${inst.instanceId} de ${inst.numCustomers} clientes`}</title>
            <desc id={descId}>
              Una fila por ruta Gurobi (General, Política 1, 2 y 3): la marca del modelo es la manipulación que pagó Gurobi y el triángulo, la
              del Algoritmo 2.1 + DP en esa misma ruta. La última fila es el ILS. La línea discontinua es la manipulación de Gurobi P3. Flechas
              arriba y abajo para recorrer, Enter para cargar la ruta en el simulador.
            </desc>

            {/* Encabezados de columnas */}
            <g aria-hidden fontSize={10} fill={MUTED}>
              <text x={8} y={TOP - 10}>
                {compact ? 'Ruta' : 'Ruta Gurobi'}
              </text>
              {lay.distX !== null && (
                <text x={lay.distX} y={TOP - 10} textAnchor="end">
                  Distancia
                </text>
              )}
              <text x={lay.zX} y={TOP - 10} textAnchor="end">
                Z
              </text>
            </g>

            {/* Rejilla vertical + eje */}
            <g aria-hidden>
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={xOf(t)}
                    x2={xOf(t)}
                    y1={TOP - 2}
                    y2={plotBottom}
                    stroke={t === 0 ? COLOR.axis : COLOR.grid}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={xOf(t)}
                    y={plotBottom + 15}
                    textAnchor={t === 0 ? 'start' : t === scale.max ? 'end' : 'middle'}
                    fill={MUTED}
                    fontSize={10.5}
                    className="num"
                  >
                    {fmtAuto(t, 2)}
                  </text>
                </g>
              ))}
              <text x={ML} y={plotBottom + 31} fill={COLOR.label} fontSize={10.5}>
                {compact ? 'Manipulación →' : 'Costo de manipulación →'}
              </text>
            </g>

            {/* Separador antes del ILS */}
            {ilsIdx > 0 && (
              <line
                aria-hidden
                x1={0}
                x2={width}
                y1={rowTop(ilsIdx) - SEP / 2}
                y2={rowTop(ilsIdx) - SEP / 2}
                stroke={COLOR.axis}
                strokeWidth={1}
                strokeDasharray="2 4"
                shapeRendering="crispEdges"
              />
            )}

            {/* Referencia: manipulación de Gurobi P3 */}
            {p3 && <P3Reference x={xOf(p3.handlingCost)} lay={lay} bottom={plotBottom} visible={visible} />}

            {/* Filas */}
            {rows.map((r, i) => (
              <RowGraphic
                key={r.id}
                row={r}
                index={i}
                y={rowTop(i)}
                width={width}
                lay={lay}
                p3={p3}
                instKey={inst.key}
                current={i === currentIdx}
                highlighted={i === pointerIdx}
                pressed={i === pressIdx}
                visible={visible}
              />
            ))}

            {/* Interacción por fila */}
            <g>
              {rows.map((r, i) => {
                const target = targetOf(r, p3);
                return (
                  <g
                    key={r.id}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    role="button"
                    tabIndex={i === tabStop ? 0 : -1}
                    aria-disabled={target ? undefined : true}
                    aria-current={i === currentIdx ? 'true' : undefined}
                    aria-label={r.kind === 'gurobi' ? gurobiLabel(r, i === currentIdx) : ilsLabel(r, p3)}
                    className={cn('group outline-none', target ? 'cursor-pointer' : 'cursor-default')}
                    onPointerEnter={() => setHoverIdx(i)}
                    onPointerDown={() => setPressIdx(i)}
                    onPointerUp={() => setPressIdx(null)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => activate(i)}
                    onFocus={() => setFocusIdx(i)}
                    onBlur={() => setFocusIdx(null)}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    <rect x={0} y={rowTop(i)} width={width} height={ROW_H} fill="transparent" />
                    <rect
                      x={1}
                      y={rowTop(i) + 1}
                      width={Math.max(0, width - 2)}
                      height={ROW_H - 2}
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

        <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={8} minTop={-40} maxBottom={height}>
          {active && <RowTip row={active} p3={p3} current={pointerIdx === currentIdx} />}
        </ChartTooltip>
      </div>

      <DataTable view={view} />
    </>
  );
}

/** Línea discontinua en la manipulación de Gurobi P3, con su etiqueta sobre la primera fila. */
function P3Reference({ x, lay, bottom, visible }: { x: number; lay: Layout; bottom: number; visible: boolean }) {
  const label = lay.compact ? 'P3' : 'Gurobi P3';
  const w = textW(label, 10);
  // La etiqueta no invade las columnas de texto a los lados del área de trazado
  const dx = clamp(x, lay.ML + w / 2, Math.max(lay.ML + w / 2, lay.plotRight - w / 2)) - x;
  return (
    <motion.g
      aria-hidden
      initial={{ opacity: 0, x }}
      animate={{ opacity: visible ? 1 : 0, x }}
      transition={{ ...spring, opacity: { ...springSoft, delay: visible ? 0.1 : 0 } }}
    >
      <line x1={0} x2={0} y1={TOP - 4} y2={bottom} stroke={METHOD_COLOR.p3} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" />
      <text x={dx} y={TOP - 10} textAnchor="middle" fontSize={10} fontWeight={500} fill={METHOD_COLOR.p3}>
        {label}
      </text>
    </motion.g>
  );
}

interface RowGraphicProps {
  row: Row;
  index: number;
  y: number;
  width: number;
  lay: Layout;
  p3: TourCost | null;
  instKey: string;
  current: boolean;
  highlighted: boolean;
  pressed: boolean;
  visible: boolean;
}

function RowGraphic({ row, index, y, width, lay, p3, instKey, current, highlighted, pressed, visible }: RowGraphicProps) {
  const cy = y + ROW_H / 2;
  const delay = visible ? 0.07 * index : 0;
  // Micro-interacción: las marcas crecen en hover/foco y se comprimen al pulsar
  const emphasis = pressed ? 0.92 : highlighted ? 1.16 : 1;
  return (
    <g aria-hidden>
      {(current || highlighted) && (
        <rect x={0} y={y + 1} width={width} height={ROW_H - 2} rx={10} fill={current ? 'rgb(255 255 255 / 0.055)' : 'rgb(255 255 255 / 0.03)'} />
      )}
      {current && <rect x={0} y={y + 10} width={3} height={ROW_H - 20} rx={1.5} fill={COLOR.ink} />}
      <RowLabel row={row} cy={cy} compact={lay.compact} current={current} />
      {row.kind === 'gurobi' ? (
        <GurobiMarks row={row} cy={cy} lay={lay} visible={visible} delay={delay} emphasis={emphasis} instKey={instKey} />
      ) : (
        <IlsMarks row={row} cy={cy} lay={lay} p3={p3} visible={visible} delay={delay} emphasis={emphasis} />
      )}
      <RowValues row={row} cy={cy} lay={lay} p3={p3} />
    </g>
  );
}

function RowLabel({ row, cy, compact, current }: { row: Row; cy: number; compact: boolean; current: boolean }) {
  const tone: MethodTone = row.kind === 'gurobi' ? row.model.tone : 'ils';
  const name = row.kind === 'gurobi' ? (compact ? row.model.short : row.model.label) : compact ? 'ILS' : 'ILS · Alg. 4.2';
  const rel = compact ? REL_TEXT[row.rel].short : REL_TEXT[row.rel].long;
  // Las excepciones (otra ruta, sentido inverso) se leen con más contraste que el caso común
  const relColor = row.rel === 'other' || row.rel === 'reversed' ? COLOR.label : MUTED;
  return (
    <g>
      <MethodMarkSvg tone={tone} x={11} y={cy - 6} r={4.25} />
      <text x={23} y={cy - 2} fontSize={12} fontWeight={current ? 600 : 500} fill={current ? COLOR.ink : '#e4e4e7'}>
        {name}
      </text>
      {rel && (
        <text x={23} y={cy + 12} fontSize={10.5} fill={relColor}>
          {rel}
        </text>
      )}
    </g>
  );
}

/** Coloca una etiqueta junto a un grupo de marcas: a la derecha si cabe; si no, a la izquierda. */
function beside(lo: number, hi: number, w: number, limit: number): { x: number; anchor: 'start' | 'end' } {
  return hi + 10 + w <= limit ? { x: hi + 10, anchor: 'start' } : { x: lo - 10, anchor: 'end' };
}

/** "✓ texto" junto a marcas que coinciden. */
function CheckLabel({ lo, hi, cy, text, limit, visible, delay }: { lo: number; hi: number; cy: number; text: string; limit: number; visible: boolean; delay: number }) {
  const w = 12 + textW(text, 10.5);
  const pos = beside(lo, hi, w, limit);
  const x0 = pos.anchor === 'start' ? pos.x : pos.x - w;
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: visible ? 1 : 0 }} transition={{ ...springSoft, delay: delay + 0.3 }}>
      <path
        d={`M${x0 + 0.5},${cy} l2.6,2.6 l4.9,-5.4`}
        fill="none"
        stroke={OK}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={x0 + 12} y={cy + 3.5} fontSize={10.5} fill={OK} fontWeight={500}>
        {text}
      </text>
    </motion.g>
  );
}

interface MarksProps {
  cy: number;
  lay: Layout;
  visible: boolean;
  delay: number;
  emphasis: number;
}

/** Transición de una marca: posición con resorte escalonado; énfasis (hover/pulsación) inmediato. */
const markTransition = (delay: number): Transition => ({ ...spring, delay, scale: springSnappy });

function GurobiMarks({ row, cy, lay, visible, delay, emphasis, instKey }: MarksProps & { row: GurobiRow; instKey: string }) {
  const { g, e, model } = row;
  const { xOf, limit } = lay;
  const x0 = xOf(0);
  if (!g || !Number.isFinite(g.handlingCost)) {
    return (
      <text x={x0 + 8} y={cy + 3.5} fontSize={11} fill={MUTED}>
        Sin solución exportada
      </text>
    );
  }

  const xg = xOf(g.handlingCost);
  // Una DP sin valor finito se trata como «sin DP» (evita etiquetas «−—»)
  const dp = e && Number.isFinite(e.handlingDP) ? e.handlingDP : null;
  const same = dp !== null && sameCost(dp, g.handlingCost);
  const saves = dp !== null && !same && dp < g.handlingCost;
  const xd = dp !== null ? xOf(dp) : xg;
  const lo = Math.min(xg, xd);
  const hi = Math.max(xg, xd);
  // Si coinciden, las dos marcas se apilan en la misma x
  const dyG = same ? STACK : 0;
  const dyD = same ? -STACK : 0;

  let note: ReactNode = null;
  if (dp === null) {
    const pos = beside(xg, xg, textW('sin DP', 10.5), limit);
    note = (
      <text x={pos.x} y={cy + 3.5} textAnchor={pos.anchor} fontSize={10.5} fill={MUTED}>
        sin DP
      </text>
    );
  } else if (same) {
    note = <CheckLabel lo={xg} hi={xg} cy={cy} text="coincide" limit={limit} visible={visible} delay={delay} />;
  } else {
    const label = fmtDelta(dp - g.handlingCost);
    const w = textW(label, 10.5);
    // Sobre el tramo si es lo bastante largo; si no, al costado de las marcas
    const above = hi - lo >= w + 18;
    const pos = above ? { x: (lo + hi) / 2, anchor: 'middle' as const } : beside(lo, hi, w, limit);
    note = (
      <motion.text
        x={pos.x}
        y={above ? cy - 9 : cy + 3.5}
        textAnchor={pos.anchor}
        fontSize={10.5}
        fontWeight={500}
        fill={saves ? METHOD_COLOR.dp : COLOR.label}
        stroke={COLOR.surface}
        strokeWidth={3}
        paintOrder="stroke"
        className="num"
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ ...springSoft, delay: delay + 0.3 }}
      >
        {label}
      </motion.text>
    );
  }

  return (
    <g>
      {/* Tallo desde 0 hasta la marca más baja */}
      <motion.line
        x1={x0}
        x2={lo}
        y1={cy}
        y2={cy}
        stroke={COLOR.axis}
        strokeWidth={1}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ ...springSoft, delay }}
      />
      {/* Tramo Gurobi → DP (se vuelve a trazar al cambiar de instancia) */}
      {dp !== null && !same && (
        <motion.line
          key={instKey}
          x1={xg}
          x2={xd}
          y1={cy}
          y2={cy}
          stroke={saves ? METHOD_COLOR.dp : NEUTRAL}
          strokeOpacity={saves ? 0.75 : 0.95}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={visible ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ ...springSoft, delay: delay + 0.18 }}
        />
      )}
      <motion.g
        initial={{ opacity: 0, x: x0, y: cy, scale: 1 }}
        animate={visible ? { opacity: 1, x: xg, y: cy + dyG, scale: emphasis } : { opacity: 0, x: x0, y: cy, scale: 1 }}
        transition={markTransition(delay)}
      >
        <MethodMarkSvg tone={model.tone} x={0} y={0} r={4.75} />
      </motion.g>
      {dp !== null && (
        // ▲ parte desde la marca de Gurobi: la DP "mueve" la manipulación de esa misma ruta
        <motion.g
          initial={{ opacity: 0, x: xg, y: cy, scale: 1 }}
          animate={visible ? { opacity: 1, x: xd, y: cy + dyD, scale: emphasis } : { opacity: 0, x: xg, y: cy, scale: 1 }}
          transition={markTransition(delay + 0.16)}
        >
          <MethodMarkSvg tone="dp" x={0} y={0} r={4.5} />
        </motion.g>
      )}
      {note}
    </g>
  );
}

function IlsMarks({ row, cy, lay, p3, visible, delay, emphasis }: MarksProps & { row: IlsRow; p3: TourCost | null }) {
  const b = row.ils.best;
  const { xOf, limit } = lay;
  const x0 = xOf(0);
  const xi = xOf(b.handlingCost);
  const equalZ = p3 ? sameCost(b.objectiveValue, p3.objectiveValue) : false;
  const gap = p3 ? relGap(b.objectiveValue, p3.objectiveValue) : null;

  let note: ReactNode = null;
  if (equalZ) note = <CheckLabel lo={xi} hi={xi} cy={cy} text="Z* de P3" limit={limit} visible={visible} delay={delay} />;
  else if (gap !== null) {
    const label = `Z ${signedPct(gap)}`;
    const pos = beside(xi, xi, textW(label, 10.5), limit);
    note = (
      <motion.text
        x={pos.x}
        y={cy + 3.5}
        textAnchor={pos.anchor}
        fontSize={10.5}
        fill={COLOR.label}
        className="num"
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ ...springSoft, delay: delay + 0.3 }}
      >
        {label}
      </motion.text>
    );
  }

  return (
    <g>
      <motion.line
        x1={x0}
        x2={xi}
        y1={cy}
        y2={cy}
        stroke={COLOR.axis}
        strokeWidth={1}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ ...springSoft, delay }}
      />
      <motion.g
        initial={{ opacity: 0, x: x0, y: cy, scale: 1 }}
        animate={visible ? { opacity: 1, x: xi, y: cy, scale: emphasis } : { opacity: 0, x: x0, y: cy, scale: 1 }}
        transition={markTransition(delay)}
      >
        <MethodMarkSvg tone="ils" x={0} y={0} r={4.75} />
      </motion.g>
      {note}
    </g>
  );
}

/** Columnas de la derecha: distancia (si hay espacio) y Z, con el Z de la heurística debajo. */
function RowValues({ row, cy, lay, p3 }: { row: Row; cy: number; lay: Layout; p3: TourCost | null }) {
  let dist: number | null;
  let z: number | null;
  let sub: { text: string; color: string; mark: boolean } | null = null;

  if (row.kind === 'gurobi') {
    const { g, e } = row;
    dist = g?.totalDistance ?? null;
    z = g?.objectiveValue ?? null;
    if (g && e) {
      const same = sameCost(e.handlingDP, g.handlingCost);
      const saves = !same && e.handlingDP < g.handlingCost;
      sub = { text: fmt(e.objectiveDP), color: saves ? METHOD_COLOR.dp : same ? MUTED : COLOR.label, mark: true };
    } else if (g) sub = { text: 'sin DP', color: MUTED, mark: false };
  } else {
    const b = row.ils.best;
    dist = b.totalDistance;
    z = b.objectiveValue;
    if (p3)
      sub = sameCost(b.objectiveValue, p3.objectiveValue)
        ? { text: '= P3', color: OK, mark: false }
        : { text: signedPct(relGap(b.objectiveValue, p3.objectiveValue)), color: COLOR.label, mark: false };
  }

  const subW = sub ? textW(sub.text, 10.5) : 0;
  return (
    <g>
      {lay.distX !== null && (
        <text x={lay.distX} y={cy + 4} textAnchor="end" fontSize={11} fill={COLOR.label} className="num">
          {dist === null ? '—' : fmtKm(dist)}
        </text>
      )}
      <text x={lay.zX} y={cy - 2} textAnchor="end" fontSize={12} fontWeight={500} fill={COLOR.ink} className="num">
        {z === null ? '—' : fmt(z)}
      </text>
      {sub && (
        <>
          {sub.mark && <MethodMarkSvg tone="dp" x={lay.zX - subW - 6} y={cy + 8.2} r={2.6} />}
          <text x={lay.zX} y={cy + 12} textAnchor="end" fontSize={10.5} fill={sub.color} className="num">
            {sub.text}
          </text>
        </>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────── Tooltip y etiquetas accesibles

function RowTip({ row, p3, current }: { row: Row; p3: TourCost | null; current: boolean }) {
  if (row.kind === 'gurobi') {
    const { g, e, model } = row;
    if (!g) {
      return (
        <>
          <TipHeader aside={<Chip tone={model.tone}>{model.short}</Chip>}>Ruta de {model.label}</TipHeader>
          <p className="text-[12px] text-zinc-400">Sin solución exportada para este modelo.</p>
        </>
      );
    }
    const generalBelow = row.id === 'TSPPD-H' && !!e && e.handlingDP - g.handlingCost > COST_EPS;
    return (
      <>
        <TipHeader aside={<Chip tone={model.tone}>{model.short}</Chip>}>Ruta de {model.label}</TipHeader>
        <p className="mb-1.5 font-mono text-[11px] leading-4 text-zinc-300">{routeText(g.tour)}</p>
        <TipRow color={COLOR.dist} value={fmtKm(g.totalDistance)} label={row.rel === 'unknown' ? 'distancia' : `distancia · ${REL_TEXT[row.rel].long}`} />
        <TipRow color={METHOD_COLOR[model.tone]} value={fmt(g.handlingCost)} label={`Gurobi (${model.label})`} />
        {e ? (
          <>
            <TipRow color={METHOD_COLOR.dp} value={fmt(e.handlingDP)} label="Alg. 2.1 + DP (P3 óptima)" />
            <TipRow color={METHOD_COLOR.p1} dashed value={fmt(e.handlingP1)} label="solo Política 1" />
            <TipRow color={METHOD_COLOR.p2} dashed value={fmt(e.handlingP2)} label="solo Política 2" />
            <div className="mt-1.5 border-t border-zinc-800 pt-1.5">
              <TipRow value={`${fmt(g.objectiveValue)} → ${fmt(e.objectiveDP)}`} label="Z Gurobi → con DP" />
            </div>
          </>
        ) : (
          <p className="mt-1 text-[11.5px] text-zinc-400">Sin evaluación de la DP para esta ruta.</p>
        )}
        {generalBelow && (
          <p className="mt-1.5 text-[11.5px] leading-snug text-pretty text-zinc-400">
            Sin política fija, el modelo general puede manipular menos que la mejor Política 3: es esperable.
          </p>
        )}
        <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[11px] text-zinc-500">
          {current ? 'Cargada en el simulador' : 'Clic para cargarla en el simulador'}
        </p>
      </>
    );
  }

  const { ils } = row;
  const b = ils.best;
  const gap = p3 ? relGap(b.objectiveValue, p3.objectiveValue) : null;
  const equalZ = p3 ? sameCost(b.objectiveValue, p3.objectiveValue) : false;
  const hit = earliestHit(ils);
  const run = reportedRun(ils);
  return (
    <>
      <TipHeader aside={<Chip tone="ils">ILS</Chip>}>Algoritmo 4.2</TipHeader>
      <p className="mb-1.5 font-mono text-[11px] leading-4 text-zinc-300">{routeText(b.tour)}</p>
      <TipRow color={COLOR.dist} value={fmtKm(b.totalDistance)} label={row.rel === 'unknown' ? 'distancia' : `distancia · ${REL_TEXT[row.rel].long}`} />
      <TipRow color={METHOD_COLOR.ils} value={fmt(b.handlingCost)} label="manipulación (DP exacta)" />
      <TipRow color={METHOD_COLOR.p1} dashed value={fmt(b.handlingP1)} label="solo Política 1" />
      <TipRow color={METHOD_COLOR.p2} dashed value={fmt(b.handlingP2)} label="solo Política 2" />
      <div className="mt-1.5 border-t border-zinc-800 pt-1.5">
        <TipRow value={fmt(b.objectiveValue)} label={p3 ? (equalZ ? `Z = Z* de Gurobi P3` : `Z · ${signedPct(gap)} vs Gurobi P3`) : 'Z'} />
      </div>
      {hit && (
        <p className="mt-1 text-[11.5px] text-zinc-400">
          {hit.it === 0
            ? 'Mejor desde la solución inicial'
            : `Mejor desde la iteración ${hit.it}${nIterOf(ils) === null ? '' : ` de ${fmt(nIterOf(ils), 0)}`}`}{' '}
          · sentido{' '}
          {hit.dir === 1 ? 'original' : 'inverso'}
          {run && ` · corrida reportada: semilla ${run.seed}, la mejor de ${run.runs}`}
        </p>
      )}
      <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[11px] text-zinc-500">
        {row.rel === 'same' && p3 ? 'Clic para cargar la ruta (la de P3) en el simulador' : 'Esta ruta no está en el catálogo del simulador'}
      </p>
    </>
  );
}

function gurobiLabel(r: GurobiRow, current: boolean): string {
  const { model, g, e } = r;
  if (!g) return `Ruta de ${model.label}: sin solución exportada en esta instancia.`;
  const rel = r.rel === 'unknown' ? '' : `, ${REL_TEXT[r.rel].long}`;
  let s = `Ruta de ${model.label}${rel}, ${fmtKm(g.totalDistance)}: Gurobi manipula ${fmt(g.handlingCost)}`;
  if (e) {
    const d = e.handlingDP - g.handlingCost;
    s += `; el Algoritmo 2.1 + DP, en la misma ruta, ${fmt(e.handlingDP)} (${sameCost(e.handlingDP, g.handlingCost) ? 'coincide' : fmtDelta(d)})`;
    s += `; con solo Política 1 serían ${fmt(e.handlingP1)} y con solo Política 2, ${fmt(e.handlingP2)}`;
    if (r.id === 'TSPPD-H' && d > COST_EPS) s += '. Sin política fija, el modelo general puede manipular menos que la mejor Política 3; es esperable';
    s += `. Z Gurobi ${fmt(g.objectiveValue)}, Z con DP ${fmt(e.objectiveDP)}`;
  } else s += '; sin evaluación de la DP';
  return `${s}. ${current ? 'Es el modelo cargado en el simulador.' : 'Enter para cargar esta ruta en el simulador.'}`;
}

function ilsLabel(r: IlsRow, p3: TourCost | null): string {
  const b = r.ils.best;
  const rel = r.rel === 'unknown' ? '' : `, ${REL_TEXT[r.rel].long}`;
  let s = `ILS, Algoritmo 4.2${rel}, ${fmtKm(b.totalDistance)}: manipulación ${fmt(b.handlingCost)}, Z ${fmt(b.objectiveValue)}`;
  if (p3) {
    s += sameCost(b.objectiveValue, p3.objectiveValue)
      ? `, igual al Z* de Gurobi P3 (${fmt(p3.objectiveValue)})`
      : `, ${signedPct(relGap(b.objectiveValue, p3.objectiveValue))} frente al Z* de Gurobi P3 (${fmt(p3.objectiveValue)})`;
  }
  return `${s}. ${r.rel === 'same' && p3 ? 'Enter para cargar esa misma ruta (la de P3) en el simulador.' : 'Su ruta no está en el catálogo del simulador.'}`;
}

// ─────────────────────────────────────────────────────────────── Lectura de los datos

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

/** Lecturas calculadas: validación, rutas compartidas, ahorro, modelo general e ILS. */
function Insights({ view }: { view: View }) {
  const items = useMemo(() => insightsOf(view), [view]);
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

function insightsOf(view: View): ReactNode[] {
  const { gurobi, ilsRow, p3, p3Eval } = view;
  const items: ReactNode[] = [];
  const withEval = gurobi.filter(isEval);
  const present = gurobi.filter((r): r is GurobiRow & { g: TourCost } => !!r.g);

  // 1 · Validación: la DP sobre la ruta de P3 debe dar la manipulación de Gurobi P3
  if (p3Eval) {
    items.push(
      sameCost(p3Eval.handlingDP, p3Eval.gurobiHandling) ? (
        <>
          Sobre la ruta de la Política 3, el Algoritmo 2.1 + DP reproduce la manipulación óptima de Gurobi (<Em>{fmt(p3Eval.gurobiHandling)}</Em>):
          con la ruta fija, la DP resuelve exactamente la política híbrida.
        </>
      ) : (
        <>
          Sobre la ruta de la Política 3, la DP obtiene <Em>{fmt(p3Eval.handlingDP)}</Em> y Gurobi <Em>{fmt(p3Eval.gurobiHandling)}</Em> (
          <Em>{fmtDelta(p3Eval.handlingDP - p3Eval.gurobiHandling)}</Em>): no coinciden; conviene revisar los archivos de esta instancia.
        </>
      ),
    );
  }

  // 2 · ¿Comparten ruta los modelos Gurobi?
  if (present.length > 1 && p3) {
    const dists = present.map((r) => r.g.totalDistance).concat(ilsRow ? [ilsRow.ils.best.totalDistance] : []);
    const sameDist = Math.max(...dists) - Math.min(...dists) < 1e-6;
    const differ = present.filter((r) => r.rel === 'reversed' || r.rel === 'other');
    if (!differ.length) {
      const dps = withEval.map((r) => r.e.handlingDP);
      const oneDp = dps.length > 1 && dps.every((v) => sameCost(v, dps[0]));
      items.push(
        <>
          {present.length === 4 ? 'Los cuatro modelos Gurobi' : `Los ${present.length} modelos Gurobi disponibles`} usan la misma ruta
          {sameDist && (
            <>
              {' '}
              (<Em>{fmtKm(dists[0])}</Em>)
            </>
          )}
          : sus diferencias de Z son solo de manipulación
          {oneDp && (
            <>
              , y la DP las lleva todas a <Em>{fmt(dps[0])}</Em>
            </>
          )}
          .
        </>,
      );
    } else {
      const parts = differ.map((r) => `${NAME_OF[r.id]} ${r.rel === 'reversed' ? 'recorre la ruta de P3 en sentido inverso' : 'usa otra ruta'}`);
      const evald = differ.filter(isEval);
      // DP frente a DP: lo que obtiene la DP en la ruta de P3 (si falta, la manipulación de Gurobi P3)
      const p3Dp = p3Eval?.handlingDP ?? p3.handlingCost;
      const changes = evald.some((r) => !sameCost(r.e.handlingDP, p3Dp));
      items.push(
        <>
          {cap(joinEs(parts))}
          {sameDist && (
            <>
              , aunque todas miden <Em>{fmtKm(dists[0])}</Em>
            </>
          )}
          .
          {evald.length > 0 && (
            <>
              {' '}
              En {evald.length === 1 ? 'esa ruta' : 'esas rutas'} la DP obtiene{' '}
              {evald.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && (i === evald.length - 1 ? ' y ' : ', ')}
                  <Em>{fmt(r.e.handlingDP)}</Em> ({r.model.short})
                </span>
              ))}
              , frente a <Em>{fmt(p3Dp)}</Em> en la de P3
              {changes ? ': con otro orden de visita cambia qué unidades bloquean a otras.' : '.'}
            </>
          )}
        </>,
      );
    }
  }

  // 3 · Mayor ahorro de la DP frente a la manipulación de Gurobi en la misma ruta
  const savings = withEval
    .map((r) => ({ r, s: r.g.handlingCost - r.e.handlingDP }))
    .filter((x) => x.s > COST_EPS)
    .sort((a, b) => b.s - a.s);
  if (savings.length) {
    const { r, s } = savings[0];
    const pols = Object.values(r.e.policies ?? {});
    const mixes = pols.includes(1) && pols.includes(2);
    const p2Count = pols.filter((p) => p === 2).length;
    const rest = savings.slice(1);
    items.push(
      <>
        El mayor ahorro de la DP está en la ruta {ROUTE_OF[r.id]}: baja la manipulación de <Em>{fmt(r.g.handlingCost)}</Em> a{' '}
        <Em>{fmt(r.e.handlingDP)}</Em> (<Em>{fmtDelta(-s)}</Em>, <Em>−{fmtPct(r.g.handlingCost > 0 ? s / r.g.handlingCost : 0)}</Em>) y Z de{' '}
        <Em>{fmt(r.g.objectiveValue)}</Em> a <Em>{fmt(r.e.objectiveDP)}</Em>
        {mixes && (r.id === 'TSPPD-H_1' || r.id === 'TSPPD-H_2') && (
          <>
            , porque combina ambas políticas según el cliente (la 2 en <Em>{p2Count}</Em> de <Em>{pols.length}</Em> clientes)
          </>
        )}
        .
        {rest.length > 0 && (
          <>
            {' '}
            En {rest.length === 1 ? 'la ruta' : 'las rutas'}{' '}
            {rest.map((x, i) => (
              <span key={x.r.id}>
                {i > 0 && (i === rest.length - 1 ? ' y ' : ', ')}
                {ROUTE_OF[x.r.id]} (<Em>{fmtDelta(-x.s)}</Em>, <Em>−{fmtPct(x.r.g.handlingCost > 0 ? x.s / x.r.g.handlingCost : 0)}</Em>)
              </span>
            ))}{' '}
            también ahorra.
          </>
        )}
      </>,
    );
  } else if (withEval.length) {
    items.push(<>La DP no reduce la manipulación de ninguna ruta Gurobi: en cada una, Gurobi ya manipula lo mismo o menos que la mejor Política 3.</>);
  }

  // 4 · Modelo general (sin política): puede manipular menos que la DP
  const gen = withEval.find((r) => r.id === 'TSPPD-H');
  if (gen && Number.isFinite(gen.g.handlingCost) && Number.isFinite(gen.e.handlingDP)) {
    const gh = gen.g.handlingCost;
    const dh = gen.e.handlingDP;
    items.push(
      sameCost(gh, dh) ? (
        <>
          En la ruta del modelo general la DP iguala su manipulación (<Em>{fmt(gh)}</Em>): aquí la Política 3 no le cuesta nada al modelo sin
          política.
        </>
      ) : gh < dh ? (
        <>
          El modelo general manipula <Em>{fmt(gh)}</Em> en su ruta, <Em>{fmt(dh - gh)}</Em> menos que la DP (<Em>{fmt(dh)}</Em>): sin una política
          fija puede reubicar las unidades con libertad, y la Política 3 es una restricción de ese modelo. Es esperable, no un error.
        </>
      ) : (
        <>
          En la ruta del modelo general la DP manipula <Em>{fmt(dh)}</Em>, menos que Gurobi (<Em>{fmt(gh)}</Em>).
        </>
      ),
    );
  }

  // 5 · ILS frente al óptimo de Gurobi P3
  if (ilsRow) {
    const { ils, rel } = ilsRow;
    const b = ils.best;
    const hit = earliestHit(ils);
    const route =
      rel === 'same'
        ? ' con exactamente la misma ruta'
        : rel === 'reversed'
          ? ' con la ruta de P3 recorrida en sentido inverso'
          : rel === 'other'
            ? ' con otra ruta'
            : '';
    // La iteración es la de la corrida reportada (la mejor de las semillas), no la de todas
    const run = reportedRun(ils);
    const when: ReactNode =
      hit === null ? null : (
        <>
          ;{' '}
          {run && (
            <>
              en la corrida reportada (semilla <Em>{run.seed}</Em>, la mejor de <Em>{run.runs}</Em>){' '}
            </>
          )}
          llega a ese Z{' '}
          {hit.it === 0 ? (
            <>ya desde la solución inicial (TSP + reubicación del depósito, sentido {hit.dir === 1 ? 'original' : 'inverso'})</>
          ) : (
            <>
              en la iteración <Em>{hit.it}</Em>
              {nIterOf(ils) !== null && (
                <>
                  {' '}
                  de <Em>{fmt(nIterOf(ils), 0)}</Em>
                </>
              )}
            </>
          )}
        </>
      );
    if (p3) {
      const g = relGap(b.objectiveValue, p3.objectiveValue);
      const vs = (
        <>
          (<Em>{fmt(b.objectiveValue)}</Em> frente a <Em>{fmt(p3.objectiveValue)}</Em>)
        </>
      );
      items.push(
        sameCost(b.objectiveValue, p3.objectiveValue) ? (
          <>
            El ILS alcanza el Z* de Gurobi P3 (<Em>{fmt(p3.objectiveValue)}</Em>){route}
            {when}.
          </>
        ) : g === null ? (
          <>
            El ILS obtiene un Z distinto del de Gurobi P3 {vs}
            {route}
            {when}.
          </>
        ) : g < 0 ? (
          <>
            El ILS mejora en <Em>{fmtPct(-g, 2)}</Em> el Z de Gurobi P3 {vs}
            {route}
            {when}.
          </>
        ) : (
          <>
            El ILS queda un <Em>{fmtPct(g, 2)}</Em> por encima del Z de Gurobi P3 {vs}
            {route}
            {when}.
          </>
        ),
      );
    } else {
      items.push(
        <>
          El ILS obtiene Z = <Em>{fmt(b.objectiveValue)}</Em> con manipulación <Em>{fmt(b.handlingCost)}</Em>; no hay solución Gurobi P3 para
          compararlo.
        </>,
      );
    }
  }

  return items;
}

// ─────────────────────────────────────────────────────────────── Tabla accesible

function DataTable({ view }: { view: View }) {
  const { inst, gurobi, ilsRow } = view;
  const rel = (r: RouteRel) => (r === 'unknown' ? '' : ` (${REL_TEXT[r].long})`);
  return (
    <table className="sr-only">
      <caption>{`Manipulación por ruta en la instancia ${inst.instanceId} de ${inst.numCustomers} clientes: Gurobi frente al Algoritmo 2.1 + DP y el ILS`}</caption>
      <thead>
        <tr>
          <th scope="col">Método</th>
          <th scope="col">Ruta</th>
          <th scope="col">Distancia</th>
          <th scope="col">Manipulación Gurobi</th>
          <th scope="col">Manipulación de la heurística (Alg. 2.1 + DP o ILS)</th>
          <th scope="col">Solo Política 1</th>
          <th scope="col">Solo Política 2</th>
          <th scope="col">Z Gurobi</th>
          <th scope="col">Z de la heurística</th>
        </tr>
      </thead>
      <tbody>
        {gurobi.map((r) => (
          <tr key={r.id}>
            <th scope="row">{`Gurobi ${r.model.label}`}</th>
            <td>{r.g ? `${routeText(r.g.tour)}${rel(r.rel)}` : 'sin solución'}</td>
            <td>{r.g ? fmtKm(r.g.totalDistance) : '—'}</td>
            <td>{r.g ? fmt(r.g.handlingCost) : '—'}</td>
            <td>{r.e ? fmt(r.e.handlingDP) : 'sin DP'}</td>
            <td>{r.e ? fmt(r.e.handlingP1) : '—'}</td>
            <td>{r.e ? fmt(r.e.handlingP2) : '—'}</td>
            <td>{r.g ? fmt(r.g.objectiveValue) : '—'}</td>
            <td>{r.e ? fmt(r.e.objectiveDP) : '—'}</td>
          </tr>
        ))}
        {ilsRow && (
          <tr>
            <th scope="row">ILS · Algoritmo 4.2</th>
            <td>{`${routeText(ilsRow.ils.best.tour)}${rel(ilsRow.rel)}`}</td>
            <td>{fmtKm(ilsRow.ils.best.totalDistance)}</td>
            <td>no aplica</td>
            <td>{fmt(ilsRow.ils.best.handlingCost)}</td>
            <td>{fmt(ilsRow.ils.best.handlingP1)}</td>
            <td>{fmt(ilsRow.ils.best.handlingP2)}</td>
            <td>no aplica</td>
            <td>{fmt(ilsRow.ils.best.objectiveValue)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
