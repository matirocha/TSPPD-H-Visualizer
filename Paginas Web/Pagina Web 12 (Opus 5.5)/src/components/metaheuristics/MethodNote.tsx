/**
 * Cómo se midió (sección «Metaheurísticas»): instancias y h de las Tablas 8–9 (con la evidencia de
 * las soluciones iniciales que coinciden con las del paper), tour TSP, regla de la búsqueda local del
 * ILS, parámetros (de meta.params o, si falta, de los propios registros), sensibilidad del ITS exacto
 * a Nrand con |Vc| grande (its_nrand.json, si existe), equipo frente al del paper, extracción y
 * validación de las cifras del paper, scripts y comandos.
 * Funciona sin consolidado (valores por defecto de benchmark.mjs) y con datos parciales.
 */
import { useMemo, type ReactNode } from 'react';
import { ArrowUpRight, Cpu, Database, FileCheck2, FlaskConical, Route, Scale, Search, SlidersHorizontal } from 'lucide-react';
import type { ItsNrandFile, ItsNrandRun, MetaFile, MetaMeta, MetaTwoPhaseRecord, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt, fmtAuto } from '../../lib/format';
import { SpotlightCard } from '../ui';
import { ERDOGAN_REF } from '../heuristics/methods';
import { CardHead, CommandLine, fmtDateTime } from '../benchmark/shared';
import { fmtNum, shortCpu } from '../benchmark/format';
import { gridOf } from './aggregate';
import { PAPER_H, Z_TOL, paperTimeMismatch } from './export';

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
/** Id del bloque de sensibilidad a Nrand (lo enlaza el hallazgo del ITS exacto con |Vc| grande). */
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

/**
 * Evidencia de los decimales de las cifras publicadas (instances.mjs, PAPER_H): con h = 0,125 todas
 * las cifras son múltiplos de 0,125; con h = 0,1, de 0,1; con 0,14, centésimas pares.
 */
const H_DECIMALS: Readonly<Record<number, string>> = {
  80: 'múltiplos de 0,125',
  100: 'múltiplos de 0,1',
  140: 'centésimas pares',
  160: 'múltiplos de 0,125',
  200: 'múltiplos de 0,1',
};

