import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Truck, MapPin, ZoomIn, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { SolutionData, NodeDef, PlaybackStatus, AnimationSpeed } from '../types/solution';
import { calculateNodePositions, arcMidpoint, curvedArcPath, interpolateQuadratic } from '../lib/geometry';
import { getNodePolicyNumber, getStepPolicyNumber } from '../lib/policyUtils';
import { PlaybackControls } from './PlaybackControls';

interface RouteCanvasProps {
  solution: SolutionData;
  currentStepIndex: number;
  progress: number; // 0 to 1
  isArrived: boolean;
  playbackStatus: PlaybackStatus;
  speed: AnimationSpeed;
  isContinuousMode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSelectStep: (index: number) => void;
  onChangeSpeed: (speed: AnimationSpeed) => void;
  onToggleContinuousMode: (val: boolean) => void;
  onSelectNode?: (node: NodeDef) => void;
}

export const RouteCanvas: React.FC<RouteCanvasProps> = ({
  solution,
  currentStepIndex,
  progress,
  isArrived,
  playbackStatus,
  speed,
  isContinuousMode,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
  onSelectStep,
  onChangeSpeed,
  onToggleContinuousMode,
  onSelectNode,
}) => {
  const width = 640;
  const height = 540;
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

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
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 transition-opacity"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      {isFullscreen && <div className="w-full h-[25rem] invisible pointer-events-none" />}
      <div
        className={cn(
          "transition-all duration-200 flex flex-col",
          isFullscreen
            ? "fixed inset-3 md:inset-6 z-50 bg-zinc-950/98 border border-zinc-700/90 rounded-2xl shadow-2xl p-4 md:p-6 overflow-y-auto backdrop-blur-2xl justify-between"
            : "rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-3.5 gap-2.5 shadow-xl relative overflow-hidden"
        )}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight font-sans">
              Mapa de Ruteo
            </h3>
            {isFullscreen && (
              <span className="text-[0.625rem] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                Pantalla completa
              </span>
            )}
          </div>

          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
            title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Ver en pantalla completa"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* SVG Canvas Arena */}
        <div
          className={cn(
            "relative w-full bg-zinc-900/50 rounded-xl border border-zinc-800/90 overflow-hidden flex items-center justify-center",
            isFullscreen
              ? "flex-1 min-h-[28.75rem] max-h-[calc(100vh-13.125rem)] my-2"
              : "aspect-[16/10] max-h-[18.4375rem]"
          )}
        >
        {/* Floating Zoom Button */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-zinc-950/85 backdrop-blur-md border border-zinc-800/90 p-1 rounded-xl shadow-lg">
          <button
            onClick={() => setZoomScale((prev) => (prev >= 2.0 ? 1 : Number((prev + 0.25).toFixed(2))))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-mono font-medium transition-all cursor-pointer border border-zinc-700/60 shadow-xs active:scale-95"
            title="Aumentar zoom del mapa (clic para incrementar)"
          >
            <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
            <span>{zoomScale > 1 ? `${zoomScale}x` : 'Zoom +'}</span>
          </button>
          {zoomScale > 1 && (
            <button
              onClick={() => setZoomScale(1)}
              className="p-1 px-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono transition-all cursor-pointer border border-zinc-800 active:scale-95"
              title="Restablecer zoom a 1x"
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
            </button>
          )}
        </div>

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

          <g
            transform={`translate(${width / 2}, ${height / 2}) scale(${zoomScale}) translate(${-width / 2}, ${-height / 2})`}
            style={{ transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
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
            const nodePol = !isDepot && solution.model === 'TSPPD-H_3' ? getNodePolicyNumber(solution, node.id) : 1;

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

                {/* Policy 3 indicator badge above customer node */}
                {solution.model === 'TSPPD-H_3' && !isDepot && (
                  <g transform={`translate(0, ${-(r + 11)})`}>
                    <rect
                      x={-14}
                      y={-7}
                      width={28}
                      height={14}
                      rx={4}
                      className={nodePol === 1 ? 'fill-purple-950/95 stroke-purple-500/80' : 'fill-sky-950/95 stroke-sky-500/80'}
                      strokeWidth={1.2}
                    />
                    <text
                      y={3.5}
                      textAnchor="middle"
                      className={cn(
                        'text-[8.5px] font-mono font-black pointer-events-none',
                        nodePol === 1 ? 'fill-purple-300' : 'fill-sky-300'
                      )}
                    >
                      P{nodePol}
                    </text>
                  </g>
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
          </g>
        </svg>
      </div>

      {/* Integrated Route Playback & Progress Controls */}
      <div className="pt-2 border-t border-zinc-800/80">
        <PlaybackControls
          currentStepIndex={currentStepIndex}
          totalSteps={solution.steps.length}
          solution={solution}
          status={playbackStatus}
          speed={speed}
          progress={progress}
          isArrived={isArrived}
          isContinuousMode={isContinuousMode}
          onPlay={onPlay}
          onPause={onPause}
          onPrev={onPrev}
          onNext={onNext}
          onReset={onReset}
          onSelectStep={onSelectStep}
          onChangeSpeed={onChangeSpeed}
          onToggleContinuousMode={onToggleContinuousMode}
          className="bg-transparent border-0 p-0 shadow-none rounded-none"
        />
      </div>
    </div>
    </>
  );
};
