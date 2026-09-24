/**
 * Pie editorial: qué es la herramienta, la referencia académica verificada contra
 * papers/battarra2010.pdf y la ficha técnica de esta página (stack, fuente de datos, atajos).
 * pb-28 deja libre el espacio del mini reproductor flotante.
 */
import { motion } from 'motion/react';
import { ArrowUp, ArrowUpRight } from 'lucide-react';
import { useCatalog } from '../state/SimulationProvider';
import { useUI } from '../state/UIProvider';
import { MODELS, type ModelTone } from '../lib/models';
import { cn } from '../lib/cn';
import { springSnappy, tapPress, scrollBehavior } from '../lib/motion';
import { Kbd } from './ui';
import { BrandMark } from './chrome/BrandMark';

const DOI = '10.1287/trsc.1100.0316';

const MODEL_DOT: Record<ModelTone, string> = {
  general: 'bg-zinc-100',
  p1: 'bg-p1',
  p2: 'bg-p2',
  p3: 'bg-[linear-gradient(90deg,var(--color-p1)_0%,var(--color-p1)_50%,var(--color-p2)_50%,var(--color-p2)_100%)]',
};

const LEGEND = [
  { swatch: 'bg-alpha', label: 'α entrega' },
  { swatch: 'bg-beta', label: 'β recogida' },
  { swatch: 'bg-handling', label: 'manipulación · h' },
  { swatch: 'bg-p1', label: 'P1 compuerta' },
  { swatch: 'bg-p2', label: 'P2 fondo' },
] as const;

export function Footer() {
  const { source, solutions, error } = useCatalog();
  const { setShortcutsOpen } = useUI();

  const sourceLabel =
    source === 'api' ? 'API local · Outputs/ en vivo' : source === 'static' ? 'Paquete estático (sin backend)' : 'Conectando…';
  const dot = error ? 'bg-handling' : source === 'api' ? 'bg-ok' : source === 'static' ? 'bg-zinc-400' : 'bg-zinc-600';

  return (
    <footer className="relative z-10 border-t border-zinc-900 py-16 pb-28">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-10 lg:grid-cols-12 lg:gap-8">
          {/* ── Qué es */}
          <div className="md:col-span-2 lg:col-span-6">
            <div className="flex items-center gap-3">
              <BrandMark className="h-9 w-9" />
              <div className="leading-tight">
                <p className="text-base font-semibold tracking-tight text-zinc-50">TSPPD-H</p>
                <p className="text-[13px] text-zinc-500">Laboratorio LIFO</p>
              </div>
            </div>
            <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-pretty text-zinc-400">
              Un banco de pruebas para leer, parada por parada, las soluciones óptimas del problema del viajante con recogidas,
              entregas y costos de manipulación: la ruta del camión, cada unidad α y β dentro de un compartimiento de una sola
              puerta y el precio de mover lo que estorba. Las cuatro variantes se resolvieron de forma exacta sobre las mismas
              instancias, así que cada diferencia en Z* es atribuible a la política de carga.
            </p>
            <ul aria-label="Código de color" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn('h-2 w-2 rounded-[3px]', l.swatch)} />
                  {l.label}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Referencia */}
          <div className="lg:col-span-3">
            <p className="eyebrow">Referencia</p>
            <p className="mt-4 text-sm leading-relaxed text-pretty text-zinc-300">
              Battarra, M., Erdoğan, G., Laporte, G. y Vigo, D. (2010).{' '}
              <cite className="text-zinc-100 italic">The Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs</cite>.{' '}
              <span className="text-zinc-400">
                Transportation Science, <span className="italic">44</span>(3), 383–399.
              </span>
            </p>
            <a
              href={`https://doi.org/${DOI}`}
              target="_blank"
              rel="noreferrer"
              className="group mt-3 inline-flex items-center gap-1 rounded-md font-mono text-xs text-zinc-400 transition-colors hover:text-zinc-50"
            >
              doi:{DOI}
              <ArrowUpRight
                aria-hidden
                className="h-3.5 w-3.5 transition-transform duration-200 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>

            <ul aria-label="Modelos implementados" className="mt-6 space-y-1.5 text-[13px]">
              {MODELS.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 border-b border-dashed border-zinc-800/80 pb-1.5 last:border-0">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full', MODEL_DOT[m.tone])} />
                    {m.label}
                  </span>
                  <span className="num text-[11.5px] text-zinc-500">{m.equations}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Esta página */}
          <div className="lg:col-span-3">
            <p className="eyebrow">Esta página</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Versión</dt>
                <dd className="mt-0.5 text-zinc-200">Página Web 12 · Opus 5.5</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Stack</dt>
                <dd className="mt-0.5 text-zinc-300">React 19 · Motion · Tailwind v4 · KaTeX</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Datos</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                    {sourceLabel}
                  </span>
                  {solutions.length > 0 && <span className="num text-xs text-zinc-500">{solutions.length} soluciones</span>}
                </dd>
              </div>
            </dl>
            <motion.button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              whileTap={tapPress}
              transition={springSnappy}
              aria-haspopup="dialog"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[13px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              Pulsa <Kbd>?</Kbd> para ver los atajos
            </motion.button>
          </div>
        </div>

        {/* ── Línea final */}
        <div className="mt-14 flex flex-col gap-4 border-t border-zinc-900 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[65ch] text-pretty">
            Taller de Investigación · Instancias e_vigo resueltas con Gurobi · Visualización de apoyo, no reemplaza la lectura
            del artículo.
          </p>
          <motion.button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
            whileHover={{ y: -2 }}
            whileTap={tapPress}
            transition={springSnappy}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl px-2 py-1 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 sm:self-auto"
          >
            <ArrowUp aria-hidden className="h-3.5 w-3.5" />
            Volver arriba
          </motion.button>
        </div>
      </div>
    </footer>
  );
}
