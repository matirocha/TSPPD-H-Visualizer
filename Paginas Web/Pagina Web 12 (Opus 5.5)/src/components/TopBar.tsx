/**
 * Barra superior: marca · migas de la instancia · selector de modelo | secciones · búsqueda · fuente de datos · atajos.
 * Se pliega por etapas para no desbordar nunca (375 px → marca + instancia + modelo + búsqueda).
 */
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Keyboard, Layers, RotateCw, Search } from 'lucide-react';
import { useCatalog } from '../state/SimulationProvider';
import { useUI } from '../state/UIProvider';
import { MODELS, type ModelMeta, type ModelTone } from '../lib/models';
import type { ModelType } from '../types/solution';
import { cn } from '../lib/cn';
import { spring, springSnappy, tapPress, scrollBehavior } from '../lib/motion';
import { Button, Chip, Kbd, Segmented, Tooltip } from './ui';
import type { SegmentedOption } from './ui/Segmented';
import { BrandMark } from './chrome/BrandMark';
import { scrollToSection, useActiveSection, useMediaQuery } from './chrome/hooks';

const SECTIONS = [
  { id: 'simulador', label: 'Simulador' },
  { id: 'bitacora', label: 'Bitácora' },
  { id: 'comparativa', label: 'Comparativa' },
  { id: 'modelo', label: 'Modelo' },
  { id: 'datos', label: 'Datos' },
] as const;
const SECTION_IDS: readonly string[] = SECTIONS.map((s) => s.id);

const P3_SPLIT = 'bg-[linear-gradient(90deg,var(--color-p1)_0%,var(--color-p1)_50%,var(--color-p2)_50%,var(--color-p2)_100%)]';

/** Píldora activa del selector, con el color de cada modelo. */
const ACTIVE_TONE: Record<ModelTone, string> = {
  general: 'bg-zinc-100',
  p1: 'bg-p1',
  p2: 'bg-p2',
  p3: P3_SPLIT,
};

