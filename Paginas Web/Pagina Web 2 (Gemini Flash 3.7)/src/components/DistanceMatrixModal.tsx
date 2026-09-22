import React from 'react';
import { X, Grid } from 'lucide-react';
import { SolutionData } from '../types/solution';

interface DistanceMatrixModalProps {
  solution: SolutionData;
  isOpen: boolean;
  onClose: () => void;
}

export const DistanceMatrixModal: React.FC<DistanceMatrixModalProps> = ({
  solution,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const matrix = solution.distMatrix;
  const nodes = solution.nodes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Grid className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Matriz de Costos y Distancias (c_ij)
              </h2>
              <p className="text-xs text-zinc-400">
                Instancia: {solution.instance} ({solution.numCustomers} Clientes + Depósito)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-auto">
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            La siguiente matriz representa las distancias euclidianas/costos de transporte <span className="font-mono text-cyan-400">c[i, j]</span> entre todos los pares de nodos involucrados en el problema. Los arcos seleccionados en la solución óptima están resaltados.
          </p>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
            <table className="w-full text-xs font-mono text-center border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                  <th className="p-2.5 text-left font-bold text-zinc-300">Origen \ Destino</th>
                  {nodes.map((n) => (
                    <th key={`head-${n.id}`} className="p-2.5 font-bold text-zinc-200">
                      {n.isDepot ? 'Depósito (0)' : `Cliente ${n.id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {nodes.map((u) => (
                  <tr key={`row-${u.id}`} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="p-2.5 text-left font-bold text-zinc-300 bg-zinc-900/30">
                      {u.isDepot ? 'Depósito (0)' : `Cliente ${u.id}`}
                    </td>
                    {nodes.map((v) => {
                      const dist = matrix[u.id]?.[v.id] ?? 0;
                      const isSelf = u.id === v.id;
                      // Check if this directed edge is part of the tour
                      const isTourEdge = solution.tour.some((nodeId, idx) => {
                        return idx < solution.tour.length - 1 && nodeId === u.id && solution.tour[idx + 1] === v.id;
                      });

                      return (
                        <td
                          key={`cell-${u.id}-${v.id}`}
                          className={`p-2.5 transition-all ${
                            isSelf
                              ? 'text-zinc-700 bg-zinc-950/40'
                              : isTourEdge
                              ? 'bg-emerald-950/70 text-emerald-300 font-bold border border-emerald-500/40'
                              : 'text-zinc-400'
                          }`}
                        >
                          {isSelf ? '-' : `${dist} km`}
                          {isTourEdge && <span className="block text-[9px] text-emerald-400 font-sans">En Tour</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
