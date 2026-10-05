/**
 * «Tablas 8–9: detalle por instancia» de la sección «Metaheurísticas». Para un |Vc|, una fila por Id
 * con el Best del paper y el Z final de cada método desde el tour TSP («1 dir.») y desde el tour
 * invertido («2 dir.», por sí sola), exactamente como las Tablas 8–9 de Erdoğan et al. (2012); el
 * valor X-2dir del resto de la sección es el mínimo de ambas columnas. Tres vistas: nuestros Z, las
 * cifras del paper y la diferencia nuestro − paper por columna. Al pie, el tiempo medio por columna
 * (en la vista Paper, la fila «Time (s)» de la Tabla 9 y el tiempo por |Vc| de la Tabla 2).
 * Debajo, la convergencia de costCurrent por iteración de ILS e ITS en la instancia elegida.
 * Todo sale de aggregate.ts (InstanceRow) y export.ts (columnas, pie y LaTeX); aquí solo se presenta.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { motion, useInView } from 'motion/react';
import { Activity, CircleAlert } from 'lucide-react';
import type { MetaMethod, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto, fmtDelta } from '../../lib/format';
import { scrollBehavior, springSoft } from '../../lib/motion';
import { Disclosure, Segmented, SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, LegendItem, TipHeader, TipRow, clamp, niceStep, useElementWidth } from '../analysis/chart';
import { fmtNum, fmtPctValue, fmtSec } from '../benchmark/format';
import { CardHead, CopyLatexButton, Pending, STICKY_CELL, STICKY_ROW_HOVER } from '../benchmark/shared';
import { META_METHODS, type DirResult, type InstanceRow } from './aggregate';
import {
  DETAIL_COLS,
  PAPER_TIME_COLS,
  Z_TOL,
  detailFoot,
  detailPaper,
  detailResult,
  detailSec,
  hFor,
  hLabel,
  mean,
  minOf,
  toLatexMetaDetail,
  type DetailCol,
  type DetailDir,
  type DetailFoot,
  type MetaDetailView,
} from './export';
import { META_INFO, PAPER_COLOR, methodColor, methodDash, type MetaFamily } from './labels';
import { MetaMark, MetaMarkSvg, MethodSwatch, Sub, TD_NUM, methodHollow, methodShape } from './shared';

type Dir = DetailDir;
type ConvFamily = Exclude<MetaFamily, 'twophase'>;

const DIR_LABEL: Record<Dir, string> = { 1: '1 dir.', 2: '2 dir.' };
const DIR_TITLE: Record<Dir, string> = {
  1: '1 dir.: corrida desde el tour TSP (dirección 1)',
  2: '2 dir.: corrida desde el tour TSP invertido (dirección 2), por sí sola, como la columna «2 dir.» de las Tablas 8–9',
};

/** Métodos de cada panel de convergencia: [heurístico, exacto]. */
const CONV: Record<ConvFamily, readonly [MetaMethod, MetaMethod]> = {
  ils: ['ils-heuristic', 'ils-exact'],
  its: ['its-heuristic', 'its-exact'],
};
const CONV_METHODS: MetaMethod[] = [...CONV.ils, ...CONV.its];
/** Iteraciones nominales (Niter = 200; ITS: N*iter = ⌊√200⌋) si un registro no trae `history`. */
const NOMINAL_ITERS: Record<ConvFamily, number> = { ils: 200, its: 14 };
const FAMILY_TITLE: Record<ConvFamily, string> = { ils: 'ILS · Algoritmo 4.2', its: 'ITS · Algoritmo 4.3' };

/* ───────────────────────── Lecturas ───────────────────────── */

const hasResults = (r: InstanceRow, methods: readonly MetaMethod[] = META_METHODS) =>
  methods.some((m) => r.cells[m].dir1 !== null || r.cells[m].dir2 !== null);

const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/* ───────────────────────── Piezas ───────────────────────── */

/** Punto verde: Z menor que el Best del paper. */
function BeatsDot() {
  return <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ok align-[2px]" />;
}

/* ───────────────────────── Celdas ───────────────────────── */

function oursTitle(row: InstanceRow, col: DetailCol, res: DirResult, pz: number | null, beats: boolean, isMin: boolean): string {
  const info = META_INFO[col.method];
  const parts = [`${info.label} · ${DIR_LABEL[col.dir]}: Z = ${fmtNum(res.z, 2)}`];
  if (col.method === 'twophase') {
    parts.push('tour TSP con el depósito reubicado + manipulación óptima (Alg. 2.1 + DP)');
    parts.push(`${fmtSec(detailSec(row, col, res))} s con el tour TSP`);
  } else {
    parts.push(`inicial ${fmtNum(res.zInitial, 2)}`);
    parts.push(
      res.improved
        ? `mejor en la iteración ${res.bestIteration ?? '—'}${res.improvements ? ` (${plural(res.improvements, 'mejora', 'mejoras')})` : ''}`
        : 'no mejoró la solución inicial',
    );
    parts.push(`${fmtSec(res.sec)} s sin el tour TSP`);
  }
  if (pz !== null) parts.push(`paper ${fmtNum(pz, 2)}`);
  if (beats && row.best !== null) parts.push(`menor que el Best del paper (${fmtNum(row.best, 2)})`);
  if (isMin) parts.push('menor de la fila');
  return parts.join(' · ');
}

