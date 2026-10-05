/**
 * Formato es-CL para las tablas de tiempos. Los espacios antes de «%» y tras «<» son
 * no separables (U+00A0) para que una celda nunca se parta en dos líneas.
 */
import { fmt } from '../../lib/format.ts';

const NBSP = ' ';
const MINUS = '−';

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const bad = (v: number | null | undefined): v is null | undefined => v === null || v === undefined || !Number.isFinite(v);

/** Número con signo tipográfico (−0,3) y sin «−0,0» por redondeo. */
export function fmtNum(value: number | null | undefined, decimals = 2): string {
  if (bad(value)) return '—';
  const r = round(value, decimals);
  if (r === 0) return fmt(0, decimals);
  return r < 0 ? MINUS + fmt(-r, decimals) : fmt(r, decimals);
}

/**
 * Segundos sin unidad: '—' si falta; '< 0,01'; < 10 → 2 decimales; < 100 → 1; si no, entero con
 * miles («1.800»). El umbral se evalúa tras redondear (9,996 → «10,0», no «10,00»).
 */
export function fmtSec(s: number | null | undefined): string {
  if (bad(s)) return '—';
  if (s < 0.01) return `<${NBSP}0,01`;
  if (round(s, 2) < 10) return fmt(s, 2);
  if (round(s, 1) < 100) return fmt(s, 1);
  return fmt(s, 0);
}

/** Milisegundos sin unidad: '< 0,001'; < 1 → 3 decimales; < 10 → 2; < 100 → 1; si no, entero. */
export function fmtMs(ms: number | null | undefined): string {
  if (bad(ms)) return '—';
  if (ms < 0.001) return `<${NBSP}0,001`;
  if (round(ms, 3) < 1) return fmt(ms, 3);
  if (round(ms, 2) < 10) return fmt(ms, 2);
  if (round(ms, 1) < 100) return fmt(ms, 1);
  return fmt(ms, 0);
}

/** Valor ya en porcentaje (no razón): 4.2 → «4,2 %», −0.31 → «−0,3 %». */
export function fmtPctValue(p: number | null | undefined, decimals = 1): string {
  if (bad(p)) return '—';
  return `${fmtNum(p, decimals)}${NBSP}%`;
}

/** Costo Z o z^H con un decimal es-CL (349.7 → «349,7»). */
export function fmtZ(z: number | null | undefined): string {
  return fmtNum(z, 1);
}

/** Procesador sin marcas ni sufijos: «AMD Ryzen 7 7700 8-Core Processor» → «Ryzen 7 7700». */
export function shortCpu(cpu: string): string {
  return (
    cpu
      .replace(/\((R|TM)\)/gi, '')
      .replace(/\b\d+-Core Processor\b/i, '')
      .replace(/\bCPU\b.*$/i, '')
      .replace(/^(AMD|Intel)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim() || cpu
  );
}
