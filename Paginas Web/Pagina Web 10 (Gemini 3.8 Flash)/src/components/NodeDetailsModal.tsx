import React from 'react';
import { X, MapPin, PackageCheck, PackagePlus, ArrowRight, Route } from 'lucide-react';
import { NodeDef, SolutionData } from '../types/solution';
import { formatDistance } from '../lib/utils';

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
  const tour = solution.tour || [];
  const nodeIdxInTour = tour.indexOf(node.id);

  const prevNodeId = nodeIdxInTour > 0 ? tour[nodeIdxInTour - 1] : null;
  const nextNodeId = nodeIdxInTour >= 0 && nodeIdxInTour < tour.length - 1 ? tour[nodeIdxInTour + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isDepot ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                {node.label}
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Nodo #{node.id}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {isDepot ? 'Punto de partida y retorno del tour logístico' : 'Cliente de la red con requerimientos de demanda'}
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

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-mono">
          {/* Demand metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex flex-col justify-between">
              <span className="text-[0.6875rem] font-semibold text-rose-300 flex items-center gap-1.5">
                <PackageCheck className="h-4 w-4 text-rose-400" />
                Entrega Demanda (α)
              </span>
              <span className="text-xl font-bold text-rose-400 mt-2">
                {node.alpha} unidades
              </span>
              <span className="text-[0.625rem] text-zinc-400 font-sans mt-0.5">
                {isDepot ? 'Total cargado inicialmente' : 'Descargado en este nodo'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col justify-between">
              <span className="text-[0.6875rem] font-semibold text-cyan-300 flex items-center gap-1.5">
                <PackagePlus className="h-4 w-4 text-cyan-400" />
                Recolección Demanda (β)
              </span>
              <span className="text-xl font-bold text-cyan-400 mt-2">
                {node.beta} unidades
              </span>
              <span className="text-[0.625rem] text-zinc-400 font-sans mt-0.5">
                {isDepot ? 'Total retornado al finalizar' : 'Recolectado de este cliente'}
              </span>
            </div>
          </div>

          {/* Tour connections */}
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
            <span className="text-zinc-400 font-bold block">Conexiones en la Ruta Óptima:</span>
            <div className="flex items-center justify-between text-zinc-300 pt-1">
              <span>Arco de Llegada:</span>
              <span className="font-semibold text-emerald-400">
                {prevNodeId !== null ? `Nodo ${prevNodeId} → Nodo ${node.id}` : 'Inicio del Tour'}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Arco de Salida:</span>
              <span className="font-semibold text-cyan-400">
                {nextNodeId !== null ? `Nodo ${node.id} → Nodo ${nextNodeId}` : 'Fin del Tour'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
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
