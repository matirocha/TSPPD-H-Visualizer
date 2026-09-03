import React from "react";
import { SolutionData, StepDef } from "../types/tsppd";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { 
  Target, 
  Navigation, 
  AlertTriangle, 
  PackageCheck, 
  Sliders, 
  Route 
} from "lucide-react";

interface MetricsBarProps {
  solution: SolutionData;
  currentStepIndex: number;
  currentStep: StepDef;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  solution,
  currentStepIndex,
  currentStep,
}) => {
  const currentTotalLoad = currentStep.aOnTruck + currentStep.bOnTruck;
  const utilizationPct = Math.min(100, Math.round((currentTotalLoad / (solution.capacity || 1)) * 100));

  // Acumulado hasta el paso actual
  const cumulativeDistance = solution.steps
    .slice(0, currentStepIndex + 1)
    .reduce((acc, s) => acc + s.distance, 0);

  const cumulativeHandling = solution.steps
    .slice(0, currentStepIndex + 1)
    .reduce((acc, s) => acc + s.handlingCost, 0);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* 1. Función Objetivo Z */}
      <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Función Obj. (Z)
          </span>
          <Target className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-xl font-bold font-mono text-emerald-400">
            {solution.objectiveValue.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500">óptimo</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
          <span>h = {solution.h}</span>
          <Badge variant="default" className="text-[9px] px-1 py-0">Mínimo</Badge>
        </div>
      </Card>

      {/* 2. Distancia Total / Ruteo */}
      <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-blue-500/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Distancia Ruteo
          </span>
          <Navigation className="h-4 w-4 text-blue-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-xl font-bold font-mono text-zinc-100">
            {solution.totalDistance}
          </span>
          <span className="text-[10px] text-zinc-400">km total</span>
        </div>
        <div className="mt-1 text-[11px] text-zinc-400 font-mono">
          Progreso: <span className="text-blue-400">{cumulativeDistance} km</span>
        </div>
      </Card>

      {/* 3. Costo de Manipulación (Handling) */}
      <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-amber-500/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Costo Handling
          </span>
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-xl font-bold font-mono text-amber-400">
            {solution.handlingCost.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-400">penalización</span>
        </div>
        <div className="mt-1 text-[11px] text-zinc-400 font-mono">
          Paso act: <span className="text-amber-300 font-semibold">{currentStep.handlingCount} movs</span> ({currentStep.handlingCost.toFixed(2)})
        </div>
      </Card>

      {/* 4. Capacidad del Camión (Q) */}
      <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-cyan-500/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Capacidad (Q)
          </span>
          <PackageCheck className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-xl font-bold font-mono text-cyan-400">
            {currentTotalLoad} / {solution.capacity}
          </span>
          <span className="text-[10px] text-zinc-400">slots</span>
        </div>
        {/* Barra de progreso de carga */}
        <div className="mt-2 w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              utilizationPct > 85 ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
      </Card>

      {/* 5. Carga a Bordo Detallada */}
      <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-purple-500/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Carga en Camión
          </span>
          <Sliders className="h-4 w-4 text-purple-400" />
        </div>
        <div className="mt-2 flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span className="text-zinc-200">α: {currentStep.aOnTruck}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
            <span className="text-zinc-200">β: {currentStep.bOnTruck}</span>
          </div>
        </div>
        <div className="mt-1 text-[11px] text-zinc-400">
          Libres: {solution.capacity - currentTotalLoad} slots
        </div>
      </Card>

      {/* 6. Recorrido / Tour */}
      <Card className="p-3.5 bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Etapa Actual
          </span>
          <Route className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-xl font-bold font-mono text-zinc-100">
            {currentStepIndex + 1} / {solution.steps.length}
          </span>
          <span className="text-[10px] text-zinc-400">paradas</span>
        </div>
        <div className="mt-1 text-[11px] text-zinc-400 truncate">
          Tramo: <span className="text-emerald-400 font-semibold font-mono">N{currentStep.from} → N{currentStep.to}</span>
        </div>
      </Card>
    </section>
  );
};
