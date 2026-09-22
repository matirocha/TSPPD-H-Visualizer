import React, { useState } from 'react';
import { X, BookOpen, Layers, Zap, CheckCircle2, ArrowRight, ShieldCheck, Cpu, GitFork, Sliders } from 'lucide-react';
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
                Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs (TSPPD-H)
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
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            {/* General */}
            <button
              onClick={() => setSelectedTab('TSPPD-H')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'TSPPD-H'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>General</span>
              <span className="text-[0.625rem] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                Ecs. 1-16
              </span>
              {activeModel === 'TSPPD-H' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {/* Política 1 */}
            <button
              onClick={() => setSelectedTab('TSPPD-H_1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'TSPPD-H_1'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Pol. 1 (Rear)</span>
              <span className="text-[0.625rem] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                Ecs. 17-25
              </span>
              {activeModel === 'TSPPD-H_1' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              )}
            </button>

            {/* Política 2 */}
            <button
              onClick={() => setSelectedTab('TSPPD-H_2')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'TSPPD-H_2'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Pol. 2 (Front)</span>
              <span className="text-[0.625rem] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                Ecs. 26-27
              </span>
              {activeModel === 'TSPPD-H_2' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              )}
            </button>

            {/* Política 3 */}
            <button
              onClick={() => setSelectedTab('TSPPD-H_3')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTab === 'TSPPD-H_3'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Pol. 3 (Híbrida)</span>
              <span className="text-[0.625rem] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                Ecs. 31-48
              </span>
              {activeModel === 'TSPPD-H_3' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
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
                <span>Activar {selectedTab}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[64vh] space-y-6 text-xs font-mono text-zinc-300">
          {/* TAB 1: MODELO GENERAL (ECUACIONES 1 - 16) */}
          {selectedTab === 'TSPPD-H' && (
            <>
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 font-sans space-y-1">
                <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Modelo General Indexado por Posiciones k ∈ &#123;1, ..., Q&#125;</span>
                </div>
                <p className="text-xs text-zinc-300">
                  En este modelo cada ítem ocupa una posición individual y discreta $k$ en el camión. La mercancía de entrega (&alpha;) y recolección (&beta;) puede intercalarse en cualquier slot, y la función de manipulación penaliza el acceso si existen mercancías obstruyendo la compuerta.
                </p>
              </div>

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

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-amber-400 font-bold text-sm">
                  Restricciones del Modelo General (Ecs. 2 - 16)
                </div>
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(2) y (3) Grado del Grafo (Tour Hamiltoniano):</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j &isin; V</sub> x<sub>ij</sub> = 1 &forall; i &isin; V &nbsp;|&nbsp; &sum;<sub>i &isin; V</sub> x<sub>ij</sub> = 1 &forall; j &isin; V.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(4) y (5) Ocupación y Unicidad de Posiciones:</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j &isin; V</sub> a<sub>jik</sub> + &sum;<sub>j &isin; V</sub> b<sub>jik</sub> &le; 1 &forall; i &isin; V, k &isin; K.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(6) y (7) Satisfacción Exacta de Demandas:</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j &isin; V</sub> &sum;<sub>k &isin; K</sub> a<sub>ijk</sub> - &sum;<sub>j &isin; V</sub> &sum;<sub>k &isin; K</sub> a<sub>jik</sub> = &alpha;<sub>i</sub> &nbsp;|&nbsp; &sum;<sub>j &isin; V</sub> &sum;<sub>k &isin; K</sub> b<sub>jik</sub> - &sum;<sub>j &isin; V</sub> &sum;<sub>k &isin; K</sub> b<sub>ijk</sub> = &beta;<sub>i</sub>.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(13) Eliminación de Subtoures (MTZ):</strong>
                    <p className="text-zinc-400 font-mono">u<sub>i</sub> - u<sub>j</sub> + |V| x<sub>ij</sub> &le; |V| - 1 &forall; i &ne; j, i,j &isin; V<sub>c</sub>.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: MODELO TSPPD-H_1 (POLÍTICA 1, ECUACIONES 17 - 25) */}
          {selectedTab === 'TSPPD-H_1' && (
            <>
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 font-sans space-y-1">
                <div className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span>Modelo TSPPD-H_1 (Política 1 de Battarra et al., 2010)</span>
                </div>
                <p className="text-xs text-zinc-300">
                  <strong>Patrón de Carga:</strong> (F, &alpha;, ..., &alpha;, &beta;, ..., &beta;, R). Toda la mercancía recolectada &beta; se coloca obligatoriamente en la compuerta trasera (rear). Cada vez que se visita un cliente con entrega (&alpha;<sub>j</sub> &gt; 0), <em>todas</em> las unidades &beta; a bordo (z<sub>ij</sub>) obstruyen el paso y deben descargarse temporalmente y recargarse con costo h<sub>b</sub> z<sub>ij</sub>. Si &alpha;<sub>j</sub> = 0, el costo es nulo.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>(17) Función Objetivo TSPPD-H_1</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-purple-300 text-xs sm:text-sm overflow-x-auto">
                  min Z = &sum;<sub>(i,j) &isin; A</sub> c<sub>ij</sub> x<sub>ij</sub> + &sum;<sub>(i,j) &isin; A \ A<sub>r</sub> : &alpha;<sub>j</sub> &gt; 0</sub> h<sub>b</sub> z<sub>ij</sub>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-purple-400 font-bold text-sm">
                  Restricciones del Modelo TSPPD-H_1 (Ecs. 18 - 25)
                </div>
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(18) y (19) Grado:</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j</sub> x<sub>ij</sub> = 1 &nbsp;|&nbsp; &sum;<sub>i</sub> x<sub>ij</sub> = 1 &forall; i, j &isin; V.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(20) Conservación de Flujo para Entregas (&alpha;):</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j</sub> y<sub>ji</sub> - &sum;<sub>j</sub> y<sub>ij</sub> = &alpha;<sub>i</sub> &forall; i &isin; V.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(21) Conservación de Flujo para Recolecciones (&beta;):</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j</sub> z<sub>ij</sub> - &sum;<sub>j</sub> z<sub>ji</sub> = &beta;<sub>i</sub> &forall; i &isin; V.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(22) Capacidad en Arcos:</strong>
                    <p className="text-zinc-400 font-mono">y<sub>ij</sub> + z<sub>ij</sub> &le; Q &middot; x<sub>ij</sub> &forall; (i, j) &isin; A.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(23) Eliminación de Subtoures (MTZ):</strong>
                    <p className="text-zinc-400 font-mono">u<sub>i</sub> - u<sub>j</sub> + |V| x<sub>ij</sub> &le; |V| - 1 &forall; i &ne; j, i,j &isin; V<sub>c</sub>.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: MODELO TSPPD-H_2 (POLÍTICA 2, ECUACIONES 26 - 27) */}
          {selectedTab === 'TSPPD-H_2' && (
            <>
              <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/30 font-sans space-y-1">
                <div className="text-sm font-bold text-sky-400 flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  <span>Modelo TSPPD-H_2 (Política 2 de Battarra et al., 2010)</span>
                </div>
                <p className="text-xs text-zinc-300">
                  <strong>Patrón de Carga:</strong> (F, &beta;, ..., &beta;, &alpha;, ..., &alpha;, R). Toda la mercancía recolectada &beta; se coloca en el <em>frente</em> (fondo) del vehículo, mientras que la mercancía de entrega &alpha; se ubica en la compuerta trasera. Al llegar a un cliente, la entrega &alpha; se realiza de forma directa sin conflicto. Sin embargo, si el cliente requiere recolección (&beta;<sub>i</sub> &gt; 0), toda la carga remanente &alpha; que parte hacia el siguiente cliente (y<sub>ij</sub>) debe descargarse temporalmente para colocar &beta; al fondo y luego recargarse, con costo h<sub>a</sub> y<sub>ij</sub>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>(26) Función Objetivo TSPPD-H_2</span>
                </div>
                <p className="text-zinc-400 font-sans text-xs">
                  Minimiza el costo de recorrido más el costo de manipulación de la mercancía &alpha; remanente que se reubica al recolectar &beta;:
                </p>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sky-300 text-xs sm:text-sm overflow-x-auto">
                  min Z = &sum;<sub>(i,j) &isin; A</sub> c<sub>ij</sub> x<sub>ij</sub> + &sum;<sub>(i,j) &isin; A \ A<sub>d</sub> : &beta;<sub>i</sub> &gt; 0</sub> h<sub>a</sub> y<sub>ij</sub>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-sky-400 font-bold text-sm">
                  Restricciones del Modelo TSPPD-H_2 (Ecs. 27 &rarr; 18 - 25)
                </div>
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">Ecuaciones (18) a (25):</strong>
                    <p className="text-zinc-400 font-sans">El espacio de soluciones factibles está sujeto exactamente a las mismas restricciones de grado, conservación de flujo agregado y capacidad de carga que TSPPD-H_1, diferenciándose exclusivamente en la estructura del término de manipulación de la función objetivo.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">Proposición 1 y 2 (Dualidad e Inversión):</strong>
                    <p className="text-zinc-400 font-sans">
                      Para distancias simétricas, una solución óptima de <strong>TSPPD-H_2</strong> puede obtenerse invirtiendo el sentido de recorrido de la solución óptima de <strong>TSPPD-H_1</strong> sobre una instancia con demandas permutadas (&alpha;<sub>i</sub> &harr; &beta;<sub>i</sub>) y costos unitarios permutados (h<sub>a</sub> &harr; h<sub>b</sub>).
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 4: MODELO TSPPD-H_3 (POLÍTICA 3, ECUACIONES 31 - 48) */}
          {selectedTab === 'TSPPD-H_3' && (
            <>
              <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 font-sans space-y-1">
                <div className="text-sm font-bold text-teal-400 flex items-center gap-2">
                  <GitFork className="w-4 h-4" />
                  <span>Modelo TSPPD-H_3 (Política 3 de Battarra et al., 2010 - Híbrida / Dinámica)</span>
                </div>
                <p className="text-xs text-zinc-300">
                  <strong>Patrón de Carga Tri-Bloque:</strong> (F, &beta;<sub>front</sub>, ..., &beta;<sub>front</sub>, &alpha;, ..., &alpha;, &beta;<sub>rear</sub>, ..., &beta;<sub>rear</sub>, R). En cada cliente i &isin; V<sub>c</sub>, el optimizador decide dinámicamente si aplica la Política 1 (s<sub>i</sub> = 1) o la Política 2 (s<sub>i</sub> = 0). Permite combinar lo mejor de ambas políticas, reduciendo sustancialmente el costo total de manipulación hacia el óptimo teórico.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  <span>(31) Función Objetivo TSPPD-H_3</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-teal-300 text-xs sm:text-sm overflow-x-auto">
                  min Z = &sum;<sub>(i,j) &isin; A</sub> c<sub>ij</sub> x<sub>ij</sub> + &sum;<sub>(i,j) &isin; A \ A<sub>r</sub> : &alpha;<sub>j</sub> &gt; 0</sub> h<sub>b</sub> z<sub>ij</sub> + &sum;<sub>i &isin; V<sub>c</sub></sub> q<sub>i</sub>
                </div>
                <p className="text-zinc-400 font-sans text-xs">
                  El término h<sub>b</sub> z<sub>ij</sub> contabiliza la manipulación de la mercancía &beta; en la compuerta bajo Política 1, mientras que el término q<sub>i</sub> ajusta el costo adicional cuando se elige la Política 2 (s<sub>i</sub> = 0).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-teal-400 font-bold text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>Variables de Decisión y Control de Política (Ecs. 45 - 48)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">s<sub>i</sub> &isin; &#123;0, 1&#125;:</strong>
                    <span className="text-zinc-400 font-sans">1 si se aplica Política 1 en el cliente i (compuerta); 0 si se aplica Política 2 (fondo).</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">w<sub>ij</sub> &ge; 0:</strong>
                    <span className="text-zinc-400 font-sans">Flujo de mercancía &beta; ubicada en el <strong>frente</strong> (fondo) del vehículo.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <strong className="text-zinc-100 block mb-1">z<sub>ij</sub> &ge; 0:</strong>
                    <span className="text-zinc-400 font-sans">Flujo de mercancía &beta; ubicada en la <strong>compuerta trasera</strong>.</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="text-teal-400 font-bold text-sm">
                  Restricciones Principales de la Política 3 (Ecs. 32 - 44)
                </div>
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(35) Flujo Total de Recolección &beta; (Front + Rear):</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j</sub> (w<sub>ij</sub> + z<sub>ij</sub>) - &sum;<sub>j</sub> (w<sub>ji</sub> + z<sub>ji</sub>) = &beta;<sub>i</sub> &forall; i &isin; V<sub>c</sub>.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(36) Condición de Inserción en Frente:</strong>
                    <p className="text-zinc-400 font-mono">&sum;<sub>j</sub> w<sub>ij</sub> - &sum;<sub>j</sub> w<sub>ji</sub> &le; (1 - s<sub>i</sub>) &middot; &sum;<sub>j</sub> &beta;<sub>j</sub> &forall; i &isin; V<sub>c</sub>.</p>
                    <p className="text-zinc-400 font-sans mt-1">Si s<sub>i</sub> = 1 (Política 1), no se puede ingresar mercancía nueva al frente w. Toda la recolección va a la compuerta z.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(37) Capacidad de 3 Bloques:</strong>
                    <p className="text-zinc-400 font-mono">w<sub>ij</sub> + y<sub>ij</sub> + z<sub>ij</sub> &le; Q &middot; x<sub>ij</sub> &forall; (i, j) &isin; A.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <strong className="text-zinc-200 font-mono block mb-1">(39) - (44) Activación Condicional del Costo de Manipulación q<sub>i</sub>:</strong>
                    <p className="text-zinc-400 font-sans">
                      Cuando s<sub>i</sub> = 1, las cotas superiores fuerzan q<sub>i</sub> = 0. Cuando s<sub>i</sub> = 0 (Política 2), q<sub>i</sub> adopta el valor exacto de reubicación de la mercancía de entrega y/o de compuerta remanente.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-mono">
            {selectedTab === 'TSPPD-H'
              ? 'Código: notebooks/tsppd_h_gurobi.py'
              : selectedTab === 'TSPPD-H_1'
              ? 'Código: notebooks/tsppd_h_1_gurobi.py'
              : selectedTab === 'TSPPD-H_2'
              ? 'Código: notebooks/tsppd_h_2_gurobi.py'
              : 'Código: notebooks/tsppd_h_3_gurobi.py'}
          </span>
          <div className="flex items-center gap-3">
            {activeModel !== selectedTab && (
              <button
                onClick={() => {
                  onSelectModel(selectedTab);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
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
