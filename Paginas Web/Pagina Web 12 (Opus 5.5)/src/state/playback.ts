/**
 * Máquina de estados de la reproducción, como funciones puras (probadas en
 * scripts/validate-playback.ts). SimulationProvider solo las orquesta con
 * requestAnimationFrame y temporizadores.
 */
import type { PlaybackStatus } from '../types/solution';

export interface PlaybackState {
  stepIndex: number;
  /** Avance 0–1 del tramo steps[stepIndex] (from → to). */
  progress: number;
  /** true = detenido en steps[stepIndex].to ejecutando fases. */
  arrived: boolean;
  subStep: number;
  finished: boolean;
  status: PlaybackStatus;
  /** Tras "Continuar ruta" manual: pausar al llegar a la siguiente parada. */
  stopAtArrival: boolean;
}

export interface PlaybackEnv {
  lastStep: number;
  /** Número de fases de cada parada. */
  phaseCounts: number[];
  continuous: boolean;
}

export const START: PlaybackState = {
  stepIndex: 0,
  progress: 0,
  arrived: false,
  subStep: 0,
  finished: false,
  status: 'idle',
  stopAtArrival: false,
};

const lastPhase = (env: PlaybackEnv, k: number) => Math.max(0, (env.phaseCounts[k] ?? 1) - 1);
const clampStep = (env: PlaybackEnv, k: number) => Math.max(0, Math.min(k, env.lastStep));

/** Avanza el tránsito `delta` ms sobre un tramo de `duration` ms. */
export function tick(s: PlaybackState, delta: number, duration: number, env: PlaybackEnv): PlaybackState {
  if (s.status !== 'playing' || s.arrived || s.finished) return s;
  const progress = s.progress + delta / duration;
  if (progress < 1) return { ...s, progress };
  const pause = !env.continuous || s.stopAtArrival;
  return { ...s, progress: 1, arrived: true, subStep: 0, status: pause ? 'paused' : 'playing', stopAtArrival: false };
}

/** Fin del temporizador de la fase (k, j) en reproducción automática. */
export function autoAdvance(s: PlaybackState, k: number, j: number, env: PlaybackEnv): PlaybackState {
  if (s.stepIndex !== k || s.subStep !== j || s.status !== 'playing' || !s.arrived || s.finished) return s;
  if (j < lastPhase(env, k)) return { ...s, subStep: j + 1 };
  if (k < env.lastStep) return { ...s, stepIndex: k + 1, progress: 0, arrived: false, subStep: 0 };
  return { ...s, finished: true, status: 'idle' };
}

/** "Continuar ruta": sale de la parada actual hacia la siguiente. */
export function continueJourney(s: PlaybackState, env: PlaybackEnv): PlaybackState {
  if (s.finished) return s;
  if (!s.arrived) return { ...s, status: 'playing', stopAtArrival: true };
  if (s.stepIndex < env.lastStep) {
    const keepFlowing = s.status === 'playing' && env.continuous;
    return { ...s, stepIndex: s.stepIndex + 1, progress: 0, arrived: false, subStep: 0, status: 'playing', stopAtArrival: !keepFlowing };
  }
  return { ...s, subStep: lastPhase(env, s.stepIndex), finished: true, status: 'idle' };
}

export function play(s: PlaybackState): PlaybackState {
  if (s.finished) return { ...START, status: 'playing' };
  return { ...s, status: 'playing', stopAtArrival: false };
}

export function pause(s: PlaybackState): PlaybackState {
  return s.status === 'playing' ? { ...s, status: 'paused' } : s;
}

export function toggle(s: PlaybackState): PlaybackState {
  return s.status === 'playing' ? pause(s) : play(s);
}

export function prevStop(s: PlaybackState, env: PlaybackEnv): PlaybackState {
  if (s.stepIndex === 0 && !s.finished) return { ...START };
  const k = s.finished ? s.stepIndex : s.stepIndex - 1;
  return { ...s, stepIndex: clampStep(env, k), progress: 1, arrived: true, subStep: 0, finished: false, status: 'paused', stopAtArrival: false };
}

export function nextStop(s: PlaybackState, env: PlaybackEnv): PlaybackState {
  if (s.finished) return s;
  if (!s.arrived) return { ...s, progress: 1, arrived: true, subStep: 0, status: 'paused', stopAtArrival: false };
  if (s.stepIndex < env.lastStep)
    return { ...s, stepIndex: s.stepIndex + 1, progress: 1, arrived: true, subStep: 0, status: 'paused', stopAtArrival: false };
  return s;
}

export function selectStep(s: PlaybackState, k: number, env: PlaybackEnv): PlaybackState {
  return { ...s, stepIndex: clampStep(env, k), progress: 1, arrived: true, subStep: 0, finished: false, status: 'paused', stopAtArrival: false };
}

export function seek(s: PlaybackState, k: number, p: number, env: PlaybackEnv): PlaybackState {
  const stepIndex = clampStep(env, k);
  const base = { ...s, stepIndex, finished: false, stopAtArrival: false, subStep: 0 };
  if (p >= 1) return { ...base, progress: 1, arrived: true, status: 'paused' };
  if (p <= 0 && stepIndex === 0) return { ...START };
  return { ...base, progress: Math.max(0, p), arrived: false, status: 'paused' };
}

export function setSubStep(s: PlaybackState, j: number, env: PlaybackEnv): PlaybackState {
  return {
    ...s,
    arrived: true,
    progress: 1,
    subStep: Math.max(0, Math.min(j, lastPhase(env, s.stepIndex))),
    finished: false,
    status: 'paused',
    stopAtArrival: false,
  };
}

export function nextSubStep(s: PlaybackState, env: PlaybackEnv): PlaybackState {
  if (s.finished) return s;
  if (!s.arrived) return { ...s, arrived: true, progress: 1, subStep: 0, status: 'paused', stopAtArrival: false };
  if (s.subStep < lastPhase(env, s.stepIndex)) return { ...s, subStep: s.subStep + 1, status: 'paused' };
  return continueJourney({ ...s, status: 'paused' }, env);
}

export function prevSubStep(s: PlaybackState, env: PlaybackEnv): PlaybackState {
  if (s.finished) return { ...s, finished: false, status: 'paused' };
  if (s.arrived && s.subStep > 0) return { ...s, subStep: s.subStep - 1, status: 'paused' };
  if (s.stepIndex === 0) return { ...START };
  const k = s.stepIndex - 1;
  return { ...s, stepIndex: k, arrived: true, progress: 1, subStep: lastPhase(env, k), status: 'paused', stopAtArrival: false };
}
