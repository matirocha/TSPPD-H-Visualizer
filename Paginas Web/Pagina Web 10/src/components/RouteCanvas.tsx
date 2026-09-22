import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Truck, MapPin } from 'lucide-react';
import { cn } from '../lib/cn';
import { SolutionData, NodeDef } from '../types/solution';
import { calculateNodePositions, arcMidpoint, curvedArcPath, interpolateQuadratic } from '../lib/geometry';

interface RouteCanvasProps {
  solution: SolutionData;
  currentStepIndex: number;
  progress: number; // 0 to 1
  isArrived: boolean;
  onSelectNode?: (node: NodeDef) => void;
}

export const RouteCanvas: React.FC<RouteCanvasProps> = ({
  solution,
  currentStepIndex,
  progress,
  isArrived,
  onSelectNode,
}) => {
  const width = 640;
  const height = 540;

  const nodePositions = useMemo(() => {
    if (!solution || !solution.nodes) return [];
    return calculateNodePositions(solution.nodes.length, width, height, 55);
  }, [solution, width, height]);

  if (!solution || !solution.nodes || nodePositions.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-zinc-500 font-mono text-sm">
        Sin datos de ruta disponibles
      </div>
    );
  }

  const { steps, nodes } = solution;
  const currentStepData = steps[currentStepIndex] || steps[0];
  const currentFrom = currentStepData?.from ?? 0;
  const currentTo = currentStepData?.to ?? 0;

  // Initial resting state before the user starts the tour
  const isAtDepotInitial = currentStepIndex === 0 && !isArrived && progress === 0;

  // Truck position along Bézier curve
  const fromPos = nodePositions[currentFrom] || nodePositions[0];
  const toPos = nodePositions[currentTo] || nodePositions[0];

  const controlPos = {
    x: (fromPos.x + toPos.x) / 2 - (toPos.y - fromPos.y) * 0.2,
    y: (fromPos.y + toPos.y) / 2 + (toPos.x - fromPos.x) * 0.2,
  };

  const truckPos = isAtDepotInitial
    ? (nodePositions[0] || fromPos)
    : isArrived
    ? toPos
    : interpolateQuadratic(fromPos, controlPos, toPos, progress);

  // Tangential rotation angle along Bézier curve: B'(t) = 2(1-t)(control-from) + 2t(to-control)
  const truckAngle = useMemo(() => {
    if (isArrived || isAtDepotInitial) return 0;
    const t = Math.max(0, Math.min(1, progress));
    const dx = 2 * (1 - t) * (controlPos.x - fromPos.x) + 2 * t * (toPos.x - controlPos.x);
    const dy = 2 * (1 - t) * (controlPos.y - fromPos.y) + 2 * t * (toPos.y - controlPos.y);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }, [isArrived, isAtDepotInitial, progress, fromPos, controlPos, toPos]);

  return (
    <div className="rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-3.5 flex flex-col gap-2.5 shadow-xl relative overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Mapa de Ruta y Topología de Red
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                {nodes.length} Nodos
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Disposición circular con arcos curvos y posición en tiempo real del camión
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-500/50" />
            Depósito
          </span>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-500/50" />
            Cliente
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded bg-zinc-600 inline-block" />
            Recorrido
          </span>
        </div>
      </div>

      {/* SVG Canvas Arena */}
      <div className="relative w-full aspect-[16/10] max-h-[295px] bg-zinc-900/50 rounded-xl border border-zinc-800/90 overflow-hidden flex items-center justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible select-none"
        >
          <defs>
            {/* Markers */}
            <marker
              id="arrow-visited-9"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-emerald-500 opacity-80" />
            </marker>
            <marker
              id="arrow-current-9"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-emerald-400" />
            </marker>
            <marker
              id="arrow-future-9"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-zinc-700" />
            </marker>

            {/* Glowing filter for truck and target */}
            <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Edges / Tour Arcs */}
          {steps.map((step, idx) => {
            const from = nodePositions[step.from];
            const to = nodePositions[step.to];
            if (!from || !to) return null;

            const path = curvedArcPath(from, to, 0.2);
            const mid = arcMidpoint(from, to, 0.2);
            const isVisited = !isAtDepotInitial && (step.stepIndex < currentStepIndex || (step.stepIndex === currentStepIndex && isArrived));
            const isCurrent = !isAtDepotInitial && step.stepIndex === currentStepIndex && !isArrived;

            let strokeClass = 'stroke-zinc-800';
            let markerEnd = 'url(#arrow-future-9)';
            let strokeWidth = 2;
            let strokeDasharray = '4,4';

            if (isVisited) {
              strokeClass = 'stroke-emerald-500 opacity-80';
              markerEnd = 'url(#arrow-visited-9)';
              strokeWidth = 2.5;
              strokeDasharray = '';
            } else if (isCurrent) {
              strokeClass = 'stroke-emerald-400';
              markerEnd = 'url(#arrow-current-9)';
              strokeWidth = 3.5;
              strokeDasharray = '6,4';
            }

            return (
              <g key={`edge-step-${idx}`}>
                <path
                  d={path}
                  fill="none"
                  className={cn('transition-all duration-300', strokeClass)}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  markerEnd={markerEnd}
                />
                {/* Distance Badge */}
                <g transform={`translate(${mid.x}, ${mid.y})`}>
                  <rect
                    x={-18}
                    y={-10}
                    width={36}
                    height={20}
                    rx={6}
                    className={cn(
                      'transition-colors duration-300',
                      isCurrent
                        ? 'fill-emerald-950 stroke-emerald-400'
                        : isVisited
                        ? 'fill-zinc-900 stroke-emerald-500/40'
                        : 'fill-zinc-900/90 stroke-zinc-700/60'
                    )}
                    strokeWidth={1.5}
                  />
                  <text
                    y={4}
                    textAnchor="middle"
                    className={cn(
                      'text-[10px] font-mono font-bold',
                      isCurrent ? 'fill-emerald-300' : isVisited ? 'fill-zinc-200' : 'fill-zinc-400'
                    )}
                  >
                    {step.distance}k
                  </text>
                </g>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node, idx) => {
            const pos = nodePositions[idx];
            if (!pos) return null;

            const isDepot = node.isDepot;
            const isCurrentTarget = currentStepData?.to === idx && !isArrived;
            const isCurrentHere = (isArrived && currentStepData?.to === idx) || (currentStepIndex === 0 && !isArrived && idx === 0);
            const isVisited = steps.some((s) => s.to === idx && s.stepIndex < currentStepIndex) || (isDepot && currentStepIndex > 0);

            let circleClass = 'fill-zinc-900 stroke-zinc-700';
            let r = 18;

            if (isDepot) {
              circleClass = 'fill-amber-400 stroke-amber-200 shadow-lg';
              r = 22;
            } else if (isCurrentTarget) {
              circleClass = 'fill-emerald-400 stroke-emerald-200 animate-pulse';
            } else if (isCurrentHere) {
              circleClass = 'fill-emerald-500/90 stroke-emerald-300';
            } else if (isVisited) {
              circleClass = 'fill-emerald-950/80 stroke-emerald-500';
            }

            return (
              <g
                key={`node-${idx}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onSelectNode && onSelectNode(node)}
                className="cursor-pointer group"
              >
                {/* Pulsing ring for current destination */}
                {(isCurrentTarget || isCurrentHere) && (
                  <circle
                    r={r + 8}
                    fill="none"
                    className="stroke-emerald-400/40 animate-ping"
                    strokeWidth={1.5}
                  />
                )}

                <circle
                  r={r}
                  strokeWidth="2.5"
                  className={cn('transition-all duration-300 group-hover:scale-110', circleClass)}
                />

                {isDepot ? (
                  <text
                    y={5}
                    textAnchor="middle"
                    className="text-xs font-black fill-amber-950 font-mono tracking-tight pointer-events-none"
                  >
                    D
                  </text>
                ) : (
                  <text
                    y={5}
                    textAnchor="middle"
                    className={cn(
                      'text-xs font-bold font-mono pointer-events-none',
                      isVisited || isCurrentHere || isCurrentTarget ? 'fill-white' : 'fill-zinc-200'
                    )}
                  >
                    C{node.id}
                  </text>
                )}

                {/* Node demand info badge below */}
                {!isDepot && (
                  <g transform={`translate(0, ${r + 15})`}>
                    <rect
                      x={-28}
                      y={-8}
                      width={56}
                      height={16}
                      rx={4}
                      className="fill-zinc-950/90 stroke-zinc-800"
                      strokeWidth={1}
                    />
                    <text
                      y={4}
                      textAnchor="middle"
                      className="text-[9px] font-mono font-medium pointer-events-none"
                    >
                      <tspan className="fill-rose-400 font-bold">α:{node.alpha}</tspan>
                      <tspan className="fill-zinc-500"> </tspan>
                      <tspan className="fill-cyan-400 font-bold">β:{node.beta}</tspan>
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Animated Truck */}
          {truckPos && (
            <g
              transform={`translate(${truckPos.x}, ${truckPos.y}) rotate(${truckAngle})`}
              filter="url(#glow-emerald)"
            >
              {/* Pulse background circle */}
              <circle
                r={16}
                className="fill-emerald-500/30 stroke-emerald-400 animate-pulse"
                strokeWidth={2}
              />
              <circle
                r={12}
                className="fill-zinc-950 stroke-emerald-400"
                strokeWidth={2}
              />
              {/* Truck Icon */}
              <g transform="translate(-8, -8)">
                <Truck className="w-4 h-4 text-emerald-300" strokeWidth={2.5} />
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Map Footer Status Bar */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1 pt-1 border-t border-zinc-800/60">
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-500">Estado del camión:</span>
          <strong className={isArrived ? 'text-emerald-400' : isAtDepotInitial ? 'text-amber-400' : 'text-cyan-400'}>
            {isAtDepotInitial
              ? 'Estacionado en Depósito Central (Listo para iniciar ruta)'
              : isArrived
              ? `Estacionado en ${solution.nodes[currentTo]?.label || `Nodo ${currentTo}`}`
              : `En ruta hacia ${solution.nodes[currentTo]?.label || `Nodo ${currentTo}`} (${Math.round(progress * 100)}%)`}
          </strong>
        </span>
        <span className="text-zinc-500 hidden md:inline">
          {isAtDepotInitial
            ? 'Listo para iniciar · Depósito Central'
            : `Paso ${currentStepIndex + 1} de ${steps.length} · Tramo: ${currentStepData.from} → ${currentStepData.to}`}
        </span>
      </div>
    </div>
  );
};
