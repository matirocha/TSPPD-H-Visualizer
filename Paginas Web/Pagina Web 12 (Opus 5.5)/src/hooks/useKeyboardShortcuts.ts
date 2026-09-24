import { useEffect } from 'react';
import { useSim } from '../state/SimulationProvider';
import { useUI } from '../state/UIProvider';
import { MODELS } from '../lib/models';
import type { AnimationSpeed } from '../types/solution';

const SPEEDS: AnimationSpeed[] = [0.5, 1, 1.5, 2];

export interface ShortcutDef {
  keys: string[];
  label: string;
  group: 'Reproducción' | 'Navegación' | 'Vista';
}

export const SHORTCUTS: ShortcutDef[] = [
  { keys: ['Espacio'], label: 'Reproducir / pausar', group: 'Reproducción' },
  { keys: ['→'], label: 'Siguiente sub-paso', group: 'Reproducción' },
  { keys: ['←'], label: 'Sub-paso anterior', group: 'Reproducción' },
  { keys: ['Shift', '→'], label: 'Siguiente parada', group: 'Reproducción' },
  { keys: ['Shift', '←'], label: 'Parada anterior', group: 'Reproducción' },
  { keys: ['R'], label: 'Reiniciar tour', group: 'Reproducción' },
  { keys: ['C'], label: 'Modo continuo on/off', group: 'Reproducción' },
  { keys: ['[', ']'], label: 'Bajar / subir velocidad', group: 'Reproducción' },
  { keys: ['1', '2', '3', '4'], label: 'General · Política 1 · 2 · 3', group: 'Navegación' },
  { keys: ['Ctrl', 'K'], label: 'Paleta de comandos', group: 'Navegación' },
  { keys: ['E'], label: 'Catálogo de soluciones', group: 'Navegación' },
  { keys: ['M'], label: 'Mapa en pantalla completa', group: 'Vista' },
  { keys: ['B'], label: 'Compartimiento en pantalla completa', group: 'Vista' },
  { keys: ['G'], label: 'Mapa geométrico / circular', group: 'Vista' },
  { keys: ['?'], label: 'Mostrar atajos', group: 'Vista' },
  { keys: ['Esc'], label: 'Cerrar diálogo o pantalla completa', group: 'Vista' },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function isInteractive(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest('button, a, [role="slider"], [role="switch"], [role="tab"], [role="option"], summary');
}

export function useKeyboardShortcuts() {
  const { actions, speed, continuous } = useSim();
  const ui = useUI();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Nunca se apilan diálogos: la paleta reemplaza al catálogo o a los atajos.
        if (!ui.paletteOpen) {
          ui.setExplorerOpen(false);
          ui.setShortcutsOpen(false);
        }
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const dialogOpen = ui.explorerOpen || ui.paletteOpen || ui.shortcutsOpen || document.querySelector('[role="dialog"]');

      if (e.key === 'Escape') {
        // Primero lo visible: con el compartimiento a pantalla completa la ficha del
        // mapa queda oculta, así que Esc cierra la pantalla completa.
        if (ui.focusPanel === 'bay') ui.setFocusPanel(null);
        else if (ui.inspectedNode !== null) ui.inspectNode(null);
        else if (ui.focusPanel) ui.setFocusPanel(null);
        return;
      }
      if (dialogOpen) return;

      const ownsArrows = (t: EventTarget | null) =>
        isInteractive(t) && !!(t as HTMLElement).closest('[role="slider"],[role="tab"],[role="radio"],[role="option"]');

      switch (e.key) {
        case ' ':
          if (isInteractive(e.target)) return;
          e.preventDefault();
          actions.toggle();
          break;
        case 'ArrowRight':
          if (ownsArrows(e.target)) return;
          e.preventDefault();
          if (e.shiftKey) actions.nextStop();
          else actions.nextSubStep();
          break;
        case 'ArrowLeft':
          if (ownsArrows(e.target)) return;
          e.preventDefault();
          if (e.shiftKey) actions.prevStop();
          else actions.prevSubStep();
          break;
        case 'r':
        case 'R':
          actions.reset();
          break;
        case 'c':
        case 'C':
          actions.setContinuous(!continuous);
          break;
        case '[':
          actions.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)]);
          break;
        case ']':
          actions.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)]);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          actions.selectModel(MODELS[Number(e.key) - 1].id);
          break;
        case 'e':
        case 'E':
          ui.setExplorerOpen(true);
          break;
        case 'm':
        case 'M':
          ui.setFocusPanel(ui.focusPanel === 'map' ? null : 'map');
          break;
        case 'b':
        case 'B':
          ui.setFocusPanel(ui.focusPanel === 'bay' ? null : 'bay');
          break;
        case 'g':
        case 'G':
          ui.setMapLayout(ui.mapLayout === 'geo' ? 'ring' : 'geo');
          break;
        case '?':
          ui.setShortcutsOpen(true);
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, speed, continuous, ui]);
}
