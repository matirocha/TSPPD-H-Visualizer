/**
 * 05 · Tiempos de cómputo — Battarra et al. (2010) · Erdoğan et al. (2012).
 * Cuánto tardan los cuatro modelos exactos (Gurobi: General, P1, P2, P3) frente al Algoritmo
 * 2.1 + DP en dos fases (ruta TSP + manipulación) y al ILS-2dir, en las instancias de 5 a 25 clientes con h = 0,1 · 0,5 · 1.
 * Los datos vienen de Outputs/Benchmark/ (notebooks/tsppd_h_benchmark.py), que puede estar
 * corriendo: la sección se actualiza sola mientras falten registros.
 *
 * Barra de control (h compartido) · tabla comparativa N × Id con z y segundos (12) · gráfico (7)
 * + hallazgos (5) · detalle con z^H y desviación para un N (12) · cómo se midió (12).
 */
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { RotateCw, Timer } from 'lucide-react';
import type { BenchmarkFile } from '../types/benchmark';
import { fmt } from '../lib/format';
import { cn } from '../lib/cn';
import { springSoft, staggerChild, staggerParent } from '../lib/motion';
import { Button, Chip, SectionHeader, Segmented, SpotlightCard, Tooltip } from './ui';
import { useBenchmark } from './benchmark/useBenchmark';
import {
  buildInstances,
  gridOf,
  isGurobiMethod,
  progressOf,
  sameH,
  summarizeByN,
  summarizeOverall,
  timeLimitOf,
  timeLimitsOf,
  type Progress,
} from './benchmark/aggregate';
import { ComparisonTable } from './benchmark/ComparisonTable';
import { TimeChart } from './benchmark/TimeChart';
import { BenchFindings } from './benchmark/BenchFindings';
import { DetailTable } from './benchmark/DetailTable';
import { BenchMethodNote } from './benchmark/BenchMethodNote';
import { CommandLine, LiveDot, fmtClock, fmtDateTime, hText } from './benchmark/shared';
import { shortCpu } from './benchmark/format';

const RUN = 'python notebooks/tsppd_h_benchmark.py';

function threadsOf(file: BenchmarkFile | null): number | null {
  if (file?.meta?.threads) return file.meta.threads;
  for (const r of file?.records ?? []) {
    const t = r.config?.threads;
    if (isGurobiMethod(r.method) && typeof t === 'number') return t;
  }
  return null;
}

