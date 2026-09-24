/**
 * 03 · Comparativa — ¿cuánto cuesta cada política?
 * Izquierda (7): las cuatro variantes de la instancia actual, Z* = distancia + manipulación.
 * Derecha (5): panorama de brechas en todas las instancias de un mismo tamaño.
 * Solo usa la metadata del catálogo (useCatalog().solutions / siblings): nada se inventa.
 */
import { motion } from 'motion/react';
import { useCatalog } from '../state/SimulationProvider';
import { staggerChild, staggerParent } from '../lib/motion';
import { SectionHeader } from './ui';
import { InstanceCompare } from './analysis/InstanceCompare';
import { Panorama } from './analysis/Panorama';

export function Compare() {
  const { meta, siblings } = useCatalog();

  return (
    <div>
      <SectionHeader
        index="03"
        eyebrow="Comparativa de políticas"
        title="¿Cuánto cuesta cada política?"
        description="Mismo conjunto de clientes, cuatro formas de organizar la carga. La diferencia entre modelos es exactamente el costo de manipulación y los desvíos que cada política obliga a tomar."
        aside={
          meta ? (
            <p className="text-[13px] text-zinc-400 md:text-right">
              <span className="num text-zinc-200">{siblings.length}</span> de 4 variantes · instancia{' '}
              <span className="num text-zinc-200">{meta.instanceId}</span> · <span className="num text-zinc-200">{meta.numCustomers}</span> clientes
            </p>
          ) : undefined
        }
      />

      <motion.div
        className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
      >
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-7">
          <InstanceCompare />
        </motion.div>
        <motion.div variants={staggerChild} className="min-w-0 lg:col-span-5">
          <Panorama />
        </motion.div>
      </motion.div>
    </div>
  );
}
