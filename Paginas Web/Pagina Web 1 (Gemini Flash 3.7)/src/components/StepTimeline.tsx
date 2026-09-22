import React from "react";
import { SolutionData } from "@/types/tsppd";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";

interface StepTimelineProps {
  solution: SolutionData;
  currentStep: number;
  onSelectStep: (stepIdx: number) => void;
}

export const StepTimeline: React.FC<StepTimelineProps> = ({
  solution,
  currentStep,
  onSelectStep,
}) => {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl max-h-[460px] overflow-hidden">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Secuencia de Pasos del Tour</span>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          {solution.steps.length} Tramos
        </span>
      </div>

      {/* Steps List */}
      <div className="overflow-y-auto space-y-2 pr-1 flex-1">
        {solution.steps.map((step, idx) => {
          const fromNode = solution.nodes[step.from];
          const toNode = solution.nodes[step.to];
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;

          return (
            <div
              key={idx}
              onClick={() => onSelectStep(idx)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                isActive
                  ? "bg-cyan-950/40 border-cyan-500/70 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/40"
                  : isCompleted
                  ? "bg-zinc-950/40 border-zinc-800/80 hover:border-zinc-700 opacity-80"
                  : "bg-zinc-950/70 border-zinc-800/60 hover:border-zinc-700"
              }`}
            >
              {/* Top: Step number, distance, status */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? "bg-cyan-400 text-zinc-950"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-zinc-200">
                    Paso {idx + 1}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-amber-400/90 font-medium">
                    📏 {step.distance} km
                  </span>
                  {isCompleted && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
              </div>

              {/* Middle: Route trajectory */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                <span className={fromNode.isDepot ? "text-amber-400 font-bold" : "text-sky-300"}>
                  {fromNode.label}
                </span>
                <ArrowRight className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                <span className={toNode.isDepot ? "text-amber-400 font-bold" : "text-sky-300"}>
                  {toNode.label}
                </span>
              </div>

              {/* Bottom: Action badges */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-800/60 text-[11px]">
                {step.deliverA > 0 && (
                  <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-medium">
                    📦 Entrega {step.deliverA}α
                  </span>
                )}
                {step.pickupB > 0 && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-medium">
                    📥 Recoge {step.pickupB}β
                  </span>
                )}
                {step.handlingCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                    ⚠️ Manejo {step.handlingCount}
                  </span>
                )}
                {step.deliverA === 0 && step.pickupB === 0 && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 font-medium">
                    🏁 Retorno al Depósito
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
