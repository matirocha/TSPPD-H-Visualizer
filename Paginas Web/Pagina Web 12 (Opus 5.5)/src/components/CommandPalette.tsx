import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import {
  ChartColumn,
  CircleDashed,
  Compass,
  CornerDownLeft,
  Gauge,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Package,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  ScrollText,
  Search,
  SearchX,
  Sigma,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Table2,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useSim } from '../state/SimulationProvider';
import { useUI } from '../state/UIProvider';
import { MODELS, TONE_CHIP, modelMeta, type ModelTone } from '../lib/models';
import { fmt, fmtAuto } from '../lib/format';
import { cn } from '../lib/cn';
import { springSnappy, scrollBehavior } from '../lib/motion';
import type { AnimationSpeed, ModelType, SolutionMeta } from '../types/solution';
import { Chip, Dialog, Kbd, type ChipTone } from './ui';
import { KeyCombo } from './dialogs/KeyCombo';

/* ───────────────────────── Modelo de comandos ───────────────────────── */

type GroupId = 'sol' | 'act' | 'nav';

interface Cmd {
  id: string;
  group: GroupId;
  label: string;
  /** label + palabras clave, normalizado (minúsculas, sin tildes). */
  hay: string;
  icon?: LucideIcon;
  chip?: { tone: ModelTone; text: string };
  hint?: string;
  keys?: string[];
  badge?: { text: string; tone: ChipTone };
  sol?: SolutionMeta;
  run: () => void;
}

const LIMIT = 50;
const SOLUTION_CAP = 36;
const SPEEDS: AnimationSpeed[] = [0.5, 1, 1.5, 2];

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const MODEL_KEYWORDS: Record<ModelType, string> = {
  'TSPPD-H': 'general gen tsppd-h modelo general posiciones libres',
  'TSPPD-H_1': 'p1 h1 pol1 pol 1 politica 1 tsppd-h1 compuerta trasera',
  'TSPPD-H_2': 'p2 h2 pol2 pol 2 politica 2 tsppd-h2 fondo cabina',
  'TSPPD-H_3': 'p3 h3 pol3 pol 3 politica 3 tsppd-h3 hibrida mixta',
};

const SECTIONS: { id: string; label: string; index: string; icon: LucideIcon; keywords: string }[] = [
  { id: 'simulador', label: 'Simulador', index: '01', icon: Truck, keywords: 'inicio arriba mapa ruta camion compartimiento simulacion' },
  { id: 'bitacora', label: 'Bitácora', index: '02', icon: ScrollText, keywords: 'registro log tramos pasos tabla historial' },
  { id: 'comparativa', label: 'Comparativa', index: '03', icon: ChartColumn, keywords: 'comparar modelos politicas grafico costos' },
  { id: 'modelo', label: 'Modelo matemático', index: '04', icon: Sigma, keywords: 'formulacion ecuaciones restricciones funcion objetivo latex' },
  { id: 'datos', label: 'Datos de la instancia', index: '05', icon: Table2, keywords: 'nodos demanda matriz distancias c_ij capacidad' },
];

const GROUP_TITLE: Record<GroupId, string> = { sol: 'Soluciones', act: 'Acciones', nav: 'Ir a sección' };

/** Números del query que coinciden exactamente con clientes / ID suben primero ("10 7" → 10 clientes, ID 7). */
function solutionScore(s: SolutionMeta, nums: number[]): number {
  let score = 0;
  for (const t of nums) if (t === s.numCustomers || t === s.instanceId) score += 2;
  if (nums.length >= 2 && nums[0] === s.numCustomers && nums[1] === s.instanceId) score += 3;
  // Un número suelto se interpreta primero como cantidad de clientes ("10" → 10 clientes).
  if (nums.length === 1 && nums[0] === s.numCustomers) score += 1;
  return score;
}

