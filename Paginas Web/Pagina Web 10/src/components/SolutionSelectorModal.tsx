import React, { useMemo } from 'react';
import { X, Layers, Check, Sparkles, Route, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SolutionMeta, ModelType } from '../types/solution';
import { formatDistance, formatNumber } from '../lib/utils';

interface SolutionSelectorModalProps {
  solutions: SolutionMeta[];
  selectedFilename: string;
  activeModel?: ModelType;
  isOpen: boolean;
  onClose: () => void;
  onSelectSolution: (filename: string) => void;
}

export const SolutionSelectorModal: React.FC<SolutionSelectorModalProps> = ({
  solutions,
  selectedFilename,
  activeModel,
  isOpen,
  onClose,
  onSelectSolution,
}) => {
  const currentSolution = useMemo(() => {
    return solutions.find((s) => s.filename === selectedFilename);
  }, [solutions, selectedFilename]);

  const effectiveModel: ModelType = activeModel || currentSolution?.model || 'TSPPD-H';

  // Filter solutions to match the active model/policy
  const modelSolutions = useMemo(() => {
    const list = solutions.filter((s) => (s.model || 'TSPPD-H') === effectiveModel);
    return list.length > 0 ? list : solutions;
  }, [solutions, effectiveModel]);

  // Sort strictly by instanceId ascending (ID 1 to ID 10)
  const sortedSolutions = useMemo(() => {
    return [...modelSolutions].sort((a, b) => (a.instanceId || 0) - (b.instanceId || 0));
  }, [modelSolutions]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-emerald-400 shadow-sm">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Explorador de Soluciones
                  </h2>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      effectiveModel === 'TSPPD-H_1'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : effectiveModel === 'TSPPD-H_2'
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        : effectiveModel === 'TSPPD-H_3'
                        ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {effectiveModel === 'TSPPD-H_1'
                      ? 'TSPPD-H_1 (Pol. 1)'
                      : effectiveModel === 'TSPPD-H_2'
                      ? 'TSPPD-H_2 (Pol. 2)'
                      : effectiveModel === 'TSPPD-H_3'
                      ? 'TSPPD-H_3 (Pol. 3)'
                      : 'TSPPD-H (General)'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Selecciona fácilmente el <span className="text-zinc-200 font-semibold">ID de la instancia</span> a simular
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick ID Navigation Strip */}
          <div className="px-6 py-3 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto select-none">
            <span className="text-xs font-mono font-medium text-zinc-400 shrink-0 mr-1">
              Cambio rápido:
            </span>
            <div className="flex items-center gap-1.5">
              {sortedSolutions.map((s) => {
                const isSelected = s.filename === selectedFilename;
                return (
                  <button
                    key={`quick-pill-${s.filename}`}
                    onClick={() => {
                      onSelectSolution(s.filename);
                      onClose();
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 scale-105'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    ID #{s.instanceId}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Solutions Grid */}
          <div className="p-6 overflow-y-auto max-h-[62vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {sortedSolutions.map((s) => {
                const isSelected = s.filename === selectedFilename;

                return (
                  <motion.div
                    key={s.filename}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelectSolution(s.filename);
                      onClose();
                    }}
                    className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-gradient-to-b from-zinc-900 to-zinc-950 border-emerald-500 shadow-xl shadow-emerald-950/50 ring-1 ring-emerald-500/50'
                        : 'bg-zinc-950/60 hover:bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 shadow-md'
                    }`}
                  >
                    {/* Top Row: ID Badge & Selection Tag */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-sm font-mono font-black px-2.5 py-1 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                            : 'bg-zinc-900 text-zinc-200 border border-zinc-700/80 group-hover:border-zinc-600'
                        }`}
                      >
                        ID #{s.instanceId}
                      </span>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <Check className="h-3 w-3" />
                          Activa
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-500 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                          Elegir &rarr;
                        </span>
                      )}
                    </div>

                    {/* Objective Value (Z*) */}
                    <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80 mb-3">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-emerald-400" />
                          Costo (Z*):
                        </span>
                        <span className="text-zinc-500">{s.numCustomers} cli</span>
                      </div>
                      <div className="text-lg font-mono font-black text-white tracking-tight">
                        {formatNumber(s.objectiveValue, 2)}
                      </div>
                    </div>

                    {/* Metrics: Distancia & Handling */}
                    <div className="space-y-1 text-[11px] font-mono pt-2 border-t border-zinc-800/80">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Route className="h-3 w-3 text-cyan-400" />
                          Ruta:
                        </span>
                        <span className="font-semibold text-zinc-200">
                          {formatDistance(s.totalDistance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="flex items-center gap-1 text-zinc-400">
                          <AlertCircle
                            className={`h-3 w-3 ${
                              s.handlingCost > 0 ? 'text-amber-400' : 'text-zinc-600'
                            }`}
                          />
                          Handling:
                        </span>
                        <span
                          className={`font-semibold ${
                            s.handlingCost > 0 ? 'text-amber-300' : 'text-zinc-500'
                          }`}
                        >
                          +{formatNumber(s.handlingCost, 2)}
                        </span>
                      </div>
                    </div>

                    {/* Instance Specs */}
                    <div className="mt-2.5 pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                      <span>Q = {s.capacity}</span>
                      <span>h = {s.h}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">
              Mostrando {sortedSolutions.length} instancias para este modelo (cambia de modelo en el encabezado)
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white cursor-pointer transition-all"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
