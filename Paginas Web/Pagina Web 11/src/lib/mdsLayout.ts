import { NodeDef } from "../types/tsppd";

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Calcula coordenadas 2D para los nodos respetando en lo posible las distancias reales
 * de la matriz distMatrix mediante relajación de resortes (Stress Minimization).
 */
export function computeNodePositions(
  nodes: NodeDef[],
  distMatrix: number[][],
  width: number = 700,
  height: number = 460
): Record<number, NodePosition> {
  const n = nodes.length;
  if (n === 0) return {};

  // Inicialización: Depósito en el centro o ligeramente desplazado a la izquierda,
  // los clientes distribuidos en un óvalo
  const padding = 70;
  const centerX = width / 2;
  const centerY = height / 2;
  const rx = (width - 2 * padding) / 2;
  const ry = (height - 2 * padding) / 2;

  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      positions.push({ x: centerX - rx * 0.35, y: centerY + ry * 0.1 });
    } else {
      const angle = ((i - 1) / (n - 1)) * 2 * Math.PI - Math.PI / 2;
      positions.push({
        x: centerX + rx * Math.cos(angle) * 0.85,
        y: centerY + ry * Math.sin(angle) * 0.85,
      });
    }
  }

  // Normalizar distancias de distMatrix a un rango de pixeles razonable
  let maxD = 1;
  let minD = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && distMatrix[i] && distMatrix[i][j] < 10000) {
        maxD = Math.max(maxD, distMatrix[i][j]);
        minD = Math.min(minD, distMatrix[i][j]);
      }
    }
  }

  const targetMinDist = 110;
  const targetMaxDist = Math.min(width, height) * 0.72;

  function getTargetDist(i: number, j: number): number {
    if (i === j) return 0;
    const raw = distMatrix[i]?.[j] ?? 50;
    if (raw >= 10000) return targetMaxDist;
    const ratio = (raw - minD) / (maxD - minD || 1);
    return targetMinDist + ratio * (targetMaxDist - targetMinDist);
  }

  // Relajación de resortes (Stress Majorization / Spring layout)
  const iterations = 140;
  let lr = 0.08;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const target = getTargetDist(i, j);
        const delta = dist - target;

        const force = delta * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;

        forces[i].fx += force * nx;
        forces[i].fy += force * ny;
        forces[j].fx -= force * nx;
        forces[j].fy -= force * ny;
      }
    }

    // Aplicar fuerzas y confinar en el bounding box
    for (let i = 0; i < n; i++) {
      // Dejar el depósito más anclado si se desea, o mover todo suavemente
      const weight = i === 0 ? 0.4 : 1.0;
      positions[i].x += forces[i].fx * lr * weight;
      positions[i].y += forces[i].fy * lr * weight;

      // Restricciones de borde
      positions[i].x = Math.max(padding, Math.min(width - padding, positions[i].x));
      positions[i].y = Math.max(padding, Math.min(height - padding, positions[i].y));
    }

    lr *= 0.98; // Recocido simulado suave
  }

  const result: Record<number, NodePosition> = {};
  nodes.forEach((node, idx) => {
    result[node.id] = {
      x: Math.round(positions[idx].x),
      y: Math.round(positions[idx].y),
    };
  });

  return result;
}
