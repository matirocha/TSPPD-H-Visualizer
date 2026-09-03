export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ')
}

export function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num)
}

export function getSlotColor(type) {
  switch (type) {
    case 'A': return 'bg-alpha DEFAULT'
    case 'B': return 'bg-beta DEFAULT'
    default: return 'bg-muted'
  }
}

export function getSlotLabel(type) {
  switch (type) {
    case 'A': return 'α'
    case 'B': return 'β'
    default: return ''
  }
}