import React from 'react';
import { FileText, Route, PackageCheck, PackagePlus, AlertCircle, ArrowRight } from 'lucide-react';
import { SolutionData, StepData } from '../types/solution';
import { formatDistance, formatNumber } from '../lib/utils';
import { getStepPolicyNumber } from '../lib/policyUtils';

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
  const isPolicy3 = solution.model === 'TSPPD-H_3';
  const stepPolicy = getStepPolicyNumber(currentStep);

  return (
    <div className="rounded-3xl bg-zinc-950/90 border border-zinc-800/90 p-4 lg:p-5 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Explicación del Paso {currentStepIndex + 1}
            </h3>
            <p className="text-xs text-zinc-400">
              Desglose narrativo y operaciones logísticas del tramo
            </p>
          </div>
        </div>

        {/* Origin -> Destination Badge + Compact Policy 3 Pill */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isPolicy3 && currentStep.to !== 0 && (
            <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${
              stepPolicy === 1
                ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                : 'bg-sky-500/20 text-sky-200 border-sky-500/40'
            }`}>
              P{stepPolicy} ({stepPolicy === 1 ? 's=1' : 's=0'})
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs font-mono">
            <span className="text-zinc-200 font-semibold">{fromNode?.label || `Nodo ${currentStep.from}`}</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold">{toNode?.label || `Nodo ${currentStep.to}`}</span>
          </div>
        </div>
      </div>

      {/* Main explanation text box */}
      <div className="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-800/80 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans shadow-inner">
        <div
          className="[&>strong]:text-white [&>strong]:font-semibold [&>span]:font-semibold"
          dangerouslySetInnerHTML={{ __html: currentStep.explanation }}
        />
      </div>

      {/* Quick Step Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {/* 1. Distance */}
        <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2.5 shadow-sm">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Route className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[0.625rem] uppercase font-mono text-zinc-400 block">Distancia</span>
            <span className="text-xs font-bold text-zinc-100 font-mono">{formatDistance(currentStep.distance)}</span>
          </div>
        </div>

        {/* 2. Deliveries Alpha */}
        <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2.5 shadow-sm">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
            <PackageCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[0.625rem] uppercase font-mono text-zinc-400 block">Entrega α</span>
            <span className="text-xs font-bold text-rose-400 font-mono">{currentStep.deliverA} uds</span>
          </div>
        </div>

        {/* 3. Pickups Beta */}
        <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2.5 shadow-sm">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <PackagePlus className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[0.625rem] uppercase font-mono text-zinc-400 block">Recolección β</span>
            <span className="text-xs font-bold text-cyan-400 font-mono">{currentStep.pickupB} uds</span>
          </div>
        </div>

        {/* 4. Handling Cost */}
        <div className="px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2.5 shadow-sm">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[0.625rem] uppercase font-mono text-zinc-400 block">Handling</span>
            <span className="text-xs font-bold text-amber-400 font-mono">
              {currentStep.handlingCount} op (+{formatNumber(currentStep.handlingCost, 2)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
