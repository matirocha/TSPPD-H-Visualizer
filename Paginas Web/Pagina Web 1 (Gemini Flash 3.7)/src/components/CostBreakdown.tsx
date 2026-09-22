import React from "react";
import { SolutionData } from "@/types/tsppd";
import { Calculator, Navigation, Layers } from "lucide-react";

interface CostBreakdownProps {
  solution: SolutionData;
}

export const CostBreakdown: React.FC<CostBreakdownProps> = ({ solution }) => {
  const z_R = solution.totalDistance;
  const z_H = solution.handlingCost;
  const z_total = solution.objectiveValue;

  const routingPercent = Math.round((z_R / z_total) * 100);
  const handlingPercent = 100 - routingPercent;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Calculator className="w-4 h-4 text-emerald-400" />
          <span>Desglose de la Función Objetivo</span>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
          z* = {z_total.toFixed(2)}
        </span>
      </div>

      {/* Formula & Cost Distribution */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium text-amber-400">
            <Navigation className="w-3.5 h-3.5" /> Costo de Ruteo (z_R): {z_R} ({routingPercent}%)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-purple-400">
            <Layers className="w-3.5 h-3.5" /> Manejo LIFO (z_H): {z_H.toFixed(2)} ({handlingPercent}%)
          </span>
        </div>

        {/* Split Bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-950 p-[1px] border border-zinc-800">
          <div
            className="h-full bg-amber-500 rounded-l-full transition-all duration-700"
            style={{ width: `${routingPercent}%` }}
            title={`Ruteo: ${z_R}`}
          />
          <div
            className="h-full bg-purple-500 rounded-r-full transition-all duration-700"
            style={{ width: `${handlingPercent}%` }}
            title={`Manipulación: ${z_H.toFixed(2)}`}
          />
        </div>
      </div>

      {/* Equations Card */}
      <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 font-mono text-[11px] sm:text-xs text-zinc-300 space-y-2">
        <div className="text-zinc-400 text-[10px] uppercase tracking-wider font-semibold">
          Ecuación del Modelo TSPPD-H:
        </div>
        <div className="text-emerald-300 font-bold overflow-x-auto py-0.5">
          min z = ∑(c_ij · x_ij) + ∑(v_i^k) - ∑(h_a · α_i)
        </div>
        <div className="text-zinc-400 text-[10px] leading-relaxed">
          Donde <strong>c_ij</strong> es la matriz de distancias euclidianas y <strong>v_i^k</strong> es el costo de penalización por desapilar la posición <em>k</em> en el cliente <em>i</em> con factor <strong>h = {solution.h}</strong>.
        </div>
      </div>
    </div>
  );
};
