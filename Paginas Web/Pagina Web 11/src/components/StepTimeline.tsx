import React from "react";
import { SolutionData, StepDef } from "../types/tsppd";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Route, CheckCircle2, ChevronRight, AlertTriangle, ArrowRight } from "lucide-react";

interface StepTimelineProps {
  solution: SolutionData;
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
}

export const StepTimeline: React.FC<StepTimelineProps> = ({
  solution,
  currentStepIndex,
  onSelectStep,
}) => {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800/80 shadow-md flex flex-col h-full">
      <CardHeader className="p-4 pb-2 border-b border-zinc-800/60 bg-zinc-950/40 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
            <Route className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm">Itinerario del Tour Completo</CardTitle>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          {solution.tour.join(" → ")}
        </span>
      </CardHeader>

      <CardContent className="p-3 overflow-y-auto max-h-[380px] space-y-1.5">
        {solution.steps.map((step, idx) => {
          const isSelected = idx === currentStepIndex;
          const isPast = idx < currentStepIndex;
          const isFinal = idx === solution.steps.length - 1;

          return (
            <div
              key={`timeline-step-${idx}`}
              onClick={() => onSelectStep(idx)}
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all duration-150 ${
                isSelected
                  ? "bg-zinc-800/90 border-emerald-500/70 shadow-sm text-white"
                  : isPast
                  ? "bg-zinc-950/40 border-zinc-800/40 text-zinc-400 hover:bg-zinc-800/40"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-700"
              }`}
            >
              {/* Left: Step number & from->to */}
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold ${
                    isSelected
                      ? "bg-emerald-500 text-zinc-950"
                      : isPast
                      ? "bg-zinc-800 text-emerald-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {idx + 1}
                </div>

                <div>
                  <div className="flex items-center space-x-1.5 font-mono text-xs font-semibold">
                    <span>
                      {step.from === 0 ? "Depósito (0)" : `Cliente ${step.from}`}
                    </span>
                    <ArrowRight className="h-3 w-3 text-zinc-500" />
                    <span className={step.to === 0 ? "text-emerald-400" : ""}>
                      {step.to === 0 ? "Depósito (0)" : `Cliente ${step.to}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Distancia: {step.distance} km
                  </span>
                </div>
              </div>

              {/* Right: Badges & Demands */}
              <div className="flex items-center space-x-2">
                {/* Alpha delivered */}
                {step.deliverA > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    -{step.deliverA} α
                  </span>
                )}

                {/* Beta picked up */}
                {step.pickupB > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    +{step.pickupB} β
                  </span>
                )}

                {/* Handling alert badge */}
                {step.handlingCount > 0 && (
                  <Badge variant="amber" className="text-[10px] px-1.5 py-0">
                    {step.handlingCount} ops
                  </Badge>
                )}

                <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-zinc-600'}`} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
