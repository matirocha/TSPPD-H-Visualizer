import React from 'react';
import { Sparkles, Route, AlertCircle, Boxes, Users, Layers } from 'lucide-react';
import { SolutionData, StepData } from '../types/solution';
import { formatNumber, formatDistance } from '../lib/utils';
import { getStepPolicyNumber } from '../lib/policyUtils';

interface MetricsOverviewProps {
  solution: SolutionData;
  currentStep: StepData;
  currentStepIndex: number;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  solution,
  currentStep,
  currentStepIndex,
}) => {
  const totalAlpha = solution.nodes
    .filter((n) => !n.isDepot)
    .reduce((acc, n) => acc + n.alpha, 0);

  const totalBeta = solution.nodes
    .filter((n) => !n.isDepot)
    .reduce((acc, n) => acc + n.beta, 0);

  const totalOps = solution.steps.reduce((acc, s) => acc + s.handlingCount, 0);
  const currentOccupancy = currentStep.aOnTruck + currentStep.bOnTruck;
  const occupancyPct = Math.round((currentOccupancy / (solution.capacity || 1)) * 100);
  const activePol = getStepPolicyNumber(currentStep);

  return (
    <div className="w-full bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shadow-lg">
      {/* 1. Objective Value */}
      <div className="flex items-center gap-2.5 min-w-[170px]">
        <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
              Objetivo Z*
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
              Óptimo
            </span>
          </div>
          <span className="text-sm font-black font-mono tracking-tight text-white">
            {formatNumber(solution.objectiveValue, 2)}
          </span>
        </div>
      </div>

      <div className="hidden sm:block h-6 w-px bg-zinc-800" />

      {/* 2. Routing Distance */}
      <div className="flex items-center gap-2.5 min-w-[160px]">
        <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Route className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
            Distancia Total
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold font-mono text-zinc-100">
              {formatDistance(solution.totalDistance)}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              (Tramo: {formatDistance(currentStep.distance)})
            </span>
          </div>
        </div>
      </div>

      <div className="hidden sm:block h-6 w-px bg-zinc-800" />

      {/* 3. Handling Cost */}
      <div className="flex items-center gap-2.5 min-w-[160px]">
        <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
              Costo Handling
            </span>
            <span className="text-[9px] font-mono text-amber-400/90 font-medium">
              h={solution.h ?? 0.1}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold font-mono text-amber-300">
              +{formatNumber(solution.handlingCost, 2)}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              ({totalOps} ops)
            </span>
          </div>
        </div>
      </div>

      <div className="hidden md:block h-6 w-px bg-zinc-800" />

      {/* 4. Vehicle Capacity & Load */}
      <div className="flex items-center gap-2.5 min-w-[180px]">
        <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Boxes className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
            Carga Camión (Q={solution.capacity})
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="font-bold text-zinc-100">
              {currentOccupancy}/{solution.capacity}
            </span>
            <span className="text-[10px] text-zinc-500">({occupancyPct}%)</span>
            <span className="text-zinc-600">|</span>
            <span className="text-rose-400 text-[11px]">α:{currentStep.aOnTruck}</span>
            <span className="text-cyan-400 text-[11px]">β:{currentStep.bOnTruck}</span>
          </div>
        </div>
      </div>

      <div className="hidden lg:block h-6 w-px bg-zinc-800" />

      {/* 5. Demand & Node Step Info */}
      <div className="flex items-center gap-2.5 min-w-[160px]">
        <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Users className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
            Demanda ({solution.numCustomers} Clientes)
          </span>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-rose-400 font-semibold">Σα:{totalAlpha}</span>
            <span className="text-zinc-600">&middot;</span>
            <span className="text-cyan-400 font-semibold">Σβ:{totalBeta}</span>
            <span className="text-zinc-600">&middot;</span>
            <span className="text-emerald-400 font-medium text-[10px]">
              Paso {currentStepIndex + 1}/{solution.steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Dynamic Policy 3 Active Decision Tile */}
      {solution.model === 'TSPPD-H_3' && (
        <>
          <div className="hidden xl:block h-6 w-px bg-zinc-800" />
          <div className="flex items-center gap-2.5 min-w-[170px]">
            <div className={`p-1.5 rounded-xl border ${
              currentStep.to === 0
                ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                : activePol === 1
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
            }`}>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
                {currentStep.to === 0 ? 'Depósito' : `Pol. Cliente ${currentStep.to}`}
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                {currentStep.to === 0 ? (
                  <span className="text-zinc-300 font-bold">Depósito Central</span>
                ) : (
                  <>
                    <span className={`font-bold ${activePol === 1 ? 'text-purple-300' : 'text-sky-300'}`}>
                      P{activePol}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold border ${
                      activePol === 1
                        ? 'bg-purple-500/15 text-purple-200 border-purple-500/40'
                        : 'bg-sky-500/15 text-sky-200 border-sky-500/40'
                    }`}>
                      {activePol === 1 ? 's=1' : 's=0'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
