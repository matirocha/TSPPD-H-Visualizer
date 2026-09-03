import React from "react";
import { SolutionData, StepDef, SlotType, AnimationPhase } from "../types/tsppd";
import { Card, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { 
  Truck, 
  DoorOpen, 
  DoorClosed, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle, 
  Package, 
  CheckCircle2,
  Box,
  Layers
} from "lucide-react";

interface CargoBaySimulatorProps {
  solution: SolutionData;
  currentStepIndex: number;
  currentStep: StepDef;
  animationPhase: AnimationPhase;
  phaseProgress: number; // 0 to 1 inside current micro-phase
  playbackSpeed: number;
}

export const CargoBaySimulator: React.FC<CargoBaySimulatorProps> = ({
  solution,
  currentStepIndex,
  currentStep,
  animationPhase,
  phaseProgress,
}) => {
  const capacity = solution.capacity;
  const isDepot = currentStep.to === 0;

  // Determinar qué cajas están actualmente en cada estado según la fase de animación:
  // slots: array de tamaño capacity con "A", "B", o "EMPTY"
  const targetSlots = currentStep.slots || [];

  // Estado previo (slots del paso anterior para transicionar didácticamente)
  const prevStep = currentStepIndex > 0 ? solution.steps[currentStepIndex - 1] : null;
  const prevSlots = prevStep ? prevStep.slots : targetSlots;

  // Cajas temporales en handling (bahía de espera)
  const isHandlingActive = animationPhase === "handling";
  const isDeliveringActive = animationPhase === "delivering_alpha";
  const isReloadingActive = animationPhase === "reloading_beta";
  const isLoadingBetaActive = animationPhase === "loading_beta";

  // Texto y estilo del indicador de fase actual
  const getPhaseInfo = () => {
    switch (animationPhase) {
      case "traveling":
        return {
          title: "Camión en Tránsito",
          desc: `Viajando hacia Nodo ${currentStep.to} (${currentStep.distance} km). Compartimiento sellado.`,
          badgeVariant: "secondary" as const,
          badgeColor: "text-zinc-400 bg-zinc-800",
          doorOpen: false,
        };
      case "arrived":
        return {
          title: `Arribo a ${isDepot ? 'Depósito (0)' : `Cliente ${currentStep.to}`}`,
          desc: `Camión estacionado en muelle de descarga. Apertura de compuerta trasera LIFO.`,
          badgeVariant: "default" as const,
          badgeColor: "text-emerald-400 bg-emerald-500/20",
          doorOpen: true,
        };
      case "handling":
        return {
          title: `⚠️ Conflicto LIFO — Manipulación Activa`,
          desc: `${currentStep.handlingCount} unidades β obstruyen la puerta. Descargándolas temporalmente a la bahía de espera (Costo: +${currentStep.handlingCost.toFixed(2)}).`,
          badgeVariant: "amber" as const,
          badgeColor: "text-amber-400 bg-amber-500/20",
          doorOpen: true,
        };
      case "delivering_alpha":
        return {
          title: `Descarga de Mercancía α`,
          desc: `Entregando ${currentStep.deliverA} unidades α requeridas por el cliente. Las cajas salen por la puerta trasera.`,
          badgeVariant: "destructive" as const,
          badgeColor: "text-rose-400 bg-rose-500/20",
          doorOpen: true,
        };
      case "reloading_beta":
        return {
          title: `Reingreso de Mercancía Manipulada`,
          desc: `Las unidades β de la bahía temporal se vuelven a cargar en el camión.`,
          badgeVariant: "amber" as const,
          badgeColor: "text-amber-300 bg-amber-500/20",
          doorOpen: true,
        };
      case "loading_beta":
        return {
          title: `Carga de Mercancía β Recolectada`,
          desc: `Ingresando ${currentStep.pickupB} unidades β desde el cliente al compartimiento LIFO.`,
          badgeVariant: "cyan" as const,
          badgeColor: "text-cyan-400 bg-cyan-500/20",
          doorOpen: true,
        };
      case "ready":
      default:
        return {
          title: "Carga Estabilizada & Lista",
          desc: `Compartimiento acomodado según solución óptima. Listo para partir al siguiente tramo.`,
          badgeVariant: "default" as const,
          badgeColor: "text-emerald-400 bg-emerald-500/20",
          doorOpen: false,
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  return (
    <Card className="flex flex-col h-full bg-zinc-900/60 border-zinc-800/80 overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-zinc-800/60 bg-zinc-950/40 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">Compartimiento LIFO del Camión</CardTitle>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={`text-xs px-2.5 py-0.5 font-medium ${phaseInfo.badgeColor}`}>
            {phaseInfo.title}
          </Badge>
          <div className="flex items-center space-x-1 text-xs text-zinc-400 font-mono">
            {phaseInfo.doorOpen ? (
              <span className="flex items-center text-emerald-400 font-semibold">
                <DoorOpen className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Puerta Abierta
              </span>
            ) : (
              <span className="flex items-center text-zinc-500">
                <DoorClosed className="h-3.5 w-3.5 mr-1" /> Puerta Cerrada
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
        {/* Phase Action Banner with smooth transitions */}
        <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3 flex items-center justify-between shadow-inner">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-zinc-200">
                Operación en Muelle:
              </span>
              <span className="text-xs text-zinc-400">
                {phaseInfo.desc}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-[11px] font-mono text-zinc-400">
              <span>Entrega α: <strong className="text-rose-400 font-bold">{currentStep.deliverA}</strong></span>
              <span>Recolección β: <strong className="text-cyan-400 font-bold">{currentStep.pickupB}</strong></span>
              <span>Handling: <strong className="text-amber-400 font-bold">{currentStep.handlingCount} ops</strong></span>
            </div>
          </div>
        </div>

        {/* --- VISUALIZACIÓN DEL CAMIÓN Y SUS RANURAS (CUTAWAY) --- */}
        <div className="relative rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-4 shadow-xl">
          {/* Cabina del camión (Izquierda) */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono flex items-center space-x-1.5">
                <Truck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Cabina del Chofer (Frente)</span>
              </div>
              <span className="text-[10px] text-zinc-500">← Fondo del remolque</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-[10px] text-zinc-500">Acceso LIFO →</span>
              <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-1 font-bold">
                <DoorOpen className="h-3.5 w-3.5" />
                <span>Puerta Trasera</span>
              </div>
            </div>
          </div>

          {/* Grid de Ranuras (Slots 1 a Q) */}
          <div className="relative border-2 border-zinc-700 rounded-lg p-3 bg-zinc-950/70">
            {/* Límite de carga y fondo */}
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5">
              {Array.from({ length: capacity }).map((_, idx) => {
                const slotIndex = idx + 1;
                // Estado en este slot
                const item = targetSlots[idx] || "EMPTY";

                // Determinamos si este slot está en animación activa
                const isItemAlpha = item === "A";
                const isItemBeta = item === "B";
                const isEmpty = item === "EMPTY";

                // Animación de salida o entrada según fase
                let slotHighlight = "border-zinc-800/80 bg-zinc-900/40 text-zinc-600";
                if (isItemAlpha) {
                  slotHighlight = isDeliveringActive
                    ? "border-rose-400 bg-rose-500/30 text-rose-200 shadow-rose-900/50 shadow-md animate-pulse"
                    : "border-rose-500/50 bg-rose-500/20 text-rose-300";
                } else if (isItemBeta) {
                  slotHighlight = isHandlingActive
                    ? "border-amber-400 bg-amber-500/30 text-amber-200 shadow-amber-900/50 shadow-md animate-bounce"
                    : isLoadingBetaActive
                    ? "border-cyan-400 bg-cyan-500/30 text-cyan-200 animate-pulse"
                    : "border-cyan-500/50 bg-cyan-500/20 text-cyan-300";
                }

                return (
                  <motion.div
                    key={`slot-${slotIndex}`}
                    layout
                    initial={{ scale: 0.95, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className={`relative flex flex-col items-center justify-center p-1 rounded-md border text-center font-mono select-none h-12 transition-all ${slotHighlight}`}
                    title={`Ranura ${slotIndex}: ${item === 'A' ? 'Entrega α' : item === 'B' ? 'Recolección β' : 'Vacío'}`}
                  >
                    {/* Número de ranura pequeño arriba */}
                    <span className="text-[9px] text-zinc-500 absolute top-0.5 left-1">
                      {slotIndex}
                    </span>

                    {/* Contenido de la ranura */}
                    {isItemAlpha && (
                      <div className="flex flex-col items-center mt-1">
                        <Box className="h-4 w-4 text-rose-400" />
                        <span className="text-[10px] font-bold text-rose-300">α</span>
                      </div>
                    )}
                    {isItemBeta && (
                      <div className="flex flex-col items-center mt-1">
                        <Package className="h-4 w-4 text-cyan-400" />
                        <span className="text-[10px] font-bold text-cyan-300">β</span>
                      </div>
                    )}
                    {isEmpty && (
                      <span className="text-[10px] text-zinc-600 mt-2">—</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- ÁREAS AUXILIARES EXTERNAS: BAHÍA DE HANDLING & MUELLE DEL CLIENTE --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 1. Bahía de Descarga Temporal (Handling Staging Bay) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 relative flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-400">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span>Zona de Descarga Temporal (Handling LIFO)</span>
              </div>
              <Badge variant="amber" className="text-[10px]">
                {currentStep.handlingCount} items afectados
              </Badge>
            </div>

            <p className="text-[11px] text-zinc-400 mb-2">
              Las cajas β que bloquean el fondo del camión se retiran aquí temporalmente para desbloquear las cajas α.
            </p>

            {/* Visualización de items en handling temporal */}
            <div className="min-h-[46px] rounded-lg border border-dashed border-amber-500/40 bg-zinc-950/60 p-2 flex items-center space-x-2 overflow-x-auto">
              {currentStep.handlingCount === 0 ? (
                <span className="text-xs text-zinc-600 italic">
                  Sin bloqueo LIFO en esta parada. No se requiere manipulación.
                </span>
              ) : (
                <div className="flex items-center space-x-2">
                  {Array.from({ length: Math.min(8, currentStep.handlingCount) }).map((_, i) => (
                    <motion.div
                      key={`handling-box-${i}`}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.08, type: "spring" }}
                      className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500 text-amber-300 text-xs font-mono font-bold flex items-center space-x-1 shadow-sm"
                    >
                      <Package className="h-3 w-3 text-amber-400" />
                      <span>β#{i+1}</span>
                    </motion.div>
                  ))}
                  {currentStep.handlingCount > 8 && (
                    <span className="text-xs text-amber-400 font-mono">
                      +{currentStep.handlingCount - 8} más
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Muelle del Cliente / Depósito (Client Loading Dock) */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 relative flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Muelle del Destino (Nodo {currentStep.to})</span>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {isDepot ? "Almacén Central" : `Cliente ID ${currentStep.to}`}
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 mb-2">
              Intercambio de mercancía realizado con éxito en esta parada.
            </p>

            <div className="min-h-[46px] rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 flex items-center justify-around">
              {/* Entrega Alpha */}
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-rose-500/20 text-rose-400">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs font-mono">
                  <span className="text-zinc-400">Entregado:</span>{" "}
                  <span className="text-rose-400 font-bold">{currentStep.deliverA} α</span>
                </div>
              </div>

              <div className="h-5 w-px bg-zinc-800" />

              {/* Recolección Beta */}
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs font-mono">
                  <span className="text-zinc-400">Recolectado:</span>{" "}
                  <span className="text-cyan-400 font-bold">{currentStep.pickupB} β</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leyenda Didáctica */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 text-xs text-zinc-400">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/50 inline-block" />
              <span>Mercancía α (Entrega a cliente)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/50 inline-block" />
              <span>Mercancía β (Recolección hacia depósito)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-zinc-900 border border-zinc-700 inline-block" />
              <span>Slot Vacío</span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Regla: Acceso exclusivo por compuerta trasera (LIFO)
          </span>
        </div>
      </div>
    </Card>
  );
};
