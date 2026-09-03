import React from "react";
import { SolutionData, OperationPhase } from "@/types/tsppd";
import { AlertTriangle, Truck, Info, ArrowDown, ArrowUp, RefreshCw, CheckCircle2 } from "lucide-react";

interface CargoCompartmentProps {
  solution: SolutionData;
  currentStep: number;
  operationPhase: OperationPhase;
  isAnimating: boolean;
}

export const CargoCompartment: React.FC<CargoCompartmentProps> = ({
  solution,
  currentStep,
  operationPhase,
  isAnimating,
}) => {
  const currentStepData =
    currentStep >= 0 && currentStep < solution.steps.length
      ? solution.steps[currentStep]
      : null;

  const capacity = solution.capacity;

  // Calculate dynamic cargo state depending on operationPhase:
  const transitA = currentStep < 0 ? solution.nodes[0].alpha : currentStepData ? currentStepData.aOnTruck : 0;
  const transitB = currentStep < 0 ? 0 : currentStepData ? currentStepData.bOnTruck : 0;

  const deliverA = currentStepData ? currentStepData.deliverA : 0;
  const pickupB = currentStepData ? currentStepData.pickupB : 0;
  const handlingCount = currentStepData ? currentStepData.handlingCount : 0;
  const handlingCost = currentStepData ? currentStepData.handlingCost : 0;

  // Dynamic live numbers according to phase:
  let liveA = transitA;
  let liveB = transitB;
  let stagedHandlingB = 0;

  if (currentStep < 0) {
    liveA = solution.nodes[0].alpha;
    liveB = 0;
  } else if (isAnimating || operationPhase === "TRAVELING") {
    // Camión en tránsito hacia el nodo: aún no se descargan ni cargan cosas
    liveA = transitA;
    liveB = transitB;
  } else if (operationPhase === "HANDLING_UNLOAD") {
    // Las unidades B bloqueantes se bajan al muelle temporal
    stagedHandlingB = handlingCount;
    liveB = Math.max(0, transitB - handlingCount);
    liveA = transitA;
  } else if (operationPhase === "DELIVERING_A") {
    // Se entregan las unidades A
    stagedHandlingB = handlingCount;
    liveB = Math.max(0, transitB - handlingCount);
    liveA = Math.max(0, transitA - deliverA);
  } else if (operationPhase === "HANDLING_RELOAD") {
    // Las unidades B bloqueantes vuelven a subir al camión
    stagedHandlingB = 0;
    liveB = transitB;
    liveA = Math.max(0, transitA - deliverA);
  } else if (operationPhase === "PICKING_UP_B") {
    // Entran las nuevas unidades B
    liveA = Math.max(0, transitA - deliverA);
    liveB = transitB + pickupB;
  } else {
    // FINISHED_STEP o IDLE: Estado final de este paso
    liveA = Math.max(0, transitA - deliverA);
    liveB = transitB + pickupB;
  }

  const totalLiveLoad = liveA + liveB;
  const occupancyPercent = Math.min(100, Math.round((totalLiveLoad / capacity) * 100));

  // Build the slots array for the truck bay
  const slots: ("A" | "B" | "EMPTY")[] = [];
  for (let k = 0; k < capacity; k++) {
    if (k < liveA) {
      slots.push("A");
    } else if (k < liveA + liveB) {
      slots.push("B");
    } else {
      slots.push("EMPTY");
    }
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl">
      {/* Header and Live Occupancy */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Bahía de Carga del Camión (Política LIFO)
            </h3>
            <p className="text-xs text-zinc-400">
              Visualización en tiempo real de los {capacity} slots y operaciones de estiba
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
              α (Entrega): {liveA}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
              β (Recolección): {liveB}
            </span>
          </div>

          <div className="text-xs font-mono text-zinc-200 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800 font-semibold">
            Ocupación: <strong className="text-cyan-400">{totalLiveLoad}</strong> / {capacity} ({occupancyPercent}%)
          </div>
        </div>
      </div>

      {/* Capacity Progress Bar */}
      <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800 p-[1px]">
        <div
          className="h-full bg-red-500 transition-all duration-300 rounded-l-full"
          style={{ width: `${(liveA / capacity) * 100}%` }}
          title={`Entrega α: ${liveA} unidades`}
        />
        <div
          className="h-full bg-cyan-400 transition-all duration-300"
          style={{ width: `${(liveB / capacity) * 100}%` }}
          title={`Recolección β: ${liveB} unidades`}
        />
      </div>

      {/* Sub-phase Status Banner */}
      <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-semibold">
          {operationPhase === "TRAVELING" ? (
            <span className="text-sky-400 flex items-center gap-1.5 animate-pulse">
              🚚 Camión en tránsito hacia {currentStepData ? solution.nodes[currentStepData.to]?.label : "destino"}...
            </span>
          ) : operationPhase === "HANDLING_UNLOAD" ? (
            <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-4 h-4" /> Paso 1/4: Desapilando {handlingCount} unidades β al muelle temporal (LIFO Handling)...
            </span>
          ) : operationPhase === "DELIVERING_A" ? (
            <span className="text-red-400 flex items-center gap-1.5 animate-pulse">
              <ArrowDown className="w-4 h-4" /> Paso 2/4: Descargando y entregando {deliverA} unidades α al cliente...
            </span>
          ) : operationPhase === "HANDLING_RELOAD" ? (
            <span className="text-purple-400 flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" /> Paso 3/4: Reingresando las {handlingCount} unidades β al camión...
            </span>
          ) : operationPhase === "PICKING_UP_B" ? (
            <span className="text-cyan-400 flex items-center gap-1.5 animate-pulse">
              <ArrowUp className="w-4 h-4" /> Paso 4/4: Recolectando {pickupB} nuevas unidades β del cliente...
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Operación de carga y descarga completada en este nodo.
            </span>
          )}
        </div>

        {handlingCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[11px]">
            Handling: +{handlingCost.toFixed(2)}
          </span>
        )}
      </div>

      {/* Main Visual Truck Container */}
      <div className="bg-zinc-950 border-2 border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3 relative shadow-inner">
        {/* Direction header */}
        <div className="flex items-center justify-between text-xs font-bold tracking-wider text-zinc-400 uppercase px-1">
          <span className="flex items-center gap-1.5 text-zinc-300">
            🚚 Cabina / Frente (Fondo)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400 animate-pulse">
            Puerta Trasera de Descarga (LIFO) 🚪
          </span>
        </div>

        {/* Larger Bins / Slots Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-2 p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-x-auto">
          {slots.map((slot, idx) => {
            const isA = slot === "A";
            const isB = slot === "B";

            return (
              <div
                key={idx}
                className={`h-14 sm:h-16 rounded-xl flex flex-col items-center justify-center font-mono font-bold transition-all duration-300 relative group select-none ${
                  isA
                    ? "bg-red-500/25 border-2 border-red-500/70 text-red-300 shadow-md shadow-red-500/20 scale-[0.98]"
                    : isB
                    ? "bg-cyan-500/25 border-2 border-cyan-500/70 text-cyan-300 shadow-md shadow-cyan-500/20 scale-[0.98]"
                    : "bg-zinc-900/40 border border-dashed border-zinc-800 text-zinc-700"
                }`}
              >
                <span className="text-base sm:text-lg">
                  {isA ? "α" : isB ? "β" : ""}
                </span>
                <span className="text-[9px] sm:text-[10px] text-zinc-500 font-semibold mt-0.5">
                  Slot {idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Handling Temporary Staging Area if active */}
      {stagedHandlingB > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border-2 border-dashed border-amber-500/60 text-amber-200 flex flex-col gap-2 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Muelle de Manipulación Temporal (Unidades β removidas temporalmente)
            </span>
            <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
              {stagedHandlingB} Cajas β fuera del camión
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {Array.from({ length: stagedHandlingB }).map((_, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-lg bg-cyan-500/30 border-2 border-amber-400 text-cyan-200 flex items-center justify-center font-bold text-xs animate-bounce"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                β
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Natural language summary */}
      <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-300 text-xs flex items-center gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span>
          {currentStep < 0
            ? "El camión comienza completamente cargado en el depósito con las unidades α requeridas para todos los clientes."
            : currentStepData && currentStepData.to === 0
            ? "Retorno final al depósito con toda la carga β recolectada."
            : `En este nodo: se entregan ${deliverA} unidades α y se recolectan ${pickupB} unidades β${
                handlingCount > 0 ? ` con ${handlingCount} operaciones de remoción temporal (handling)` : ""
              }.`}
        </span>
      </div>
    </div>
  );
};
