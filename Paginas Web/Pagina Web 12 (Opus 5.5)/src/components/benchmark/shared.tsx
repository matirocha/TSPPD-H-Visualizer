/**
 * Piezas comunes de la sección «Tiempos»: encabezado de tarjeta, botones de exportación
 * (LaTeX al portapapeles, CSV como descarga), celda pendiente, indicador en vivo y formato
 * de horas.
 */
import type { ReactNode } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { cn } from '../../lib/cn';
import { fmtAuto } from '../../lib/format';
import { Button } from '../ui';
import { useCopy } from '../model/useCopy';

/** h = 0,1 · 0,5 · 1 (sin ceros sobrantes). */
export const hText = (h: number) => fmtAuto(h, 2);

const CLOCK = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY_CLOCK = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const FULL = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23' });

/** «16:16» si es de hoy; «3 oct, 16:16» si no. */
export function fmtClock(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const today = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return today ? CLOCK.format(d) : DAY_CLOCK.format(d);
}

export function fmtDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : FULL.format(d);
}

/** Encabezado de tarjeta: eyebrow mono + título + nota, con acciones a la derecha. */
export function CardHead({ eyebrow, title, note, actions }: { eyebrow: ReactNode; title: ReactNode; note?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-[72ch]">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">{title}</h3>
        {note && <p className="mt-1 text-[12.5px] leading-relaxed text-pretty text-zinc-500">{note}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Copia una tabla en LaTeX (booktabs) y confirma con «Copiado». */
export function CopyLatexButton({ getText, what, label = 'Copiar LaTeX' }: { getText: () => string; what: string; label?: string }) {
  const { copied, copy } = useCopy();
  const done = copied === 'latex';
  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => void copy('latex', getText())}
        title={`Copiar ${what} en LaTeX (booktabs)`}
        className={cn(done && 'border-ok/40 text-ok hover:text-ok')}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {done ? 'Copiado' : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {done ? `${what} copiada al portapapeles en LaTeX` : ''}
      </span>
    </>
  );
}

/** Descarga un texto como archivo (con BOM UTF-8 para que Excel lea las tildes). */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function CsvButton({ getText, filename }: { getText: () => string; filename: string }) {
  return (
    <Button variant="outline" size="xs" onClick={() => downloadText(filename, getText())} title={`Descargar todos los registros (${filename})`}>
      <Download className="h-3.5 w-3.5" aria-hidden />
      CSV
    </Button>
  );
}

/** Celda de una ejecución que aún no termina. */
export function Pending({ className, label = 'pendiente' }: { className?: string; label?: string }) {
  return (
    <span className={cn('text-zinc-500', className)} title="Pendiente: el benchmark aún no registra esta ejecución">
      <span aria-hidden>…</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Punto verde con pulso (sondeo en vivo). */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative flex h-1.5 w-1.5 shrink-0', className)}>
      <span className="absolute inset-0 animate-ring-ping rounded-full bg-ok/70" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-ok" />
    </span>
  );
}

export function CommandLine({ children }: { children: string }) {
  return (
    <code className="scrollbar-thin block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 font-mono text-[12px] whitespace-pre text-zinc-300">
      {children}
    </code>
  );
}

/** Fondo opaco de la primera columna fija (= superficie efectiva de la tarjeta). */
export const STICKY_CELL = 'sticky left-0 z-10 bg-[#111114]';

/**
 * Resaltado de la celda fija cuando se pasa sobre su fila (`<tr className="group/row …
 * hover:bg-zinc-800/25">`): el fondo opaco taparía el de la fila, así que se pinta el tono
 * equivalente (#111114 con zinc-800 al 25 % encima).
 */
export const STICKY_ROW_HOVER = 'transition-colors group-hover/row:bg-[#17171a]';
