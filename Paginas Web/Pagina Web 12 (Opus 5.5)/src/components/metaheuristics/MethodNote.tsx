/**
 * Cómo se midió (sección «Metaheurísticas»), plegado por defecto: instancias y h de las Tablas 8–9
 * (con cuántas soluciones iniciales coinciden con las del paper), tour TSP, regla de la búsqueda local
 * del ILS, parámetros (de meta.params o, si falta, de los propios registros), sensibilidad del ITS
 * exacto a Nrand con |Vc| grande (its_nrand.json, si existe), equipo, validación de las cifras del
 * paper, scripts, comandos y referencias.
 * Funciona sin consolidado (valores por defecto de benchmark.mjs) y con datos parciales.
 */
import { useMemo, type ReactNode } from 'react';
import { ArrowUpRight, Cpu, Database, FileCheck2, FlaskConical, Route, Scale, Search, SlidersHorizontal } from 'lucide-react';
import type { ItsNrandFile, ItsNrandRun, MetaFile, MetaMeta, MetaTwoPhaseRecord, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto } from '../../lib/format';
import { Disclosure, SpotlightCard } from '../ui';
import { ERDOGAN_REF } from '../heuristics/methods';
import { CardHead, CommandLine, fmtDateTime } from '../benchmark/shared';
import { fmtNum, shortCpu } from '../benchmark/format';
import { gridOf } from './aggregate';
import { PAPER_H, Z_TOL } from './export';

/** Comando del benchmark (desde la raíz del repositorio; se reanuda desde registros.jsonl). */
export const META_RUN = 'node notebooks/erdogan2012/benchmark.mjs';
const CONSOLIDATE = `${META_RUN} --consolidate`;
const SCRIPT_DIR = 'notebooks/erdogan2012/';
const SCRIPTS: { file: string; role: string }[] = [
  { file: 'benchmark.mjs', role: 'recorre la grilla en paralelo y escribe registros.jsonl y el consolidado' },
  { file: 'engine.mjs', role: 'DP exacta, heurística lineal, vecindario, ILS, TS, ITS y tour TSP' },
  { file: 'instances.mjs', role: 'recorte de e_vigo/, Ec. (15) y h por tamaño' },
  { file: 'verify.mjs', role: 'verifica instancias, DP y heurística (código 1 si algo falla)' },
  { file: 'its_nrand.mjs', role: 'ITS exacto con varios Nrand y |Vc| grande (its_nrand.json)' },
  { file: 'paper_tables.py', role: 'extrae y valida las cifras de las Tablas 2–3 y 6–9' },
];
/** Id del bloque de sensibilidad a Nrand (destino de desplazamiento). */
export const ITS_NRAND_ANCHOR = 'metaheuristicas-its-nrand';

type Params = MetaMeta['params'];
type Source = 'meta' | 'records' | 'default';

/** Valores por defecto de benchmark.mjs (§4–5 del paper). */
const DEFAULT_PARAMS: Params = {
  nIter: 200,
  d: 0.1,
  nIterIts: 14,
  tabuRatio: 0.5,
  seed: 1,
  ilsLsRule: 'incumbent',
  tsp: { kicks: 3000, restarts: 8, method: '2-opt + Or-opt iterado con double-bridge (sustituto de Lin–Kernighan)' },
};
const PAPER_MACHINE = 'Intel Core 2 Quad 2,83 GHz, código en C (§5)';
const PAPER_VALIDATION: PaperFile['validation'] = { tables67Match: true, deviationChecks: 60, maxAbsDiffPct: 0.0047 };

const numOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const objOf = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
/** Decimales con coma en textos que vienen en inglés («2.83 GHz» → «2,83 GHz»). */
const commaDecimals = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2');
const itsItersOf = (nIter: number) => Math.floor(Math.sqrt(nIter) + 1e-9);
/** Mismas reglas que benchmark.mjs (nRandOf, tabuLengthOf). */
const nRandOf = (n: number, d: number) => Math.max(1, Math.floor(d * n + 0.5 + 1e-9));
const tabuLengthOf = (n: number, ratio: number) => Math.max(1, Math.round(ratio * n));

