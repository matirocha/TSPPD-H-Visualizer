import React from 'react';
import { X, BookOpen, Layers, Sigma, Scale } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Formulación Matemática del TSPPD-H
              </h2>
              <p className="text-xs text-zinc-400">
                Traveling Salesman Problem with Pickup and Delivery and Handling Operations (Ecuaciones 1–16)
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300">
          {/* Section 1: Concept */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              1. Descripción del Problema
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              El <strong>TSPPD-H</strong> modela un camión con un único compartimento de carga que opera bajo política <strong>LIFO (Last-In-First-Out)</strong>. 
              El camión parte del depósito cargado con mercancías tipo <strong>&alpha;</strong> (a entregar a los clientes) y recoge mercancías tipo <strong>&beta;</strong> (para llevar al depósito). 
              Cuando se debe entregar &alpha; a un cliente pero hay unidades &beta; bloqueando el acceso a la puerta trasera, se deben realizar operaciones de <em>manipulación (handling)</em>, retirando temporalmente &beta; y volviéndola a cargar con un costo unitario <span className="font-mono text-amber-400">h</span>.
            </p>
          </div>

          {/* Section 2: Objective Function */}
          <div className="space-y-2 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Sigma className="h-4 w-4" />
              2. Función Objetivo (Ecuación 1)
            </h3>
            <div className="font-mono text-xs bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 text-zinc-200 overflow-x-auto">
              Minimizar Z = &sum;<sub>i,j</sub> c<sub>ij</sub> &middot; x<sub>ij</sub> + &sum;<sub>i &isin; C</sub> &sum;<sub>k=1..Q</sub> v<sub>i</sub><sup>k</sup> - &sum;<sub>i &isin; C</sub> h<sub>&alpha;</sub> &middot; &alpha;<sub>i</sub>
            </div>
            <p className="text-xs text-zinc-400">
              Donde <span className="font-mono text-zinc-200">c<sub>ij</sub> x<sub>ij</sub></span> es el costo de ruteo/transporte, <span className="font-mono text-zinc-200">v<sub>i</sub><sup>k</sup></span> linealiza el costo de manipulación en el cliente <span className="font-mono">i</span> para la posición <span className="font-mono">k</span>, y el último término ajusta la constante de manipulación base.
            </p>
          </div>

          {/* Section 3: Key Constraints */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              3. Restricciones Principales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                <span className="font-mono font-bold text-emerald-400 block">(2)-(3) Grado del Tour</span>
                <p className="text-zinc-400">Cada nodo (depósito y clientes) debe ser visitado exactamente una vez por el camión.</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                <span className="font-mono font-bold text-rose-400 block">(4)-(5) Conservación de Flujo</span>
                <p className="text-zinc-400">El flujo de mercancía entregada (&alpha;) y recolectada (&beta;) en cada posición <span className="font-mono">k</span> satisface la demanda y oferta.</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                <span className="font-mono font-bold text-cyan-400 block">(6) Jerarquía LIFO en Posiciones</span>
                <p className="text-zinc-400"><span className="font-mono">r<sub>i,k</sub> &le; r<sub>i,k-1</sub></span>: La manipulación en la posición profunda <span className="font-mono">k</span> solo puede ocurrir si la posición anterior <span className="font-mono">k-1</span> también se manipula.</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                <span className="font-mono font-bold text-amber-400 block">(13) Eliminación de Subtoures (MTZ)</span>
                <p className="text-zinc-400">Formulación Miller-Tucker-Zemlin que asegura un único circuito conexo válido que inicia y termina en el depósito.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
