export function formatNumber(value: number, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return '0.00';
  return value.toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDistance(km: number): string {
  return `${km} km`;
}

export function formatCost(cost: number): string {
  return `$${formatNumber(cost, 2)}`;
}
