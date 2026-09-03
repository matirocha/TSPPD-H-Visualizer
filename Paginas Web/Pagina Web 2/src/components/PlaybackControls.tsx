import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FastForward, Zap, Hand } from 'lucide-react';
import { AnimationSpeed, PlaybackStatus } from '../types/solution';

interface PlaybackControlsProps {
  currentStepIndex: number;
  totalSteps: number;
  status: PlaybackStatus;
  speed: AnimationSpeed;
  progress: number;
  isContinuousMode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSelectStep: (stepIndex: number) => void;
  onChangeSpeed: (speed: AnimationSpeed) => void;
  onToggleContinuousMode: (enabled: boolean) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentStepIndex,
  totalSteps,
  status,
  speed,
  progress,
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
  const speedOptions: AnimationSpeed[] = [0.5, 1, 1.5, 2, 3];

  return (
    <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/90 p-4 shadow-xl flex flex-col gap-3">
      {/* Top row: Transport buttons, Scrubber, and Speed controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Play/Pause & Stepping Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-700/60"
            title="Reiniciar Tour al Depósito"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            onClick={onPrev}
            disabled={currentStepIndex === 0}
            className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer border border-zinc-700/60"
            title="Paso Anterior"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`
              px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg
              ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 shadow-emerald-500/20'
              }
            `}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>{currentStepIndex >= totalSteps - 1 ? 'Repetir Tour' : 'Reproducir'}</span>
              </>
            )}
          </button>

          <button
            onClick={onNext}
            disabled={currentStepIndex >= totalSteps - 1}
            className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer border border-zinc-700/60"
            title="Siguiente Paso"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Step Scrubber Timeline */}
        <div className="flex-1 w-full flex flex-col gap-1.5 max-w-2xl px-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Paso {currentStepIndex + 1} de {totalSteps}</span>
            <span>Progreso del Arco: {Math.round(progress * 100)}%</span>
          </div>

          {/* Step dots / interactive track */}
          <div className="flex items-center gap-1.5 w-full">
            {Array.from({ length: totalSteps }).map((_, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;

              return (
                <button
                  key={`step-pill-${idx}`}
                  onClick={() => onSelectStep(idx)}
                  className={`
                    flex-1 h-2.5 rounded-full transition-all cursor-pointer relative group
                    ${
                      isCurrent
                        ? 'bg-emerald-400 shadow-md shadow-emerald-400/40 ring-2 ring-emerald-400/30'
                        : isPast
                        ? 'bg-emerald-600/70 hover:bg-emerald-500'
                        : 'bg-zinc-800 hover:bg-zinc-700'
                    }
                  `}
                  title={`Ir al Paso ${idx + 1}`}
                >
                  {/* Tooltip on hover */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[10px] font-mono text-zinc-200 pointer-events-none whitespace-nowrap z-30">
                    Paso {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800">
          <span className="text-[11px] font-mono text-zinc-400 px-2 flex items-center gap-1">
            <FastForward className="h-3 w-3 text-cyan-400" />
            Vel:
          </span>
          {speedOptions.map((s) => (
            <button
              key={`speed-${s}`}
              onClick={() => onChangeSpeed(s)}
              className={`
                px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer
                ${
                  speed === s
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }
              `}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: Option "Recorrido sin pausar" / Continuous Mode Toggle */}
      <div className="border-t border-zinc-800/80 pt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <label className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border transition-all cursor-pointer select-none ${isContinuousMode ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950/20' : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'}`}>
          <input
            type="checkbox"
            checked={isContinuousMode}
            onChange={(e) => onToggleContinuousMode(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-zinc-700 focus:ring-emerald-500 focus:ring-offset-zinc-950 cursor-pointer accent-emerald-500"
          />
          <div className="flex items-center gap-2">
            {isContinuousMode ? <Zap className="h-4 w-4 text-emerald-400" /> : <Hand className="h-4 w-4 text-amber-400" />}
            <div>
              <span className={`font-mono font-bold block ${isContinuousMode ? 'text-emerald-300' : 'text-zinc-300'}`}>
                Recorrido sin pausar (Modo Automático)
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {isContinuousMode
                  ? 'La explicación de los 4 sub-pasos pasa automáticamente y el camión continúa solo al siguiente cliente'
                  : 'La explicación avanza únicamente con el botón flechita y espera confirmación para seguir la ruta'}
              </span>
            </div>
          </div>
        </label>

        <span className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border ${isContinuousMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
          {isContinuousMode ? 'Modo: Continuo Activo' : 'Modo: Control Manual Guiado'}
        </span>
      </div>
    </div>
  );
};
