import React from 'react';
import { Solution } from '../types/tsppd';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  FastForward,
  Rewind
} from 'lucide-react';

interface PlaybackControlsProps {
  solution: Solution;
  currentStepIndex: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
  onSelectStep: (index: number) => void;
  onReplayStep: () => void;
}

const SPEED_OPTIONS = [
  { label: '0.25x (Ultra Lenta)', value: 0.25 },
  { label: '0.5x (Lenta)', value: 0.5 },
  { label: '1.0x (Normal)', value: 1.0 },
  { label: '2.0x (Rápida)', value: 2.0 },
];

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  solution,
  currentStepIndex,
  isPlaying,
  speed,
  onTogglePlay,
  onPrevStep,
  onNextStep,
  onReset,
  onSetSpeed,
  onSelectStep,
  onReplayStep,
}) => {
  const totalSteps = solution.steps.length;

  return (
    <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3.5 shadow-xl">
      
      {/* Top Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          {/* Reset / Beginning */}
          <button
            onClick={onReset}
            title="Reiniciar Tour al Depósito"
            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Previous Step */}
          <button
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            title="Paso Anterior"
            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pausar Reproducción' : 'Iniciar Reproducción Automática'}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20 ring-2 ring-amber-400/40'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20 ring-2 ring-emerald-400/40'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-zinc-950" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-zinc-950" />
                <span>Reproducir Tour</span>
              </>
            )}
          </button>

          {/* Next Step */}
          <button
            onClick={onNextStep}
            disabled={currentStepIndex === totalSteps - 1}
            title="Siguiente Paso"
            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
          >
            <FastForward className="w-4 h-4" />
          </button>

          {/* Replay Current Step Phases */}
          <button
            onClick={onReplayStep}
            title="Repetir Animación Lenta de este Paso"
            className="px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Repetir Fases</span>
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-1">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">Velocidad:</span>
          </div>

          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSetSpeed(opt.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  speed === opt.value
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.value}x
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Step Timeline & Breadcrumb */}
      <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono">
            Progreso del Recorrido: Paso <strong className="text-emerald-400 font-bold">{currentStepIndex + 1}</strong> de {totalSteps}
          </span>
          <span className="text-[11px] text-zinc-500">
            Haz clic en cualquier paso para saltar directamente
          </span>
        </div>

        {/* Interactive Step Buttons Bar */}
        <div className="grid grid-cols-6 gap-2">
          {solution.steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;

            return (
              <button
                key={`step-btn-${idx}`}
                onClick={() => onSelectStep(idx)}
                className={`p-2 rounded-xl text-left transition-all border flex flex-col gap-0.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-200 shadow-md'
                    : isCompleted
                    ? 'bg-zinc-950/80 border-zinc-700/80 text-zinc-300 hover:border-zinc-500'
                    : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="font-bold">Paso {idx + 1}</span>
                  {step.handlingCost > 0 && (
                    <span className="text-amber-400 font-bold text-[9px]">⚠️ Hand</span>
                  )}
                </div>
                <div className="text-xs font-semibold truncate">
                  {step.from === 0 ? 'Depósito' : `C${step.from}`} → {step.to === 0 ? 'Depósito' : `C${step.to}`}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {step.distance} km
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
