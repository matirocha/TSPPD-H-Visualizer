import React from "react";
import { SolutionData } from "@/types/tsppd";
import { Truck, Sparkles, Navigation, Layers, RotateCcw, FolderOpen, Zap } from "lucide-react";

interface HeaderProps {
  solution: SolutionData | null;
  selectedFilename: string;
  onOpenSelector: () => void;
  onReset: () => void;
  solutionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  solution,
  selectedFilename,
  onOpenSelector,
  onReset,
  solutionsCount,
}) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl sticky top-0 z-30 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Brand and Title */}
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/20 flex-shrink-0">
            <div className="w-full h-full bg-zinc-950 rounded-[11px] flex items-center justify-center">
              <Truck className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                TSPPD-H Visualizer
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Gurobi Opt
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span>Traveling Salesperson with Pickup, Delivery & LIFO Handling</span>
            </p>
          </div>
        </div>

        {/* Center/Right: Quick Metrics */}
        {solution && (
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-center">
            {/* Objective Value */}
            <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-emerald-500/30 shadow-sm flex flex-col items-center min-w-[90px]">
              <span className="text-[10px] uppercase font-semibold text-emerald-400/90 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> F. Objetivo
              </span>
              <span className="font-mono text-base font-bold text-emerald-400">
                {solution.objectiveValue.toFixed(2)}
              </span>
            </div>

            {/* Routing Cost */}
            <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-amber-500/30 shadow-sm flex flex-col items-center min-w-[85px]">
              <span className="text-[10px] uppercase font-semibold text-amber-400/90 tracking-wider flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Ruteo (z_R)
              </span>
              <span className="font-mono text-base font-bold text-amber-400">
                {solution.totalDistance}
              </span>
            </div>

            {/* Handling Cost */}
            <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-purple-500/30 shadow-sm flex flex-col items-center min-w-[85px]">
              <span className="text-[10px] uppercase font-semibold text-purple-400/90 tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" /> Manejo (z_H)
              </span>
              <span className="font-mono text-base font-bold text-purple-400">
                {solution.handlingCost.toFixed(2)}
              </span>
            </div>

            {/* Capacity */}
            <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-cyan-500/30 shadow-sm flex flex-col items-center min-w-[75px]">
              <span className="text-[10px] uppercase font-semibold text-cyan-400/90 tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> Capacidad Q
              </span>
              <span className="font-mono text-base font-bold text-cyan-400">
                {solution.capacity}
              </span>
            </div>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onOpenSelector}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all active:scale-[0.98]"
            title="Seleccionar otra solución de Outputs"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span className="truncate max-w-[140px] sm:max-w-[180px]">
              {selectedFilename ? selectedFilename.replace(".txt", "") : "Explorar Outputs"}
            </span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-cyan-500/20 rounded-md text-cyan-300">
              {solutionsCount}
            </span>
          </button>

          <button
            onClick={onReset}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60 transition-all active:scale-[0.98]"
            title="Reiniciar animación"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