function DetailCell({ row, col, view, rowMin }: { row: InstanceRow; col: DetailCol; view: MetaDetailView; rowMin: number | null }) {
  const info = META_INFO[col.method];
  const name = `${info.label} · ${DIR_LABEL[col.dir]}`;
  const res = detailResult(row, col);
  const pz = detailPaper(row, col);
  const errors = row.cells[col.method].errors;
  const edge = col.dir === 1 && 'border-l border-l-zinc-800';

  if (view === 'paper') {
    if (pz === null)
      return (
        <td title={`${name}: instancia fuera de las Tablas 8–9`} className={cn(TD_NUM, edge, 'text-zinc-500')}>
          —
        </td>
      );
    const isMin = rowMin !== null && pz <= rowMin + Z_TOL;
    return (
      <td title={`${name} · paper: ${fmtNum(pz, 2)}${isMin ? ' · menor de la fila' : ''}`} className={cn(TD_NUM, edge, isMin ? 'font-semibold text-zinc-50' : 'text-zinc-300')}>
        {fmtNum(pz, 2)}
        {isMin && <span className="sr-only"> (menor de la fila)</span>}
      </td>
    );
  }

  if (!res) {
    if (errors > 0)
      return (
        <td
          title={`${name}: ${plural(errors, 'ejecución', 'ejecuciones')} de ${info.label} con error en esta instancia; esta dirección no tiene resultado (detalle en registros.jsonl).`}
          className={cn(TD_NUM, edge)}
        >
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-handling">
            <CircleAlert className="h-3 w-3" aria-hidden />
            error
          </span>
          <span className="sr-only">: la ejecución falló</span>
        </td>
      );
    return (
      <td className={cn(TD_NUM, edge)}>
        <Pending />
      </td>
    );
  }

  if (view === 'delta') {
    if (pz === null)
      return (
        <td title={`${name}: instancia fuera de las Tablas 8–9`} className={cn(TD_NUM, edge, 'text-zinc-500')}>
          —
        </td>
      );
    const d = res.z - pz;
    const sign = d < -Z_TOL ? -1 : d > Z_TOL ? 1 : 0;
    return (
      <td
        title={`${name}: nuestro ${fmtNum(res.z, 2)} − paper ${fmtNum(pz, 2)} = ${fmtDelta(d, 2)} (${fmtPctValue(pz > 0 ? (d / pz) * 100 : null, 2)})`}
        className={cn(TD_NUM, edge, sign < 0 ? 'text-ok' : sign > 0 ? 'text-handling' : 'text-zinc-500')}
      >
        {fmtDelta(d, 2)}
        <span className="sr-only">{sign < 0 ? ' (menor que el paper)' : sign > 0 ? ' (mayor que el paper)' : ' (igual al paper)'}</span>
      </td>
    );
  }

  const isMin = rowMin !== null && res.z <= rowMin + Z_TOL;
  const beats = row.best !== null && res.z < row.best - Z_TOL;
  const notes = [isMin && 'menor de la fila', beats && 'menor que el Best del paper'].filter(Boolean).join(', ');
  return (
    <td title={oursTitle(row, col, res, pz, beats, isMin)} className={cn(TD_NUM, edge, isMin ? 'font-semibold text-zinc-50' : 'text-zinc-300')}>
      {beats && <BeatsDot />}
      {fmtNum(res.z, 2)}
      {notes && <span className="sr-only"> ({notes})</span>}
    </td>
  );
}

/* ───────────────────────── Pie ───────────────────────── */

type FootKind = 'delta' | 'count' | 'sec' | 'paperT9' | 'paperT2';

interface FootCtx {
  total: number;
  paper: PaperFile | null;
  n: number;
}

function footCell(kind: FootKind, c: DetailCol, f: DetailFoot, ctx: FootCtx): { content: ReactNode; title?: string; tone?: string } {
  const name = `${META_INFO[c.method].label} · ${DIR_LABEL[c.dir]}`;
  const noneYet = { content: <Pending /> };
  if (kind === 'sec') {
    if (f.secDone === 0) return noneYet;
    const twophase = c.method === 'twophase';
    return {
      content: (
        <>
          {fmtSec(f.sec)}
          {twophase && (
            <span aria-hidden className="text-zinc-400">
              †
            </span>
          )}
          {f.secDone < ctx.total && (
            <Sub>
              {f.secDone}/{ctx.total}
              <span className="sr-only"> instancias</span>
            </Sub>
          )}
        </>
      ),
      title:
        `${name}: ${fmtSec(f.sec)} s promedio de ${f.secDone} de ${ctx.total} instancias; ` +
        (twophase ? 'tour TSP + reubicación del depósito en esta dirección.' : 'solución inicial + metaheurística en esta dirección, sin el tour TSP.'),
    };
  }
  if (kind === 'delta' || kind === 'count') {
    if (f.compared === 0) return f.secDone === 0 ? noneYet : { content: '—', tone: 'text-zinc-500' };
    if (kind === 'delta') {
      const d = f.delta as number;
      return {
        content: fmtDelta(d, 2),
        title: `${name}: diferencia media nuestro − paper de ${f.compared} instancias`,
        tone: d < -Z_TOL ? 'text-ok' : d > Z_TOL ? 'text-handling' : 'text-zinc-500',
      };
    }
    const same = f.compared - f.better - f.worse;
    return {
      content: (
        <>
          <span className="text-ok">{f.better}</span>
          <span className="text-zinc-500"> / </span>
          <span className="text-handling">{f.worse}</span>
          <span className="sr-only"> ({same} iguales)</span>
        </>
      ),
      title: `${name}: Z menor que el paper en ${f.better}, mayor en ${f.worse} e igual en ${same} de ${f.compared} instancias`,
    };
  }
  if (kind === 'paperT9') {
    const cols = PAPER_TIME_COLS[c.method];
    if (!cols || !ctx.paper)
      return { content: '—', tone: 'text-zinc-500', title: 'Las Tablas 8–9 no publican el tiempo de la solución inicial' };
    const t = ctx.paper.timeRowTable9[cols[c.dir - 1]];
    return {
      content: fmtSec(t),
      title: `${name}: ${fmtSec(t)} s, fila «Time (s)» de la Tabla 9 (promedio de las 100 instancias, Core 2 Quad 2,83 GHz)`,
    };
  }
  // Tabla 2: segundos por |Vc| de ILS e ITS exactos en 1 dir.
  const byN = ctx.paper?.byN?.[String(ctx.n)];
  const t =
    byN && c.dir === 1 ? (c.method === 'ils-exact' ? byN.ilsExact1dirTimeSec : c.method === 'its-exact' ? byN.itsExact1dirTimeSec : null) : null;
  if (t === null) return { content: null };
  return { content: fmtSec(t), title: `${name}: ${fmtSec(t)} s promedio con |Vc| = ${ctx.n} (Tabla 2 del paper)` };
}

