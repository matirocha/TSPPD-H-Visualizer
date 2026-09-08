import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Zap, Gauge } from 'lucide-react';
import { PlaybackStatus, AnimationSpeed } from '../types/solution';

interface PlaybackControlsProps {
  currentStepIndex: number;
  totalSteps: number;
  status: PlaybackStatus;
  speed: AnimationSpeed;
  progress: number;
  isArrived?: boolean;
  isContinuousMode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSelectStep: (index: number) => void;
  onChangeSpeed: (speed: AnimationSpeed) => void;
  onToggleContinuousMode: (val: boolean) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentStepIndex,
  totalSteps,
  status,
  speed,
  progress,
  isArrived = false,
  isContinuousMode,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
  onSelectStep,
  onChangeSpeed,
  onToggleContinuousMode,
}) => {
  const isPlaying = status === 'playing';

  return (
    <div className="rounded-3xl bg-zinc-950/90 border border-zinc-800/90 p-4 lg:p-5 flex flex-col gap-4 shadow-xl">
      {/* Top Row: Playback Buttons & Speeds */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Main media buttons */}
        <div className="flex items-center gap-2">
          {/* Reset */}
          <button
            onClick={onReset}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Reiniciar al paso 1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Prev */}
          <button
            onClick={onPrev}
            disabled={currentStepIndex === 0}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
            title="Paso anterior"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause / Iniciar */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer shadow-lg ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 shadow-emerald-500/25'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>{currentStepIndex === 0 && !isArrived && progress === 0 ? 'Iniciar Ruta' : 'Reanudar Ruta'}</span>
              </>
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            disabled={currentStepIndex >= totalSteps - 1}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
            title="Siguiente paso"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Controls & Continuous Mode Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
            <span className="text-[10px] text-zinc-500 px-2 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              Velocidad:
            </span>
            {([0.5, 1, 1.5, 2] as AnimationSpeed[]).map((s) => (
              <button
                key={`speed-${s}`}
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  speed === s
                    ? 'bg-zinc-800 text-emerald-400 font-bold border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Continuous Mode Switch */}
          <button
            onClick={() => onToggleContinuousMode(!isContinuousMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer border ${
              isContinuousMode
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Avanzar automáticamente por los 4 sub-pasos y continuar al siguiente cliente"
          >
            <Zap className={`w-3.5 h-3.5 ${isContinuousMode ? 'text-emerald-400 fill-emerald-400' : 'text-zinc-500'}`} />
            <span>Modo Continuo {isContinuousMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Step Timeline Pills & Transit Progress Bar */}
      <div className="flex flex-col gap-2 pt-1 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>Progreso del Recorrido:</span>
          <span>Paso {currentStepIndex + 1} de {totalSteps}</span>
        </div>

        {/* Step Selector Buttons */}
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
          {Array.from({ length: totalSteps }, (_, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPast = idx < currentStepIndex;

            return (
              <button
                key={`timeline-step-${idx}`}
                data-step-btn={idx + 1}
                onClick={() => onSelectStep(idx)}
                className={`h-8 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                  isCurrent
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-950'
                    : isPast
                    ? 'bg-zinc-800/80 text-emerald-400 border-zinc-700 hover:bg-zinc-800'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
