import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Zap, Gauge, Layers } from 'lucide-react';
import { PlaybackStatus, AnimationSpeed, SolutionData } from '../types/solution';
import { getStepPolicyNumber } from '../lib/policyUtils';
import { cn } from '../lib/cn';

interface PlaybackControlsProps {
  currentStepIndex: number;
  totalSteps: number;
  solution?: SolutionData;
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
  className?: string;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentStepIndex,
  totalSteps,
  solution,
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
  className,
}) => {
  const isPlaying = status === 'playing';
  const isPolicy3 = solution?.model === 'TSPPD-H_3';
  const currentStep = solution?.steps[currentStepIndex];
  const isDepotStep = currentStep?.to === 0;
  const currentStepPolicy = getStepPolicyNumber(currentStep);

  return (
    <div className={cn("rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-3 flex flex-col gap-2.5 shadow-xl", className)}>
      {/* Top Row: Playback Buttons & Speeds */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Main media buttons */}
        <div className="flex items-center gap-1.5">
          {/* Reset */}
          <button
            onClick={onReset}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-xs"
            title="Reiniciar al paso 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Prev */}
          <button
            onClick={onPrev}
            disabled={currentStepIndex === 0}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-xs"
            title="Paso anterior"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause / Iniciar */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 shadow-emerald-500/25'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>{currentStepIndex === 0 && !isArrived && progress === 0 ? 'Iniciar Ruta' : 'Reanudar'}</span>
              </>
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            disabled={currentStepIndex >= totalSteps - 1}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-xs"
            title="Siguiente paso"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Controls & Continuous Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 text-xs font-mono">
            <span className="text-[10px] text-zinc-500 px-1.5 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              Vel:
            </span>
            {([0.5, 1, 1.5, 2] as AnimationSpeed[]).map((s) => (
              <button
                key={`speed-${s}`}
                onClick={() => onChangeSpeed(s)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] transition-all cursor-pointer ${
                  speed === s
                    ? 'bg-zinc-800 text-emerald-400 font-bold border border-zinc-700 shadow-xs'
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer border ${
              isContinuousMode
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-xs'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Avanzar automáticamente por los 4 sub-pasos y continuar al siguiente cliente"
          >
            <Zap className={`w-3 h-3 ${isContinuousMode ? 'text-emerald-400 fill-emerald-400' : 'text-zinc-500'}`} />
            <span>Continuo {isContinuousMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Step Timeline Pills & Transit Progress Bar */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Progreso:</span>
          <span>Paso {currentStepIndex + 1} de {totalSteps}</span>
        </div>

        {/* Dynamic Policy 3 Active Step Indicator Bar (Ultra compact, no verbose text) */}
        {isPolicy3 && currentStep && (
          <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
                <Layers className="w-3 h-3 text-teal-400" />
                Pol. 3:
              </span>
              {isDepotStep ? (
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-medium">
                  Depósito
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                  currentStepPolicy === 1
                    ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                    : 'bg-sky-500/20 text-sky-200 border-sky-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStepPolicy === 1 ? 'bg-purple-400' : 'bg-sky-400'}`} />
                  <span>Cliente {currentStep.to}: P{currentStepPolicy} ({currentStepPolicy === 1 ? 's=1' : 's=0'})</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="text-purple-300 font-semibold">P1 (s=1)</span>
              <span>·</span>
              <span className="text-sky-300 font-semibold">P2 (s=0)</span>
            </div>
          </div>
        )}

        {/* Step Selector Buttons */}
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
          {Array.from({ length: totalSteps }, (_, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPast = idx < currentStepIndex;
            const stepItem = solution?.steps[idx];
            const isStepDepot = stepItem ? stepItem.to === 0 : false;
            const stepPolicyNum = getStepPolicyNumber(stepItem);

            return (
              <button
                key={`timeline-step-${idx}`}
                data-step-btn={idx + 1}
                onClick={() => onSelectStep(idx)}
                className={`rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                  isPolicy3 ? 'h-8 py-0.5' : 'h-6.5'
                } ${
                  isCurrent
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-sm'
                    : isPast
                    ? 'bg-zinc-800/80 text-emerald-400 border-zinc-700 hover:bg-zinc-800'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60'
                }`}
                title={
                  isPolicy3 && stepItem
                    ? isStepDepot
                      ? `Paso ${idx + 1}: Retorno al Depósito`
                      : `Paso ${idx + 1}: Cliente ${stepItem.to} → Política ${stepPolicyNum} (${stepPolicyNum === 1 ? 'Compuerta LIFO' : 'Reubicación al Frente'})`
                    : `Paso ${idx + 1}`
                }
              >
                <span className={isPolicy3 ? 'text-[10px] leading-tight' : 'text-xs'}>{idx + 1}</span>
                {isPolicy3 && (
                  <span
                    className={`text-[8px] font-mono font-extrabold uppercase px-1 rounded-[3px] leading-none ${
                      isCurrent
                        ? isStepDepot
                          ? 'bg-zinc-900/30 text-zinc-900'
                          : stepPolicyNum === 1
                          ? 'bg-purple-950 text-purple-200'
                          : 'bg-sky-950 text-sky-200'
                        : isStepDepot
                        ? 'text-zinc-500'
                        : stepPolicyNum === 1
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    }`}
                  >
                    {isStepDepot ? 'DEP' : `P${stepPolicyNum}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
