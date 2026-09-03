import React, { useRef, useEffect, useState } from "react";
import { SolutionData, OperationPhase } from "@/types/tsppd";
import { MapPin, CheckCircle2 } from "lucide-react";

interface RouteCanvasProps {
  solution: SolutionData;
  currentStep: number;
  truckProgress: number;
  isAnimating: boolean;
  operationPhase: OperationPhase;
}

export const RouteCanvas: React.FC<RouteCanvasProps> = ({
  solution,
  currentStep,
  truckProgress,
  isAnimating,
  operationPhase,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [nodePositions, setNodePositions] = useState<{ x: number; y: number }[]>([]);

  // Calculate Node positions in a spacious layout with Depot prominently at top
  const computeNodePositions = (w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2 + 10;
    const radius = Math.min(w, h) * 0.36;
    const n = solution.nodes.length;
    const positions: { x: number; y: number }[] = [];

    for (let i = 0; i < n; i++) {
      if (i === 0) {
        // Depot at top
        positions.push({ x: cx, y: cy - radius * 1.05 });
      } else {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        positions.push({
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      }
    }
    return positions;
  };

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      const canvas = canvasRef.current;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      setNodePositions(computeNodePositions(w, h));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [solution]);

  // Main Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodePositions.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Cyber Grid Background
    ctx.strokeStyle = "rgba(71, 85, 105, 0.16)";
    ctx.lineWidth = 0.5;
    const spacing = 40;
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Background Complete Graph Edges (faint network)
    ctx.strokeStyle = "rgba(71, 85, 105, 0.14)";
    ctx.lineWidth = 1;
    for (let i = 0; i < solution.nodes.length; i++) {
      for (let j = i + 1; j < solution.nodes.length; j++) {
        if (solution.distMatrix[i] && solution.distMatrix[i][j] < 9999) {
          ctx.beginPath();
          ctx.moveTo(nodePositions[i].x, nodePositions[i].y);
          ctx.lineTo(nodePositions[j].x, nodePositions[j].y);
          ctx.stroke();
        }
      }
    }

    // 3. Optimal Route Edges
    const tour = solution.tour;
    for (let s = 0; s < tour.length - 1; s++) {
      const u = tour[s];
      const v = tour[s + 1];
      const from = nodePositions[u];
      const to = nodePositions[v];
      if (!from || !to) continue;

      const isCompleted = s < currentStep || (s === currentStep && !isAnimating);
      const isActive = s === currentStep && isAnimating;
      const isFuture = s > currentStep;

      if (isFuture && currentStep >= 0) {
        // Dashed future path
        ctx.save();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
      } else if (isActive) {
        // Partial active animated path
        const midX = from.x + (to.x - from.x) * truckProgress;
        const midY = from.y + (to.y - from.y) * truckProgress;

        // Completed segment
        ctx.save();
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 4.5;
        ctx.shadowColor = "rgba(6, 182, 212, 0.7)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(midX, midY);
        ctx.stroke();
        ctx.restore();

        // Remaining dashed segment
        ctx.save();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();

        drawDistanceBadge(ctx, (from.x + to.x) / 2, (from.y + to.y) / 2 - 16, solution.steps[s].distance, true);
      } else if (isCompleted) {
        // Solid completed segment
        ctx.save();
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(6, 182, 212, 0.4)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();

        drawArrow(ctx, from, to, "#06b6d4");
        drawDistanceBadge(ctx, (from.x + to.x) / 2, (from.y + to.y) / 2 - 16, solution.steps[s].distance, false);
      } else {
        // Initial state before starting
        ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    // 4. Draw Nodes (Increased Sizes: Depot 42px, Customer 34px)
    solution.nodes.forEach((node, idx) => {
      const pos = nodePositions[idx];
      if (!pos) return;

      const isVisited =
        currentStep < 0
          ? idx === 0
          : solution.tour.slice(0, currentStep + 1).includes(idx) ||
            (!isAnimating && solution.steps[currentStep]?.to === idx);

      const isCurrentDest =
        currentStep >= 0 &&
        currentStep < solution.steps.length &&
        solution.steps[currentStep].to === idx &&
        !isAnimating;

      // LARGER NODE RADIUS
      const radius = node.isDepot ? 42 : 34;

      // Animated glowing wave pulse if currently operating at this destination
      if (isCurrentDest) {
        ctx.save();
        ctx.shadowColor = node.isDepot ? "rgba(245, 158, 11, 0.9)" : "rgba(6, 182, 212, 0.9)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = node.isDepot ? "rgba(245, 158, 11, 0.25)" : "rgba(6, 182, 212, 0.25)";
        ctx.fill();

        ctx.strokeStyle = node.isDepot ? "#f59e0b" : "#06b6d4";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Base Circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

      if (node.isDepot) {
        const grad = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, radius);
        grad.addColorStop(0, "#fde047");
        grad.addColorStop(0.7, "#eab308");
        grad.addColorStop(1, "#ca8a04");
        ctx.fillStyle = grad;
      } else if (isVisited) {
        const grad = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, radius);
        grad.addColorStop(0, "#38bdf8");
        grad.addColorStop(0.7, "#0284c7");
        grad.addColorStop(1, "#0369a1");
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, radius);
        grad.addColorStop(0, "#475569");
        grad.addColorStop(1, "#1e293b");
        ctx.fillStyle = grad;
      }
      ctx.fill();

      // Node Border
      ctx.strokeStyle = isCurrentDest ? "#ffffff" : isVisited ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = isCurrentDest ? 3.5 : 2;
      ctx.stroke();

      // Node Center Icon / ID (Larger text)
      ctx.fillStyle = "#ffffff";
      ctx.font = node.isDepot ? "700 18px Geist, sans-serif" : "700 16px Geist, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.isDepot ? "🏭" : `${node.id}`, pos.x, pos.y);

      // Node Name Label
      ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
      ctx.font = "600 13px Geist, sans-serif";
      ctx.fillText(node.label, pos.x, pos.y + radius + 17);

      // Demand Badges below node (Larger & Clearer)
      if (!node.isDepot) {
        const alphaTxt = `α: ${node.alpha}`;
        const betaTxt = `β: ${node.beta}`;
        ctx.font = "700 11px JetBrains Mono, monospace";

        // Alpha Badge (Delivery demand - Red)
        ctx.fillStyle = "#f87171";
        ctx.fillText(alphaTxt, pos.x - 20, pos.y + radius + 33);

        // Beta Badge (Pickup demand - Cyan)
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(betaTxt, pos.x + 20, pos.y + radius + 33);
      }
    });

    // 5. Draw Truck (🚛) (Larger: 42px font with enhanced glow)
    let truckX = nodePositions[0].x + 44;
    let truckY = nodePositions[0].y - 14;

    if (currentStep >= 0 && currentStep < solution.steps.length) {
      const step = solution.steps[currentStep];
      const from = nodePositions[step.from];
      const to = nodePositions[step.to];

      if (isAnimating) {
        truckX = from.x + (to.x - from.x) * truckProgress;
        truckY = from.y + (to.y - from.y) * truckProgress;
      } else {
        truckX = to.x + 38;
        truckY = to.y - 18;
      }
    }

    // Truck Glow and Icon
    ctx.save();
    ctx.shadowColor = "rgba(168, 85, 247, 0.9)";
    ctx.shadowBlur = 20;
    ctx.font = "40px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚛", truckX, truckY);
    ctx.restore();

    // Mini Cargo load bar under truck
    if (currentStep >= 0 && currentStep < solution.steps.length) {
      const step = solution.steps[currentStep];
      const barW = 46;
      const barH = 6;
      const barX = truckX - barW / 2;
      const barY = truckY + 22;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      roundRect(ctx, barX - 1.5, barY - 1.5, barW + 3, barH + 3, 4);
      ctx.fill();

      const aW = barW * (step.aOnTruck / solution.capacity);
      const bW = barW * (step.bOnTruck / solution.capacity);

      if (step.aOnTruck > 0) {
        ctx.fillStyle = "#ef4444";
        roundRect(ctx, barX, barY, aW, barH, 2.5);
        ctx.fill();
      }
      if (step.bOnTruck > 0) {
        ctx.fillStyle = "#06b6d4";
        roundRect(ctx, barX + aW, barY, bW, barH, 2.5);
        ctx.fill();
      }
    }
  }, [solution, currentStep, truckProgress, isAnimating, nodePositions, operationPhase]);

  // Helper: Draw distance badge on edge
  const drawDistanceBadge = (ctx: CanvasRenderingContext2D, x: number, y: number, dist: number, active: boolean) => {
    ctx.save();
    const text = `${dist} km`;
    ctx.font = "700 12px JetBrains Mono, monospace";
    const textW = ctx.measureText(text).width + 16;

    ctx.fillStyle = active ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = active ? "#06b6d4" : "rgba(71, 85, 105, 0.6)";
    ctx.lineWidth = active ? 2 : 1;

    roundRect(ctx, x - textW / 2, y - 11, textW, 22, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#38bdf8" : "#fbbf24";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // Helper: Draw directional arrow on edge
  const drawArrow = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string) => {
    const headlen = 11;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const arrowPos = 0.65;
    const ax = from.x + dx * arrowPos;
    const ay = from.y + dy * arrowPos;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - headlen * Math.cos(angle - Math.PI / 7), ay - headlen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(ax - headlen * Math.cos(angle + Math.PI / 7), ay - headlen * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Helper: Draw rounded rect
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[520px] lg:min-h-[580px] relative bg-zinc-950/90 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl flex flex-col">
      <canvas ref={canvasRef} className="w-full h-full block flex-1 cursor-grab active:cursor-grabbing" />

      {/* Graph Legend Overlay */}
      <div className="absolute top-4 left-4 p-3 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-800 text-xs flex flex-col gap-2 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full bg-amber-400 border border-amber-300/40" />
          <span className="text-zinc-200 font-semibold">Depósito (Nodo 0)</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full bg-sky-500 border border-sky-400/40" />
          <span className="text-zinc-200 font-semibold">Clientes (1..{solution.numCustomers})</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-1.5 rounded bg-cyan-400" />
          <span className="text-zinc-200 font-semibold">Ruta Óptima</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-base">🚛</span>
          <span className="text-purple-300 font-semibold">Camión con Carga</span>
        </div>
      </div>

      {/* Floating Status / Arrival Banner */}
      {currentStep >= 0 && currentStep < solution.steps.length && !isAnimating && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-cyan-500/50 text-sm text-zinc-100 flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          {solution.steps[currentStep].to === 0 ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-emerald-300">¡Ruta Completada!</span>
              <span className="text-zinc-400">
                Regreso al Depósito con {solution.steps[currentStep].bOnTruck} unidades β
              </span>
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5 text-cyan-400" />
              <span className="font-bold text-zinc-100">
                Llegada a {solution.nodes[solution.steps[currentStep].to]?.label}:
              </span>
              {solution.steps[currentStep].deliverA > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs">
                  📦 Entrega {solution.steps[currentStep].deliverA}α
                </span>
              )}
              {solution.steps[currentStep].pickupB > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold text-xs">
                  📥 Recoge {solution.steps[currentStep].pickupB}β
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
