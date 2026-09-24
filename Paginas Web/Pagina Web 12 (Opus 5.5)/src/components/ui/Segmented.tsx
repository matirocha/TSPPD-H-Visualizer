import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { spring } from '../../lib/motion';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Texto accesible si `label` no es texto. */
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  /** Clases extra para la píldora activa (p. ej. color del modelo). */
  activeClassName?: string;
}

export interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  ariaLabel: string;
}

const SIZE = {
  xs: 'h-6 px-2 text-[11px]',
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-[13px]',
};

/** Control segmentado con píldora activa animada por resorte (layoutId compartido). */
export function Segmented<T extends string | number>({ options, value, onChange, size = 'sm', className, ariaLabel }: SegmentedProps<T>) {
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const hasActive = options.some((o) => o.value === value && !o.disabled);

  // Patrón radio group: flechas mueven y seleccionan, Tab entra/sale del grupo.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const enabled = options.filter((o) => !o.disabled);
    if (!enabled.length) return;
    e.preventDefault();
    e.stopPropagation();
    const cur = Math.max(0, enabled.findIndex((o) => o.value === value));
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? enabled.length - 1
          : (cur + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
    const target = enabled[next];
    onChange(target.value);
    const idx = options.indexOf(target);
    requestAnimationFrame(() => groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[idx]?.focus());
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('inline-flex items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-0.5', className)}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        const tabbable = active || (!hasActive && i === options.findIndex((o) => !o.disabled));
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            title={opt.title}
            disabled={opt.disabled}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap transition-colors duration-150',
              'disabled:opacity-35 disabled:pointer-events-none',
              SIZE[size],
              active ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className={cn('absolute inset-0 rounded-[10px] bg-zinc-100 shadow-sm', opt.activeClassName)}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
