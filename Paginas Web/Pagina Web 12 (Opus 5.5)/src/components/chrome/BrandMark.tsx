import { motion, type Variants } from 'motion/react';
import { cn } from '../../lib/cn';
import { springSnappy } from '../../lib/motion';

/**
 * Isotipo del laboratorio: el compartimiento visto de costado — dos pallets α,
 * un pallet β junto a la compuerta y la cabina blanca al frente (mismo dibujo
 * que el favicon). Si el padre define `initial="rest" whileHover="hover"`, los
 * pallets "saltan" en cascada con resorte.
 */
const hop: Variants = {
  rest: { y: 0, transition: springSnappy },
  hover: (i: number) => ({ y: -2, transition: { ...springSnappy, delay: i * 0.045 } }),
};

const PALLETS = [
  { x: 6, w: 4, rx: 1, fill: '#fb923c' },
  { x: 11, w: 4, rx: 1, fill: '#fb923c' },
  { x: 16, w: 4, rx: 1, fill: '#22d3ee' },
  { x: 21, w: 5, rx: 1.5, fill: '#fafafa' },
] as const;

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={cn('h-7 w-7 shrink-0', className)}>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="#18181b" stroke="#3f3f46" strokeOpacity="0.7" />
      {PALLETS.map((p, i) => (
        <motion.g key={p.x} variants={hop} custom={i}>
          <rect x={p.x} y="10.5" width={p.w} height="10" rx={p.rx} fill={p.fill} />
        </motion.g>
      ))}
      <rect x="5.5" y="22.5" width="21" height="1" rx="0.5" fill="#52525b" />
    </svg>
  );
}
