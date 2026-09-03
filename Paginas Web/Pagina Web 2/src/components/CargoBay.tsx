import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Package, Box, ArrowLeft, ArrowRight, Layers, DoorClosed, RotateCcw, Truck, ShieldAlert, ChevronRight, ChevronLeft } from 'lucide-react';
import { SolutionData, StepData } from '../types/solution';

interface CargoBayProps {
  solution: SolutionData;
  currentStep: StepData;
  currentStepIndex: number;
  isArrived: boolean;
  isContinuousMode: boolean;
  speed?: number;
  onContinueJourney: () => void;
}

export const CargoBay: React.FC<CargoBayProps> = ({
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
  const destinationNode = solution.nodes[currentStep.to];
  const isLastStep = currentStepIndex >= solution.steps.length - 1;

  // Reset sub-step to 1 whenever arrived or step changes
  useEffect(() => {
    if (isArrived) {
      setSubStep(1);
    } else {
      setSubStep(1);
    }
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

  // Derive active stage based on isArrived and subStep
  const stage = useMemo<'transit' | 'handling-out' | 'unloading-alpha' | 'handling-in' | 'loading-beta' | 'settled'>(() => {
    if (!isArrived) return 'transit';
    if (subStep === 1) return 'handling-out';
    if (subStep === 2) return 'unloading-alpha';
    if (subStep === 3) return 'handling-in';
    if (subStep === 4) return 'loading-beta';
    return 'settled';
  }, [isArrived, subStep]);

  // Auto-advance timer between sub-steps ONLY if isContinuousMode is enabled
  useEffect(() => {
    if (!isArrived || !isContinuousMode) return;

    const subStepDurations = [
      handlingCount > 0 ? 3000 / speed : 1200 / speed, // Sub-step 1: Handling out
      deliverA > 0 ? 3000 / speed : 1200 / speed,       // Sub-step 2: Unloading alpha
      handlingCount > 0 ? 2600 / speed : 1000 / speed, // Sub-step 3: Handling in
      pickupB > 0 ? 3200 / speed : 1500 / speed,        // Sub-step 4: Loading beta
    ];

    const currentDuration = subStepDurations[subStep - 1] || 2500;

    const timer = setTimeout(() => {
      if (subStep < 4) {
        setSubStep((prev) => prev + 1);
      } else {
        // Finished sub-step 4 in continuous mode -> automatically continue journey to next customer
        onContinueJourney();
      }
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [isArrived, isContinuousMode, subStep, handlingCount, deliverA, pickupB, speed, onContinueJourney]);

  // Slot states mapped dynamically by sub-step
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
        // If it's a new beta from this pickup, it hasn't loaded yet
        if (item === 'B' && newBetaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }

    // stage === 'loading-beta' or 'settled'
    return nextSlots;
  }, [isArrived, stage, currentSlots, nextSlots, handledBetaIndices, deliveredAlphaIndices, newBetaIndices]);

  // Sub-step manual navigation handlers
  const handlePrevSubStep = () => {
    if (subStep > 1) {
      setSubStep((prev) => prev - 1);
    }
  };

  const handleNextSubStep = () => {
    if (subStep < 4) {
      setSubStep((prev) => prev + 1);
    } else {
      // Step 4 finished -> Continue trajectory
      onContinueJourney();
    }
  };

  const handleJumpSubStep = (stepNum: number) => {
    setSubStep(stepNum);
  };

  const handleReplayAll = () => {
    setSubStep(1);
  };

  const aCount = displaySlots.filter((s) => s === 'A').length;
  const bCount = displaySlots.filter((s) => s === 'B').length;
  const freeCount = Math.max(0, capacity - aCount - bCount);

  // Sub-step meta definitions
  const subStepDefs = [
    {
      id: 1,
      title: 'Paso 1: Evacuación LIFO (Handling)',
      statusText: handlingCount > 0
        ? `⚠️ Bloqueo LIFO: Se extraen ${handlingCount} unidades β por la puerta trasera al buffer temporal (Costo: +${currentStep.handlingCost.toFixed(2)}).`
        : '✅ Sin conflicto LIFO: La puerta trasera está despejada para la entrega.',
      color: 'amber',
      hasAction: handlingCount > 0,
    },
    {
      id: 2,
      title: 'Paso 2: Descarga de Mercancía α (Entrega)',
      statusText: deliverA > 0
        ? `📦 Descarga en curso: ${deliverA} unidades α salen por la puerta trasera hacia el almacén del cliente (${destinationNode?.label}).`
        : `ℹ️ Sin entregas α requeridas para ${destinationNode?.label}.`,
      color: 'rose',
      hasAction: deliverA > 0,
    },
    {
      id: 3,
      title: 'Paso 3: Reingreso y Reordenamiento LIFO',
      statusText: handlingCount > 0
        ? `🔄 Reacomodo: Las ${handlingCount} unidades β del buffer temporal reingresan por la puerta trasera y se asientan en el fondo.`
        : '✅ Compartimento ordenado: No se requirió reacomodo de mercancía.',
      color: 'amber',
      hasAction: handlingCount > 0,
    },
    {
      id: 4,
      title: 'Paso 4: Carga y Recolección de Mercancía β',
      statusText: pickupB > 0
        ? `📥 Recolección en progreso: ${pickupB} nuevas unidades β entran por la puerta trasera y se posicionan en los slots del camión.`
        : `ℹ️ Sin recolecciones β en ${destinationNode?.label}.`,
      color: 'cyan',
      hasAction: pickupB > 0,
    },
  ];

  const currentSubStepDef = subStepDefs[subStep - 1];

  return (
    <div className="rounded-3xl bg-zinc-900/90 border border-zinc-800/90 p-5 shadow-2xl flex flex-col relative overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 z-10 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-zinc-950 shadow-md shadow-emerald-950/40">
            <Layers className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Compartimento de Carga del Camión (LIFO Físico)
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                Q = {capacity}
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Operaciones paso a paso de carga, descarga y reordenamiento a través de la puerta trasera
            </p>
          </div>
        </div>

        {/* Top Controls: Replay & Load Summary Badges */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReplayAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono font-medium text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer shadow-sm"
            title="Reiniciar y reproducir los 4 pasos de la explicación"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Repetir Explicación (1 a 4)</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              &alpha;: {aCount}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              &beta;: {bCount}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
              Libre: {freeCount}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive 4-Step Explanation & Stepper Controller Banner */}
      <div className="mb-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 p-4 shadow-xl flex flex-col gap-3">
        {/* Stepper Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {subStepDefs.map((sDef) => {
              const isCurrent = sDef.id === subStep;
              const isDone = sDef.id < subStep;

              return (
                <button
                  key={`substep-tab-${sDef.id}`}
                  onClick={() => handleJumpSubStep(sDef.id)}
                  className={`
                    px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer select-none
                    ${
                      isCurrent
                        ? sDef.color === 'amber'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-950'
                          : sDef.color === 'rose'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-md shadow-rose-950'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-950'
                        : isDone
                        ? 'bg-zinc-800/80 text-emerald-400 border border-zinc-700 hover:bg-zinc-800'
                        : 'bg-zinc-900/60 text-zinc-400 border border-zinc-800 hover:bg-zinc-800/80'
                    }
                  `}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${isCurrent ? 'bg-white text-zinc-950' : isDone ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                    {isDone ? '✓' : sDef.id}
                  </span>
                  <span>{sDef.id === 1 ? '1. Evacuación' : sDef.id === 2 ? '2. Descarga α' : sDef.id === 3 ? '3. Reordenamiento' : '4. Carga β'}</span>
                </button>
              );
            })}
          </div>

          {/* Forward / Backward Arrow Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevSubStep}
              disabled={subStep === 1}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-zinc-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1 transition-all cursor-pointer border border-zinc-700"
              title="Volver al sub-paso anterior"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Anterior</span>
            </button>

            {/* The Main Arrow Button requested by the user */}
            <button
              onClick={handleNextSubStep}
              className={`
                px-4 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg
                ${
                  subStep === 4
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-zinc-950 shadow-cyan-500/20'
                }
              `}
              title={subStep === 4 ? 'Finalizar carga/descarga y continuar el recorrido en el mapa' : 'Avanzar a la siguiente fase de la explicación'}
            >
              <span>
                {subStep === 4
                  ? (isLastStep ? 'Finalizar Tour en Depósito ➔' : 'Continuar Trayectoria del Camión ➔')
                  : `Siguiente Sub-Paso (${subStep + 1}/4) ➔`}
              </span>
              <ChevronRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Narrative Description for Active Sub-Step */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${currentSubStepDef.color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : currentSubStepDef.color === 'rose' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'}`}>
              {subStep === 1 && <ArrowLeft className="h-5 w-5 animate-pulse" />}
              {subStep === 2 && <ArrowLeft className="h-5 w-5 animate-bounce" />}
              {subStep === 3 && <ArrowRight className="h-5 w-5 animate-pulse" />}
              {subStep === 4 && <ArrowRight className="h-5 w-5 animate-bounce" />}
            </div>
            <div>
              <span className={`text-sm font-bold block ${currentSubStepDef.color === 'amber' ? 'text-amber-300' : currentSubStepDef.color === 'rose' ? 'text-rose-300' : 'text-cyan-300'}`}>
                {currentSubStepDef.title}
              </span>
              <p className="text-xs text-zinc-300 mt-0.5">
                {currentSubStepDef.statusText}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-400">
              Paso {subStep} de 4
            </span>
          </div>
        </div>
      </div>

      {/* Main Physical Logistics Bay: Exterior Dock (Left) + Rear Door Portal + Trailer Interior (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Exterior Warehouse & Temporary Buffer Dock (Col span 3) */}
        <div className="lg:col-span-3 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 p-3.5 flex flex-col justify-between gap-3 shadow-inner">
          {/* Top: Buffer Temporal de Handling LIFO */}
          <div className={`p-3 rounded-xl border transition-all ${stage === 'handling-out' || stage === 'unloading-alpha' ? 'bg-amber-950/40 border-amber-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1 font-mono">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                Buffer Temporal (Handling)
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {stage === 'handling-out' || stage === 'unloading-alpha' ? `${handlingCount} uds` : '0 uds'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight mb-2">
              Espacio exterior donde esperan las unidades β extraídas para liberar la puerta.
            </p>
            {/* Visual buffer boxes */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
              {stage === 'handling-out' || stage === 'unloading-alpha' ? (
                Array.from({ length: Math.min(6, handlingCount) }).map((_, i) => (
                  <motion.div
                    key={`buf-box-${i}`}
                    initial={{ x: 60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 60, opacity: 0 }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-mono text-[10px] font-bold shadow"
                  >
                    β
                  </motion.div>
                ))
              ) : (
                <span className="text-[10px] font-mono text-zinc-600 italic px-1">Buffer libre</span>
              )}
            </div>
          </div>

          {/* Middle: Entregas Alpha Recibidas por el Cliente */}
          <div className={`p-3 rounded-xl border transition-all ${stage === 'unloading-alpha' ? 'bg-rose-950/40 border-rose-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1 font-mono">
                <Box className="h-3.5 w-3.5 text-rose-400" />
                Descargado a Cliente (α)
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {deliverA} unidades
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
              {stage === 'unloading-alpha' || stage === 'handling-in' || stage === 'loading-beta' || stage === 'settled' ? (
                Array.from({ length: Math.min(8, deliverA) }).map((_, i) => (
                  <motion.div
                    key={`deliv-box-${i}`}
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 1.0, delay: i * 0.1 }}
                    className="h-6 w-6 rounded-lg bg-rose-500/20 border border-rose-400 flex items-center justify-center text-rose-300 font-mono text-[10px] font-bold shadow"
                  >
                    α
                  </motion.div>
                ))
              ) : (
                <span className="text-[10px] font-mono text-zinc-600 italic px-1">Esperando arribo</span>
              )}
            </div>
          </div>

          {/* Bottom: Recolecciones Beta Listas para Entrar (Visible animated entrance) */}
          <div className={`p-3 rounded-xl border transition-all ${stage === 'loading-beta' ? 'bg-cyan-950/50 border-cyan-500/60 shadow-lg shadow-cyan-950' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1 font-mono">
                <Package className="h-3.5 w-3.5 text-cyan-400" />
                Por Cargar de Cliente (β)
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {pickupB} unidades
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight mb-2">
              Unidades preparadas en muelle que entran hacia la derecha por la puerta trasera.
            </p>
            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 relative overflow-hidden">
              {pickupB > 0 ? (
                Array.from({ length: Math.min(8, pickupB) }).map((_, i) => (
                  <motion.div
                    key={`pick-box-${i}`}
                    animate={
                      stage === 'loading-beta'
                        ? {
                            x: [0, 80, 120],
                            opacity: [1, 0.8, 0],
                            scale: [1, 1.1, 0.8],
                          }
                        : {}
                    }
                    transition={{
                      duration: 2.2,
                      delay: i * 0.2,
                      repeat: stage === 'loading-beta' ? Infinity : 0,
                      ease: 'easeInOut',
                    }}
                    className="h-6 w-6 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-mono text-[10px] font-bold shadow-md shadow-cyan-950"
                  >
                    β
                  </motion.div>
                ))
              ) : (
                <span className="text-[10px] font-mono text-zinc-600 italic px-1">Sin recolección</span>
              )}
            </div>
          </div>
        </div>

        {/* Trailer Interior: Rear Door Threshold + Elongated All-Square Grid (Col span 9) */}
        <div className="lg:col-span-9 rounded-2xl bg-zinc-950/95 border border-zinc-800/90 p-4 flex flex-col justify-between gap-3 shadow-2xl relative">
          {/* Door Header Indicator */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-2 border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <DoorClosed className="h-4 w-4" />
              <span>&larr; PUERTA TRASERA (Entrada / Salida LIFO en Slot 1)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 font-semibold">
              <Truck className="h-4 w-4 text-cyan-400" />
              <span>FONDO DEL TRÁILER (Slot {capacity}) &rarr;</span>
            </div>
          </div>

          {/* The Elongated Grid of Square Slots */}
          <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-2.5 py-1">
            {displaySlots.map((item, idx) => {
              const slotNum = idx + 1;
              const isAlpha = item === 'A';
              const isBeta = item === 'B';
              const isEmpty = item === 'EMPTY';
              const isSelected = selectedSlotIdx === slotNum;
              const isNearDoor = slotNum <= 3;

              const isHandlingExiting = stage === 'handling-out' && handledBetaIndices.includes(idx);
              const isDeliveringExiting = stage === 'unloading-alpha' && deliveredAlphaIndices.includes(idx);
              const isHandlingEntering = stage === 'handling-in' && idx < handledBetaIndices.length;
              const isLoadingEntering = stage === 'loading-beta' && newBetaIndices.includes(idx);

              return (
                <motion.div
                  key={`slot-square-${slotNum}`}
                  layout
                  whileHover={{ scale: 1.08, zIndex: 30 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedSlotIdx(isSelected ? null : slotNum)}
                  className={`
                    aspect-square w-full relative flex flex-col items-center justify-between p-2 rounded-2xl border transition-all duration-300 cursor-pointer select-none
                    ${
                      isDeliveringExiting
                        ? 'bg-rose-900/90 border-rose-400 text-white ring-4 ring-rose-500/60 shadow-xl shadow-rose-950 scale-105 z-20'
                        : isHandlingExiting || isHandlingEntering
                        ? 'bg-amber-900/90 border-amber-400 text-white ring-4 ring-amber-500/60 shadow-xl shadow-amber-950 scale-105 z-20'
                        : isLoadingEntering
                        ? 'bg-cyan-900/90 border-cyan-400 text-white ring-4 ring-cyan-500/60 shadow-xl shadow-cyan-950 scale-105 z-20'
                        : isAlpha
                        ? 'bg-gradient-to-br from-rose-950/90 via-rose-900/70 to-rose-950/90 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/30'
                        : isBeta
                        ? 'bg-gradient-to-br from-cyan-950/90 via-cyan-900/70 to-cyan-950/90 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950/30'
                        : 'bg-zinc-900/40 border-zinc-800/90 text-zinc-600 border-dashed hover:border-zinc-700'
                    }
                    ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110 z-40' : ''}
                  `}
                >
                  {/* Slot number badge */}
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-950/80 px-1 rounded">
                      #{slotNum}
                    </span>
                    {isNearDoor && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/60" title="Slot inmediato a la puerta trasera" />
                    )}
                  </div>

                  {/* Physical Moving Box Icon (Slow movement towards/from left rear door) */}
                  <div className="my-auto flex items-center justify-center">
                    {isAlpha && (
                      <motion.div
                        animate={
                          isDeliveringExiting
                            ? {
                                x: [0, -30, -50],
                                opacity: [1, 0.5, 0],
                                scale: [1, 1.1, 0.8],
                              }
                            : {}
                        }
                        transition={{ duration: 1.8, repeat: isDeliveringExiting ? Infinity : 0 }}
                      >
                        <Box className={`h-6 w-6 ${isDeliveringExiting ? 'text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.9)]' : 'text-rose-400'} drop-shadow`} />
                      </motion.div>
                    )}

                    {isBeta && (
                      <motion.div
                        animate={
                          isHandlingExiting
                            ? {
                                x: [0, -30, -50],
                                opacity: [1, 0.5, 0],
                                scale: [1, 1.1, 0.8],
                              }
                            : isHandlingEntering
                            ? {
                                x: [-50, -20, 0],
                                opacity: [0, 0.7, 1],
                                scale: [0.7, 1.15, 1],
                              }
                            : isLoadingEntering
                            ? {
                                x: [-80, -30, 0],
                                opacity: [0, 0.6, 1],
                                scale: [0.6, 1.2, 1],
                              }
                            : {}
                        }
                        transition={{
                          duration: 2.0,
                          repeat: isHandlingExiting || isHandlingEntering || isLoadingEntering ? Infinity : 0,
                          ease: 'easeInOut',
                        }}
                      >
                        <Package className={`h-6 w-6 ${isHandlingExiting || isHandlingEntering ? 'text-amber-300 drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]' : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]'} drop-shadow`} />
                      </motion.div>
                    )}

                    {isEmpty && (
                      <div className="text-zinc-700 font-mono text-[11px] font-bold">
                        -
                      </div>
                    )}
                  </div>

                  {/* Status label footer */}
                  <div className="w-full text-center">
                    <span
                      className={`text-[9px] font-mono font-extrabold uppercase px-1 rounded block truncate ${
                        isDeliveringExiting
                          ? 'bg-rose-500 text-zinc-950 font-black'
                          : isHandlingExiting
                          ? 'bg-amber-400 text-zinc-950 font-black'
                          : isHandlingEntering
                          ? 'bg-amber-400 text-zinc-950 font-black'
                          : isLoadingEntering
                          ? 'bg-cyan-400 text-zinc-950 font-black'
                          : isAlpha
                          ? 'bg-rose-500/20 text-rose-300'
                          : isBeta
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-zinc-600'
                      }`}
                    >
                      {isDeliveringExiting ? 'SALE α' : isHandlingExiting ? 'EVAC β' : isHandlingEntering ? 'REORD' : isLoadingEntering ? 'ENTRA β' : isAlpha ? 'α (Entr)' : isBeta ? 'β (Rec)' : 'Libre'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Selected Slot Inspector Banner */}
          {selectedSlotIdx !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1 px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700 text-xs flex items-center justify-between shadow-xl"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-emerald-400 text-sm">Posición #{selectedSlotIdx}:</span>
                <span className="text-zinc-200">
                  {displaySlots[selectedSlotIdx - 1] === 'A'
                    ? 'Mercancía α (Para entregar a clientes en la ruta)'
                    : displaySlots[selectedSlotIdx - 1] === 'B'
                    ? 'Mercancía β (Recolectada de clientes para retorno al depósito)'
                    : 'Espacio disponible en el compartimento'}
                </span>
              </div>
              <button
                onClick={() => setSelectedSlotIdx(null)}
                className="text-zinc-400 hover:text-white text-xs px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 cursor-pointer font-semibold transition-all"
              >
                Cerrar
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
