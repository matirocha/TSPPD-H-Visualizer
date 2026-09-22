import React from 'react';
import { X, Table, Route } from 'lucide-react';
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

  const matrix = solution.distMatrix || [];
  const nodes = solution.nodes;

  // Build a set of active tour arcs for highlighting
  const activeArcs = new Set<string>();
  for (let i = 0; i < solution.tour.length - 1; i++) {
    activeArcs.add(`${solution.tour[i]}-${solution.tour[i + 1]}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Table className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Matriz de Distancias (C_ij)
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {nodes.length} x {nodes.length} Nodos
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Costos de traslado entre cada par de nodos. Los arcos seleccionados en el tour óptimo están resaltados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Matrix Table */}
        <div className="p-6 overflow-auto max-h-[65vh]">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-zinc-800 border border-zinc-800 rounded-2xl overflow-hidden text-xs font-mono">
              <thead className="bg-zinc-950">
                <tr>
                  <th className="px-3 py-3 text-left font-bold text-zinc-400 border-r border-zinc-800">
                    De \ A
                  </th>
                  {nodes.map((node) => (
                    <th key={`th-${node.id}`} className="px-3 py-3 text-center font-bold text-zinc-300">
                      {node.isDepot ? 'Depósito (0)' : `Cliente ${node.id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
                {matrix.map((row, i) => (
                  <tr key={`row-${i}`} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-zinc-300 bg-zinc-950/60 border-r border-zinc-800 whitespace-nowrap">
                      {nodes[i]?.isDepot ? 'Depósito (0)' : `Cliente ${nodes[i]?.id}`}
                    </td>
                    {row.map((val, j) => {
                      const isSelf = i === j;
                      const isArcInTour = activeArcs.has(`${i}-${j}`);

                      return (
                        <td
                          key={`cell-${i}-${j}`}
                          className={`px-3 py-2.5 text-center transition-all ${
                            isArcInTour
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50 shadow-inner'
                              : isSelf
                              ? 'text-zinc-600 bg-zinc-950/40'
                              : val > 999999
                              ? 'text-zinc-600'
                              : 'text-zinc-300'
                          }`}
                        >
                          {isSelf ? '—' : val > 999999 ? '∞' : `${val} km`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500 inline-block" />
              Arco en Tour Óptimo
            </span>
            <span className="flex items-center gap-1 text-zinc-400">
              <Route className="h-3.5 w-3.5 text-cyan-400" />
              Distancia Total: {solution.totalDistance} km
            </span>
          </div>
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
