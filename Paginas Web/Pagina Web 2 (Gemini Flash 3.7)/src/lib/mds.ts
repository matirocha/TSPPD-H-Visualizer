import { NodeDef } from '../types/solution';

/**
 * Computes 2D coordinates for nodes using a spring-electrical force-directed layout
 * or classical MDS approximation based on the distance matrix c_ij.
 */
export function computeNodeCoordinates(
  nodes: NodeDef[],
  distMatrix: number[][],
  width: number,
  height: number,
  mode: 'mds' | 'circular' = 'mds'
): Record<number, { x: number; y: number }> {
  const n = nodes.length;
  const padding = 70;
  const cx = width / 2;
  const cy = height / 2;

  const positions: Record<number, { x: number; y: number }> = {};

  if (mode === 'circular' || !distMatrix || distMatrix.length !== n) {
    // Depot in center, customers in a regular polygon around it
    positions[0] = { x: cx, y: cy };
    const customerNodes = nodes.filter((node) => node.id !== 0);
    const radius = Math.min(width, height) / 2 - padding;

    customerNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / customerNodes.length - Math.PI / 2;
      positions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
    return positions;
  }

  // Classical MDS / Force Relaxation based on true distance matrix
  // 1. Initial random / circular seed
  const coords: { x: number; y: number }[] = [];
  coords.push({ x: 0, y: 0 }); // Depot at origin
  for (let i = 1; i < n; i++) {
    const angle = (2 * Math.PI * (i - 1)) / (n - 1);
    const d0i = distMatrix[0]?.[i] || 50;
    coords.push({
      x: Math.cos(angle) * d0i,
      y: Math.sin(angle) * d0i,
    });
  }

  // 2. Iterative Stress Majorization / Spring Force relaxation
  const iterations = 120;
  let learningRate = 0.25;

  for (let iter = 0; iter < iterations; iter++) {
    const forces: { fx: number; fy: number }[] = coords.map(() => ({ fx: 0, fy: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = coords[j].x - coords[i].x;
        const dy = coords[j].y - coords[i].y;
        const currentDist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
        const targetDist = distMatrix[i]?.[j] || 40;

        // Force proportional to distance error
        const displacement = currentDist - targetDist;
        const forceMag = displacement / currentDist;

        forces[i].fx += dx * forceMag;
        forces[i].fy += dy * forceMag;
        forces[j].fx -= dx * forceMag;
        forces[j].fy -= dy * forceMag;
      }
    }

    for (let i = 0; i < n; i++) {
      coords[i].x += forces[i].fx * learningRate;
      coords[i].y += forces[i].fy * learningRate;
    }
    learningRate *= 0.98;
  }

  // 3. Normalize coordinates to canvas bounds [padding, width - padding]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of coords) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const availW = width - padding * 2;
  const availH = height - padding * 2;
  const scale = Math.min(availW / spanX, availH / spanY);

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  nodes.forEach((node, i) => {
    positions[node.id] = {
      x: cx + (coords[i].x - midX) * scale,
      y: cy + (coords[i].y - midY) * scale,
    };
  });

  return positions;
}