function footLabel(kind: FootKind, n: number): { label: ReactNode; sub: ReactNode; title: string } {
  switch (kind) {
    case 'sec':
      return { label: 'Tiempo (s)', sub: 'prom. nuestro', title: 'Segundos de pared promedio de cada columna (nuestro benchmark)' };
    case 'delta':
      return { label: 'Δ prom.', sub: 'nuestro − paper', title: 'Diferencia media nuestro − paper de cada columna' };
    case 'count':
      return { label: 'Menor / mayor', sub: 'que el paper', title: 'Instancias con Z menor (verde) y mayor (rosa) que el paper en la misma columna' };
    case 'paperT9':
      return { label: 'Time (s)', sub: 'Tabla 9 · 100 inst.', title: 'Fila «Time (s)» de la Tabla 9: promedio de las 100 instancias de las Tablas 8–9' };
    case 'paperT2':
      return {
        label: (
          <>
            Seg. |V<sub>c</sub>| = <span className="num">{n}</span>
          </>
        ),
        sub: 'Tabla 2 · exacto 1 dir.',
        title: 'Tabla 2: segundos promedio por |Vc| de ILS e ITS exactos en una dirección',
      };
  }
}

/* ───────────────────────── Convergencia ───────────────────────── */

interface Trace {
  method: MetaMethod;
  res: DirResult;
  /** costCurrent desde la iteración 0 (solución inicial de dos fases) hasta la última. */
  values: number[];
  /** false: el registro no trae `history`; la traza se reconstruye con la iteración del mejor. */
  traced: boolean;
}

function traceOf(row: InstanceRow, method: MetaMethod, dir: Dir, nominal: number): Trace | null {
  const res = detailResult(row, { method, dir });
  if (!res) return null;
  const hist = (res.history ?? []).filter((v) => Number.isFinite(v));
  if (hist.length) return { method, res, values: [res.zInitial, ...hist], traced: true };
  const at = res.improved ? clamp(res.bestIteration ?? nominal, 1, nominal) : nominal + 1;
  return { method, res, values: Array.from({ length: nominal + 1 }, (_, i) => (i >= at ? res.z : res.zInitial)), traced: false };
}

/** Dominio del eje Z con un 10 % de aire arriba y abajo. */
function domainOf(values: number[]): [number, number] | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.01);
  return [lo - span * 0.1, hi + span * 0.1];
}

/** Trazado escalonado: costCurrent se mantiene hasta la iteración en que mejora. */
function stepPath(values: number[], xOf: (i: number) => number, yOf: (v: number) => number): string {
  let d = `M${xOf(0).toFixed(2)},${yOf(values[0]).toFixed(2)}`;
  for (let i = 1; i < values.length; i++) {
    d += `H${xOf(i).toFixed(2)}`;
    if (Math.abs(values[i] - values[i - 1]) > 1e-9) d += `V${yOf(values[i]).toFixed(2)}`;
  }
  return d;
}

const CH = 224;
const CT = 24;
const CB = 34;
const CML = 54;
/** Margen derecho: ahí van las marcas grises del Z final del paper. */
const CMR = 30;
const CPLOT = CH - CT - CB;

