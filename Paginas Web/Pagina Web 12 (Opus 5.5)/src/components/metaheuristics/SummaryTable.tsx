/**
 * «Resumen por |Vc|» de la sección «Metaheurísticas», al estilo de las Tablas 2–3 de Erdoğan et al.
 * (2012) pero con los cinco métodos (dos fases, ILS e ITS heurísticos y exactos): una fila por |Vc|
 * con su h, y por método la desviación media respecto del Best del paper y los segundos medios por
 * instancia; bajo cada cifra nuestra, la del paper. Las filas por |Vc| promedian lo terminado de cada
 * método («k/10» mientras falten instancias) y la fila «Prom.» solo las instancias que los cinco
 * métodos ya terminaron. Todo el cálculo vive en export.ts (summaryModel) y aggregate.ts.
 */
import { useMemo, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import type { MetaDirection, MetaFile, PaperFile } from '../../types/metaheuristics';
import { cn } from '../../lib/cn';
import { fmt } from '../../lib/format';
import { Button, SpotlightCard } from '../ui';
import { CardHead, CopyLatexButton, Pending, STICKY_CELL, STICKY_ROW_HOVER, downloadText } from '../benchmark/shared';
import { fmtNum, fmtPctValue, fmtSec } from '../benchmark/format';
import { META_METHODS, type InstanceRow } from './aggregate';
import { META_INFO, methodColor, type MetaFamily } from './labels';
import { MethodSwatch, Sub, TD_NUM } from './shared';
import {
  hLabel,
  paperTimeMismatch,
  summaryModel,
  toCsvInstances,
  toCsvSummary,
  toLatexSummary,
  type SummaryCell,
  type SummaryRow,
} from './export';

/** Tinte del realce de la mejor celda y color del punto que la marca (familia del método). */
const FAMILY_TINT: Record<MetaFamily, string> = { twophase: 'bg-dp/[0.07]', ils: 'bg-ils/[0.08]', its: 'bg-its/[0.08]' };
const FAMILY_TEXT: Record<MetaFamily, string> = { twophase: 'text-dp', ils: 'text-ils', its: 'text-its' };

const DIR_NOTE: Record<MetaDirection, string> = {
  '1dir': '1dir: una corrida desde el tour TSP.',
  '2dir': '2dir: la mejor de las corridas desde el tour TSP y desde el tour invertido.',
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

function devTitle(c: SummaryCell, ctx: CellCtx): string {
  const info = META_INFO[c.method];
  const head = `${info.label} · ${ctx.where} · ${ctx.dir}`;
  const paper =
    c.paperDev === null
      ? ''
      : c.paperDevAll
        ? ` Paper (mismo método y dirección, las ${c.instances} instancias): ${fmtPctValue(c.paperDev, 2)}.`
        : ` Paper (mismo método y dirección, mismas instancias): ${fmtPctValue(c.paperDev, 2)}.`;
  const errors = c.errors > 0 ? ` ${c.errors} ${c.errors === 1 ? 'ejecución' : 'ejecuciones'} con error, fuera del promedio.` : '';
  if (c.s.done === 0) return `${head}: aún sin instancias terminadas.${paper}${errors}`;
  if (c.s.devPct === null) return `${head}: sin Best del paper con qué comparar.${errors}`;
  const scope = ctx.prom ? `${c.s.done} instancias que todos los métodos terminaron` : `${c.s.done} de ${c.instances} instancias`;
  const beats = `al paper en ${c.s.beatsPaper} y al Best en ${c.s.beatsBest}`;
  const counts =
    c.method === 'twophase' ? ` Supera ${beats}.` : ` Mejora su solución inicial en ${c.s.improved}; supera ${beats}.`;
  return (
    `${head}: desviación media ${fmtPctValue(c.s.devPct, 2)} respecto del Best del paper, sobre ${scope}.${paper}${counts}` +
    (c.best ? ' Menor desviación de la fila.' : '') +
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

  let dev: ReactNode;
  if (pending) dev = <Pending />;
  else if (c.s.devPct === null) dev = <span className="text-zinc-500">—</span>;
  else dev = fmtPctValue(c.s.devPct, 2);

  return (
    <>
      <td title={devTitle(c, ctx)} className={cn(td, 'border-l border-l-zinc-800', c.best && FAMILY_TINT[family])}>
        <span className={cn('block', tone)}>
          {c.best && (
            <span aria-hidden className={cn('mr-1 align-[1px] text-[8px]', FAMILY_TEXT[family])}>
              ●
            </span>
          )}
          {dev}
          {c.best && <span className="sr-only"> (menor desviación de la fila)</span>}
          {partial && (
            <span className="ml-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 px-1 py-px font-mono text-[10px] font-normal text-zinc-400">
              {c.s.done}/{c.instances}
              <span className="sr-only"> instancias terminadas</span>
            </span>
          )}
        </span>
        {c.paperDev !== null && <Sub>paper {fmtPctValue(c.paperDev, 2)}</Sub>}
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

function NRow({ r, dir }: { r: SummaryRow; dir: MetaDirection }) {
  const n = r.n as number;
  const ctx: CellCtx = { dir, where: `|Vc| = ${n}`, prom: false };
  return (
    <tr className="group/row transition-colors hover:bg-zinc-800/25">
      <th
        scope="row"
        title={`${n} clientes · ${r.instances} instancias${r.complete ? '' : ' · aún incompleto'}`}
        className={cn(STICKY_CELL, STICKY_ROW_HOVER, 'border-b border-zinc-800/60 py-2 pr-4 text-left align-top font-normal')}
      >
        <span className="sr-only">|Vc| = </span>
        <span className="num font-medium text-zinc-100">{n}</span>
      </th>
      <td className="num border-b border-zinc-800/60 px-2.5 py-2 text-right align-top whitespace-nowrap text-zinc-400">
        {r.h === null ? '—' : hLabel(r.h)}
      </td>
      {META_METHODS.map((m) => (
        <MethodCells key={m} c={r.cells[m]} ctx={ctx} />
      ))}
    </tr>
  );
}

/* ───────────────────────── Tarjeta ───────────────────────── */

export function MetaSummaryTable({
  rows,
  paper,
  dir,
  file,
}: {
  rows: InstanceRow[];
  paper: PaperFile | null;
  dir: MetaDirection;
  file: MetaFile | null;
}) {
  const model = useMemo(() => summaryModel(rows, paper, dir, file), [rows, paper, dir, file]);
  const { overall, commonInstances: common, totalInstances: total } = model;
  const promPartial = common < total;
  const meta = file?.meta ?? null;
  const nIter = meta?.params?.nIter ?? 200;
  const nIterIts = meta?.params?.nIterIts ?? Math.floor(Math.sqrt(nIter));
  const anyEstimated = model.byN.some((r) => META_METHODS.some((m) => r.cells[m].paperTimeEstimated));
  // La fila «Time (s)» de la Tabla 9 solo entra en Prom. con las 100 instancias del paper terminadas.
  const promPaperTime = META_METHODS.some((m) => overall.cells[m].paperTime !== null);
  const itsGap = overall.cells['its-exact'].paperTime !== null ? paperTimeMismatch(paper, 'its-exact') : null;
  // En 1dir la columna del paper es su «1 dir.»: solo las filas «dir. 1 = paper» tienen la misma orientación.
  const orientation = useMemo(() => {
    const withResults = rows.filter((r) => META_METHODS.some((m) => r.cells[m].dir1 !== null || r.cells[m].dir2 !== null));
    return { aligned: withResults.filter((r) => r.orientation === 'paper').length, of: withResults.length };
  }, [rows]);
  const promCtx: CellCtx = {
    dir,
    where: promPartial ? `Prom. (${common} de ${total} instancias comunes)` : `Prom. (${total} instancias)`,
    prom: true,
    hasPaper: paper !== null,
    itsGap,
  };
  const nCols = 2 + META_METHODS.length * 2;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead
        eyebrow="Estilo Erdoğan et al. (2012), Tablas 2–3 · cinco métodos"
        title={
          <>
            Resumen por |V<sub className="text-[0.7em]">c</sub>| <span className="font-normal text-zinc-500">·</span>{' '}
            <span className="num font-medium text-zinc-300">{dir}</span>
          </>
        }
        note={`Desviación media respecto del Best del paper y segundos medios por instancia de cada método, con la cifra del paper debajo. ${DIR_NOTE[dir]}`}
        actions={
          <>
            <CopyLatexButton what="Tabla resumen por |Vc|" getText={() => toLatexSummary(rows, paper, dir, file)} />
            <Button
              variant="outline"
              size="xs"
              onClick={() => downloadText('metaheuristicas_resumen.csv', toCsvSummary(rows, paper, undefined, file))}
              title="Descargar el resumen por |Vc| de ambas direcciones (metaheuristicas_resumen.csv)"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV resumen
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => downloadText('metaheuristicas_instancias.csv', toCsvInstances(rows))}
              title="Descargar una fila por instancia con Z, tiempos y cifras del paper de cada método, en ambas direcciones (metaheuristicas_instancias.csv)"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV instancias
            </Button>
          </>
        }
      />

      <div className="scrollbar-thin -mx-1 mt-5 overflow-x-auto px-1">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">
            Desviación media respecto del Best del paper y segundos medios de cinco métodos ({dir}) por número de clientes |Vc|, con la cifra
            del paper bajo cada valor y una fila de promedio sobre las instancias que todos los métodos terminaron.
          </caption>
          <thead>
            <tr className="text-[12px]">
              <td className={STICKY_CELL} />
              <td />
              {META_METHODS.map((m) => {
                const info = META_INFO[m];
                return (
                  <th key={m} scope="colgroup" colSpan={2} title={info.title} className="border-l border-l-zinc-800 px-2.5 pt-0 pb-1.5 text-left align-bottom font-medium">
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
              {META_METHODS.flatMap((m) => [
                <th
                  key={`${m}-d`}
                  scope="col"
                  title="Desviación media (Z − Best) / Best · 100 respecto de la mejor solución conocida del paper"
                  className="border-b border-l border-zinc-800 border-l-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap"
                >
                  Desv. %
                </th>,
                <th
                  key={`${m}-s`}
                  scope="col"
                  title={`Segundos medios por instancia, incluido el tour TSP${dir === '2dir' ? ' (ambas direcciones)' : ''}`}
                  className="border-b border-zinc-800 px-2.5 pb-2 text-right font-medium whitespace-nowrap"
                >
                  Seg.
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {model.byN.length === 0 ? (
              <tr>
                <td colSpan={nCols} className="border-b border-zinc-800/60 py-6 text-center text-[12.5px] text-zinc-500">
                  Aún no hay instancias en el benchmark.
                </td>
              </tr>
            ) : (
              model.byN.map((r) => <NRow key={r.n} r={r} dir={dir} />)
            )}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                title={
                  promPartial
                    ? `Promedio de las ${common} instancias (de ${total}) que los cinco métodos ya terminaron en ${dir}`
                    : `Promedio de las ${total} instancias`
                }
                className={cn(STICKY_CELL, 'pt-3 pr-4 pb-2 text-left align-top text-[12px] font-medium text-zinc-200')}
              >
                Prom.
                {promPartial && (
                  <span className="mt-0.5 block text-[10.5px] leading-4 font-normal whitespace-nowrap text-zinc-500">
                    <span className="num">{common}</span> de <span className="num">{total}</span> inst.
                  </span>
                )}
              </th>
              <td className="pt-3 pb-2" />
              {META_METHODS.map((m) => (
                <MethodCells key={m} c={overall.cells[m]} ctx={promCtx} />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 max-w-[110ch] text-[12px] leading-relaxed text-pretty text-zinc-500">
        <span className="text-zinc-400">Desv. %</span>: (Z − Best) / Best · 100, con <span className="text-zinc-400">Best</span> la mejor solución
        conocida que publica el paper en las Tablas 8–9 (el mínimo de todas sus corridas); negativa = mejor que el Best. El punto de color marca la
        menor desviación de la fila (solo cuando todos los métodos promedian las mismas instancias).{' '}
        <span className="text-zinc-400">1dir</span>: una corrida desde el tour TSP (ILS: N<sub>iter</sub> = {fmt(nIter, 0)}; ITS:{' '}
        {fmt(nIterIts, 0)} iteraciones externas); <span className="text-zinc-400">2dir</span>: la mejor de esa corrida y de otra igual desde el
        tour invertido, como en las Tablas 2–3 (la columna «2 dir.» de las Tablas 8–9 es solo la del tour invertido). <span className="text-zinc-400">Seg.</span>: segundos de
        pared por instancia, incluido el tour TSP{dir === '2dir' ? ' y ambas direcciones' : ''}
        {meta ? (
          <>
            {' '}
            ({meta.runtime}, {meta.workers} ejecuciones en paralelo en worker threads de Node.js, un hilo cada una)
          </>
        ) : null}
        . <span className="text-zinc-400">paper</span>: el mismo método y dirección en el paper, sobre las mismas instancias (mientras no haya
        resultados nuestros, sobre las 10 del tamaño)
        {dir === '1dir' && orientation.of > orientation.aligned && (
          <>
            ; en 1dir es su columna «1 dir.», y nuestra dirección 1 tiene su misma orientación solo en{' '}
            <span className="num">{orientation.aligned}</span> de <span className="num">{orientation.of}</span> instancias («dir. 1 = paper» en el
            detalle): en las demás puede ser la opuesta, así que esa comparación es aproximada (2dir no depende de la orientación)
          </>
        )}
        . Su tiempo solo se publica por |Vc| para ILS e ITS exactos en 1dir (Tabla 2
        {anyEstimated ? '; «≈»: en 2dir, estimado como el doble' : ''}) y, en Prom., para los cuatro ILS e ITS en la fila «Time (s)» de la Tabla 9,
        promedio de sus 100 instancias{dir === '2dir' ? ' (suma de sus dos columnas)' : ''}
        {paper && !promPaperTime ? ', que aparece cuando los cinco métodos las terminen' : ''}
        {itsGap && (
          <>
            {' '}
            (en ITS exacto el paper no es consistente: la Tabla 9 da <span className="num">{fmtNum(itsGap.table9, 2)}</span> s y la fila «Avg.» de
            la Tabla 2, <span className="num">{fmtNum(itsGap.table2, 2)}</span> s; Prom. usa la Tabla 9, así que no es la media de las filas)
          </>
        )}
        . El paper midió en un Core 2 Quad de 2,83 GHz con código C: compárense las razones entre métodos, no los segundos 1:1.{' '}
        <span className="text-zinc-400">k/10</span>: promedio parcial de las instancias ya terminadas.{' '}
        <span className="text-zinc-400">Prom.</span>:{' '}
        {promPartial
          ? `solo las ${common} de ${total} instancias que los cinco métodos ya terminaron, para comparar las columnas sobre el mismo conjunto.`
          : `las ${total} instancias.`}{' '}
        «…»: aún sin registrar.
      </p>
    </SpotlightCard>
  );
}
