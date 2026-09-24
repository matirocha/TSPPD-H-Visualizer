import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, useReducedMotionConfig, useSpring, useTransform } from 'motion/react';
import { cn } from '../../lib/cn';

/** Resorte críticamente amortiguado: las cifras no "rebotan" por sobre su valor final. */
const NUMBER_SPRING = { stiffness: 300, damping: 35, mass: 1 };
const BAR_SPRING = { stiffness: 320, damping: 34, mass: 1 };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  /** Valor inicial del primer montaje (p. ej. 0 para contar hacia arriba). */
  from?: number;
  className?: string;
}

/**
 * Cifra que interpola con resorte hacia su nuevo valor. El texto se escribe
 * directamente en el DOM desde el MotionValue: no provoca renders de React
 * aunque el valor cambie a 60 fps.
 */
export function AnimatedNumber({ value, format, from, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionConfig();
  const mv = useSpring(reduced ? value : (from ?? value), NUMBER_SPRING);
  const formatRef = useRef(format);

  // Mantiene el formateador al día y re-pinta si cambió (p. ej. decimales según el modo).
  useLayoutEffect(() => {
    formatRef.current = format;
    if (ref.current) ref.current.textContent = format(mv.get());
  });

  useEffect(
    () =>
      mv.on('change', (v) => {
        if (ref.current) ref.current.textContent = formatRef.current(v);
      }),
    [mv],
  );

  useEffect(() => {
    if (reduced) mv.jump(value);
    else mv.set(value);
  }, [mv, value, reduced]);

  return <span ref={ref} className={cn('num', className)} />;
}

export interface SpringBarProps {
  /** Proporción 0–1. */
  value: number;
  className?: string;
  barClassName?: string;
}

/** Barra de progreso delgada cuyo relleno sigue al valor con un resorte. */
export function SpringBar({ value, className, barClassName }: SpringBarProps) {
  const reduced = useReducedMotionConfig();
  const v = clamp01(value);
  const mv = useSpring(v, BAR_SPRING);
  const width = useTransform(mv, (x) => `${clamp01(x) * 100}%`);

  useEffect(() => {
    if (reduced) mv.jump(v);
    else mv.set(v);
  }, [mv, v, reduced]);

  return (
    <span aria-hidden className={cn('relative block overflow-hidden rounded-full bg-zinc-800/90', className)}>
      <motion.span className={cn('absolute inset-y-0 left-0 rounded-full bg-zinc-200', barClassName)} style={{ width }} />
    </span>
  );
}
