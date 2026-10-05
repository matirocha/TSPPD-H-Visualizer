/**
 * «Resumen por |Vc|» de la sección «Metaheurísticas», al estilo de las Tablas 2–3 de Erdoğan et al.
 * (2012) pero con los cinco métodos (dos fases, ILS e ITS heurísticos y exactos) y, como en sus
 * Tablas 3 y 8–9, las dos direcciones lado a lado: una fila por |Vc| con su h, y por método las
 * columnas «1 dir.» y «2 dir.», cada una con el valor objetivo medio Z y los segundos medios por
 * instancia; bajo cada cifra nuestra, la del paper (la desviación respecto del Best va en el tooltip). Las filas por |Vc| promedian
 * lo terminado de cada método («k/10» mientras falten instancias) y la fila «Prom.», en cada
 * dirección, solo las instancias que los cinco métodos ya terminaron. Todo el cálculo vive en
 * export.ts (summaryModel, uno por dirección) y aggregate.ts.
 *
 * Selectores de |Vc| y de h: filtran las filas, la fila «Prom.» y las exportaciones (LaTeX y CSV).
 * Cada |Vc| se despliega en sus instancias (una fila por Id) con el Z y los segundos de cada método
 * en ambas direcciones y, bajo cada Z, el del paper para esa instancia.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Download } from 'lucide-react';
import type { MetaDirection, MetaFile, MetaMethod, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { Button, Disclosure, Segmented, SpotlightCard } from '../ui';
import { CardHead, CopyLatexButton, Pending, STICKY_CELL, STICKY_ROW_HOVER, downloadText } from '../benchmark/shared';
import { fmtNum, fmtPctValue, fmtSec } from '../benchmark/format';
import { META_METHODS, devPct, paperZOf, timeOf, zOf, type InstanceRow } from './aggregate';
import { META_INFO, methodColor, type MetaFamily } from './labels';
import { MethodSwatch, Sub, TD_NUM } from './shared';
import {
  hFor,
  hLabel,
  paperTimeMismatch,
  summaryModel,
  toCsvInstances,
  toCsvSummary,
  toLatexSummary,
  type SummaryCell,
  type SummaryModel,
  type SummaryRow,
} from './export';

/** Tinte del realce de la mejor celda y color del punto que la marca (familia del método). */
const FAMILY_TINT: Record<MetaFamily, string> = { twophase: 'bg-dp/[0.07]', ils: 'bg-ils/[0.08]', its: 'bg-its/[0.08]' };
const FAMILY_TEXT: Record<MetaFamily, string> = { twophase: 'text-dp', ils: 'text-ils', its: 'text-its' };

/** Las dos direcciones, en el orden de las columnas de las Tablas 3 y 8–9 del paper. */
const DIRS: readonly MetaDirection[] = ['1dir', '2dir'];
const DIR_HEAD: Record<MetaDirection, string> = { '1dir': '1 dir.', '2dir': '2 dir.' };
const DIR_TITLE: Record<MetaDirection, string> = {
  '1dir': '1 dir.: una corrida desde el tour TSP',
  '2dir': '2 dir.: la mejor de las corridas desde el tour TSP y desde el tour invertido (como en la Tabla 3 del paper)',
};

const TD_STRONG = 'num px-2.5 pt-3 pb-2 text-right align-top whitespace-nowrap';

/* ───────────────────────── Celdas de un método ───────────────────────── */

interface CellCtx {
  dir: MetaDirection;
  /** «|Vc| = 40» o «Prom. (k instancias comunes)». */
  where: string;
  prom: boolean;
  /** Solo Prom.: hay cifras del paper (para explicar por qué falta su tiempo). */
  hasPaper?: boolean;
  /** Solo Prom.: ITS exacto 1dir con Tabla 2 (Avg.) ≠ Tabla 9 (Time (s)); ver paperTimeMismatch. */
  itsGap?: { table2: number; table9: number } | null;
}

