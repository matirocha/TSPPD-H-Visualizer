import React, { useMemo } from 'react';
import { Compass, RotateCcw } from 'lucide-react';
import { SolutionData, StepData, NodeDef, MapLayoutMode } from '../types/solution';
import { computeNodeCoordinates } from '../lib/mds';

interface TourMapProps {
  solution: SolutionData;
  currentStep: StepData;
  currentStepIndex: number;
  progress: number; // 0 to 1 along the active step edge
  layoutMode: MapLayoutMode;
  onToggleLayoutMode: () => void;
  onSelectNode: (node: NodeDef) => void;
}

export const TourMap: React.FC<TourMapProps> = ({
  solution,
  currentStep,
  currentStepIndex,
  progress,
  layoutMode,
  onToggleLayoutMode,
  onSelectNode,
}) => {
  // Enhanced larger dimensions
  const width = 800;
  const height = 540;

  // Compute 2D node coordinates with generous padding
  const nodeCoords = useMemo(() => {
    return computeNodeCoordinates(
      solution.nodes,
      solution.distMatrix,
      width,
      height,
      layoutMode
    );
  }, [solution.nodes, solution.distMatrix, layoutMode]);

  // Current edge start and end
  const fromPos = nodeCoords[currentStep.from] || { x: width / 2, y: height / 2 };
  const toPos = nodeCoords[currentStep.to] || { x: width / 2, y: height / 2 };

  // Interpolate truck position
  const truckX = fromPos.x + (toPos.x - fromPos.x) * progress;
  const truckY = fromPos.y + (toPos.y - fromPos.y) * progress;

  // Calculate truck angle in degrees
  const angleRad = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
  const angleDeg = (angleRad * 180) / Math.PI;

  // Build list of tour segments
  const tourSegments = useMemo(() => {
    const segments: {
      fromId: number;
      toId: number;
      from: { x: number; y: number };
      to: { x: number; y: number };
      dist: number;
      isCompleted: boolean;
      isActive: boolean;
      isUpcoming: boolean;
      stepIdx: number;
    }[] = [];

    for (let i = 0; i < solution.tour.length - 1; i++) {
      const u = solution.tour[i];
      const v = solution.tour[i + 1];
      const pU = nodeCoords[u];
      const pV = nodeCoords[v];
      const dist = solution.distMatrix[u]?.[v] || 0;

      if (pU && pV) {
        segments.push({
          fromId: u,
          toId: v,
          from: pU,
          to: pV,
          dist,
          isCompleted: i < currentStepIndex,
          isActive: i === currentStepIndex,
          isUpcoming: i > currentStepIndex,
          stepIdx: i,
        });
      }
    }
    return segments;
  }, [solution.tour, solution.distMatrix, nodeCoords, currentStepIndex]);

  return (
    <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 p-4 shadow-xl flex flex-col relative overflow-hidden">
      {/* Header controls inside map */}
      <div className="flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Mapa de Ruteo del Camión
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                Paso {currentStepIndex + 1} de {solution.steps.length}
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              {solution.nodes[currentStep.from]?.label} &rarr; {solution.nodes[currentStep.to]?.label} ({solution.distMatrix[currentStep.from]?.[currentStep.to]} km)
            </p>
          </div>
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLayoutMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Alternar entre distribución por Distancias Reales (MDS) y Circular"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
            <span>Modo: {layoutMode === 'mds' ? 'MDS (Distancias Reales)' : 'Circular'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Map - Significantly Larger and Higher Definition */}
      <div className="relative w-full h-[480px] md:h-[540px] lg:h-[580px] bg-zinc-950/95 rounded-xl border border-zinc-800/80 overflow-hidden flex items-center justify-center shadow-inner">
        {/* Subtle grid pattern background */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#71717a" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />
        </svg>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full relative z-0 select-none"
        >
          <defs>
            {/* Glow filters */}
            <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Marker Arrows */}
            <marker
              id="arrow-completed"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
            </marker>

            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>

            <marker
              id="arrow-upcoming"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 7 5 L 0 8 z" fill="#52525b" />
            </marker>
          </defs>

          {/* 1. All background edges between nodes */}
          {solution.nodes.map((uNode) =>
            solution.nodes.map((vNode) => {
              if (uNode.id >= vNode.id) return null;
              const pU = nodeCoords[uNode.id];
              const pV = nodeCoords[vNode.id];
              if (!pU || !pV) return null;
              return (
                <line
                  key={`bg-edge-${uNode.id}-${vNode.id}`}
                  x1={pU.x}
                  y1={pU.y}
                  x2={pV.x}
                  y2={pV.y}
                  stroke="#27272a"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.35"
                />
              );
            })
          )}

          {/* 2. Tour Segments */}
          {tourSegments.map((seg, idx) => {
            const midX = (seg.from.x + seg.to.x) / 2;
            const midY = (seg.from.y + seg.to.y) / 2;

            if (seg.isCompleted) {
              return (
                <g key={`tour-seg-${idx}`}>
                  <line
                    x1={seg.from.x}
                    y1={seg.from.y}
                    x2={seg.to.x}
                    y2={seg.to.y}
                    stroke="#10b981"
                    strokeWidth="3"
                    opacity="0.8"
                    markerEnd="url(#arrow-completed)"
                  />
                  {/* Distance label */}
                  <rect
                    x={midX - 16}
                    y={midY - 9}
                    width="32"
                    height="16"
                    rx="4"
                    fill="#18181b"
                    stroke="#10b981"
                    strokeWidth="1"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill="#a7f3d0"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {seg.dist}
                  </text>
                </g>
              );
            }

            if (seg.isActive) {
              return (
                <g key={`tour-seg-${idx}`}>
                  {/* Glow underlay */}
                  <line
                    x1={seg.from.x}
                    y1={seg.from.y}
                    x2={seg.to.x}
                    y2={seg.to.y}
                    stroke="#0284c7"
                    strokeWidth="8"
                    opacity="0.45"
                    filter="url(#glow-cyan)"
                  />
                  {/* Active animated line */}
                  <line
                    x1={seg.from.x}
                    y1={seg.from.y}
                    x2={seg.to.x}
                    y2={seg.to.y}
                    stroke="#38bdf8"
                    strokeWidth="4"
                    strokeDasharray="8 4"
                    markerEnd="url(#arrow-active)"
                  />
                  {/* Distance badge */}
                  <rect
                    x={midX - 20}
                    y={midY - 11}
                    width="40"
                    height="20"
                    rx="5"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  <text
                    x={midX}
                    y={midY + 3.5}
                    textAnchor="middle"
                    fill="#e0f2fe"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {seg.dist}km
                  </text>
                </g>
              );
            }

            // Upcoming segment
            return (
              <g key={`tour-seg-${idx}`}>
                <line
                  x1={seg.from.x}
                  y1={seg.from.y}
                  x2={seg.to.x}
                  y2={seg.to.y}
                  stroke="#52525b"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  opacity="0.6"
                  markerEnd="url(#arrow-upcoming)"
                />
              </g>
            );
          })}

          {/* 3. Nodes */}
          {solution.nodes.map((node) => {
            const pos = nodeCoords[node.id];
            if (!pos) return null;
            const isDepot = node.isDepot;
            const isCurrentDestination = node.id === currentStep.to;
            const isCurrentOrigin = node.id === currentStep.from;

            return (
              <g
                key={`node-render-${node.id}`}
                className="cursor-pointer group"
                onClick={() => onSelectNode(node)}
              >
                {/* Fixed Destination Pulse Ring (Fixed SVG animate on radius and opacity, locked at pos.x, pos.y) */}
                {isCurrentDestination && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="32"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                  >
                    <animate
                      attributeName="r"
                      values="26;36;26"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.2;0.9"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Node Outer Circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isDepot ? 26 : 22}
                  fill={isDepot ? '#064e3b' : isCurrentDestination ? '#0c4a6e' : '#18181b'}
                  stroke={
                    isDepot
                      ? '#10b981'
                      : isCurrentDestination
                      ? '#38bdf8'
                      : isCurrentOrigin
                      ? '#e0f2fe'
                      : '#3f3f46'
                  }
                  strokeWidth={isCurrentDestination || isDepot ? 3 : 2}
                  filter={isDepot ? 'url(#glow-emerald)' : undefined}
                />

                {/* Node Inner Label */}
                {isDepot ? (
                  <text
                    x={pos.x}
                    y={pos.y + 5}
                    textAnchor="middle"
                    fill="#ecfdf5"
                    fontSize="13"
                    fontFamily="sans-serif"
                    fontWeight="extrabold"
                  >
                    D0
                  </text>
                ) : (
                  <text
                    x={pos.x}
                    y={pos.y + 5}
                    textAnchor="middle"
                    fill="#f4f4f5"
                    fontSize="13"
                    fontFamily="monospace"
                    fontWeight="extrabold"
                  >
                    C{node.id}
                  </text>
                )}

                {/* Demands badges below node (Alpha deliver in Rose, Beta pickup in Cyan) */}
                {!isDepot && (
                  <g transform={`translate(${pos.x - 26}, ${pos.y + 26})`}>
                    <rect
                      x="0"
                      y="0"
                      width="52"
                      height="16"
                      rx="4"
                      fill="#09090b"
                      stroke="#27272a"
                      strokeWidth="1"
                    />
                    <text
                      x="13"
                      y="12"
                      textAnchor="middle"
                      fill="#f43f5e"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      &alpha;{node.alpha}
                    </text>
                    <line x1="26" y1="2" x2="26" y2="14" stroke="#27272a" strokeWidth="1" />
                    <text
                      x="39"
                      y="12"
                      textAnchor="middle"
                      fill="#06b6d4"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      &beta;{node.beta}
                    </text>
                  </g>
                )}

                {isDepot && (
                  <text
                    x={pos.x}
                    y={pos.y + 40}
                    textAnchor="middle"
                    fill="#34d399"
                    fontSize="12"
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    Depósito Principal
                  </text>
                )}
              </g>
            );
          })}

          {/* 4. Animated Truck Marker */}
          <g
            transform={`translate(${truckX}, ${truckY}) rotate(${angleDeg})`}
            className="pointer-events-none"
          >
            {/* Truck aura */}
            <circle
              cx="0"
              cy="0"
              r="20"
              fill="#0284c7"
              opacity="0.35"
              filter="url(#glow-cyan)"
            />
            {/* Truck chassis */}
            <rect
              x="-18"
              y="-10"
              width="36"
              height="20"
              rx="5"
              fill="#0284c7"
              stroke="#e0f2fe"
              strokeWidth="2"
            />
            {/* Truck cab */}
            <rect
              x="8"
              y="-8"
              width="8"
              height="16"
              rx="3"
              fill="#38bdf8"
            />
            {/* Headlights */}
            <circle cx="16" cy="-5" r="2" fill="#fef08a" />
            <circle cx="16" cy="5" r="2" fill="#fef08a" />
          </g>
        </svg>

        {/* Floating Legend */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800/80 text-xs text-zinc-400 font-mono shadow-md">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm" />
              Depósito (Nodo 0)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-3 h-3 rounded-full bg-zinc-700 inline-block border border-zinc-500" />
              Clientes (1..N)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
              &alpha; Demanda (Entrega)
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" />
              &beta; Oferta (Recolección)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
