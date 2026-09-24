import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/80 px-1.5',
        'font-mono text-[10.5px] font-medium text-zinc-300 shadow-[inset_0_-1px_0_0_rgb(0_0_0/0.4)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
