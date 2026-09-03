import React, { useMemo } from "react";
import { SolutionData, StepDef } from "../types/tsppd";
import { computeNodePositions } from "../lib/mdsLayout";
import { Card, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { MapPin, Navigation2, Home, PackagePlus, PackageMinus } from "lucide-react";

interface RouteMapProps {
  solution: SolutionData;
  currentStepIndex: number;
  currentStep: StepDef;
  animationProgress: number; // 0 to 1 representing position along the current arc
  onSelectStep: (index: number) => void;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  solution,
  currentStepIndex,
  currentStep,
  animationProgress,
  onSelectStep,
}) => {
  const width = 760;
  const height = 480;

  // Compute 2D node positions from distance matrix
  const positions = useMemo(() => {
    return computeNodePositions(solution.nodes, solution.distMatrix, width, height);
  }, [solution]);

  // Current truck position and angle
  const fromPos = positions[currentStep.from] || { x: 100, y: 100 };
  const toPos = positions[currentStep.to] || { x: 200, y: 200 };

  const truckX = fromPos.x + (toPos.x - fromPos.x) * animationProgress;
  const truckY = fromPos.y + (toPos.y - fromPos.y) * animationProgress;
  const truckAngle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x) * (180 / Math.PI);

  return (
    <Card className="flex flex-col h-full bg-zinc-900/60 border-zinc-800/80 overflow-hidden relative">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-zinc-800/60 bg-zinc-950/40">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
            <MapPin className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm">Red de Ruteo & Desplazamiento</CardTitle>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-400" />
            <span className="text-zinc-300 text-[11px]">Depósito (0)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-zinc-300 text-[11px]">Clientes (1-{solution.numCustomers})</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
            Arco: {currentStep.from} → {currentStep.to} ({currentStep.distance} km)
          </Badge>
        </div>
      </CardHeader>

      {/* SVG Canvas */}
      <div className="relative flex-1 w-full min-h-[360px] bg-gradient-to-b from-zinc-950/80 to-zinc-900/40 p-2 select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Glow filters */}
            <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="truck-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.8" />
            </filter>

            {/* Gradient for active path */}
            <linearGradient id="active-path-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Arrow Marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
            </marker>

            <marker
              id="arrow-dimmed"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#27272a" />
            </marker>
          </defs>

          {/* Grid lines decoration */}
          <g stroke="rgba(255,255,255,0.03)" strokeWidth="1">
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`gx-${i}`} x1={i * 90} y1="0" x2={i * 90} y2={height} />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`gy-${i}`} x1="0" y1={i * 85} x2={width} y2={i * 85} />
            ))}
          </g>

          {/* 1. Inactive Tour Path Lines */}
          {solution.steps.map((step, idx) => {
            const pFrom = positions[step.from];
            const pTo = positions[step.to];
            if (!pFrom || !pTo) return null;

            const isPast = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            if (isCurrent) return null; // Drawn separately with glow

            return (
              <g key={`tour-arc-${idx}`}>
                <line
                  x1={pFrom.x}
                  y1={pFrom.y}
                  x2={pTo.x}
                  y2={pTo.y}
                  stroke={isPast ? "#059669" : "#27272a"}
                  strokeWidth={isPast ? 2 : 1.5}
                  strokeDasharray={isPast ? "none" : "4 4"}
                  strokeOpacity={isPast ? 0.45 : 0.6}
                  className="cursor-pointer hover:stroke-emerald-400 transition-colors"
                  onClick={() => onSelectStep(idx)}
                />
                {/* Distance text on arc */}
                <text
                  x={(pFrom.x + pTo.x) / 2}
                  y={(pFrom.y + pTo.y) / 2 - 6}
                  fill={isPast ? "#059669" : "#52525b"}
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {step.distance}km
                </text>
              </g>
            );
          })}

          {/* 2. Active Tour Arc with Glow & Animation */}
          {fromPos && toPos && (
            <g>
              {/* Outer halo */}
              <line
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#10b981"
                strokeWidth="6"
                strokeOpacity="0.25"
                filter="url(#glow-line)"
              />
              {/* Main active line */}
              <line
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="url(#active-path-grad)"
                strokeWidth="3"
                markerEnd="url(#arrow)"
              />
              {/* Active distance label */}
              <rect
                x={(fromPos.x + toPos.x) / 2 - 28}
                y={(fromPos.y + toPos.y) / 2 - 16}
                width="56"
                height="20"
                rx="4"
                fill="#18181b"
                stroke="#10b981"
                strokeWidth="1"
              />
              <text
                x={(fromPos.x + toPos.x) / 2}
                y={(fromPos.y + toPos.y) / 2 - 2}
                fill="#10b981"
                fontSize="11"
                fontWeight="bold"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
                className="pointer-events-none"
              >
                {currentStep.distance} km
              </text>
            </g>
          )}

          {/* 3. Destination Node Arrival Pulse Ring */}
          {animationProgress >= 0.95 && (
            <circle
              cx={toPos.x}
              cy={toPos.y}
              r="34"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              className="animate-ping opacity-60"
            />
          )}

          {/* 4. Nodes */}
          {solution.nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;

            const isDepot = node.isDepot;
            const isSource = currentStep.from === node.id;
            const isTarget = currentStep.to === node.id;
            const isCurrentActive = isSource || isTarget;

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer transition-transform duration-150 hover:scale-110"
              >
                {/* Outer halo for active nodes */}
                {isCurrentActive && (
                  <circle
                    r={isDepot ? 28 : 24}
                    fill={isTarget ? "rgba(16, 185, 129, 0.15)" : "rgba(6, 182, 212, 0.15)"}
                    stroke={isTarget ? "#10b981" : "#06b6d4"}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="animate-spin"
                    style={{ animationDuration: "12s" }}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={isDepot ? 22 : 18}
                  fill={isDepot ? "#064e3b" : isTarget ? "#1e293b" : "#18181b"}
                  stroke={
                    isDepot
                      ? "#10b981"
                      : isTarget
                      ? "#10b981"
                      : isSource
                      ? "#06b6d4"
                      : "#3f3f46"
                  }
                  strokeWidth={isCurrentActive ? 2.5 : 1.5}
                />

                {/* Node Center Label / Icon */}
                <text
                  textAnchor="middle"
                  dy="5"
                  fill={isDepot ? "#34d399" : "#f4f4f5"}
                  fontSize={isDepot ? "13" : "12"}
                  fontWeight="bold"
                  fontFamily="JetBrains Mono"
                  className="pointer-events-none"
                >
                  {isDepot ? "D" : node.id}
                </text>

                {/* Node Pill Banner (ID & Alpha/Beta) */}
                <g transform={`translate(0, ${isDepot ? 30 : 26})`}>
                  <rect
                    x="-42"
                    y="0"
                    width="84"
                    height="18"
                    rx="9"
                    fill="#18181b"
                    stroke={isCurrentActive ? "#10b981" : "#27272a"}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    y="13"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    fill="#a1a1aa"
                    className="pointer-events-none"
                  >
                    {isDepot ? (
                      <tspan fill="#34d399">Depósito</tspan>
                    ) : (
                      <>
                        <tspan fill="#f43f5e">α:{node.alpha}</tspan>{" "}
                        <tspan fill="#38bdf8">β:{node.beta}</tspan>
                      </>
                    )}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 5. Animated Truck (Vehicle on Arc) */}
          <g
            transform={`translate(${truckX}, ${truckY}) rotate(${truckAngle})`}
            filter="url(#truck-glow)"
            className="pointer-events-none"
          >
            {/* Truck chassis & cabin graphic */}
            <rect
              x="-18"
              y="-10"
              width="36"
              height="20"
              rx="4"
              fill="#065f46"
              stroke="#10b981"
              strokeWidth="1.5"
            />
            {/* Truck cabin (front) */}
            <path
              d="M 6 -9 L 17 -6 L 17 6 L 6 9 Z"
              fill="#047857"
              stroke="#34d399"
              strokeWidth="1"
            />
            {/* Windshield */}
            <rect
              x="8"
              y="-5"
              width="5"
              height="10"
              rx="1.5"
              fill="#6ee7b7"
              opacity="0.85"
            />
            {/* Wheels */}
            <circle cx="-10" cy="-11" r="2.5" fill="#18181b" stroke="#34d399" strokeWidth="0.8" />
            <circle cx="10" cy="-11" r="2.5" fill="#18181b" stroke="#34d399" strokeWidth="0.8" />
            <circle cx="-10" cy="11" r="2.5" fill="#18181b" stroke="#34d399" strokeWidth="0.8" />
            <circle cx="10" cy="11" r="2.5" fill="#18181b" stroke="#34d399" strokeWidth="0.8" />

            {/* Pulsing indicator on top of truck */}
            <circle cx="0" cy="0" r="3.5" fill="#34d399" className="animate-pulse" />
          </g>
        </svg>

        {/* Live HUD Floating Tag */}
        <div className="absolute bottom-3 left-3 bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-lg px-3 py-1.5 flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <Navigation2 className="h-3.5 w-3.5 text-emerald-400 rotate-45 animate-bounce" />
            <span className="text-zinc-400">En tránsito:</span>
            <span className="font-mono text-zinc-100 font-bold">
              Nodo {currentStep.from} → Nodo {currentStep.to}
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <div className="flex items-center space-x-1 text-zinc-400 font-mono">
            <span>Progreso tramo:</span>
            <span className="text-emerald-400 font-bold">
              {Math.round(animationProgress * 100)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
