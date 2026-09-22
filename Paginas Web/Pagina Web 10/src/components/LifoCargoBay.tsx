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

  // Policy detection (General: TSPPD-H_2 or TSPPD-H_3 with policyApplied = 0/2)
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

  // 1. Identify delivered Alpha slots (unloaded in sub-step 1 for Policy 2, sub-step 2 for Policy 1)
  const deliveredAlphaIndices = useMemo<number[]>(() => {
    if (isDepot || deliverA <= 0) return [];
    if (currentStep.deliveredSlots && currentStep.deliveredSlots.length > 0) {
      return currentStep.deliveredSlots.map((s) => s - 1);
    }
    // In Policy 2, commodities 'A' are located at the door, so delivered units are the first deliverA slots
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
    // Under Policy 1, slots that had 'A' in arrival and no longer 'A' in departure:
    const indices: number[] = [];
    let count = deliverA;
    for (let i = 0; i < arrivalSlots.length && count > 0; i++) {
      if (arrivalSlots[i] === 'A' && departureSlots[i] !== 'A') {
        indices.push(i);
        count--;
      }
    }
    // Fallback if needed: any remaining 'A' slots in arrival
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

  // 2. Identify evacuated / rehandled Beta slots (evacuated in sub-step 1 for Policy 1)
  const handledBetaIndices = useMemo<number[]>(() => {
    if (isDepot || handlingCount <= 0 || isPolicy2Current) return [];
    if (currentStep.rehandledB && currentStep.rehandledB.length > 0) {
      return currentStep.rehandledB.map((s) => s - 1);
    }
    const indices: number[] = [];
    const maxDeliveredIdx = deliveredAlphaIndices.length > 0
      ? Math.max(...deliveredAlphaIndices)
      : -1;
    
    // In LIFO, any B slot in front of (idx <= maxDeliveredIdx) the deepest delivered A is rehandled
    let count = handlingCount;
    for (let i = 0; i <= maxDeliveredIdx && i < arrivalSlots.length && count > 0; i++) {
      if (arrivalSlots[i] === 'B') {
        indices.push(i);
        count--;
      }
    }
    // Fallback if count still > 0
    for (let i = 0; i < arrivalSlots.length && count > 0; i++) {
      if (arrivalSlots[i] === 'B' && !indices.includes(i)) {
        indices.push(i);
        count--;
      }
    }
    return indices;
  }, [currentStep, isDepot, handlingCount, isPolicy2Current, deliveredAlphaIndices, arrivalSlots]);

  // 2b. Identify evacuated / rehandled Alpha slots (evacuated in sub-step 2 for Policy 2)
  const handledAlphaIndices = useMemo<number[]>(() => {
    if (isDepot || handlingCount <= 0) return [];
    if (currentStep.rehandledA && currentStep.rehandledA.length > 0) {
      return currentStep.rehandledA.map((s) => s - 1);
    }
    // Fallback for Policy 2: all remaining 'A' slots in arrival that are NOT delivered
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

  // 3. Identify newly loaded Beta slots (loaded in sub-step 3 for Policy 2, sub-step 4 for Policy 1)
  const newBetaIndices = useMemo<number[]>(() => {
    if (isDepot || pickupB <= 0) return [];
    if (currentStep.newBSlots && currentStep.newBSlots.length > 0) {
      return currentStep.newBSlots.map((s) => s - 1);
    }
    const indices: number[] = [];
    let count = pickupB;
    // Primary candidates: slots that are 'B' in departureSlots but were NOT 'B' in arrivalSlots
    for (let i = 0; i < departureSlots.length && count > 0; i++) {
      if (departureSlots[i] === 'B' && arrivalSlots[i] !== 'B') {
        indices.push(i);
        count--;
      }
    }
    // If more needed (e.g. if rehandled B took other slots), take slots with B in departure starting near door
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

  // 4. Identify slots that were unhandled B (stayed in the truck without moving)
  const unhandledBetaIndices = useMemo<number[]>(() => {
    const indices: number[] = [];
    for (let i = 0; i < arrivalSlots.length; i++) {
      if (arrivalSlots[i] === 'B' && !handledBetaIndices.includes(i)) {
        indices.push(i);
      }
    }
    return indices;
  }, [arrivalSlots, handledBetaIndices]);

  // 5. Identify slots where evacuated B RE-ENTER the truck in sub-step 3 (Policy 1)
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

  // 5b. Identify slots where evacuated / relocated Alpha RE-ENTER the truck in sub-step 4 (Policy 2)
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
          deliverA > 0 || isDepot ? 3200 / speed : 1400 / speed, // Sub-step 1: Unloading alpha
          handlingCount > 0 ? 3200 / speed : 1400 / speed,       // Sub-step 2: Evacuating remainder alpha
          pickupB > 0 ? 3400 / speed : 1500 / speed,             // Sub-step 3: Loading beta to fondo
          handlingCount > 0 ? 2800 / speed : 1200 / speed,       // Sub-step 4: Reentering alpha
        ]
      : [
          handlingCount > 0 ? 3200 / speed : 1400 / speed, // Sub-step 1: Handling out
          deliverA > 0 || isDepot ? 3200 / speed : 1400 / speed, // Sub-step 2: Unloading alpha / depot
          handlingCount > 0 ? 2800 / speed : 1200 / speed, // Sub-step 3: Handling in
          pickupB > 0 ? 3400 / speed : 1500 / speed,        // Sub-step 4: Loading beta
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
      // Sub-step 1 (unloading-alpha): Delivered Alpha exit, remainder Alpha and existing Beta remain in bay
      if (subStep === 1) {
        return arrivalSlots;
      }

      // Sub-step 2 (handling-out): Delivered Alpha already gone (EMPTY). Remainder Alpha are now actively being evacuated to dock
      if (subStep === 2) {
        return arrivalSlots.map((item, idx) => {
          if (deliveredAlphaIndices.includes(idx)) return 'EMPTY';
          return item;
        });
      }

      // Sub-step 3 (loading-beta): Remainder Alpha are on dock (EMPTY). New Beta enter the fondo
      if (subStep === 3) {
        return departureSlots.map((item, idx) => {
          if (reenteringAlphaIndices.includes(idx)) return 'EMPTY';
          return item;
        });
      }

      // Sub-step 4 (handling-in): Remainder Alpha re-enter front slots -> matches complete departure state
      return departureSlots;
    }

    // Policy 1 (and general):
    // Sub-step 1: Evacuate blocking B and rehandled A items
    // (In sub-step 1, items being evacuated are rendered in their arrival positions with EVAC badges)
    if (stage === 'handling-out') {
      return arrivalSlots;
    }

    // Sub-step 2: Unload alpha items (evacuated items are now outside the truck on the dock)
    if (stage === 'unloading-alpha') {
      return arrivalSlots.map((item, idx) => {
        if (handledBetaIndices.includes(idx) || handledAlphaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }

    // Sub-step 3: Handling-in (rehandled B and rehandled A enter their departure positions, new B not yet loaded)
    if (stage === 'handling-in') {
      return departureSlots.map((item, idx) => {
        if (newBetaIndices.includes(idx)) return 'EMPTY';
        return item;
      });
    }

    // Sub-step 4: Loading-beta (new B items enter the truck) -> complete departure state
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

  // Sub-step definitions with precise wording
  const subStepDefs: CargoSubStepDef[] = useMemo(() => {
    if (isAtDepotInitial) {
      const totalAlphaInit = arrivalSlots.filter((s) => s === 'A').length;
      return [
        {
          id: 1,
          title: 'Depósito Central: Carga Inicial',
          shortTitle: '1. Carga Inicial',
          statusText: `🏁 Camión cargado con ${totalAlphaInit} unidades α en el Depósito Central. Listo para iniciar el tour.`,
          color: 'emerald',
          hasAction: false,
        },
        {
          id: 2,
          title: 'Organización LIFO en Bahía',
          shortTitle: '2. Organización',
          statusText: '📦 Mercancía α ubicada en la bahía según secuencia de entregas. Compuerta libre de carga β.',
          color: 'cyan',
          hasAction: false,
        },
        {
          id: 3,
          title: 'Inspección de Compuerta',
          shortTitle: '3. Compuerta',
          statusText: '🚪 Compuerta trasera despejada para acceso directo.',
          color: 'amber',
          hasAction: false,
        },
        {
          id: 4,
          title: 'Iniciar Ruta',
          shortTitle: '4. Iniciar',
          statusText: '🚀 Presiona "Iniciar Ruta" para arrancar el viaje hacia el primer cliente.',
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
          title: 'Paso 1: Arribo al Depósito Central',
          shortTitle: '1. Arribo',
          statusText: `🏁 El camión arriba al depósito con ${totalDepotB} unidades β recolectadas durante el recorrido.`,
          color: 'amber',
          hasAction: false,
        },
        {
          id: 2,
          title: 'Paso 2: Descarga Completa de Mercancía β',
          shortTitle: '2. Descarga Total',
          statusText: `📦 Descarga final: Se descargan las ${totalDepotB} unidades β hacia el almacén central.`,
          color: 'rose',
          hasAction: true,
        },
        {
          id: 3,
          title: 'Paso 3: Verificación de Bahía de Carga',
          shortTitle: '3. Verificación',
          statusText: '✅ Bahía de carga completamente vacía y disponible.',
          color: 'amber',
          hasAction: false,
        },
        {
          id: 4,
          title: 'Paso 4: Fin del Recorrido',
          shortTitle: '4. Fin del Tour',
          statusText: '🎉 ¡Tour completado con éxito! Todas las demandas de los clientes fueron satisfechas.',
          color: 'cyan',
          hasAction: false,
        },
      ];
    }

    const countBetaHandled = handledBetaIndices.length;
    const countAlphaHandled = handledAlphaIndices.length;

    // POLICY 2 SPECIFIC SUB-STEPS
    if (isPolicy2Current) {
      return [
        {
          id: 1,
          title: deliverA > 0 ? 'Sub-paso 1: Entrega de Unidades de Carga "a"' : 'Sub-paso 1: Verificación de Entrega (Sin Descarga "a")',
          shortTitle: deliverA > 0 ? '1. Entrega "a"' : '1. Sin Descarga',
          statusText: deliverA > 0
            ? `📦 Entrega al cliente: Se entregan primero las ${deliverA} unidades de entrega "a" directamente por la compuerta trasera hacia ${destinationNode.label} (slots ${deliveredAlphaIndices.map((s) => `#${s + 1}`).join(', ')}).`
            : `ℹ️ Sin entregas de unidades "a" requeridas en ${destinationNode.label}.`,
          color: 'rose',
          hasAction: deliverA > 0,
        },
        {
          id: 2,
          title: handlingCount > 0 ? 'Sub-paso 2: Evacuación del Resto de Unidades "a"' : 'Sub-paso 2: Inspección de Bahía (Sin Evacuación)',
          shortTitle: handlingCount > 0 ? '2. Evacuar "a"' : '2. Bahía Libre',
          statusText: handlingCount > 0
            ? `⚠️ Despeje de Bahía (Política 2): Al haber salido la entrega, se evacúan el resto de ${handlingCount} unidades de "a" (slots ${handledAlphaIndices.map((s) => `#${s + 1}`).join(', ')}) temporalmente al andén exterior para despejar el fondo del camión (Costo: +${formatNumber(currentStep.handlingCost, 2)}).`
            : `✅ Sin evacuación: No se requiere evacuar unidades "a".`,
          color: 'amber',
          hasAction: handlingCount > 0,
        },
        {
          id: 3,
          title: pickupB > 0 ? 'Sub-paso 3: Inserción de Unidades "b" al Fondo' : 'Sub-paso 3: Verificación de Carga (Sin Recolección "b")',
          shortTitle: pickupB > 0 ? '3. Carga "b" Fondo' : '3. Sin Carga',
          statusText: pickupB > 0
            ? `📥 Inserción al Fondo (Política 2): Se insertan las ${pickupB} unidades de "b" al fondo del compartimiento (slots ${newBetaIndices.map((s) => `#${s + 1}`).join(', ')}). Las unidades "a" evacuadas esperan en el andén exterior.`
            : `ℹ️ Sin recolecciones de unidades "b" requeridas en ${destinationNode.label}.`,
          color: pickupB > 0 ? 'cyan' : 'emerald',
          hasAction: pickupB > 0,
        },
        {
          id: 4,
          title: handlingCount > 0 ? 'Sub-paso 4: Reingreso de Unidades "a" Evacuadas' : 'Sub-paso 4: Compartimento Listo para Siguiente Tramo',
          shortTitle: handlingCount > 0 ? '4. Reingreso "a"' : '4. Bahía Lista',
          statusText: handlingCount > 0
            ? `🔄 Reingreso LIFO: Se reingresan las ${handlingCount} unidades de "a" evacuadas desde el andén hacia los slots delanteros (slots ${reenteringAlphaIndices.map((s) => `#${s + 1}`).join(', ')}), quedando frente a las unidades "b".`
            : `✅ Compartimento organizado: Las mercancías quedan ordenadas según la Política 2 ("b" al fondo, "a" en compuerta).`,
          color: handlingCount > 0 ? 'amber' : 'emerald',
          hasAction: handlingCount > 0,
        },
      ];
    }

    // POLICY 1 (and general):
    let handlingOutText = '✅ Sin conflicto LIFO: La compuerta trasera está despejada para la entrega.';
    if (handlingCount > 0) {
      if (countAlphaHandled > 0 && countBetaHandled > 0) {
        handlingOutText = `⚠️ Conflicto LIFO: Se evacúan temporalmente ${handlingCount} unidades (${countBetaHandled} β y ${countAlphaHandled} α reubicadas) para despejar la compuerta trasera (Costo: +${formatNumber(currentStep.handlingCost, 2)}).`;
      } else if (countBetaHandled > 0) {
        handlingOutText = `⚠️ Conflicto LIFO: Se evacúan temporalmente ${countBetaHandled} unidades β para despejar el acceso a las unidades α (Costo: +${formatNumber(currentStep.handlingCost, 2)}).`;
      } else {
        handlingOutText = `⚠️ Conflicto LIFO: Se evacúan temporalmente ${countAlphaHandled} unidades α para permitir la entrega (Costo: +${formatNumber(currentStep.handlingCost, 2)}).`;
      }
    }

    let handlingInText = '✅ Compartimento ordenado: No se requirió reacomodo de mercancía.';
    if (handlingCount > 0) {
      if (countAlphaHandled > 0 && countBetaHandled > 0) {
        handlingInText = `🔄 Reingreso y Reubicación LIFO: Las ${countAlphaHandled} unidades α se reubican en los slots de partida y las ${countBetaHandled} unidades β vuelven a ingresar a la bahía.`;
      } else if (countBetaHandled > 0) {
        handlingInText = `🔄 Reingreso LIFO: Las ${countBetaHandled} unidades β evacuadas vuelven a ingresar y se asientan en sus slots correspondientes.`;
      } else {
        handlingInText = `🔄 Reubicación LIFO: Las ${countAlphaHandled} unidades α evacuadas se reincorporan a la bahía.`;
      }
    }

    const loadingBetaText = pickupB > 0
      ? `📥 Recolección en compuerta (Política 1): ${pickupB} nuevas unidades β ingresan por la compuerta trasera.`
      : `ℹ️ Sin recolecciones β requeridas en ${destinationNode.label}. El compartimento queda listo para el siguiente tramo.`;

    const sub1Title = handlingCount > 0 ? 'Paso 1: Evacuación LIFO (Handling)' : 'Paso 1: Verificación de Compuerta (Libre)';
    const sub3Title = 'Paso 3: Reingreso y Reordenamiento LIFO';

    return [
      {
        id: 1,
        title: sub1Title,
        shortTitle: '1. Evacuación',
        statusText: handlingOutText,
        color: 'amber',
        hasAction: handlingCount > 0,
      },
      {
        id: 2,
        title: 'Paso 2: Descarga de Mercancía α (Entrega)',
        shortTitle: '2. Descarga α',
        statusText: deliverA > 0
          ? `📦 Descarga en proceso: ${deliverA} unidades α salen por la compuerta trasera hacia ${destinationNode.label}.`
          : `ℹ️ Sin entregas α requeridas en ${destinationNode.label}.`,
        color: 'rose',
        hasAction: deliverA > 0,
      },
      {
        id: 3,
        title: sub3Title,
        shortTitle: '3. Reingreso',
        statusText: handlingInText,
        color: 'amber',
        hasAction: handlingCount > 0,
      },
      {
        id: 4,
        title: pickupB > 0 ? 'Paso 4: Carga y Recolección de Mercancía β' : 'Paso 4: Verificación de Carga (Sin Recolección)',
        shortTitle: pickupB > 0 ? '4. Carga β' : '4. Sin Carga',
        statusText: loadingBetaText,
        color: pickupB > 0 ? 'cyan' : 'emerald',
        hasAction: pickupB > 0,
      },
    ];
  }, [
    isAtDepotInitial,
    isDepot,
    isPolicy2Current,
    arrivalSlots,
    handlingCount,
    handledBetaIndices.length,
    handledAlphaIndices,
    deliveredAlphaIndices,
    reenteringAlphaIndices,
    newBetaIndices,
    currentStep.handlingCost,
    deliverA,
    destinationNode.label,
    pickupB,
  ]);

  const currentSubStepDef = subStepDefs[subStep - 1] || subStepDefs[0];
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
            <h2 className="font-bold text-base text-zinc-100 flex flex-wrap items-center gap-2">
              Compartimiento de Carga LIFO
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                Capacidad Q = {capacity}
              </span>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                solution.model === 'TSPPD-H_1'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : solution.model === 'TSPPD-H_2'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : solution.model === 'TSPPD-H_3'
                  ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {solution.model === 'TSPPD-H_1'
                  ? 'Política 1 (Compuerta Rear)'
                  : solution.model === 'TSPPD-H_2'
                  ? 'Política 2 (Fondo Front)'
                  : solution.model === 'TSPPD-H_3'
                  ? `Política 3 (Híbrida — Stop: Pol. ${currentStep.policyApplied === 0 ? '2' : (currentStep.policyApplied ?? 1)})`
                  : 'Modelo General (Posicional)'}
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
                        : sDef.color === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
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
          <div className={`p-2 rounded-xl border ${
            currentSubStepDef.color === 'amber'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : currentSubStepDef.color === 'rose'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : currentSubStepDef.color === 'emerald'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          }`}>
            {isPolicy2Current ? (
              subStep === 1 ? <ArrowLeft className="w-4 h-4 animate-bounce" /> :
              subStep === 2 ? <ArrowLeft className="w-4 h-4 animate-pulse" /> :
              subStep === 3 ? (pickupB > 0 ? <ArrowRight className="w-4 h-4 animate-bounce" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />) :
              (handlingCount > 0 ? <ArrowRight className="w-4 h-4 animate-pulse" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />)
            ) : (
              <>
                {subStep === 1 && <ArrowLeft className="w-4 h-4 animate-pulse" />}
                {subStep === 2 && <ArrowLeft className="w-4 h-4 animate-bounce" />}
                {subStep === 3 && <ArrowRight className="w-4 h-4 animate-pulse" />}
                {subStep === 4 && (
                  pickupB > 0
                    ? <ArrowRight className="w-4 h-4 animate-bounce" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </>
            )}
          </div>
          <div>
            <span className={`text-xs font-bold font-mono block ${
              currentSubStepDef.color === 'amber'
                ? 'text-amber-300'
                : currentSubStepDef.color === 'rose'
                ? 'text-rose-300'
                : currentSubStepDef.color === 'emerald'
                ? 'text-emerald-300'
                : 'text-cyan-300'
            }`}>
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

      {/* Main Simulation Layout: Truck Compartment (Top) + Logistics Dock (Bottom) */}
      <div className="flex flex-col gap-4">
        
        {/* Physical Truck Trailer & Slots */}
        <div className="w-full flex flex-col gap-3">
          
          {/* Truck Header Bar with Cargo Stats */}
          <div className="bg-zinc-900/90 rounded-xl border border-zinc-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-zinc-200">
                Camión en: <strong className="text-white">{isAtDepotInitial ? 'Depósito Central' : destinationNode.label}</strong>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 font-mono">
                {isAtDepotInitial ? 'Listo para iniciar ruta' : `Paso ${currentStepIndex + 1}/${solution.steps.length}`}
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

          {/* Physical Container Graphic */}
          <div className="relative bg-zinc-900/60 rounded-2xl border-2 border-zinc-700/80 p-4 pt-8 overflow-hidden shadow-inner">
            
            {/* Rear Door / Puerta Trasera (Left Side - Slot 1) */}
            <div className="absolute top-2.5 left-3.5 flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
              <DoorClosed className="w-3.5 h-3.5 text-amber-400" />
              <span>◀ Puerta Trasera (Acceso LIFO - Slot 1)</span>
            </div>

            {/* Front of Truck Cab / Fondo (Right Side - Slot Q) */}
            <div className="absolute top-2.5 right-3.5 flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
              <span>Cabina / Fondo del Camión (Slot {capacity}) ▶</span>
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
            </div>

            {/* Slot Matrix Grid */}
            <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 py-2">
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

                return (
                  <motion.div
                    key={`bay-slot-${slotNum}`}
                    layout
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedSlotIdx(isSelected ? null : slotNum)}
                    className={`relative rounded-xl p-1.5 flex flex-col items-center justify-between min-h-[62px] border transition-colors duration-200 cursor-pointer select-none ${
                      isDeliveringExiting || isDepotUnloading
                        ? 'bg-rose-900/80 border-rose-400 text-white ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/60 scale-105'
                        : isHandlingBetaExiting || isHandlingAlphaExiting || isHandlingBetaEntering || isHandlingAlphaEntering
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
                        <span className="text-[7px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                          PUERTA
                        </span>
                      )}
                      {slotNum === capacity && (
                        <span className="text-[7px] px-1 rounded bg-zinc-800 text-zinc-400 font-medium">
                          FONDO
                        </span>
                      )}
                    </div>

                    {/* Box Graphic */}
                    <div className="my-0.5 flex items-center justify-center relative w-full h-6">
                      <AnimatePresence mode="popLayout">
                        {isAlpha ? (
                          <motion.div
                            key={`alpha-box-${slotNum}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: animDuration }}
                            className="flex flex-col items-center absolute"
                          >
                            <Box className={`w-4 h-4 ${isHandlingAlphaExiting || isHandlingAlphaEntering ? 'text-amber-300' : isDeliveringExiting ? 'text-rose-300' : 'text-rose-400'} drop-shadow`} />
                            <span className={`text-[8px] font-bold font-mono ${isHandlingAlphaExiting || isHandlingAlphaEntering ? 'text-amber-300' : isDeliveringExiting ? 'text-rose-300' : 'text-rose-300'}`}>
                              α {isHandlingAlphaEntering ? '(Reing)' : isHandlingAlphaExiting ? '(Evac)' : isDeliveringExiting ? '(Sale)' : ''}
                            </span>
                          </motion.div>
                        ) : isBeta ? (
                          <motion.div
                            key={`beta-box-${slotNum}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: animDuration }}
                            className="flex flex-col items-center absolute"
                          >
                            <Package className={`w-4 h-4 ${isHandlingBetaExiting || isHandlingBetaEntering ? 'text-amber-300' : isLoadingEntering ? 'text-cyan-300' : 'text-cyan-400'} drop-shadow`} />
                            <span className={`text-[8px] font-bold font-mono ${isHandlingBetaExiting || isHandlingBetaEntering ? 'text-amber-300' : isLoadingEntering ? 'text-cyan-300' : 'text-cyan-300'}`}>
                              β {isHandlingBetaEntering ? '(Reing)' : isHandlingBetaExiting ? '(Evac)' : isLoadingEntering ? '(Entra)' : ''}
                            </span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key={`empty-box-${slotNum}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-3.5 h-3.5 rounded border border-dashed border-zinc-700/60 flex items-center justify-center absolute"
                          >
                            <span className="text-[7px] text-zinc-600 font-mono">—</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Status Badge */}
                    <div className="text-[8px] font-mono font-bold text-center w-full truncate">
                      {isDeliveringExiting ? (
                        <span className="text-rose-300 font-black">SALE α</span>
                      ) : isDepotUnloading ? (
                        <span className="text-rose-300 font-black">DESCARGA β</span>
                      ) : isHandlingBetaExiting ? (
                        <span className="text-amber-300 font-black">EVAC β</span>
                      ) : isHandlingAlphaExiting ? (
                        <span className="text-amber-300 font-black">EVAC α</span>
                      ) : isHandlingBetaEntering ? (
                        <span className="text-amber-300 font-black">REINGR β</span>
                      ) : isHandlingAlphaEntering ? (
                        <span className="text-amber-300 font-black">REINGR α</span>
                      ) : isLoadingEntering ? (
                        <span className="text-cyan-300 font-black">ENTRA β</span>
                      ) : isAlpha ? (
                        <span className="text-rose-400/80 font-semibold">Entrega</span>
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
            <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <span>◀ Puerta Trasera (Slots 1..k)</span>
              </span>
              <span className="text-zinc-400 font-medium text-right">
                Regla LIFO: Último en entrar, primero en salir ▶
              </span>
            </div>

            {/* Dynamic Staging Dock / Andén Logístico Bar */}
            {!isDepot && !isAtDepotInitial && (
              <div className="mt-3 p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-zinc-300">
                    {isPolicy2Current ? (
                      subStep === 1 ? '🚚 Andén de Entrega:' :
                      subStep === 2 ? '⚠️ Andén Temporal de Evacuación:' :
                      subStep === 3 ? '📥 Andén de Carga al Fondo:' :
                      '🔄 Andén de Reingreso y Reubicación:'
                    ) : (
                      subStep === 1 ? '⚠️ Andén de Evacuación LIFO:' :
                      subStep === 2 ? '📦 Andén de Entrega al Cliente:' :
                      subStep === 3 ? '🔄 Andén de Reingreso LIFO:' :
                      '📥 Andén de Carga y Recolección:'
                    )}
                  </span>
                  <span className="text-zinc-400 font-mono text-[11px]">
                    {isPolicy2Current ? (
                      subStep === 1
                        ? (deliverA > 0
                            ? `Descargando ${deliverA} uds α hacia ${destinationNode.label} (Slots ${deliveredAlphaIndices.map((s) => `#${s + 1}`).join(', ')})`
                            : 'Sin entregas α requeridas en este cliente')
                        : subStep === 2
                        ? (handlingCount > 0
                            ? `${handlingCount} uds α (Slots ${handledAlphaIndices.map((s) => `#${s + 1}`).join(', ')}) evacuadas al andén exterior para despejar el fondo`
                            : 'Bahía libre, sin evacuación')
                        : subStep === 3
                        ? (pickupB > 0
                            ? `Cargando ${pickupB} uds β directamente al fondo (Slots ${newBetaIndices.map((s) => `#${s + 1}`).join(', ')})`
                            : 'Sin recolección β requerida')
                        : (handlingCount > 0
                            ? `${handlingCount} uds α reingresando desde el andén hacia Slots ${reenteringAlphaIndices.map((s) => `#${s + 1}`).join(', ')}`
                            : 'Compartimento ordenado y listo')
                    ) : (
                      subStep === 1
                        ? (handlingCount > 0 ? `${handlingCount} uds β evacuadas al andén exterior` : 'Compuerta libre')
                        : subStep === 2
                        ? (deliverA > 0 ? `Descargando ${deliverA} uds α hacia ${destinationNode.label}` : 'Sin entregas α')
                        : subStep === 3
                        ? (handlingCount > 0 ? `${handlingCount} uds β reingresando a la bahía` : 'Bahía ordenada')
                        : (pickupB > 0 ? `Cargando ${pickupB} uds β en compuerta trasera` : 'Sin recolección β')
                    )}
                  </span>
                </div>

                {/* Outside / Dock Tag */}
                {((isPolicy2Current && (subStep === 2 || subStep === 3) && handledAlphaIndices.length > 0) ||
                  (!isPolicy2Current && (subStep === 1 || subStep === 2) && handledBetaIndices.length > 0)) && (
                  <div className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>En Andén Exterior: {isPolicy2Current ? `${handledAlphaIndices.length} uds α en espera de recarga` : `${handledBetaIndices.length} uds β en espera`}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Slot Inspector Banner */}
          {selectedSlotIdx !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs flex items-center justify-between shadow-xl"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-emerald-400 text-xs">Posición #{selectedSlotIdx}:</span>
                <span className="text-zinc-200 text-xs">
                  {displaySlots[selectedSlotIdx - 1] === 'A'
                    ? (deliveredAlphaIndices.includes(selectedSlotIdx - 1)
                        ? 'Mercancía α asignada para entrega en este nodo'
                        : 'Mercancía α (para entrega a clientes posteriores en la ruta)')
                    : displaySlots[selectedSlotIdx - 1] === 'B'
                    ? (newBetaIndices.includes(selectedSlotIdx - 1)
                        ? 'Mercancía β recién recolectada en este cliente'
                        : 'Mercancía β previamente recolectada a bordo')
                    : 'Espacio libre en el compartimiento de carga'}
                </span>
              </div>
              <button
                onClick={() => setSelectedSlotIdx(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer font-semibold transition-all"
              >
                Cerrar
              </button>
            </motion.div>
          )}
        </div>

        {/* Customer Dock & Operations: Horizontal Cards Below Trailer */}
        <div className="w-full bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${destinationNode.isDepot ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="font-bold text-sm text-zinc-100">
                Operaciones en {isAtDepotInitial ? 'Depósito Central' : destinationNode.label}
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Nodo #{isAtDepotInitial ? 0 : destinationNode.id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Delivery Requirements Card */}
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <span className="flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5 text-rose-400" />
                  {isDepot ? 'Descarga Final (β)' : 'Entrega Requerida (α)'}
                </span>
                <span className="font-mono text-xs font-bold text-rose-400">
                  {isDepot ? `${arrivalSlots.filter((s) => s === 'B').length} uds` : `${deliverA} uds`}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-snug">
                {isDepot
                  ? 'Totalidad de mercancía β descargada en el depósito central.'
                  : isAtDepotInitial
                  ? 'Total de mercancía α cargada para distribución.'
                  : 'Mercancía entregada en este nodo.'}
              </p>
              {stage === 'unloading-alpha' && (
                <div className="text-[10px] font-mono text-rose-300 flex items-center gap-1.5 bg-rose-500/10 px-2 py-1 rounded mt-1">
                  <CheckCircle2 className="w-3 h-3 text-rose-400" />
                  Descargando...
                </div>
              )}
            </div>

            {/* Pickup Requirements Card */}
            <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  {isDepot ? 'Recolección' : 'Recolección Requerida (β)'}
                </span>
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {isDepot ? '0 uds' : `${pickupB} uds`}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-snug">
                {isDepot
                  ? 'Depósito central: fin del recorrido.'
                  : 'Mercancía recolectada para retorno.'}
              </p>
              {stage === 'loading-beta' && !isDepot && pickupB > 0 && (
                <div className="text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 bg-cyan-500/10 px-2 py-1 rounded mt-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  Cargando...
                </div>
              )}
            </div>

            {/* Handling Staging / Step Cost Card */}
            {!isDepot && handlingCount > 0 ? (
              <div className={`border rounded-xl p-3 flex flex-col justify-between gap-1.5 transition-all ${
                (isPolicy2Current ? (stage === 'handling-out' || stage === 'handling-in') : (stage === 'handling-out' || stage === 'unloading-alpha'))
                  ? 'bg-amber-950/40 border-amber-500/50 shadow-sm'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    {isPolicy2Current ? 'Reubicación de Carga α (Pol. 2)' : 'Evacuación LIFO (Pol. 1)'}
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {handlingCount} ops (+{formatNumber(currentStep.handlingCost, 2)})
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug">
                  {isPolicy2Current
                    ? (stage === 'handling-out'
                        ? `${handlingCount} uds α evacuadas temporalmente al andén para despejar el fondo.`
                        : stage === 'loading-beta'
                        ? `${pickupB} uds β estibándose al fondo mientras las ${handlingCount} uds α esperan en el andén.`
                        : stage === 'handling-in'
                        ? `${handlingCount} uds α reingresadas desde el andén hacia los slots delanteros.`
                        : `${handlingCount} uds α reubicadas para alojar ${pickupB} uds β al fondo.`)
                    : (stage === 'handling-out' || stage === 'unloading-alpha'
                        ? `${handlingCount} uds β descargadas al andén para despejar la compuerta.`
                        : 'Carga β reincorporada a la compuerta tras la entrega.')}
                </p>
                {isPolicy2Current && stage === 'handling-out' && (
                  <div className="text-[10px] font-mono text-amber-300 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded mt-1">
                    <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" />
                    Evacuando resto de unidades α al andén...
                  </div>
                )}
                {isPolicy2Current && stage === 'handling-in' && (
                  <div className="text-[10px] font-mono text-amber-300 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded mt-1">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" />
                    Reingresando α frente a β...
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800/80 flex flex-col justify-between gap-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-zinc-300 text-xs">
                  <span className="text-zinc-400">Tramo:</span>
                  <span className="font-semibold text-zinc-100">{currentStep.distance} km</span>
                </div>
                <div className="flex items-center justify-between text-zinc-300 text-xs">
                  <span className="text-zinc-400">Handling:</span>
                  <span className="font-semibold text-emerald-400">$0.00 (Libre)</span>
                </div>
                <p className="text-[10px] text-zinc-500">Sin conflicto LIFO en la compuerta.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
