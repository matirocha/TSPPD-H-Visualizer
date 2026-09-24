import { AlertTriangle, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useCatalog } from '../state/SimulationProvider';
import { Button } from './ui';
import { springSoft } from '../lib/motion';

export function ErrorBanner() {
  const { error, actions } = useCatalog();
  if (!error) return null;
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-handling/40 bg-handling/10 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-handling" />
        <div>
          <p className="text-sm font-semibold text-zinc-50">No se pudieron cargar las soluciones</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={actions.refresh}>
        <RotateCw className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </motion.div>
  );
}

/** Esqueleto con brillo mientras llega la primera solución. */
export function LoadingStage() {
  const { error } = useCatalog();
  if (error) return null;
  const block = 'rounded-2xl border border-zinc-800/80 bg-[linear-gradient(90deg,rgb(24_24_27/0.6),rgb(39_39_42/0.6),rgb(24_24_27/0.6))] bg-[length:200%_100%] animate-shimmer';
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4 pt-6">
      <span className="sr-only">Cargando soluciones óptimas desde Outputs/…</span>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-12">
        <div className={`${block} col-span-2 h-28 lg:col-span-5`} />
        <div className={`${block} h-28 lg:col-span-2`} />
        <div className={`${block} h-28 lg:col-span-2`} />
        <div className={`${block} col-span-2 h-28 lg:col-span-3`} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${block} h-[440px] xl:col-span-7`} />
        <div className={`${block} h-[440px] xl:col-span-5`} />
      </div>
      <div className={`${block} h-52`} />
    </div>
  );
}
