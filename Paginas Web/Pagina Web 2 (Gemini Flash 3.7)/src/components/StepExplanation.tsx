import React from 'react';
import { FileText, Route, PackageCheck, PackagePlus, AlertCircle, ArrowRight } from 'lucide-react';
import { SolutionData, StepData } from '../types/solution';
import { formatDistance, formatNumber } from '../lib/utils';

interface StepExplanationProps {
  solution: SolutionData;
  currentStep: StepData;
  currentStepIndex: number;
}

export const StepExplanation: React.FC<StepExplanationProps> = ({
  solution,
  currentStep,
  currentStepIndex,
}) => {
  const fromNode = solution.nodes[currentStep.from];
  const toNode = solution.nodes[currentStep.to];

  return (
    <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/90 p-4 shadow-xl flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Detalle y Explicación del Paso {currentStepIndex + 1}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Desglose de operaciones logísticas, entregas, recolecciones y costos en este tramo
            </p>
          </div>
        </div>

        {/* Origin -> Destination Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono">
          <span className="text-zinc-300 font-semibold">{fromNode?.label || `Nodo ${currentStep.from}`}</span>
          <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">{toNode?.label || `Nodo ${currentStep.to}`}</span>
        </div>
      </div>

      {/* Main explanation content */}
      <div className="bg-zinc-950/70 rounded-xl p-3.5 border border-zinc-800/80 text-sm text-zinc-300 leading-relaxed font-sans shadow-inner">
        {/* Render HTML explanation safely */}
        <div
          className="[&>strong]:text-white [&>strong]:font-semibold [&>span]:font-semibold"
          dangerouslySetInnerHTML={{ __html: currentStep.explanation }}
        />
      </div>

      {/* Quick Step Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
        {/* 1. Distance */}
        <div className="px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center gap-2.5">
          <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Route className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Distancia</span>
            <span className="text-xs font-bold text-zinc-100 font-mono">{formatDistance(currentStep.distance)}</span>
          </div>
        </div>

        {/* 2. Deliveries Alpha */}
        <div className="px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center gap-2.5">
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
            <PackageCheck className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Entrega &alpha;</span>
            <span className="text-xs font-bold text-rose-400 font-mono">{currentStep.deliverA} uds</span>
          </div>
        </div>

        {/* 3. Pickups Beta */}
        <div className="px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center gap-2.5">
          <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400">
            <PackagePlus className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Recolección &beta;</span>
            <span className="text-xs font-bold text-cyan-400 font-mono">{currentStep.pickupB} uds</span>
          </div>
        </div>

        {/* 4. Handling Cost */}
        <div className="px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center gap-2.5">
          <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">Handling</span>
            <span className="text-xs font-bold text-amber-400 font-mono">
              {currentStep.handlingCount} op ({formatNumber(currentStep.handlingCost, 2)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
