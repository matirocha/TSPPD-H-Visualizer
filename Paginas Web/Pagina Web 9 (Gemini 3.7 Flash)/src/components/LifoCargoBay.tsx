import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Box,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  Truck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Boxes,
  Info,
  DoorClosed,
} from 'lucide-react';
import { SolutionData, StepData, CargoSubStepDef } from '../types/solution';
import { formatNumber } from '../lib/utils';

interface LifoCargoBayProps {
  solution: SolutionData;
  currentStep: StepData;
  currentStepIndex: number;
  isArrived: boolean;
  isContinuousMode: boolean;
  speed?: number;
  onContinueJourney: () => void;
}

export const LifoCargoBay: React.FC<LifoCargoBayProps> = ({
  solution,
  currentStep,
  currentStepIndex,
  isArrived,
  isContinuousMode,
  speed = 1,
  onContinueJourney,
}) => {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [subStep, setSubStep] = useState<number>(1); // 1 to 4

  const capacity = solution.capacity;
  const currentSlots = currentStep.slots || [];
  const nextStep = solution.steps[currentStepIndex + 1];
  const nextSlots = nextStep ? nextStep.slots : currentSlots;

  const deliverA = currentStep.deliverA;
  const pickupB = currentStep.pickupB;
  const handlingCount = currentStep.handlingCount;
  const destinationNode = solution.nodes[currentStep.to] || {
    id: currentStep.to,
    alpha: deliverA,
    beta: pickupB,
    label: currentStep.to === 0 ? 'Depósito' : `Cliente ${currentStep.to}`,
    isDepot: currentStep.to === 0,
  };
  const isLastStep = currentStepIndex >= solution.steps.length - 1;

  // Reset sub-step when step or arrived status changes
  useEffect(() => {
    setSubStep(1);
    setSelectedSlotIdx(null);
  }, [isArrived, currentStepIndex]);

  // Identify handling blockers (beta items near the door in currentSlots)
  const handledBetaIndices = useMemo(() => {
    const indices: number[] = [];
    if (handlingCount > 0) {
      let count = handlingCount;
      for (let i = 0; i < currentSlots.length && count > 0; i++) {
        if (currentSlots[i] === 'B') {
          indices.push(i);
          count--;
        }
      }
    }
    return indices;
  }, [currentSlots, handlingCount]);

  // Identify alpha deliveries in currentSlots
  const deliveredAlphaIndices = useMemo(() => {
    const indices: number[] = [];
    let count = deliverA;
    for (let i = 0; i < currentSlots.length && count > 0; i++) {
      if (currentSlots[i] === 'A') {
        indices.push(i);
        count--;
      }
    }
    return indices;
  }, [currentSlots, deliverA]);

  // Identify newly loaded beta indices in nextSlots
  const newBetaIndices = useMemo(() => {
    const indices: number[] = [];
    if (pickupB > 0) {
      let count = pickupB;
      for (let i = 0; i < nextSlots.length && count > 0; i++) {
        if (nextSlots[i] === 'B' && !handledBetaIndices.includes(i)) {
          indices.push(i);
          count--;
        }
      }
    }
    return indices;
  }, [nextSlots, pickupB, handledBetaIndices]);

  // Stage derived from isArrived & subStep
  const stage = useMemo<'transit' | 'handling-out' | 'unloading-alpha' | 'handling-in' | 'loading-beta' | 'settled'>(() => {
    if (!isArrived) return 'transit';
    if (subStep === 1) return 'handling-out';
    if (subStep === 2) return 'unloading-alpha';
    if (subStep === 3) return 'handling-in';
    if (subStep === 4) return 'loading-beta';
    return 'settled';
  }, [isArrived, subStep]);

  // Auto-advance timer between sub-steps ONLY in continuous mode
  useEffect(() => {
    if (!isArrived || !isContinuousMode) return;

    const subStepDurations = [
      handlingCount > 0 ? 3200 / speed : 1400 / speed, // Sub-step 1: Handling out
      deliverA > 0 ? 3200 / speed : 1400 / speed,       // Sub-step 2: Unloading alpha
      handlingCount > 0 ? 2800 / speed : 1200 / speed, // Sub-step 3: Handling in
      pickupB > 0 ? 3400 / speed : 1600 / speed,        // Sub-step 4: Loading beta
    ];

    const currentDuration = subStepDurations[subStep - 1] || 2500;

    const timer = setTimeout(() => {
      if (subStep < 4) {
        setSubStep((prev) => prev + 1);
      } else {
        // Finished sub-step 4 -> Automatically continue journey to next customer
        onContinueJourney();
      }
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [isArrived, isContinuousMode, subStep, handlingCount, deliverA, pickupB, speed, onContinueJourney]);

  // Display slot states mapped dynamically by sub-step
  const displaySlots = useMemo(() => {
    if (!isArrived || stage === 'transit') {
      return currentSlots;
    }

    if (stage === 'handling-out') {
      return currentSlots.map((item, idx) => {
        if (handledBetaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }

    if (stage === 'unloading-alpha') {
      return currentSlots.map((item, idx) => {
        if (handledBetaIndices.includes(idx) || deliveredAlphaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }

    if (stage === 'handling-in') {
      return nextSlots.map((item, idx) => {
        if (item === 'B' && newBetaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }

    // stage === 'loading-beta' or 'settled'
    return nextSlots;
  }, [isArrived, stage, currentSlots, nextSlots, handledBetaIndices, deliveredAlphaIndices, newBetaIndices]);

  // Counts
  const alphaInBay = displaySlots.filter((s) => s === 'A').length;
  const betaInBay = displaySlots.filter((s) => s === 'B').length;
  const emptyInBay = Math.max(0, capacity - alphaInBay - betaInBay);

  // Sub-step definitions
  const subStepDefs: CargoSubStepDef[] = [
    {
      id: 1,
      title: 'Paso 1: Evacuación LIFO (Handling)',
      shortTitle: '1. Evacuación',
      statusText: handlingCount > 0
        ? `⚠️ Conflicto LIFO: Se extraen ${handlingCount} unidades β por la compuerta trasera hacia la dársena temporal (Costo: +${currentStep.handlingCost.toFixed(2)}).`
        : '✅ Sin conflicto LIFO: La compuerta trasera está despejada para la entrega.',
      color: 'amber',
      hasAction: handlingCount > 0,
    },
    {
      id: 2,
      title: 'Paso 2: Descarga de Mercancía α (Entrega)',
      shortTitle: '2. Descarga α',
      statusText: deliverA > 0
        ? `📦 Descarga en proceso: ${deliverA} unidades α salen por la compuerta trasera hacia el almacén de ${destinationNode.label}.`
        : `ℹ️ Sin entregas α requeridas en ${destinationNode.label}.`,
      color: 'rose',
      hasAction: deliverA > 0,
    },
    {
      id: 3,
      title: 'Paso 3: Reingreso y Reordenamiento LIFO',
      shortTitle: '3. Reingreso',
      statusText: handlingCount > 0
        ? `🔄 Reingreso LIFO: Las ${handlingCount} unidades β del buffer temporal vuelven a entrar y se asientan en las posiciones internas.`
        : '✅ Compartimento ordenado: No se requirió reacomodo de mercancía.',
      color: 'amber',
      hasAction: handlingCount > 0,
    },
    {
      id: 4,
      title: 'Paso 4: Carga y Recolección de Mercancía β',
      shortTitle: '4. Carga β',
      statusText: pickupB > 0
        ? `📥 Recolección en curso: ${pickupB} nuevas unidades β entran por la compuerta trasera y ocupan los slots del camión.`
        : `ℹ️ Sin recolecciones β requeridas en ${destinationNode.label}.`,
      color: 'cyan',
      hasAction: pickupB > 0,
    },
  ];

  const currentSubStepDef = subStepDefs[subStep - 1];
  const animDuration = Math.max(0.4, 1.0 / speed);

  return (
    <div className="w-full rounded-3xl bg-zinc-950/95 border border-zinc-800/90 p-4 lg:p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
      
      {/* Top Banner: Title + Sub-step Navigation Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-400 text-zinc-950 shadow-lg shadow-cyan-950/40">
            <Boxes className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="font-bold text-base text-zinc-100 flex items-center gap-2">
              Compartimiento de Carga LIFO
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                Capacidad Q = {capacity}
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Animación física paso a paso de carga, descarga y reordenamiento según política LIFO
            </p>
          </div>
        </div>

        {/* Action Controls: Repeat Button & Sub-step Stepper */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Repeat explanation */}
          <button
            onClick={() => setSubStep(1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer shadow-sm"
            title="Reiniciar y reproducir los 4 sub-pasos"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Repetir (1 a 4)</span>
          </button>

          {/* Stepper Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            {subStepDefs.map((sDef) => {
              const isCurrent = sDef.id === subStep;
              const isDone = sDef.id < subStep;
              return (
                <button
                  key={`substep-tab-btn-${sDef.id}`}
                  onClick={() => setSubStep(sDef.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isCurrent
                      ? sDef.color === 'amber'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                        : sDef.color === 'rose'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm font-semibold'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                      : isDone
                      ? 'text-emerald-400 hover:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-bold ${isCurrent ? 'bg-white text-zinc-950' : isDone ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                    {isDone ? '✓' : sDef.id}
                  </span>
                  <span className="hidden sm:inline">{sDef.shortTitle}</span>
                </button>
              );
            })}
          </div>

          {/* Previous / Next Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSubStep((prev) => Math.max(1, prev - 1))}
              disabled={subStep === 1}
              className="p-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-mono text-zinc-300 flex items-center gap-1 transition-all cursor-pointer border border-zinc-700"
              title="Sub-paso anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Ant</span>
            </button>

            <button
              onClick={() => {
                if (subStep < 4) {
                  setSubStep((prev) => prev + 1);
                } else {
                  onContinueJourney();
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                subStep === 4
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 ring-1 ring-emerald-300'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-zinc-950 shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-400'
              }`}
            >
              <span>{subStep === 4 ? (isLastStep ? 'Finalizar Tour ➔' : 'Continuar Ruta ➔') : `Siguiente (${subStep + 1}/4) ➔`}</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-step Explanation Banner */}
      <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-3 sm:p-4 flex items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${currentSubStepDef.color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : currentSubStepDef.color === 'rose' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'}`}>
            {subStep === 1 && <ArrowLeft className="w-4 h-4 animate-pulse" />}
            {subStep === 2 && <ArrowLeft className="w-4 h-4 animate-bounce" />}
            {subStep === 3 && <ArrowRight className="w-4 h-4 animate-pulse" />}
            {subStep === 4 && <ArrowRight className="w-4 h-4 animate-bounce" />}
          </div>
          <div>
            <span className={`text-xs font-bold font-mono block ${currentSubStepDef.color === 'amber' ? 'text-amber-300' : currentSubStepDef.color === 'rose' ? 'text-rose-300' : 'text-cyan-300'}`}>
              {currentSubStepDef.title}
            </span>
            <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
              {currentSubStepDef.statusText}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-zinc-400">
          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
            Fase {subStep}/4
          </span>
        </div>
      </div>

      {/* Main Simulation Layout: Truck Compartment (Left 8 cols) + Logistics Dock (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Side (Lg 8 cols): Physical Truck Trailer & Slots */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          
          {/* Truck Header Bar with Cargo Stats */}
          <div className="bg-zinc-900/90 rounded-xl border border-zinc-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-zinc-200">
                Camión en: <strong className="text-white">{destinationNode.label}</strong>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 font-mono">
                Paso {currentStepIndex + 1}/{solution.steps.length}
              </span>
            </div>

            {/* Live Cargo Badges */}
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                α a bordo: {alphaInBay}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                β a bordo: {betaInBay}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400">
                Libres: {emptyInBay}
              </span>
            </div>
          </div>

          {/* Physical Container Graphic (Design from Pagina Web 3) */}
          <div className="relative bg-zinc-900/60 rounded-2xl border-2 border-zinc-700/80 p-4 pt-8 overflow-hidden shadow-inner">
            
            {/* Front of Truck Cab (Left Side) */}
            <div className="absolute top-2.5 left-3.5 flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span>◀ Cabina / Fondo del Camión (Slot {capacity})</span>
            </div>

            {/* Rear Door / Puerta Trasera (Right Side) */}
            <div className="absolute top-2.5 right-3.5 flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
              <span>Puerta Trasera (Acceso LIFO - Slot 1)</span>
              <DoorClosed className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </div>

            {/* Slot Matrix Grid */}
            <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 py-2">
              {Array.from({ length: capacity }, (_, idx) => {
                const slotNum = idx + 1;
                const slotContent = displaySlots[idx] || 'EMPTY';
                const isAlpha = slotContent === 'A';
                const isBeta = slotContent === 'B';
                const isSelected = selectedSlotIdx === slotNum;
                const isNearDoor = slotNum <= 3;

                const isHandlingExiting = stage === 'handling-out' && handledBetaIndices.includes(idx);
                const isDeliveringExiting = stage === 'unloading-alpha' && deliveredAlphaIndices.includes(idx);
                const isHandlingEntering = stage === 'handling-in' && idx < handledBetaIndices.length;
                const isLoadingEntering = stage === 'loading-beta' && newBetaIndices.includes(idx);

                return (
                  <motion.div
                    key={`bay-slot-${slotNum}-${slotContent}`}
                    layout
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedSlotIdx(isSelected ? null : slotNum)}
                    className={`relative rounded-xl p-2.5 flex flex-col items-center justify-between min-h-[82px] border transition-all cursor-pointer select-none ${
                      isDeliveringExiting
                        ? 'bg-rose-900/80 border-rose-400 text-white ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/60 scale-105'
                        : isHandlingExiting || isHandlingEntering
                        ? 'bg-amber-900/80 border-amber-400 text-white ring-2 ring-amber-500/60 shadow-lg shadow-amber-950/60 scale-105'
                        : isLoadingEntering
                        ? 'bg-cyan-900/80 border-cyan-400 text-white ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-950/60 scale-105'
                        : isAlpha
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-md shadow-rose-950/40'
                        : isBeta
                        ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md shadow-cyan-950/40'
                        : 'bg-zinc-950/60 border-dashed border-zinc-800/80 opacity-60 hover:opacity-100 hover:border-zinc-700'
                    } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-105 z-20' : ''}`}
                  >
                    {/* Slot Index Tag */}
                    <div className="w-full flex items-center justify-between text-[9px] font-mono text-zinc-400">
                      <span>#{slotNum}</span>
                      {slotNum === 1 && (
                        <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                          PUERTA
                        </span>
                      )}
                      {slotNum === capacity && (
                        <span className="text-[8px] px-1 rounded bg-zinc-800 text-zinc-400 font-medium">
                          FONDO
                        </span>
                      )}
                    </div>

                    {/* Box Graphic */}
                    <div className="my-1 flex items-center justify-center">
                      {isAlpha ? (
                        <motion.div
                          animate={
                            isDeliveringExiting
                              ? { x: [0, 20, 40], opacity: [1, 0.6, 0] }
                              : {}
                          }
                          transition={{ duration: animDuration, repeat: isDeliveringExiting ? Infinity : 0 }}
                          className="flex flex-col items-center"
                        >
                          <Box className="w-6 h-6 text-rose-400 drop-shadow" />
                          <span className="text-[10px] font-bold text-rose-300 font-mono mt-0.5">
                            α (Ent)
                          </span>
                        </motion.div>
                      ) : isBeta ? (
                        <motion.div
                          animate={
                            isHandlingExiting
                              ? { x: [0, 20, 40], opacity: [1, 0.6, 0] }
                              : isHandlingEntering
                              ? { x: [40, 20, 0], opacity: [0, 0.7, 1] }
                              : isLoadingEntering
                              ? { x: [40, 20, 0], opacity: [0, 0.7, 1] }
                              : {}
                          }
                          transition={{
                            duration: animDuration,
                            repeat: isHandlingExiting || isHandlingEntering || isLoadingEntering ? Infinity : 0,
                          }}
                          className="flex flex-col items-center"
                        >
                          <Package className={`w-6 h-6 ${isHandlingExiting || isHandlingEntering ? 'text-amber-300' : 'text-cyan-300'} drop-shadow`} />
                          <span className={`text-[10px] font-bold font-mono mt-0.5 ${isHandlingExiting || isHandlingEntering ? 'text-amber-300' : 'text-cyan-300'}`}>
                            β (Rec)
                          </span>
                        </motion.div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-dashed border-zinc-700/60 flex items-center justify-center">
                          <span className="text-[8px] text-zinc-600 font-mono">—</span>
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="text-[8px] font-mono font-bold text-center w-full truncate">
                      {isDeliveringExiting ? (
                        <span className="text-rose-300 font-black">SALE α</span>
                      ) : isHandlingExiting ? (
                        <span className="text-amber-300 font-black">EVAC β</span>
                      ) : isHandlingEntering ? (
                        <span className="text-amber-300 font-black">REINGR</span>
                      ) : isLoadingEntering ? (
                        <span className="text-cyan-300 font-black">ENTRA β</span>
                      ) : isAlpha ? (
                        <span className="text-rose-400/80">Entrega</span>
                      ) : isBeta ? (
                        <span className="text-cyan-400/80">Recolec</span>
                      ) : (
                        <span className="text-zinc-600">Vacío</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Indicator Bar */}
            <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1">
                <span>◀ Fondo del Tráiler (Primeras Posiciones)</span>
              </span>
              <span className="text-zinc-400 font-medium">
                Regla LIFO: Último en entrar, primero en salir por la puerta trasera ▶
              </span>
            </div>
          </div>

          {/* Staging / Handling Bay Area (If handling conflict occurs) */}
          <AnimatePresence>
            {(currentStep.handlingCount > 0 || subStep === 1 || subStep === 3) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-3.5 flex flex-col gap-2 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      Zona de Buffer Temporal (Handling LIFO)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">
                    {currentStep.handlingCount} unidades β desplazadas &middot; Costo: +{formatNumber(currentStep.handlingCost, 2)}
                  </span>
                </div>

                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Las unidades <strong className="text-cyan-300">β (recolección)</strong> se encontraban más cerca de la puerta trasera que las unidades <strong className="text-rose-300">α (entrega)</strong>. El operario las descarga temporalmente a la dársena para acceder a la carga requerida sin violar la política LIFO.
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

          {/* Selected Slot Inspector Banner */}
          {selectedSlotIdx !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs flex items-center justify-between shadow-xl"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-emerald-400 text-sm">Posición #{selectedSlotIdx}:</span>
                <span className="text-zinc-200">
                  {displaySlots[selectedSlotIdx - 1] === 'A'
                    ? 'Mercancía α (Para entregar a clientes en la ruta)'
                    : displaySlots[selectedSlotIdx - 1] === 'B'
                    ? 'Mercancía β (Recolectada de clientes para retorno al depósito)'
                    : 'Espacio libre en el compartimiento de carga'}
                </span>
              </div>
              <button
                onClick={() => setSelectedSlotIdx(null)}
                className="text-zinc-400 hover:text-white text-xs px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 cursor-pointer font-semibold transition-all"
              >
                Cerrar
              </button>
            </motion.div>
          )}

        </div>

        {/* Right Side (Lg 4 cols): Customer Dock & Demand Breakdown */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          
          {/* Customer Node Card */}
          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3 shadow-md">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${destinationNode.isDepot ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="font-bold text-sm text-zinc-100">
                  Muelle de {destinationNode.label}
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Nodo #{destinationNode.id}
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
                  {deliverA} unidades
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Mercancía proveniente del depósito central entregada en este nodo.
              </p>
              {stage === 'unloading-alpha' && (
                <div className="mt-1 text-[11px] font-mono text-rose-300 flex items-center gap-1.5 bg-rose-500/10 px-2 py-1 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
                  Descargando {deliverA} cajas α en el cliente...
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
                  {pickupB} unidades
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Mercancía generada en el cliente que se transporta de retorno al depósito.
              </p>
              {stage === 'loading-beta' && (
                <div className="mt-1 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 bg-cyan-500/10 px-2 py-1 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Cargando {pickupB} cajas β en el camión...
                </div>
              )}
            </div>

            {/* Step Cost Breakdown */}
            <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800/80 flex flex-col gap-1.5 text-xs font-mono">
              <div className="text-[11px] uppercase font-semibold text-zinc-400 font-sans tracking-wider">
                Desglose de Costo del Paso
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Distancia ({currentStep.distance} km):</span>
                <span className="font-semibold text-zinc-100">{currentStep.distance}.00</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Handling ({currentStep.handlingCount} ops × {solution.h}):</span>
                <span className="font-semibold text-amber-400">+{formatNumber(currentStep.handlingCost, 2)}</span>
              </div>
              <div className="pt-1.5 border-t border-zinc-800 flex justify-between font-bold text-emerald-400 text-sm">
                <span>Subtotal Paso:</span>
                <span>{formatNumber(currentStep.distance + currentStep.handlingCost, 2)}</span>
              </div>
            </div>

          </div>

          {/* Current Sub-Phase Info Tip */}
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-3.5 flex items-start gap-2.5 text-xs">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-zinc-300">
              <strong className="text-zinc-100 font-semibold block mb-0.5">
                {currentSubStepDef.title}:
              </strong>
              {currentSubStepDef.statusText}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
