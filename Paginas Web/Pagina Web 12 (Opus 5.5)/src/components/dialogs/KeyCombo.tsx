import { Fragment } from 'react';
import { Kbd } from '../ui';
import { cn } from '../../lib/cn';

const MODIFIERS = new Set(['Shift', 'Ctrl', 'Alt', 'Cmd']);

/** En macOS los atajos con Ctrl también responden a ⌘ (el hook acepta ctrlKey || metaKey). */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const LABEL: Record<string, string> = {
  Ctrl: IS_MAC ? '⌘' : 'Ctrl',
  Alt: IS_MAC ? '⌥' : 'Alt',
  Shift: IS_MAC ? '⇧' : 'Shift',
};

const SPOKEN: Record<string, string> = {
  '→': 'flecha derecha',
  '←': 'flecha izquierda',
  '↑': 'flecha arriba',
  '↓': 'flecha abajo',
  Esc: 'Escape',
  Ctrl: IS_MAC ? 'Comando' : 'Control',
  Shift: 'Mayúsculas',
  Alt: IS_MAC ? 'Opción' : 'Alt',
};

/**
 * Secuencia de teclas: combinaciones con modificador (Shift + →) o alternativas
 * equivalentes ([ / ], 1 2 3 4).
 */
export function KeyCombo({ keys, className }: { keys: string[]; className?: string }) {
  const combo = keys.length > 1 && MODIFIERS.has(keys[0]);
  const separator = combo ? '+' : keys.length === 2 ? '/' : '';
  const spoken = keys.map((k) => SPOKEN[k] ?? LABEL[k] ?? k).join(combo ? ' más ' : ' o ');
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1', className)}>
      <span className="sr-only">{spoken}</span>
      {keys.map((k, i) => (
        <Fragment key={`${k}-${i}`}>
          {i > 0 && separator && (
            <span aria-hidden className="font-mono text-[10px] text-zinc-500">
              {separator}
            </span>
          )}
          <span aria-hidden className="inline-flex">
            <Kbd>{LABEL[k] ?? k}</Kbd>
          </span>
        </Fragment>
      ))}
    </span>
  );
}
