/**
 * Cómo se midió: equipo, solver, hilos y procesos simultáneos, límite de tiempo y parámetros de
 * las heurísticas (leídos del consolidado o, si falta meta, de los propios registros), las
 * definiciones de gap, desviación y tiempos, el comando para regenerar y las referencias. Todo
 * plegado bajo la cabecera de la tarjeta.
 */
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { BenchmarkFile, DPRecord, ILSRecord } from '../../types/benchmark';
import { fmt, fmtAuto } from '../../lib/format';
import { Disclosure, SpotlightCard } from '../ui';
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
        title="Condiciones y definiciones"
        note={`Consolidado del ${fmtDateTime(file.generatedAt)}${meta ? '' : ' (sin datos del equipo)'}.`}
      />

      <Disclosure summary="Equipo, heurísticas, definiciones y comandos" className="mt-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
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
            <p className="mt-3 text-[12.5px]">Un proceso por ejecución: con varios a la vez, los tiempos son algo mayores que en una máquina dedicada.</p>
            {notRunFrom !== null && (
              <p className="mt-2 text-[12.5px]">
                <span className="text-zinc-200">§</span> ~2·(N + 1)²·Q variables binarias (46–62 mil con N = 15); en la primera corrida, con N = 15
                todas llegaron al límite con gaps de 4,5–68,5 %.
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
              <span className="text-zinc-200">Dos fases</span> («Two-phase» de Battarra): tour TSP (
              {tspMethods.length ? tspMethods.join('; ') : 'Held-Karp hasta 12 clientes; si no, vecino más cercano + 2-opt'}), reubicación del
              depósito y DP de la Política 3. Una evaluación de la DP se cronometra{' '}
              {meta?.dpRepeats ? (
                <>
                  <span className="num text-zinc-200">{fmt(meta.dpRepeats, 0)}</span> veces
                </>
              ) : (
                'repetida'
              )}
              .
            </p>
            <p className="mt-2.5">
              <span className="text-zinc-200">ILS-2dir</span> (Alg. 4.2):{' '}
              {ils?.nIter ? (
                <>
                  <span className="num text-zinc-200">{fmt(ils.nIter, 0)}</span> iter. por dirección
                </>
              ) : (
                'iteraciones por dirección'
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
              ; cada vecino se evalúa con el Alg. 2.1 + DP.
            </p>
          </Block>

          <Block title="Definiciones">
            <dl className="space-y-2 text-[12.5px]">
              <div>
                <dt className="inline text-zinc-200">Seg. de Gurobi:</dt>{' '}
                <dd className="inline">Runtime del solver, sin construir el modelo.</dd>
              </div>
              <div>
                <dt className="inline text-zinc-200">Gap:</dt>{' '}
                <dd className="inline">|cota − z| / |z| · 100 (MIPGap) al llegar al límite.</dd>
              </div>
              <div>
                <dt className="inline text-zinc-200">Desviación:</dt>{' '}
                <dd className="inline">
                  (Z − ref) / ref · 100; ref = z*<sub>P3</sub> probado o, si falta, el menor Z conocido.
                </dd>
              </div>
              <div>
                <dt className="inline text-zinc-200">Tiempo medio:</dt>{' '}
                <dd className="inline">«Todas» incluye las cortadas por el límite (Erdoğan); «Solo óptimas», como «Avg. seconds» de Battarra.</dd>
              </div>
            </dl>
          </Block>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-zinc-800/70 pt-4 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[12px] text-zinc-500">Reanudar o repetir (desde Outputs/Benchmark/registros.jsonl):</p>
            <div className="mt-2 space-y-1.5">
              <CommandLine>{RUN}</CommandLine>
              <CommandLine>{CONSOLIDATE}</CommandLine>
            </div>
            <p className="mt-2 text-[12px] text-zinc-500">
              La segunda solo regenera el JSON; <span className="font-mono text-zinc-400">npm run bundle</span> lo copia a la página.
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
      </Disclosure>
    </SpotlightCard>
  );
}
