/**
 * 06 · Metaheurísticas — Erdoğan, Battarra, Laporte y Vigo (2012), Tablas 8–9.
 * Réplica a gran escala (|Vc| = 20, 40, …, 200; Id 1–10) de la función objetivo y el tiempo de la
 * solución inicial de dos fases y, a partir de ella, del ILS (Algoritmo 4.2) y el ITS (Algoritmo 4.3),
 * estos dos con evaluación exacta (Alg. 2.1 + DP) o heurística lineal (§2.2) del vecindario: cinco
 * métodos, en una dirección (desde el tour TSP) o en dos (mejor del tour y del tour invertido). Los datos vienen de
 * Outputs/BenchmarkErdogan2012/ (notebooks/erdogan2012/benchmark.mjs), que puede estar corriendo:
 * la sección se actualiza sola mientras falten ejecuciones. Las cifras del paper llegan aparte
 * (paper_erdogan2012.json), así que con el paper y sin ejecuciones se muestra la estructura pendiente.
 *
 * Barra de control (avance y recarga) · resumen por |Vc| al estilo de las
 * Tablas 2–3, con 1 dir. y 2 dir. lado a lado como las Tablas 3 y 8–9 (12) · gráficos (7) +
 * hallazgos (5) · detalle por instancia como las Tablas 8–9 (12) · cómo se midió (12).
 */
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Route, RotateCw } from 'lucide-react';
import type { MetaDirection, MetaFile, PaperFile } from '../types/metaheuristics';
import { fmt } from '../lib/format';
import { cn } from '../lib/cn';
import { springSoft, staggerChild, staggerParent } from '../lib/motion';
import { Button, Chip, SectionHeader, SpotlightCard, Tooltip } from './ui';
import { useMetaheuristics } from './metaheuristics/useMetaheuristics';
import { buildInstances, gridOf, progressOf, type Progress } from './metaheuristics/aggregate';
import { MetaSummaryTable } from './metaheuristics/SummaryTable';
import { MetaCharts } from './metaheuristics/Charts';
import { MetaFindings } from './metaheuristics/Findings';
import { MetaDetailTable } from './metaheuristics/DetailTable';
import { META_RUN, MetaMethodNote } from './metaheuristics/MethodNote';
import { CommandLine, LiveDot, fmtClock, fmtDateTime } from './benchmark/shared';
import { shortCpu } from './benchmark/format';

/** «Node.js v24.20.0» → «Node.js 24.20.0». */
const shortRuntime = (runtime: string) => runtime.replace(/\bv(?=\d)/, '').trim();

/** Niter del consolidado o, si aún no existe, el de los parámetros del paper. */
function nIterOf(file: MetaFile | null, paper: PaperFile | null): number | null {
  const own = file?.meta?.params?.nIter;
  if (typeof own === 'number' && Number.isFinite(own)) return own;
  const fromPaper = paper?.params?.nIter;
  return typeof fromPaper === 'number' && Number.isFinite(fromPaper) ? fromPaper : null;
}

