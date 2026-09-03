import React, { useState, useMemo } from 'react';
import { X, Search, Check, Layers, Route, AlertCircle, ArrowUpDown, Filter, Sparkles } from 'lucide-react';
import { SolutionMeta } from '../types/solution';
import { formatDistance, formatNumber } from '../lib/utils';

interface SolutionSelectorModalProps {
  solutions: SolutionMeta[];
  selectedFilename: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectSolution: (filename: string) => void;
}

type SortByOption = 'id-asc' | 'id-desc' | 'obj-asc' | 'obj-desc' | 'dist-asc' | 'handling-asc';

export const SolutionSelectorModal: React.FC<SolutionSelectorModalProps> = ({
  solutions,
  selectedFilename,
  isOpen,
  onClose,
  onSelectSolution,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortByOption>('id-asc');
  const [filterHandling, setFilterHandling] = useState<'all' | 'zero' | 'with-handling'>('all');

  const filteredAndSortedSolutions = useMemo(() => {
    return solutions
      .filter((s) => {
        // Text search
        const q = searchQuery.toLowerCase().trim();
        const matchesText =
          !q ||
          s.filename.toLowerCase().includes(q) ||
          s.instance.toLowerCase().includes(q) ||
          `id ${s.instanceId}`.includes(q) ||
          `${s.numCustomers} clientes`.includes(q);

        // Handling filter
        let matchesHandling = true;
        if (filterHandling === 'zero') matchesHandling = s.handlingCost === 0;
        if (filterHandling === 'with-handling') matchesHandling = s.handlingCost > 0;

        return matchesText && matchesHandling;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'id-asc':
            return (a.instanceId || 0) - (b.instanceId || 0);
          case 'id-desc':
            return (b.instanceId || 0) - (a.instanceId || 0);
          case 'obj-asc':
            return a.objectiveValue - b.objectiveValue;
          case 'obj-desc':
            return b.objectiveValue - a.objectiveValue;
          case 'dist-asc':
            return a.totalDistance - b.totalDistance;
          case 'handling-asc':
            return a.handlingCost - b.handlingCost;
          default:
            return 0;
        }
      });
  }, [solutions, searchQuery, sortBy, filterHandling]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-zinc-950 shadow-lg shadow-emerald-950/40">
              <Layers className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Seleccionar Solución Óptima
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {solutions.length} disponibles en Outputs/
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Selecciona la instancia calculada por Gurobi para visualizar su ruteo y comportamiento LIFO
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search, Filter and Sort Toolbar */}
        <div className="px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, clientes, nombre..."
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
            />
          </div>

          {/* Filter by Handling */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs">
            <span className="text-[11px] font-mono text-zinc-400 px-2 flex items-center gap-1">
              <Filter className="h-3 w-3 text-cyan-400" />
              Handling:
            </span>
            <button
              onClick={() => setFilterHandling('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                filterHandling === 'all'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterHandling('zero')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                filterHandling === 'zero'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Cero (h=0)
            </button>
            <button
              onClick={() => setFilterHandling('with-handling')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                filterHandling === 'with-handling'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Con Conflicto
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs">
            <span className="text-[11px] font-mono text-zinc-400 px-2 flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-emerald-400" />
              Orden:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
              className="bg-transparent text-zinc-200 text-xs font-mono font-medium focus:outline-none cursor-pointer pr-2"
            >
              <option value="id-asc" className="bg-zinc-900 text-zinc-200">ID Instancia (1 a 10)</option>
              <option value="id-desc" className="bg-zinc-900 text-zinc-200">ID Instancia (Desc)</option>
              <option value="obj-asc" className="bg-zinc-900 text-zinc-200">Menor Costo Objetivo (Z*)</option>
              <option value="obj-desc" className="bg-zinc-900 text-zinc-200">Mayor Costo Objetivo (Z*)</option>
              <option value="dist-asc" className="bg-zinc-900 text-zinc-200">Menor Distancia Total</option>
              <option value="handling-asc" className="bg-zinc-900 text-zinc-200">Menor Costo Handling</option>
            </select>
          </div>
        </div>

        {/* Solutions Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedSolutions.length === 0 ? (
            <div className="col-span-full py-12 text-center text-zinc-400">
              <p className="text-sm">No se encontraron soluciones con los filtros seleccionados.</p>
            </div>
          ) : (
            filteredAndSortedSolutions.map((s) => {
              const isSelected = s.filename === selectedFilename;

              return (
                <div
                  key={s.filename}
                  onClick={() => {
                    onSelectSolution(s.filename);
                    onClose();
                  }}
                  className={`
                    group relative flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none
                    ${
                      isSelected
                        ? 'bg-gradient-to-b from-zinc-900 to-zinc-950 border-emerald-500 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500'
                        : 'bg-zinc-950/60 hover:bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 shadow-md'
                    }
                  `}
                >
                  {/* Top line: ID and active check */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-xl bg-zinc-800 text-zinc-200 font-mono font-bold text-xs flex items-center justify-center border border-zinc-700">
                        #{s.instanceId}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {s.numCustomers} Clientes
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-400">
                          h = {s.h} &middot; Q = {s.capacity}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <Check className="h-3.5 w-3.5" />
                        Activa
                      </span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 text-[11px] font-mono text-zinc-400 group-hover:text-zinc-200 transition-opacity">
                        Seleccionar &rarr;
                      </span>
                    )}
                  </div>

                  {/* Objective value highlight */}
                  <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80 mb-3">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        Función Objetivo (Z*):
                      </span>
                      <span className="text-base font-extrabold font-mono text-white">
                        {formatNumber(s.objectiveValue, 2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1.5 border-t border-zinc-800">
                      <span className="flex items-center gap-1">
                        <Route className="h-3 w-3 text-cyan-400" />
                        {formatDistance(s.totalDistance)}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-amber-400" />
                        H: {formatNumber(s.handlingCost, 2)}
                      </span>
                    </div>
                  </div>

                  {/* Filename footer */}
                  <div className="text-[10px] font-mono text-zinc-500 truncate">
                    {s.filename}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-mono">
            Mostrando {filteredAndSortedSolutions.length} de {solutions.length} soluciones
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