function zTitle(c: SummaryCell, ctx: CellCtx): string {
  const info = META_INFO[c.method];
  const head = `${info.label} · ${ctx.where} · ${ctx.dir}`;
  const paperDev = c.paperDev === null ? '' : ` (desviación ${fmtPctValue(c.paperDev, 2)})`;
  const paper =
    c.paperZ === null
      ? ''
      : c.paperDevAll
        ? ` Paper (mismo método y dirección, las ${c.instances} instancias): Z medio ${fmtNum(c.paperZ, 2)}${paperDev}.`
        : ` Paper (mismo método y dirección, mismas instancias): Z medio ${fmtNum(c.paperZ, 2)}${paperDev}.`;
  const errors = c.errors > 0 ? ` ${c.errors} ${c.errors === 1 ? 'ejecución' : 'ejecuciones'} con error, fuera del promedio.` : '';
  if (c.s.done === 0) return `${head}: aún sin instancias terminadas.${paper}${errors}`;
  const scope = ctx.prom ? `${c.s.done} instancias que todos los métodos terminaron` : `${c.s.done} de ${c.instances} instancias`;
  const dev = c.s.devPct === null ? '' : `; desviación media ${fmtPctValue(c.s.devPct, 2)} respecto del Best del paper`;
  const beats = `al paper en ${c.s.beatsPaper} y al Best en ${c.s.beatsBest}`;
  const counts =
    c.method === 'twophase' ? ` Supera ${beats}.` : ` Mejora su solución inicial en ${c.s.improved}; supera ${beats}.`;
  return (
    `${head}: valor objetivo medio Z = ${fmtNum(c.s.avgZ, 2)} sobre ${scope}${dev}.${paper}${counts}` +
    (c.best ? ` Menor Z medio de la fila en ${ctx.dir}.` : '') +
    errors
  );
}

function secTitle(c: SummaryCell, ctx: CellCtx): string {
  const info = META_INFO[c.method];
  const head = `${info.label} · ${ctx.where} · ${ctx.dir}`;
  const ours =
    c.s.done === 0
      ? `${head}: aún sin instancias terminadas.`
      : `${head}: ${fmtSec(c.s.timeSec)} s de pared por instancia, incluido el tour TSP${ctx.dir === '2dir' ? ' y las dos direcciones' : ''}.`;
  let paper: string;
  if (c.paperTime === null) {
    paper =
      c.method === 'twophase'
        ? ' El paper no publica el tiempo de la solución inicial.'
        : ctx.prom
          ? ctx.hasPaper
            ? ' El paper solo publica el promedio de sus 100 instancias (fila «Time (s)» de la Tabla 9): aparece cuando los cinco métodos las terminen, para no compararlo con un subconjunto.'
            : ' Sin las cifras del paper.'
          : ' El paper solo publica el tiempo por |Vc| de ILS e ITS exactos (Tabla 2).';
  } else if (ctx.prom) {
    paper = ` Paper: ${fmtSec(c.paperTime)} s, fila «Time (s)» de la Tabla 9 (promedio de las 100 instancias${ctx.dir === '2dir' ? ', suma de ambas direcciones' : ''}).`;
    if (c.method === 'its-exact' && ctx.itsGap)
      paper += ` Ojo: la fila «Avg.» de la Tabla 2 da ${fmtNum(ctx.itsGap.table2, 2)} s en 1dir para las mismas 100 instancias, frente a ${fmtNum(ctx.itsGap.table9, 2)} s en la Tabla 9; el paper no es consistente entre ambas tablas, por eso Prom. no es la media de las filas.`;
  } else {
    paper =
      ` Paper: ${c.paperTimeEstimated ? '≈ ' : ''}${fmtSec(c.paperTime)} s` +
      (c.paperTimeEstimated ? ' (Tabla 2 publica 1dir; 2dir estimado como el doble).' : ' (Tabla 2).');
  }
  return `${ours}${paper} Paper: Core 2 Quad 2,83 GHz, código C; no comparable 1:1 con nuestra máquina.`;
}

