import type { Transition } from 'motion/react';

/** Resortes del sistema (stiffness 300–400, damping 25–35). */
export const spring: Transition = { type: 'spring', stiffness: 360, damping: 30, mass: 0.9 };
export const springSoft: Transition = { type: 'spring', stiffness: 300, damping: 34 };
export const springSnappy: Transition = { type: 'spring', stiffness: 400, damping: 28 };
/** Para unidades que viajan entre slot / andén / cliente. */
export const springCargo: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 1 };

/** Micro-interacciones táctiles estándar. */
export const hoverLift = { y: -2, scale: 1.01 };
export const tapPress = { scale: 0.97 };

/**
 * Comportamiento de scroll programático que respeta prefers-reduced-motion
 * (un `behavior: 'smooth'` explícito ignora la regla CSS scroll-behavior).
 */
export const scrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Aparición escalonada. */
export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
export const staggerChild = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springSoft },
};
