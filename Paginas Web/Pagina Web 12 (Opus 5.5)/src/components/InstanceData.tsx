import { motion } from 'motion/react';
import { useCatalog } from '../state/SimulationProvider';
import { modelMeta } from '../lib/models';
import { staggerChild, staggerParent } from '../lib/motion';
import { Chip, SectionHeader } from './ui';
import { DistanceHeatmap } from './data/DistanceHeatmap';
import { NodesTable } from './data/NodesTable';
import { InstanceSummary } from './data/InstanceSummary';

export function InstanceData() {
  const { solution, meta, activeModel } = useCatalog();
  if (!solution) return null;

  const n = solution.numCustomers || meta?.numCustomers || Math.max(0, solution.nodes.length - 1);
  const id = solution.instanceId || meta?.instanceId || 0;
  const model = modelMeta(activeModel);

  return (
    <div>
      <SectionHeader
        index="05"
        eyebrow="Datos de la instancia"
        title={`${n} clientes · instancia ${id}`}
        description="Instancias euclidianas de Gendreau, Laporte y Vigo (1999) —archivos e_vigo— adaptadas al TSPPD-H como en el paper: p′ᵢ = max(1, pᵢ mod 20), βᵢ = ⌊p′ᵢ·(i mod 5)/5⌋, αᵢ = p′ᵢ − βᵢ, con matriz simétrica de costos c_ij."
        aside={
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span className="text-[12px] text-zinc-400">Tour de la variante</span>
            <Chip tone={model.tone} size="sm">
              {model.label}
            </Chip>
          </div>
        }
      />

      <motion.div
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-8">
          <DistanceHeatmap />
        </motion.div>
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-4">
          <NodesTable />
        </motion.div>
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-12">
          <InstanceSummary />
        </motion.div>
      </motion.div>
    </div>
  );
}
