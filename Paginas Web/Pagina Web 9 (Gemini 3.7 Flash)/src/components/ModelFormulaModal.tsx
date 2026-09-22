import React from 'react';
import { X, BookOpen, Layers, Zap } from 'lucide-react';

interface ModelFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelFormulaModal: React.FC<ModelFormulaModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Formulación Matemática del Modelo TSPPD-H
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Gurobi Optimizer &middot; Ecs. (1 - 16)
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Traveling Salesman Problem with Pickup and Delivery and Handling Costs bajo política LIFO
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

        {/* Math formulation content */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6 font-mono text-xs text-zinc-300">
          
          {/* Objective Function */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Zap className="h-4 w-4" />
              <span>(1) Función Objetivo: Minimización de Costos Totales</span>
            </div>
            <p className="text-zinc-400 font-sans text-xs">
              Suma del costo de ruteo euclidiano/distancia más el costo de manipulación (handling) por obstrucción LIFO:
            </p>
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-emerald-300 text-sm overflow-x-auto">
              min Z = &sum;<sub>i,j &isin; V, i&ne;j</sub> c<sub>ij</sub> x<sub>ij</sub> + &sum;<sub>i &isin; C</sub> &sum;<sub>k &isin; K</sub> v<sub>i</sub><sup>k</sup> - &sum;<sub>i &isin; C</sub> h<sub>a</sub> &alpha;<sub>i</sub>
            </div>
          </div>

          {/* Variables Definitions */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
            <div className="text-cyan-400 font-bold text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Variables de Decisión</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <strong className="text-zinc-100 block mb-1">x<sub>ij</sub> &isin; &#123;0, 1&#125;:</strong>
                <span className="text-zinc-400 font-sans">1 si el vehículo viaja directamente del nodo i al nodo j; 0 en caso contrario.</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <strong className="text-zinc-100 block mb-1">a<sub>ijk</sub>, b<sub>ijk</sub> &isin; &#123;0, 1&#125;:</strong>
                <span className="text-zinc-400 font-sans">1 si la posición k contiene mercancía de entrega (&alpha;) o recolección (&beta;) en el arco (i, j).</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <strong className="text-zinc-100 block mb-1">r<sub>ik</sub> &isin; &#123;0, 1&#125;:</strong>
                <span className="text-zinc-400 font-sans">1 si la posición k sufre una operación de manipulación/reacomodo en el cliente i.</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <strong className="text-zinc-100 block mb-1">v<sub>i</sub><sup>k</sup> &ge; 0:</strong>
                <span className="text-zinc-400 font-sans">Costo de manipulación linealizado incurrido en la posición k al visitar el cliente i.</span>
              </div>
            </div>
          </div>

          {/* Key Constraints Summary */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
            <div className="text-amber-400 font-bold text-sm">
              Principales Familias de Restricciones
            </div>
            <div className="space-y-3 font-sans text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <strong className="text-zinc-200 font-mono block mb-1">(2) y (3) Grado del Grafo:</strong>
                <p className="text-zinc-400">Cada nodo (depósito y clientes) debe ser visitado exactamente una vez (entrada y salida = 1).</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <strong className="text-zinc-200 font-mono block mb-1">(4) y (5) Balance de Flujo de Mercancías:</strong>
                <p className="text-zinc-400">La diferencia neta entre mercancía que entra y sale en el nodo i equivale a su demanda &alpha;<sub>i</sub> (entrega) o &beta;<sub>i</sub> (recolección).</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <strong className="text-zinc-200 font-mono block mb-1">(6) Política LIFO en Posiciones:</strong>
                <p className="text-zinc-400 font-mono">r<sub>i,k</sub> &le; r<sub>i,k-1</sub> &forall; k &isin; &#123;2, ..., Q&#125;. Las manipulaciones se propagan desde la compuerta trasera hacia el fondo.</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <strong className="text-zinc-200 font-mono block mb-1">(7) Capacidad Física del Camión:</strong>
                <p className="text-zinc-400 font-mono">a<sub>ijk</sub> + b<sub>ijk</sub> &le; x<sub>ij</sub>. En cada slot k solo puede haber a lo más una unidad &alpha; o una &beta;.</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <strong className="text-zinc-200 font-mono block mb-1">(13) Eliminación de Subtoures (MTZ):</strong>
                <p className="text-zinc-400 font-mono">u<sub>i</sub> - u<sub>j</sub> + |V| x<sub>ij</sub> &le; |V| - 1. Garantiza una única ruta conectada con el depósito.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-mono">
            Implementado en Python con gurobipy en tsppd_h_gurobi.py
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