export function Benchmark() {
  const { file, loading, error, reload, live, lastLoadedAt } = useBenchmark();

  // Agregaciones memoizadas: ~900 registros, se recalculan solo cuando cambia el archivo o h.
  const instances = useMemo(() => buildInstances(file), [file]);
  const grid = useMemo(() => gridOf(file), [file]);
  const progress = useMemo(() => progressOf(file, instances), [file, instances]);
  const timeLimit = useMemo(() => timeLimitOf(file), [file]);
  const timeLimits = useMemo(() => timeLimitsOf(file), [file]);

  const [hPicked, setH] = useState<number>(0.1);
  const h = grid.h.find((x) => sameH(x, hPicked)) ?? grid.h[0] ?? 0.1;
  const groups = useMemo(() => summarizeByN(instances, h), [instances, h]);
  // Cifras por método (hallazgos): todo lo terminado. Fila «Prom.» de la tabla: solo las instancias
  // que todos los métodos ya terminaron, para que con datos parciales las columnas sean comparables.
  const overall = useMemo(() => summarizeOverall(instances, h), [instances, h]);
  const overallCommon = useMemo(() => summarizeOverall(instances, h, 'common'), [instances, h]);

  const hasData = file !== null && file.records.length > 0;

  return (
    <div>
      <SectionHeader
        index="05"
        eyebrow="Tiempos de cómputo · Battarra et al. (2010) · Erdoğan et al. (2012)"
        title="¿Cuánto tarda cada método?"
        description={
          <>
            Tiempo de los cuatro modelos exactos en <span className="text-zinc-200">Gurobi</span> frente a la heurística de{' '}
            <span className="text-zinc-200">dos fases</span> (ruta TSP + Algoritmo 2.1) y al <span className="text-zinc-200">ILS</span>, sobre las instancias de
            Battarra et al. con 5 a 25 clientes. Las tablas siguen el formato de los papers: instancias resueltas, segundos y desviación.
          </>
        }
        aside={hasData ? <ConfigAside file={file} progress={progress} live={live} timeLimit={timeLimit} timeLimits={timeLimits} /> : undefined}
      />

      {!file && loading ? (
        <SectionSkeleton />
      ) : !hasData ? (
        <EmptyState error={error} loading={loading} reload={reload} />
      ) : (
        <>
          <ControlBar
            hs={grid.h}
            h={h}
            onH={setH}
            progress={progress}
            loading={loading}
            reload={reload}
            live={live}
            lastLoadedAt={lastLoadedAt}
            error={error}
          />
          <motion.div
            className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12"
            variants={staggerParent}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <ComparisonTable instances={instances} groups={groups} overall={overallCommon} h={h} timeLimit={timeLimit} timeLimits={timeLimits} file={file} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-7">
              <TimeChart groups={groups} h={h} timeLimit={timeLimit} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-5">
              <BenchFindings instances={instances} groups={groups} overall={overall} h={h} progress={progress} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <DetailTable instances={instances} customers={grid.customers} h={h} timeLimit={timeLimit} timeLimits={timeLimits} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <BenchMethodNote file={file} timeLimit={timeLimit} timeLimits={timeLimits} />
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Encabezado y control ───────────────────────── */

function ConfigAside({
  file,
  progress,
  live,
  timeLimit,
  timeLimits,
}: {
  file: BenchmarkFile;
  progress: Progress;
  live: boolean;
  timeLimit: number | null;
  timeLimits: number[];
}) {
  const meta = file.meta;
  const threads = threadsOf(file);
  const mixed = timeLimits.length > 1;
  return (
    <div className="flex flex-col gap-2.5 md:items-end">
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {meta?.gurobi && (
          <Chip tone="muted" size="sm">
            Gurobi {meta.gurobi}
          </Chip>
        )}
        {threads !== null && (
          <Chip tone="muted" size="sm">
            {threads} {threads === 1 ? 'hilo' : 'hilos'}
          </Chip>
        )}
        {timeLimit !== null && (
          <Chip
            tone="muted"
            size="sm"
            title={mixed ? `Los registros mezclan límites de tiempo: ${timeLimits.map((t) => `${fmt(t, 0)} s`).join(' · ')}` : undefined}
          >
            {mixed ? `límites ${timeLimits.map((t) => fmt(t, 0)).join(' / ')} s` : `límite ${fmt(timeLimit, 0)} s`}
          </Chip>
        )}
        {meta?.cpu && (
          <Chip tone="muted" size="sm" title={meta.cpu}>
            {shortCpu(meta.cpu)}
          </Chip>
        )}
      </div>
      <p className="flex items-center gap-2 text-[13px] text-zinc-400">
        {live && <LiveDot />}
        <span>
          <span className="num text-zinc-200">{progress.done}</span>/<span className="num">{progress.expected}</span> ejecuciones
        </span>
        {live ? <span className="text-ok">en vivo</span> : progress.complete ? <span className="text-zinc-500">completo</span> : null}
      </p>
    </div>
  );
}

function ControlBar({
  hs,
  h,
  onH,
  progress,
  loading,
  reload,
  live,
  lastLoadedAt,
  error,
}: {
  hs: number[];
  h: number;
  onH: (h: number) => void;
  progress: Progress;
  loading: boolean;
  reload: () => void;
  live: boolean;
  lastLoadedAt: number | null;
  error: string | null;
}) {
  return (
    // Fija bajo la barra superior desde sm y con alto suficiente (index.css, [data-bench-bar]): h rige
    // todas las tablas de la sección. Allí mismo se reserva scroll-margin para que no tape el foco.
    <div data-bench-bar className="z-20 mt-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-3 py-2 shadow-lg shadow-black/30 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/70">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-zinc-500">Costo h</span>
          <Segmented<number>
            ariaLabel="Costo de manipulación h (h_a = h_b) de las tablas y el gráfico"
            size="sm"
            value={h}
            onChange={onH}
            options={hs.map((x) => ({ value: x, label: <span className="num">{hText(x)}</span>, ariaLabel: `h = ${hText(x)}` }))}
          />
        </div>

        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          {!progress.complete ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-zinc-400">
                  {live && <LiveDot />}
                  <span className="truncate">
                    <span className="num text-zinc-200">{progress.done}</span>/<span className="num">{progress.expected}</span> ejecuciones
                    <span className="hidden sm:inline"> · último registro {fmtClock(progress.lastFinishedAt)}</span>
                  </span>
                </span>
                <span className="num shrink-0 text-zinc-500">{fmt(progress.pct, 0)} %</span>
              </div>
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800"
                role="progressbar"
                aria-label="Avance del benchmark"
                aria-valuemin={0}
                aria-valuemax={progress.expected}
                aria-valuenow={progress.done}
                aria-valuetext={`${progress.done} de ${progress.expected} ejecuciones`}
              >
                <motion.div
                  className="h-full rounded-full bg-zinc-100"
                  initial={false}
                  animate={{ width: `${Math.min(100, progress.pct)}%` }}
                  transition={springSoft}
                />
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-zinc-500">
              Grilla completa: <span className="num text-zinc-300">{progress.expected}</span> ejecuciones
              {progress.errors > 0 && (
                <>
                  {' '}
                  · <span className="num text-handling">{progress.errors}</span> con error
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <Tooltip content={error} side="bottom" align="end">
              <span tabIndex={0} className="rounded-md text-[12px] text-handling underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-zinc-50/80">
                Falló la última lectura<span className="sr-only">: {error}</span>
              </span>
            </Tooltip>
          )}
          <Button
            variant="secondary"
            size="sm"
            flat
            onClick={reload}
            aria-busy={loading}
            title={lastLoadedAt ? `Última lectura: ${fmtDateTime(lastLoadedAt)}` : 'Leer de nuevo los resultados'}
          >
            <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Actualizar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Estados ───────────────────────── */

function SectionSkeleton() {
  const block =
    'rounded-2xl border border-zinc-800/80 bg-[linear-gradient(90deg,rgb(24_24_27/0.6),rgb(39_39_42/0.6),rgb(24_24_27/0.6))] bg-[length:200%_100%] animate-shimmer';
  return (
    <div aria-busy="true" className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <span className="sr-only">Cargando el benchmark de tiempos…</span>
      <div className={cn(block, 'h-14 lg:col-span-12')} />
      <div className={cn(block, 'h-[360px] lg:col-span-12')} />
      <div className={cn(block, 'h-[440px] lg:col-span-7')} />
      <div className={cn(block, 'h-[440px] lg:col-span-5')} />
    </div>
  );
}

function EmptyState({ error, loading, reload }: { error: string | null; loading: boolean; reload: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={springSoft} className="mt-10">
      <SpotlightCard className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <Timer className="h-5 w-5 text-zinc-300" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Aún no hay resultados del benchmark</h3>
          <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-pretty text-zinc-400">
            {error
              ? `No se pudieron leer: ${error}.`
              : 'No se encontró Outputs/Benchmark/benchmark_tiempos.json ni el paquete estático solutions/benchmark.json.'}{' '}
            Lánzalo desde la raíz del repositorio; tarda varias horas, pero la página muestra cada ejecución apenas termina (con la API local se
            actualiza sola cada minuto):
          </p>
          <div className="mt-4 max-w-xl">
            <CommandLine>{RUN}</CommandLine>
          </div>
          <Button variant="secondary" size="sm" className="mt-5" onClick={reload} aria-busy={loading}>
            <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Actualizar
          </Button>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
