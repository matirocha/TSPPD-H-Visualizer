import { useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Command, Compass, Info, PanelsTopLeft, Play, type LucideIcon } from 'lucide-react';
import { useUI } from '../state/UIProvider';
import { SHORTCUTS, type ShortcutDef } from '../hooks/useKeyboardShortcuts';
import { Button, Dialog, Kbd } from './ui';
import { KeyCombo, IS_MAC } from './dialogs/KeyCombo';
import { staggerChild, staggerParent } from '../lib/motion';

type Group = ShortcutDef['group'];

const GROUP_META: Record<Group, { icon: LucideIcon; blurb: string }> = {
  Reproducción: { icon: Play, blurb: 'Avanza el camión, recorre las fases de cada parada y ajusta el ritmo.' },
  Navegación: { icon: Compass, blurb: 'Cambia de modelo o busca cualquier solución.' },
  Vista: { icon: PanelsTopLeft, blurb: 'Instrumentos a pantalla completa y ayuda.' },
};

function ShortcutGroup({ group, items, delay = 0 }: { group: Group; items: ShortcutDef[]; delay?: number }) {
  const { icon: Icon, blurb } = GROUP_META[group];
  const variants = useMemo(
    () => ({ hidden: staggerParent.hidden, show: { transition: { staggerChildren: 0.045, delayChildren: 0.06 + delay } } }),
    [delay],
  );
  return (
    <section aria-labelledby={`atajos-${group}`} className="min-w-0">
      <header className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-300">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 id={`atajos-${group}`} className="flex items-baseline gap-2 text-sm font-semibold tracking-tight text-zinc-50">
            {group}
            <span className="num text-[11px] font-normal text-zinc-500">{String(items.length).padStart(2, '0')}</span>
          </h3>
          <p className="mt-0.5 text-[12px] leading-snug text-zinc-500 text-pretty">{blurb}</p>
        </div>
      </header>
      <motion.ul
        variants={variants}
        initial="hidden"
        animate="show"
        className="mt-3 divide-y divide-zinc-800/60 rounded-xl border border-zinc-800/80 bg-zinc-950/40"
      >
        {items.map((s) => (
          <motion.li
            key={s.label}
            variants={staggerChild}
            className="flex items-center justify-between gap-4 px-3 py-2.5 transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-800/40"
          >
            <span className="min-w-0 text-[13px] leading-snug text-zinc-300">{s.label}</span>
            <KeyCombo keys={s.keys} />
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

/** Referencia de atajos de teclado (se abre con «?»). */
export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen, setPaletteOpen } = useUI();
  const close = useCallback(() => setShortcutsOpen(false), [setShortcutsOpen]);

  const groups = useMemo(() => {
    const by = (g: Group) => SHORTCUTS.filter((s) => s.group === g);
    return { play: by('Reproducción'), nav: by('Navegación'), view: by('Vista') };
  }, []);

  const openPalette = () => {
    setShortcutsOpen(false);
    window.setTimeout(() => setPaletteOpen(true), 40);
  };

  return (
    <Dialog
      open={shortcutsOpen}
      onClose={close}
      size="md"
      title="Atajos de teclado"
      description="Controla la simulación sin soltar el teclado."
      bodyClassName="p-5 sm:p-6"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex max-w-[44ch] items-start gap-2 text-[12px] leading-snug text-zinc-400 text-pretty">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            <span>
              Se desactivan mientras escribes en un campo de texto. <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd> <Kbd>K</Kbd> funciona siempre.
            </span>
          </p>
          <Button variant="secondary" size="sm" onClick={openPalette}>
            <Command className="h-3.5 w-3.5" aria-hidden />
            Paleta de comandos
          </Button>
        </div>
      }
    >
      <div data-autofocus tabIndex={-1} className="grid grid-cols-1 gap-7 outline-none sm:grid-cols-[1fr_1.08fr] sm:gap-6 focus-visible:outline-none">
        <ShortcutGroup group="Reproducción" items={groups.play} />
        <div className="flex min-w-0 flex-col gap-7">
          <ShortcutGroup group="Navegación" items={groups.nav} delay={0.12} />
          <ShortcutGroup group="Vista" items={groups.view} delay={0.22} />
        </div>
      </div>
    </Dialog>
  );
}
