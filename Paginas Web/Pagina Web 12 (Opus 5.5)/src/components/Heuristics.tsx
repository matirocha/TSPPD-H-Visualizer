/**
 * 04 · Heurísticas — Erdoğan, Battarra, Laporte y Vigo (2012).
 * Compara el costo que obtienen el Algoritmo 2.1 (manipulación óptima de la Política 3 sobre
 * una ruta fija) y el ILS del Algoritmo 4.2 (ruta + manipulación) con el de los modelos
 * exactos de Gurobi (General, P1, P2, P3). Los datos vienen de Outputs/Erdogan2012/.
 *
 * Todo en tablas simples: resumen (12) · esta instancia (7) + el Algoritmo 2.1 sobre cada
 * ruta (5) · todas las instancias (12) · métodos y comandos (plegable).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CircleCheck, FlaskConical, RotateCw, Terminal, Timer } from 'lucide-react';
import { useCatalog } from '../state/SimulationProvider';
import { fmt } from '../lib/format';
import { cn } from '../lib/cn';
import { springSoft, staggerChild, staggerParent } from '../lib/motion';
import { Button, Chip, Segmented, SectionHeader, SpotlightCard } from './ui';
import { customerCountsOf, findInstance, summarize, useHeuristics, type HeurInstance } from './heuristics/data';
import { HEUR_METHODS, MethodMark } from './heuristics/methods';
import { InstanceCosts } from './heuristics/InstanceCosts';
import { RouteDpTable } from './heuristics/RouteDpTable';
import { AllInstancesTable } from './heuristics/AllInstancesTable';
import { MethodNote } from './heuristics/MethodNote';

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
        title="¿Cuánto cuestan las heurísticas frente a Gurobi?"
        description="Dos heurísticas del paper frente a los modelos exactos de Gurobi, en las mismas instancias."
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
                <span className="num text-zinc-200">{instances.length}</span> instancias
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
            <InstanceCosts inst={current} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-5">
            <RouteDpTable inst={current} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
            <AllInstancesTable instances={instances} />
          </motion.div>
          <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
            <MethodNote instances={instances} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/* ───────────────────────── Resumen ───────────────────────── */

type Scope = 'all' | number;

/** Tres cifras sobre todas las instancias (o las de un tamaño). */
function VerdictStrip({ instances }: { instances: HeurInstance[] }) {
  const counts = useMemo(() => customerCountsOf(instances), [instances]);
  const [picked, setScope] = useState<Scope>('all');
  // Si tras recargar ya no hay instancias de ese tamaño, se vuelve a "Todas".
  const scope: Scope = picked !== 'all' && !counts.includes(picked) ? 'all' : picked;
  const subset = useMemo(() => (scope === 'all' ? instances : instances.filter((x) => x.numCustomers === scope)), [instances, scope]);
  const s = useMemo(() => summarize(subset), [subset]);
  const nIters = useMemo(
    () => [...new Set(subset.flatMap((x) => (x.ils?.params?.nIter != null ? [x.ils.params.nIter] : [])))].sort((a, b) => a - b),
    [subset],
  );
  const howMany = s.instances === 1 ? 'la única instancia' : `las ${s.instances} instancias`;
  const scopeText = scope === 'all' ? howMany : `${howMany} de ${scope} clientes`;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Resumen</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">Resultado en {scopeText}</h3>
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

      <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-800/80 md:grid-cols-3">
        <Stat
          icon={<CircleCheck className="h-3.5 w-3.5 text-dp" aria-hidden />}
          term="Algoritmo 2.1 igual a Gurobi P3"
          value={
            <>
              {s.dpMatches}
              <span className="text-zinc-500">/{s.dpChecks}</span>
            </>
          }
          unit="instancias"
          note={s.dpChecks === 0 ? 'Sin resultados.' : 'Misma manipulación sobre la ruta de P3.'}
        />
        <Stat
          icon={<MethodMark tone="ils" size={12} />}
          term="ILS igual al óptimo de Gurobi P3"
          value={
            <>
              {s.ilsOptimal}
              <span className="text-zinc-500">/{s.ilsCount}</span>
            </>
          }
          unit="instancias"
          note={s.ilsCount === 0 ? 'Sin resultados.' : 'Mismo costo total que el óptimo de P3.'}
        />
        <Stat
          icon={<Timer className="h-3.5 w-3.5 text-zinc-300" aria-hidden />}
          term="Tiempo del ILS"
          value={s.meanRunSec === null ? '—' : fmt(s.meanRunSec, s.meanRunSec < 1 ? 2 : 1)}
          unit="s por corrida"
          note={nIters.length ? `Python · ${nIters.join(' / ')} iter. por dirección` : 'Python'}
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
      <dd className="mt-2 text-[12px] text-zinc-500">{note}</dd>
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
      <div className={cn(block, 'h-[420px] lg:col-span-7')} />
      <div className={cn(block, 'h-[420px] lg:col-span-5')} />
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
          Sin resultados para la instancia cargada (<span className="num text-zinc-200">{n}</span> clientes · ID{' '}
          <span className="num text-zinc-200">{id}</span>). Genéralos con:
        </p>
        <div className="mt-2 space-y-1.5">
          <CommandLine>{`python notebooks/tsppd_h_alg21_dp.py --customers ${n} --id ${id}`}</CommandLine>
          <CommandLine>{`python notebooks/tsppd_h_alg42_ils.py --customers ${n} --id ${id}`}</CommandLine>
        </div>
      </div>
    </div>
  );
}
