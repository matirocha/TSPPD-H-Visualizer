export interface Point {
  x: number
  y: number
}

/**
 * Calcula las posiciones de nodos en un layout circular.
 * El depósito (nodo 0) se posiciona en el centro.
 * Los clientes se distribuyen uniformemente en un círculo.
 */
export function calculateNodePositions(
  nodeCount: number,
  width: number,
  height: number,
  padding: number = 60
): Point[] {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - padding

  const positions: Point[] = []

  // Nodo 0 (depósito) en el centro
  positions.push({ x: cx, y: cy })

  // Clientes distribuidos en círculo
  const customerCount = nodeCount - 1
  for (let i = 0; i < customerCount; i++) {
    const angle = (2 * Math.PI * i) / customerCount - Math.PI / 2
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  }

  return positions
}

/**
 * Calcula el punto medio de un arco curvo entre dos puntos.
 * Usado para posicionar labels de distancia.
 */
export function arcMidpoint(from: Point, to: Point, curvature: number = 0.15): Point {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const nx = -dy * curvature
  const ny = dx * curvature
  return { x: mx + nx, y: my + ny }
}

/**
 * Genera el path SVG de un arco curvado entre dos puntos.
 */
export function curvedArcPath(from: Point, to: Point, curvature: number = 0.15): string {
  const mid = arcMidpoint(from, to, curvature)
  return `M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`
}

/**
 * Interpola una posición a lo largo de una curva cuadrática de Bézier.
 * t va de 0 a 1.
 */
export function interpolateQuadratic(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  }
}
