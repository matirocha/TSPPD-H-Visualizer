import React, { useMemo } from 'react';
import { Solution } from '../types/tsppd';
import { computeNodeCoordinates } from '../utils/mds';
import { ArrowRight } from 'lucide-react';

interface NetworkMapProps {
  solution: Solution;
  currentStepIndex: number;
  travelProgress: number; // 0 to 1
  onSelectStep?: (index: number) => void;
}

export const NetworkMap: React.FC<NetworkMapProps> = ({
  solution,
  currentStepIndex,
  travelProgress,
  onSelectStep,
}) => {
  const width = 640;
  const height = 400;
  const padding = 55;

  // Compute 2D coordinates for all nodes via MDS
  const coordsMap = useMemo(() => {
    return computeNodeCoordinates(solution.nodes, solution.distMatrix, width, height, padding);
  }, [solution.nodes, solution.distMatrix]);

  const currentStep = solution.steps[currentStepIndex] || solution.steps[0];
  const fromCoord = coordsMap.get(currentStep?.from ?? 0) || { x: width / 2, y: height / 2 };
  const toCoord = coordsMap.get(currentStep?.to ?? 0) || { x: width / 2, y: height / 2 };

  // Calculate truck position along the active arc
  const truckX = fromCoord.x + (toCoord.x - fromCoord.x) * travelProgress;
  const truckY = fromCoord.y + (toCoord.y - fromCoord.y) * travelProgress;

  // Calculate truck angle
  const angleRad = Math.atan2(toCoord.y - fromCoord.y, toCoord.x - fromCoord.x);
  const angleDeg = (angleRad * 180) / Math.PI;

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col shadow-lg">
      {/* Top Header of Map Card */}
      <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-semibold text-zinc-200 tracking-wide">
            Topología Espacial del Tour (MDS 2D)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> α: Entrega
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> β: Recolección
          </span>
          <span className="text-zinc-500">|</span>
          <span className="text-emerald-400 font-semibold">
            Tramo: {currentStep ? `${currentStep.from === 0 ? 'Depósito' : `C${currentStep.from}`} → ${currentStep.to === 0 ? 'Depósito' : `C${currentStep.to}`}` : ''}
          </span>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative flex-1 w-full min-h-[360px] flex items-center justify-center p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full max-h-[460px] select-none"
        >
          <defs>
            {/* Arrow Marker for Tour Path */}
            <marker
              id="arrow-head"
              markerWidth="8"
              markerHeight="8"
              refX="18"
              refY="4"
              orient="auto"
            >
              <polygon points="0 1, 8 4, 0 7" fill="#10b981" />
            </marker>

            <marker
              id="arrow-head-active"
              markerWidth="9"
              markerHeight="9"
              refX="20"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 1, 9 4.5, 0 8" fill="#38bdf8" />
            </marker>

            {/* Glowing Gradients */}
            <linearGradient id="activeArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>

            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Grid Pattern */}
          <pattern id="grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="rgba(255,255,255,0.06)" />
          </pattern>
          <rect width={width} height={height} fill="url(#grid-dots)" />

          {/* Step Arcs */}
          {solution.steps.map((step, idx) => {
            const pFrom = coordsMap.get(step.from);
            const pTo = coordsMap.get(step.to);
            if (!pFrom || !pTo) return null;

            const isPassed = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            const isFuture = idx > currentStepIndex;

            // Distance mid point for text label
            const midX = (pFrom.x + pTo.x) / 2;
            const midY = (pFrom.y + pTo.y) / 2;

            if (isFuture) {
              return (
                <g key={`edge-${idx}`} className="opacity-40">
                  <line
                    x1={pFrom.x}
                    y1={pFrom.y}
                    x2={pTo.x}
                    y2={pTo.y}
                    stroke="rgba(148, 163, 184, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={midX}
                    y={midY - 4}
                    fill="rgba(148, 163, 184, 0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {step.distance}km
                  </text>
                </g>
              );
            }

            if (isPassed) {
              return (
                <g key={`edge-${idx}`} className="opacity-75">
                  <line
                    x1={pFrom.x}
                    y1={pFrom.y}
                    x2={pTo.x}
                    y2={pTo.y}
                    stroke="#10b981"
                    strokeWidth="2"
                    markerEnd="url(#arrow-head)"
                  />
                  <rect
                    x={midX - 14}
                    y={midY - 8}
                    width="28"
                    height="14"
                    rx="3"
                    fill="#09090b"
                    stroke="rgba(16, 185, 129, 0.4)"
                    strokeWidth="1"
                  />
                  <text
                    x={midX}
                    y={midY + 2.5}
                    fill="#34d399"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {step.distance}k
                  </text>
                </g>
              );
            }

            if (isActive) {
              return (
                <g key={`edge-${idx}`}>
                  {/* Glowing halo line */}
                  <line
                    x1={pFrom.x}
                    y1={pFrom.y}
                    x2={pTo.x}
                    y2={pTo.y}
                    stroke="#38bdf8"
                    strokeWidth="5"
                    strokeOpacity="0.4"
                    filter="url(#glowFilter)"
                  />
                  {/* Animated traveling dash */}
                  <line
                    x1={pFrom.x}
                    y1={pFrom.y}
                    x2={pTo.x}
                    y2={pTo.y}
                    stroke="url(#activeArcGrad)"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                    markerEnd="url(#arrow-head-active)"
                  />
                  {/* Distance badge */}
                  <rect
                    x={midX - 18}
                    y={midY - 10}
                    width="36"
                    height="18"
                    rx="4"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                  <text
                    x={midX}
                    y={midY + 2.5}
                    fill="#38bdf8"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {step.distance}km
                  </text>
                </g>
              );
            }

            return null;
          })}

          {/* Node Renderings */}
          {solution.nodes.map((node) => {
            const coord = coordsMap.get(node.id) || { x: 0, y: 0 };
            const isDepot = node.isDepot;
            const isOrigin = currentStep?.from === node.id;
            const isDestination = currentStep?.to === node.id;
            const isVisited = solution.steps.some(
              (s, i) => i <= currentStepIndex && (s.from === node.id || (i < currentStepIndex && s.to === node.id))
            );

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${coord.x}, ${coord.y})`}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={() => {
                  const targetStep = solution.steps.findIndex((s) => s.to === node.id);
                  if (targetStep >= 0 && onSelectStep) {
                    onSelectStep(targetStep);
                  }
                }}
              >
                {/* Highlight ring for active destination or origin */}
                {(isDestination || isOrigin) && (
                  <circle
                    r={isDepot ? 26 : 22}
                    fill="none"
                    stroke={isDestination ? '#38bdf8' : '#10b981'}
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    className="animate-spin origin-center"
                    style={{ animationDuration: '6s' }}
                  />
                )}

                {/* Node Main Circle */}
                <circle
                  r={isDepot ? 18 : 15}
                  fill={
                    isDepot
                      ? '#18181b'
                      : isDestination
                      ? '#0f172a'
                      : isVisited
                      ? '#064e3b'
                      : '#18181b'
                  }
                  stroke={
                    isDepot
                      ? '#fbbf24'
                      : isDestination
                      ? '#38bdf8'
                      : isVisited
                      ? '#10b981'
                      : '#52525b'
                  }
                  strokeWidth={isDepot ? 2.5 : isDestination ? 2.5 : 1.8}
                  filter={isDestination ? 'url(#glowFilter)' : undefined}
                />

                {/* Node Label or Icon */}
                {isDepot ? (
                  <text
                    y="4"
                    fill="#fbbf24"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    DEP
                  </text>
                ) : (
                  <text
                    y="4.5"
                    fill={isDestination ? '#38bdf8' : isVisited ? '#6ee7b7' : '#d4d4d8'}
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {node.id}
                  </text>
                )}

                {/* Demand Badges for Customers */}
                {!isDepot && (
                  <g transform="translate(0, 24)">
                    <rect
                      x="-26"
                      y="-7"
                      width="52"
                      height="14"
                      rx="3"
                      fill="#09090b"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="0.8"
                    />
                    <text
                      x="-13"
                      y="3.5"
                      fill="#f43f5e"
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      -{node.alpha}α
                    </text>
                    <text
                      x="13"
                      y="3.5"
                      fill="#22d3ee"
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      +{node.beta}β
                    </text>
                  </g>
                )}

                {/* Depot Label */}
                {isDepot && (
                  <g transform="translate(0, 26)">
                    <rect
                      x="-28"
                      y="-7"
                      width="56"
                      height="14"
                      rx="3"
                      fill="#09090b"
                      stroke="#fbbf24"
                      strokeWidth="0.8"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill="#fbbf24"
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      DEPÓSITO
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Traveling Animated Truck */}
          <g
            transform={`translate(${truckX}, ${truckY}) rotate(${angleDeg})`}
            className="pointer-events-none"
          >
            {/* Truck Glow Body */}
            <ellipse cx="0" cy="0" rx="14" ry="9" fill="#38bdf8" opacity="0.3" filter="url(#glowFilter)" />
            
            {/* Truck Chassis */}
            <rect
              x="-11"
              y="-7"
              width="22"
              height="14"
              rx="3"
              fill="#0284c7"
              stroke="#e0f2fe"
              strokeWidth="1.2"
            />
            {/* Cab Front */}
            <rect
              x="5"
              y="-5"
              width="5"
              height="10"
              rx="1.5"
              fill="#38bdf8"
            />
            {/* Wheels */}
            <rect x="-8" y="-9" width="4" height="2" rx="0.5" fill="#0f172a" />
            <rect x="-8" y="7" width="4" height="2" rx="0.5" fill="#0f172a" />
            <rect x="4" y="-9" width="4" height="2" rx="0.5" fill="#0f172a" />
            <rect x="4" y="7" width="4" height="2" rx="0.5" fill="#0f172a" />

            {/* Cargo dot */}
            <circle cx="-3" cy="0" r="2.5" fill="#facc15" />
          </g>
        </svg>
      </div>

      {/* Bottom Status Ribbon */}
      <div className="px-4 py-2 bg-zinc-900/80 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-emerald-400 font-medium">
            Paso {currentStepIndex + 1} de {solution.steps.length}
          </span>
          <span className="text-zinc-600">·</span>
          <span>
            {currentStep?.from === 0 ? 'Depósito' : `Cliente ${currentStep?.from}`}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 inline" />
          <span className="font-semibold text-zinc-200">
            {currentStep?.to === 0 ? 'Depósito' : `Cliente ${currentStep?.to}`}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>Distancia tramo: <strong className="text-zinc-200">{currentStep?.distance} km</strong></span>
          {currentStep?.handlingCost > 0 && (
            <span className="text-amber-400 font-semibold">
              ⚠️ Handling: +{currentStep.handlingCost.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
