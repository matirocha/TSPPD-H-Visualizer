import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) { return twMerge(clsx(inputs)) }

export function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n ?? '—')
  return new Intl.NumberFormat('es-CL').format(n)
}
