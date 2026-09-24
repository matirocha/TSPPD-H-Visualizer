/**
 * Piezas visuales del compartimiento: compuerta, cabina, regla de slots, leyenda,
 * celdas de slot y fichas (andén / cliente). Cada unidad es un objeto `layoutId`
 * con identidad estable: al cambiar de contenedor vuela con un resorte.
 */
import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, DoorClosed, DoorOpen } from 'lucide-react';
import type { UnitMotion, UnitType } from '../../lib/choreography';
import { cn } from '../../lib/cn';
import { springCargo, springSnappy } from '../../lib/motion';
import { HANDLING_HEX, UNIT_HEX, UNIT_RGB, rulerMarks } from './model';

// ───────────────────────────────────────────── texturas

/** Rayado oscuro (legible sobre naranjo/cian) para unidades manipuladas. */
export const DARK_HATCH = 'repeating-linear-gradient(-45deg, rgb(9 9 11 / 0.34) 0 2px, transparent 2px 5px)';
const TOP_LIGHT = 'linear-gradient(180deg, rgb(255 255 255 / 0.30), rgb(255 255 255 / 0) 42%)';
/** Listones tenues: se lee como un pallet / caja apilada. */
const SLATS =
  'linear-gradient(180deg, transparent 31%, rgb(0 0 0 / 0.07) 31%, rgb(0 0 0 / 0.07) 33.5%, transparent 33.5%, transparent 64%, rgb(0 0 0 / 0.07) 64%, rgb(0 0 0 / 0.07) 66.5%, transparent 66.5%)';

export const SLOT_GAP = 2;

// ───────────────────────────────────────────── número con giro vertical

export function Rolling({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn('relative inline-flex overflow-hidden tabular-nums', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '80%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-80%', opacity: 0 }}
          transition={springSnappy}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ───────────────────────────────────────────── compuerta y cabina

export function DoorBlock({ open, height, big }: { open: boolean; height: number; big: boolean }) {
  const Icon = open ? DoorOpen : DoorClosed;
  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border text-center transition-colors duration-300',
        big ? 'w-[76px]' : 'w-[54px]',
        open ? 'border-zinc-500/80 bg-zinc-800/70 text-zinc-50' : 'border-zinc-700/80 bg-zinc-900/70 text-zinc-400',
      )}
      style={{ height }}
      aria-label={`Compuerta trasera (slot 1), ${open ? 'abierta' : 'cerrada'}`}
      role="img"
    >
      <Icon className={big ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={1.75} aria-hidden />
      <span className={cn('font-medium leading-none tracking-tight', big ? 'text-[11px]' : 'text-[9.5px]')}>Compuerta</span>
      <span className={cn('num leading-none text-zinc-500', big ? 'text-[10px]' : 'text-[9px]')}>slot 1</span>
      {/* Junta luminosa: la puerta está abierta durante las operaciones de la parada */}
      <motion.span
        aria-hidden
        className="absolute top-2 bottom-2 -right-[5px] w-[2px] rounded-full bg-zinc-50"
        initial={false}
        animate={{ opacity: open ? 1 : 0, scaleY: open ? 1 : 0.4 }}
        transition={springSnappy}
        style={{ boxShadow: '0 0 10px 1px rgb(250 250 250 / 0.55)' }}
      />
    </div>
  );
}

/** Silueta de cabina (el camión avanza hacia la derecha; la compuerta queda atrás). */
export function CabBlock({ height, capacity, maxWidth }: { height: number; capacity: number; maxWidth: number }) {
  const width = Math.min(maxWidth, Math.round(height * (76 / 74)));
  return (
    <div className="relative shrink-0" style={{ width, height }} role="img" aria-label={`Cabina (slot ${capacity}, fondo del compartimiento)`}>
      <svg
        viewBox="0 0 76 74"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <rect x="0" y="45" width="8" height="5" rx="1.2" fill="#3f3f46" />
        <path
          d="M6 12 Q6 7 11 7 H44 Q50 7 54 12 L66 29 Q68 32 71 33 Q74 34.5 74 39 V56 Q74 60 70 60 H11 Q6 60 6 55 Z"
          fill="#27272a"
          stroke="#52525b"
          strokeWidth="1"
        />
        <path d="M11 7.6 H44 Q49.5 7.6 53.2 12.2" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="1" />
        <path
          d="M46 12 H51 Q53 12 54.5 14.5 L62 26 Q63 28.5 60 28.5 H46 Q44 28.5 44 26.5 V14 Q44 12 46 12 Z"
          fill="rgb(255 255 255 / 0.07)"
          stroke="#71717a"
          strokeWidth="0.8"
        />
        <path d="M48 14.5 L52 14.5 L57 24" fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M41 31 V57" stroke="#3f3f46" strokeWidth="1" />
        <rect x="35.5" y="36" width="4" height="1.6" rx="0.8" fill="#71717a" />
        <rect x="70.6" y="40" width="3" height="5" rx="1" fill="rgb(250 250 250 / 0.75)" />
        <rect x="64" y="56.5" width="11" height="4" rx="1.5" fill="#3f3f46" />
        <circle cx="54" cy="62" r="8.5" fill="#09090b" stroke="#52525b" strokeWidth="1.2" />
        <circle cx="54" cy="62" r="3.2" fill="#3f3f46" />
        <text x="10" y="23" fontSize="8.5" fontWeight={500} fill="#d4d4d8" className="font-sans">
          Cabina
        </text>
        <text x="10" y="33" fontSize="7" fill="#71717a" className="font-mono">
          slot {capacity}
        </text>
      </svg>
    </div>
  );
}

