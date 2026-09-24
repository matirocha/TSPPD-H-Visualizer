import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ChipTone =
  | 'neutral'
  | 'muted'
  | 'alpha'
  | 'beta'
  | 'handling'
  | 'ok'
  | 'general'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'solid';

const TONE: Record<ChipTone, string> = {
  neutral: 'text-zinc-200 bg-zinc-800/80 border-zinc-700/70',
  muted: 'text-zinc-400 bg-zinc-900/80 border-zinc-800',
  alpha: 'text-alpha bg-alpha/12 border-alpha/35',
  beta: 'text-beta bg-beta/12 border-beta/35',
  handling: 'text-handling bg-handling/12 border-handling/35',
  ok: 'text-ok bg-ok/12 border-ok/35',
  general: 'text-zinc-100 bg-zinc-100/10 border-zinc-100/25',
  p1: 'text-p1 bg-p1/12 border-p1/35',
  p2: 'text-p2 bg-p2/12 border-p2/35',
  p3: 'tone-p3',
  solid: 'text-zinc-950 bg-zinc-100 border-zinc-100',
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  size?: 'xs' | 'sm';
  mono?: boolean;
}

/** Etiqueta compacta (badge) con tonos semánticos del sistema. */
export function Chip({ tone = 'neutral', size = 'xs', mono = true, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border font-medium whitespace-nowrap',
        size === 'xs' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs',
        mono && 'font-mono tracking-tight',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
