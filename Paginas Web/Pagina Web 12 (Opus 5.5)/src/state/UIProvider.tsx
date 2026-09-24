/**
 * Estado de interfaz compartido entre componentes que no se conocen entre sí:
 * - Hover cruzado: pasar sobre un nodo del mapa resalta sus unidades en el camión y viceversa.
 * - Diálogos globales (catálogo, paleta de comandos, atajos) y nodo inspeccionado.
 * - Panel en foco (mapa o compartimiento en pantalla completa) y disposición del mapa.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MapLayoutMode } from '../lib/layout';
import { useSim } from './SimulationProvider';

export type FocusPanel = 'map' | 'bay' | null;

interface HoverValue {
  hoverNode: number | null;
  hoverUnit: string | null;
  setHoverNode: (id: number | null) => void;
  setHoverUnit: (id: string | null) => void;
}

interface UIValue {
  explorerOpen: boolean;
  setExplorerOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  /** Nodo cuyo detalle está abierto (popover del mapa). */
  inspectedNode: number | null;
  inspectNode: (id: number | null) => void;
  focusPanel: FocusPanel;
  setFocusPanel: (p: FocusPanel) => void;
  mapLayout: MapLayoutMode;
  setMapLayout: (m: MapLayoutMode) => void;
}

const HoverContext = createContext<HoverValue | null>(null);
const UIContext = createContext<UIValue | null>(null);

export function useHover(): HoverValue {
  const v = useContext(HoverContext);
  if (!v) throw new Error('useHover debe usarse dentro de <UIProvider>');
  return v;
}

export function useUI(): UIValue {
  const v = useContext(UIContext);
  if (!v) throw new Error('useUI debe usarse dentro de <UIProvider>');
  return v;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [hoverNode, setHoverNode] = useState<number | null>(null);
  const [hoverUnit, setHoverUnit] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [inspectedNode, inspectNode] = useState<number | null>(null);
  const [focusPanel, setFocusPanel] = useState<FocusPanel>(null);
  const [mapLayout, setMapLayout] = useState<MapLayoutMode>('geo');

  // Las fuentes de hover (títulos de parada, secuencias, nodos del mapa) pueden
  // desmontarse sin disparar mouseleave: se limpia el resaltado cuando cambia el
  // contexto que lo justificaba. La ficha de nodo se cierra al cambiar de solución.
  const { mode, stepIndex, selectedFilename } = useSim();
  useEffect(() => {
    setHoverNode(null);
    setHoverUnit(null);
  }, [mode, stepIndex, selectedFilename, focusPanel]);
  useEffect(() => {
    inspectNode(null);
  }, [selectedFilename]);

  const hover = useMemo(() => ({ hoverNode, hoverUnit, setHoverNode, setHoverUnit }), [hoverNode, hoverUnit]);
  const ui = useMemo(
    () => ({
      explorerOpen,
      setExplorerOpen,
      paletteOpen,
      setPaletteOpen,
      shortcutsOpen,
      setShortcutsOpen,
      inspectedNode,
      inspectNode,
      focusPanel,
      setFocusPanel,
      mapLayout,
      setMapLayout,
    }),
    [explorerOpen, paletteOpen, shortcutsOpen, inspectedNode, focusPanel, mapLayout],
  );

  return (
    <UIContext.Provider value={ui}>
      <HoverContext.Provider value={hover}>{children}</HoverContext.Provider>
    </UIContext.Provider>
  );
}
