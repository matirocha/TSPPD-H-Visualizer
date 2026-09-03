import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(val: number, decimals = 2): string {
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(decimals);
}

export function formatDistance(km: number): string {
  return `${km.toLocaleString()} km`;
}

export function formatPercent(val: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((val / total) * 100)}%`;
}
