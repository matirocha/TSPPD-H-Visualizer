import React from 'react';
import { Truck, RefreshCw, Layers, Table, BookOpen } from 'lucide-react';
import { SolutionMeta, ModelType } from '../types/solution';

interface HeaderProps {
  solutions: SolutionMeta[];
  selectedFilename: string;
  activeModel: ModelType;
  onSelectModel: (model: ModelType) => void;
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
  activeModel,
  onSelectModel,
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
                <span className={`text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                  activeModel === 'TSPPD-H_1'
                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    : activeModel === 'TSPPD-H_2'
                    ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                    : activeModel === 'TSPPD-H_3'
                    ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  {activeModel === 'TSPPD-H_1'
                    ? 'TSPPD-H_1 (Pol. 1)'
                    : activeModel === 'TSPPD-H_2'
                    ? 'TSPPD-H_2 (Pol. 2)'
                    : activeModel === 'TSPPD-H_3'
                    ? 'TSPPD-H_3 (Pol. 3)'
                    : 'TSPPD-H (General)'}
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
          {/* Quick Model Toggle Pill */}
          <div className="hidden sm:flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-xl p-0.5 shadow-sm">
            <button
              onClick={() => onSelectModel('TSPPD-H')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeModel === 'TSPPD-H'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Modelo General (Ecuaciones 1-16)"
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
              title="Modelo con Política 1 (Ecuaciones 17-25)"
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
              title="Modelo con Política 2 (Ecuaciones 26-27)"
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
              title="Modelo con Política 3 (Ecuaciones 31-48)"
            >
              Pol. 3
            </button>
          </div>

          {/* Solution Explorer / ID Selector Button */}
          <button
            onClick={onOpenSelectorModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-600 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm whitespace-nowrap group"
            title="Abrir explorador de soluciones para cambiar el ID de la instancia"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Explorar Soluciones</span>
            {currentMeta && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                ID #{currentMeta.instanceId}
              </span>
            )}
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

          {/* Model Button (Renamed from "Modelo (1-16)" to "Modelo") */}
          <button
            onClick={onOpenModelModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-sm ${
              activeModel === 'TSPPD-H_1'
                ? 'bg-purple-950/40 hover:bg-purple-900/40 border-purple-500/40 text-purple-200 hover:text-white'
                : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Elegir entre modelo TSPPD-H o TSPPD-H_1 y ver formulaciones matemáticas"
          >
            <BookOpen className={`w-3.5 h-3.5 ${activeModel === 'TSPPD-H_1' ? 'text-purple-400' : 'text-amber-400'}`} />
            <span className="font-semibold">Modelo</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
              {activeModel}
            </span>
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
