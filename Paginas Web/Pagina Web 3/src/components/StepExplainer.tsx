import React from 'react';
import { Solution } from '../types/tsppd';
import { BookOpen, Scale } from 'lucide-react';

interface StepExplainerProps {
  solution: Solution;
  currentStepIndex: number;
}

export const StepExplainer: React.FC<StepExplainerProps> = ({
  solution,
  currentStepIndex,
}) => {
  const currentStep = solution.steps[currentStepIndex] || solution.steps[0];
  const targetNode = solution.nodes.find((n) => n.id === currentStep.to);

  return (
    <div className="w-full bg-zinc-950 rounded-2xl border border-zinc-800/80 p-4 lg:p-5 flex flex-col gap-4 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100">
              Explicación Detallada del Paso {currentStepIndex + 1}
            </h3>
            <p className="text-xs text-zinc-400">
              Interpretación técnica y logística del modelo TSPPD-H
            </p>
          </div>
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          Arco ({currentStep.from} → {currentStep.to})
        </span>
      </div>

      {/* Explanation Text Block with HTML formatting */}
      <div className="bg-zinc-900/70 rounded-xl border border-zinc-800/80 p-4 text-xs text-zinc-300 leading-relaxed space-y-2">
        <div
          dangerouslySetInnerHTML={{ __html: currentStep.explanation }}
          className="[&>strong]:text-zinc-100 [&>strong]:font-semibold [&>span]:font-semibold"
        />
      </div>

      {/* Grid of Key Step Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        
        {/* Distance */}
        <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800/80 flex flex-col gap-1">
          <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
            Distancia Recorrida
          </span>
          <span className="text-base font-bold font-mono text-zinc-100">
            {currentStep.distance} km
          </span>
          <span className="text-[10px] text-zinc-400">
            Costo de ruteo base
          </span>
        </div>

        {/* Deliver Alpha */}
        <div className="bg-zinc-900/60 rounded-xl p-3 border border-rose-500/20 flex flex-col gap-1">
          <span className="text-[10px] uppercase font-mono text-rose-400 tracking-wider">
            Entrega (α)
          </span>
          <span className="text-base font-bold font-mono text-rose-300">
            {currentStep.deliverA} un.
          </span>
          <span className="text-[10px] text-zinc-400">
            Hacia {targetNode?.label}
          </span>
        </div>

        {/* Pickup Beta */}
        <div className="bg-zinc-900/60 rounded-xl p-3 border border-cyan-500/20 flex flex-col gap-1">
          <span className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider">
            Recolección (β)
          </span>
          <span className="text-base font-bold font-mono text-cyan-300">
            {currentStep.pickupB} un.
          </span>
          <span className="text-[10px] text-zinc-400">
            Para el depósito central
          </span>
        </div>

        {/* Handling Ops */}
        <div className={`rounded-xl p-3 border flex flex-col gap-1 ${
          currentStep.handlingCount > 0
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-zinc-900/60 border-zinc-800/80'
        }`}>
          <span className={`text-[10px] uppercase font-mono tracking-wider ${
            currentStep.handlingCount > 0 ? 'text-amber-400 font-bold' : 'text-zinc-500'
          }`}>
            Manipulación (Handling)
          </span>
          <span className={`text-base font-bold font-mono ${
            currentStep.handlingCount > 0 ? 'text-amber-300' : 'text-zinc-400'
          }`}>
            {currentStep.handlingCount} ops (${currentStep.handlingCost.toFixed(2)})
          </span>
          <span className="text-[10px] text-zinc-400">
            {currentStep.handlingCount > 0 ? 'Conflicto LIFO detectado' : 'Sin obstrucción'}
          </span>
        </div>

      </div>

      {/* Theoretical Context Note */}
      <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-200/90 leading-relaxed">
        <Scale className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-emerald-300 font-semibold">Fundamento Matemático del TSPPD-H:</strong>
          {' '}El modelo linealiza el costo de manipulación mediante la restricción de orden LIFO. Cuando la mercancía recolectada de tipo β bloquea las entregas requeridas de tipo α en la puerta trasera, el optimizador Gurobi incurre en una penalización de costo unitario h = {solution.h}, encontrando el equilibrio exacto entre la menor distancia global de viaje y el mínimo esfuerzo físico de reestiba.
        </div>
      </div>

    </div>
  );
};
