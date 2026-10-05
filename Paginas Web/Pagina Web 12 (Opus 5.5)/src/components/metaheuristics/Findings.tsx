/**
 * Hallazgos de la sección «Metaheurísticas», calculados de los registros en la dirección elegida
 * (nunca escritos a mano):
 *  1. método con menor desviación promedio vs el Best del paper (y el paper en las mismas instancias);
 *  2. razón de tiempos exacto / heurístico del ILS y del ITS (y la de la fila «Time (s)» de la Tabla 9);
 *  3. instancias en que nuestra mejor corrida queda bajo el Best del paper;
 *  4. coincidencia de la solución inicial (dos fases) con la del paper.
 * Con datos parciales, el encabezado dice sobre cuántas instancias se calculó.
 */
import { useMemo, type ReactNode } from 'react';
import { Award, Equal, Timer, Trophy } from 'lucide-react';
import type { MetaDirection, MetaMethod, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { SpotlightCard } from '../ui';
import { CardHead } from '../benchmark/shared';
import { fmtPctValue } from '../benchmark/format';
import { META_METHODS, summarizeOverall, zOf, type InstanceRow, type MethodCell } from './aggregate';
import { mean } from './export';
import { META_INFO, type MetaFamily } from './labels';
import { MetaMark } from './shared';

/** Mismo umbral que aggregate: las cifras del paper tienen 2 decimales. */
const EPS_Z = 0.005;
/** Igualdad con una cifra del paper (redondeada a 2 decimales). */
const sameAsPaper = (z: number, p: number) => Math.abs(Math.round(z * 100) / 100 - p) < 0.006;
/** 8,82 → «8,8»; 27,3 → «27». */
const fmtRatio = (r: number) => fmt(r, r >= 10 ? 0 : 1);

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
      ours: e !== null && h !== null && h > 0 ? e / h : null,
      paper: pe !== null && ph !== null && ph > 0 ? pe / ph : null,
    };
  };
  const ratios = [ratio('ils'), ratio('its')];

  /* 3 · Bajo el Best del paper (mejor de todas nuestras corridas, cualquier método y dirección). */
  const withBest = rows.filter((r): r is InstanceRow & { ourBest: number; best: number } => r.ourBest !== null && r.best !== null);
  const beats = withBest.filter((r) => r.ourBest < r.best - EPS_Z);
  const ties = withBest.filter((r) => sameAsPaper(r.ourBest, r.best)).length;

  /* 4 · Solución inicial (dos fases) igual a la del paper. */
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

  return {
    total,
    common: common.length,
    withAny,
    ranking,
    ratios,
    beats: { count: beats.length, of: withBest.length, ties },
    init: { first: init1, second: init2 },
  };
}

/* ───────────────────────── Piezas ───────────────────────── */

function Cell({ icon, term, children, className }: { icon: ReactNode; term: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col bg-zinc-950/70 px-4 py-3.5', className)}>
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

/** Una línea de contexto bajo la cifra. */
function Note({ children }: { children: ReactNode }) {
  return <dd className="mt-1.5 text-[12px] leading-snug text-pretty text-zinc-500">{children}</dd>;
}

const Frac = ({ c }: { c: Count }) => (
  <>
    {c.hit}
    <span className="text-zinc-500">/{c.of}</span>
  </>
);

/* ───────────────────────── Componente ───────────────────────── */

export function MetaFindings({ rows, paper, dir }: { rows: InstanceRow[]; paper: PaperFile | null; dir: MetaDirection }) {
  const f = useMemo(() => computeFindings(rows, paper, dir), [rows, paper, dir]);
  const best = f.ranking[0] ?? null;
  const complete = f.total > 0 && f.common === f.total;
  const noPaper = 'Sin las cifras del paper.';

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
            ? `Aún sin resultados con ${dir}.`
            : complete
              ? `Sobre las ${f.total} instancias.`
              : `Parcial: ${f.common} de ${f.total} instancias con los cinco métodos.`
        }
      />

      <div className="@container mt-5 flex flex-1 flex-col">
        <dl className="grid flex-1 grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-800/80 @xs:grid-cols-2">
          {/* 1 · Menor desviación */}
          <Cell className="@xs:col-span-2" icon={<Trophy className="h-3.5 w-3.5 text-zinc-300" aria-hidden />} term="Menor desviación vs Best del paper">
            {best ? (
              <>
                <dd className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 self-center text-[13px] font-medium text-zinc-200">
                    <MetaMark method={best.m} size={12} />
                    {META_INFO[best.m].label}
                  </span>
                  <span className="num text-[26px] leading-none font-semibold tracking-tight text-zinc-50">{fmtPctValue(best.dev, 2)}</span>
                  {best.paperDev !== null && (
                    <span className="text-[12px] text-zinc-500">
                      paper: <span className="num">{fmtPctValue(best.paperDev, 2)}</span>
                    </span>
                  )}
                </dd>
                <dd className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                  {f.ranking.slice(1).map((x) => (
                    <span key={x.m} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400" title={META_INFO[x.m].title}>
                      <MetaMark method={x.m} size={10} />
                      {META_INFO[x.m].short}
                      <span className="num text-zinc-200">{fmtPctValue(x.dev, 2)}</span>
                    </span>
                  ))}
                </dd>
              </>
            ) : (
              <Note>{paper ? `Aún sin instancias con los cinco métodos en ${dir}.` : noPaper}</Note>
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
              {r.paper !== null && <Note>paper: {fmtRatio(r.paper)}× (Tabla 9)</Note>}
            </Cell>
          ))}

          {/* 3 · Bajo el Best del paper */}
          <Cell icon={<Award className="h-3.5 w-3.5 text-ok" aria-hidden />} term="Bajo el Best del paper">
            {f.beats.of > 0 ? (
              <>
                <Big value={f.beats.count} unit={`de ${f.beats.of} instancias`} />
                <Note>Lo iguala en {f.beats.ties}.</Note>
              </>
            ) : (
              <Note>{paper ? 'Aún sin corridas terminadas.' : noPaper}</Note>
            )}
          </Cell>

          {/* 4 · Solución inicial igual a la del paper */}
          <Cell icon={<Equal className="h-3.5 w-3.5 text-dp" aria-hidden />} term="Solución inicial = paper">
            {f.init.first.of > 0 ? (
              <>
                <Big value={<Frac c={f.init.first} />} unit="1 dir." />
                <Note>
                  Tour invertido: <span className="num"><Frac c={f.init.second} /></span>
                </Note>
              </>
            ) : (
              <Note>{paper ? 'Aún sin soluciones de dos fases.' : noPaper}</Note>
            )}
          </Cell>
        </dl>
      </div>
    </SpotlightCard>
  );
}
