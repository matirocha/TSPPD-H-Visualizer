const cache = new Map<number, Intl.NumberFormat>();

function formatter(decimals: number) {
  let f = cache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(decimals, f);
  }
  return f;
}

/** Número con separadores es-CL (1.234,56). */
export function fmt(value: number | null | undefined, decimals = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return formatter(decimals).format(value);
}

/** Entero o decimal según corresponda (295 → "295", 1.5 → "1,5"). */
export function fmtAuto(value: number, maxDecimals = 2): string {
  const rounded = Math.round(value * 10 ** maxDecimals) / 10 ** maxDecimals;
  const decimals = Number.isInteger(rounded) ? 0 : Math.min(maxDecimals, (String(rounded).split('.')[1] ?? '').length);
  return fmt(rounded, decimals);
}

export const fmtKm = (km: number) => `${fmtAuto(km, 1)} km`;
export const fmtPct = (ratio: number, decimals = 0) => `${fmt(ratio * 100, decimals)} %`;

/** Signo explícito para deltas (+1,50 / −0,20). */
export function fmtDelta(value: number, decimals = 2): string {
  if (Math.abs(value) < 10 ** -decimals / 2) return fmt(0, decimals);
  return `${value > 0 ? '+' : '−'}${fmt(Math.abs(value), decimals)}`;
}
