/**
 * 04 · Heurísticas — Erdoğan, Battarra, Laporte y Vigo (2012).
 * Compara la manipulación de las soluciones exactas de Gurobi (General, P1, P2, P3) con
 * el Algoritmo 2.1 + DP (manipulación óptima de la Política 3 sobre una ruta fija) y con
 * el ILS del Algoritmo 4.2 (ruta + manipulación). Los datos vienen de Outputs/Erdogan2012/.
 *
 * Bento: veredicto (12) · esta instancia (7) + convergencia del ILS (5) · la DP parada a
 * parada (12) · panorama de instancias (12) · cómo se calculó (12); las dos últimas reparten
 * su contenido en dos columnas internas cuando la tarjeta es ancha.
 * Se carga de forma diferida (KaTeX solo se descarga al acercarse a la sección).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CircleCheck, FlaskConical, RotateCw, Scale, Terminal, Timer } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { useCatalog } from '../state/SimulationProvider';
import { fmt, fmtPct } from '../lib/format';
import { cn } from '../lib/cn';
import { springSoft, staggerChild, staggerParent } from '../lib/motion';
import { Button, Chip, Segmented, SectionHeader, SpotlightCard } from './ui';
import { customerCountsOf, findInstance, summarize, useHeuristics, type HeurInstance } from './heuristics/data';
import { HEUR_METHODS, MethodMark } from './heuristics/methods';
import { HandlingCompare } from './heuristics/HandlingCompare';
import { IlsConvergence } from './heuristics/IlsConvergence';
import { DpWalkthrough } from './heuristics/DpWalkthrough';
import { HeuristicsPanorama } from './heuristics/HeuristicsPanorama';
import { MethodNotes } from './heuristics/MethodNotes';

const RUN_DP = 'python notebooks/tsppd_h_alg21_dp.py --customers 5 10 --all-ids';
const RUN_ILS = 'python notebooks/tsppd_h_alg42_ils.py --customers 5 10 --all-ids';

export function Heuristics() {
  const { meta } = useCatalog();
  const { bundle, instances, loading, error } = useHeuristics();
  const current = useMemo(() => findInstance(instances, meta?.numCustomers, meta?.instanceId), [instances, meta]);
  const ready = bundle !== null && instances.length > 0;

  return (
    <div>
      <SectionHeader
        index="04"
        eyebrow="Heurísticas · Erdoğan et al. (2012)"
        title="Gurobi frente al Algoritmo 2.1 y el ILS"
        description={
          <>
            El <span className="text-zinc-200">Algoritmo 2.1</span> y su programación dinámica calculan, para una ruta fija, la manipulación
            óptima de la Política 3. El <span className="text-zinc-200">ILS</span> (Algoritmo 4.2) busca además la ruta, evaluando cada vecino
            con esa DP. Aquí se contrastan con las soluciones exactas de Gurobi en las mismas instancias.
          </>
        }
        aside={
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Chip tone="dp" size="sm">
              <MethodMark tone="dp" size={10} />
              {HEUR_METHODS.dp.short}
            </Chip>
            <Chip tone="ils" size="sm">
              <MethodMark tone="ils" size={10} />
              {HEUR_METHODS.ils.short}
            </Chip>
            {ready && (
              <span className="text-[13px] text-zinc-400">
                <span className="num text-zinc-200">{instances.length}</span> instancias ·{' '}
                {bundle.source === 'api' ? 'Outputs/Erdogan2012 en vivo' : 'paquete estático'}
              </span>
            )}
          </div>
        }
      />

      {!bundle && loading ? (
        <SectionSkeleton />
      ) : !ready ? (
        <EmptyState error={error} />
      ) : (
        <motion.div
          className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12"
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
            <VerdictStrip instances={instances} />
          </motion.div>
          {!current && meta && (
            <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
              <MissingInstance n={meta.numCustomers} id={meta.instanceId} />
            </motion.div>
          )}
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-7">
            <HandlingCompare inst={current} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-5">
            <IlsConvergence inst={current} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
            <DpWalkthrough inst={current} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
            <HeuristicsPanorama instances={instances} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
            <MethodNotes instances={instances} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/* ───────────────────────── Veredicto ───────────────────────── */

