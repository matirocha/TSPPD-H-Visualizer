/**
 * Coordinación de capas superpuestas (diálogos y paneles a pantalla completa).
 *
 * - lockScroll(): bloqueo del scroll del <body> con contador. Varias capas pueden
 *   abrirse y cerrarse en cualquier orden (incluso durante animaciones de salida)
 *   sin dejar la página bloqueada ni desbloquearla antes de tiempo.
 * - pushLayer(): pila de capas; solo la superior debe atender Esc / Tab.
 */
let locks = 0;
let saved = '';

export function lockScroll(): () => void {
  if (locks === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = saved;
  };
}

const layers: symbol[] = [];

export function pushLayer(): { isTop: () => boolean; pop: () => void } {
  const id = Symbol('layer');
  layers.push(id);
  return {
    isTop: () => layers[layers.length - 1] === id,
    pop: () => {
      const i = layers.indexOf(id);
      if (i >= 0) layers.splice(i, 1);
    },
  };
}

/** ¿Hay alguna capa modal abierta? (los atajos globales se suspenden) */
export const hasLayers = () => layers.length > 0;
