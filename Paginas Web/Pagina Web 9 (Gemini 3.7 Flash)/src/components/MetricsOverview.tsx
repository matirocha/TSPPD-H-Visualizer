import React from 'react';
import { Sparkles, Route, AlertCircle, Package, Boxes, Users, ArrowRight } from 'lucide-react';
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
  const totalAlpha = solution.nodes
    .filter((n) => !n.isDepot)
    .reduce((acc, n) => acc + n.alpha, 0);

  const totalBeta = solution.nodes
    .filter((n) => !n.isDepot)
    .reduce((acc, n) => acc + n.beta, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. Objective Value Card */}
      <div className="rounded-2xl bg-zinc-900/80 border border-emerald-500/30 p-3.5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-emerald-950/20 group hover:border-emerald-500/60 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Función Objetivo (Z*)
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/30">
            Óptimo Gurobi
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-2xl font-black font-mono tracking-tight text-white flex items-baseline gap-1">
            {formatNumber(solution.objectiveValue, 2)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Ruteo ({solution.totalDistance}) + Handling ({formatNumber(solution.handlingCost, 2)})
          </p>
        </div>
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>Minimización (Eq. 1)</span>
          <span className="text-emerald-400 font-bold">h = {solution.h}</span>
        </div>
      </div>

      {/* 2. Routing / Distance Card */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-cyan-400 flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5 text-cyan-400" />
            Distancia de Ruteo
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {solution.tour.length - 1} arcos
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-2xl font-black font-mono tracking-tight text-zinc-100">
            {formatDistance(solution.totalDistance)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Tramo actual: {formatDistance(currentStep.distance)}
          </p>
        </div>
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>Ruta: {solution.tour.join(' → ')}</span>
        </div>
      </div>

      {/* 3. Handling Cost Card */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Costo de Handling
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {solution.steps.reduce((acc, s) => acc + s.handlingCount, 0)} ops tot
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-2xl font-black font-mono tracking-tight text-amber-300">
            +{formatNumber(solution.handlingCost, 2)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            En paso actual: +{formatNumber(currentStep.handlingCost, 2)} ({currentStep.handlingCount} ops)
          </p>
        </div>
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>Penalización LIFO</span>
          <span className="text-amber-400">v_i^k &middot; h</span>
        </div>
      </div>

      {/* 4. Vehicle Capacity & Current Load Card */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-rose-400 flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-rose-400" />
            Capacidad del Camión (Q)
          </span>
          <span className="text-[10px] font-mono font-bold text-zinc-300">
            Q = {solution.capacity}
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-2xl font-black font-mono tracking-tight text-zinc-100 flex items-baseline gap-2">
            <span>{currentStep.aOnTruck + currentStep.bOnTruck}</span>
            <span className="text-xs text-zinc-500 font-normal font-sans">/ {solution.capacity} slots ocupados</span>
          </div>
          <div className="flex items-center gap-2 mt-1 font-mono text-[11px]">
            <span className="text-rose-400">&alpha;: {currentStep.aOnTruck}</span>
            <span className="text-zinc-600">&middot;</span>
            <span className="text-cyan-400">&beta;: {currentStep.bOnTruck}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>Paso {currentStepIndex + 1} de {solution.steps.length}</span>
          <span>{Math.round(((currentStep.aOnTruck + currentStep.bOnTruck) / solution.capacity) * 100)}% estiba</span>
        </div>
      </div>

      {/* 5. Demand & Customers Balance Card */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono tracking-wider font-semibold text-indigo-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            Demanda Global
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {solution.numCustomers} Clientes
          </span>
        </div>
        <div className="my-1.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400 block">Total Entregas</span>
              <span className="text-lg font-bold font-mono text-rose-400">&alpha; = {totalAlpha}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-zinc-400 block">Total Recolecciones</span>
              <span className="text-lg font-bold font-mono text-cyan-400">&beta; = {totalBeta}</span>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>Depósito Nodo 0</span>
          <span className="text-emerald-400">Balance OK</span>
        </div>
      </div>
    </div>
  );
};
