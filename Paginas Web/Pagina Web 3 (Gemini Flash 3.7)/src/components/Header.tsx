import React from 'react';
import { Solution, SolutionSummary } from '../types/tsppd';
import { Truck, RotateCw, Layers, MapPin, DollarSign, Activity, ChevronDown } from 'lucide-react';

interface HeaderProps {
  solutions: SolutionSummary[];
  selectedSolution: Solution | null;
  selectedFilename: string;
  onSelectSolution: (filename: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  solutions,
  selectedSolution,
  selectedFilename,
  onSelectSolution,
  onRefresh,
  isLoading,
}) => {
  return (
    <header className="bg-zinc-900/80 backdrop-blur-md border-b border-white/10 px-4 lg:px-6 py-3.5 sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Brand / Title & Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-zinc-100 tracking-tight">
                  TSPPD-H Visualizer
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  Optimizador Gurobi
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Simulador de Ruteo con Entregas, Recolecciones y Manipulación LIFO
              </p>
            </div>
          </div>

          {/* Solution Selector Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedFilename}
              onChange={(e) => onSelectSolution(e.target.value)}
              className="bg-zinc-950/90 text-zinc-200 text-xs font-mono border border-zinc-700/80 rounded-lg px-3.5 py-2 pr-8 appearance-none cursor-pointer hover:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors shadow-sm"
              disabled={isLoading || solutions.length === 0}
            >
              {solutions.length === 0 ? (
                <option value="">No hay soluciones en Outputs/</option>
              ) : (
                solutions.map((sol) => (
                  <option key={sol.filename} value={sol.filename}>
                    ID {sol.instanceId} ({sol.numCustomers} Clientes, h={sol.h}) — Obj: {sol.objectiveValue.toFixed(1)}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 pointer-events-none" />
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Recargar soluciones de la carpeta Outputs"
            className="p-2 rounded-lg bg-zinc-800/80 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Real-time KPIs if solution is loaded */}
        {selectedSolution && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Obj Val */}
            <div className="bg-zinc-950/80 border border-emerald-500/40 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Costo Total (Z*)</div>
                <div className="text-sm font-bold text-emerald-300 font-mono">
                  {selectedSolution.objectiveValue.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Distance / Routing Cost */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Distancia</div>
                <div className="text-sm font-semibold text-zinc-200 font-mono">
                  {selectedSolution.totalDistance} km
                </div>
              </div>
            </div>

            {/* Handling Cost */}
            <div className={`bg-zinc-950/80 border rounded-lg px-3 py-1.5 flex items-center gap-2 ${
              selectedSolution.handlingCost > 0 ? 'border-amber-500/40' : 'border-zinc-800'
            }`}>
              <Activity className={`w-4 h-4 ${selectedSolution.handlingCost > 0 ? 'text-amber-400' : 'text-zinc-500'}`} />
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Costo Handling</div>
                <div className={`text-sm font-mono font-semibold ${selectedSolution.handlingCost > 0 ? 'text-amber-300' : 'text-zinc-400'}`}>
                  {selectedSolution.handlingCost.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Capacity Q */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Capacidad Q</div>
                <div className="text-sm font-semibold text-purple-300 font-mono">
                  {selectedSolution.capacity} slots
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </header>
  );
};