/** Parámetros del consolidado; si falta meta, los de la configuración de los registros; si no, los por defecto. */
function paramsOf(file: MetaFile | null): { params: Params; source: Source } {
  if (file?.meta?.params) return { params: file.meta.params, source: 'meta' };
  const recs = file?.records ?? [];
  const ils = recs.find((r) => r.method.startsWith('ils-'))?.config;
  const its = recs.find((r) => r.method.startsWith('its-'))?.config;
  const tspCfg = recs.find((r) => r.method === 'tsp')?.config?.tsp;
  const run = ils ?? its;
  if (!run && !tspCfg) return { params: DEFAULT_PARAMS, source: 'default' };
  const tsp = objOf(tspCfg);
  const nIter = numOf(run?.nIter) ?? DEFAULT_PARAMS.nIter;
  return {
    params: {
      nIter,
      d: numOf(run?.d) ?? DEFAULT_PARAMS.d,
      nIterIts: numOf(its?.nIterIts) ?? itsItersOf(nIter),
      tabuRatio: numOf(its?.tabuRatio) ?? DEFAULT_PARAMS.tabuRatio,
      seed: numOf(run?.seed) ?? numOf(tsp.seed) ?? DEFAULT_PARAMS.seed,
      ilsLsRule: ils?.lsRule === 'descent' ? 'descent' : 'incumbent',
      tsp: {
        kicks: numOf(tsp.kicks) ?? DEFAULT_PARAMS.tsp.kicks,
        restarts: numOf(tsp.restarts) ?? DEFAULT_PARAMS.tsp.restarts,
        method: DEFAULT_PARAMS.tsp.method,
      },
    },
    source: 'records',
  };
}

type HKind = 'exact' | 'rounded' | 'half' | 'other';
interface HRow {
  n: number;
  h: number;
  /** 20/|Vc|, lo que dice el texto del §5. */
  text: number;
  kind: HKind;
}

/** h por |Vc|: meta.h del consolidado, si no el h de los registros, si no PAPER_H. */
function hRowsOf(file: MetaFile | null): { rows: HRow[]; source: Source } {
  const { sizes } = gridOf(file);
  const metaH = file?.meta?.h ?? {};
  const recH = new Map<number, number>();
  for (const r of file?.records ?? []) if (!recH.has(r.n) && numOf(r.h) !== null) recH.set(r.n, r.h);
  let source: Source = 'default';
  const rows = sizes.map((n) => {
    const fromMeta = numOf(metaH[String(n)]);
    const fromRec = recH.get(n) ?? null;
    if (fromMeta !== null) source = 'meta';
    else if (fromRec !== null && source !== 'meta') source = 'records';
    const h = fromMeta ?? fromRec ?? PAPER_H[n] ?? 20 / n;
    const text = 20 / n;
    const kind: HKind =
      Math.abs(h - text) < 1e-9 ? 'exact' : Math.abs(h - Math.round(text * 100) / 100) < 1e-9 ? 'rounded' : Math.abs(h - text / 2) < 5e-3 ? 'half' : 'other';
    return { n, h, text, kind };
  });
  return { rows, source };
}

const H_SOURCE: Record<Source, string> = {
  meta: 'meta.h del consolidado',
  records: 'h de los registros',
  default: 'PAPER_H de instances.mjs (aún sin consolidado)',
};

const H_TITLE: Record<HKind, string> = {
  exact: 'Igual a 20/|Vc|',
  rounded: '20/|Vc| redondeado a 2 decimales',
  half: 'La mitad de 20/|Vc|',
  other: 'Distinto de 20/|Vc|',
};