function MethodCells({ c, ctx }: { c: SummaryCell; ctx: CellCtx }) {
  const family = META_INFO[c.method].family;
  const partial = !ctx.prom && c.s.done > 0 && c.s.done < c.instances;
  const pending = c.s.done === 0;
  const td = ctx.prom ? TD_STRONG : TD_NUM;
  const tone = pending ? '' : c.best ? 'font-semibold text-zinc-50' : ctx.prom ? 'font-medium text-zinc-100' : 'text-zinc-200';

  const z: ReactNode = pending ? <Pending /> : fmtNum(c.s.avgZ, 2);

  return (
    <>
      <td
        title={zTitle(c, ctx)}
        className={cn(td, 'border-l', ctx.dir === '1dir' ? 'border-l-zinc-800' : 'border-l-zinc-800/50', c.best && FAMILY_TINT[family])}
      >
        <span className={cn('block', tone)}>
          {c.best && (
            <span aria-hidden className={cn('mr-1 align-[1px] text-[8px]', FAMILY_TEXT[family])}>
              ●
            </span>
          )}
          {z}
          {c.best && <span className="sr-only"> (menor Z medio de la fila en {ctx.dir})</span>}
          {partial && (
            <span className="ml-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 px-1 py-px font-mono text-[10px] font-normal text-zinc-400">
              {c.s.done}/{c.instances}
              <span className="sr-only"> instancias terminadas</span>
            </span>
          )}
        </span>
        {c.paperZ !== null && <Sub>paper {fmtNum(c.paperZ, 2)}</Sub>}
        {c.errors > 0 && (
          <Sub className="text-handling">
            {c.errors} {c.errors === 1 ? 'error' : 'errores'}
          </Sub>
        )}
      </td>
      <td title={secTitle(c, ctx)} className={cn(td, c.best && FAMILY_TINT[family])}>
        <span className={cn('block', pending ? '' : ctx.prom ? 'font-medium text-zinc-100' : 'text-zinc-300')}>
          {pending ? <Pending /> : fmtSec(c.s.timeSec)}
        </span>
        {c.paperTime !== null && (
          <Sub>
            paper{' '}
            {c.paperTimeEstimated && (
              <>
                <span aria-hidden>≈ </span>
                <span className="sr-only">aproximadamente </span>
              </>
            )}
            {fmtSec(c.paperTime)} s
          </Sub>
        )}
      </td>
    </>
  );
}

/* ───────────────────────── Filas ───────────────────────── */

/** Una fila por |Vc|: por método, las celdas de «1 dir.» y de «2 dir.» (las filas de ambos modelos son del mismo |Vc|). */
function NRow({ pair, open, onToggle }: { pair: Record<MetaDirection, SummaryRow>; open: boolean; onToggle: () => void }) {
  const r = pair['1dir'];
  const n = r.n as number;
  const complete = DIRS.every((d) => pair[d].complete);
  return (
    <tr className="group/row transition-colors hover:bg-zinc-800/25">
      <th
        scope="row"
        title={`${n} clientes · ${r.instances} instancias${complete ? '' : ' · aún incompleto'}`}
        className={cn(STICKY_CELL, STICKY_ROW_HOVER, 'border-b border-zinc-800/60 py-1.5 pr-4 text-left align-top font-normal')}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          title={open ? `Ocultar las ${r.instances} instancias de |Vc| = ${n}` : `Ver las ${r.instances} instancias (Id) de |Vc| = ${n}`}
          className="-ml-1 inline-flex items-center gap-1 rounded-md py-0.5 pr-1.5 pl-0.5 outline-none hover:bg-zinc-800/60 focus-visible:ring-2 focus-visible:ring-zinc-50/80"
        >
          <ChevronRight aria-hidden className={cn('h-3.5 w-3.5 text-zinc-500 transition-transform', open && 'rotate-90 text-zinc-300')} />
          <span className="sr-only">|Vc| = </span>
          <span className="num font-medium text-zinc-100">{n}</span>
          <span className="sr-only">{open ? ', ocultar instancias' : ', ver instancias'}</span>
        </button>
      </th>
      <td className="num border-b border-zinc-800/60 px-2.5 py-2 text-right align-top whitespace-nowrap text-zinc-400">
        {r.h === null ? '—' : hLabel(r.h)}
      </td>
      {META_METHODS.flatMap((m) =>
        DIRS.map((d) => <MethodCells key={`${m}-${d}`} c={pair[d].cells[m]} ctx={{ dir: d, where: `|Vc| = ${n}`, prom: false }} />),
      )}
    </tr>
  );
}