function ConvergencePanel({
  family,
  traces,
  missing,
  domain,
  best,
  paperFinal,
  dirLabel,
  where,
  animKey,
}: {
  family: ConvFamily;
  traces: Trace[];
  /** Métodos de la familia sin resultado en esta dirección (pendientes o con error). */
  missing: { method: MetaMethod; error: boolean }[];
  domain: [number, number] | null;
  best: number | null;
  paperFinal: { method: MetaMethod; z: number }[];
  dirLabel: string;
  where: string;
  animKey: string;
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-40px' });
  const [hover, setHover] = useState<number | null>(null);
  const [kbd, setKbd] = useState<number | null>(null);

  const iters = traces.length ? Math.max(1, ...traces.map((t) => t.values.length - 1)) : NOMINAL_ITERS[family];
  const right = Math.max(CML + 10, width - CMR);
  const plotW = right - CML;
  const [lo, hi] = domain ?? [0, 1];
  const xOf = (i: number) => CML + (i / iters) * plotW;
  const yOf = (v: number) => CT + CPLOT * (1 - (v - lo) / (hi - lo || 1));
  const valAt = (t: Trace, i: number) => t.values[Math.min(i, t.values.length - 1)];
  const raw = hover ?? kbd;
  const active = raw === null ? null : clamp(raw, 0, iters);

  const yStep = niceStep(hi - lo, 4);
  const yTicks: number[] = [];
  for (let t = Math.ceil(lo / yStep - 1e-9) * yStep; t <= hi + 1e-9; t += yStep) yTicks.push(Number(t.toFixed(8)));
  const xStep = Math.max(1, Math.round(niceStep(iters, 4)));
  const xTicks: number[] = [];
  for (let i = 0; i <= iters; i += xStep) xTicks.push(i);
  if (iters - xTicks[xTicks.length - 1] >= xStep / 2) xTicks.push(iters);

  const idxFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return clamp(Math.round(((e.clientX - r.left - CML) / Math.max(1, plotW)) * iters), 0, iters);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const i = kbd ?? iters;
    const big = Math.max(1, Math.round(iters / 10));
    const next: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, PageUp: i + big, PageDown: i - big, Home: 0, End: iters };
    if (!(e.key in next)) return;
    e.preventDefault();
    e.stopPropagation();
    setKbd(clamp(next[e.key], 0, iters));
  };

  const short = (m: MetaMethod) => META_INFO[m].short;
  const summary =
    `${FAMILY_TITLE[family]}: mejor costo conocido (costCurrent) por iteración, ${where}, ${dirLabel}. ` +
    (traces.length
      ? traces
          .map(
            (t) =>
              `${META_INFO[t.method].label}: de ${fmtNum(t.res.zInitial, 2)} a ${fmtNum(t.res.z, 2)}` +
              (t.res.improved ? `, mejor en la iteración ${t.res.bestIteration ?? '—'} de ${t.values.length - 1}` : ', sin mejorar la solución inicial'),
          )
          .join('; ')
      : 'sin corridas terminadas') +
    (best !== null ? `. Best del paper: ${fmtNum(best, 2)}` : '') +
    (paperFinal.length ? `. Final del paper: ${paperFinal.map((p) => `${short(p.method)} ${fmtNum(p.z, 2)}`).join(', ')}` : '') +
    '. Flechas izquierda y derecha para recorrer las iteraciones.';
  const readout =
    kbd !== null && traces.length
      ? `${kbd === 0 ? 'Solución inicial' : `Iteración ${kbd}`}: ` + traces.map((t) => `${short(t.method)} ${fmtNum(valAt(t, kbd), 2)}`).join('; ')
      : '';

  // Marcas del final: si la heurística y la exacta terminan casi en el mismo Z, la hueca se corre a la izquierda.
  const ends = traces.map((t) => ({ t, x: xOf(t.values.length - 1), y: yOf(t.values[t.values.length - 1]) }));
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 7 && Math.abs(ends[0].x - ends[1].x) < 7) ends[0].x -= 8;
  const startZ = [...new Set(traces.map((t) => t.values[0]))];
  const pending = missing.filter((m) => !m.error);
  const failed = missing.filter((m) => m.error);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-[12.5px] font-medium text-zinc-200">{FAMILY_TITLE[family]}</p>
        <p className="num text-[11px] text-zinc-500">
          {iters} iter.
          {traces.length > 0 && pending.length > 0 && <> · {pending.map((m) => short(m.method)).join(', ')} pendiente</>}
          {traces.length > 0 && failed.length > 0 && <span className="text-handling"> · {failed.map((m) => short(m.method)).join(', ')} con error</span>}
        </p>
      </div>
      <div ref={wrapRef} className="relative mt-2 w-full" style={{ height: CH }} onPointerLeave={() => setHover(null)}>
        {traces.length === 0 || !domain ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-zinc-800 px-4 text-center text-[12.5px] text-pretty text-zinc-500">
            {failed.length === missing.length && failed.length > 0
              ? `${family.toUpperCase()} terminó con error en esta instancia (${dirLabel}).`
              : `${family.toUpperCase()} aún no termina en esta instancia (${dirLabel}).`}
          </div>
        ) : (
          width > 0 && (
            <svg
              width={width}
              height={CH}
              viewBox={`0 0 ${width} ${CH}`}
              role="img"
              aria-label={summary}
              tabIndex={0}
              className="block cursor-crosshair overflow-visible rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-50/80 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-900"
              onPointerMove={(e) => setHover(idxFromPointer(e))}
              onFocus={() => setKbd((v) => v ?? iters)}
              onBlur={() => setKbd(null)}
              onKeyDown={onKey}
            >
              {/* Rejilla y ejes */}
              <g aria-hidden>
                {yTicks.map((t) => {
                  const y = Math.round(yOf(t)) + 0.5;
                  return (
                    <g key={t}>
                      <line x1={CML} x2={right} y1={y} y2={y} stroke={COLOR.grid} strokeWidth={1} shapeRendering="crispEdges" />
                      <text x={CML - 8} y={y + 3.5} textAnchor="end" fill={COLOR.tick} fontSize={10.5} className="num">
                        {fmtAuto(t, 2)}
                      </text>
                    </g>
                  );
                })}
                <line x1={CML} x2={right} y1={CT + CPLOT + 0.5} y2={CT + CPLOT + 0.5} stroke={COLOR.axis} strokeWidth={1} shapeRendering="crispEdges" />
                {xTicks.map((i) => (
                  <text
                    key={i}
                    x={xOf(i)}
                    y={CT + CPLOT + 16}
                    textAnchor="middle"
                    fill={i === active ? COLOR.ink : COLOR.tick}
                    fontWeight={i === active ? 600 : 400}
                    fontSize={10.5}
                    className="num"
                  >
                    {i}
                  </text>
                ))}
                <text x={0} y={CT - 10} fill={COLOR.label} fontSize={10.5}>
                  Z · costCurrent
                </text>
                <text x={right} y={CH - 1} textAnchor="end" fill={COLOR.label} fontSize={10.5}>
                  iteración
                </text>
              </g>

              {/* Best del paper */}
              {best !== null && (
                <g aria-hidden>
                  <line x1={CML} x2={right} y1={yOf(best)} y2={yOf(best)} stroke={PAPER_COLOR} strokeOpacity={0.8} strokeWidth={1} strokeDasharray="2 3" />
                  <text x={CML + 4} y={yOf(best) - 5} fill={COLOR.label} fontSize={10}>
                    Best paper {fmtNum(best, 2)}
                  </text>
                </g>
              )}

              {/* Crosshair */}
              {active !== null && (
                <line
                  aria-hidden
                  x1={Math.round(xOf(active)) + 0.5}
                  x2={Math.round(xOf(active)) + 0.5}
                  y1={CT - 4}
                  y2={CT + CPLOT}
                  stroke={COLOR.label}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              )}

              {/* Trazas (se vuelven a dibujar al cambiar de instancia o dirección) */}
              <g key={animKey} aria-hidden>
                {traces.map((t, k) => {
                  const d = stepPath(t.values, xOf, yOf);
                  const color = methodColor(t.method);
                  const dash = methodDash(t.method);
                  // Discontinuo: pathLength reescribe stroke-dasharray, así que se anima la opacidad.
                  return dash ? (
                    <motion.path
                      key={t.method}
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.75}
                      strokeDasharray={dash}
                      strokeLinejoin="round"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: inView ? 0.95 : 0 }}
                      transition={{ ...springSoft, delay: 0.12 + k * 0.08 }}
                    />
                  ) : (
                    <motion.path
                      key={t.method}
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.75}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: inView ? 1 : 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 2.2, delay: k * 0.08 }}
                    />
                  );
                })}
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ ...springSoft, delay: 0.2 }}>
                  {startZ.map((z) => (
                    <MetaMarkSvg key={z} shape="triangle" color={methodColor('twophase')} x={xOf(0)} y={yOf(z)} r={4} />
                  ))}
                  {ends.map(({ t, x, y }) => (
                    <MetaMarkSvg key={t.method} shape={methodShape(t.method)} color={methodColor(t.method)} hollow={methodHollow(t.method)} x={x} y={y} r={3.75} />
                  ))}
                  {paperFinal.map((p) => (
                    <MetaMarkSvg
                      key={p.method}
                      shape={methodShape(p.method)}
                      color={PAPER_COLOR}
                      hollow={methodHollow(p.method)}
                      x={right + 9 + CONV[family].indexOf(p.method) * 10}
                      y={yOf(p.z)}
                      r={3.5}
                    />
                  ))}
                </motion.g>
              </g>

              {/* Marcas de la iteración activa */}
              {active !== null && (
                <g aria-hidden>
                  {traces.map((t) => (
                    <MetaMarkSvg
                      key={t.method}
                      shape={methodShape(t.method)}
                      color={methodColor(t.method)}
                      hollow={methodHollow(t.method)}
                      x={xOf(Math.min(active, t.values.length - 1))}
                      y={yOf(valAt(t, active))}
                      r={4}
                    />
                  ))}
                </g>
              )}
            </svg>
          )
        )}

        <ChartTooltip
          anchor={active !== null && traces.length ? { x: xOf(active), y: CT + CPLOT / 2 } : null}
          bounds={width}
          placement="side"
          offset={14}
          minTop={0}
          maxBottom={CH}
        >
          {active !== null && traces.length > 0 && (
            <>
              <TipHeader aside={<span className="num text-[11px] text-zinc-500">{dirLabel}</span>}>
                {active === 0 ? 'Solución inicial' : `Iteración ${active} de ${iters}`}
              </TipHeader>
              {traces.map((t) => (
                <TipRow key={t.method} color={methodColor(t.method)} dashed={!!methodDash(t.method)} value={fmtNum(valAt(t, active), 2)} label={short(t.method)} />
              ))}
              {best !== null && <TipRow color={PAPER_COLOR} dashed value={fmtNum(best, 2)} label="Best paper" />}
            </>
          )}
        </ChartTooltip>
        <span className="sr-only" aria-live="polite">
          {readout}
        </span>
      </div>
    </div>
  );
}