/** «20», «20 y 40», «20, 40 y 60». */
const listEs = (xs: (string | number)[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

/** Igualdad con una cifra del paper (publicada con 2 decimales). */
const samePaperZ = (z: number, p: number) => Math.abs(Math.round(z * 100) / 100 - p) < 0.006;

/**
 * Por |Vc|: instancias en que alguna de nuestras soluciones iniciales (dos fases, cualquier dirección)
 * es igual a una «Initial solution» del paper (1 dir. o 2 dir.), sobre las instancias con dos fases y paper.
 */
function initMatchesOf(file: MetaFile | null, paper: PaperFile | null): Map<number, { hit: number; of: number }> {
  const out = new Map<number, { hit: number; of: number }>();
  if (!file || !paper?.instances?.length) return out;
  const byKey = new Map(paper.instances.map((p) => [`${p.n}|${p.id}`, p]));
  for (const r of file.records) {
    if (r.method !== 'twophase' || r.status !== 'ok') continue;
    const p = byKey.get(`${r.n}|${r.id}`);
    const dirs = (r as MetaTwoPhaseRecord).dirs ?? [];
    if (!p || !dirs.length) continue;
    const c = out.get(r.n) ?? { hit: 0, of: 0 };
    c.of++;
    if (dirs.some((d) => numOf(d.objective) !== null && (samePaperZ(d.objective, p.init1) || samePaperZ(d.objective, p.init2)))) c.hit++;
    out.set(r.n, c);
  }
  return out;
}

/* ───────────────────────── Sensibilidad del ITS exacto a Nrand ───────────────────────── */

interface NrandRow {
  n: number;
  id: number;
  initial: number;
  paperInitial: number | null;
  paper: number | null;
  /** Z final por Nrand (columnas de `nRands`). */
  byNRand: Map<number, ItsNrandRun>;
}

interface NrandModel {
  sizes: number[];
  nRands: number[];
  rows: NrandRow[];
  /** Nrand del §4.3 (0,1·|Vc|) por tamaño: el del benchmark. */
  paperNRand: Map<number, number>;
  /** Corridas con el Nrand del §4.3 y cuántas mejoran su solución inicial. */
  atPaper: { of: number; improved: number };
  /** Corridas con un Nrand menor: cuántas mejoran y cuántas quedan igual o bajo el ITS exacto del paper. */
  softer: { of: number; improved: number; atMostPaper: number; withPaper: number; maxNRand: number | null; maxPct: number | null };
}

const improvedRun = (r: ItsNrandRun) => r.best < r.initial - Z_TOL;
const atMostPaper = (z: number, paper: number | null) => paper !== null && z <= paper + Z_TOL;

function nrandModelOf(file: ItsNrandFile | null, d: number): NrandModel | null {
  const runs = (file?.runs ?? []).filter((r) => [r.n, r.id, r.nRand, r.initial, r.best].every((v) => numOf(v) !== null));
  if (!runs.length) return null;
  const sizes = [...new Set(runs.map((r) => r.n))].sort((a, b) => a - b);
  const nRands = [...new Set(runs.map((r) => r.nRand))].sort((a, b) => a - b);
  const paperNRand = new Map(sizes.map((n) => [n, nRandOf(n, d)]));
  const byKey = new Map<string, NrandRow>();
  for (const r of runs) {
    const k = `${r.n}|${r.id}`;
    let row = byKey.get(k);
    if (!row) {
      row = { n: r.n, id: r.id, initial: r.initial, paperInitial: numOf(r.paperInitial), paper: numOf(r.paperItsExact1dir), byNRand: new Map() };
      byKey.set(k, row);
    }
    row.byNRand.set(r.nRand, r);
  }
  const rows = [...byKey.values()].sort((a, b) => a.n - b.n || a.id - b.id);
  const atPaperRuns = runs.filter((r) => r.nRand === paperNRand.get(r.n));
  const softerRuns = runs.filter((r) => r.nRand < (paperNRand.get(r.n) ?? -Infinity));
  const maxSoft = softerRuns.length ? Math.max(...softerRuns.map((r) => r.nRand)) : null;
  const maxPct = softerRuns.length ? Math.max(...softerRuns.map((r) => (r.nRand / r.n) * 100)) : null;
  const softWithPaper = softerRuns.filter((r) => numOf(r.paperItsExact1dir) !== null);
  return {
    sizes,
    nRands,
    rows,
    paperNRand,
    atPaper: { of: atPaperRuns.length, improved: atPaperRuns.filter(improvedRun).length },
    softer: {
      of: softerRuns.length,
      improved: softerRuns.filter(improvedRun).length,
      atMostPaper: softWithPaper.filter((r) => atMostPaper(r.best, r.paperItsExact1dir)).length,
      withPaper: softWithPaper.length,
      maxNRand: maxSoft,
      maxPct,
    },
  };
}

/* ───────────────────────── Piezas ───────────────────────── */

function Vc() {
  return (
    <span className="whitespace-nowrap">
      |V<sub className="text-[0.72em]">c</sub>|
    </span>
  );
}

function Row({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-zinc-800/80 py-1.5 last:border-0">
      <dt className="shrink-0 text-zinc-500">{term}</dt>
      <dd className="min-w-0 text-right text-zinc-200">{children}</dd>
    </div>
  );
}

function Block({
  title,
  icon,
  className,
  id,
  children,
}: {
  title: string;
  icon: ReactNode;
  className?: string;
  /** Destino de un desplazamiento por código (recibe el foco; ver index.css, [data-scroll-anchor]). */
  id?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      data-scroll-anchor={id ? '' : undefined}
      tabIndex={id ? -1 : undefined}
      className={cn('min-w-0 rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-4', id && 'outline-none focus-visible:ring-2 focus-visible:ring-zinc-50/80', className)}
    >
      <p className="flex items-center gap-2 text-[13.5px] font-medium text-zinc-100">
        {icon}
        {title}
      </p>
      <div className="mt-2.5 text-[13px] leading-relaxed text-pretty text-zinc-400">{children}</div>
    </div>
  );
}

const iconCls = 'h-3.5 w-3.5 shrink-0';

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', className)} />;
}

function Num({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-200">{children}</span>;
}

function NRand() {
  return (
    <>
      N<sub className="text-[0.72em]">rand</sub>
    </>
  );
}

/** Z con dos decimales, como en el detalle por instancia. */
const fmtZ2 = (z: number | null) => fmtNum(z, 2);

/**
 * ITS exacto con |Vc| grande y distintos Nrand (its_nrand.json): una fila por instancia con la
 * solución inicial, el Z final con cada Nrand (resaltada la columna del §4.3, la del benchmark) y el
 * ITS exacto «1 dir.» del paper; en verde, los Z iguales o menores que el del paper.
 */
function NrandBlock({ model, d }: { model: NrandModel; d: number }) {
  const { rows, nRands, sizes, paperNRand, atPaper, softer } = model;
  const multiN = sizes.length > 1;
  // Columna del §4.3 en la cabecera solo si es la misma para todos los tamaños del experimento.
  const headerPaperNRand = new Set(paperNRand.values()).size === 1 ? [...paperNRand.values()][0] : null;
  const ids = [...new Set(rows.map((r) => r.id))].sort((a, b) => a - b);
  const idsText = ids.length > 2 && ids.every((x, k) => k === 0 || x === ids[k - 1] + 1) ? `${ids[0]}–${ids[ids.length - 1]}` : listEs(ids);
  const pattern =
    atPaper.of > 0 &&
    atPaper.improved === 0 &&
    softer.of > 0 &&
    softer.improved === softer.of &&
    softer.withPaper > 0 &&
    softer.atMostPaper === softer.withPaper;
  return (
    <Block
      id={ITS_NRAND_ANCHOR}
      title="ITS con |Vc| grande: sensibilidad a Nrand"
      icon={<FlaskConical aria-hidden className={cn(iconCls, 'text-its')} />}
      className="lg:col-span-3"
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 max-w-[75ch]">
          <p>
            ITS exacto (dirección 1, misma semilla) con <Vc /> = {listEs(sizes)}, Id {idsText}, variando solo <NRand />.
          </p>
          {(atPaper.of > 0 || softer.of > 0) && (
            <p className="mt-2">
              {atPaper.of > 0 && (
                <>
                  Con el <NRand /> del §4.3 (<Num>{listEs([...new Set(paperNRand.values())])}</Num>) mejora{' '}
                  <Num>{atPaper.improved}</Num>/<Num>{atPaper.of}</Num> soluciones iniciales
                </>
              )}
              {atPaper.of > 0 && softer.of > 0 ? '; con ' : softer.of > 0 ? 'Con ' : ''}
              {softer.of > 0 && softer.maxNRand !== null && (
                <>
                  <NRand /> ≤ <Num>{softer.maxNRand}</Num>, <Num>{softer.improved}</Num>/<Num>{softer.of}</Num>
                  {softer.withPaper > 0 && (
                    <>
                      {' '}
                      (≤ paper en <Num>{softer.atMostPaper}</Num>/<Num>{softer.withPaper}</Num>)
                    </>
                  )}
                </>
              )}
              .
            </p>
          )}
          {pattern && <p className="mt-2 text-zinc-300">Sugiere que el paper usó una perturbación más suave que la del §4.3.</p>}
        </div>

        <div className="min-w-0">
          <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
            <table className="w-full border-collapse text-[12px] whitespace-nowrap">
              <caption className="sr-only">
                Z final del ITS exacto (dirección 1) con cada Nrand, solución inicial e ITS exacto 1 dir. del paper, por instancia
              </caption>
              <thead>
                <tr className="text-[11px] text-zinc-500">
                  <td colSpan={multiN ? 3 : 2} />
                  <th scope="colgroup" colSpan={nRands.length} className="px-1.5 pb-1 text-center font-normal">
                    Z final con <NRand /> =
                  </th>
                  <td />
                </tr>
                <tr className="border-b border-zinc-800">
                  {multiN && (
                    <th scope="col" className="py-1.5 pr-3 text-left font-normal text-zinc-500">
                      <Vc />
                    </th>
                  )}
                  <th scope="col" className="py-1.5 pr-3 text-left font-normal text-zinc-500">
                    Id
                  </th>
                  <th scope="col" className="px-1.5 py-1.5 text-right font-normal text-zinc-500" title="Solución inicial (dos fases, dirección 1); debajo, la del paper («1 dir.»)">
                    Inicial
                  </th>
                  {nRands.map((k) => {
                    const isPaper = k === headerPaperNRand;
                    return (
                      <th
                        key={k}
                        scope="col"
                        title={isPaper ? `Nrand = ${k} = ${fmtAuto(d, 2)}·|Vc|: el del §4.3 y del benchmark` : `Nrand = ${k}`}
                        className={cn('num px-2 py-1.5 text-right font-medium', isPaper ? 'rounded-t-md bg-its/[0.08] text-zinc-50' : 'text-zinc-300')}
                      >
                        {k}
                        {isPaper && <span className="ml-1 font-sans text-[10px] font-normal text-zinc-400">§4.3</span>}
                      </th>
                    );
                  })}
                  <th scope="col" className="px-1.5 py-1.5 text-right font-normal text-zinc-500" title="ITS exacto «1 dir.» de las Tablas 8–9, desde la solución inicial del paper">
                    Paper
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.n}|${r.id}`} className="border-b border-dashed border-zinc-800/80 last:border-0">
                    {multiN && <td className="num py-1.5 pr-3 align-top text-zinc-400">{r.n}</td>}
                    <th scope="row" className="num py-1.5 pr-3 text-left align-top font-normal text-zinc-200">
                      {r.id}
                    </th>
                    <td className="num px-1.5 py-1.5 text-right align-top text-zinc-400">
                      {fmtZ2(r.initial)}
                      {r.paperInitial !== null && <span className="block text-[10.5px] text-zinc-500">paper {fmtZ2(r.paperInitial)}</span>}
                    </td>
                    {nRands.map((k) => {
                      const run = r.byNRand.get(k);
                      const isPaper = k === paperNRand.get(r.n);
                      const base = cn('num px-2 py-1.5 text-right align-top', isPaper && 'bg-its/[0.08]');
                      if (!run) {
                        return (
                          <td key={k} className={cn(base, 'text-zinc-500')}>
                            —
                          </td>
                        );
                      }
                      const ok = atMostPaper(run.best, r.paper);
                      const same = !improvedRun(run);
                      return (
                        <td
                          key={k}
                          className={cn(base, ok ? 'font-medium text-ok' : same ? 'text-zinc-500' : 'text-zinc-200')}
                          title={
                            `Nrand = ${k}: Z final ${fmtZ2(run.best)}` +
                            (same ? ', igual a la solución inicial' : ` (${run.improvements} mejoras; la mejor en la iteración ${run.bestIteration})`) +
                            (r.paper !== null ? `; paper ${fmtZ2(r.paper)}` : '') +
                            (numOf(run.runSec) !== null ? ` · ${fmt(run.runSec, 0)} s` : '')
                          }
                        >
                          {fmtZ2(run.best)}
                          {ok && <span className="sr-only"> (igual o menor que el paper)</span>}
                        </td>
                      );
                    })}
                    <td className="num px-1.5 py-1.5 text-right align-top text-zinc-300">{r.paper === null ? '—' : fmtZ2(r.paper)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            <span className="text-ok">Verde</span>: ≤ ITS exacto del paper. Resaltada: <NRand /> = {fmtAuto(d, 2)}·<Vc /> (§4.3).
          </p>
        </div>
      </div>
    </Block>
  );
}

/* ───────────────────────── Tarjeta ───────────────────────── */

export function MetaMethodNote({
  file,
  paper,
  itsNrand = null,
}: {
  file: MetaFile | null;
  paper: PaperFile | null;
  /** Experimento its_nrand.json; sin él no se muestra el bloque de sensibilidad a Nrand. */
  itsNrand?: ItsNrandFile | null;
}) {
  const meta = file?.meta ?? null;
  const { sizes, ids } = gridOf(file);
  const { params, source: paramsSource } = useMemo(() => paramsOf(file), [file]);
  const { rows: hRows, source: hSource } = useMemo(() => hRowsOf(file), [file]);
  const initMatches = useMemo(() => initMatchesOf(file, paper), [file, paper]);
  const nrand = useMemo(() => nrandModelOf(itsNrand, params.d), [itsNrand, params.d]);

  const stats = useMemo(() => {
    const recs = file?.records ?? [];
    const twoPhase = recs.filter((r): r is MetaTwoPhaseRecord => r.method === 'twophase' && r.status === 'ok');
    return {
      twoPhaseDone: twoPhase.length,
      paperOriented: twoPhase.filter((r) => r.orientation === 'paper').length,
      descentRuns: recs.filter((r) => r.method.startsWith('ilsd-')).length,
    };
  }, [file]);

  const nMin = sizes[0];
  const nMax = sizes[sizes.length - 1];
  const nIterIts = params.nIterIts || itsItersOf(params.nIter);
  const hasMatches = initMatches.size > 0;
  const validation = paper?.validation ?? PAPER_VALIDATION;
  const paperMachine = paper?.machine ? commaDecimals(paper.machine) : PAPER_MACHINE;
  const paperParams = paper?.params ?? null;
  const sameParams =
    !paperParams ||
    (numOf(paperParams.nIter) === params.nIter && numOf(paperParams.d) === params.d && numOf(paperParams.tabuRatio) === params.tabuRatio);
  const descent = params.ilsLsRule === 'descent';
  const roundedRows = hRows.filter((r) => r.kind === 'rounded');
  const halfRows = hRows.filter((r) => r.kind === 'half');

  const note = !file
    ? 'Aún sin consolidado: valores por defecto de benchmark.mjs.'
    : `Consolidado del ${fmtDateTime(file.generatedAt)}${meta ? '' : ' (reconstruido desde registros.jsonl)'}.`;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead eyebrow="Cómo se midió" title="Instancias, parámetros y equipo" note={note} />

      <Disclosure summary="Ver metodología, comandos y referencias" className="mt-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* 1 · Instancias */}
          <Block title="Instancias" icon={<Database aria-hidden className={cn(iconCls, 'text-zinc-500')} />}>
            <p>
              Gendreau, Laporte y Vigo (1999), <span className="font-mono text-[12px] text-zinc-300">e_vigo/</span>, recortadas a sus primeros{' '}
              <Vc /> clientes: <Num>{sizes.length}</Num> tamaños (<Num>{nMin}</Num>–<Num>{nMax}</Num>) × <Num>{ids.length}</Num> instancias.
              Demanda según la Ec. (15):
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-zinc-300">
              <span>p′ᵢ = max{'{'}1, pᵢ mod 20{'}'}</span>
              <span>βᵢ = ⌊p′ᵢ·(i mod 5)/5⌋</span>
              <span>αᵢ = p′ᵢ − βᵢ</span>
              <span>Q = max{'{'}Σαᵢ, Σβᵢ{'}'}</span>
            </p>
          </Block>

          {/* 2 · h */}
          <Block title="Costo de manipulación h" icon={<Scale aria-hidden className={cn(iconCls, 'text-zinc-500')} />} className="lg:col-span-2">
            <p className="max-w-[80ch]">
              El §5 dice h = 20/<Vc />, pero las cifras del paper solo se reproducen con ese valor redondeado a 2 decimales
              {roundedRows.length > 0 && <> ({roundedRows.map((r) => fmtAuto(r.h, 3)).join(' · ')})</>}
              {halfRows.length > 0 && (
                <>
                  {' '}
                  y con la mitad en <Vc /> = {listEs(halfRows.map((r) => r.n))}
                </>
              )}
              .
            </p>
            <div className="scrollbar-thin -mx-1 mt-3 overflow-x-auto px-1">
              <table className="w-full border-collapse text-[12px] whitespace-nowrap">
                <caption className="sr-only">h usado por tamaño frente al 20/|Vc| que dice el texto del paper</caption>
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-zinc-500">
                      <Vc />
                    </th>
                    {hRows.map((r) => (
                      <th key={r.n} scope="col" className="num px-1.5 py-1.5 text-right font-medium text-zinc-300">
                        {r.n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dashed border-zinc-800/80">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-zinc-200">
                      h usado
                    </th>
                    {hRows.map((r) => (
                      <td key={r.n} className="num px-1.5 py-1.5 text-right" title={H_TITLE[r.kind]}>
                        <span
                          className={cn(
                            'rounded-md px-1 py-0.5',
                            r.kind === 'half' || r.kind === 'other' ? 'bg-zinc-800 font-medium text-zinc-50 ring-1 ring-zinc-600/60' : 'text-zinc-200',
                          )}
                        >
                          {fmtAuto(r.h, 3)}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className={cn(hasMatches && 'border-b border-dashed border-zinc-800/80')}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-zinc-500">
                      20/<Vc /> (texto)
                    </th>
                    {hRows.map((r) => (
                      <td key={r.n} className="num px-1.5 py-1.5 text-right text-zinc-500">
                        {fmtAuto(r.text, 3)}
                      </td>
                    ))}
                  </tr>
                  {hasMatches && (
                    <tr>
                      <th
                        scope="row"
                        title="Instancias en que alguna de nuestras soluciones iniciales (dos fases, cualquier dirección) es igual a una «Initial solution» del paper, de las terminadas"
                        className="py-1.5 pr-3 text-left font-normal text-zinc-500"
                      >
                        Iniciales = paper
                      </th>
                      {hRows.map((r) => {
                        const c = initMatches.get(r.n);
                        return (
                          <td
                            key={r.n}
                            className="num px-1.5 py-1.5 text-right"
                            title={c ? `|Vc| = ${r.n}: ${c.hit} de ${c.of} instancias con una solución inicial igual a la del paper` : `|Vc| = ${r.n}: aún sin soluciones de dos fases`}
                          >
                            {c ? (
                              <>
                                <span className={c.hit > 0 ? 'text-zinc-200' : 'text-zinc-500'}>{c.hit}</span>
                                <span className="text-zinc-500">/{c.of}</span>
                              </>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-zinc-500">
              {hasMatches && 'Iniciales = paper: instancias cuya solución inicial reproduce la del paper. '}Fuente: {H_SOURCE[hSource]}.
            </p>
          </Block>

          {/* 3 · Tour TSP */}
          <Block title="Tour TSP" icon={<Route aria-hidden className={cn(iconCls, 'text-dp')} />}>
            <dl className="text-[12.5px]">
              <Row term="Paper">Lin–Kernighan (Concorde)</Row>
              <Row term="Aquí">
                <span className="break-words">{params.tsp.method}</span>
              </Row>
              <Row term="Búsqueda">
                <Num>{fmt(params.tsp.restarts, 0)}</Num> reinicios × <Num>{fmt(params.tsp.kicks, 0)}</Num> double-bridge
              </Row>
            </dl>
            <p className="mt-2.5">
              Uno por instancia, compartido por los cinco métodos; no siempre coincide con el de Concorde.
              {stats.twoPhaseDone > 0 && (
                <>
                  {' '}
                  Misma orientación que el paper en <Num>{stats.paperOriented}</Num>/<Num>{stats.twoPhaseDone}</Num>.
                </>
              )}
            </p>
          </Block>

          {/* 4 · Búsqueda local del ILS */}
          <Block title="Búsqueda local del ILS" icon={<Search aria-hidden className={cn(iconCls, 'text-ils')} />}>
            <p>
              Acepta un movimiento solo si mejora <span className="font-mono text-[12px] text-zinc-200">costCurrent</span>: la lectura que reproduce
              el paper.
              {descent && <span className="text-zinc-200"> Este consolidado usó descenso completo.</span>}
            </p>
            <p className="mt-2">
              El descenso completo es más fuerte pero <span className="text-zinc-200">25–50× más lento</span>
              {stats.descentRuns > 0 && (
                <>
                  {' '}
                  (<Num>{stats.descentRuns}</Num> ejecuciones ilsd-*, fuera de las tablas)
                </>
              )}
              .
            </p>
          </Block>

          {/* 5 · Parámetros */}
          <Block title="Parámetros (§4–5)" icon={<SlidersHorizontal aria-hidden className={cn(iconCls, 'text-zinc-500')} />}>
            <dl className="text-[12.5px]">
              <Row term={<>N<sub>iter</sub></>}>
                <Num>{fmt(params.nIter, 0)}</Num> por dirección
              </Row>
              <Row term={<>N<sub>rand</sub></>}>
                <Num>{fmtAuto(params.d, 2)}</Num>·<Vc /> ={' '}
                <Num>
                  {nRandOf(nMin, params.d)}–{nRandOf(nMax, params.d)}
                </Num>
              </Row>
              <Row
                term={
                  <span className="inline-flex items-center gap-1.5">
                    <Dot className="bg-its" />
                    N*<sub>iter</sub> ITS
                  </span>
                }
              >
                ⌊√{params.nIter}⌋ = <Num>{nIterIts}</Num>
              </Row>
              <Row term="Lista tabú">
                <Num>{fmtAuto(params.tabuRatio, 2)}</Num>·<Vc /> ={' '}
                <Num>
                  {tabuLengthOf(nMin, params.tabuRatio)}–{tabuLengthOf(nMax, params.tabuRatio)}
                </Num>
              </Row>
              <Row term="Semilla">
                <Num>{params.seed}</Num>
              </Row>
            </dl>
            <p className="mt-2.5">
              {sameParams ? 'Iguales a los del paper.' : <span className="text-zinc-200">Distintos de los del paper (200 · 0,1 · 0,5).</span>} La
              variante heurística re-evalúa con la DP el mejor movimiento lineal (§2.2).
              {paramsSource !== 'meta' && (
                <span className="text-zinc-500">
                  {' '}
                  {paramsSource === 'records' ? 'Leídos de los registros.' : 'Valores por defecto.'}
                </span>
              )}
            </p>
          </Block>

          {/* 5b · ITS con |Vc| grande: sensibilidad a Nrand (its_nrand.json) */}
          {nrand && <NrandBlock model={nrand} d={params.d} />}

          {/* 6 · Equipo */}
          <Block title="Equipo" icon={<Cpu aria-hidden className={cn(iconCls, 'text-zinc-500')} />} className="lg:col-span-2">
            <dl className="grid grid-cols-1 gap-x-6 text-[12.5px] sm:grid-cols-2">
              <div className="min-w-0">
                <Row term="Este benchmark">
                  {meta?.cpu ? (
                    <span title={meta.cpu}>
                      {shortCpu(meta.cpu)}
                      {meta.logicalCpus ? <span className="text-zinc-500"> · {meta.logicalCpus} hilos</span> : null}
                    </span>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row term="Entorno">
                  {meta?.runtime ?? 'Node.js'}
                  {meta?.workers ? <span className="text-zinc-500"> · {meta.workers} en paralelo</span> : null}
                </Row>
              </div>
              <div className="min-w-0">
                <Row term="Paper">
                  <span className="break-words">{paperMachine}</span>
                </Row>
                <Row term="Sus tiempos">Tabla 2 (por |Vc|) y Tabla 9</Row>
              </div>
            </dl>
            <p className="mt-2.5">Segundos de pared con el tour TSP; el tiempo del paper en 2dir por |Vc| se estima como el doble del de 1dir.</p>
          </Block>

          {/* 7 · Cifras del paper */}
          <Block title="Cifras del paper" icon={<FileCheck2 aria-hidden className={cn(iconCls, 'text-zinc-500')} />}>
            <dl className="text-[12.5px]">
              <Row term="Best e iniciales">
                {validation.tables67Match ? '= Tablas 6–7' : <span className="text-amber-300">no coinciden con las Tablas 6–7</span>}
              </Row>
              <Row term="Desviaciones">
                <Num>{validation.deviationChecks}</Num> = Tablas 2–3
              </Row>
              <Row term="Máx. |Δ|">
                <Num>{fmtAuto(validation.maxAbsDiffPct, 4)}</Num> pp
              </Row>
            </dl>
            <p className="mt-2 text-[12px] text-zinc-500">Extraídas del PDF con paper_tables.py.</p>
          </Block>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 border-t border-zinc-800/70 pt-4 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[12px] text-zinc-500">Continuar o repetir (se reanuda desde registros.jsonl) y regenerar el consolidado:</p>
            <div className="mt-2 space-y-1.5">
              <CommandLine>{META_RUN}</CommandLine>
              <CommandLine>{CONSOLIDATE}</CommandLine>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11.5px] text-zinc-400">
              <span className="text-zinc-500">{SCRIPT_DIR}</span>
              {SCRIPTS.map((s) => (
                <span key={s.file} title={s.role}>
                  {s.file}
                </span>
              ))}
            </p>
          </div>
          <div className="min-w-0 space-y-3 text-[13px] leading-relaxed text-pretty text-zinc-300">
            <div>
              <p>
                {ERDOGAN_REF.authors}. <cite className="text-zinc-100 italic">{ERDOGAN_REF.title}</cite>.{' '}
                <span className="text-zinc-400">
                  {ERDOGAN_REF.journal}, <span className="italic">{ERDOGAN_REF.volume}</span>, {ERDOGAN_REF.pages}.
                </span>
              </p>
              <a
                href={`https://doi.org/${ERDOGAN_REF.doi}`}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1 rounded-md font-mono text-[11.5px] text-zinc-400 transition-colors hover:text-zinc-50"
              >
                doi:{ERDOGAN_REF.doi}
                <ArrowUpRight
                  aria-hidden
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
            <p>
              Gendreau, M., Laporte, G. y Vigo, D. (1999).{' '}
              <cite className="text-zinc-100 italic">Heuristics for the traveling salesman problem with pickup and delivery</cite>.{' '}
              <span className="text-zinc-400">
                Computers & Operations Research, <span className="italic">26</span>, 699–714.
              </span>
            </p>
          </div>
        </div>
      </Disclosure>
    </SpotlightCard>
  );
}