// ───────────────────────────────────────────── regla

export function SlotRuler({ capacity, slotW, inset }: { capacity: number; slotW: number; inset: number }) {
  const marks = rulerMarks(capacity, slotW >= 26 ? 1 : 3);
  return (
    <div
      aria-hidden
      className="grid pt-1"
      style={{
        gridTemplateColumns: `repeat(${capacity}, minmax(12px, 1fr))`,
        columnGap: SLOT_GAP,
        paddingLeft: inset,
        paddingRight: inset,
      }}
    >
      {marks.map((k) => (
        <span key={k} className="flex flex-col items-center" style={{ gridColumnStart: k, gridRowStart: 1 }}>
          <span className="h-1 w-px bg-zinc-700" />
          <span className="num mt-0.5 text-[10px] leading-none text-zinc-500">{k}</span>
        </span>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────── leyenda

function Swatch({ style, className }: { style?: CSSProperties; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]', className)} style={style} />;
}

export function Legend({ className }: { className?: string }) {
  return (
    <ul aria-label="Leyenda del compartimiento" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400', className)}>
      <li className="flex items-center gap-1.5">
        <Swatch style={{ backgroundColor: UNIT_HEX.A }} />α entrega
      </li>
      <li className="flex items-center gap-1.5">
        <Swatch style={{ backgroundColor: UNIT_HEX.B }} />β recogida
      </li>
      <li className="flex items-center gap-1.5">
        <Swatch style={{ backgroundColor: '#a1a1aa', backgroundImage: DARK_HATCH, boxShadow: `0 0 0 1.5px ${HANDLING_HEX}` }} />
        manipulada
      </li>
      <li className="flex items-center gap-1.5">
        <Swatch className="border border-dashed border-zinc-600" />
        vacío
      </li>
    </ul>
  );
}

// ───────────────────────────────────────────── celda de slot

export type GlyphMode = 'none' | 'glyph' | 'full' | 'vertical';

export interface SlotCellProps {
  index: number;
  unitId: string | null;
  /** layoutId de la unidad (id + generación de visibilidad). */
  layoutKey: string;
  type: UnitType | null;
  tag: string;
  motion: UnitMotion | null;
  /** Evacuada en esta parada (ya volvió al camión): rayado. */
  handled: boolean;
  dim: boolean;
  emph: boolean;
  glyph: GlyphMode;
  big: boolean;
  delay: number;
  /** Retardo de aparición si la unidad no estaba visible antes; null = ya estaba. */
  enter: number | null;
  selected: boolean;
  tabbable: boolean;
  label: string;
  onEnter: (index: number, el: HTMLElement) => void;
  onLeave: () => void;
  onPick: (index: number) => void;
}

export const SlotCell = memo(function SlotCell(p: SlotCellProps) {
  const occupied = p.unitId !== null && p.type !== null;
  return (
    <motion.button
      type="button"
      data-slot={p.index}
      whileTap={{ scale: 0.97 }}
      transition={springSnappy}
      tabIndex={p.tabbable ? 0 : -1}
      aria-label={p.label}
      aria-pressed={p.selected}
      onClick={() => p.onPick(p.index)}
      onMouseEnter={(e) => p.onEnter(p.index, e.currentTarget)}
      onMouseLeave={p.onLeave}
      onFocus={(e) => p.onEnter(p.index, e.currentTarget)}
      onBlur={p.onLeave}
      className={cn(
        'relative h-full min-w-0 rounded-[5px] border transition-colors duration-150 focus-visible:z-20 focus-visible:outline-offset-1',
        occupied ? 'border-transparent' : 'border-dashed border-zinc-800 bg-zinc-900/25 hover:border-zinc-600 hover:bg-zinc-800/40',
      )}
    >
      {occupied && (
        <UnitBlock
          key={p.layoutKey}
          layoutKey={p.layoutKey}
          slot={p.index}
          type={p.type as UnitType}
          tag={p.tag}
          motion={p.motion}
          handled={p.handled}
          dim={p.dim}
          emph={p.emph}
          glyph={p.glyph}
          big={p.big}
          delay={p.delay}
          enter={p.enter}
        />
      )}
      {p.selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[3px] z-10 rounded-[7px] border-2 border-zinc-50 shadow-[0_0_0_3px_rgb(9_9_11/0.65),0_0_18px_rgb(250_250_250/0.25)]"
        />
      )}
    </motion.button>
  );
});

interface UnitBlockProps {
  layoutKey: string;
  /** Slot que ocupa: solo si cambia (o cambia el tamaño) hace falta medir el layout. */
  slot: number;
  type: UnitType;
  tag: string;
  motion: UnitMotion | null;
  handled: boolean;
  dim: boolean;
  emph: boolean;
  glyph: GlyphMode;
  big: boolean;
  delay: number;
  enter: number | null;
}

const MOTION_LABEL: Partial<Record<UnitMotion, string>> = { pickup: 'ENTRA', reload: 'ENTRA', slide: '↔' };

function UnitBlock({ layoutKey, slot, type, tag, motion: m, handled, dim, emph, glyph, big, delay, enter }: UnitBlockProps) {
  const glow = m === 'reload' ? HANDLING_HEX : m === 'pickup' ? UNIT_HEX.B : null;
  const shadows = ['inset 0 1px 0 rgb(255 255 255 / 0.42)', 'inset 0 -3px 0 rgb(0 0 0 / 0.2)'];
  if (emph) shadows.push('0 0 0 1.5px #fafafa');
  else if (m === 'slide') shadows.push('inset 0 0 0 1px rgb(255 255 255 / 0.65)');
  const status = m ? MOTION_LABEL[m] : undefined;
  const glyphChar = type === 'A' ? 'α' : 'β';

  return (
    // Sin whileTap: Motion le pondría tabindex=0 y cada pallet sería una parada de
    // tabulación anónima dentro del botón del slot (la compresión va en el botón).
    <motion.span
      aria-hidden
      layoutId={layoutKey}
      layoutDependency={`slot-${slot}-${big}`}
      layoutCrossfade={false}
      initial={enter !== null ? { opacity: 0, scale: 0.55 } : false}
      animate={{ opacity: dim ? 0.26 : 1, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{
        layout: { ...springCargo, delay },
        opacity: { duration: 0.24, delay: enter ?? 0 },
        scale: { ...springSnappy, delay: enter ?? 0 },
        y: springSnappy,
      }}
      className="absolute inset-0 block"
      style={{
        borderRadius: 4,
        backgroundColor: UNIT_HEX[type],
        backgroundImage: [handled ? DARK_HATCH : null, TOP_LIGHT, SLATS].filter(Boolean).join(', '),
        boxShadow: shadows.join(', '),
      }}
    >
      {glyph !== 'none' && (
        <span
          className={cn(
            'pointer-events-none absolute inset-0 flex flex-col items-center font-mono leading-none text-zinc-950/80',
            glyph === 'full' ? 'justify-between py-1.5' : glyph === 'vertical' ? 'justify-start gap-2 pt-2.5' : 'justify-center',
          )}
        >
          {glyph === 'full' && <span className={cn('font-semibold tracking-tight text-zinc-950/70', big ? 'text-[9px]' : 'text-[7.5px]')}>{status ?? ' '}</span>}
          <span className={cn('font-semibold', big ? 'text-[15px]' : 'text-[11px]')}>{glyphChar}</span>
          {glyph === 'full' && <span className={cn('font-medium text-zinc-950/70', big ? 'text-[11px]' : 'text-[9px]')}>{tag || ' '}</span>}
          {glyph === 'vertical' && tag && <span className="text-[10px] font-medium text-zinc-950/70 [writing-mode:vertical-rl]">{tag}</span>}
        </span>
      )}
      {glow && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-px"
          style={{ borderRadius: 5, boxShadow: `0 0 0 1.5px ${glow}, 0 0 10px 1px ${glow}` }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1.8, ease: 'easeOut', delay: delay + 0.35 }}
        />
      )}
    </motion.span>
  );
}

// ───────────────────────────────────────────── fichas (andén / cliente)

export type TokenVariant = 'dock' | 'delivered' | 'awaiting';

export interface TokenProps {
  id: string;
  layoutKey: string;
  type: UnitType;
  variant: TokenVariant;
  size: number;
  dim: boolean;
  emph: boolean;
  delay: number;
  enter: number | null;
  /** Primera ficha de su zona: es la que recibe el Tab (las demás, con flechas). */
  tabbable?: boolean;
  onEnter: (id: string, el: HTMLElement) => void;
  onLeave: () => void;
  onPick: (id: string) => void;
}

const TOKEN_STATE: Record<TokenVariant, string> = {
  dock: 'en el andén temporal',
  delivered: 'entregada en esta parada',
  awaiting: 'por recoger en el cliente',
};

/** Flechas / Inicio / Fin recorren las fichas de la misma zona (roving tabindex). */
function onTokenKey(e: KeyboardEvent<HTMLElement>, id: string, onPick: (id: string) => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    onPick(id);
    return;
  }
  const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  const all = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-token]') ?? [])];
  const i = all.indexOf(e.currentTarget);
  const next =
    e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1);
  all[next]?.focus();
}

