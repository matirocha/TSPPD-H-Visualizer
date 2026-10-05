import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DisclosureProps {
  /** Texto del resumen (siempre visible). */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Bloque plegable (<details> nativo): esconde notas y metodología largas detrás de una línea
 * «Ver detalles», para que la página muestre primero lo esencial.
 */
export function Disclosure({ summary, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn('group rounded-xl border border-zinc-800/80 bg-zinc-950/30', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[12.5px] text-zinc-400 transition-colors select-none hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-500 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{summary}</span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-zinc-800/80 px-4 py-3 text-[12.5px] leading-relaxed text-pretty text-zinc-500">{children}</div>
    </details>
  );
}
