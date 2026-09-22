import React from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, Gauge } from "lucide-react";

interface StepPlayerProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  onPlayToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onSpeedChange: (newSpeed: number) => void;
}

export const StepPlayer: React.FC<StepPlayerProps> = ({
  currentStep,
  totalSteps,
  isPlaying,
  speed,
  onPlayToggle,
  onNext,
  onPrev,
  onFirst,
  onLast,
  onSpeedChange,
}) => {
  const speeds = [0.5, 1, 1.5, 2, 3];

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
      {/* Step Counter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
          Paso:
        </span>
        <div className="flex items-baseline gap-1 font-mono">
          <span className="text-xl font-black text-cyan-400">
            {Math.max(0, currentStep + 1)}
          </span>
          <span className="text-xs text-zinc-500 font-bold">/ {totalSteps}</span>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Go to start */}
        <button
          onClick={onFirst}
          disabled={currentStep < 0}
          className="p-2 sm:p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Inicio de la ruta (Home)"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous step */}
        <button
          onClick={onPrev}
          disabled={currentStep < 0}
          className="p-2 sm:p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Paso anterior (Flecha Izq)"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play / Pause Primary Button */}
        <button
          onClick={onPlayToggle}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
            isPlaying
              ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20"
              : "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-cyan-500/25 ring-1 ring-cyan-400/50"
          }`}
          title={isPlaying ? "Pausar simulación (Espacio)" : "Reproducir simulación (Espacio)"}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Reproducir</span>
            </>
          )}
        </button>

        {/* Next step */}
        <button
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
          className="p-2 sm:p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Siguiente paso (Flecha Der)"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Go to end */}
        <button
          onClick={onLast}
          disabled={currentStep >= totalSteps - 1}
          className="p-2 sm:p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Final de la ruta (End)"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Speed Selector */}
      <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
        <Gauge className="w-3.5 h-3.5 text-zinc-500 ml-1.5" />
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
              speed === s
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
