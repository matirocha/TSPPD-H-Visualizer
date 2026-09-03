import React from "react";
import { AnimationPhase, StepDef } from "../types/tsppd";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  Gauge, 
  Clock, 
  FastForward,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

interface ControlsDeckProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onReset: () => void;
  onNextPhase: () => void;
  onPrevPhase: () => void;
  currentStepIndex: number;
  totalSteps: number;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  animationPhase: AnimationPhase;
  currentStep: StepDef;
}

export const ControlsDeck: React.FC<ControlsDeckProps> = ({
  isPlaying,
  onTogglePlay,
  onPrevStep,
  onNextStep,
  onReset,
  onNextPhase,
  onPrevPhase,
  currentStepIndex,
  totalSteps,
  playbackSpeed,
  onChangeSpeed,
  animationPhase,
  currentStep,
}) => {
  const speeds = [0.5, 1.0, 1.5, 2.0];

  const phaseNames: Record<AnimationPhase, string> = {
    traveling: "1. Tránsito",
    arrived: "2. Arribo",
    handling: "3. Handling LIFO",
    delivering_alpha: "4. Entrega α",
    reloading_beta: "5. Reingreso",
    loading_beta: "6. Carga β",
    ready: "7. Listo",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md p-4 shadow-lg space-y-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Controles Principales Multimedia */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="iconSm"
            onClick={onReset}
            title="Reiniciar tour desde el depósito"
          >
            <RotateCcw className="h-4 w-4 text-zinc-400 hover:text-white" />
          </Button>

          <Button
            variant="outline"
            size="iconSm"
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            title="Parada anterior"
          >
            <SkipBack className="h-4 w-4 text-zinc-300" />
          </Button>

          <Button
            variant={isPlaying ? "destructive" : "default"}
            size="default"
            onClick={onTogglePlay}
            className="px-5 font-bold shadow-md flex items-center space-x-2"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Iniciar Simulación</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="iconSm"
            onClick={onNextStep}
            disabled={currentStepIndex >= totalSteps - 1}
            title="Siguiente parada"
          >
            <SkipForward className="h-4 w-4 text-zinc-300" />
          </Button>

          <div className="h-6 w-px bg-zinc-800 mx-1 hidden sm:block" />

          {/* Micro-fase manual (Paso a paso de carga/descarga) */}
          <div className="flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="iconSm"
              onClick={onPrevPhase}
              disabled={isPlaying}
              title="Fase anterior de la parada"
              className="h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-zinc-400" />
            </Button>

            <span className="text-[11px] font-mono px-2 text-zinc-300 select-none">
              {phaseNames[animationPhase]}
            </span>

            <Button
              variant="ghost"
              size="iconSm"
              onClick={onNextPhase}
              disabled={isPlaying}
              title="Siguiente fase de la parada"
              className="h-7 w-7"
            >
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            </Button>
          </div>
        </div>

        {/* Indicador de Paso y Progreso */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-zinc-400">Paso actual:</span>
            <Badge variant="default" className="font-mono text-xs">
              {currentStepIndex + 1} de {totalSteps}
            </Badge>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Selector de Velocidad */}
          <div className="flex items-center space-x-1.5">
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-zinc-400 text-xs mr-1">Velocidad:</span>
            <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
              {speeds.map((s) => (
                <button
                  key={`speed-${s}`}
                  onClick={() => onChangeSpeed(s)}
                  className={`px-2 py-0.5 text-[11px] rounded font-mono transition-colors ${
                    playbackSpeed === s
                      ? "bg-emerald-500 text-zinc-950 font-bold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de progreso interactiva del Tour */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
          <span>Depósito (Inicio)</span>
          <span className="text-zinc-300 font-semibold">
            Parada actual: {currentStep.from} → {currentStep.to} ({currentStep.distance} km)
          </span>
          <span>Depósito (Fin)</span>
        </div>
        <Slider
          value={[currentStepIndex]}
          max={totalSteps - 1}
          step={1}
          onValueChange={(val) => {
            // El usuario puede arrastrar directamente para ir a un paso
            if (val[0] !== currentStepIndex) {
              // trigger step change
            }
          }}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
};
