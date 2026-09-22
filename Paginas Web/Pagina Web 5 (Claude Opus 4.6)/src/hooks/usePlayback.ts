import { useState, useEffect, useCallback, useRef } from 'react';
import { Solution, AnimationPhase } from '../types/solution';

export function usePlayback(solution: Solution | null) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [phaseProgress, setPhaseProgress] = useState<number>(0);

  const timeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  
  const stepRef = useRef(currentStep);
  const phaseRef = useRef(phase);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  
  useEffect(() => { stepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const updateProgress = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    
    if (durationRef.current > 0) {
      const progress = Math.min(Math.max(elapsed / durationRef.current, 0), 1);
      setPhaseProgress(progress);
    } else {
      setPhaseProgress(1);
    }

    if (elapsed < durationRef.current) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  // Forward declaration for nextTick
  const nextTickRef = useRef<() => void>(() => {});

  const executePhase = useCallback((nextPhase: AnimationPhase, duration: number) => {
    setPhase(nextPhase);
    setPhaseProgress(0);
    startTimeRef.current = 0;
    durationRef.current = duration;
    
    clearTimers();
    
    if (duration > 0) {
      rafRef.current = requestAnimationFrame(updateProgress);
      timeoutRef.current = window.setTimeout(() => nextTickRef.current(), duration);
    } else {
      setPhaseProgress(1);
      nextTickRef.current();
    }
  }, [clearTimers, updateProgress]);

  const nextTick = useCallback(() => {
    if (!solution || !isPlayingRef.current) return;
    
    const stepIdx = stepRef.current;
    if (stepIdx >= solution.steps.length) {
      setIsPlaying(false);
      setPhase('idle');
      return;
    }
    
    const step = solution.steps[stepIdx];
    const p = phaseRef.current;
    const spd = speedRef.current;
    
    if (p === 'idle') {
      executePhase('moving', 2000 / spd);
    } else if (p === 'moving') {
      if (step.handlingCount > 0) executePhase('handling-out', Math.min(400 * step.handlingCount / spd, 3000));
      else if (step.deliverA > 0) executePhase('unloading-alpha', Math.min(400 * step.deliverA / spd, 3000));
      else if (step.pickupB > 0) executePhase('loading-beta', Math.min(400 * step.pickupB / spd, 3000));
      else executePhase('step-complete', 800 / spd);
    } else if (p === 'handling-out') {
      if (step.deliverA > 0) executePhase('unloading-alpha', Math.min(400 * step.deliverA / spd, 3000));
      else executePhase('handling-back', Math.min(400 * step.handlingCount / spd, 3000));
    } else if (p === 'unloading-alpha') {
      if (step.handlingCount > 0) executePhase('handling-back', Math.min(400 * step.handlingCount / spd, 3000));
      else if (step.pickupB > 0) executePhase('loading-beta', Math.min(400 * step.pickupB / spd, 3000));
      else executePhase('step-complete', 800 / spd);
    } else if (p === 'handling-back') {
      if (step.pickupB > 0) executePhase('loading-beta', Math.min(400 * step.pickupB / spd, 3000));
      else executePhase('step-complete', 800 / spd);
    } else if (p === 'loading-beta') {
      executePhase('step-complete', 800 / spd);
    } else if (p === 'step-complete') {
      if (stepIdx + 1 < solution.steps.length) {
        setCurrentStep(stepIdx + 1);
        executePhase('moving', 2000 / spd);
      } else {
        setIsPlaying(false);
        setPhase('idle');
      }
    }
  }, [solution, executePhase]);

  useEffect(() => {
    nextTickRef.current = nextTick;
  }, [nextTick]);

  const play = useCallback(() => {
    if (!isPlayingRef.current && solution) {
      setIsPlaying(true);
      isPlayingRef.current = true;
      if (phaseRef.current === 'idle' || phaseRef.current === 'step-complete') {
         if (phaseRef.current === 'step-complete' && stepRef.current >= solution.steps.length - 1) {
            setCurrentStep(0);
            stepRef.current = 0;
            setPhase('idle');
            phaseRef.current = 'idle';
         } else if (phaseRef.current === 'step-complete') {
            setCurrentStep(stepRef.current + 1);
            stepRef.current += 1;
            setPhase('idle');
            phaseRef.current = 'idle';
         }
      }
      nextTick();
    }
  }, [solution, nextTick]);
  
  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimers();
  }, [clearTimers]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    clearTimers();
    setCurrentStep(0);
    setPhase('idle');
    setPhaseProgress(0);
  }, [clearTimers]);

  const jumpToStartOfStep = useCallback((n: number) => {
    if (!solution) return;
    const target = Math.max(0, Math.min(n, solution.steps.length - 1));
    clearTimers();
    setCurrentStep(target);
    setPhase('moving');
    setPhaseProgress(0);
    
    stepRef.current = target;
    phaseRef.current = 'moving';
    
    if (isPlayingRef.current) {
      // Tick from 'moving' phase to continue animation
      setTimeout(() => {
        executePhase('moving', 2000 / speedRef.current);
      }, 0);
    }
  }, [solution, clearTimers, executePhase]);

  const nextStep = useCallback(() => jumpToStartOfStep(stepRef.current + 1), [jumpToStartOfStep]);
  const prevStep = useCallback(() => jumpToStartOfStep(stepRef.current - 1), [jumpToStartOfStep]);
  const goToStep = useCallback((n: number) => jumpToStartOfStep(n), [jumpToStartOfStep]);

  useEffect(() => {
    reset();
  }, [solution, reset]);

  return {
    currentStep,
    phase,
    isPlaying,
    speed,
    play,
    pause,
    reset,
    nextStep,
    prevStep,
    goToStep,
    setSpeed,
    phaseProgress
  };
}
