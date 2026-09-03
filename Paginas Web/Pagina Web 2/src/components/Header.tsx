import React from 'react';
import { Truck, BookOpen, Grid, RefreshCw } from 'lucide-react';
import { SolutionMeta } from '../types/solution';

interface HeaderProps {
  solutions: SolutionMeta[];
  selectedFilename: string;
  onSelectSolution: (filename: string) => void;
  onOpenSelectorModal: () => void;
  onOpenModelModal: () => void;
  onOpenMatrixModal: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  solutions,
  selectedFilename,
  onOpenSelectorModal,
  onOpenModelModal,
  onOpenMatrixModal,
  isLoading,
  onRefresh,
}) => {
  const currentMeta = solutions.find((s) => s.filename === selectedFilename);

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950/50 border border-emerald-400/30">
              <Truck className="h-5 w-5 text-zinc-950 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  TSPPD-H <span className="text-emerald-400 font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">v2.0</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                  Gurobi Optimizer
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-normal">
                Visualizador Óptimo de Ruteo, Carga y Manejo LIFO
              </p>
            </div>
          </div>

          {/* Solution Selector Trigger on Mobile */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={onOpenSelectorModal}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-1.5"
            >
              <span>ID #{currentMeta?.instanceId || 1}</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Refrescar soluciones"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Center: Sleek Interactive Solution Switcher Button */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-center">
          <button
            onClick={onOpenSelectorModal}
            className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 px-4 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-700/80 hover:border-emerald-500/60 transition-all cursor-pointer shadow-md group"
            title="Abrir catálogo completo de soluciones"
          >
            <div className="flex items-center gap-2 text-left">
              <span className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                #{currentMeta?.instanceId || 1}
              </span>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors block">
                  {currentMeta ? `Instancia ID ${currentMeta.instanceId} (${currentMeta.numCustomers} Clientes)` : 'Seleccionar Solución'}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {currentMeta ? `Obj: ${currentMeta.objectiveValue.toFixed(1)} | Dist: ${currentMeta.totalDistance} km | H: ${currentMeta.handlingCost.toFixed(1)}` : 'Explorar Outputs/'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
              <span>Cambiar</span>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
              </svg>
            </div>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="hidden md:flex p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
            title="Refrescar lista de soluciones de Outputs/"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onOpenMatrixModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 hover:text-zinc-100 transition-all cursor-pointer shadow-sm"
          >
            <Grid className="h-3.5 w-3.5 text-cyan-400" />
            <span>Matriz de Costos</span>
          </button>

          <button
            onClick={onOpenModelModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-xs font-medium text-emerald-300 transition-all cursor-pointer shadow-sm"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            <span>Modelo TSPPD-H</span>
          </button>
        </div>
      </div>
    </header>
  );
};