/** Punto de color que anticipa el tono de cada modelo (solo en pantallas amplias). */
const DOT_TONE: Record<ModelTone, string> = {
  general: 'bg-zinc-100',
  p1: 'bg-p1',
  p2: 'bg-p2',
  p3: P3_SPLIT,
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Etiqueta del segmento: "Gen" en móvil, "General" desde sm; las políticas usan
 * siempre la forma corta (P1–P3) — el nombre completo va en `title` y `aria-label`.
 */
function ModelLabel({ m }: { m: ModelMeta }) {
  return (
    <>
      <span aria-hidden className={cn('hidden h-1.5 w-1.5 rounded-full ring-1 ring-zinc-950/40 2xl:inline-block', DOT_TONE[m.tone])} />
      {m.tone === 'general' ? (
        <>
          <span className="sm:hidden">{m.short}</span>
          <span className="hidden sm:inline">{m.label}</span>
        </>
      ) : (
        m.short
      )}
    </>
  );
}

function Divider() {
  return <span aria-hidden className="hidden h-5 w-px shrink-0 rotate-[18deg] bg-zinc-700/80 sm:block" />;
}

export function TopBar() {
  const { meta, solution, solutions, source, loading, error, activeModel, actions } = useCatalog();
  const { setExplorerOpen, setPaletteOpen, setShortcutsOpen } = useUI();
  const isSm = useMediaQuery('(min-width: 640px)');
  const active = useActiveSection(SECTION_IDS, solution);

  const numCustomers = meta?.numCustomers ?? solution?.numCustomers ?? null;
  const instanceId = meta?.instanceId ?? solution?.instanceId ?? null;

  const modelOptions = useMemo<SegmentedOption<ModelType>[]>(() => {
    const available = new Set(
      solutions.filter((s) => numCustomers === null || s.numCustomers === numCustomers).map((s) => s.model),
    );
    return MODELS.map((m) => ({
      value: m.id,
      label: <ModelLabel m={m} />,
      ariaLabel: m.label,
      title: available.has(m.id) ? `${m.label} · ${m.equations}` : `${m.label} · sin solución para ${numCustomers ?? '—'} clientes`,
      disabled: !available.has(m.id) && m.id !== activeModel,
      activeClassName: ACTIVE_TONE[m.tone],
    }));
  }, [solutions, numCustomers, activeModel]);

  const sourceText =
    source === 'api' ? 'Leyendo Outputs/ en vivo (API local)' : source === 'static' ? 'Soluciones empaquetadas (sin backend)' : 'Conectando con la fuente de datos…';
  const dotClass = error ? 'bg-handling' : source === 'api' ? 'bg-ok' : source === 'static' ? 'bg-zinc-400' : 'bg-zinc-600';

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
      <h1 className="sr-only">TSPPD-H · Laboratorio LIFO — visualizador de soluciones óptimas</h1>
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* ── Marca */}
        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap={tapPress}
          transition={springSnappy}
          aria-label="TSPPD-H · Laboratorio LIFO. Volver al inicio"
          className="flex shrink-0 items-center gap-2.5 rounded-xl"
        >
          <BrandMark />
          <span className="hidden items-baseline gap-2 md:flex">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-50">TSPPD-H</span>
            <span className="hidden text-[13px] text-zinc-500 lg:inline xl:hidden 2xl:inline">Laboratorio LIFO</span>
          </span>
        </motion.button>
        <Chip tone="muted" className="hidden min-[1680px]:inline-flex">
          P12 · Opus 5.5
        </Chip>

        <Divider />

        {/* ── Instancia (abre el catálogo) */}
        <Button
          variant="ghost"
          size="sm"
          flat
          onClick={() => setExplorerOpen(true)}
          title="Abrir catálogo (E)"
          aria-haspopup="dialog"
          className="min-w-0 shrink gap-1.5 px-2 text-zinc-200 sm:px-2.5"
        >
          <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          {numCustomers !== null && instanceId !== null ? (
            <span className="min-w-0 truncate text-[13px] tabular-nums">
              <span className="sr-only">Instancia: </span>
              <span className="sm:hidden">
                {numCustomers}
                <span className="sr-only"> clientes</span> · ID {instanceId}
              </span>
              <span className="hidden sm:inline">
                {numCustomers} clientes <span className="text-zinc-500">·</span> ID {instanceId}
              </span>
            </span>
          ) : (
            <>
              <span aria-hidden className="h-3 w-16 animate-pulse rounded bg-zinc-800 sm:w-24" />
              <span className="sr-only">Cargando instancia</span>
            </>
          )}
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-zinc-500 sm:block" />
        </Button>

        <Divider />

        {/* ── Selector de modelo */}
        <Segmented<ModelType>
          ariaLabel="Modelo de carga"
          size={isSm ? 'sm' : 'xs'}
          options={modelOptions}
          value={activeModel}
          onChange={(m) => actions.selectModel(m)}
          className="shrink-0"
        />

        {/* ── Lado derecho */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <nav aria-label="Secciones" className="mr-2 hidden items-center xl:flex">
            {SECTIONS.map((s) => {
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'relative h-8 rounded-xl px-2.5 text-[13px] font-medium transition-colors duration-150',
                    isActive ? 'text-zinc-50' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
                  )}
                >
                  {s.label}
                  {isActive && (
                    <motion.span
                      layoutId="topbar-section-indicator"
                      transition={spring}
                      aria-hidden
                      className="absolute inset-x-2.5 -bottom-[12px] h-[2px] rounded-full bg-zinc-100"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <Button
            variant="outline"
            size="sm"
            flat
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-label="Buscar comandos y soluciones"
            title={`Buscar (${IS_MAC ? '⌘' : 'Ctrl'} K)`}
            className="w-8 px-0 text-zinc-400 hover:text-zinc-100 lg:w-auto lg:justify-start lg:px-2.5 2xl:min-w-[148px]"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden lg:inline">Buscar</span>
            <Kbd className="ml-auto hidden lg:inline-flex">{IS_MAC ? '⌘ K' : 'Ctrl K'}</Kbd>
          </Button>

          <Tooltip
            side="bottom"
            align="end"
            className="hidden sm:inline-flex"
            content={
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 font-medium text-zinc-100">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />
                  {sourceText}
                </span>
                <span className="text-zinc-400">
                  {error ? 'La última lectura falló · ' : ''}
                  {solutions.length > 0 ? `${solutions.length} soluciones · ` : ''}clic para recargar
                </span>
              </span>
            }
          >
            <Button
              variant="ghost"
              size="icon-sm"
              flat
              onClick={() => actions.refresh()}
              aria-label="Recargar soluciones"
              aria-busy={loading}
              className="relative text-zinc-400"
            >
              <RotateCw className={cn('h-4 w-4', loading && 'animate-spin text-zinc-100')} />
              <span aria-hidden className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5">
                {source === 'api' && !error && <span className="absolute inset-0 animate-ring-ping rounded-full bg-ok/70" />}
                <span className={cn('relative h-1.5 w-1.5 rounded-full ring-2 ring-zinc-950', dotClass)} />
              </span>
            </Button>
          </Tooltip>

          <Tooltip
            side="bottom"
            align="end"
            className="hidden sm:inline-flex"
            content={
              <span className="flex items-center gap-1.5">
                Atajos de teclado <Kbd>?</Kbd>
              </span>
            }
          >
            <Button
              variant="ghost"
              size="icon-sm"
              flat
              onClick={() => setShortcutsOpen(true)}
              aria-label="Atajos de teclado"
              aria-haspopup="dialog"
              className="text-zinc-400"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* ── Línea de carga */}
      <span className="sr-only" aria-live="polite">
        {loading ? 'Cargando soluciones…' : ''}
      </span>
      <AnimatePresence>
        {loading && (
          <motion.div
            key="topbar-loading"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden"
          >
            <span className="absolute inset-0 bg-zinc-100/15" />
            <motion.span
              className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-zinc-50 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '300%' }}
              transition={{ repeat: Infinity, duration: 1.25, ease: [0.45, 0, 0.55, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