export const Token = memo(function Token(p: TokenProps) {
  const color = UNIT_HEX[p.type];
  const base = p.variant === 'delivered' ? 0.5 : 1;
  const shadows: string[] = [];
  if (p.variant === 'dock') shadows.push(`0 0 0 1.5px ${HANDLING_HEX}`);
  if (p.variant === 'awaiting') shadows.push(`inset 0 0 0 1px rgb(${UNIT_RGB[p.type]} / 0.55)`);
  if (p.emph) shadows.push(p.variant === 'dock' ? '0 0 0 3px #fafafa' : '0 0 0 1.5px #fafafa');

  return (
    <motion.span
      layoutId={p.layoutKey}
      layoutDependency={p.variant}
      layoutCrossfade={false}
      data-token
      role="button"
      tabIndex={p.tabbable ? 0 : -1}
      aria-label={`Unidad ${p.type === 'A' ? 'α' : 'β'} ${p.id}, ${TOKEN_STATE[p.variant]}. Enter para inspeccionar`}
      onFocus={(e) => p.onEnter(p.id, e.currentTarget)}
      onBlur={p.onLeave}
      onKeyDown={(e) => onTokenKey(e, p.id, p.onPick)}
      initial={p.enter !== null ? { opacity: 0, scale: 0.4 } : false}
      animate={{ opacity: p.dim ? base * 0.4 : base, scale: 1 }}
      exit={{ opacity: 0, scale: 0.35, transition: { duration: 0.28, ease: 'easeIn' } }}
      whileHover={{ y: -2, scale: 1.08 }}
      transition={{
        layout: { ...springCargo, delay: p.delay },
        opacity: { duration: 0.24, delay: p.enter ?? 0 },
        scale: { ...springSnappy, delay: p.enter ?? 0 },
        y: springSnappy,
      }}
      onMouseEnter={(e) => p.onEnter(p.id, e.currentTarget)}
      onMouseLeave={p.onLeave}
      onClick={() => p.onPick(p.id)}
      className="relative block shrink-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
      style={{
        width: p.size,
        height: p.size,
        borderRadius: 3,
        backgroundColor: p.variant === 'awaiting' ? `rgb(${UNIT_RGB[p.type]} / 0.16)` : color,
        backgroundImage: p.variant === 'dock' ? `${DARK_HATCH}, ${TOP_LIGHT}` : p.variant === 'delivered' ? TOP_LIGHT : undefined,
        boxShadow: shadows.length ? shadows.join(', ') : undefined,
      }}
    >
      {p.variant === 'delivered' && p.size >= 12 && (
        <Check aria-hidden className="absolute inset-0 m-auto text-zinc-950" style={{ width: p.size * 0.72, height: p.size * 0.72 }} strokeWidth={3} />
      )}
      {p.variant === 'awaiting' && (
        <span aria-hidden className="absolute inset-0 animate-soft-pulse rounded-[3px]" style={{ boxShadow: `0 0 0 1.5px ${color}` }} />
      )}
    </motion.span>
  );
});
