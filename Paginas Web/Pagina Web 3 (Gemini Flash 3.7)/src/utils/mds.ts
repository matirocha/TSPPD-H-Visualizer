import { NodeDef } from '../types/tsppd';

interface Point2D {
  x: number;
  y: number;
}

/**
 * Computes 2D coordinates for nodes using Classical Multidimensional Scaling (MDS)
 * supplemented with force relaxation to ensure clean, aesthetic network visualization.
 */
export function computeNodeCoordinates(
  nodes: NodeDef[],
  distMatrix: number[][],
  width: number = 700,
  height: number = 450,
  padding: number = 60
): Map<number, Point2D> {
  const n = nodes.length;
  const coordsMap = new Map<number, Point2D>();

  if (n === 0) return coordsMap;
  if (n === 1) {
    coordsMap.set(nodes[0].id, { x: width / 2, y: height / 2 });
    return coordsMap;
  }

  // 1. Prepare clean symmetric distance matrix with 0 on diagonal
  const D: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        D[i][j] = 0;
      } else {
        const rawDist = distMatrix && distMatrix[i] && distMatrix[i][j] !== undefined
          ? distMatrix[i][j]
          : 50;
        // Ignore large infinity penalty (e.g. 10000000)
        const validDist = rawDist > 10000 ? 50 : Math.max(1, rawDist);
        D[i][j] = validDist;
      }
    }
  }

  // Make symmetric
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const avg = (D[i][j] + D[j][i]) / 2;
      D[i][j] = avg;
      D[j][i] = avg;
    }
  }

  // 2. Classical MDS: Compute B = -0.5 * H * D^2 * H
  const D2: number[][] = D.map((row) => row.map((d) => d * d));
  const rowMeans: number[] = Array(n).fill(0);
  const colMeans: number[] = Array(n).fill(0);
  let totalMean = 0;

  for (let i = 0; i < n; i++) {
    let rSum = 0;
    for (let j = 0; j < n; j++) {
      rSum += D2[i][j];
    }
    rowMeans[i] = rSum / n;
    totalMean += rSum;
  }
  totalMean /= (n * n);

  for (let j = 0; j < n; j++) {
    let cSum = 0;
    for (let i = 0; i < n; i++) {
      cSum += D2[i][j];
    }
    colMeans[j] = cSum / n;
  }

  const B: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      B[i][j] = -0.5 * (D2[i][j] - rowMeans[i] - colMeans[j] + totalMean);
    }
  }

  // 3. Power Iteration for top 2 eigenvectors
  function powerIteration(matrix: number[][], deflatedVectors: number[][] = []): { vector: number[]; value: number } {
    let v: number[] = Array.from({ length: n }, (_, idx) => Math.sin(idx + 1.2) + 0.1);
    // Normalize
    let norm = Math.hypot(...v) || 1;
    v = v.map((x) => x / norm);

    for (let iter = 0; iter < 100; iter++) {
      // Orthogonalize against deflated vectors
      for (const deflated of deflatedVectors) {
        const dot = v.reduce((sum, val, idx) => sum + val * deflated[idx], 0);
        v = v.map((val, idx) => val - dot * deflated[idx]);
      }
      norm = Math.hypot(...v) || 1;
      v = v.map((x) => x / norm);

      // Multiply M * v
      const nextV: number[] = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          nextV[i] += matrix[i][j] * v[j];
        }
      }

      norm = Math.hypot(...nextV) || 1;
      v = nextV.map((x) => x / norm);
    }

    // Rayleigh quotient
    let rayleighNumerator = 0;
    let rayleighDenominator = 0;
    for (let i = 0; i < n; i++) {
      let rowDot = 0;
      for (let j = 0; j < n; j++) {
        rowDot += matrix[i][j] * v[j];
      }
      rayleighNumerator += v[i] * rowDot;
      rayleighDenominator += v[i] * v[i];
    }
    const eigenvalue = rayleighNumerator / (rayleighDenominator || 1);

    return { vector: v, value: Math.max(0, eigenvalue) };
  }

  const eig1 = powerIteration(B, []);
  const eig2 = powerIteration(B, [eig1.vector]);

  let points: Point2D[] = [];
  const s1 = Math.sqrt(eig1.value);
  const s2 = Math.sqrt(eig2.value);

  // Check if MDS projection is non-degenerate
  const isMdsValid = s1 > 0.001;

  if (isMdsValid) {
    for (let i = 0; i < n; i++) {
      points.push({
        x: eig1.vector[i] * s1,
        y: (s2 > 0.001 ? eig2.vector[i] * s2 : Math.sin(i * 1.5) * s1 * 0.4),
      });
    }
  } else {
    // Circular fallback anchored on depot
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        points.push({ x: 0, y: 0 });
      } else {
        const angle = ((i - 1) / (n - 1)) * 2 * Math.PI - Math.PI / 2;
        const distToDepot = D[0][i] || 50;
        points.push({
          x: Math.cos(angle) * distToDepot,
          y: Math.sin(angle) * distToDepot,
        });
      }
    }
  }

  // 4. Force-directed repulsion pass to prevent overlaps
  const minSeparation = 50;
  for (let step = 0; step < 40; step++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const dist = Math.hypot(dx, dy) || 0.1;
        if (dist < minSeparation) {
          const overlap = (minSeparation - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          points[i].x -= nx * overlap * 0.4;
          points[i].y -= ny * overlap * 0.4;
          points[j].x += nx * overlap * 0.4;
          points[j].y += ny * overlap * 0.4;
        }
      }
    }
  }

  // 5. Fit nicely into viewport with padding
  let minX = Math.min(...points.map((p) => p.x));
  let maxX = Math.max(...points.map((p) => p.x));
  let minY = Math.min(...points.map((p) => p.y));
  let maxY = Math.max(...points.map((p) => p.y));

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const targetWidth = width - 2 * padding;
  const targetHeight = height - 2 * padding;

  const scale = Math.min(targetWidth / rangeX, targetHeight / rangeY);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  for (let i = 0; i < n; i++) {
    const finalX = width / 2 + (points[i].x - centerX) * scale;
    const finalY = height / 2 + (points[i].y - centerY) * scale;
    coordsMap.set(nodes[i].id, {
      x: Math.round(finalX),
      y: Math.round(finalY),
    });
  }

  return coordsMap;
}
