import React from 'react';
import { X, MapPin, ArrowDownRight, ArrowUpRight, Warehouse } from 'lucide-react';
import { NodeDef, SolutionData } from '../types/solution';

interface NodeDetailsModalProps {
  node: NodeDef | null;
  solution: SolutionData;
  isOpen: boolean;
  onClose: () => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({
  node,
  solution,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !node) return null;

  const isDepot = node.isDepot;
  const tourOrder = solution.tour.indexOf(node.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${isDepot ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
              {isDepot ? <Warehouse className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {node.label} (ID: {node.id})
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {isDepot ? 'Punto de partida y retorno' : `Orden de visita en tour: #${tourOrder}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-1">
              <span className="text-zinc-400 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
                Demanda &alpha; (Entrega):
              </span>
              <span className="text-lg font-bold font-mono text-rose-400">
                {node.alpha} unidades
              </span>
              <span className="text-[10px] text-zinc-500">
                {isDepot ? 'Total suministrado por depósito' : 'Requerido por este cliente'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-1">
              <span className="text-zinc-400 flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5 text-cyan-400" />
                Oferta &beta; (Recolección):
              </span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {node.beta} unidades
              </span>
              <span className="text-[10px] text-zinc-500">
                {isDepot ? 'Total recibido en depósito' : 'Generado por este cliente'}
              </span>
            </div>
          </div>

          {/* Distances from/to this node */}
          <div className="rounded-xl bg-zinc-950/70 p-3 border border-zinc-800">
            <span className="font-semibold text-zinc-300 block mb-2 font-mono">
              Distancias desde este nodo:
            </span>
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
              {solution.nodes.map((other) => {
                if (other.id === node.id) return null;
                const d = solution.distMatrix[node.id]?.[other.id] || 0;
                return (
                  <div key={`dist-${other.id}`} className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex justify-between">
                    <span>{other.isDepot ? 'Dep' : `C${other.id}`}:</span>
                    <span className="text-cyan-400 font-bold">{d} km</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
