import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { springSoft } from '../../lib/motion';

export interface SectionHeaderProps {
  id?: string;
  index?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

/** Encabezado editorial de sección: índice + eyebrow mono, título tracking-tight y bajada ≤ 65ch. */
export function SectionHeader({ id, index, eyebrow, title, description, aside, className }: SectionHeaderProps) {
  return (
    <motion.header
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={springSoft}
      className={cn('flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}
    >
      <div className="max-w-[65ch]">
        <p className="eyebrow flex items-center gap-2">
          {index && <span className="text-zinc-300">{index}</span>}
          {index && <span className="h-px w-6 bg-zinc-700" />}
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 text-balance sm:text-3xl">{title}</h2>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 text-pretty">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </motion.header>
  );
}
