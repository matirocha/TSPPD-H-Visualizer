import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Truck } from 'lucide-react';
import { cn } from '../lib/cn';
import { Solution, AnimationPhase } from '../types/solution';
import { calculateNodePositions, arcMidpoint, curvedArcPath, interpolateQuadratic } from '../lib/geometry';

interface RouteCanvasProps {
  solution: Solution;
  currentStep: number;
  phase: AnimationPhase;
  phaseProgress: number; // 0 to 1
}

export function RouteCanvas({ solution, currentStep, phase, phaseProgress }: RouteCanvasProps) {
  const width = 600;
  const height = 500;
  
  const nodePositions = useMemo(() => {
    if (!solution || !solution.nodes) return [];
    return calculateNodePositions(solution.nodes.length, width, height, 40);
  }, [solution, width, height]);

  if (!solution || !solution.nodes || nodePositions.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-zinc-500">Sin datos de ruta</div>;
  }

  const { steps, nodes } = solution;

  const currentStepData = steps.find(s => s.stepIndex === currentStep);
  const currentFrom = currentStepData?.from ?? 0;
  const currentTo = currentStepData?.to ?? 0;

  // Truck position
  const fromPos = nodePositions[currentFrom];
  const toPos = nodePositions[currentTo];
  const controlPos = {
    x: (fromPos.x + toPos.x) / 2 - (toPos.y - fromPos.y) * 0.2,
    y: (fromPos.y + toPos.y) / 2 + (toPos.x - fromPos.x) * 0.2,
  };

  const truckPos = (phase === 'moving' && currentStepData) 
    ? interpolateQuadratic(fromPos, controlPos, toPos, phaseProgress)
    : (phase === 'idle' && currentStep === 0) ? nodePositions[0] : toPos;

  return (
    <div className="relative w-full aspect-[6/5] bg-transparent">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <marker id="arrow-visited" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-emerald-500 opacity-80" />
          </marker>
          <marker id="arrow-current" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-emerald-400" />
          </marker>
          <marker id="arrow-future" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-zinc-700" />
          </marker>
        </defs>

        {/* Edges */}
        {steps.map((step, idx) => {
          const from = nodePositions[step.from];
          const to = nodePositions[step.to];
          const path = curvedArcPath(from, to, 0.2);
          const mid = arcMidpoint(from, to, 0.2);
          const isVisited = step.stepIndex < currentStep;
          const isCurrent = step.stepIndex === currentStep;
          const isFuture = step.stepIndex > currentStep;

          let strokeClass = "";
          let markerEnd = "";
          let strokeWidth = 2;
          let strokeDasharray = "";

          if (isVisited) {
            strokeClass = "stroke-emerald-500 opacity-80";
            markerEnd = "url(#arrow-visited)";
          } else if (isCurrent) {
            strokeClass = "stroke-emerald-400";
            markerEnd = "url(#arrow-current)";
            strokeWidth = 3;
            strokeDasharray = "6,4";
          } else {
            strokeClass = "stroke-zinc-700";
            markerEnd = "url(#arrow-future)";
            strokeDasharray = "4,4";
          }

          return (
            <g key={`edge-${idx}`}>
              <path
                d={path}
                fill="none"
                className={cn("transition-colors duration-500", strokeClass)}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                markerEnd={markerEnd}
              />
              {/* Distance label */}
              <rect
                x={mid.x - 12}
                y={mid.y - 8}
                width="24"
                height="16"
                rx="4"
                className="fill-zinc-900/80 stroke-zinc-700/50"
                strokeWidth={1}
              />
              <text
                x={mid.x}
                y={mid.y + 3}
                textAnchor="middle"
                className="text-[10px] fill-zinc-300 font-mono"
              >
                {step.distance}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, idx) => {
          const pos = nodePositions[idx];
          const isDepot = node.isDepot;
          const isCurrentTarget = currentStepData?.to === idx;
          const isVisited = steps.some(s => s.to === idx && s.stepIndex < currentStep) || (isDepot && currentStep > 0);
          
          let circleClass = "fill-zinc-800 stroke-zinc-600";
          let r = 16;
          
          if (isDepot) {
            circleClass = "fill-amber-400 stroke-amber-500";
            r = 20;
          } else if (isCurrentTarget) {
            circleClass = "fill-emerald-400 stroke-emerald-300 animate-pulse";
          } else if (isVisited) {
            circleClass = "fill-emerald-500/30 stroke-emerald-500";
          }

          return (
            <g key={`node-${idx}`} transform={`translate(${pos.x}, ${pos.y})`}>
              <circle r={r} strokeWidth="2" className={cn("transition-colors duration-300", circleClass)} />
              {isDepot ? (
                <text y={4} textAnchor="middle" className="text-xs font-bold fill-amber-950">D</text>
              ) : (
                <text y={4} textAnchor="middle" className="text-xs font-bold fill-zinc-200">{node.label}</text>
              )}
              {!isDepot && (
                <text y={r + 14} textAnchor="middle" className="text-[10px] fill-zinc-400">
                  {`α:${node.alpha} β:${node.beta}`}
                </text>
              )}
            </g>
          );
        })}

        {/* Truck */}
        {truckPos && (
          <g transform={`translate(${truckPos.x}, ${truckPos.y})`}>
            <circle r={10} className="fill-red-500 stroke-red-300" strokeWidth={2} />
            <Truck className="w-4 h-4 text-white -ml-2 -mt-2" strokeWidth={2.5} />
          </g>
        )}
      </svg>
    </div>
  );
}