type Scope = 'all' | number;

/** Cuatro lecturas agregadas sobre todas las instancias (o las de un tamaño). */
function VerdictStrip({ instances }: { instances: HeurInstance[] }) {
  const counts = useMemo(() => customerCountsOf(instances), [instances]);
  const [picked, setScope] = useState<Scope>('all');
  // Si tras recargar ya no hay instancias de ese tamaño, se vuelve a "Todas".
  const scope: Scope = picked !== 'all' && !counts.includes(picked) ? 'all' : picked;
  const subset = useMemo(() => (scope === 'all' ? instances : instances.filter((x) => x.numCustomers === scope)), [instances, scope]);
  const s = useMemo(() => summarize(subset), [subset]);
  // Niter por dirección tal como lo exportó el script (no se asume un valor fijo).
  const nIters = useMemo(
    () => [...new Set(subset.flatMap((x) => (x.ils?.params?.nIter != null ? [x.ils.params.nIter] : [])))].sort((a, b) => a - b),
    [subset],
  );
  const howMany = s.instances === 1 ? 'la única instancia' : `las ${s.instances} instancias`;
  const scopeText = scope === 'all' ? howMany : `${howMany} de ${scope} clientes`;
  const dpMisses = s.dpChecks - s.dpMatches;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Veredicto</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">Qué dicen los datos en {scopeText}</h3>
        </div>
        {counts.length > 1 && (
          <Segmented<Scope>
            ariaLabel="Instancias consideradas"
            size="xs"
            value={scope}
            onChange={setScope}
            options={[{ value: 'all', label: 'Todas' }, ...counts.map((c) => ({ value: c, label: `${c} clientes` }))]}
          />
        )}
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-800/80 sm:grid-cols-2 xl:grid-cols-[1.15fr_1.15fr_1fr_0.85fr]">
        <Stat
          icon={<CircleCheck className="h-3.5 w-3.5 text-dp" aria-hidden />}
          term="Algoritmo 2.1 = Gurobi P3"
          value={
            <>
              {s.dpMatches}
              <span className="text-zinc-500">/{s.dpChecks}</span>
            </>
          }
          unit="rutas"
          note={
            s.dpChecks === 0
              ? 'Sin evaluaciones de la DP.'
              : s.dpMatches === s.dpChecks
                ? 'Sobre el tour de la Política 3, la DP reproduce exactamente la manipulación óptima de Gurobi.'
                : `En ${dpMisses} ${dpMisses === 1 ? 'ruta' : 'rutas'} la DP no coincide con la manipulación de Gurobi P3: revisa los archivos.`
          }
        />
        <Stat
          icon={<MethodMark tone="ils" size={12} />}
          term="ILS alcanza el óptimo P3"
          value={
            <>
              {s.ilsOptimal}
              <span className="text-zinc-500">/{s.ilsCount}</span>
            </>
          }
          unit="instancias"
          note={
            s.ilsCount === 0 ? (
              'Sin resultados del ILS.'
            ) : (
              <>
                {s.meanGapPct === null ? (
                  'Sin Z* de Gurobi P3 para medir la brecha'
                ) : (
                  <>
                    Brecha media <span className="num text-zinc-200">{fmt(s.meanGapPct, 2)} %</span> frente al Z* de Gurobi P3
                  </>
                )}
                {s.runsTotal > 0 && (
                  <>
                    {' '}
                    · <span className="num text-zinc-200">{s.runsHit}</span>/<span className="num">{s.runsTotal}</span> corridas repiten el mejor Z del
                    ILS en su instancia
                  </>
                )}
                .
              </>
            )
          }
        />
        <Stat
          icon={<Scale className="h-3.5 w-3.5 text-zinc-300" aria-hidden />}
          term="Misma ruta, mejor carga"
          value={
            <>
              {s.savingVsP1 === null ? '—' : `${s.savingVsP1 >= 0 ? '−' : '+'}${fmtPct(Math.abs(s.savingVsP1))}`}
              <span className="ml-1 text-[13px] font-normal text-zinc-500">vs P1</span>
            </>
          }
          unit=""
          note={
            <>
              Recorte medio al aplicar la DP sobre la ruta que Gurobi halló para P1; sobre la de P2 es de{' '}
              <span className="num text-zinc-200">{s.savingVsP2 === null ? '—' : fmtPct(s.savingVsP2)}</span>. El Modelo General (sin política)
              manipula menos que la DP en <span className="num text-zinc-200">{s.generalBelowDp}</span>/<span className="num">{s.generalChecks}</span>{' '}
              rutas.
            </>
          }
        />
        <Stat
          icon={<Timer className="h-3.5 w-3.5 text-zinc-300" aria-hidden />}
          term="Tiempo del ILS"
          value={s.meanRunSec === null ? '—' : fmt(s.meanRunSec, s.meanRunSec < 1 ? 2 : 1)}
          unit="s / corrida"
          note={
            nIters.length
              ? `ILS-2dir en Python: ${nIters.join(' / ')} iteraciones por dirección con evaluación exacta.`
              : 'ILS-2dir en Python con evaluación exacta.'
          }
        />
      </dl>
    </SpotlightCard>
  );
}

