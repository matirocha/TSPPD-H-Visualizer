import React from "react";
import { SolutionData } from "@/types/tsppd";
import { Lightbulb, Layers, Cpu } from "lucide-react";

interface HandlingInspectorProps {
  solution: SolutionData;
  currentStep: number;
}

export const HandlingInspector: React.FC<HandlingInspectorProps> = ({
  solution,
  currentStep,
}) => {
  const currentStepData =
    currentStep >= 0 && currentStep < solution.steps.length
      ? solution.steps[currentStep]
      : null;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xl">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>Explicación Logística del Paso Actual</span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">
          {currentStep < 0 ? "Estado Inicial" : `Tramo ${currentStep + 1} de ${solution.steps.length}`}
        </span>
      </div>

      {/* Explanation Text */}
      <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80">
        {currentStep < 0 ? (
          <div>
            <strong>Estado Inicial (Depósito):</strong> El camión se encuentra en el <strong>Depósito (Nodo 0)</strong> cargado con{" "}
            <span className="text-red-400 font-semibold">{solution.nodes[0].alpha} unidades tipo α</span> que debe repartir a los {solution.numCustomers} clientes.
            El compartimiento de recolección β está vacío (0 unidades).
            <p className="mt-2 text-xs text-zinc-400">
              Presiona <strong>▶ Reproducir</strong> o avanza con <strong>Siguiente Paso</strong> para iniciar la ruta óptima.
            </p>
          </div>
        ) : currentStepData?.explanation ? (
          <div
            dangerouslySetInnerHTML={{ __html: currentStepData.explanation }}
            className="space-y-2"
          />
        ) : (
          <div>No hay información disponible para este paso.</div>
        )}
      </div>

      {/* Mathematical & LIFO Context Details */}
      {currentStepData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-200 block">Lógica del Solucionador</span>
              <p className="text-zinc-400 text-[11px] mt-0.5 leading-normal">
                Gurobi balanceó la distancia euclidiana ({currentStepData.distance} km) con el costo de remoción LIFO ({currentStepData.handlingCost.toFixed(2)}) para minimizar la función objetivo global.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-200 block">Política LIFO (Last-In, First-Out)</span>
              <p className="text-zinc-400 text-[11px] mt-0.5 leading-normal">
                Las mercancías β recogidas se apilan al final. Si se requiere entregar α mientras haya β en el camión, se incurre en una penalización por manipulación ($h = {solution.h}$).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
