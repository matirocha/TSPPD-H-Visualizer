/**
 * Hallazgos de la sección «Metaheurísticas», calculados de los registros en la dirección elegida
 * (nunca escritos a mano):
 *  1. método con menor desviación promedio vs el Best del paper, y el paper en las mismas instancias;
 *  2. razón de tiempos exacto / heurístico del ILS y del ITS frente a la fila «Time (s)» de la Tabla 9
 *     (solo cuando ambas variantes terminaron las 100 instancias del paper: la razón crece con |Vc|);
 *  3. en cuántas instancias el ILS mejora su solución inicial, por tramo de |Vc| (paper: solo ≤ 40);
 *  4. cuánto cambia la desviación al pasar de 1dir a 2dir, método por método (negativo = baja);
 *  5. instancias en que nuestra mejor corrida queda bajo el Best del paper;
 *  6. coincidencia de la solución inicial (dos fases) con la del paper;
 *  7. si el ITS exacto deja de mejorar la solución inicial con |Vc| grande (y el paper no), un aviso
 *     que remite al bloque «ITS con |Vc| grande: sensibilidad a Nrand» de «Cómo se midió».
 * Con datos parciales cada cifra dice sobre cuántas instancias se calculó.
 */
import { useMemo, type ReactNode } from 'react';
import { ArrowLeftRight, Award, Equal, FlaskConical, Timer, TrendingDown, Trophy } from 'lucide-react';
import type { ItsNrandFile, MetaDirection, MetaMethod, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { scrollBehavior } from '../../lib/motion';
import { SpotlightCard } from '../ui';
import { ITS_NRAND_ANCHOR } from './MethodNote';
import { CardHead } from '../benchmark/shared';
import { fmtNum, fmtPctValue, fmtSec } from '../benchmark/format';
import { META_METHODS, devPct, summarizeByN, summarizeOverall, zOf, type InstanceRow, type MethodCell } from './aggregate';
import { mean, paperTimeMismatch } from './export';
import { META_INFO, type MetaFamily } from './labels';
import { MetaMark } from './shared';

/** Mismo umbral que aggregate: las cifras del paper tienen 2 decimales. */
const EPS_Z = 0.005;
/** Tramo del paper: su ILS solo mejora la solución inicial con |Vc| ≤ 40. */
const SMALL_N = 40;

/** Igualdad con una cifra del paper (redondeada a 2 decimales). */
const sameAsPaper = (z: number, p: number) => Math.abs(Math.round(z * 100) / 100 - p) < 0.006;
/** «A», «A y B», «A, B y C»; «e» ante sonido /i/ («ITS heurístico e ITS exacto»). */
function joinEs(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items[items.length - 1];
  const and = /^h?i(?![aeou])/i.test(last) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${and} ${last}`;
}
/** 8,82 → «8,8»; 27,3 → «27». */
const fmtRatio = (r: number) => fmt(r, r >= 10 ? 0 : 1);
const fmtPp = (v: number) => `${fmtNum(v, 2)} pp`;

/** Segundos de la metaheurística sin el tour TSP compartido (incluye la reubicación del depósito). */
function runSec(c: MethodCell, dir: MetaDirection): number | null {
  if (dir === '1dir') return c.dir1 ? c.dir1.sec : null;
  return c.dir1 && c.dir2 ? c.dir1.sec + c.dir2.sec : null;
}

interface Count {
  hit: number;
  of: number;
}
const count = (): Count => ({ hit: 0, of: 0 });

function computeFindings(rows: InstanceRow[], paper: PaperFile | null, dir: MetaDirection) {
  const total = rows.length;
  const common = rows.filter((r) => META_METHODS.every((m) => zOf(r.cells[m], dir) !== null));
  const withAny = rows.filter((r) => META_METHODS.some((m) => zOf(r.cells[m], dir) !== null)).length;

  /* 1 · Ranking por desviación, solo con instancias que tienen los cinco métodos (comparables). */
  const commonSummary = summarizeOverall(rows, dir, paper, 'common');
  const ranking = META_METHODS.flatMap((m) => {
    const s = commonSummary[m];
    return s.devPct === null ? [] : [{ m, dev: s.devPct, paperDev: s.paperDevPct }];
  }).sort((a, b) => a.dev - b.dev);
  const paperBest = ranking
    .filter((x): x is typeof x & { paperDev: number } => x.paperDev !== null)
    .sort((a, b) => a.paperDev - b.paperDev)[0] ?? null;

  /*
   * 2 · Razón de tiempos exacto / heurístico por familia (instancias con ambos). La del paper (fila
   * «Time (s)» de la Tabla 9, promedio de sus 100 instancias) solo aparece cuando summarizeOverall la
   * entrega, es decir, cuando ambas variantes terminaron todas las instancias del paper.
   */
  const overall = summarizeOverall(rows, dir, paper, 'done');
  const ratio = (family: Exclude<MetaFamily, 'twophase'>) => {
    const exact: MetaMethod = family === 'ils' ? 'ils-exact' : 'its-exact';
    const heur: MetaMethod = family === 'ils' ? 'ils-heuristic' : 'its-heuristic';
    const te: number[] = [];
    const th: number[] = [];
    for (const r of rows) {
      const a = runSec(r.cells[exact], dir);
      const b = runSec(r.cells[heur], dir);
      if (a === null || b === null) continue;
      te.push(a);
      th.push(b);
    }
    const e = mean(te);
    const h = mean(th);
    const pe = overall[exact].paperTimeSec;
    const ph = overall[heur].paperTimeSec;
    return {
      family,
      exact,
      heur,
      n: te.length,
      exactSec: e,
      heurSec: h,
      ours: e !== null && h !== null && h > 0 ? e / h : null,
      paperExactSec: pe,
      paperHeurSec: ph,
      paper: pe !== null && ph !== null && ph > 0 ? pe / ph : null,
      /** ITS exacto: la Tabla 2 (Avg.) y la Tabla 9 (Time (s)) no coinciden; se avisa junto a la razón del paper. */
      paperGap: pe !== null ? paperTimeMismatch(paper, exact) : null,
    };
  };
  const ratios = [ratio('ils'), ratio('its')];

  /* 3 · El ILS mejora su solución inicial, por tramo de |Vc| (nuestro y paper en las mismas instancias). */
  const byN = summarizeByN(rows, dir, paper, 'done');
  const largeFrom = byN.find((g) => g.n > SMALL_N)?.n ?? null;
  const improve = (['ils-exact', 'ils-heuristic'] as const).map((m) => {
    const ours = { small: count(), large: count() };
    for (const g of byN) {
      const b = g.n <= SMALL_N ? ours.small : ours.large;
      b.hit += g.methods[m].improved;
      b.of += g.methods[m].done;
    }
    const pap = { small: count(), large: count() };
    for (const r of rows) {
      if (!r.paper || zOf(r.cells[m], dir) === null) continue;
      const p = r.paper[m];
      const init = r.paper.twophase;
      const better = dir === '1dir' ? p.z1 < init.z1 - EPS_Z : p.z1 < init.z1 - EPS_Z || p.zRev < init.zRev - EPS_Z;
      const b = r.n <= SMALL_N ? pap.small : pap.large;
      b.of++;
      if (better) b.hit++;
    }
    return { m, ours, paper: pap };
  });

  /*
   * 3b · ITS exacto con |Vc| grande: los tamaños desde los que ya no mejora ninguna solución inicial
   * (todos los tamaños mayores con datos, tampoco) mientras el paper sí, en las mismas instancias.
   * Solo si antes, con |Vc| menor, sí mejora: el ITS «deja de mejorar».
   */
  const itsBy = byN.map((g) => {
    const ours = { hit: g.methods['its-exact'].improved, of: g.methods['its-exact'].done };
    const pap = count();
    for (const r of rows) {
      if (r.n !== g.n || !r.paper || zOf(r.cells['its-exact'], dir) === null) continue;
      const p = r.paper['its-exact'];
      const init = r.paper.twophase;
      pap.of++;
      if (dir === '1dir' ? p.z1 < init.z1 - EPS_Z : p.z1 < init.z1 - EPS_Z || p.zRev < init.zRev - EPS_Z) pap.hit++;
    }
    return { n: g.n, ours, paper: pap };
  }).filter((x) => x.ours.of > 0);
  let stallFrom = itsBy.length;
  while (stallFrom > 0 && itsBy[stallFrom - 1].ours.hit === 0 && itsBy[stallFrom - 1].paper.hit > 0) stallFrom--;
  const stalled = itsBy.slice(stallFrom);
  const before = itsBy[stallFrom - 1] ?? null;
  const itsStall =
    stalled.length > 0 && before !== null && before.ours.hit > 0
      ? {
          sizes: stalled.map((x) => x.n),
          ours: stalled.reduce((a, x) => ({ hit: a.hit + x.ours.hit, of: a.of + x.ours.of }), count()),
          paper: stalled.reduce((a, x) => ({ hit: a.hit + x.paper.hit, of: a.of + x.paper.of }), count()),
          before,
        }
      : null;

  /* 4 · 2dir frente a 1dir: baja de la desviación (pp, d1 − d2 ≥ 0) en instancias con ambas direcciones; se muestra como cambio (−). */
  const dirGain = META_METHODS.map((m) => {
    const ours: number[] = [];
    const pap: number[] = [];
    let better = 0;
    for (const r of rows) {
      const c = r.cells[m];
      if (c.z1 === null || c.z2 === null || r.best === null) continue;
      const d1 = devPct(c.z1, r.best);
      const d2 = devPct(c.z2, r.best);
      if (d1 === null || d2 === null) continue;
      ours.push(d1 - d2);
      if (c.z2 < c.z1 - EPS_Z) better++;
      if (r.paper) {
        const p1 = devPct(r.paper[m].z1, r.best);
        const p2 = devPct(r.paper[m].z2, r.best);
        if (p1 !== null && p2 !== null) pap.push(p1 - p2);
      }
    }
    return { m, n: ours.length, ours: mean(ours), paper: mean(pap), better };
  });
  const dirGainN = Math.max(0, ...dirGain.map((g) => g.n));

  /* 5 · Bajo el Best del paper (mejor de todas nuestras corridas, cualquier método y dirección). */
  const withBest = rows.filter((r): r is InstanceRow & { ourBest: number; best: number } => r.ourBest !== null && r.best !== null);
  const beats = withBest.filter((r) => r.ourBest < r.best - EPS_Z);
  const ties = withBest.filter((r) => sameAsPaper(r.ourBest, r.best)).length;
  const deepest = beats
    .map((r) => ({ n: r.n, id: r.id, dev: devPct(r.ourBest, r.best) as number }))
    .sort((a, b) => a.dev - b.dev)[0] ?? null;
  const beatSizes = [...new Set(beats.map((r) => r.n))].sort((a, b) => a - b);
  // Sobre las instancias comunes (los cinco métodos terminados), para contar todos sobre el mismo
  // conjunto; los empates en el máximo se nombran todos.
  const beatCounts = META_METHODS.map((m) => ({ m, k: commonSummary[m].beatsBest })).filter((x) => x.k > 0);
  const topK = Math.max(0, ...beatCounts.map((x) => x.k));
  const topBeater = topK > 0 ? { methods: beatCounts.filter((x) => x.k === topK).map((x) => x.m), k: topK, of: common.length } : null;

  /* 6 · Solución inicial (dos fases) igual a la del paper. */
  const init1 = count();
  const init2 = count();
  for (const r of rows) {
    if (!r.paper) continue;
    const c = r.cells.twophase;
    if (c.dir1) {
      init1.of++;
      if (sameAsPaper(c.dir1.z, r.paper.twophase.z1)) init1.hit++;
    }
    if (c.dir2) {
      init2.of++;
      if (sameAsPaper(c.dir2.z, r.paper.twophase.zRev)) init2.hit++;
    }
  }
  const initDev = { ours: overall.twophase.devPct, paper: overall.twophase.paperDevPct };

  return {
    total,
    common: common.length,
    withAny,
    ranking,
    paperBest,
    ratios,
    improve,
    itsStall,
    largeFrom,
    dirGain,
    dirGainN,
    beats: { count: beats.length, of: withBest.length, ties, deepest, sizes: beatSizes, topBeater },
    init: { first: init1, second: init2, dev: initDev },
  };
}

/* ───────────────────────── Piezas ───────────────────────── */

function Cell({ icon, term, children, className }: { icon: ReactNode; term: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col bg-zinc-950/70 px-4 py-4', className)}>
      <dt className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        {icon}
        {term}
      </dt>
      {children}
    </div>
  );
}

function Big({ value, unit }: { value: ReactNode; unit?: ReactNode }) {
  return (
    <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
      <span className="num text-[26px] leading-none font-semibold tracking-tight text-zinc-50">{value}</span>
      {unit && <span className="text-[12px] text-zinc-500">{unit}</span>}
    </dd>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <dd className="mt-2 text-[12.5px] leading-relaxed text-pretty text-zinc-400">{children}</dd>;
}

const N = ({ children }: { children: ReactNode }) => <span className="num text-zinc-200">{children}</span>;
const Frac = ({ c }: { c: Count }) => (
  <>
    <span className="num text-zinc-50">{c.hit}</span>
    <span className="num text-zinc-500">/{c.of}</span>
  </>
);

/* ───────────────────────── Componente ───────────────────────── */

/** Lleva al bloque de sensibilidad a Nrand de «Cómo se midió» (sin href="#…": el hash guarda la solución). */
function goToNrand() {
  const el = document.getElementById(ITS_NRAND_ANCHOR);
  if (!el) return;
  el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  el.focus({ preventScroll: true });
}

export function MetaFindings({
  rows,
  paper,
  dir,
  itsNrand = null,
}: {
  rows: InstanceRow[];
  paper: PaperFile | null;
  dir: MetaDirection;
  /** Experimento its_nrand.json: si existe, el hallazgo del ITS exacto con |Vc| grande remite a su bloque. */
  itsNrand?: ItsNrandFile | null;
}) {
  const f = useMemo(() => computeFindings(rows, paper, dir), [rows, paper, dir]);
  const best = f.ranking[0] ?? null;
  const complete = f.total > 0 && f.common === f.total;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <CardHead
        eyebrow="Hallazgos"
        title={
          <>
            Lo que muestran los resultados · <span className="num">{dir}</span>
          </>
        }
        note={
          f.withAny === 0
            ? `Aún no hay resultados con ${dir}: las cifras aparecen a medida que avanza el benchmark.`
            : complete
              ? `Calculado sobre las ${f.total} instancias de la grilla.`
              : `Con los datos registrados hasta ahora: ${f.common} de ${f.total} instancias con los cinco métodos terminados en ${dir} (${f.withAny} con alguno). Las cifras cambian a medida que avanza el benchmark.`
        }
      />

      <div className="@container mt-5 flex flex-1 flex-col">
        <dl className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-800/80 @xs:grid-cols-2">
          {/* 1 · Menor desviación */}
          <Cell className="@xs:col-span-2" icon={<Trophy className="h-3.5 w-3.5 text-zinc-300" aria-hidden />} term={`Menor desviación promedio vs Best del paper · ${dir}`}>
            {best ? (
              <>
                <dd className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 self-center text-[13px] font-medium text-zinc-200">
                    <MetaMark method={best.m} size={12} />
                    {META_INFO[best.m].label}
                  </span>
                  <span className="num text-[26px] leading-none font-semibold tracking-tight text-zinc-50">{fmtPctValue(best.dev, 2)}</span>
                  {best.paperDev !== null && <span className="text-[12px] text-zinc-500">paper: <span className="num">{fmtPctValue(best.paperDev, 2)}</span></span>}
                </dd>
                <Note>
                  En las <N>{f.common}</N> instancias con los cinco métodos terminados; el paper, con el mismo método y las mismas instancias.
                  {f.paperBest && f.paperBest.m !== best.m && (
                    <>
                      {' '}
                      En el paper el mejor allí es {META_INFO[f.paperBest.m].label} (<N>{fmtPctValue(f.paperBest.paperDev, 2)}</N>).
                    </>
                  )}
                </Note>
                <dd className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5">
                  {f.ranking.map((x, k) => (
                    <span key={x.m} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400" title={META_INFO[x.m].title}>
                      <span className="num text-zinc-500">{k + 1}</span>
                      <MetaMark method={x.m} size={10} />
                      {META_INFO[x.m].short}
                      <span className="num text-zinc-200">{fmtPctValue(x.dev, 2)}</span>
                      {x.paperDev !== null && <span className="num text-zinc-500">({fmtPctValue(x.paperDev, 2)})</span>}
                    </span>
                  ))}
                </dd>
              </>
            ) : (
              <Note>
                {paper
                  ? `Aún no hay instancias con los cinco métodos terminados en ${dir}.`
                  : 'Sin las cifras del paper no hay Best con que calcular la desviación.'}
              </Note>
            )}
          </Cell>

          {/* 2 · Razón de tiempos exacto / heurístico */}
          {f.ratios.map((r) => (
            <Cell
              key={r.family}
              icon={<Timer className={cn('h-3.5 w-3.5', r.family === 'ils' ? 'text-ils' : 'text-its')} aria-hidden />}
              term={`${r.family.toUpperCase()} exacto / heurístico`}
            >
              <Big value={r.ours !== null ? `${fmtRatio(r.ours)}×` : '—'} unit={r.ours !== null ? 'más tiempo' : undefined} />
              <Note>
                {r.ours !== null && r.exactSec !== null && r.heurSec !== null ? (
                  <>
                    <N>{fmtSec(r.exactSec)} s</N> frente a <N>{fmtSec(r.heurSec)} s</N> por instancia ({r.n} con ambos; sin el tour TSP).{' '}
                  </>
                ) : (
                  <>Falta una instancia con ambas variantes terminadas. </>
                )}
                {r.paper !== null && r.paperExactSec !== null && r.paperHeurSec !== null ? (
                  <>
                    Paper (Tabla 9, promedio de sus 100 instancias): <N>{fmtRatio(r.paper)}×</N>, {fmtSec(r.paperExactSec)} s frente a{' '}
                    {fmtSec(r.paperHeurSec)} s.
                    {r.paperGap && (
                      <>
                        {' '}
                        La Tabla 2 da otro promedio al exacto en 1dir ({fmtNum(r.paperGap.table2, 2)} s frente a {fmtNum(r.paperGap.table9, 2)} s): el
                        paper no es consistente entre ambas tablas.
                      </>
                    )}
                  </>
                ) : paper ? (
                  'El paper solo publica el promedio de sus 100 instancias (Tabla 9): su razón aparece cuando ambas variantes las terminen, porque la razón crece con |Vc|.'
                ) : (
                  'Sin el tiempo del paper para comparar.'
                )}
              </Note>
            </Cell>
          ))}

          {/* 3 · El ILS mejora su solución inicial */}
          <Cell icon={<TrendingDown className="h-3.5 w-3.5 text-ils" aria-hidden />} term="El ILS mejora su solución inicial">
            {f.improve.some((x) => x.ours.small.of + x.ours.large.of > 0) ? (
              <>
                <dd className="mt-2.5 grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-3 gap-y-1.5 text-[12px]">
                  <span />
                  <span className="text-zinc-500">|Vc| ≤ {SMALL_N}</span>
                  <span className="text-zinc-500">|Vc| ≥ {f.largeFrom ?? SMALL_N + 1}</span>
                  {f.improve.map((x) => (
                    <div key={x.m} className="contents">
                      <span className="inline-flex items-center gap-1.5 text-zinc-300">
                        <MetaMark method={x.m} size={10} />
                        {META_INFO[x.m].short}
                      </span>
                      {(['small', 'large'] as const).map((k) => (
                        <span key={k} className="whitespace-nowrap">
                          {x.ours[k].of > 0 ? (
                            <>
                              <span className="text-[15px] font-semibold">
                                <Frac c={x.ours[k]} />
                              </span>{' '}
                              {paper && (
                                <span className="num text-[11px] text-zinc-500">
                                  ({x.paper[k].hit}/{x.paper[k].of})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                </dd>
                <Note>
                  Instancias con la mejor solución por debajo de la inicial{dir === '2dir' ? ' (en alguna dirección)' : ''}
                  {paper ? '; entre paréntesis, el paper en las mismas instancias' : ''}. Un movimiento se acepta solo si mejora la mejor solución
                  conocida, la lectura que reproduce el paper.
                </Note>
              </>
            ) : (
              <Note>Aún no termina ninguna corrida del ILS con {dir}.</Note>
            )}
          </Cell>

          {/* 4 · 2dir frente a 1dir */}
          <Cell icon={<ArrowLeftRight className="h-3.5 w-3.5 text-zinc-300" aria-hidden />} term="2dir frente a 1dir: cambio de la desviación">
            {f.dirGainN > 0 ? (
              <>
                <dd className="mt-2.5 grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 gap-y-1 text-[12px]">
                  {f.dirGain.map((g) => (
                    <div key={g.m} className="contents">
                      <span className="inline-flex items-center gap-1.5 text-zinc-300">
                        <MetaMark method={g.m} size={10} />
                        {META_INFO[g.m].short}
                      </span>
                      <span className="num text-right font-semibold whitespace-nowrap text-zinc-50">{g.ours !== null ? fmtPp(-g.ours) : '—'}</span>
                      <span className="num text-[11px] whitespace-nowrap text-zinc-500">{g.paper !== null ? `(${fmtPp(-g.paper)})` : ''}</span>
                    </div>
                  ))}
                </dd>
                <Note>
                  Cambio promedio de la desviación al sumar la corrida desde el tour invertido, en puntos porcentuales (negativo = baja); entre
                  paréntesis, el paper. Hasta <N>{f.dirGainN}</N> instancias con ambas direcciones. El tiempo de ILS e ITS casi se duplica; en dos fases
                  la segunda dirección es prácticamente gratis, porque domina el tour TSP compartido.
                </Note>
              </>
            ) : (
              <Note>{paper ? 'Aún no hay instancias con las dos direcciones terminadas.' : 'Sin las cifras del paper no hay Best con que calcular la desviación.'}</Note>
            )}
          </Cell>

          {/* 5 · Bajo el Best del paper */}
          <Cell icon={<Award className="h-3.5 w-3.5 text-ok" aria-hidden />} term="Bajo el Best del paper">
            {f.beats.of > 0 ? (
              <>
                <Big value={f.beats.count} unit={`de ${f.beats.of} instancias`} />
                <Note>
                  {f.beats.count > 0 ? (
                    <>
                      Nuestra mejor corrida (cualquier método y dirección) mejora la mejor solución conocida del paper con |Vc| ={' '}
                      <N>{f.beats.sizes.join(', ')}</N>
                      {f.beats.deepest && (
                        <>
                          ; la mayor diferencia, <N>{fmtPctValue(f.beats.deepest.dev, 2)}</N> (|Vc| = {f.beats.deepest.n}, Id {f.beats.deepest.id})
                        </>
                      )}
                      .
                    </>
                  ) : (
                    'Ninguna corrida termina bajo la mejor solución conocida del paper.'
                  )}{' '}
                  La igualamos en <N>{f.beats.ties}</N>.
                  {f.beats.topBeater && (
                    <>
                      {' '}
                      Con {dir}, en las <N>{f.beats.topBeater.of}</N> instancias con los cinco métodos, la supera más veces{' '}
                      {joinEs(f.beats.topBeater.methods.map((m) => META_INFO[m].label))} (<N>{f.beats.topBeater.k}</N>
                      {f.beats.topBeater.methods.length > 1 ? ' cada uno' : ''}).
                    </>
                  )}
                </Note>
              </>
            ) : (
              <Note>{paper ? 'Aún no termina ninguna corrida.' : 'Sin las cifras del paper para comparar.'}</Note>
            )}
          </Cell>

          {/* 6 · Solución inicial igual a la del paper */}
          <Cell icon={<Equal className="h-3.5 w-3.5 text-dp" aria-hidden />} term="Solución inicial igual a la del paper">
            {f.init.first.of > 0 ? (
              <>
                <Big
                  value={
                    <>
                      {f.init.first.hit}
                      <span className="text-zinc-500">/{f.init.first.of}</span>
                    </>
                  }
                  unit="desde el tour (1 dir.)"
                />
                <Note>
                  Desde el tour invertido: <Frac c={f.init.second} />.
                  {f.init.dev.ours !== null && f.init.dev.paper !== null && (
                    <>
                      {' '}
                      Dos fases queda en promedio a <N>{fmtPctValue(f.init.dev.ours, 2)}</N> del Best con {dir} (paper: <N>{fmtPctValue(f.init.dev.paper, 2)}</N>).
                    </>
                  )}{' '}
                  El paper construye el tour con Lin–Kernighan (Concorde); aquí, 2-opt + Or-opt iterado, que no siempre da el mismo tour.
                </Note>
              </>
            ) : (
              <Note>{paper ? 'Aún no hay soluciones de dos fases registradas.' : 'Sin las cifras del paper para comparar.'}</Note>
            )}
          </Cell>

          {/* 7 · ITS exacto con |Vc| grande: deja de mejorar la solución inicial */}
          {f.itsStall && (
            <Cell
              className="@xs:col-span-2"
              icon={<FlaskConical className="h-3.5 w-3.5 text-its" aria-hidden />}
              term={`ITS exacto con |Vc| grande · ${dir}`}
            >
              <Big
                value={<Frac c={f.itsStall.ours} />}
                unit={
                  <>
                    instancias con la solución inicial mejorada con |Vc| = {joinEs(f.itsStall.sizes.map(String))} (paper:{' '}
                    <span className="num">
                      {f.itsStall.paper.hit}/{f.itsStall.paper.of}
                    </span>
                    )
                  </>
                }
              />
              <Note>
                Desde |Vc| = <N>{f.itsStall.sizes[0]}</N> el ITS exacto no mejora la solución inicial de ninguna instancia
                {dir === '2dir' ? ' (en ninguna de las dos direcciones)' : ''}; con |Vc| = <N>{f.itsStall.before.n}</N> aún la mejora en{' '}
                <N>
                  {f.itsStall.before.ours.hit} de {f.itsStall.before.ours.of}
                </N>{' '}
                (paper:{' '}
                <N>
                  {f.itsStall.before.paper.hit} de {f.itsStall.before.paper.of}
                </N>
                ).
                {itsNrand && itsNrand.runs.length > 0 ? (
                  <>
                    {' '}
                    El experimento con otros N<sub>rand</sub> está en{' '}
                    <button
                      type="button"
                      onClick={goToNrand}
                      className="rounded-sm text-zinc-200 underline decoration-zinc-500 underline-offset-2 transition-colors outline-none hover:text-zinc-50 hover:decoration-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-50/80"
                    >
                      «ITS con |Vc| grande: sensibilidad a Nrand»
                    </button>
                    , en «Cómo se midió».
                  </>
                ) : null}
              </Note>
            </Cell>
          )}
        </dl>
      </div>
    </SpotlightCard>
  );
}
