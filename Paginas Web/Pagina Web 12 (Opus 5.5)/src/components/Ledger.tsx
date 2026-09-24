/**
 * 02 · Bitácora — el tour tramo por tramo.
 * Bento asimétrico: perfil de carga (8) + costo acumulado (4) + bitácora tabular (12).
 * Todo es navegable: seleccionar un tramo lleva el simulador a esa parada y el hover
 * resalta el nodo en el mapa y en el compartimiento (hover cruzado).
 */
import { motion } from 'motion/react';
import { useCatalog } from '../state/SimulationProvider';
import { modelMeta } from '../lib/models';
import { staggerChild, staggerParent } from '../lib/motion';
import { Chip, SectionHeader } from './ui';
import { LoadProfile } from './analysis/LoadProfile';
import { CostCurve } from './analysis/CostCurve';
import { LedgerTable } from './analysis/LedgerTable';

export function Ledger() {
  const { solution, activeModel } = useCatalog();
  if (!solution) return null;
  const model = modelMeta(activeModel);

  return (
    <div>
      <SectionHeader
        index="02"
        eyebrow="Bitácora del tour"
        title="El tour, tramo por tramo"
        description="Carga a bordo, manipulaciones y costo acumulado en cada arco de la solución óptima. Selecciona un tramo para llevar el simulador a esa parada."
        aside={
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Chip tone={model.tone} size="sm">
              {model.short}
            </Chip>
            <span className="text-[13px] text-zinc-400">
              {model.label} · instancia <span className="num text-zinc-200">{solution.instanceId}</span> ·{' '}
              <span className="num text-zinc-200">{solution.numCustomers}</span> clientes
            </span>
          </div>
        }
      />

      <motion.div
        className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
      >
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-8">
          <LoadProfile />
        </motion.div>
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-4">
          <CostCurve />
        </motion.div>
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
          <LedgerTable />
        </motion.div>
      </motion.div>
    </div>
  );
}