/** Celdas Z y Seg. de un método en una dirección para una sola instancia (fila de un Id). */
function IdCells({ row, m, dir, best }: { row: InstanceRow; m: MetaMethod; dir: MetaDirection; best: boolean }) {
  const c = row.cells[m];
  const family = META_INFO[m].family;
  const z = zOf(c, dir);
  const t = timeOf(c, dir);
  const pz = row.paper ? paperZOf(row.paper[m], dir) : null;
  const head = `${META_INFO[m].label} · |Vc| = ${row.n}, Id ${row.id} · ${dir}`;
  const dev = devPct(z, row.best);
  const pDev = devPct(pz, row.best);
  const zTip =
    z === null
      ? `${head}: ${c.errors > 0 ? `${c.errors} ${c.errors === 1 ? 'ejecución' : 'ejecuciones'} con error.` : 'aún sin resultado.'}`
      : `${head}: Z = ${fmtNum(z, 2)}${dev === null ? '' : ` (desviación ${fmtPctValue(dev, 2)} respecto del Best ${fmtNum(row.best, 2)})`}.` +
        (pz === null ? '' : ` Paper: ${fmtNum(pz, 2)}${pDev === null ? '' : ` (${fmtPctValue(pDev, 2)})`}.`) +
        (best ? ` Menor Z de la instancia en ${dir}.` : '');
  const tTip =
    t === null
      ? `${head}: aún sin resultado.`
      : `${head}: ${fmtSec(t)} s de pared, incluido el tour TSP${dir === '2dir' ? ' y las dos direcciones' : ''}.`;
  const td = 'num border-b border-zinc-800/40 px-2.5 py-1.5 text-right align-top whitespace-nowrap';
  return (
    <>
      <td
        title={zTip}
        className={cn(td, 'border-l', dir === '1dir' ? 'border-l-zinc-800' : 'border-l-zinc-800/50', best && FAMILY_TINT[family])}
      >
        <span className={cn('block', z === null ? '' : best ? 'font-semibold text-zinc-50' : 'text-zinc-300')}>
          {best && (
            <span aria-hidden className={cn('mr-1 align-[1px] text-[8px]', FAMILY_TEXT[family])}>
              ●
            </span>
          )}
          {z === null ? c.errors > 0 ? <span className="text-handling">error</span> : <Pending /> : fmtNum(z, 2)}
          {best && <span className="sr-only"> (menor Z de la instancia en {dir})</span>}
        </span>
        {pz !== null && <Sub>paper {fmtNum(pz, 2)}</Sub>}
      </td>
      <td title={tTip} className={cn(td, best && FAMILY_TINT[family])}>
        <span className={cn('block', t === null ? '' : 'text-zinc-400')}>{t === null ? <Pending /> : fmtSec(t)}</span>
      </td>
    </>
  );
}

/** Métodos con el menor Z de una instancia en una dirección (a 2 decimales), si los cinco terminaron. */
function bestOf(row: InstanceRow, dir: MetaDirection): Set<MetaMethod> {
  const zs = META_METHODS.map((m) => zOf(row.cells[m], dir));
  if (zs.some((z) => z === null)) return new Set();
  const key = (z: number) => Math.round(z * 100);
  const min = Math.min(...zs.map((z) => key(z as number)));
  return new Set(META_METHODS.filter((_, i) => key(zs[i] as number) === min));
}

/** Una instancia (Id) bajo su |Vc|, con el Best del paper bajo el Id. */
function IdRow({ row, h }: { row: InstanceRow; h: number | null }) {
  const best = { '1dir': bestOf(row, '1dir'), '2dir': bestOf(row, '2dir') } satisfies Record<MetaDirection, Set<MetaMethod>>;
  return (
    <tr className="group/row bg-zinc-900/30 text-[12px] transition-colors hover:bg-zinc-800/25">
      <th
        scope="row"
        title={`|Vc| = ${row.n}, Id ${row.id}${row.best !== null ? ` · Best del paper ${fmtNum(row.best, 2)}` : ''}`}
        className={cn(STICKY_CELL, STICKY_ROW_HOVER, 'border-b border-zinc-800/40 py-1.5 pr-4 pl-5 text-left align-top font-normal')}
      >
        <span className="text-zinc-500">Id </span>
        <span className="num text-zinc-200">{row.id}</span>
        {row.best !== null && <Sub>Best {fmtNum(row.best, 2)}</Sub>}
      </th>
      <td className="num border-b border-zinc-800/40 px-2.5 py-1.5 text-right align-top whitespace-nowrap text-zinc-600">
        {h === null ? '—' : hLabel(h)}
      </td>
      {META_METHODS.flatMap((m) => DIRS.map((d) => <IdCells key={`${m}-${d}`} row={row} m={m} dir={d} best={best[d].has(m)} />))}
    </tr>
  );
}

/* ───────────────────────── Tarjeta ───────────────────────── */

