import React, { useState } from 'react';
import { X, BookOpen, Layers, Zap, CheckCircle2, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import { ModelType } from '../types/solution';

interface ModelFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: ModelType;
  onSelectModel: (model: ModelType) => void;
}

export const ModelFormulaModal: React.FC<ModelFormulaModalProps> = ({
  isOpen,
  onClose,
  activeModel,
  onSelectModel,
}) => {
  const [selectedTab, setSelectedTab] = useState<ModelType>(activeModel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Formulación Matemática del Modelo
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Battarra et al. (2010)
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Traveling Salesman Problem with Pickup and Delivery and Handling Costs (TSPPD-H)
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

        {/* Model Tabs & Activation Bar */}
        <div className="px-6 py-3.5 bg-zinc-950/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setSelectedTab('TSPPD-H')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                selectedTab === 'TSPPD-H'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Modelo General TSPPD-H</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                Ecs. 1 - 16
              </span>
              {activeModel === 'TSPPD-H' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            <button
              onClick={() => setSelectedTab('TSPPD-H_1')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                selectedTab === 'TSPPD-H_1'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Modelo TSPPD-H_1 (Política 1)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                Ecs. 17 - 25
              </span>
              {activeModel === 'TSPPD-H_1' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              )}
            </button>
          </div>

          {/* Model Switch Button */}
          <div>
            {activeModel === selectedTab ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Modelo Activo en la Visualización</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  onSelectModel(selectedTab);
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <Cpu className="w-4 h-4" />
                <span>Activar {selectedTab === 'TSPPD-H' ? 'Modelo TSPPD-H' : 'Modelo TSPPD-H_1'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[64vh] space-y-6 text-xs font-mono text-zinc-300">
          {selectedTab === 'TSPPD-H' ? (
            /* TAB 1: MODELO GENERAL (ECUACIONES 1 - 16) */
            <>
              {/* Concept Banner */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 font-sans space-y-1">
                <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Modelo General Indexado por Posiciones k ∈ &#123;1, ..., Q&#125;</span>
                </div>
                <p className="text-xs text-zinc-300">
                  En este modelo cada ítem ocupa una posición individual y discreta $k$ en el camión. La mercancía de entrega ($\alpha$) y recolección ($\beta$) puede intercalarse en cualquier slot, y la función de manipulación penaliza el acceso si existen mercancías obstruyendo la compuerta.
                </p>
              </div>

              {/* Objective Function (1) */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>(1) Función Objetivo: Minimización de Costos Totales</span>
                </div>
                <p className="text-zinc-400 font-sans text-xs">
                  Suma del costo de ruteo euclidiano más el costo de manipulación (handling) por reacomodo LIFO:
                </p>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-emerald-300 text-xs sm:text-sm overflow-x-auto">
                  min Z = &sum;<sub>i,j &isin; V, i&ne;j</sub> c<sub>ij</sub> x<sub>ij</sub> + &sum;<sub>i &isin; C</sub> &sum;<sub>k &isin; K</sub> v<sub>i</sub><sup>k</sup> - &sum;<sub>i &isin; C</sub> h<sub>a</sub> &alpha;<sub>i</sub>
                </div>
              </div>

              {/* Variables */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-cyan-400 font-bold text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>Variables de Decisión (Ecs. 14 - 16)</span>
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
                    <span className="text-zinc-400 font-sans">1 si la posición k es manipulada / movida temporalmente al atender al cliente i.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">v<sub>i</sub><sup>k</sup> &ge; 0:</strong>
                    <span className="text-zinc-400 font-sans">Costo linealizado de manipulación en la posición k al atender al cliente i.</span>
                  </div>
                </div>
              </div>

              {/* Constraints */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-amber-400 font-bold text-sm">
                  Restricciones del Modelo General (Ecs. 2 - 13)
                </div>
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(2) y (3) Grado del Grafo:</strong>
                    <p className="text-zinc-400">Cada nodo (depósito y clientes) es visitado exactamente una vez (&sum;<sub>j</sub> x<sub>ij</sub> = 1, &sum;<sub>i</sub> x<sub>ij</sub> = 1).</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(4) y (5) Conservación de Flujo por Posición:</strong>
                    <p className="text-zinc-400">Balance neto de entradas y salidas de mercancías &alpha; y &beta; en cada posición k para satisfacer la demanda del cliente i.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(6) Propagación LIFO:</strong>
                    <p className="text-zinc-400 font-mono">r<sub>ik</sub> &le; r<sub>i,k-1</sub> &forall; k &isin; &#123;2, ..., Q&#125;. Si se accede a la posición k, todas las posiciones anteriores (1 a k-1) deben haberse manipulado.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(7) Capacidad Física por Slot:</strong>
                    <p className="text-zinc-400 font-mono">a<sub>ijk</sub> + b<sub>ijk</sub> &le; x<sub>ij</sub>. En cada slot k solo puede viajar como máximo una unidad &alpha; o una &beta;.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(8) - (11) Invarianza de Slots No Manipulados:</strong>
                    <p className="text-zinc-400">Si r<sub>ik</sub> = 0, el ítem que ocupaba la posición k antes de la parada debe permanecer en la misma posición k al salir.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(12) Linealización del Costo de Manipulación:</strong>
                    <p className="text-zinc-400 font-mono">v<sub>i</sub><sup>k</sup> &ge; &sum;<sub>j</sub> (h<sub>a</sub> a<sub>jik</sub> + h<sub>b</sub> b<sub>jik</sub>) - (1 - r<sub>ik</sub>) h'.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(13) Eliminación de Subtoures (MTZ):</strong>
                    <p className="text-zinc-400 font-mono">u<sub>i</sub> - u<sub>j</sub> + |V| x<sub>ij</sub> &le; |V| - 1. Asegura un único ciclo conectado con el depósito.</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: MODELO TSPPD-H_1 (ECUACIONES 17 - 25) */
            <>
              {/* Concept Banner */}
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 font-sans space-y-1">
                <div className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span>Modelo TSPPD-H_1 (Política 1 de Battarra et al., 2010)</span>
                </div>
                <p className="text-xs text-zinc-300">
                  <strong>Política Operativa:</strong> Toda la mercancía recolectada &beta; se coloca obligatoriamente en la compuerta trasera (rear) del vehículo: (F, &alpha;, ..., &alpha;, &beta;, ..., &beta;, R). Cada vez que se visita un cliente con entrega (&alpha;<sub>j</sub> &gt; 0), <em>todas</em> las unidades &beta; a bordo (z<sub>ij</sub>) obstruyen la puerta y deben descargarse temporalmente y recargarse con un costo de h<sub>b</sub> z<sub>ij</sub>. Si &alpha;<sub>j</sub> = 0, no hay costo de manipulación.
                </p>
              </div>

              {/* Objective Function (17) */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>(17) Función Objetivo TSPPD-H_1</span>
                </div>
                <p className="text-zinc-400 font-sans text-xs">
                  Minimiza el costo de recorrido más el costo exacto de manipulación de la mercancía $\beta$ acumulada en la compuerta en cada entrega $\alpha$:
                </p>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-purple-300 text-xs sm:text-sm overflow-x-auto">
                  min Z = &sum;<sub>(i,j) &isin; A</sub> c<sub>ij</sub> x<sub>ij</sub> + &sum;<sub>(i,j) &isin; A \ A<sub>r</sub> : &alpha;<sub>j</sub> &gt; 0</sub> h<sub>b</sub> z<sub>ij</sub>
                </div>
              </div>

              {/* Variables */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-cyan-400 font-bold text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>Variables de Decisión (Ecs. 24 - 25)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">x<sub>ij</sub> &isin; &#123;0, 1&#125;:</strong>
                    <span className="text-zinc-400 font-sans">1 si el vehículo recorre el arco (i, j); 0 en caso contrario.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">y<sub>ij</sub> &ge; 0:</strong>
                    <span className="text-zinc-400 font-sans">Flujo agregado de mercancía de entrega (&alpha;) a bordo en el arco (i, j).</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">z<sub>ij</sub> &ge; 0:</strong>
                    <span className="text-zinc-400 font-sans">Flujo agregado de mercancía de recolección (&beta;) a bordo en el arco (i, j).</span>
                  </div>
                </div>
              </div>

              {/* Constraints */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-purple-400 font-bold text-sm">
                  Restricciones del Modelo TSPPD-H_1 (Ecs. 18 - 23)
                </div>
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(18) y (19) Grado del Grafo:</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j &isin; V</sub> x<sub>ij</sub> = 1 &forall; i &isin; V &nbsp;|&nbsp; &sum;<sub>i &isin; V</sub> x<sub>ij</sub> = 1 &forall; j &isin; V.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(20) Conservación de Flujo para Entregas (&alpha;):</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j &isin; V</sub> y<sub>ji</sub> - &sum;<sub>j &isin; V</sub> y<sub>ij</sub> = &alpha;<sub>i</sub> &forall; i &isin; V. Al visitar el cliente i se reduce la carga en &alpha;<sub>i</sub> unidades.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(21) Conservación de Flujo para Recolecciones (&beta;):</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j &isin; V</sub> z<sub>ij</sub> - &sum;<sub>j &isin; V</sub> z<sub>ji</sub> = &beta;<sub>i</sub> &forall; i &isin; V. Al salir del cliente i la carga aumenta en &beta;<sub>i</sub> unidades.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(22) Capacidad Total del Vehículo:</strong>
                    <p className="text-zinc-400 font-mono">y<sub>ij</sub> + z<sub>ij</sub> &le; Q &middot; x<sub>ij</sub> &forall; (i, j) &isin; A. La suma total de mercancía &alpha; y &beta; no puede superar la capacidad Q.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(23) Eliminación de Subtoures (MTZ):</strong>
                    <p className="text-zinc-400 font-mono">u<sub>i</sub> - u<sub>j</sub> + |V| x<sub>ij</sub> &le; |V| - 1 &forall; i &ne; j, i,j &isin; V<sub>c</sub>.</p>
                  </div>
                </div>
              </div>

              {/* Comparative Advantages */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 font-sans space-y-2">
                <div className="text-emerald-400 font-bold text-xs">
                  💡 Ventajas Teóricas y Computacionales de la Política 1
                </div>
                <ul className="list-disc list-inside text-zinc-400 text-xs space-y-1">
                  <li><strong>Sin variables por posición:</strong> No indexa sobre slots individuales k &isin; &#123;1, ..., Q&#125;, reduciendo drásticamente el espacio de búsqueda.</li>
                  <li><strong>Resolución ultrarrápida:</strong> Resuelve instancias en milisegundos mediante programación lineal entera mixta estándar en Gurobi.</li>
                  <li><strong>Facilidad de operación real:</strong> Proporciona al transportista una instrucción directa y simple: colocar siempre las recolecciones en la compuerta trasera.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-mono">
            {selectedTab === 'TSPPD-H'
              ? 'Código: Testeando Modelo con Papers/tsppd_h_gurobi.py'
              : 'Código: notebooks/tsppd_h_1_gurobi.py'}
          </span>
          <div className="flex items-center gap-3">
            {activeModel !== selectedTab && (
              <button
                onClick={() => {
                  onSelectModel(selectedTab);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Activar este Modelo
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
