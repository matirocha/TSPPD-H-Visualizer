import React, { useMemo } from 'react';
import { Solution, CargoSubPhase, CARGO_PHASES } from '../types/tsppd';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Truck,
  Info
} from 'lucide-react';

interface LifoCargoBayProps {
  solution: Solution;
  currentStepIndex: number;
  subPhase: CargoSubPhase;
  onSelectSubPhase: (phase: CargoSubPhase) => void;
  speed: number;
}

export const LifoCargoBay: React.FC<LifoCargoBayProps> = ({
  solution,
  currentStepIndex,
  subPhase,
  onSelectSubPhase,
  speed,
}) => {
  const currentStep = solution.steps[currentStepIndex] || solution.steps[0];
  const capacity = solution.capacity;
  const h_val = solution.h;

  const targetNode = solution.nodes.find((n) => n.id === currentStep.to) || {
    id: currentStep.to,
    alpha: currentStep.deliverA,
    beta: currentStep.pickupB,
    label: currentStep.to === 0 ? 'Depósito' : `Cliente ${currentStep.to}`,
    isDepot: currentStep.to === 0,
  };

  // Derive slot states according to the current subPhase
  const currentBaySlots = useMemo(() => {
    const rawArrivalSlots = [...currentStep.slots];
    const totalDeliverA = currentStep.deliverA;
    const handlingCount = currentStep.handlingCount;

    let bay = [...rawArrivalSlots];
    let delCount = 0;

    switch (subPhase) {
      case 'arrival':
        bay = [...rawArrivalSlots];
        break;

      case 'handling':
        // If there is handling, blocking B units are in the temporary holding bay
        bay = rawArrivalSlots.map((s, idx) => {
          if (idx < handlingCount && s === 'B') {
            return 'EMPTY';
          }
          return s;
        });
        break;

      case 'delivery':
        // Alpha items are being delivered to the customer
        bay = rawArrivalSlots.map((s, idx) => {
          if (idx < handlingCount && s === 'B') return 'EMPTY';
          if (s === 'A' && delCount < totalDeliverA) {
            delCount++;
            return 'EMPTY';
          }
          return s;
        });
        break;

      case 'reload':
        // Staged B items are returned into their positions
        let aRemoved = 0;
        bay = rawArrivalSlots.map((s) => {
          if (s === 'A' && aRemoved < totalDeliverA) {
            aRemoved++;
            return 'EMPTY';
          }
          return s;
        });
        break;

      case 'pickup':
      case 'ready':
        // Final state after customer visit
        if (currentStepIndex + 1 < solution.steps.length) {
          bay = [...solution.steps[currentStepIndex + 1].slots];
        } else {
          // Final depot delivery
          bay = rawArrivalSlots.map((s) => (s === 'A' ? 'EMPTY' : s));
        }
        break;
    }

    return bay;
  }, [currentStep, subPhase, currentStepIndex, solution.steps]);

  // Counts of Alpha and Beta currently inside the bay
  const alphaInBay = currentBaySlots.filter((s) => s === 'A').length;
  const betaInBay = currentBaySlots.filter((s) => s === 'B').length;
  const emptyInBay = capacity - (alphaInBay + betaInBay);

  // Transition timing adjusted by speed
  const animDuration = Math.max(0.4, 0.8 / speed);

  return (
    <div className="w-full bg-zinc-950 rounded-2xl border border-zinc-800/80 p-4 lg:p-5 flex flex-col gap-4 shadow-xl">
      
      {/* Top Banner: LIFO Simulator Title & Micro-phase Stepper */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                Simulador del Compartimiento de Carga LIFO
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  Capacidad Q = {capacity}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Visualización detallada y lenta de estiba, descargas de entregas (α), manipulación (Handling) y recolecciones (β).
              </p>
            </div>
          </div>
        </div>

        {/* Phase Badges Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
          {CARGO_PHASES.map((phase) => {
            const isSelected = subPhase === phase.id;
            return (
              <button
                key={phase.id}
                onClick={() => onSelectSubPhase(phase.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? `${phase.badge} ring-1 ring-white/20 shadow-md font-semibold`
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800'
                }`}
              >
                <span>{phase.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Simulation Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Side (Lg 8 cols): The Truck Bay Container & Slots */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          
          {/* Truck Header Bar with Cargo Stats */}
          <div className="bg-zinc-900/90 rounded-xl border border-zinc-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-zinc-200">
                Camión en: {targetNode.label}
              </span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400 font-mono">
                Paso {currentStepIndex + 1}/{solution.steps.length}
              </span>
            </div>

            {/* Live Cargo Badges */}
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                α en camión: {alphaInBay}
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                β en camión: {betaInBay}
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                Vacíos: {emptyInBay}
              </span>
            </div>
          </div>

          {/* Truck Physical Container Graphic */}
          <div className="relative bg-zinc-900/60 rounded-2xl border-2 border-zinc-700/80 p-4 pt-8 overflow-hidden shadow-inner">
            
            {/* Front of Truck Cab (Left Side) */}
            <div className="absolute top-2 left-3 flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">
              <div className="w-2 h-2 rounded-full bg-zinc-600" />
              Cabina / Fondo del Camión
            </div>

            {/* Rear Door / Puerta Trasera (Right Side) */}
            <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
              <span>Puerta Trasera (Acceso LIFO)</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </div>

            {/* Slot Matrix Grid */}
            <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 py-2">
              {Array.from({ length: capacity }, (_, idx) => {
                const slotNum = idx + 1;
                const slotContent = currentBaySlots[idx] || 'EMPTY';
                const isHandlingSlot = currentStep.handlingCount > 0 && idx < currentStep.handlingCount;

                return (
                  <motion.div
                    key={`slot-${slotNum}-${slotContent}`}
                    layout
                    initial={{ scale: 0.9, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: animDuration, ease: 'easeOut' }}
                    className={`relative rounded-xl p-2.5 flex flex-col items-center justify-between min-h-[78px] border transition-all ${
                      slotContent === 'A'
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/50'
                        : slotContent === 'B'
                        ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/50'
                        : 'bg-zinc-950/60 border-dashed border-zinc-800/80 opacity-60'
                    } ${isHandlingSlot && subPhase === 'handling' ? 'ring-2 ring-amber-500 animate-pulse' : ''}`}
                  >
                    {/* Slot Index Tag */}
                    <div className="w-full flex items-center justify-between text-[9px] font-mono text-zinc-400">
                      <span>#{slotNum}</span>
                      {slotNum === capacity && (
                        <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                          PUERTA
                        </span>
                      )}
                    </div>

                    {/* Box Visual Item */}
                    <div className="my-1 flex items-center justify-center">
                      {slotContent === 'A' ? (
                        <motion.div
                          initial={{ y: -6, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="flex flex-col items-center"
                        >
                          <Package className="w-6 h-6 text-rose-400" />
                          <span className="text-[10px] font-bold text-rose-300 font-mono mt-0.5">
                            α (Ent)
                          </span>
                        </motion.div>
                      ) : slotContent === 'B' ? (
                        <motion.div
                          initial={{ y: 6, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="flex flex-col items-center"
                        >
                          <Package className="w-6 h-6 text-cyan-300" />
                          <span className="text-[10px] font-bold text-cyan-300 font-mono mt-0.5">
                            β (Rec)
                          </span>
                        </motion.div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-dashed border-zinc-700/60 flex items-center justify-center">
                          <span className="text-[8px] text-zinc-600 font-mono">—</span>
                        </div>
                      )}
                    </div>

                    {/* Conflict Badge if applicable */}
                    {isHandlingSlot && slotContent === 'B' && (
                      <div className="text-[8px] font-bold text-amber-400 font-mono">
                        ⚠️ Handling
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Direction Arrow */}
            <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1">
                <span>◀ Fondo (Primeras Posiciones)</span>
              </span>
              <span className="text-zinc-400 font-medium">
                Regla LIFO: Último en entrar, primero en salir por la puerta trasera ▶
              </span>
            </div>
          </div>

          {/* Staging / Handling Bay Area (If handling conflict occurs) */}
          <AnimatePresence>
            {(currentStep.handlingCount > 0 || subPhase === 'handling') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">
                      Zona Temporal de Manipulación (Handling Staging Bay)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">
                    {currentStep.handlingCount} unidades β desplazadas temporalmente · Costo: +{currentStep.handlingCost.toFixed(2)}
                  </span>
                </div>

                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Las unidades <strong className="text-cyan-300">β (recolección)</strong> se encontraban más cerca de la puerta trasera que las unidades <strong className="text-rose-300">α (entrega)</strong>. Para no violar la política de acceso LIFO, el operario las descarga temporalmente a la dársena para acceder a la carga requerida.
                </p>

                {/* Staged Boxes */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {Array.from({ length: currentStep.handlingCount }, (_, idx) => (
                    <motion.div
                      key={`staged-box-${idx}`}
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ delay: idx * 0.1, duration: animDuration }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center gap-1.5 text-xs font-mono text-amber-200"
                    >
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                      <span>β Temp #{idx + 1}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Side (Lg 4 cols): Customer Dock & Demand Breakdown */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          
          {/* Customer Node Card */}
          <div className="bg-zinc-900/90 rounded-xl border border-zinc-800 p-4 flex flex-col gap-3 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${targetNode.isDepot ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="font-bold text-sm text-zinc-100">
                  Dársena de {targetNode.label}
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Nodo #{targetNode.id}
              </span>
            </div>

            {/* Delivery Requirements (Alpha) */}
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <span className="flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5 text-rose-400" />
                  Entrega Requerida (α)
                </span>
                <span className="font-mono text-sm font-bold text-rose-400">
                  {currentStep.deliverA} unidades
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Mercancía que proviene del depósito central y debe ser entregada en este nodo.
              </p>
              {subPhase === 'delivery' && (
                <div className="mt-1 text-[11px] font-mono text-rose-300 flex items-center gap-1.5 bg-rose-500/10 px-2 py-1 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
                  Descargando {currentStep.deliverA} cajas α en el cliente...
                </div>
              )}
            </div>

            {/* Pickup Requirements (Beta) */}
            <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  Recolección Requerida (β)
                </span>
                <span className="font-mono text-sm font-bold text-cyan-400">
                  {currentStep.pickupB} unidades
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Mercancía generada en el cliente que debe ser transportada de regreso al depósito.
              </p>
              {subPhase === 'pickup' && (
                <div className="mt-1 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 bg-cyan-500/10 px-2 py-1 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Cargando {currentStep.pickupB} cajas β en el camión...
                </div>
              )}
            </div>

            {/* Cost Breakdown of this specific step */}
            <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800/80 flex flex-col gap-1.5 text-xs font-mono">
              <div className="text-[11px] uppercase font-semibold text-zinc-400 font-sans tracking-wider">
                Desglose de Costo en este Paso
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Distancia ({currentStep.distance} km):</span>
                <span className="font-semibold text-zinc-100">{currentStep.distance}.00</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Handling ({currentStep.handlingCount} ops × {h_val}):</span>
                <span className="font-semibold text-amber-400">+{currentStep.handlingCost.toFixed(2)}</span>
              </div>
              <div className="pt-1.5 border-t border-zinc-800 flex justify-between font-bold text-emerald-400 text-sm">
                <span>Subtotal Paso:</span>
                <span>{(currentStep.distance + currentStep.handlingCost).toFixed(2)}</span>
              </div>
            </div>

          </div>

          {/* Current Phase Quick Narrative */}
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-3.5 flex items-start gap-2.5 text-xs">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-zinc-300">
              <strong className="text-zinc-100 font-semibold block mb-0.5">
                {CARGO_PHASES.find((p) => p.id === subPhase)?.label}:
              </strong>
              {CARGO_PHASES.find((p) => p.id === subPhase)?.description}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