function Stat({ icon, term, value, unit, note }: { icon: ReactNode; term: string; value: ReactNode; unit: string; note: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col bg-zinc-950/70 px-4 py-4">
      <dt className="flex items-center gap-1.5 text-[12px] text-zinc-400">
        {icon}
        {term}
      </dt>
      <dd className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-[28px] leading-none font-semibold tracking-tight text-zinc-50">{value}</span>
        {unit && <span className="text-[12px] text-zinc-500">{unit}</span>}
      </dd>
      <dd className="mt-2.5 text-[12.5px] leading-relaxed text-pretty text-zinc-400">{note}</dd>
    </div>
  );
}

/* ───────────────────────── Estados ───────────────────────── */

function SectionSkeleton() {
  const block =
    'rounded-2xl border border-zinc-800/80 bg-[linear-gradient(90deg,rgb(24_24_27/0.6),rgb(39_39_42/0.6),rgb(24_24_27/0.6))] bg-[length:200%_100%] animate-shimmer';
  return (
    <div aria-busy="true" className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <span className="sr-only">Cargando resultados de las heurísticas…</span>
      <div className={cn(block, 'h-44 lg:col-span-12')} />
      <div className={cn(block, 'h-[460px] lg:col-span-7')} />
      <div className={cn(block, 'h-[460px] lg:col-span-5')} />
    </div>
  );
}

function CommandLine({ children }: { children: string }) {
  return (
    <code className="block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-[12px] whitespace-pre text-zinc-200">
      {children}
    </code>
  );
}

function EmptyState({ error }: { error: string | null }) {
  const { actions, loading } = useCatalog();
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={springSoft} className="mt-10">
      <SpotlightCard className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <FlaskConical className="h-5 w-5 text-dp" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Aún no hay resultados de las heurísticas</h3>
          <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-pretty text-zinc-400">
            {error
              ? `No se pudieron leer: ${error}.`
              : 'No se encontraron archivos en Outputs/Erdogan2012/ ni en el paquete estático.'}{' '}
            Genéralos desde la raíz del repositorio (necesitan las soluciones Gurobi de Outputs/ para comparar) y pulsa recargar:
          </p>
          <div className="mt-4 space-y-2">
            <CommandLine>{RUN_DP}</CommandLine>
            <CommandLine>{RUN_ILS}</CommandLine>
          </div>
          <Button variant="secondary" size="sm" className="mt-5" onClick={actions.refresh} aria-busy={loading}>
            <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Recargar
          </Button>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

function MissingInstance({ n, id }: { n: number; id: number }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-3.5">
      <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-zinc-400">
        <p>
          No hay resultados de las heurísticas para la instancia cargada (<span className="num text-zinc-200">{n}</span> clientes · ID{' '}
          <span className="num text-zinc-200">{id}</span>). El veredicto y el panorama siguen disponibles; para esta instancia ejecuta:
        </p>
        <div className="mt-2 space-y-1.5">
          <CommandLine>{`python notebooks/tsppd_h_alg21_dp.py --customers ${n} --id ${id}`}</CommandLine>
          <CommandLine>{`python notebooks/tsppd_h_alg42_ils.py --customers ${n} --id ${id}`}</CommandLine>
        </div>
      </div>
    </div>
  );
}
