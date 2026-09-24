import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Check, RefreshCw, SearchX } from 'lucide-react';
import { useCatalog } from '../state/SimulationProvider';
import { useUI } from '../state/UIProvider';
import { MODELS, TONE_CHIP, TONE_COLOR, modelMeta } from '../lib/models';
import { fmt, fmtAuto, fmtKm } from '../lib/format';
import { cn } from '../lib/cn';
import { hoverLift, spring, springSnappy, springSoft, staggerChild, staggerParent, tapPress } from '../lib/motion';
import type { ModelType, SolutionMeta } from '../types/solution';
import { Button, Chip, Dialog, Kbd, Segmented, SpotlightCard } from './ui';

type SortKey = 'id' | 'z';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/* ───────────────────────── Riel de modelos ───────────────────────── */

function ModelRail({
  value,
  onChange,
  counts,
  groupRef,
}: {
  value: ModelType;
  onChange: (m: ModelType) => void;
  counts: Record<ModelType, number>;
  groupRef: RefObject<HTMLDivElement | null>;
}) {
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + MODELS.length) % MODELS.length;
    onChange(MODELS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div ref={groupRef} role="radiogroup" aria-label="Modelo" className="grid grid-cols-2 gap-1 md:grid-cols-1">
      {MODELS.map((m, i) => {
        const active = m.id === value;
        const count = counts[m.id] ?? 0;
        return (
          <button
            key={m.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'group relative flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50',
              active ? 'text-zinc-50' : 'text-zinc-400 hover:bg-zinc-800/35 hover:text-zinc-100',
            )}
          >
            {active && (
              <motion.span
                layoutId={`${uid}-rail`}
                transition={spring}
                aria-hidden
                className="absolute inset-0 rounded-xl border border-zinc-700/80 bg-zinc-800/60 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]"
              />
            )}
            <span
              className={cn(
                'relative grid h-7 w-9 shrink-0 place-items-center rounded-md border font-mono text-[11px] font-semibold tracking-tight',
                TONE_CHIP[m.tone],
              )}
            >
              {m.short}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">{m.label}</span>
              <span className="mt-0.5 block truncate font-mono text-[10.5px] text-zinc-500">{m.equations}</span>
            </span>
            <span className={cn('num relative text-xs', active ? 'text-zinc-200' : 'text-zinc-500')}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReadingNote() {
  const rows = [
    { term: 'Z*', swatch: 'bg-zinc-100', text: 'Valor óptimo del objetivo: distancia recorrida + costo de manipulación.' },
    { term: 'Ruta', swatch: 'bg-zinc-500', text: 'Suma de c_ij sobre los arcos del tour (km).' },
    { term: 'Manip.', swatch: 'bg-handling', text: 'h × unidades evacuadas y recargadas para liberar la puerta LIFO.' },
  ];
  return (
    <aside className="rounded-xl border border-dashed border-zinc-800 p-3.5">
      <p className="eyebrow">Cómo leer las cifras</p>
      <dl className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.term} className="grid grid-cols-[52px_1fr] gap-2">
            <dt className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-zinc-200">
              <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', r.swatch)} />
              {r.term}
            </dt>
            <dd className="text-[11.5px] leading-snug text-zinc-400 text-pretty">{r.text}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/* ───────────────────────── Tarjeta de instancia ───────────────────────── */

interface CardProps {
  s: SolutionMeta;
  active: boolean;
  current: boolean;
  /** Posición relativa de Z* entre el mínimo (0) y el máximo (1) del conjunto filtrado. */
  rel: number;
  /** Las 4 variantes (modelos) de la misma instancia. */
  variants: SolutionMeta[];
  onPick: (filename: string) => void;
}

const InstanceCard = memo(function InstanceCard({ s, active, current, rel, variants, onPick }: CardProps) {
  const mm = modelMeta(s.model);
  const zs = variants.map((v) => v.objectiveValue);
  const lo = Math.min(...zs);
  const hi = Math.max(...zs);
  const best = variants.find((v) => v.objectiveValue === lo);
  const delta = s.objectiveValue - lo;
  const rank = [...zs].sort((a, b) => a - b).indexOf(s.objectiveValue) + 1;
  const pos = (z: number) => (hi - lo > 1e-9 ? (z - lo) / (hi - lo) : 0.5);
  const ordered = [...variants].sort((a, b) => Number(a.filename === s.filename) - Number(b.filename === s.filename));

  const pick = () => onPick(s.filename);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick();
    }
  };

  const stripLabel = variants.map((v) => `${modelMeta(v.model).label} ${fmt(v.objectiveValue)}`).join('; ');

  return (
    // tabIndex={-1}: evita que whileTap convierta el envoltorio en una parada de Tab sin nombre
    <motion.div variants={staggerChild} whileHover={hoverLift} whileTap={tapPress} transition={springSnappy} tabIndex={-1} className="h-full outline-none">

      <SpotlightCard
        role="button"
        tabIndex={0}
        aria-current={active ? 'true' : undefined}
        aria-label={`Instancia ${s.instanceId}, ${mm.label}, ${s.numCustomers} clientes. Z* ${fmt(s.objectiveValue)}, ruta ${fmtKm(
          s.totalDistance,
        )}, manipulación ${fmt(s.handlingCost)}.${active ? ' Solución activa.' : ''}`}
        onClick={pick}
        onKeyDown={onKey}
        className={cn(
          'group flex h-full cursor-pointer select-none flex-col p-4 transition-colors duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50',
          active ? 'border-zinc-500/80 bg-zinc-800/45' : 'hover:border-zinc-700',
        )}
      >
        {/* Identidad */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eyebrow">Instancia</p>
            <p className="num mt-1 text-[28px] font-semibold leading-none tracking-tight text-zinc-50">#{s.instanceId}</p>
          </div>
          {active ? (
            <Chip tone="solid">
              <Check className="h-3 w-3" aria-hidden />
              Activa
            </Chip>
          ) : current ? (
            <Chip tone="muted" title="Es la instancia en pantalla, resuelta con otro modelo">
              Instancia actual
            </Chip>
          ) : (
            <ArrowUpRight
              aria-hidden
              className="h-4 w-4 text-zinc-500 opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-300 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </div>

        {/* Objetivo */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[11px] text-zinc-500">Z*</span>
            {(rel <= 0.001 || rel >= 0.999) && (
              <span className="font-mono text-[10.5px] text-zinc-500">{rel <= 0.001 ? 'mín. del conjunto' : 'máx. del conjunto'}</span>
            )}
          </div>
          <p className="num mt-0.5 text-[22px] font-medium leading-tight text-zinc-50">{fmt(s.objectiveValue)}</p>
          <div aria-hidden className="relative mt-2 h-1 rounded-full bg-zinc-800">
            <motion.div
              className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-zinc-600"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: rel }}
              transition={springSoft}
            />
            <motion.span
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-zinc-100"
              initial={{ left: '0%' }}
              animate={{ left: `${rel * 100}%` }}
              transition={springSoft}
            />
          </div>
        </div>

        {/* Desglose */}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[11.5px]">
          <div className="min-w-0">
            <dt className="text-zinc-500">Ruta</dt>
            <dd className="num mt-0.5 text-zinc-200">{fmtKm(s.totalDistance)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-zinc-500">Manipulación</dt>
            <dd className={cn('num mt-0.5', s.handlingCost > 0 ? 'text-handling' : 'text-zinc-500')}>+{fmt(s.handlingCost)}</dd>
          </div>
        </dl>

        {/* Los 4 modelos en esta instancia */}
        <div className="mt-auto pt-4">
          <div className="border-t border-zinc-800/70 pt-3">
            <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="font-mono whitespace-nowrap text-zinc-500">{variants.length} modelos</span>
              {variants.length > 1 &&
                (delta < 0.005 ? (
                  <span className="font-medium whitespace-nowrap text-ok">mejor de {variants.length}</span>
                ) : (
                  <span className="num whitespace-nowrap text-zinc-400">
                    {rank}.º · +{fmt(delta)} vs {modelMeta(best?.model).short}
                  </span>
                ))}
            </div>
            <div role="img" aria-label={`Z* por modelo en la instancia ${s.instanceId}: ${stripLabel}`} className="relative mx-1.5 mt-2 h-3">
              <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-800" />
              {ordered.map((v) => {
                const self = v.filename === s.filename;
                const tone = modelMeta(v.model).tone;
                return (
                  <span
                    key={v.filename}
                    title={`${modelMeta(v.model).label}: Z* ${fmt(v.objectiveValue)}`}
                    className={cn(
                      'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-900',
                      self ? 'h-2.5 w-2.5' : 'h-[7px] w-[7px] opacity-80',
                    )}
                    style={{ left: `${pos(v.objectiveValue) * 100}%`, background: TONE_COLOR[tone] }}
                  />
                );
              })}
            </div>
            <p className="mt-2.5 font-mono text-[10.5px] text-zinc-500">
              Q = {s.capacity} · h = {fmtAuto(s.h)}
            </p>
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
});

function SkeletonGrid() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="h-[232px] animate-shimmer rounded-2xl border border-zinc-800 bg-[linear-gradient(90deg,transparent_0%,rgb(255_255_255/0.035)_50%,transparent_100%)] bg-[length:200%_100%]"
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Diálogo ───────────────────────── */

/** Catálogo de soluciones: modelo × cantidad de clientes × instancia. */
export function Explorer() {
  const { solutions, source, loading, error, selectedFilename, meta, activeModel, actions } = useCatalog();
  const { explorerOpen, setExplorerOpen } = useUI();
  const close = useCallback(() => setExplorerOpen(false), [setExplorerOpen]);

  const customerCounts = useMemo(
    () => [...new Set(solutions.map((s) => s.numCustomers))].filter((n) => n > 0).sort((a, b) => a - b),
    [solutions],
  );
  const fallbackCount = customerCounts.includes(10) ? 10 : customerCounts[customerCounts.length - 1] ?? 10;

  const [count, setCount] = useState<number>(meta?.numCustomers ?? fallbackCount);
  const [model, setModel] = useState<ModelType>(activeModel);
  const [sort, setSort] = useState<SortKey>('id');

  // Al abrir, el catálogo parte desde la solución en pantalla.
  const [openedFor, setOpenedFor] = useState(explorerOpen);
  if (openedFor !== explorerOpen) {
    setOpenedFor(explorerOpen);
    if (explorerOpen) {
      setCount(meta?.numCustomers ?? fallbackCount);
      setModel(activeModel);
    }
  }
  const n = customerCounts.includes(count) ? count : fallbackCount;
  const mm = modelMeta(model);

  // El diálogo enfoca su primer botón (el selector de clientes del encabezado); se prefiere el modelo activo.
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!explorerOpen) return;
    const t = window.setTimeout(() => railRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [explorerOpen]);

  const derived = useMemo(() => {
    const ofCount = solutions.filter((s) => s.numCustomers === n);
    const perModel = Object.fromEntries(MODELS.map((m) => [m.id, ofCount.filter((s) => s.model === m.id).length])) as Record<
      ModelType,
      number
    >;
    const byInstance = new Map<number, SolutionMeta[]>();
    for (const m of MODELS) {
      for (const s of ofCount) {
        if (s.model !== m.id) continue;
        const list = byInstance.get(s.instanceId) ?? [];
        list.push(s);
        byInstance.set(s.instanceId, list);
      }
    }
    const filtered = ofCount.filter((s) => s.model === model);
    const zs = filtered.map((s) => s.objectiveValue);
    const min = zs.length ? Math.min(...zs) : 0;
    const max = zs.length ? Math.max(...zs) : 0;
    return {
      perModel,
      byInstance,
      filtered,
      min,
      max,
      stats: {
        z: mean(zs),
        km: mean(filtered.map((s) => s.totalDistance)),
        h: mean(filtered.map((s) => s.handlingCost)),
        zeroH: filtered.filter((s) => s.handlingCost <= 1e-9).length,
      },
    };
  }, [solutions, n, model]);

  const sorted = useMemo(() => {
    const list = [...derived.filtered];
    return sort === 'z'
      ? list.sort((a, b) => a.objectiveValue - b.objectiveValue || a.instanceId - b.instanceId)
      : list.sort((a, b) => a.instanceId - b.instanceId);
  }, [derived.filtered, sort]);

  const pick = useCallback(
    (filename: string) => {
      actions.selectSolution(filename);
      setExplorerOpen(false);
    },
    [actions, setExplorerOpen],
  );

  const span = derived.max - derived.min;
  const relOf = (z: number) => (span > 1e-9 ? (z - derived.min) / span : 0.5);

  const header = customerCounts.length > 0 && (
    <Segmented
      ariaLabel="Cantidad de clientes"
      size="sm"
      value={n}
      onChange={setCount}
      options={customerCounts.map((c) => ({ value: c, label: `${c} clientes` }))}
    />
  );

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-xs text-zinc-400">
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', source === 'api' ? 'bg-ok shadow-[0_0_0_3px_rgb(52_211_153/0.15)]' : 'bg-zinc-500')}
        />
        <span>
          <span className="num text-zinc-100">{derived.filtered.length}</span> soluciones · Fuente:{' '}
          {source === 'api' ? 'Outputs/ en vivo' : 'paquete estático'}
        </span>
      </p>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex">
          <Kbd>E</Kbd> abrir <span className="text-zinc-700">·</span> <Kbd>Esc</Kbd> cerrar
        </span>
        <Button variant="ghost" size="sm" onClick={actions.refresh} disabled={loading && solutions.length === 0}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          Recargar
        </Button>
      </div>
    </div>
  );

  const showSkeleton = solutions.length === 0 && loading;

  return (
    <Dialog
      open={explorerOpen}
      onClose={close}
      size="xl"
      title="Catálogo de soluciones"
      description={`Elige modelo, cantidad de clientes e instancia. ${solutions.length} soluciones óptimas · ${
        source === 'api' ? 'Outputs/ (API en vivo)' : 'public/solutions (empaquetadas)'
      }.`}
      headerExtra={header}
      footer={footer}
      bodyClassName="p-4 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr] md:grid-rows-[auto_1fr]">
        {/* Riel: modelos */}
        <div className="min-w-0">
          <p className="eyebrow mb-2.5 px-1">Modelo</p>
          <ModelRail value={model} onChange={setModel} counts={derived.perModel} groupRef={railRef} />
        </div>

        {/* Panel: instancias */}
        <div className="min-w-0 md:row-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-[65ch]">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={mm.tone}>{mm.short}</Chip>
                <h3 className="text-[15px] font-semibold tracking-tight text-zinc-50">{mm.name}</h3>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400 text-pretty">{mm.summary}</p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Segmented
                ariaLabel="Ordenar instancias"
                size="xs"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'id', label: 'Por ID' },
                  { value: 'z', label: 'Por Z*' },
                ]}
              />
              <span className="font-mono text-[11px] text-zinc-500" title="Patrón de carga desde la cabina (F) hasta la compuerta (R)">
                {mm.pattern}
              </span>
            </div>
          </div>

          {derived.filtered.length > 0 && (
            <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2 border-y border-zinc-800/70 py-2.5 text-[11.5px]">
              <div className="flex items-baseline gap-2">
                <dt className="text-zinc-500">Z* medio</dt>
                <dd className="num text-zinc-100">{fmt(derived.stats.z)}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-zinc-500">Rango</dt>
                <dd className="num text-zinc-300">
                  {fmt(derived.min)} – {fmt(derived.max)}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-zinc-500">Ruta media</dt>
                <dd className="num text-zinc-300">{fmtKm(derived.stats.km)}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-zinc-500">Manip. media</dt>
                <dd className={cn('num', derived.stats.h > 0 ? 'text-handling' : 'text-zinc-400')}>+{fmt(derived.stats.h)}</dd>
              </div>
              {derived.stats.zeroH > 0 && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-zinc-500">Sin manipular</dt>
                  <dd className="num text-zinc-300">
                    {derived.stats.zeroH}/{derived.filtered.length}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-4">
            {showSkeleton ? (
              <SkeletonGrid />
            ) : sorted.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400">
                  <SearchX className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-4 text-sm font-medium text-zinc-200">
                  Sin soluciones de {mm.label} para {n} clientes
                </p>
                <p className="mt-1 max-w-[46ch] text-[13px] text-zinc-500 text-pretty">
                  {error ?? 'Prueba otro modelo o cantidad de clientes, o recarga el catálogo si acabas de ejecutar un solver.'}
                </p>
                <Button variant="secondary" size="sm" className="mt-5" onClick={actions.refresh}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Recargar catálogo
                </Button>
              </div>
            ) : (
              <motion.div
                key={`${model}-${n}-${sort}`}
                variants={staggerParent}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {sorted.map((s) => (
                  <InstanceCard
                    key={s.filename}
                    s={s}
                    active={s.filename === selectedFilename}
                    current={!!meta && s.filename !== selectedFilename && s.instanceId === meta.instanceId && s.numCustomers === meta.numCustomers}
                    rel={relOf(s.objectiveValue)}
                    variants={derived.byInstance.get(s.instanceId) ?? [s]}
                    onPick={pick}
                  />
                ))}
              </motion.div>
            )}
          </div>

          {sorted.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-zinc-500">
              <span className="flex items-center gap-2">
                <span aria-hidden className="relative h-1 w-9 rounded-full bg-zinc-800">
                  <span className="absolute inset-y-0 left-0 w-[60%] rounded-full bg-zinc-600" />
                  <span className="absolute top-1/2 left-[60%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-zinc-100" />
                </span>
                Z* entre el mínimo y el máximo de este conjunto
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span aria-hidden className="flex items-center gap-1.5">
                  {MODELS.map((m) => (
                    <span key={m.id} className="flex items-center gap-1 font-mono text-[10.5px] text-zinc-400">
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: TONE_COLOR[m.tone] }} />
                      {m.short}
                    </span>
                  ))}
                </span>
                Z* de los 4 modelos en la misma instancia
              </span>
            </div>
          )}
        </div>

        {/* Nota de lectura (en móvil queda al final) */}
        <div className="min-w-0 md:self-start">
          <ReadingNote />
        </div>
      </div>
    </Dialog>
  );
}
