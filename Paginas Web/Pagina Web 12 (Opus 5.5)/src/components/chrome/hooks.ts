import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { scrollBehavior } from '../../lib/motion';

/** Suscripción a una media query (sin parpadeo: se evalúa en el primer render). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Sección visible bajo la barra superior. Recalcula con requestAnimationFrame en
 * scroll/resize; `revision` fuerza un recálculo cuando las secciones se montan.
 */
export function useActiveSection(ids: readonly string[], revision: unknown, offset = 112): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const present = ids.filter((id) => document.getElementById(id));
      if (!present.length) {
        setActive(null);
        return;
      }
      let current = present[0];
      // Activa la sección cuyo inicio ya cruzó el ~35 % superior de la ventana
      // (cada sección tiene 96 px de aire antes de su encabezado).
      const threshold = Math.max(offset, window.innerHeight * 0.35);
      for (const id of present) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - threshold <= 0) current = id;
      }
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = present[present.length - 1];
      setActive(current);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ids, revision, offset]);

  return active;
}

/** Desplazamiento suave a una sección (nunca con href="#…": el hash guarda la solución). */
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}
