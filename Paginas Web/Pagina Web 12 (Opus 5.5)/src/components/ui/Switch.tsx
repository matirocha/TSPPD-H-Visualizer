import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { springSnappy } from '../../lib/motion';

export interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  /** Muestra el texto de la etiqueta junto al interruptor. */
  showLabel?: boolean;
  className?: string;
  title?: string;
}

export function Switch({ checked, onChange, label, showLabel = true, className, title }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn('group inline-flex items-center gap-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-zinc-50', className)}
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200',
          checked ? 'border-zinc-100 bg-zinc-100' : 'border-zinc-700 bg-zinc-800',
        )}
      >
        <motion.span
          layout
          transition={springSnappy}
          className={cn('h-3.5 w-3.5 rounded-full shadow-sm', checked ? 'ml-[18px] bg-zinc-950' : 'ml-[3px] bg-zinc-400')}
        />
      </span>
      {showLabel && <span>{label}</span>}
    </button>
  );
}