/* ───────────────────────── Resaltado de coincidencias ───────────────────────── */

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const parts = useMemo(() => {
    if (!tokens.length) return [{ t: text, on: false }];
    // "p2" (forma corta) también resalta "Política 2" en la etiqueta.
    const needles = tokens.flatMap((t) => {
      const m = /^p([1-3])$/.exec(t);
      return m ? [t, `politica ${m[1]}`] : [t];
    });
    // Normaliza carácter a carácter para mapear índices normalizados → originales.
    let flat = '';
    const map: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const n = norm(text[i]);
      for (let k = 0; k < n.length; k++) {
        flat += n[k];
        map.push(i);
      }
    }
    const mask = new Array<boolean>(text.length).fill(false);
    for (const tok of needles) {
      let from = 0;
      for (;;) {
        const at = flat.indexOf(tok, from);
        if (at < 0) break;
        for (let j = at; j < at + tok.length; j++) mask[map[j]] = true;
        from = at + tok.length;
      }
    }
    const out: { t: string; on: boolean }[] = [];
    for (let i = 0; i < text.length; i++) {
      const last = out[out.length - 1];
      if (last && last.on === mask[i]) last.t += text[i];
      else out.push({ t: text[i], on: mask[i] });
    }
    return out;
  }, [text, tokens]);

  return (
    <>
      {parts.map((p, i) =>
        p.on ? (
          <mark key={i} className="rounded-[3px] bg-zinc-100/10 text-zinc-50 underline decoration-zinc-400/70 decoration-1 underline-offset-[3px]">
            {p.t}
          </mark>
        ) : (
          <Fragment key={i}>{p.t}</Fragment>
        ),
      )}
    </>
  );
}

/* ───────────────────────── Cuerpo (se monta al abrir) ───────────────────────── */

