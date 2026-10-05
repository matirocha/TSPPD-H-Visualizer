/**
 * Cómo se midió: equipo, solver, hilos y procesos simultáneos, límite de tiempo y parámetros de
 * las heurísticas (leídos del consolidado o, si falta meta, de los propios registros), las
 * definiciones de gap, desviación y tiempos, el comando para regenerar y las referencias.
 */
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { BenchmarkFile, DPRecord, ILSRecord } from '../../types/benchmark';
import { fmt, fmtAuto } from '../../lib/format';
import { SpotlightCard } from '../ui';
import { ERDOGAN_REF, MethodMark } from '../heuristics/methods';
import { isGurobiMethod } from './aggregate';
import { CardHead, CommandLine, fmtDateTime } from './shared';

const BATTARRA_DOI = '10.1287/trsc.1100.0316';
const RUN = 'python notebooks/tsppd_h_benchmark.py';
const CONSOLIDATE = 'python notebooks/tsppd_h_benchmark.py --consolidate';

const distinct = <T,>(xs: (T | null | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== null && x !== undefined))];
const numOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-zinc-800/80 py-1.5 last:border-0">
      <dt className="shrink-0 text-zinc-500">{term}</dt>
      <dd className="min-w-0 text-right text-zinc-200">{children}</dd>
    </div>
  );
}

function Block({ title, mark, children }: { title: string; mark?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-4">
      <p className="flex items-center gap-2 text-[13.5px] font-medium text-zinc-100">
        {mark}
        {title}
      </p>
      <div className="mt-2.5 text-[13px] leading-relaxed text-pretty text-zinc-400">{children}</div>
    </div>
  );
}

function RefLink({ doi, children }: { doi: string; children: ReactNode }) {
  return (
    <a
      href={`https://doi.org/${doi}`}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-1 rounded-md font-mono text-[11.5px] text-zinc-400 transition-colors hover:text-zinc-50"
    >
      {children}
      <ArrowUpRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </a>
  );
}