/** Regla que deja un h sin evidencia propia (ninguna solución inicial coincide y sin decimales distintivos). */
const H_RULE: Record<HKind, string> = {
  exact: 'el 20/|Vc| exacto',
  rounded: '20/|Vc| redondeado a 2 decimales',
  half: 'la mitad de 20/|Vc|',
  other: 'la misma calibración',
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

/**
 * Evidencia del h por tamaño, en texto: con qué |Vc| alguna solución inicial reproduce la del paper
 * y, en los tamaños sin ninguna coincidencia, en qué se apoya el h (decimales de las cifras
 * publicadas o la regla de los demás tamaños). null si aún no hay soluciones de dos fases.
 */
function hEvidenceOf(rows: HRow[], matches: Map<number, { hit: number; of: number }>): { matched: number[]; unmatched: string | null; unmatchedSizes: number[] } | null {
  const withData = rows.filter((r) => (matches.get(r.n)?.of ?? 0) > 0);
  if (!withData.length) return null;
  const matched = withData.filter((r) => (matches.get(r.n)?.hit ?? 0) > 0).map((r) => r.n);
  const none = withData.filter((r) => matches.get(r.n)?.hit === 0);
  if (!none.length) return { matched, unmatched: null, unmatchedSizes: [] };
  const byDecimals = none.filter((r) => H_DECIMALS[r.n]).map((r) => `${H_DECIMALS[r.n]} en ${r.n}`);
  const byRule = new Map<HKind, number[]>();
  for (const r of none) if (!H_DECIMALS[r.n]) byRule.set(r.kind, [...(byRule.get(r.kind) ?? []), r.n]);
  const decimals = byDecimals.length ? `en los decimales de las cifras publicadas (${listEs(byDecimals)})` : null;
  const rule = (kind: HKind) => `en la regla de los demás tamaños de su tipo (${H_RULE[kind]})`;
  // «…(decimales) y, en 120, en la regla …»; sin decimales y con una sola regla, basta la regla (los tamaños ya están en la frase).
  const rules = [...byRule].map(([kind, ns]) => (decimals || byRule.size > 1 ? `en ${listEs(ns)}, ${rule(kind)}` : rule(kind)));
  const unmatched = decimals ? [decimals, ...rules].join(' y, ') : rules.join('; ');
  return { matched, unmatched, unmatchedSizes: none.map((r) => r.n) };
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
function NrandBlock({ model, d, nIterIts }: { model: NrandModel; d: number; nIterIts: number }) {
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
  /** «las 9 corridas», «la única corrida», «7 de 9 corridas» (con números en tabulares). */
  const all = (k: number, of: number, one = '', many = '') => {
    const noun = (of === 1 ? one : many) ? ` ${of === 1 ? one : many}` : '';
    if (k === of) return of === 1 ? <>la única{noun}</> : <>las <Num>{of}</Num>{noun}</>;
    return (
      <>
        <Num>{k}</Num> de <Num>{of}</Num>
        {noun}
      </>
    );
  };

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
            Re-ejecución del ITS exacto con <Vc /> = {listEs(sizes)} (Id {idsText}; dirección 1, misma solución inicial y semilla que el
            benchmark, <Num>{nIterIts}</Num> iteraciones externas × <Num>{nIterIts}</Num> del TS interno) cambiando solo <NRand />, los
            movimientos aleatorios de cada perturbación.
          </p>
          {(atPaper.of > 0 || softer.of > 0) && (
            <p className="mt-2.5">
              {atPaper.of > 0 && (
                <>
                  Con <NRand /> = {fmtAuto(d, 2)}·<Vc /> = <Num>{listEs([...new Set(paperNRand.values())])}</Num> (§4.3, el del benchmark){' '}
                  {atPaper.improved === 0 ? (
                    <>
                      no mejora ninguna de las <Num>{atPaper.of}</Num> soluciones iniciales
                    </>
                  ) : (
                    <>
                      mejora <Num>{atPaper.improved}</Num> de <Num>{atPaper.of}</Num> soluciones iniciales
                    </>
                  )}
                </>
              )}
              {atPaper.of > 0 && softer.of > 0 ? '; con ' : softer.of > 0 ? 'Con ' : ''}
              {softer.of > 0 && softer.maxNRand !== null && (
                <>
                  <NRand /> ≤ <Num>{softer.maxNRand}</Num>
                  {softer.maxPct !== null && <> (≤ {fmtAuto(softer.maxPct, 1)} % de <Vc />)</>} mejora en{' '}
                  {all(softer.improved, softer.of, 'corrida', 'corridas')}
                  {softer.withPaper > 0 && (
                    <>
                      {' '}
                      y queda igual o bajo el ITS exacto del paper en {all(softer.atMostPaper, softer.withPaper)}
                    </>
                  )}
                </>
              )}
              .
            </p>
          )}
          {pattern && (
            <p className="mt-2.5 text-zinc-300">
              Sugiere que la perturbación efectiva del paper fue más suave que la descrita en el §4.3, un detalle que el paper no documenta. El
              benchmark mantiene <NRand /> = {fmtAuto(d, 2)}·<Vc />.
            </p>
          )}
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
            <span className="text-ok">Verde</span>: igual o menor que el ITS exacto «1 dir.» del paper (que parte de su propia solución inicial).
            Resaltada: <NRand /> = {fmtAuto(d, 2)}·<Vc />, la del §4.3 y del benchmark.
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
  const hEvidence = useMemo(() => hEvidenceOf(hRows, initMatches), [hRows, initMatches]);
  const nrand = useMemo(() => nrandModelOf(itsNrand, params.d), [itsNrand, params.d]);
  // ITS exacto 1dir: la fila «Avg.» de la Tabla 2 y la fila «Time (s)» de la Tabla 9 no coinciden.
  const itsGap = paperTimeMismatch(paper, 'its-exact');

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
  const halfSizes = hRows.filter((r) => r.kind === 'half').map((r) => r.n);
  const otherSizes = hRows.filter((r) => r.kind === 'other').map((r) => r.n);
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
    ? 'Aún no hay consolidado en Outputs/BenchmarkErdogan2012/: se muestran los valores por defecto de benchmark.mjs.'
    : `Consolidado generado el ${fmtDateTime(file.generatedAt)}${meta ? '' : ' (reconstruido desde registros.jsonl: sin datos del equipo; parámetros leídos de los registros)'}.`;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead eyebrow="Cómo se midió" title="Instancias, parámetros y decisiones de la réplica" note={note} />

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 1 · Instancias */}
        <Block title="Instancias" icon={<Database aria-hidden className={cn(iconCls, 'text-zinc-500')} />}>
          <p>
            Las 10 instancias euclidianas de 200 clientes de Gendreau, Laporte y Vigo (1999) —carpeta{' '}
            <span className="font-mono text-[12px] text-zinc-300">e_vigo/</span>— recortadas a sus primeros <Vc /> clientes:{' '}
            <Num>{sizes.length}</Num> tamaños (<Num>{nMin}</Num> a <Num>{nMax}</Num>) × <Num>{ids.length}</Num> instancias (Id {ids[0]}–
            {ids[ids.length - 1]}). La demanda se escala con la Ec. (15) del paper:
          </p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-zinc-300">
            <span>p′ᵢ = max{'{'}1, pᵢ mod 20{'}'}</span>
            <span>βᵢ = ⌊p′ᵢ·(i mod 5)/5⌋</span>
            <span>αᵢ = p′ᵢ − βᵢ</span>
            <span>Q = max{'{'}Σαᵢ, Σβᵢ{'}'}</span>
          </p>
          <p className="mt-2.5">
            <span className="font-mono text-[12px] text-zinc-300">verify.mjs</span> comprueba que así se reproducen exactamente (matriz, α, β y Q)
            los <Num>49</Num> archivos <span className="font-mono text-[12px] text-zinc-300">Instancias/2_N_Id.tsp</span> que ya existían (
            <Vc /> ≤ 100).
          </p>
        </Block>

        {/* 2 · h */}
        <Block title="Costo de manipulación h" icon={<Scale aria-hidden className={cn(iconCls, 'text-zinc-500')} />} className="lg:col-span-2">
          <p className="max-w-[80ch]">
            El texto del §5 fija h<sub>a</sub> = h<sub>b</sub> = h con h·<Vc /> = 20, para que ruteo y manipulación pesen parecido. Pero sus
            números solo se reproducen con 20/<Vc /> redondeado a 2 decimales cuando no es exacto
            {roundedRows.length > 0 && <> ({roundedRows.map((r) => fmtAuto(r.h, 3)).join(' · ')})</>}
            {halfRows.length > 0 && (
              <>
                {' '}
                y, en <Vc /> = {listEs(halfRows.map((r) => r.n))}, con la mitad ({listEs(halfRows.map((r) => fmtAuto(r.h, 3)))})
              </>
            )}
            . Se usan esos h:
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
                <tr className={cn(hEvidence && 'border-b border-dashed border-zinc-800/80')}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-zinc-500">
                    20/<Vc /> (texto)
                  </th>
                  {hRows.map((r) => (
                    <td key={r.n} className="num px-1.5 py-1.5 text-right text-zinc-500">
                      {fmtAuto(r.text, 3)}
                    </td>
                  ))}
                </tr>
                {hEvidence && (
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
          <p className="mt-2.5 max-w-[80ch]">
            {hEvidence ? (
              <>
                {hEvidence.matched.length > 0 && (
                  <>
                    Con <Vc /> = {listEs(hEvidence.matched)} el h elegido reproduce exactamente al menos una solución inicial del paper (columna
                    «Initial solution») y ningún otro candidato lo hace.{' '}
                  </>
                )}
                {hEvidence.unmatched && (
                  <>
                    Con <Vc /> = {listEs(hEvidence.unmatchedSizes)} ninguna de nuestras soluciones iniciales coincide con las del paper (nuestro
                    tour no es el de Concorde), así que el h se apoya {hEvidence.unmatched}.
                  </>
                )}
              </>
            ) : (
              <>
                Se determinó comparando nuestras soluciones iniciales con la columna «Initial solution» del paper y con los decimales de sus
                cifras; la comprobación aparece aquí cuando haya soluciones de dos fases.
              </>
            )}
          </p>
          <p className="mt-2 text-[12px] text-zinc-500">
            {halfSizes.length > 0 && (
              <>
                Resaltado: la mitad de 20/<Vc /> (<Vc /> = {listEs(halfSizes)}).{' '}
              </>
            )}
            {otherSizes.length > 0 && (
              <>
                Distinto de ambas lecturas: <Vc /> = {listEs(otherSizes)}.{' '}
              </>
            )}
            Fuente: {H_SOURCE[hSource]}.
          </p>
        </Block>

        {/* 4 · Tour TSP */}
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
            No siempre llega al mismo tour que Concorde, así que la solución inicial —y todo lo que parte de ella— puede diferir de la del paper. El
            tour se calcula una vez por instancia y lo comparten los cinco métodos. Si alguna de nuestras soluciones iniciales coincide con una del
            paper, la dirección 1 se orienta como su «1 dir.» (orientación «paper»).
          </p>
          {stats.twoPhaseDone > 0 && (
            <p className="mt-2 text-[12.5px] text-zinc-500">
              Orientación «paper» en <Num>{stats.paperOriented}</Num> de <Num>{stats.twoPhaseDone}</Num> instancias terminadas.
            </p>
          )}
        </Block>

        {/* 3 · Búsqueda local del ILS */}
        <Block title="Búsqueda local del ILS" icon={<Search aria-hidden className={cn(iconCls, 'text-ils')} />}>
          <p>
            El pseudo-código del Algoritmo 4.2 no define «improvement». Aquí la búsqueda local acepta un movimiento solo si mejora{' '}
            <span className="font-mono text-[12px] text-zinc-200">costCurrent</span>, la mejor solución conocida.
            {descent && <span className="text-zinc-200"> Este consolidado, en cambio, se generó con descenso completo.</span>}
          </p>
          <p className="mt-2.5">
            Es la lectura que reproduce el paper: su ILS exacto no mejora la solución inicial en ninguna instancia con <Vc /> ≥ 60, y su tiempo
            equivale a unos 1–2 barridos del vecindario por iteración.
          </p>
          <p className="mt-2.5">
            Con descenso completo (aceptar toda mejora del tour actual hasta un óptimo local) el ILS es mucho más fuerte —supera el Best del paper
            con <Vc /> ≤ 60— pero unas <span className="text-zinc-200">25–50 veces más lento</span>.
            {stats.descentRuns > 0 && (
              <>
                {' '}
                Esa variante tiene <Num>{stats.descentRuns}</Num> ejecuciones registradas (ilsd-*), fuera de las tablas.
              </>
            )}
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
            ITS: <Num>{nIterIts}</Num> iteraciones externas (perturbación + TS), cada TS interno con <Num>{nIterIts}</Num> iteraciones.{' '}
            {sameParams ? 'Iguales a los del paper.' :<span className="text-zinc-200">Distintos de los del paper (200 · 0,1 · 0,5).</span>}
          </p>
          <p className="mt-2.5">
            <span className="text-zinc-200">Evaluación heurística:</span> el mejor movimiento según la estimación lineal (§2.2) se re-evalúa con la
            DP exacta antes de aplicarlo. Esa heurística se desvía en promedio un <Num>8,5–9,8 %</Num> del óptimo (el paper reporta{' '}
            <Num>8,66 %</Num>).
          </p>
          {paramsSource !== 'meta' && (
            <p className="mt-2 text-[12px] text-zinc-500">
              {paramsSource === 'records' ? 'Leídos de la configuración de los registros.' : 'Valores por defecto de benchmark.mjs.'}
            </p>
          )}
        </Block>

        {/* 5b · ITS con |Vc| grande: sensibilidad a Nrand (its_nrand.json) */}
        {nrand && <NrandBlock model={nrand} d={params.d} nIterIts={nIterIts} />}

        {/* 6 · Equipo y tiempos */}
        <Block title="Equipo y tiempos" icon={<Cpu aria-hidden className={cn(iconCls, 'text-zinc-500')} />} className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Este benchmark</p>
              <dl className="mt-1 text-[12.5px]">
                <Row term="Procesador">
                  {meta?.cpu ? (
                    <span title={meta.cpu}>
                      {shortCpu(meta.cpu)}
                      {meta.logicalCpus ? <span className="text-zinc-500"> · {meta.logicalCpus} hilos lógicos</span> : null}
                    </span>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row term="Entorno">{meta?.runtime ?? 'Node.js'}</Row>
                <Row term="En paralelo">
                  {meta?.workers ? (
                    <>
                      <Num>{meta.workers}</Num> ejecuciones, un hilo cada una
                    </>
                  ) : (
                    '—'
                  )}
                </Row>
              </dl>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Erdoğan et al. · corridas de 2011</p>
              <dl className="mt-1 text-[12.5px]">
                <Row term="Equipo">
                  <span className="break-words">{paperMachine}</span>
                </Row>
                <Row
                  term={
                    <>
                      Por <Vc />
                    </>
                  }
                >
                  ILS e ITS exactos, 1 dir. (Tabla 2)
                </Row>
                <Row term="Promedio">cada columna (fila «Time (s)», Tabla 9)</Row>
              </dl>
            </div>
          </div>
          <p className="mt-3 max-w-[90ch]">
            Nuestros tiempos son segundos de pared: <span className="text-zinc-200">1dir</span> = tour TSP + solución inicial + metaheurística de
            la dirección 1; <span className="text-zinc-200">2dir</span> = tour TSP + ambas direcciones;{' '}
            <span className="text-zinc-200">dos fases</span> = tour TSP + reubicación del depósito. Con varias ejecuciones a la vez son comparables
            entre sí, aunque algo mayores que en una máquina dedicada. El tiempo del paper por <Vc /> en 2dir se estima como el doble del de 1dir
            (la Tabla 2 solo publica 1dir); el promedio general usa las dos columnas de la fila «Time (s)» de la Tabla 9, y solo con las
            100 instancias del paper terminadas (no se compara con el promedio de un subconjunto).
            {itsGap && (
              <>
                {' '}
                En ITS exacto 1dir el paper no es consistente: la fila «Avg.» de la Tabla 2 da <Num>{fmtNum(itsGap.table2, 2)} s</Num> y la Tabla 9,{' '}
                <Num>{fmtNum(itsGap.table9, 2)} s</Num>, para las mismas instancias; por eso el promedio general de esa columna no es la media de sus
                filas por <Vc />.
              </>
            )}
          </p>
          <p className="mt-2.5 max-w-[90ch] text-zinc-300">
            Los tiempos no son comparables 1:1 entre máquinas (otro procesador, otro lenguaje); sí lo son las razones: exacto frente a heurístico,
            ILS frente a ITS.
          </p>
        </Block>

        {/* 7 · Cifras del paper */}
        <Block title="Cifras del paper" icon={<FileCheck2 aria-hidden className={cn(iconCls, 'text-zinc-500')} />}>
          <p>
            Extraídas del PDF con PyMuPDF (<span className="font-mono text-[12px] text-zinc-300">paper_tables.py</span>, sin OCR) y validadas
            antes de usarlas:
          </p>
          <dl className="mt-1.5 text-[12.5px]">
            <Row term="Best e iniciales">
              {validation.tables67Match ? '= Tablas 6–7' : <span className="text-amber-300">no coinciden con las Tablas 6–7</span>}
            </Row>
            <Row term="Desviaciones">
              <Num>{validation.deviationChecks}</Num> recalculadas = Tablas 2–3
            </Row>
            <Row term="Máx. |Δ|">
              <Num>{fmtAuto(validation.maxAbsDiffPct, 4)}</Num> pp
            </Row>
          </dl>
          <p className="mt-2.5">
            En las Tablas 8–9, «2 dir.» es solo la corrida desde el tour invertido; X-2dir = min(1 dir., 2 dir.), que es como se reproducen las
            Tablas 2–3. Desviación = (Z − Best)/Best · 100, con Best la mejor solución conocida del paper.
          </p>
        </Block>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-zinc-800/70 pt-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[12px] text-zinc-500">
            Para continuar o repetir el benchmark (se reanuda desde Outputs/BenchmarkErdogan2012/registros.jsonl y omite lo ya registrado con la
            misma configuración):
          </p>
          <div className="mt-2 space-y-1.5">
            <CommandLine>{META_RUN}</CommandLine>
            <CommandLine>{CONSOLIDATE}</CommandLine>
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            La segunda línea solo regenera benchmark_metaheuristicas.json; <span className="font-mono text-zinc-400">npm run bundle</span> lo copia
            al paquete estático de la página.
          </p>
        </div>
        <div className="min-w-0 space-y-4">
          <ul className="space-y-1 text-[12.5px] leading-relaxed">
            {SCRIPTS.map((s) => (
              <li key={s.file} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[11.5px] text-zinc-300">
                  <span className="text-zinc-500">{SCRIPT_DIR}</span>
                  {s.file}
                </span>
                <span className="text-zinc-500">{s.role}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3 text-[13px] leading-relaxed text-pretty text-zinc-300">
            <div>
              <p>
                {ERDOGAN_REF.authors}. <cite className="text-zinc-100 italic">{ERDOGAN_REF.title}</cite>.{' '}
                <span className="text-zinc-400">
                  {ERDOGAN_REF.journal}, <span className="italic">{ERDOGAN_REF.volume}</span>, {ERDOGAN_REF.pages}. Tablas 2–3 y 6–9.
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
      </div>
    </SpotlightCard>
  );
}
