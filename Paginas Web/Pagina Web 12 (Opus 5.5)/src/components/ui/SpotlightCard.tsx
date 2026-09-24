import { forwardRef, useCallback, type HTMLAttributes, type MouseEvent } from 'react';
import { cn } from '../../lib/cn';

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Desactiva el resplandor (p. ej. superficies muy grandes). */
  plain?: boolean;
}

/**
 * Tarjeta shadcn (zinc-900/60, borde zinc-800, rounded-2xl) con resplandor radial
 * que sigue al puntero y un borde iluminado (patrón Spotlight de 21st.dev).
 * El efecto se aplica con variables CSS: no provoca renders de React.
 */
export const SpotlightCard = forwardRef<HTMLDivElement, SpotlightCardProps>(function SpotlightCard(
  { className, plain, onMouseMove, onMouseLeave, children, ...rest },
  ref,
) {
  const handleMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
      el.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
      el.style.setProperty('--spot-o', '1');
      onMouseMove?.(e);
    },
    [onMouseMove],
  );
  const handleLeave = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.setProperty('--spot-o', '0');
      onMouseLeave?.(e);
    },
    [onMouseLeave],
  );
  return (
    <div
      ref={ref}
      className={cn('surface', !plain && 'spotlight', className)}
      onMouseMove={plain ? onMouseMove : handleMove}
      onMouseLeave={plain ? onMouseLeave : handleLeave}
      {...rest}
    >
      {children}
    </div>
  );
});