function PaletteBody({ onClose }: { onClose: () => void }) {
  const { solutions, selectedFilename, meta, siblings, activeModel, status, finished, continuous, speed, actions } = useSim();
  const { mapLayout, setMapLayout, focusPanel, setFocusPanel, setExplorerOpen, setShortcutsOpen } = useUI();

  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const keyboardNav = useRef(false);

  /* Comandos */
  const solutionCmds = useMemo<Cmd[]>(
    () =>
      solutions.map((s) => {
        const m = modelMeta(s.model);
        const label = `${m.label} · ${s.numCustomers} clientes · ID ${s.instanceId}`;
        const keywords = `${MODEL_KEYWORDS[s.model]} ${m.short} ${m.hashKey} ${s.numCustomers} clientes id ${s.instanceId} #${s.instanceId} instancia ${s.instanceId}`;
        return {
          id: `sol:${s.filename}`,
          group: 'sol',
          label,
          hay: norm(`${label} ${keywords}`),
          chip: { tone: m.tone, text: m.short },
          hint: `Z* ${fmt(s.objectiveValue)}`,
          badge: s.filename === selectedFilename ? { text: 'Activa', tone: 'solid' } : undefined,
          sol: s,
          run: () => actions.selectSolution(s.filename),
        } satisfies Cmd;
      }),
    [solutions, selectedFilename, actions],
  );

  const actionCmds = useMemo<Cmd[]>(() => {
    const make = (c: Omit<Cmd, 'group' | 'hay'> & { keywords?: string }): Cmd => ({
      ...c,
      group: 'act',
      hay: norm(`${c.label} ${c.keywords ?? ''}`),
    });
    const playing = status === 'playing';
    const list: Cmd[] = [
      make({
        id: 'toggle',
        label: playing ? 'Pausar' : finished ? 'Reproducir desde el inicio' : 'Reproducir',
        icon: playing ? Pause : Play,
        keys: ['Espacio'],
        keywords: 'reproducir pausar play pause iniciar detener animacion',
        run: actions.toggle,
      }),
      make({ id: 'reset', label: 'Reiniciar tour', icon: RotateCcw, keys: ['R'], keywords: 'reset reiniciar volver inicio deposito', run: actions.reset }),
      make({
        id: 'next-stop',
        label: 'Siguiente parada',
        icon: SkipForward,
        keys: ['Shift', '→'],
        keywords: 'adelante proxima parada nodo cliente saltar',
        run: actions.nextStop,
      }),
      make({ id: 'prev-stop', label: 'Parada anterior', icon: SkipBack, keys: ['Shift', '←'], keywords: 'atras volver parada nodo cliente', run: actions.prevStop }),
      make({
        id: 'next-sub',
        label: 'Siguiente fase de la parada',
        icon: StepForward,
        keys: ['→'],
        keywords: 'sub-paso subpaso fase adelante',
        run: actions.nextSubStep,
      }),
      make({ id: 'prev-sub', label: 'Fase anterior', icon: StepBack, keys: ['←'], keywords: 'sub-paso subpaso fase atras', run: actions.prevSubStep }),
      make({
        id: 'continuous',
        label: 'Modo continuo',
        icon: Repeat,
        keys: ['C'],
        badge: continuous ? { text: 'Activado', tone: 'ok' } : { text: 'Desactivado', tone: 'muted' },
        keywords: `automatico auto pausar en cada parada on off ${continuous ? 'desactivar apagar' : 'activar encender'}`,
        run: () => actions.setContinuous(!continuous),
      }),
      ...SPEEDS.map((s) =>
        make({
          id: `speed-${s}`,
          label: `Velocidad ${fmtAuto(s)}×`,
          icon: Gauge,
          badge: s === speed ? { text: 'Actual', tone: 'neutral' } : undefined,
          keywords: `velocidad speed ritmo rapido lento ${s} ${fmtAuto(s)} x${s}`,
          run: () => actions.setSpeed(s),
        }),
      ),
      ...MODELS.map((m, i) =>
        make({
          id: `model-${m.id}`,
          label: `Cambiar a ${m.label} (misma instancia)`,
          chip: { tone: m.tone, text: m.short },
          keys: [String(i + 1)],
          badge: m.id === activeModel ? { text: 'En pantalla', tone: 'neutral' } : undefined,
          keywords: `modelo cambiar ${MODEL_KEYWORDS[m.id]} ${m.equations}`,
          run: () => actions.selectModel(m.id),
        }),
      ),
      make({
        id: 'map-geo',
        label: 'Mapa geométrico (fiel a c_ij)',
        icon: Compass,
        keys: ['G'],
        badge: mapLayout === 'geo' ? { text: 'Actual', tone: 'neutral' } : undefined,
        keywords: 'mapa geometrico mds distancias reales disposicion layout',
        run: () => setMapLayout('geo'),
      }),
      make({
        id: 'map-ring',
        label: 'Mapa circular',
        icon: CircleDashed,
        keys: ['G'],
        badge: mapLayout === 'ring' ? { text: 'Actual', tone: 'neutral' } : undefined,
        keywords: 'mapa circular anillo ring disposicion layout',
        run: () => setMapLayout('ring'),
      }),
      make({
        id: 'focus-map',
        label: focusPanel === 'map' ? 'Salir de pantalla completa (mapa)' : 'Mapa en pantalla completa',
        icon: focusPanel === 'map' ? Minimize2 : Maximize2,
        keys: ['M'],
        keywords: 'mapa ruta pantalla completa fullscreen ampliar foco',
        run: () => setFocusPanel(focusPanel === 'map' ? null : 'map'),
      }),
      make({
        id: 'focus-bay',
        label: focusPanel === 'bay' ? 'Salir de pantalla completa (compartimiento)' : 'Compartimiento en pantalla completa',
        icon: focusPanel === 'bay' ? Minimize2 : Package,
        keys: ['B'],
        keywords: 'camion bahia carga lifo compartimiento pantalla completa fullscreen ampliar foco',
        run: () => setFocusPanel(focusPanel === 'bay' ? null : 'bay'),
      }),
      make({
        id: 'explorer',
        label: 'Abrir catálogo de soluciones',
        icon: LayoutGrid,
        keys: ['E'],
        keywords: 'explorador catalogo instancias soluciones elegir seleccionar',
        run: () => setExplorerOpen(true),
      }),
      make({
        id: 'shortcuts',
        label: 'Mostrar atajos de teclado',
        icon: Keyboard,
        keys: ['?'],
        keywords: 'ayuda atajos teclado shortcuts teclas',
        run: () => setShortcutsOpen(true),
      }),
      make({
        id: 'refresh',
        label: 'Recargar soluciones',
        icon: RefreshCw,
        hint: 'Outputs/',
        keywords: 'recargar actualizar refresh lista outputs solver',
        run: actions.refresh,
      }),
    ];
    return list;
  }, [status, finished, continuous, speed, activeModel, mapLayout, focusPanel, actions, setMapLayout, setFocusPanel, setExplorerOpen, setShortcutsOpen]);

  const sectionCmds = useMemo<Cmd[]>(
    () =>
      SECTIONS.map((s) => ({
        id: `nav:${s.id}`,
        group: 'nav',
        label: s.label,
        hay: norm(`${s.label} ${s.keywords} seccion ir a ${s.index}`),
        icon: s.icon,
        hint: `§ ${s.index}`,
        run: () => {
          setFocusPanel(null);
          document.getElementById(s.id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        },
      })),
    [setFocusPanel],
  );

  /* Filtrado y ranking */
  const { tokens, groups, flat, hidden } = useMemo(() => {
    // "política 2", "pol 2", "p 2" o "h2" se leen como el modelo P2 (y no como el número 2).
    const tokens = norm(query)
      .replace(/\b(?:politica|pol|p|h)\s*([1-3])\b/g, 'p$1')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    let groups: { id: GroupId; title: string; items: Cmd[] }[];
    let hidden = 0;

    if (!tokens.length) {
      const onScreen = new Set((siblings.length ? siblings : meta ? [meta] : []).map((s) => s.filename));
      groups = [
        { id: 'sol', title: 'Soluciones · instancia en pantalla', items: solutionCmds.filter((c) => c.sol && onScreen.has(c.sol.filename)) },
        { id: 'act', title: GROUP_TITLE.act, items: actionCmds },
        { id: 'nav', title: GROUP_TITLE.nav, items: sectionCmds },
      ];
    } else {
      const nums = tokens.filter((t) => /^\d+$/.test(t)).map(Number);
      const matches = (c: Cmd) => tokens.every((t) => c.hay.includes(t));
      const sol = solutionCmds
        .filter(matches)
        .map((c, i) => ({ c, i, score: solutionScore(c.sol!, nums) }))
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .map((x) => x.c);
      const act = actionCmds.filter(matches);
      const nav = sectionCmds.filter(matches);
      const room = Math.max(8, Math.min(SOLUTION_CAP, LIMIT - act.length - nav.length));
      hidden = Math.max(0, sol.length - room);
      const solGroup = { id: 'sol' as const, title: GROUP_TITLE.sol, items: sol.slice(0, room) };
      const actGroup = { id: 'act' as const, title: GROUP_TITLE.act, items: act };
      const navGroup = { id: 'nav' as const, title: GROUP_TITLE.nav, items: nav };
      // Con números en la búsqueda, lo más probable es que se busque una solución.
      groups = nums.length ? [solGroup, actGroup, navGroup] : [actGroup, navGroup, solGroup];
    }
    groups = groups.filter((g) => g.items.length > 0);
    return { tokens, groups, flat: groups.flatMap((g) => g.items), hidden };
  }, [query, solutionCmds, actionCmds, sectionCmds, siblings, meta]);

  const cur = flat.length ? Math.min(active, flat.length - 1) : -1;

  const execute = useCallback(
    (cmd: Cmd) => {
      onClose();
      // Tras cerrar (y devolver el foco) para que el desplazamiento o el siguiente diálogo no compitan con el cierre.
      window.setTimeout(cmd.run, 40);
    },
    [onClose],
  );

  // Mantener visible el elemento activo al navegar con teclado.
  useEffect(() => {
    if (!keyboardNav.current || cur < 0) return;
    keyboardNav.current = false;
    if (cur === 0) listRef.current?.scrollTo({ top: 0 });
    else document.getElementById(`${uid}-opt-${cur}`)?.scrollIntoView({ block: 'nearest' });
  }, [cur, uid]);

  const onQuery = (v: string) => {
    setQuery(v);
    setActive(0);
    listRef.current?.scrollTo({ top: 0 });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      keyboardNav.current = true;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((cur + d + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flat[cur];
      if (cmd) execute(cmd);
    }
  };

  let index = -1;

  return (
    <div className="flex min-h-0 flex-col">
      {/* Búsqueda */}
      <div className="flex items-center gap-3 border-b border-zinc-800/80 px-4 sm:px-5">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          data-autofocus
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={cur >= 0 ? optionId(cur) : undefined}
          aria-label="Buscar solución, acción o sección"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar solución, acción o sección… (ej. “p3 10 7”)"
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-zinc-50 placeholder:text-zinc-500 focus-visible:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="Borrar búsqueda"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar paleta"
          className="grid h-7 min-w-7 shrink-0 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 sm:rounded-xl sm:hover:bg-transparent"
        >
          <X className="h-4 w-4 sm:hidden" aria-hidden />
          <span className="hidden opacity-80 transition-opacity hover:opacity-100 sm:inline-flex">
            <Kbd>Esc</Kbd>
          </span>
        </button>
      </div>

      <span className="sr-only" aria-live="polite">
        {flat.length === 0 ? 'Sin resultados' : `${flat.length} resultados`}
      </span>

      {/* Resultados */}
      <motion.div
        layoutScroll
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Resultados"
        className="scrollbar-thin max-h-[50vh] overflow-y-auto overscroll-contain p-2"
      >
        {flat.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400">
              <SearchX className="h-4 w-4" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-200">Sin resultados para “{query.trim()}”</p>
            <p className="mt-1 max-w-[42ch] text-[13px] text-zinc-500 text-pretty">
              Prueba con modelo, clientes e ID —“p2 5 3”— o con una acción como “velocidad” o “bitácora”.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${uid}-g-${g.id}`} className="pb-1.5 last:pb-0">
              <div id={`${uid}-g-${g.id}`} className="eyebrow flex items-center justify-between px-2.5 pt-2.5 pb-1.5">
                <span>{g.title}</span>
                <span className="num text-zinc-500">{g.items.length + (g.id === 'sol' ? hidden : 0)}</span>
              </div>
              {g.items.map((cmd) => {
                index += 1;
                const i = index;
                const on = i === cur;
                const Icon = cmd.icon;
                return (
                  <div
                    key={cmd.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => {
                      if (i !== cur) setActive(i);
                    }}
                    onClick={() => execute(cmd)}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] transition-colors duration-100',
                      on ? 'text-zinc-50' : 'text-zinc-300',
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId={`${uid}-hl`}
                        transition={springSnappy}
                        aria-hidden
                        className="absolute inset-0 rounded-xl bg-zinc-800/70 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
                      />
                    )}
                    {cmd.chip ? (
                      <span
                        aria-hidden
                        className={cn(
                          'relative grid h-7 w-8 shrink-0 place-items-center rounded-md border font-mono text-[10.5px] font-semibold tracking-tight',
                          TONE_CHIP[cmd.chip.tone],
                        )}
                      >
                        {cmd.chip.text}
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className={cn(
                          'relative grid h-7 w-8 shrink-0 place-items-center rounded-md border transition-colors',
                          on ? 'border-zinc-600 bg-zinc-900 text-zinc-50' : 'border-zinc-800 bg-zinc-950/50 text-zinc-400',
                        )}
                      >
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <span className="relative min-w-0 flex-1 truncate">
                      <Highlight text={cmd.label} tokens={tokens} />
                    </span>
                    <span className="relative flex shrink-0 items-center gap-2">
                      {cmd.badge && <Chip tone={cmd.badge.tone}>{cmd.badge.text}</Chip>}
                      {cmd.hint && <span className="num hidden text-[11.5px] text-zinc-500 sm:inline">{cmd.hint}</span>}
                      {cmd.keys && <KeyCombo keys={cmd.keys} className="hidden sm:inline-flex" />}
                      <CornerDownLeft
                        aria-hidden
                        className={cn('h-3.5 w-3.5 transition-opacity duration-150', on ? 'text-zinc-400 opacity-100' : 'opacity-0')}
                      />
                    </span>
                  </div>
                );
              })}
              {g.id === 'sol' && hidden > 0 && (
                <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] text-zinc-500">
                  +{hidden} más · añade clientes o ID para acotar (ej. “10 7”)
                </p>
              )}
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}

function PaletteFooter() {
  return (
    <div className="flex items-center justify-between gap-3 text-[11.5px] text-zinc-500">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navegar
        </span>
        <span aria-hidden className="text-zinc-700">
          ·
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Enter</Kbd>
          ejecutar
        </span>
        <span aria-hidden className="text-zinc-700">
          ·
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          cerrar
        </span>
      </div>
      <span className="hidden items-center gap-1.5 sm:flex">
        <KeyCombo keys={['Ctrl', 'K']} />
        abrir / cerrar
      </span>
    </div>
  );
}

/** Paleta de comandos (Ctrl + K): soluciones, acciones de reproducción y navegación por secciones. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUI();
  const close = useCallback(() => setPaletteOpen(false), [setPaletteOpen]);

  return (
    <Dialog
      open={paletteOpen}
      onClose={close}
      placement="top"
      size="md"
      title="Paleta de comandos"
      hideClose
      className="[&>header]:sr-only"
      bodyClassName="p-0"
      footer={<PaletteFooter />}
    >
      <PaletteBody onClose={close} />
    </Dialog>
  );
}