export function BenchMethodNote({ file, timeLimit, timeLimits = [] }: { file: BenchmarkFile; timeLimit: number | null; timeLimits?: number[] }) {
  const meta = file.meta;
  const gurobiRecs = file.records.filter((r) => isGurobiMethod(r.method));
  const heurRecs = file.records.filter((r) => !isGurobiMethod(r.method));
  const threads = meta?.threads ?? distinct(gurobiRecs.map((r) => numOf(r.config?.threads)))[0] ?? null;
  const gurobiWorkers = distinct(gurobiRecs.map((r) => r.parallel?.workers)).sort((a, b) => a - b);
  const heurWorkers = distinct(heurRecs.map((r) => r.parallel?.workers)).sort((a, b) => a - b);
  const ilsRec = file.records.find((r): r is ILSRecord => r.method === 'ils' && r.status !== 'error');
  const ils = meta?.ils ?? (ilsRec ? { nIter: numOf(ilsRec.config.nIter), d: numOf(ilsRec.config.d), seed: numOf(ilsRec.config.seed), runs: numOf(ilsRec.config.runs) } : null);
  const tspMethods = distinct(file.records.map((r) => (r.method === 'dp' ? (r as DPRecord).tspMethod : null)));
  const workersText = (ws: number[]) => (ws.length ? ws.join(' / ') : '—');
  // Modelo General sin ejecutar sobre cierto N (registros 'skipped' por su alto costo computacional).
  const skippedGeneral = gurobiRecs.filter((r) => r.method === 'general' && r.status === 'skipped');
  const notRunFrom = skippedGeneral.length ? Math.min(...skippedGeneral.map((r) => r.numCustomers)) : null;
  const generalMaxN =
    meta?.generalMaxN ??
    (notRunFrom !== null ? Math.max(0, ...gurobiRecs.filter((r) => r.method === 'general' && r.status !== 'skipped' && r.numCustomers < notRunFrom).map((r) => r.numCustomers)) || null : null);

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <CardHead
        eyebrow="Cómo se midió"
        title="Condiciones del experimento y definiciones"
        note={`Consolidado generado el ${fmtDateTime(file.generatedAt)}${meta ? '' : ' (reconstruido desde registros.jsonl: sin datos del equipo)'}.`}
      />

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Block title="Equipo y solver">
          <dl className="text-[12.5px]">
            {meta?.cpu && (
              <Row term="Procesador">
                <span className="break-words">{meta.cpu}</span>
                {meta.logicalCpus ? <span className="text-zinc-500"> · {meta.logicalCpus} hilos lógicos</span> : null}
              </Row>
            )}
            {meta?.os && <Row term="Sistema">{meta.os}</Row>}
            {meta?.python && <Row term="Python">{meta.python}</Row>}
            {meta?.gurobi && <Row term="Gurobi">{meta.gurobi}</Row>}
            <Row term="Hilos por modelo">{threads ?? '—'}</Row>
            <Row term="Procesos simultáneos">
              <span className="num">{workersText(gurobiWorkers)}</span> Gurobi · <span className="num">{workersText(heurWorkers)}</span> heurísticas
            </Row>
            <Row term="Límite por modelo">
              {timeLimits.length > 1 ? (
                <span title="Los registros se midieron con límites distintos (config.timeLimitSec de cada ejecución)">
                  <span className="num">{timeLimits.map((t) => fmt(t, 0)).join(' / ')} s</span>
                  <span className="text-zinc-500"> según la ejecución</span>
                </span>
              ) : timeLimit !== null ? (
                <span className="num">{fmt(timeLimit, 0)} s</span>
              ) : (
                '—'
              )}
              <span className="text-zinc-500"> (Battarra: 7.200 s)</span>
            </Row>
            {notRunFrom !== null && (
              <Row term="Modelo General">
                solo hasta N = <span className="num">{generalMaxN ?? '—'}</span>
                <span className="text-zinc-500"> (§ alto costo computacional)</span>
              </Row>
            )}
          </dl>
          <p className="mt-3 text-[12.5px]">
            Cada ejecución corre en su propio proceso; con varios procesos a la vez, los tiempos son comparables entre sí pero algo mayores que en
            una máquina dedicada.
          </p>
          {notRunFrom !== null && (
            <p className="mt-2.5 text-[12.5px]">
              <span className="text-zinc-200">§ Modelo General con N ≥ {notRunFrom}: no se ejecuta por su alto costo computacional.</span> Su
              formulación ubica cada unidad en una posición del camión, con unas 2·(N + 1)²·Q variables binarias: entre 46.000 y 62.000 con N = 15
              y entre 100.000 y 118.000 con N = 20. En la primera corrida del benchmark, con N = 15 las 30 ejecuciones llegaron al límite de 1.800 s
              con gaps de 4,5 % a 68,5 %, y con N = 20 dos de cuatro no encontraron ninguna solución entera. Las Políticas 1–3 y las heurísticas sí
              se ejecutan en todos los tamaños.
            </p>
          )}
        </Block>

        <Block
          title="Heurísticas"
          mark={
            <span className="flex gap-1">
              <MethodMark tone="dp" size={11} />
              <MethodMark tone="ils" size={11} />
            </span>
          }
        >
          <p>
            <span className="text-zinc-200">Dos fases (TSP + Alg. 2.1).</span> El Algoritmo 2.1 + DP no resuelve el TSPPD-H por sí solo: dada una
            ruta fija, calcula su manipulación óptima en la Política 3. Para compararlo como método completo se le entrega una ruta, como la
            columna «Two-phase» de Battarra et al. (2010): primero un tour TSP (
            {tspMethods.length ? tspMethods.join('; ') : 'Held-Karp exacto hasta 12 clientes; si no, vecino más cercano + 2-opt'}); luego se
            reubica el depósito a lo largo del ciclo, en ambos sentidos, y la DP calcula la manipulación óptima de la Política 3. Seg. incluye todo
            eso; una sola evaluación de la DP se cronometra repitiéndola{' '}
            {meta?.dpRepeats ? <span className="num text-zinc-200">{fmt(meta.dpRepeats, 0)}</span> : 'varias'} veces.
          </p>
          <p className="mt-2.5">
            <span className="text-zinc-200">ILS-2dir (Algoritmo 4.2).</span>{' '}
            {ils?.nIter ? (
              <>
                <span className="num text-zinc-200">{fmt(ils.nIter, 0)}</span> iteraciones por dirección
              </>
            ) : (
              'Iteraciones por dirección'
            )}
            {ils?.d ? (
              <>
                , N<sub>rand</sub> = d·N con d = <span className="num text-zinc-200">{fmtAuto(ils.d, 2)}</span>
              </>
            ) : null}
            {ils?.runs ? (
              <>
                , <span className="num text-zinc-200">{fmt(ils.runs, 0)}</span> corridas
                {ils.seed !== null && ils.seed !== undefined ? <> (semillas {ils.seed} a {ils.seed + ils.runs - 1})</> : null}
              </>
            ) : null}
            . Cada vecino se evalúa de forma exacta con el Algoritmo 2.1 + DP. Seg. es el promedio por corrida y z el mejor de las corridas.
          </p>
        </Block>

        <Block title="Definiciones">
          <dl className="space-y-2 text-[12.5px]">
            <div>
              <dt className="inline text-zinc-200">Seg. de Gurobi:</dt>{' '}
              <dd className="inline">Runtime del solver, sin contar la construcción del modelo en Python.</dd>
            </div>
            <div>
              <dt className="inline text-zinc-200">Gap:</dt>{' '}
              <dd className="inline">|cota − z| / |z| · 100 de una ejecución que llegó al límite con solución entera (MIPGap de Gurobi).</dd>
            </div>
            <div>
              <dt className="inline text-zinc-200">Desviación:</dt>{' '}
              <dd className="inline">
                (Z − ref) / ref · 100, con ref = z*<sub>P3</sub> cuando Gurobi probó el óptimo de la Política 3; si no, el menor Z conocido entre P3,
                dos fases e ILS. Ambas heurísticas buscan dentro de la Política 3; el Modelo General la relaja, así que z*<sub>General</sub> ≤
                z*<sub>P3</sub>.
              </dd>
            </div>
            <div>
              <dt className="inline text-zinc-200">Tiempo medio:</dt>{' '}
              <dd className="inline">
                «Todas» promedia cada ejecución terminada (las cortadas por el límite cuentan con su tiempo, como en Erdoğan et al.); «Solo óptimas»
                promedia las resueltas, como «Avg. seconds» en Battarra et al.
              </dd>
            </div>
          </dl>
        </Block>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-zinc-800/70 pt-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[12px] text-zinc-500">Para continuar o repetir el benchmark (se reanuda desde Outputs/Benchmark/registros.jsonl):</p>
          <div className="mt-2 space-y-1.5">
            <CommandLine>{RUN}</CommandLine>
            <CommandLine>{CONSOLIDATE}</CommandLine>
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            La segunda línea solo regenera benchmark_tiempos.json; <span className="font-mono text-zinc-400">npm run bundle</span> lo copia al paquete
            estático de la página.
          </p>
        </div>
        <div className="min-w-0 space-y-3 text-[13px] leading-relaxed text-pretty text-zinc-300">
          <div>
            <p>
              Battarra, M., Erdoğan, G., Laporte, G. y Vigo, D. (2010).{' '}
              <cite className="text-zinc-100 italic">The Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs</cite>.{' '}
              <span className="text-zinc-400">
                Transportation Science, <span className="italic">44</span>(3), 383–399.
              </span>
            </p>
            <RefLink doi={BATTARRA_DOI}>doi:{BATTARRA_DOI}</RefLink>
          </div>
          <div>
            <p>
              {ERDOGAN_REF.authors}. <cite className="text-zinc-100 italic">{ERDOGAN_REF.title}</cite>.{' '}
              <span className="text-zinc-400">
                {ERDOGAN_REF.journal}, <span className="italic">{ERDOGAN_REF.volume}</span>, {ERDOGAN_REF.pages}.
              </span>
            </p>
            <RefLink doi={ERDOGAN_REF.doi}>doi:{ERDOGAN_REF.doi}</RefLink>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}
