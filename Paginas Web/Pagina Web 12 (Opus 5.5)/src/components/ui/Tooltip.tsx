import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  align?: 'center' | 'start' | 'end';
  className?: string;
}

/**
 * Tooltip ligero solo con CSS: aparece al hacer hover o al enfocar con teclado
 * cualquier elemento interior. Para contenido rico usar un popover.
 */
export function Tooltip({ content, children, side = 'top', align = 'center', className }: TooltipProps) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-[260px] rounded-xl border border-zinc-700/80 bg-zinc-900/95 px-2.5 py-1.5',
          'text-[11.5px] leading-snug text-zinc-200 shadow-xl shadow-black/40 backdrop-blur-md',
          'opacity-0 transition-all duration-150 ease-out',
          'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0' : 'top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'start' && 'left-0',
          align === 'end' && 'right-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}
