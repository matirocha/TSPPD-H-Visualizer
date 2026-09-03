import React from 'react';
import { Truck, RefreshCw, Layers, Table, BookOpen, ChevronDown, Check } from 'lucide-react';
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
  onSelectSolution,
  onOpenSelectorModal,
  onOpenModelModal,
  onOpenMatrixModal,
  isLoading,
  onRefresh,
}) => {
  const currentMeta = solutions.find((s) => s.filename === selectedFilename);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center">
            <div className="h-full w-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Truck className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                TSPPD-H Visualizer
                <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Página 9 &middot; Gurobi Opt
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Simulación de ruteo y dinámica física de estiba LIFO con manipulación
            </p>
          </div>
        </div>

        {/* Quick Solution Selector Dropdown & Modal Openers */}
        <div className="flex items-center gap-2.5">
          {/* Solution Selector Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedFilename}
              onChange={(e) => onSelectSolution(e.target.value)}
              className="appearance-none bg-zinc-900/90 border border-zinc-700/80 hover:border-zinc-600 rounded-xl pl-3 pr-8 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer transition-all shadow-sm max-w-[200px] sm:max-w-[280px] truncate"
            >
              {solutions.map((s) => (
                <option key={s.filename} value={s.filename} className="bg-zinc-900 text-zinc-100 font-mono py-1">
                  ID #{s.instanceId} &middot; {s.numCustomers} Clientes &middot; Z*={s.objectiveValue.toFixed(2)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 pointer-events-none" />
          </div>

          {/* Modal Opener Button */}
          <button
            onClick={onOpenSelectorModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm whitespace-nowrap"
            title="Abrir catálogo completo con filtros y búsqueda"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Explorar Soluciones</span>
            <span className="md:hidden">Explorar</span>
          </button>

          {/* Distance Matrix Button */}
          <button
            onClick={onOpenMatrixModal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Ver matriz de distancias C_ij"
          >
            <Table className="w-3.5 h-3.5 text-cyan-400" />
            <span>Matriz C_ij</span>
          </button>

          {/* Model Formula Button */}
          <button
            onClick={onOpenModelModal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Ver formulación matemática (Ecuaciones 1-16)"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Modelo (1-16)</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Recargar soluciones de la carpeta Outputs/"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