function ConvergenceRow({ row, method, dir, iters }: { row: InstanceRow; method: MetaMethod; dir: Dir; iters: number }) {
  const info = META_INFO[method];
  const res = detailResult(row, { method, dir });
  const pz = detailPaper(row, { method, dir });
  const errors = row.cells[method].errors;
  const head = (
    <th scope="row" title={info.title} className="border-b border-zinc-800/60 py-2 pr-4 text-left align-top font-normal whitespace-nowrap">
      <span className="inline-flex items-center gap-1.5 text-zinc-200">
        <MethodSwatch method={method} />
        {info.label}
      </span>
    </th>
  );
  const paperTd = (
    <td title="Z final del paper con el mismo método y dirección" className={cn(TD_NUM, 'border-l border-l-zinc-800 text-zinc-400')}>
      {pz === null ? '—' : fmtNum(pz, 2)}
    </td>
  );
  if (!res)
    return (
      <tr>
        {head}
        <td colSpan={6} className="border-b border-zinc-800/60 px-2.5 py-2 text-left align-top">
          {errors > 0 ? (
            <span className="inline-flex items-center gap-1 font-mono text-[12px] text-handling">
              <CircleAlert className="h-3 w-3" aria-hidden />
              error<span className="sr-only">: la ejecución falló</span>
            </span>
          ) : (
            <Pending />
          )}
        </td>
        {paperTd}
        <td className={cn(TD_NUM, 'text-zinc-500')}>—</td>
      </tr>
    );
  const gain = res.zInitial > 0 ? ((res.zInitial - res.z) / res.zInitial) * 100 : null;
  const d = pz === null ? null : res.z - pz;
  const beats = row.best !== null && res.z < row.best - Z_TOL;
  return (
    <tr className="transition-colors hover:bg-zinc-800/25">
      {head}
      <td className={cn(TD_NUM, 'text-zinc-400')}>{fmtNum(res.zInitial, 2)}</td>
      <td
        title={beats ? `Z final ${fmtNum(res.z, 2)}: menor que el Best del paper (${fmtNum(row.best, 2)})` : undefined}
        className={cn(TD_NUM, 'font-medium text-zinc-100')}
      >
        {beats && <BeatsDot />}
        {fmtNum(res.z, 2)}
        {beats && <span className="sr-only"> (menor que el Best del paper)</span>}
      </td>
      <td className={cn(TD_NUM, res.improved ? 'text-zinc-200' : 'text-zinc-500')}>{res.improved ? fmtPctValue(gain, 2) : <span className="font-sans text-[12px]">sin mejora</span>}</td>
      <td className={cn(TD_NUM, 'text-zinc-300')}>
        {res.improved && res.bestIteration !== undefined ? (
          <>
            {res.bestIteration}
            <span className="text-zinc-500">/{iters}</span>
          </>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </td>
      <td className={cn(TD_NUM, 'text-zinc-300')}>{fmtSec(res.sec)}</td>
      <td
        title={`Evaluaciones exactas (Alg. 2.1 + DP)${res.heuristicEvals ? ' y heurísticas lineales (§2.2)' : ''} de la corrida`}
        className={cn(TD_NUM, 'text-zinc-400')}
      >
        {res.exactEvals !== undefined ? fmt(res.exactEvals, 0) : '—'}
        {res.heuristicEvals ? <Sub>{fmt(res.heuristicEvals, 0)} heur.</Sub> : null}
      </td>
      {paperTd}
      <td className={cn(TD_NUM, d === null ? 'text-zinc-500' : d < -Z_TOL ? 'text-ok' : d > Z_TOL ? 'text-handling' : 'text-zinc-500')}>
        {d === null ? '—' : fmtDelta(d, 2)}
      </td>
    </tr>
  );
}

function ConvergenceSection({
  row,
  n,
  ids,
  selId,
  onSelect,
  sectionId,
  sectionRef,
}: {
  row: InstanceRow | null;
  n: number;
  ids: number[];
  selId: number | null;
  onSelect: (id: number) => void;
  sectionId: string;
  sectionRef: RefObject<HTMLDivElement | null>;
}) {
  const [dir, setDir] = useState<Dir>(1);
  const model = useMemo(() => {
    if (!row) return null;
    const fam = (f: ConvFamily) => ({
      traces: CONV[f].map((m) => traceOf(row, m, dir, NOMINAL_ITERS[f])).filter((t): t is Trace => t !== null),
      missing: CONV[f].filter((m) => !detailResult(row, { method: m, dir })).map((m) => ({ method: m, error: row.cells[m].errors > 0 })),
      paperFinal: CONV[f].flatMap((m) => {
        const z = detailPaper(row, { method: m, dir });
        return z === null ? [] : [{ method: m, z }];
      }),
    });
    const ils = fam('ils');
    const its = fam('its');
    const all = [...ils.traces, ...its.traces];
    const domain = all.length
      ? domainOf([
          ...all.flatMap((t) => t.values),
          ...(row.best !== null ? [row.best] : []),
          ...[...ils.paperFinal, ...its.paperFinal].map((p) => p.z),
        ])
      : null;
    return { ils, its, domain, untraced: all.some((t) => !t.traced) };
  }, [row, dir]);

  const dirLabel = DIR_LABEL[dir];
  const where = row ? `|Vc| = ${n}, Id ${row.id}` : '';
  const itersOf = (f: ConvFamily) => {
    const ts = model?.[f].traces ?? [];
    return ts.length ? Math.max(...ts.map((t) => t.values.length - 1)) : NOMINAL_ITERS[f];
  };

  return (
    // data-scroll-anchor: reserva el alto de la barra fija al desplazarse aquí (index.css), como los enfocables.
    <div ref={sectionRef} id={sectionId} data-scroll-anchor className="mt-6 border-t border-zinc-800/80 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[72ch]">
          <p className="eyebrow">Convergencia · costCurrent por iteración</p>
          <h4 className="mt-1.5 text-[15px] font-semibold tracking-tight text-balance text-zinc-50">
            {row ? (
              <>
                ILS e ITS en la instancia <span className="num">Id {row.id}</span> con |V<sub className="text-[0.7em]">c</sub>| ={' '}
                <span className="num">{n}</span>
              </>
            ) : (
              'Sin instancias en este tamaño'
            )}
          </h4>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Mejor Z tras cada iteración, desde la solución inicial <MetaMark method="twophase" size={10} />.
          </p>
        </div>
        {row && (
          <div className="flex flex-wrap items-center gap-2">
            {ids.length > 1 && selId !== null && (
              <Segmented<number>
                ariaLabel="Instancia de la convergencia"
                size="xs"
                value={selId}
                onChange={onSelect}
                options={ids.map((id) => ({ value: id, label: id, ariaLabel: `Instancia ${id}`, title: `Instancia ${id}` }))}
              />
            )}
            <Segmented<Dir>
              ariaLabel="Dirección de la corrida"
              size="xs"
              value={dir}
              onChange={setDir}
              options={([1, 2] as const).map((d) => ({ value: d, label: DIR_LABEL[d], title: DIR_TITLE[d] }))}
            />
          </div>
        )}
      </div>

      {row && model && (
        <>
          <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-[3fr_2fr]">
            {(['ils', 'its'] as const).map((f) => (
              <ConvergencePanel
                key={f}
                family={f}
                traces={model[f].traces}
                missing={model[f].missing}
                domain={model.domain}
                best={row.best}
                paperFinal={model[f].paperFinal}
                dirLabel={dirLabel}
                where={where}
                animKey={`${n}-${row.id}-${dir}`}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {CONV_METHODS.map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400" title={META_INFO[m].title}>
                <MethodSwatch method={m} />
                {META_INFO[m].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <MetaMark method="twophase" size={11} />
              inicial (dos fases)
            </span>
            <LegendItem kind="dash" color={PAPER_COLOR}>
              Best del paper
            </LegendItem>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <MetaMark method="ils-exact" size={11} paper />
              Z final del paper
            </span>
          </div>
          {model.untraced && (
            <p className="mt-2 text-[12px] text-zinc-500">
              Sin traza por iteración en alguna corrida: se dibuja inicial → final.
            </p>
          )}

          <div className="scrollbar-thin -mx-1 mt-4 overflow-x-auto px-1">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[12.5px]">
              <caption className="sr-only">
                Convergencia de ILS e ITS con |Vc| = {n}, instancia {row.id}, {dirLabel}: Z inicial y final, mejora porcentual, iteración del mejor,
                segundos, evaluaciones exactas y Z final del paper con el mismo método y dirección, y la diferencia nuestro − paper.
              </caption>
              <thead>
                <tr className="text-[11px] text-zinc-500">
                  <th scope="col" className="border-b border-zinc-800 pr-4 pb-2 text-left font-medium">
                    Método · {dirLabel}
                  </th>
                  {[
                    ['Inicial', 'Z de la solución inicial (dos fases) en esta dirección'],
                    ['Final', 'Z final de la corrida'],
                    ['Mejora', '(inicial − final) / inicial · 100'],
                    ['Iter. mejor', 'Iteración en que se encontró el Z final, sobre el total de iteraciones'],
                    ['Seg.', 'Segundos de esta dirección: solución inicial + metaheurística, sin el tour TSP'],
                    ['Evals. DP', 'Evaluaciones exactas de la manipulación (Alg. 2.1 + DP); debajo, las heurísticas lineales (§2.2)'],
                    ['Paper', 'Z final del paper con el mismo método y dirección (Tablas 8–9)'],
                    ['Δ', 'Nuestro − paper'],
                  ].map(([label, title], i) => (
                    <th
                      key={label}
                      scope="col"
                      title={title}
                      className={cn('border-b border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap', i === 6 && 'border-l border-l-zinc-800')}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONV_METHODS.map((m) => (
                  <ConvergenceRow key={m} row={row} method={m} dir={dir} iters={itersOf(META_INFO[m].family as ConvFamily)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Tarjeta ───────────────────────── */

export function MetaDetailTable({ rows, paper, sizes }: { rows: InstanceRow[]; paper: PaperFile | null; sizes: number[] }) {
  const uid = useId();
  const convId = `${uid}-convergencia`;
  const convRef = useRef<HTMLDivElement>(null);

  const sizeList = useMemo(() => [...new Set(sizes.length ? sizes : rows.map((r) => r.n))].sort((a, b) => a - b), [sizes, rows]);
  const withData = useMemo(() => new Set(rows.filter((r) => hasResults(r)).map((r) => r.n)), [rows]);
  const fallback = useMemo(() => {
    const done = sizeList.filter((s) => withData.has(s));
    if (done.length) return done[done.length - 1];
    return sizeList.includes(200) ? 200 : (sizeList[sizeList.length - 1] ?? 200);
  }, [sizeList, withData]);
  const [picked, setPicked] = useState<number | null>(null);
  const n = picked !== null && sizeList.includes(picked) ? picked : fallback;
  const [view, setView] = useState<MetaDetailView>('ours');
  const [pickedId, setPickedId] = useState<number | null>(null);

  const list = useMemo(() => rows.filter((r) => r.n === n).sort((a, b) => a.id - b.id), [rows, n]);
  const h = hFor(n, list.find((r) => r.h !== null)?.h ?? null);
  const inPaper = list.some((r) => r.paper !== null);
  const tableName = inPaper ? `Tabla ${n <= 100 ? 8 : 9}` : 'Tablas 8–9';

  const defaultId = (list.find((r) => hasResults(r, CONV_METHODS)) ?? list[0])?.id ?? null;
  const selId = pickedId !== null && list.some((r) => r.id === pickedId) ? pickedId : defaultId;
  const selRow = list.find((r) => r.id === selId) ?? null;

  const mins = useMemo(
    () => list.map((r) => ({ ours: minOf(DETAIL_COLS.map((c) => detailResult(r, c)?.z ?? null)), paper: minOf(DETAIL_COLS.map((c) => detailPaper(r, c))) })),
    [list],
  );
  const foots = useMemo(() => DETAIL_COLS.map((c) => detailFoot(list, c)), [list]);
  const tspMean = mean(list.flatMap((r) => (r.tspSec !== null ? [r.tspSec] : [])));
  const total = list.length * DETAIL_COLS.length;
  const done = list.reduce((a, r) => a + DETAIL_COLS.filter((c) => detailResult(r, c) !== null).length, 0);
  const failed = list.reduce((a, r) => a + DETAIL_COLS.filter((c) => detailResult(r, c) === null && r.cells[c.method].errors > 0).length, 0);
  const anyBeats = list.some((r) => r.best !== null && DETAIL_COLS.some((c) => (detailResult(r, c)?.z ?? Infinity) < (r.best as number) - Z_TOL));
  const anyPaperDir = list.some((r) => r.orientation === 'paper');
  // Filas con resultados cuya dirección 1 no está alineada con la «1 dir.» del paper (orientación por convención).
  const unaligned = list.filter((r) => r.orientation !== 'paper' && hasResults(r)).length;
  const hasT2 = !!paper?.byN?.[String(n)];

  const footKinds: FootKind[] = view === 'paper' ? (paper ? ['paperT9', ...(hasT2 ? (['paperT2'] as const) : [])] : []) : view === 'delta' ? ['delta', 'count', 'sec'] : ['sec'];
  const footCtx: FootCtx = { total: list.length, paper, n };

  const pickRow = (id: number) => {
    setPickedId(id);
    requestAnimationFrame(() => convRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' }));
  };

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead
        eyebrow="Tablas 8–9 · detalle por instancia"
        title={
          <>
            Las <span className="num">{list.length}</span> instancias con |V<sub className="text-[0.7em]">c</sub>| = <span className="num">{n}</span>
            {h !== null && (
              <>
                {' '}
                <span className="font-normal text-zinc-500">·</span> <span className="num">h = {hLabel(h)}</span>
              </>
            )}
          </>
        }
        note={
          <>
            Z final por método, como la {tableName} del paper.
            {view !== 'paper' && done < total && (
              <>
                {' '}
                <span className="num text-zinc-400">
                  {done}/{total}
                </span>{' '}
                corridas registradas con este tamaño.
              </>
            )}
          </>
        }
        actions={
          <>
            {sizeList.length > 1 && (
              // Con 10 tamaños mide ~350 px: en pantallas angostas las opciones pasan a una segunda fila
              // en vez de salirse de la tarjeta (inline-flex sin wrap no se encoge bajo su ancho mínimo).
              <Segmented<number>
                ariaLabel="Clientes |Vc|"
                size="xs"
                className="max-w-full flex-wrap gap-y-0.5"
                value={n}
                onChange={setPicked}
                options={sizeList.map((s) => ({
                  value: s,
                  label: <span className={cn(!withData.has(s) && s !== n && 'text-zinc-500')}>{s}</span>,
                  ariaLabel: `|Vc| = ${s}${withData.has(s) ? '' : ', aún sin resultados'}`,
                  title: `|Vc| = ${s}${withData.has(s) ? '' : ' · aún sin resultados nuestros'}`,
                }))}
              />
            )}
            <Segmented<MetaDetailView>
              ariaLabel="Cifras de la tabla"
              size="xs"
              value={view}
              onChange={setView}
              options={[
                { value: 'ours', label: 'Nuestro', title: 'Nuestros Z' },
                { value: 'paper', label: 'Paper', title: 'Cifras publicadas en las Tablas 8–9' },
                { value: 'delta', label: 'Δ', ariaLabel: 'Diferencia nuestro menos paper', title: 'Nuestro − paper en cada columna' },
              ]}
            />
            <CopyLatexButton what="Tabla de detalle por instancia" getText={() => toLatexMetaDetail(rows, { n, view, paper, h })} />
          </>
        }
      />

      {list.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-500">No hay instancias con |Vc| = {n} en la grilla.</p>
      ) : (
        <div className="scrollbar-thin -mx-1 mt-5 overflow-x-auto px-1">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <caption className="sr-only">
              {view === 'paper' ? 'Cifras del paper' : view === 'delta' ? 'Diferencia nuestro menos paper' : 'Nuestro valor objetivo Z'} por instancia con |Vc| ={' '}
              {n}: Best del paper y, por método, la corrida desde el tour TSP (1 dir.) y desde el tour invertido (2 dir.); al pie,{' '}
              {view === 'paper' ? 'los segundos publicados en las Tablas 9 y 2' : 'los segundos promedio por columna'}.
            </caption>
            <thead>
              <tr className="text-[12px]">
                <td className={STICKY_CELL} />
                <td />
                {META_METHODS.map((m) => {
                  const info = META_INFO[m];
                  return (
                    <th key={m} scope="colgroup" colSpan={2} title={info.title} className="border-l border-l-zinc-800 px-2.5 pb-1.5 text-left align-bottom font-medium">
                      <span aria-hidden className="mb-2 block h-0.5 rounded-full opacity-70" style={{ background: methodColor(m) }} />
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <MethodSwatch method={m} />
                        <span className="text-zinc-100">{info.label}</span>
                      </span>
                    </th>
                  );
                })}
              </tr>
              <tr className="text-[11px] text-zinc-500">
                <th scope="col" className={cn(STICKY_CELL, 'border-b border-zinc-800 pr-4 pb-2 text-left font-medium')}>
                  Id
                </th>
                <th
                  scope="col"
                  title="Best: mejor solución conocida que publica el paper (mínimo de todas sus corridas, incluido TS)"
                  className="border-b border-l border-zinc-800 border-l-zinc-800 px-2.5 pb-2 text-right font-medium"
                >
                  Best
                </th>
                {DETAIL_COLS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    title={DIR_TITLE[c.dir]}
                    className={cn('border-b border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap', c.dir === 1 && 'border-l border-l-zinc-800')}
                  >
                    {DIR_LABEL[c.dir]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => {
                const selected = r.id === selId;
                return (
                  <tr key={r.id} className={cn('group/row transition-colors hover:bg-zinc-800/25', selected && 'bg-zinc-800/25')}>
                    <th
                      scope="row"
                      className={cn(
                        STICKY_CELL,
                        STICKY_ROW_HOVER,
                        'border-b border-zinc-800/60 py-1.5 pr-3 text-left align-top font-normal',
                        selected && 'bg-[#17171a] shadow-[inset_2px_0_0_0_#a1a1aa]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => pickRow(r.id)}
                        aria-pressed={selected}
                        aria-controls={convId}
                        title={`Ver la convergencia de ILS e ITS en la instancia ${r.id}`}
                        className="group/id -mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-zinc-50/80"
                      >
                        <span className="num text-zinc-100">{r.id}</span>
                        <Activity
                          aria-hidden
                          className={cn('h-3 w-3 transition-colors', selected ? 'text-zinc-200' : 'text-zinc-500 group-hover/id:text-zinc-300')}
                        />
                        <span className="sr-only"> (ver convergencia)</span>
                      </button>
                      {r.orientation === 'paper' && (
                        <span
                          title="Nuestra dirección 1 reproduce la solución inicial «1 dir.» del paper: mismo tour TSP en la misma orientación"
                          className="block font-sans text-[10px] leading-4 whitespace-nowrap text-zinc-500"
                        >
                          dir. 1 = paper
                          <span className="sr-only">: nuestra dirección 1 reproduce la solución inicial 1 dir. del paper</span>
                        </span>
                      )}
                    </th>
                    <td
                      title={r.best === null ? 'Instancia fuera de las Tablas 8–9' : `Best del paper: ${fmtNum(r.best, 2)}`}
                      className={cn(TD_NUM, 'border-l border-l-zinc-800 text-zinc-400')}
                    >
                      {r.best === null ? '—' : fmtNum(r.best, 2)}
                    </td>
                    {DETAIL_COLS.map((c) => (
                      <DetailCell key={c.key} row={r} col={c} view={view} rowMin={view === 'paper' ? mins[i].paper : mins[i].ours} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
            {footKinds.length > 0 && (
              <tfoot className="text-[12.5px]">
                {footKinds.map((kind, k) => {
                  const fl = footLabel(kind, n);
                  const pad = k === 0 ? 'pt-3 pb-1' : 'py-1';
                  return (
                    <tr key={kind}>
                      <th scope="row" title={fl.title} className={cn(STICKY_CELL, 'pr-4 text-left align-top text-[12px] font-medium whitespace-nowrap text-zinc-200', pad)}>
                        {fl.label}
                        <span className="mt-0.5 block text-[10.5px] leading-4 font-normal whitespace-nowrap text-zinc-500">{fl.sub}</span>
                      </th>
                      <td className={cn('border-l border-l-zinc-800', pad)} />
                      {DETAIL_COLS.map((c, j) => {
                        const fc = footCell(kind, c, foots[j], footCtx);
                        return (
                          <td
                            key={c.key}
                            title={fc.title}
                            className={cn(
                              'num px-2.5 text-right align-top whitespace-nowrap',
                              fc.tone ?? 'text-zinc-100',
                              pad,
                              c.dir === 1 && 'border-l border-l-zinc-800',
                            )}
                          >
                            {fc.content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="mt-4 text-[12px] text-zinc-500">
        {view === 'delta' ? (
          <>
            Δ = nuestro − paper: <span className="text-ok">negativo</span> mejor, <span className="text-handling">positivo</span> peor.
          </>
        ) : (
          <>En negrita, el menor de la fila.</>
        )}
        {view === 'ours' && anyBeats && (
          <>
            {' '}
            <BeatsDot />bajo el Best del paper.
          </>
        )}{' '}
        Elige un Id para ver su convergencia.
      </p>
      <Disclosure summary="Notas de la tabla" className="mt-3">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <span className="text-zinc-400">1 dir.</span>: corrida desde el tour TSP; <span className="text-zinc-400">2 dir.</span>: desde el tour
            invertido, por sí sola (como en el paper). El «2dir» del resto de la sección es el mínimo de ambas.
          </li>
          <li>
            <span className="text-zinc-400">Best</span>: mejor solución conocida del paper. Z con dos decimales.
          </li>
          {(anyPaperDir || unaligned > 0) && (
            <li>
              {anyPaperDir && (
                <>
                  <span className="text-zinc-400">dir. 1 = paper</span>: misma solución inicial «1 dir.» que el paper.{' '}
                </>
              )}
              {unaligned > 0 && (
                <>
                  En {anyPaperDir ? 'las otras' : 'las'} <span className="num">{unaligned}</span> filas con resultados la orientación es por convención: «1 dir.» y «2 dir.» pueden estar
                  invertidas respecto del paper (no afecta al mínimo, 2dir).
                </>
              )}
            </li>
          )}
          {view === 'delta' && <li>Nuestro tour TSP (2-opt + Or-opt) no siempre es el del paper (Lin–Kernighan): Δ puede venir ya de la solución inicial.</li>}
          {view !== 'paper' && failed > 0 && (
            <li>
              <span className="text-handling">error</span>: la ejecución falló (ver registros.jsonl).
            </li>
          )}
          <li>
            {view === 'paper' ? (
              <>
                Pie: fila «Time (s)» de la Tabla 9 (promedio de 100 instancias, Core 2 Quad 2,83 GHz){hasT2 ? '; Tabla 2: tiempo por |Vc| de ILS e ITS exactos en 1 dir.' : ''}.
              </>
            ) : (
              <>
                Pie: segundos promedio por columna, sin el tour TSP{tspMean !== null ? ` (${fmtSec(tspMean)} s con este |Vc|)` : ''};{' '}
                <span className="text-zinc-400">†</span> dos fases: tour TSP + reubicación del depósito.
              </>
            )}
          </li>
        </ul>
      </Disclosure>

      <ConvergenceSection
        row={selRow}
        n={n}
        ids={list.map((r) => r.id)}
        selId={selId}
        onSelect={setPickedId}
        sectionId={convId}
        sectionRef={convRef}
      />
    </SpotlightCard>
  );
}