export function Metaheuristics() {
  const { file, paper, itsNrand, loading, error, reload, live, lastLoadedAt } = useMetaheuristics();

  // ~1.000 registros: las filas se recalculan solo cuando cambia el archivo o el paper.
  const rows = useMemo(() => buildInstances(file, paper), [file, paper]);
  const grid = useMemo(() => gridOf(file), [file]);
  const progress = useMemo(() => progressOf(file), [file]);

  // Dirección de los gráficos y los hallazgos (el selector vive en la tarjeta de gráficos; las tablas muestran ambas).
  const [dir, setDir] = useState<MetaDirection>('2dir');

  // Con el paper basta para dibujar la estructura (todo pendiente); sin nada, estado vacío.
  const hasAny = file !== null || paper !== null;
  const tspDone = useMemo(() => (file?.records ?? []).filter((r) => r.method === 'tsp' && r.status === 'ok').length, [file]);
  const hasResults = useMemo(() => (file?.records ?? []).some((r) => r.method !== 'tsp'), [file]);

  return (
    <div>
      <SectionHeader
        index="06"
        eyebrow="Metaheurísticas · Erdoğan et al. (2012) · Tablas 8–9"
        title="¿Exacto o heurístico? ILS e ITS con hasta 200 clientes"
        description={
          <>
            Réplica de las Tablas 8–9: <span className="text-zinc-200">dos fases</span>, <span className="text-zinc-200">ILS</span> e{' '}
            <span className="text-zinc-200">ITS</span> (exactos o heurísticos) con 20 a 200 clientes, en calidad y tiempo.
          </>
        }
        aside={hasAny ? <ConfigAside file={file} paper={paper} progress={progress} live={live} /> : undefined}
      />

      {!hasAny && loading ? (
        <SectionSkeleton />
      ) : !hasAny ? (
        <EmptyState error={error} loading={loading} reload={reload} />
      ) : (
        <>
          <ControlBar
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
            {!hasResults && (
              <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
                <PendingNotice hasFile={file !== null} tspDone={tspDone} instances={grid.sizes.length * grid.ids.length} />
              </motion.div>
            )}
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <MetaSummaryTable rows={rows} paper={paper} file={file} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-7">
              <MetaCharts rows={rows} paper={paper} dir={dir} onDir={setDir} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-5">
              <MetaFindings rows={rows} paper={paper} dir={dir} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <MetaDetailTable rows={rows} paper={paper} sizes={grid.sizes} />
            </motion.div>
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <MetaMethodNote file={file} paper={paper} itsNrand={itsNrand} />
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Encabezado y control ───────────────────────── */

function ConfigAside({ file, paper, progress, live }: { file: MetaFile | null; paper: PaperFile | null; progress: Progress; live: boolean }) {
  const meta = file?.meta ?? null;
  const nIter = nIterOf(file, paper);
  const workers = meta?.workers ?? null;
  return (
    <div className="flex flex-col gap-2.5 md:items-end">
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {meta?.runtime && (
          <Chip tone="muted" size="sm" title={meta.os ? `${meta.runtime} · ${meta.os}` : meta.runtime}>
            {shortRuntime(meta.runtime)}
          </Chip>
        )}
        {workers !== null && (
          <Chip tone="muted" size="sm" title="Ejecuciones en paralelo en worker threads de Node.js, un hilo cada una (no comparten trabajo)">
            {workers} en paralelo
          </Chip>
        )}
        {nIter !== null && (
          <Chip tone="muted" size="sm" title={`${nIter} iteraciones por dirección (ITS: ⌊√${nIter}⌋ externas × ⌊√${nIter}⌋ del Tabu Search)`}>
            Niter = {nIter}
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
          <span className="num text-zinc-200">{fmt(progress.done, 0)}</span>/<span className="num">{fmt(progress.expected, 0)}</span> ejecuciones
        </span>
        {live ? <span className="text-ok">en vivo</span> : progress.complete ? <span className="text-zinc-500">completo</span> : null}
      </p>
    </div>
  );
}

function ControlBar({
  progress,
  loading,
  reload,
  live,
  lastLoadedAt,
  error,
}: {
  progress: Progress;
  loading: boolean;
  reload: () => void;
  live: boolean;
  lastLoadedAt: number | null;
  error: string | null;
}) {
  return (
    // Fija bajo la barra superior desde sm y con alto suficiente (index.css, [data-bench-bar]), con el
    // avance del benchmark. Allí se reserva también el scroll-margin.
    <div data-bench-bar className="z-20 mt-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-3 py-2 shadow-lg shadow-black/30 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/70">
        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          {!progress.complete ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-zinc-400">
                  {live && <LiveDot />}
                  <span className="truncate">
                    <span className="num text-zinc-200">{fmt(progress.done, 0)}</span>/<span className="num">{fmt(progress.expected, 0)}</span> ejecuciones
                    {progress.lastFinishedAt && <span className="hidden sm:inline"> · último registro {fmtClock(progress.lastFinishedAt)}</span>}
                  </span>
                </span>
                <span className="num shrink-0 text-zinc-500">{fmt(progress.pct, 0)} %</span>
              </div>
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800"
                role="progressbar"
                aria-label="Avance del benchmark de metaheurísticas"
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
              Grilla completa: <span className="num text-zinc-300">{fmt(progress.expected, 0)}</span> ejecuciones
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

/** Aviso mientras solo están las cifras del paper (o solo los tours TSP): todo lo nuestro sale «…». */
function PendingNotice({ hasFile, tspDone, instances }: { hasFile: boolean; tspDone: number; instances: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <p className="max-w-[72ch] text-[13px] leading-relaxed text-pretty text-zinc-400">
        {hasFile ? (
          <>
            Tours TSP listos en <span className="num text-zinc-200">{tspDone}</span> de <span className="num">{instances}</span> instancias; las
            metaheurísticas aún no tienen resultados («…»).
          </>
        ) : (
          <>
            Aún sin ejecuciones propias: solo se ven las cifras del paper. Lanza el benchmark desde la raíz del repositorio.
          </>
        )}
      </p>
      {!hasFile && (
        <div className="min-w-0 sm:max-w-[26rem] sm:shrink-0">
          <CommandLine>{META_RUN}</CommandLine>
        </div>
      )}
    </div>
  );
}

function SectionSkeleton() {
  const block =
    'rounded-2xl border border-zinc-800/80 bg-[linear-gradient(90deg,rgb(24_24_27/0.6),rgb(39_39_42/0.6),rgb(24_24_27/0.6))] bg-[length:200%_100%] animate-shimmer';
  return (
    <div aria-busy="true" className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <span className="sr-only">Cargando el benchmark de metaheurísticas…</span>
      <div className={cn(block, 'h-14 lg:col-span-12')} />
      <div className={cn(block, 'h-[420px] lg:col-span-12')} />
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
          <Route className="h-5 w-5 text-zinc-300" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Aún no hay resultados de las metaheurísticas</h3>
          <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-pretty text-zinc-400">
            {error
              ? `No se pudieron leer: ${error}.`
              : 'No se encontró Outputs/BenchmarkErdogan2012/ ni solutions/metaheuristics.json.'}{' '}
            Lánzalo desde la raíz del repositorio (tarda horas; la página se actualiza mientras corre):
          </p>
          <div className="mt-4 max-w-xl">
            <CommandLine>{META_RUN}</CommandLine>
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
