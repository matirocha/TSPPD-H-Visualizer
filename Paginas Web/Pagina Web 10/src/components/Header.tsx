import React from 'react';
import { Truck, RefreshCw, Layers } from 'lucide-react';
import { SolutionMeta, ModelType } from '../types/solution';

interface HeaderProps {
  solutions: SolutionMeta[];
  selectedFilename: string;
  activeModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  onSelectSolution: (filename: string) => void;
  onOpenSelectorModal: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  solutions,
  selectedFilename,
  activeModel,
  onSelectModel,
  onSelectSolution,
  onOpenSelectorModal,
  isLoading,
  onRefresh,
}) => {
  const currentMeta = solutions.find((s) => s.filename === selectedFilename);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-[1700px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-950/40 flex items-center justify-center">
            <div className="h-full w-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Truck className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center">
            <h1 className="text-base font-bold text-white tracking-tight font-sans">
              TSPPD-H Visualizer
            </h1>
          </div>
        </div>

        {/* Quick Policy Switcher, Solution Explorer & Refresh */}
        <div className="flex items-center gap-2.5">
          {/* Policy Selector Pills */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-xl p-0.5 shadow-xs">
            <button
              onClick={() => onSelectModel('TSPPD-H')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeModel === 'TSPPD-H'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Modelo General (Ecs. 1-16)"
            >
              General
            </button>
            <button
              onClick={() => onSelectModel('TSPPD-H_1')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeModel === 'TSPPD-H_1'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Política 1 (Rear Door, Ecs. 17-25)"
            >
              Pol. 1
            </button>
            <button
              onClick={() => onSelectModel('TSPPD-H_2')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeModel === 'TSPPD-H_2'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Política 2 (Front Fondo, Ecs. 26-27)"
            >
              Pol. 2
            </button>
            <button
              onClick={() => onSelectModel('TSPPD-H_3')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeModel === 'TSPPD-H_3'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Política 3 (Híbrida, Ecs. 31-48)"
            >
              Pol. 3
            </button>
          </div>

          {/* Solution Explorer Button */}
          <button
            onClick={onOpenSelectorModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-600 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer shadow-xs whitespace-nowrap group"
            title="Abrir catálogo para cambiar la instancia ID"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Explorar Soluciones</span>
            {currentMeta && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                ID #{currentMeta.instanceId}
              </span>
            )}
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
