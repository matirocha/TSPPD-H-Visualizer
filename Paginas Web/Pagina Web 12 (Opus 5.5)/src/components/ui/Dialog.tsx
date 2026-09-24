import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { spring } from '../../lib/motion';
import { lockScroll, pushLayer } from '../../lib/overlay';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Contenido a la derecha del título (filtros, chips…). */
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Posición vertical: centrado o anclado arriba (paleta de comandos). */
  placement?: 'center' | 'top';
  className?: string;
  bodyClassName?: string;
  hideClose?: boolean;
}

const SIZE = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-6xl' };

/**
 * Diálogo modal accesible: portal a <body>, fondo desenfocado, Esc / clic fuera
 * para cerrar, foco inicial dentro y devolución del foco al cerrar.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  headerExtra,
  footer,
  children,
  size = 'lg',
  placement = 'center',
  className,
  bodyClassName,
  hideClose,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // onClose suele llegar como función en línea: se guarda en un ref para que el
  // efecto dependa solo de `open` (si no, se re-ejecutaría en cada render robando el foco).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    const layer = pushLayer();
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>('input, button:not([data-close])');
      (target ?? panel)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      // Con diálogos apilados solo responde el superior
      if (!layer.isTop()) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      layer.pop();
      unlock();
      const back = restoreRef.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn('fixed inset-0 z-[70] flex justify-center p-3 sm:p-6', placement === 'center' ? 'items-center' : 'items-start pt-[12vh]')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-md" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={spring}
            className={cn(
              'relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl shadow-black/60 outline-none',
              SIZE[size],
              className,
            )}
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold tracking-tight text-zinc-50">
                  {title}
                </h2>
                {description && <p className="mt-0.5 max-w-[65ch] text-[13px] text-zinc-400">{description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {headerExtra}
                {!hideClose && (
                  <button
                    type="button"
                    data-close
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="grid h-8 w-8 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </header>
            <div className={cn('min-h-0 flex-1 overflow-y-auto scrollbar-thin', bodyClassName ?? 'p-5')}>{children}</div>
            {footer && <footer className="border-t border-zinc-800/80 px-5 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