type Pick = number | 'all';
/** Clave estable de un h en los selectores (0,125 y 0,1 se repiten en dos tamaños). */
const hKey = (h: number) => Math.round(h * 1000);
const hKeyIn = (hByN: ReadonlyMap<number, number | null>, n: number) => {
  const h = hByN.get(n);
  return h === null || h === undefined ? null : hKey(h);
};

export function MetaSummaryTable({ rows: allRows, paper, file }: { rows: InstanceRow[]; paper: PaperFile | null; file: MetaFile | null }) {
  const meta = file?.meta ?? null;
  // h de cada |Vc| (registros, meta.h o Tablas 8–9) y opciones de los selectores.
  const hByN = useMemo(() => {
    const out = new Map<number, number | null>();
    for (const r of allRows) if (!out.has(r.n) || (out.get(r.n) === null && r.h !== null)) out.set(r.n, r.h);
    return new Map([...out].map(([n, h]) => [n, hFor(n, h, meta)]));
  }, [allRows, meta]);
  const sizes = useMemo(() => [...hByN.keys()].sort((a, b) => a - b), [hByN]);
  const hOptions = useMemo(() => {
    const byKey = new Map<number, { h: number; ns: number[] }>();
    for (const n of sizes) {
      const h = hByN.get(n);
      if (h === null || h === undefined) continue;
      const k = hKey(h);
      byKey.set(k, { h, ns: [...(byKey.get(k)?.ns ?? []), n] });
    }
    return [...byKey.entries()].sort((a, b) => b[1].h - a[1].h).map(([key, v]) => ({ key, ...v }));
  }, [sizes, hByN]);

  const [nPick, setNPick] = useState<Pick>('all');
  const [hPick, setHPick] = useState<Pick>('all');
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const nSel: Pick = nPick !== 'all' && sizes.includes(nPick) ? nPick : 'all';
  const hSel: Pick = hPick !== 'all' && hOptions.some((o) => o.key === hPick) ? hPick : 'all';
  const hKeyOf = (n: number) => hKeyIn(hByN, n);
  // Un |Vc| fuera del h elegido (o al revés) suelta el otro selector, para no dejar la tabla vacía.
  const pickN = (n: Pick) => {
    setNPick(n);
    if (n !== 'all') {
      if (hSel !== 'all' && hKeyOf(n) !== hSel) setHPick('all');
      setOpen((s) => new Set(s).add(n));
    }
  };
  const pickH = (k: Pick) => {
    setHPick(k);
    if (k !== 'all' && nSel !== 'all' && hKeyOf(nSel) !== k) setNPick('all');
  };
  const toggle = (n: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const rows = useMemo(
    () => allRows.filter((r) => (nSel === 'all' || r.n === nSel) && (hSel === 'all' || hKeyIn(hByN, r.n) === hSel)),
    [allRows, nSel, hSel, hByN],
  );
  const rowsByN = useMemo(() => {
    const out = new Map<number, InstanceRow[]>();
    for (const r of rows) out.set(r.n, [...(out.get(r.n) ?? []), r]);
    return out;
  }, [rows]);
  const filtered = nSel !== 'all' || hSel !== 'all';
  const visibleNs = [...rowsByN.keys()];
  const allOpen = visibleNs.length > 0 && visibleNs.every((n) => open.has(n));
  const fileSuffix = (nSel !== 'all' ? `_n${nSel}` : '') + (hSel !== 'all' ? `_h${String(hSel / 1000).replace('.', '_')}` : '');
  const selLabel = [nSel !== 'all' ? `|Vc| = ${nSel}` : null, hSel !== 'all' ? `h = ${hLabel(hSel / 1000)}` : null].filter(Boolean).join(', ');

  const models = useMemo(
    (): Record<MetaDirection, SummaryModel> => ({
      '1dir': summaryModel(rows, paper, '1dir', file),
      '2dir': summaryModel(rows, paper, '2dir', file),
    }),
    [rows, paper, file],
  );
  // summarizeByN agrupa las mismas filas en ambas direcciones: mismos |Vc| en el mismo orden.
  const pairs = useMemo(() => models['1dir'].byN.map((r, i) => ({ '1dir': r, '2dir': models['2dir'].byN[i] })), [models]);
  const total = models['1dir'].totalInstances;
  const common: Record<MetaDirection, number> = { '1dir': models['1dir'].commonInstances, '2dir': models['2dir'].commonInstances };
  const promPartial = DIRS.some((d) => common[d] < total);
  const nIter = meta?.params?.nIter ?? 200;
  const nIterIts = meta?.params?.nIterIts ?? Math.floor(Math.sqrt(nIter));
  const anyEstimated = DIRS.some((d) => models[d].byN.some((r) => META_METHODS.some((m) => r.cells[m].paperTimeEstimated)));
  // La fila «Time (s)» de la Tabla 9 solo entra en Prom. con las 100 instancias del paper terminadas.
  const promPaperTime = DIRS.some((d) => META_METHODS.some((m) => models[d].overall.cells[m].paperTime !== null));
  const itsGapOf = (d: MetaDirection) => (models[d].overall.cells['its-exact'].paperTime !== null ? paperTimeMismatch(paper, 'its-exact') : null);
  const itsGap = itsGapOf('1dir') ?? itsGapOf('2dir');
  // La columna «1 dir.» se compara con la «1 dir.» del paper: solo las filas «dir. 1 = paper» tienen la misma orientación.
  const orientation = useMemo(() => {
    const withResults = rows.filter((r) => META_METHODS.some((m) => r.cells[m].dir1 !== null || r.cells[m].dir2 !== null));
    return { aligned: withResults.filter((r) => r.orientation === 'paper').length, of: withResults.length };
  }, [rows]);
  const promCtx = (d: MetaDirection): CellCtx => ({
    dir: d,
    where: common[d] < total ? `Prom. (${common[d]} de ${total} instancias comunes)` : `Prom. (${total} instancias)`,
    prom: true,
    hasPaper: paper !== null,
    itsGap: itsGapOf(d),
  });
  const nCols = 2 + META_METHODS.length * DIRS.length * 2;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead
        eyebrow="Tablas 2–3 y 8–9 del paper"
        title={
          <>
            Resumen por |V<sub className="text-[0.7em]">c</sub>| <span className="font-normal text-zinc-500">·</span>{' '}
            <span className="font-medium text-zinc-300">1 dir. y 2 dir.</span>
          </>
        }
        note={
          <>
            Z y segundos medios por instancia; bajo cada cifra, la del paper. Despliega un |V<sub>c</sub>| para ver sus Id.
            {filtered && <span className="text-zinc-400"> Filtrado: {selLabel}.</span>}
          </>
        }
        actions={
          <>
            <CopyLatexButton what="Tabla resumen por |Vc|" getText={() => toLatexSummary(rows, paper, file)} />
            <Button
              variant="outline"
              size="xs"
              onClick={() => downloadText(`metaheuristicas_resumen${fileSuffix}.csv`, toCsvSummary(rows, paper, undefined, file))}
              title={`Descargar el resumen por |Vc| de ambas direcciones${filtered ? ` (${selLabel})` : ''} (metaheuristicas_resumen${fileSuffix}.csv)`}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV resumen
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => downloadText(`metaheuristicas_instancias${fileSuffix}.csv`, toCsvInstances(rows))}
              title={`Descargar una fila por instancia con Z, tiempos y cifras del paper de cada método, en ambas direcciones${filtered ? ` (${selLabel})` : ''} (metaheuristicas_instancias${fileSuffix}.csv)`}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV instancias
            </Button>
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[12px] text-zinc-500">
            Clientes |V<sub>c</sub>|
          </span>
          <Segmented<Pick>
            ariaLabel="Clientes |Vc| de la tabla resumen"
            size="xs"
            className="max-w-full flex-wrap gap-y-0.5"
            value={nSel}
            onChange={pickN}
            options={[
              { value: 'all', label: 'Todos', title: 'Todos los tamaños' },
              ...sizes.map((n) => {
                const h = hByN.get(n);
                return {
                  value: n,
                  label: <span className="num">{n}</span>,
                  ariaLabel: `|Vc| = ${n}`,
                  title: `|Vc| = ${n}${h === null || h === undefined ? '' : ` · h = ${hLabel(h)}`}`,
                };
              }),
            ]}
          />
        </div>
        {hOptions.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[12px] text-zinc-500">h</span>
            <Segmented<Pick>
              ariaLabel="Parámetro h de la tabla resumen"
              size="xs"
              className="max-w-full flex-wrap gap-y-0.5"
              value={hSel}
              onChange={pickH}
              options={[
                { value: 'all', label: 'Todos', title: 'Todos los h' },
                ...hOptions.map((o) => ({
                  value: o.key,
                  label: <span className="num">{hLabel(o.h)}</span>,
                  ariaLabel: `h = ${hLabel(o.h)}`,
                  title: `h_a = h_b = ${hLabel(o.h)} · |Vc| = ${o.ns.join(', ')}`,
                })),
              ]}
            />
          </div>
        )}
        {visibleNs.length > 0 && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setOpen(allOpen ? new Set() : new Set([...open, ...visibleNs]))}
            aria-pressed={allOpen}
            title={allOpen ? 'Ocultar las instancias de cada |Vc|' : 'Ver las instancias (Id) de cada |Vc| visible'}
          >
            <ChevronRight aria-hidden className={cn('h-3.5 w-3.5 transition-transform', allOpen && 'rotate-90')} />
            {allOpen ? 'Ocultar Id' : 'Ver todos los Id'}
          </Button>
        )}
      </div>

      <div className="scrollbar-thin -mx-1 mt-4 overflow-x-auto px-1">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">
            Valor objetivo medio Z y segundos medios de cinco métodos por número de clientes |Vc|, en una dirección (1 dir.)
            y en dos (2 dir.), con la cifra del paper bajo cada valor y una fila de promedio sobre las instancias que todos los métodos terminaron.
          </caption>
          <thead>
            <tr className="text-[12px]">
              <td className={STICKY_CELL} />
              <td />
              {META_METHODS.map((m) => {
                const info = META_INFO[m];
                return (
                  <th
                    key={m}
                    scope="colgroup"
                    colSpan={DIRS.length * 2}
                    title={info.title}
                    className="border-l border-l-zinc-800 px-2.5 pt-0 pb-1.5 text-left align-bottom font-medium"
                  >
                    <span aria-hidden className="mb-2 block h-0.5 rounded-full opacity-70" style={{ background: methodColor(m) }} />
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <MethodSwatch method={m} />
                      <span className="text-zinc-100">{info.label}</span>
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] font-normal tracking-tight whitespace-nowrap text-zinc-500">{info.reference}</span>
                  </th>
                );
              })}
            </tr>
            <tr className="text-[11px] text-zinc-400">
              <td className={STICKY_CELL} />
              <td />
              {META_METHODS.flatMap((m) =>
                DIRS.map((d) => (
                  <th
                    key={`${m}-${d}`}
                    scope="colgroup"
                    colSpan={2}
                    title={DIR_TITLE[d]}
                    className={cn(
                      'border-l px-2.5 pb-1 text-center font-medium whitespace-nowrap',
                      d === '1dir' ? 'border-l-zinc-800' : 'border-l-zinc-800/50',
                    )}
                  >
                    {DIR_HEAD[d]}
                  </th>
                )),
              )}
            </tr>
            <tr className="text-[11px] text-zinc-500">
              <th scope="col" className={cn(STICKY_CELL, 'border-b border-zinc-800 pr-4 pb-2 text-left font-medium whitespace-nowrap')}>
                |V<sub>c</sub>|
              </th>
              <th
                scope="col"
                title="h_a = h_b de ese tamaño (el que reproduce las Tablas 8–9 del paper)"
                className="border-b border-zinc-800 px-2.5 pb-2 text-right font-medium"
              >
                h
              </th>
              {META_METHODS.flatMap((m) =>
                DIRS.flatMap((d) => [
                  <th
                    key={`${m}-${d}-d`}
                    scope="col"
                    title={`${DIR_HEAD[d]} · valor objetivo medio Z (ruteo + manipulación) por instancia`}
                    className={cn(
                      'border-b border-l border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap',
                      d === '1dir' ? 'border-l-zinc-800' : 'border-l-zinc-800/50',
                    )}
                  >
                    Z
                  </th>,
                  <th
                    key={`${m}-${d}-s`}
                    scope="col"
                    title={`${DIR_HEAD[d]} · segundos medios por instancia, incluido el tour TSP${d === '2dir' ? ' (ambas direcciones)' : ''}`}
                    className="border-b border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap"
                  >
                    Seg.
                  </th>,
                ]),
              )}
            </tr>
          </thead>
          <tbody>
            {pairs.length === 0 ? (
              <tr>
                <td colSpan={nCols} className="border-b border-zinc-800/60 py-6 text-center text-[12.5px] text-zinc-500">
                  {filtered ? `No hay instancias con ${selLabel}.` : 'Aún no hay instancias en el benchmark.'}
                </td>
              </tr>
            ) : (
              pairs.flatMap((pair) => {
                const n = pair['1dir'].n as number;
                const isOpen = open.has(n);
                return [
                  <NRow key={n} pair={pair} open={isOpen} onToggle={() => toggle(n)} />,
                  ...(isOpen ? (rowsByN.get(n) ?? []).map((r) => <IdRow key={`${n}-${r.id}`} row={r} h={pair['1dir'].h} />) : []),
                ];
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                title={
                  promPartial
                    ? `Promedio de las instancias que los cinco métodos ya terminaron: ${common['1dir']} de ${total} en 1 dir. y ${common['2dir']} de ${total} en 2 dir.`
                    : `Promedio de las ${total} instancias`
                }
                className={cn(STICKY_CELL, 'pt-3 pr-4 pb-2 text-left align-top text-[12px] font-medium text-zinc-200')}
              >
                Prom.
                {promPartial && (
                  <span className="mt-0.5 block text-[10.5px] leading-4 font-normal whitespace-nowrap text-zinc-500">
                    {common['1dir'] === common['2dir'] ? (
                      <span className="num">{common['1dir']}</span>
                    ) : (
                      <>
                        <span className="num">{common['1dir']}</span> · <span className="num">{common['2dir']}</span>
                      </>
                    )}{' '}
                    de <span className="num">{total}</span> inst.
                  </span>
                )}
              </th>
              <td className="pt-3 pb-2" />
              {META_METHODS.flatMap((m) => DIRS.map((d) => <MethodCells key={`${m}-${d}`} c={models[d].overall.cells[m]} ctx={promCtx(d)} />))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-zinc-500">
        <span className="text-zinc-400">●</span> menor Z de la fila · <span className="text-zinc-400">k/10</span> promedio parcial ·{' '}
        <span className="text-zinc-400">«…»</span> pendiente · cursor sobre una celda: desviación vs Best.
      </p>
      <Disclosure summary="Notas de la tabla" className="mt-3">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <span className="text-zinc-400">Z</span>: valor objetivo medio (ruteo + manipulación); desviación = (Z − Best) / Best · 100, con Best la
            mejor solución conocida de las Tablas 8–9.
          </li>
          <li>
            <span className="text-zinc-400">1 dir.</span>: una corrida desde el tour TSP (ILS: N<sub>iter</sub> = {fmt(nIter, 0)}; ITS:{' '}
            {fmt(nIterIts, 0)} iteraciones externas). <span className="text-zinc-400">2 dir.</span>: la mejor de esa y otra desde el tour invertido
            (Tabla 3).
          </li>
          <li>
            <span className="text-zinc-400">Seg.</span>: segundos de pared por instancia, con el tour TSP y, en 2 dir., ambas direcciones
            {meta ? ` (${meta.runtime}, ${meta.workers} en paralelo)` : ''}.
          </li>
          <li>
            <span className="text-zinc-400">paper</span>: mismo método y dirección, mismas instancias. Su tiempo solo existe por |Vc| para ILS e ITS
            exactos en 1 dir. (Tabla 2{anyEstimated ? '; «≈» en 2 dir. = el doble' : ''}) y, en Prom., en la fila «Time (s)» de la Tabla 9
            {paper && !promPaperTime ? ' (aparece al completar las 100 instancias)' : ''}
            {itsGap && (
              <>
                {' '}
                (ITS exacto: Tabla 9 <span className="num">{fmtNum(itsGap.table9, 2)}</span> s vs Tabla 2{' '}
                <span className="num">{fmtNum(itsGap.table2, 2)}</span> s)
              </>
            )}
            .
          </li>
          <li>
            <span className="text-zinc-400">Prom.</span>:{' '}
            {promPartial
              ? `solo instancias que los cinco métodos terminaron (${common['1dir']} en 1 dir., ${common['2dir']} en 2 dir., de ${total}).`
              : `las ${total} instancias.`}
          </li>
          <li>
            Otra máquina (Core 2 Quad 2,83 GHz, C): compara razones entre métodos, no segundos.
            {orientation.of > orientation.aligned && (
              <>
                {' '}
                En 1 dir. la orientación coincide con el paper solo en <span className="num">{orientation.aligned}</span>/
                <span className="num">{orientation.of}</span> instancias.
              </>
            )}
          </li>
        </ul>
      </Disclosure>
    </SpotlightCard>
  );
}
