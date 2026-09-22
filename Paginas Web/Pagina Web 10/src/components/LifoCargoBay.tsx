import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Box,
  RotateCcw,
  Truck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Boxes,
  DoorClosed,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { SolutionData, StepData, CargoSubStepDef, SlotType, PlaybackStatus } from '../types/solution';
import { formatNumber } from '../lib/utils';

interface LifoCargoBayProps {
  solution: SolutionData;
  currentStep: StepData;
  currentStepIndex: number;
  isArrived: boolean;
  playbackStatus?: PlaybackStatus;
  isContinuousMode: boolean;
  speed?: number;
  onContinueJourney: () => void;
}

export const LifoCargoBay: React.FC<LifoCargoBayProps> = ({
  solution,
  currentStep,
  currentStepIndex,
  isArrived,
  playbackStatus,
  isContinuousMode,
  speed = 1,
  onContinueJourney,
}) => {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [subStep, setSubStep] = useState<number>(1); // 1 to 4
  const [showExtendedExplanation, setShowExtendedExplanation] = useState<boolean>(false);

  const capacity = solution.capacity;
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
  const isDepot = destinationNode.isDepot;
  const isLastStep = currentStepIndex >= solution.steps.length - 1;

  // Policy detection
  const isPolicy2 = solution.model === 'TSPPD-H_2';
  const isPolicy3 = solution.model === 'TSPPD-H_3';
  const stepPolicy = currentStep.policyApplied === 0 ? 2 : (currentStep.policyApplied ?? (isPolicy2 ? 2 : 1));
  const isPolicy2Current = isPolicy2 || (isPolicy3 && stepPolicy === 2);

  // Reset sub-step when step or arrived status changes
  useEffect(() => {
    setSubStep(1);
    setSelectedSlotIdx(null);
  }, [isArrived, currentStepIndex]);

  // Arrival slots for the current step (before operations at this node)
  const arrivalSlots: SlotType[] = useMemo(() => {
    return currentStep.slotsArrival || currentStep.slots || Array(capacity).fill('EMPTY');
  }, [currentStep, capacity]);

  // Departure slots for the current step (after all operations at this node)
  const departureSlots: SlotType[] = useMemo(() => {
    if (currentStep.slotsDeparture && currentStep.slotsDeparture.length > 0) {
      return currentStep.slotsDeparture;
    }
    if (isDepot) {
      return Array(capacity).fill('EMPTY');
    }
    const nextStep = solution.steps[currentStepIndex + 1];
    if (nextStep && (nextStep.slotsArrival || nextStep.slots)) {
      return nextStep.slotsArrival || nextStep.slots;
    }
    return arrivalSlots;
  }, [currentStep, isDepot, capacity, solution.steps, currentStepIndex, arrivalSlots]);

  // 1. Identify delivered Alpha slots
  const deliveredAlphaIndices = useMemo<number[]>(() => {
    if (isDepot || deliverA <= 0) return [];
    if (currentStep.deliveredSlots && currentStep.deliveredSlots.length > 0) {
      return currentStep.deliveredSlots.map((s) => s - 1);
    }
    if (isPolicy2Current) {
      const indices: number[] = [];
      let count = deliverA;
      for (let i = 0; i < arrivalSlots.length && count > 0; i++) {
        if (arrivalSlots[i] === 'A') {
          indices.push(i);
          count--;
        }
      }
      return indices;
    }
    const indices: number[] = [];
    let count = deliverA;
    for (let i = 0; i < arrivalSlots.length && count > 0; i++) {
      if (arrivalSlots[i] === 'A' && departureSlots[i] !== 'A') {
        indices.push(i);
        count--;
      }
    }
    if (count > 0) {
      for (let i = 0; i < arrivalSlots.length && count > 0; i++) {
        if (arrivalSlots[i] === 'A' && !indices.includes(i)) {
          indices.push(i);
          count--;
        }
      }
    }
    return indices;
  }, [currentStep, isDepot, deliverA, isPolicy2Current, arrivalSlots, departureSlots]);

  // 2. Identify evacuated / rehandled Beta slots (Policy 1)
  const handledBetaIndices = useMemo<number[]>(() => {
    if (isDepot || handlingCount <= 0 || isPolicy2Current) return [];
    if (currentStep.rehandledB && currentStep.rehandledB.length > 0) {
      return currentStep.rehandledB.map((s) => s - 1);
    }
    const indices: number[] = [];
    const maxDeliveredIdx = deliveredAlphaIndices.length > 0
      ? Math.max(...deliveredAlphaIndices)
      : -1;
    let count = handlingCount;
    for (let i = 0; i <= maxDeliveredIdx && i < arrivalSlots.length && count > 0; i++) {
      if (arrivalSlots[i] === 'B') {
        indices.push(i);
        count--;
      }
    }
    for (let i = 0; i < arrivalSlots.length && count > 0; i++) {
      if (arrivalSlots[i] === 'B' && !indices.includes(i)) {
        indices.push(i);
        count--;
      }
    }
    return indices;
  }, [currentStep, isDepot, handlingCount, isPolicy2Current, deliveredAlphaIndices, arrivalSlots]);

  // 2b. Identify evacuated / rehandled Alpha slots (Policy 2)
  const handledAlphaIndices = useMemo<number[]>(() => {
    if (isDepot || handlingCount <= 0) return [];
    if (currentStep.rehandledA && currentStep.rehandledA.length > 0) {
      return currentStep.rehandledA.map((s) => s - 1);
    }
    if (isPolicy2Current) {
      const indices: number[] = [];
      for (let i = 0; i < arrivalSlots.length; i++) {
        if (arrivalSlots[i] === 'A' && !deliveredAlphaIndices.includes(i)) {
          indices.push(i);
        }
      }
      return indices;
    }
    return [];
  }, [currentStep, isDepot, handlingCount, isPolicy2Current, arrivalSlots, deliveredAlphaIndices]);

  // 3. Identify newly loaded Beta slots
  const newBetaIndices = useMemo<number[]>(() => {
    if (isDepot || pickupB <= 0) return [];
    if (currentStep.newBSlots && currentStep.newBSlots.length > 0) {
      return currentStep.newBSlots.map((s) => s - 1);
    }
    const indices: number[] = [];
    let count = pickupB;
    for (let i = 0; i < departureSlots.length && count > 0; i++) {
      if (departureSlots[i] === 'B' && arrivalSlots[i] !== 'B') {
        indices.push(i);
        count--;
      }
    }
    if (count > 0) {
      for (let i = 0; i < departureSlots.length && count > 0; i++) {
        if (departureSlots[i] === 'B' && !indices.includes(i)) {
          indices.push(i);
          count--;
        }
      }
    }
    return indices;
  }, [currentStep, isDepot, pickupB, departureSlots, arrivalSlots]);

  // 4. Identify slots that were unhandled B
  const unhandledBetaIndices = useMemo<number[]>(() => {
    const indices: number[] = [];
    for (let i = 0; i < arrivalSlots.length; i++) {
      if (arrivalSlots[i] === 'B' && !handledBetaIndices.includes(i)) {
        indices.push(i);
      }
    }
    return indices;
  }, [arrivalSlots, handledBetaIndices]);

  // 5. Identify slots where evacuated B RE-ENTER (Policy 1)
  const reenteringBetaIndices = useMemo<number[]>(() => {
    if (isPolicy2Current || handledBetaIndices.length === 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < departureSlots.length; i++) {
      if (departureSlots[i] === 'B' && !newBetaIndices.includes(i) && !unhandledBetaIndices.includes(i)) {
        indices.push(i);
      }
    }
    return indices;
  }, [isPolicy2Current, handledBetaIndices.length, departureSlots, newBetaIndices, unhandledBetaIndices]);

  // 5b. Identify slots where evacuated Alpha RE-ENTER (Policy 2)
  const reenteringAlphaIndices = useMemo<number[]>(() => {
    if (isDepot || handledAlphaIndices.length === 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < departureSlots.length; i++) {
      if (departureSlots[i] === 'A') {
        indices.push(i);
      }
    }
    return indices;
  }, [departureSlots, handledAlphaIndices, isDepot]);

  const isAtDepotInitial = currentStepIndex === 0 && !isArrived;

  // Stage derived from isArrived, playbackStatus & subStep
  const stage = useMemo<'initial-depot' | 'transit' | 'handling-out' | 'unloading-alpha' | 'handling-in' | 'loading-beta' | 'settled'>(() => {
    if (isAtDepotInitial) return 'initial-depot';
    if (!isArrived && playbackStatus === 'playing') return 'transit';
    if (isPolicy2Current) {
      if (subStep === 1) return 'unloading-alpha';
      if (subStep === 2) return 'handling-out';
      if (subStep === 3) return 'loading-beta';
      if (subStep === 4) return 'handling-in';
    } else {
      if (subStep === 1) return 'handling-out';
      if (subStep === 2) return 'unloading-alpha';
      if (subStep === 3) return 'handling-in';
      if (subStep === 4) return 'loading-beta';
    }
    return 'settled';
  }, [isAtDepotInitial, isArrived, playbackStatus, subStep, isPolicy2Current]);

  // Auto-advance timer between sub-steps ONLY in continuous mode AND when playing
  useEffect(() => {
    if (!isArrived || !isContinuousMode || playbackStatus !== 'playing') return;

    const subStepDurations = isPolicy2Current
      ? [
          deliverA > 0 || isDepot ? 3000 / speed : 1400 / speed,
          handlingCount > 0 ? 3000 / speed : 1400 / speed,
          pickupB > 0 ? 3200 / speed : 1500 / speed,
          handlingCount > 0 ? 2600 / speed : 1200 / speed,
        ]
      : [
          handlingCount > 0 ? 3000 / speed : 1400 / speed,
          deliverA > 0 || isDepot ? 3000 / speed : 1400 / speed,
          handlingCount > 0 ? 2600 / speed : 1200 / speed,
          pickupB > 0 ? 3200 / speed : 1500 / speed,
        ];

    const currentDuration = subStepDurations[subStep - 1] || 2500;

    const timer = setTimeout(() => {
      if (subStep < 4) {
        setSubStep((prev) => prev + 1);
      } else {
        onContinueJourney();
      }
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [isArrived, isContinuousMode, playbackStatus, subStep, isPolicy2Current, handlingCount, deliverA, pickupB, isDepot, speed, onContinueJourney]);

  // Display slot states mapped dynamically by sub-step
  const displaySlots = useMemo<SlotType[]>(() => {
    if (stage === 'initial-depot' || stage === 'transit') {
      return arrivalSlots;
    }

    if (isDepot) {
      if (subStep === 1) return arrivalSlots;
      return Array(capacity).fill('EMPTY');
    }

    if (isPolicy2Current) {
      if (subStep === 1) return arrivalSlots;
      if (subStep === 2) {
        return arrivalSlots.map((item, idx) => {
          if (deliveredAlphaIndices.includes(idx)) return 'EMPTY';
          return item;
        });
      }
      if (subStep === 3) {
        return departureSlots.map((item, idx) => {
          if (reenteringAlphaIndices.includes(idx)) return 'EMPTY';
          return item;
        });
      }
      return departureSlots;
    }

    // Policy 1
    if (stage === 'handling-out') return arrivalSlots;
    if (stage === 'unloading-alpha') {
      return arrivalSlots.map((item, idx) => {
        if (handledBetaIndices.includes(idx) || handledAlphaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }
    if (stage === 'handling-in') {
      return departureSlots.map((item, idx) => {
        if (newBetaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }
    return departureSlots;
  }, [
    stage,
    isDepot,
    subStep,
    isPolicy2Current,
    arrivalSlots,
    departureSlots,
    deliveredAlphaIndices,
    handledBetaIndices,
    handledAlphaIndices,
    reenteringAlphaIndices,
    newBetaIndices,
    capacity,
  ]);

  // Live counts
  const alphaInBay = displaySlots.filter((s) => s === 'A').length;
  const betaInBay = displaySlots.filter((s) => s === 'B').length;
  const emptyInBay = Math.max(0, capacity - alphaInBay - betaInBay);

  // Sub-step definitions
  const subStepDefs: CargoSubStepDef[] = useMemo(() => {
    if (isAtDepotInitial) {
      const totalAlphaInit = arrivalSlots.filter((s) => s === 'A').length;
      return [
        {
          id: 1,
          title: 'Carga Inicial en Depósito',
          shortTitle: '1. Carga',
          statusText: `Camión listo con ${totalAlphaInit} uds α para distribución.`,
          color: 'emerald',
          hasAction: false,
        },
        {
          id: 2,
          title: 'Organización LIFO',
          shortTitle: '2. Estiba',
          statusText: 'Bahía organizada para entregas secuenciales.',
          color: 'cyan',
          hasAction: false,
        },
        {
          id: 3,
          title: 'Acceso a Compuerta',
          shortTitle: '3. Acceso',
          statusText: 'Compuerta trasera libre para primer cliente.',
          color: 'amber',
          hasAction: false,
        },
        {
          id: 4,
          title: 'Iniciar Tour',
          shortTitle: '4. Listo',
          statusText: 'Presiona Iniciar para partir hacia el primer nodo.',
          color: 'emerald',
          hasAction: false,
        },
      ];
    }

    if (isDepot) {
      const totalDepotB = arrivalSlots.filter((s) => s === 'B').length;
      return [
        {
          id: 1,
          title: 'Retorno al Depósito Central',
          shortTitle: '1. Arribo',
          statusText: `Llegada al almacén con ${totalDepotB} uds β recolectadas.`,
          color: 'amber',
          hasAction: false,
        },
        {
          id: 2,
          title: 'Descarga Total de Mercancía β',
          shortTitle: '2. Descarga',
          statusText: `Descargando ${totalDepotB} uds β al almacén.`,
          color: 'rose',
          hasAction: true,
        },
        {
          id: 3,
          title: 'Bahía Despejada',
          shortTitle: '3. Limpieza',
          statusText: 'Compartimiento vacío y disponible.',
          color: 'amber',
          hasAction: false,
        },
        {
          id: 4,
          title: 'Fin del Recorrido',
          shortTitle: '4. Final',
          statusText: '¡Ruta completada satisfaciendo todas las demandas!',
          color: 'cyan',
          hasAction: false,
        },
      ];
    }

    if (isPolicy2Current) {
      return [
        {
          id: 1,
          title: 'Entrega de Unidades α (Compuerta)',
          shortTitle: '1. Entrega α',
          statusText: deliverA > 0
            ? `Se descargan ${deliverA} uds α directamente por compuerta trasera hacia ${destinationNode.label}.`
            : `Sin entrega de mercancía α requerida en ${destinationNode.label}.`,
          color: 'rose',
          hasAction: deliverA > 0,
        },
        {
          id: 2,
          title: 'Evacuación Temporal al Andén',
          shortTitle: '2. Evacuar',
          statusText: handlingCount > 0
            ? `${handlingCount} uds α evacuadas temporalmente al andén para despejar los slots del fondo.`
            : 'Fondo despejado sin necesidad de evacuación temporal.',
          color: 'amber',
          hasAction: handlingCount > 0,
        },
        {
          id: 3,
          title: 'Carga de Unidades β al Fondo',
          shortTitle: '3. Carga β',
          statusText: pickupB > 0
            ? `Se estiban ${pickupB} uds β al fondo del camión mientras la carga α espera en el andén.`
            : `Sin recolección de mercancía β requerida en ${destinationNode.label}.`,
          color: 'cyan',
          hasAction: pickupB > 0,
        },
        {
          id: 4,
          title: 'Reingreso de Unidades α',
          shortTitle: '4. Reingreso',
          statusText: handlingCount > 0
            ? `${handlingCount} uds α reingresan desde el andén situándose frente a la carga β.`
            : 'Estiba concluida y compuerta asegurada para continuar ruta.',
          color: 'emerald',
          hasAction: handlingCount > 0,
        },
      ];
    }

    // Policy 1
    return [
      {
        id: 1,
        title: 'Evacuación LIFO de Unidades β',
        shortTitle: '1. Evacuar β',
        statusText: handlingCount > 0
          ? `${handlingCount} uds β evacuadas al andén para dar acceso a la mercancía α bloqueada.`
          : 'Compuerta libre sin bloqueo LIFO.',
        color: 'amber',
        hasAction: handlingCount > 0,
      },
      {
        id: 2,
        title: 'Entrega de Unidades α',
        shortTitle: '2. Entrega α',
        statusText: deliverA > 0
          ? `Descargando ${deliverA} uds α hacia ${destinationNode.label}.`
          : 'Sin entregas de mercancía α en este nodo.',
        color: 'rose',
        hasAction: deliverA > 0,
      },
      {
        id: 3,
        title: 'Reingreso de Unidades β',
        shortTitle: '3. Reingreso β',
        statusText: handlingCount > 0
          ? `${handlingCount} uds β reincorporadas a la bahía tras la entrega.`
          : 'Bahía ordenada sin movimientos de reingreso.',
        color: 'amber',
        hasAction: handlingCount > 0,
      },
      {
        id: 4,
        title: 'Carga de Nuevas Unidades β',
        shortTitle: '4. Carga β',
        statusText: pickupB > 0
          ? `Cargando ${pickupB} nuevas uds β en la compuerta trasera.`
          : 'Sin recolección de unidades β en este nodo.',
        color: 'cyan',
        hasAction: pickupB > 0,
      },
    ];
  }, [
    isAtDepotInitial,
    isDepot,
    isPolicy2Current,
    deliverA,
    handlingCount,
    arrivalSlots,
    destinationNode.label,
    pickupB,
  ]);

  const currentSubStepDef = subStepDefs[subStep - 1] || subStepDefs[0];
  const animDuration = Math.max(0.3, 0.8 / speed);

  return (
    <div className="w-full rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-3.5 flex flex-col gap-2.5 shadow-xl relative overflow-hidden">
      {/* 1. Header Bar: Compact Title + Sub-step Stepper Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-400 text-zinc-950 shadow-md">
            <Boxes className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              Compartimiento LIFO
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
              Q={capacity}
            </span>
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
              solution.model === 'TSPPD-H_1'
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                : solution.model === 'TSPPD-H_2'
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                : solution.model === 'TSPPD-H_3'
                ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              {solution.model === 'TSPPD-H_1'
                ? 'Pol. 1'
                : solution.model === 'TSPPD-H_2'
                ? 'Pol. 2 (Front)'
                : solution.model === 'TSPPD-H_3'
                ? `Pol. 3 (Stop: P${currentStep.policyApplied === 0 ? '2' : (currentStep.policyApplied ?? 1)})`
                : 'General'}
            </span>
          </div>
        </div>

        {/* Stepper Tabs & Controls */}
        <div className="flex items-center gap-1.5">
          {/* Repeat */}
          <button
            onClick={() => setSubStep(1)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
            title="Reiniciar sub-pasos 1 a 4"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Stepper Pills */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
            {subStepDefs.map((sDef) => {
              const isCurrent = sDef.id === subStep;
              const isDone = sDef.id < subStep;
              return (
                <button
                  key={`substep-btn-${sDef.id}`}
                  onClick={() => setSubStep(sDef.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-zinc-100 text-zinc-950 font-bold shadow-xs'
                      : isDone
                      ? 'text-emerald-400 hover:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={sDef.title}
                >
                  <span>{sDef.shortTitle}</span>
                </button>
              );
            })}
          </div>

          {/* Prev / Next Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSubStep((prev) => Math.max(1, prev - 1))}
              disabled={subStep === 1}
              className="p-1 px-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800 cursor-pointer"
              title="Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (subStep < 4) {
                  setSubStep((prev) => prev + 1);
                } else {
                  onContinueJourney();
                }
              }}
              className={`p-1 px-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                subStep === 4
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950'
              }`}
            >
              <span>{subStep === 4 ? (isLastStep ? 'Fin' : 'Ruta ➔') : `${subStep + 1}/4 ➔`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Compact Truck Location & Inventory Bar */}
      <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs">
        <div className="flex items-center gap-1.5 font-sans">
          <Truck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-zinc-400">Camión en:</span>
          <span className="font-semibold text-white">
            {isAtDepotInitial ? 'Depósito Central' : destinationNode.label}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 font-mono text-[11px]">
            {isAtDepotInitial ? 'Inicio' : `Paso ${currentStepIndex + 1}/${solution.steps.length}`}
          </span>
        </div>

        {/* Live Inventory Badges */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-rose-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            α: {alphaInBay}
          </span>
          <span className="flex items-center gap-1 text-cyan-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            β: {betaInBay}
          </span>
          <span className="text-zinc-500">
            Vacíos: {emptyInBay}
          </span>
        </div>
      </div>

      {/* 3. Physical Cargo Bay Container (Compact Grid) */}
      <div className="relative bg-zinc-900/50 rounded-xl border border-zinc-800/90 p-2.5 pt-6 shadow-inner">
        {/* Door & Cab Labels */}
        <div className="absolute top-1.5 left-2.5 flex items-center gap-1 text-[9px] uppercase font-bold text-amber-400 font-mono">
          <DoorClosed className="w-3 h-3" />
          <span>Puerta (Slot 1)</span>
        </div>

        <div className="absolute top-1.5 right-2.5 flex items-center gap-1 text-[9px] uppercase font-bold text-zinc-500 font-mono">
          <span>Cabina / Fondo (Slot {capacity})</span>
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        </div>

        {/* Slot Grid: High Density (h-10 to h-11 per cell, min-h-[40px]) */}
        <div className="grid grid-cols-8 gap-1.5 py-1">
          {Array.from({ length: capacity }, (_, idx) => {
            const slotNum = idx + 1;
            const slotContent = displaySlots[idx] || 'EMPTY';
            const isAlpha = slotContent === 'A';
            const isBeta = slotContent === 'B';
            const isSelected = selectedSlotIdx === slotNum;

            const isDeliveringExiting = !isDepot && stage === 'unloading-alpha' && deliveredAlphaIndices.includes(idx);
            const isDepotUnloading = isDepot && (stage === 'unloading-alpha' || stage === 'handling-out') && arrivalSlots[idx] === 'B';

            const isHandlingBetaExiting = !isDepot && stage === 'handling-out' && handledBetaIndices.includes(idx);
            const isHandlingAlphaExiting = !isDepot && stage === 'handling-out' && handledAlphaIndices.includes(idx);

            const isHandlingBetaEntering = !isDepot && stage === 'handling-in' && reenteringBetaIndices.includes(idx);
            const isHandlingAlphaEntering = !isDepot && stage === 'handling-in' && reenteringAlphaIndices.includes(idx);

            const isLoadingEntering = !isDepot && stage === 'loading-beta' && newBetaIndices.includes(idx);

            const isRehandlingActive = isHandlingBetaExiting || isHandlingAlphaExiting || isHandlingBetaEntering || isHandlingAlphaEntering;

            return (
              <motion.div
                key={`bay-slot-${slotNum}`}
                layout
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedSlotIdx(isSelected ? null : slotNum)}
                className={`relative rounded-lg p-1 flex flex-col items-center justify-between min-h-[40px] max-h-[46px] border transition-all duration-200 cursor-pointer select-none ${
                  isDeliveringExiting || isDepotUnloading
                    ? 'bg-rose-950/80 border-rose-400 text-white ring-2 ring-rose-500/60 shadow-md shadow-rose-950/60 scale-102 z-10'
                    : isRehandlingActive
                    ? 'bg-amber-950/80 border-amber-400 text-white ring-2 ring-amber-500/60 shadow-md shadow-amber-950/60 scale-102 z-10'
                    : isLoadingEntering
                    ? 'bg-cyan-950/80 border-cyan-400 text-white ring-2 ring-cyan-500/60 shadow-md shadow-cyan-950/60 scale-102 z-10'
                    : isAlpha
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 shadow-xs'
                    : isBeta
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300 shadow-xs'
                    : 'bg-zinc-950/40 border-dashed border-zinc-800 text-zinc-600 opacity-60 hover:opacity-100 hover:border-zinc-700'
                } ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 z-20' : ''}`}
                title={`Slot #${slotNum}: ${slotContent === 'A' ? 'Mercancía α' : slotContent === 'B' ? 'Mercancía β' : 'Vacío'}`}
              >
                {/* Slot index tag */}
                <div className="w-full flex items-center justify-between text-[8px] font-mono text-zinc-500">
                  <span>#{slotNum}</span>
                  {isDeliveringExiting || isDepotUnloading ? (
                    <span className="text-[7px] text-rose-300 font-bold">SALE</span>
                  ) : isRehandlingActive ? (
                    <span className="text-[7px] text-amber-300 font-bold">EVAC</span>
                  ) : isLoadingEntering ? (
                    <span className="text-[7px] text-cyan-300 font-bold">ENTRA</span>
                  ) : null}
                </div>

                {/* Box Graphic */}
                <div className="flex items-center justify-center relative w-full h-4">
                  <AnimatePresence mode="popLayout">
                    {isAlpha ? (
                      <motion.div
                        key={`alpha-box-${slotNum}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: animDuration }}
                        className="flex items-center justify-center gap-0.5"
                      >
                        <Box className={`w-3.5 h-3.5 ${isRehandlingActive ? 'text-amber-300' : isDeliveringExiting ? 'text-rose-300' : 'text-rose-400'}`} />
                        <span className="text-[9px] font-mono font-bold leading-none">α</span>
                      </motion.div>
                    ) : isBeta ? (
                      <motion.div
                        key={`beta-box-${slotNum}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: animDuration }}
                        className="flex items-center justify-center gap-0.5"
                      >
                        <Package className={`w-3.5 h-3.5 ${isRehandlingActive ? 'text-amber-300' : isLoadingEntering ? 'text-cyan-300' : 'text-cyan-400'}`} />
                        <span className="text-[9px] font-mono font-bold leading-none">β</span>
                      </motion.div>
                    ) : (
                      <span className="text-[8px] text-zinc-600 font-mono">—</span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Temporary Staging / Andén Pill (Only visible when items are outside on dock) */}
        {((isPolicy2Current && (subStep === 2 || subStep === 3) && handledAlphaIndices.length > 0) ||
          (!isPolicy2Current && (subStep === 1 || subStep === 2) && handledBetaIndices.length > 0)) && (
          <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px] flex items-center justify-between gap-2 animate-pulse">
            <span className="flex items-center gap-1.5 font-bold">
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Andén Exterior:</span>
              <span className="font-normal">
                {isPolicy2Current
                  ? `${handledAlphaIndices.length} uds α en espera de reingreso al frente`
                  : `${handledBetaIndices.length} uds β en espera de reingreso`}
              </span>
            </span>
            <span className="text-[9px] font-semibold bg-amber-500/20 px-1.5 py-0.2 rounded">
              Temporal
            </span>
          </div>
        )}

        {/* Selected Slot Inspector (Subtle bottom bar) */}
        {selectedSlotIdx !== null && (
          <div className="mt-1.5 px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-xs flex items-center justify-between">
            <span className="text-[11px] text-zinc-300">
              <strong className="text-emerald-400 font-mono mr-1">Slot #{selectedSlotIdx}:</strong>
              {displaySlots[selectedSlotIdx - 1] === 'A'
                ? 'Mercancía de entrega α'
                : displaySlots[selectedSlotIdx - 1] === 'B'
                ? 'Mercancía de recolección β'
                : 'Espacio vacío disponible'}
            </span>
            <button
              onClick={() => setSelectedSlotIdx(null)}
              className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.2 rounded bg-zinc-800 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* 4. Pequeña Explicación Inferior Unificada (Consolidada y Concisa) */}
      <div className="rounded-xl bg-zinc-900/70 border border-zinc-800/90 p-2.5 flex flex-col gap-2 shadow-inner">
        {/* Sub-step action narrative */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 p-1 rounded-md border ${
              currentSubStepDef.color === 'amber'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : currentSubStepDef.color === 'rose'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : currentSubStepDef.color === 'emerald'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}>
              {isPolicy2Current ? (
                subStep === 1 ? <ArrowLeft className="w-3.5 h-3.5" /> :
                subStep === 2 ? <RotateCcw className="w-3.5 h-3.5" /> :
                subStep === 3 ? <ArrowRight className="w-3.5 h-3.5" /> :
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                subStep === 1 ? <RotateCcw className="w-3.5 h-3.5" /> :
                subStep === 2 ? <ArrowLeft className="w-3.5 h-3.5" /> :
                subStep === 3 ? <RotateCcw className="w-3.5 h-3.5" /> :
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-200">
                  {currentSubStepDef.title}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  (Sub-paso {subStep}/4)
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">
                {currentSubStepDef.statusText}
              </p>
            </div>
          </div>

          {/* Toggle for full narrative if someone wants it */}
          {currentStep.explanation && (
            <button
              onClick={() => setShowExtendedExplanation((prev) => !prev)}
              className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 cursor-pointer flex items-center gap-1 shrink-0"
              title="Alternar detalle extendido"
            >
              <FileText className="w-3 h-3 text-cyan-400" />
              <span>{showExtendedExplanation ? 'Ocultar' : 'Detalle'}</span>
            </button>
          )}
        </div>

        {/* Collapsible Extended Narrative (Zero impact when closed) */}
        {showExtendedExplanation && currentStep.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-sans shadow-inner [&>strong]:text-white"
            dangerouslySetInnerHTML={{ __html: currentStep.explanation }}
          />
        )}

        {/* Concise Operations Summary Badges (Micro-KPIs for this stop) */}
        <div className="pt-1.5 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-semibold">
              Entrega: {isDepot ? `${arrivalSlots.filter((s) => s === 'B').length} uds β` : `${deliverA} uds α`}
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold">
              Recolección: {isDepot ? '0' : `${pickupB} uds β`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-400">
            {handlingCount > 0 ? (
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Handling: {handlingCount} ops (+{formatNumber(currentStep.handlingCost, 2)})
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500">
                Sin penalización LIFO ($0.00)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
