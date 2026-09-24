import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../../lib/cn';
import { hoverLift, springSnappy, tapPress } from '../../lib/motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'icon' | 'icon-sm';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-[0_1px_0_0_rgb(255_255_255/0.4)_inset,0_8px_24px_-12px_rgb(255_255_255/0.35)]',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700/90 border border-zinc-700/60',
  ghost: 'bg-transparent text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/70',
  outline: 'bg-zinc-950/40 text-zinc-200 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-50',
  danger: 'bg-handling/15 text-handling border border-handling/40 hover:bg-handling/25',
};

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-xl',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-xl',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
  /** Sin elevación en hover (para controles densos). */
  flat?: boolean;
}

/** Botón shadcn con física de resorte: elevación en hover y compresión al pulsar. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', flat, className, disabled, children, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileHover={disabled || flat ? undefined : hoverLift}
      whileTap={disabled ? undefined : tapPress}
      transition={springSnappy}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
