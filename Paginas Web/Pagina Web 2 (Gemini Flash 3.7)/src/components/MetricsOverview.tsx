import React from 'react';
import { Route, Gauge, AlertCircle, Sparkles } from 'lucide-react';
import { SolutionData, StepData } from '../types/solution';
import { formatNumber, formatDistance } from '../lib/utils';

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
  const currentTotalLoad = currentStep.aOnTruck + currentStep.bOnTruck;
  const utilization = Math.min(100, Math.round((currentTotalLoad / solution.capacity) * 100));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {/* 1. Función Objetivo Total (Hero Bento) */}
      <div className="col-span-2 md:col-span-2 lg:col-span-2 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-4 border border-zinc-800/90 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Función Objetivo (Z*)
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
            Óptimo Global
          </span>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {formatNumber(solution.objectiveValue, 2)}
          </span>
          <span className="text-xs text-zinc-400 font-normal">costo total ponderado</span>
        </div>

        {/* Breakdown formula */}
        <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Ruteo:</span>
            <span className="text-zinc-200 font-semibold">{formatDistance(solution.totalDistance)}</span>
          </div>
          <span className="text-zinc-600 font-bold">+</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Handling:</span>
            <span className="text-amber-400 font-semibold">{formatNumber(solution.handlingCost, 2)}</span>
          </div>
          <span className="text-zinc-600 font-bold">|</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>h:</span>
            <span className="text-cyan-400 font-semibold">{solution.h}</span>
          </div>
        </div>
      </div>

      {/* 2. Distancia Total de Ruteo */}
      <div className="rounded-2xl bg-zinc-900/70 p-4 border border-zinc-800/90 shadow-md relative group hover:border-cyan-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-cyan-400" />
            Distancia Total
          </span>
        </div>
        <div className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">
          {formatDistance(solution.totalDistance)}
        </div>
        <p className="text-[11px] text-zinc-400 mt-2 flex items-center gap-1 font-mono">
          <span>{solution.tour.length - 1} arcos recorridos</span>
        </p>
      </div>

      {/* 3. Costo y Conflictos de Manipulación (Handling) */}
      <div className="rounded-2xl bg-zinc-900/70 p-4 border border-zinc-800/90 shadow-md relative group hover:border-amber-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            Handling (LIFO)
          </span>
          {solution.handlingCost > 0 ? (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Con Conflicto
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Cero Handling
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-amber-300 font-mono tracking-tight">
          {formatNumber(solution.handlingCost, 2)}
        </div>
        <p className="text-[11px] text-zinc-400 mt-2 font-mono">
          Costo unitario h = {solution.h}
        </p>
      </div>

      {/* 4. Capacidad y Carga en Tránsito */}
      <div className="col-span-2 md:col-span-1 lg:col-span-1 rounded-2xl bg-zinc-900/70 p-4 border border-zinc-800/90 shadow-md relative group hover:border-rose-500/40 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-rose-400" />
            Carga en Camión
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            Paso {currentStepIndex + 1}/{solution.steps.length}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {currentTotalLoad} <span className="text-xs text-zinc-400 font-normal">/ {solution.capacity} Q</span>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-400">
            {utilization}%
          </span>
        </div>

        {/* Utilization Mini Bar */}
        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-rose-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>
    </div>
  );
};
