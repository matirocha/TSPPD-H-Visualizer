import React from 'react';
import { AnimationPhase } from '../types/solution';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { cn } from '../lib/cn';

interface PlaybackControlsProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  phase: AnimationPhase;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSpeedChange: (speed: number) => void;
}

const PHASE_LABELS: Record<AnimationPhase, string> = {
  'idle': 'En espera',
  'moving': 'Moviendo',
  'handling-out': 'Descargando (Handling)',
  'unloading-alpha': 'Descargando α',
  'handling-back': 'Cargando (Handling)',
  'loading-beta': 'Cargando β',
  'step-complete': 'Paso completado'
};

export function PlaybackControls({
  currentStep, totalSteps, isPlaying, speed, phase,
  onPlay, onPause, onReset, onNext, onPrev, onSpeedChange
}: PlaybackControlsProps) {
  const speeds = [0.5, 1, 1.5, 2];

  return (
    <div className="bg-zinc-900/90 backdrop-blur-sm rounded-2xl px-6 py-3 border border-zinc-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <ControlButton icon={RotateCcw} onClick={onReset} label="Reiniciar" />
        <ControlButton icon={SkipBack} onClick={onPrev} disabled={currentStep === 0} label="Anterior" />
        <ControlButton 
          icon={isPlaying ? Pause : Play} 
          onClick={isPlaying ? onPause : onPlay} 
          className={isPlaying ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-emerald-600 text-white hover:bg-emerald-500"}
          label={isPlaying ? "Pausar" : "Reproducir"}
        />
        <ControlButton icon={SkipForward} onClick={onNext} disabled={currentStep >= totalSteps - 1} label="Siguiente" />
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="bg-zinc-950 px-3 py-1 rounded-lg text-sm font-medium text-zinc-300 border border-zinc-800">
          Paso {currentStep + 1} / {totalSteps}
        </div>
        <div className="text-xs text-zinc-500 font-medium h-4">
          {PHASE_LABELS[phase] || phase}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
              speed === s
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

function ControlButton({ icon: Icon, onClick, disabled, className, label }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
        disabled ? "opacity-50 cursor-not-allowed text-zinc-600 bg-zinc-900" : "hover:bg-zinc-800 text-zinc-300 active:scale-95",
        className
      )}
    >
      <Icon size={20} className={cn(disabled ? "" : "drop-shadow-sm")} fill={label === "Reproducir" ? "currentColor" : "none"} />
    </button>
  );
}
