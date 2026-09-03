import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Solution, SolutionSummary, CargoSubPhase } from './types/tsppd';
import { Header } from './components/Header';
import { NetworkMap } from './components/NetworkMap';
import { LifoCargoBay } from './components/LifoCargoBay';
import { PlaybackControls } from './components/PlaybackControls';
import { StepExplainer } from './components/StepExplainer';
import { InstanceStats } from './components/InstanceStats';
import { Loader2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [solutions, setSolutions] = useState<SolutionSummary[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [subPhase, setSubPhase] = useState<CargoSubPhase>('arrival');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(0.5); // Default to slow (0.5x) for clarity
  const [travelProgress, setTravelProgress] = useState<number>(1); // 1 = at destination

  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const travelAnimRef = useRef<number | null>(null);

  // 1. Fetch available solutions list from server
  const fetchSolutions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/solutions');
      const data = await res.json();
      if (data.success && data.solutions.length > 0) {
        setSolutions(data.solutions);
        // If current filename is not in list, select first
        if (!selectedFilename || !data.solutions.some((s: SolutionSummary) => s.filename === selectedFilename)) {
          setSelectedFilename(data.solutions[0].filename);
        }
      } else {
        setError('No se encontraron archivos de solución válidos en la carpeta Outputs/.');
      }
    } catch (err: any) {
      setError(`Error conectando con el backend: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFilename]);

  useEffect(() => {
    fetchSolutions();
  }, []);

  // 2. Fetch selected solution detail
  useEffect(() => {
    if (!selectedFilename) return;

    const loadDetail = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/solutions/${encodeURIComponent(selectedFilename)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setSelectedSolution(data.data);
          setCurrentStepIndex(0);
          setSubPhase('arrival');
          setTravelProgress(1);
          setIsPlaying(false);
        } else {
          setError(data.error || 'Error al cargar la solución seleccionada');
        }
      } catch (err: any) {
        setError(`Error al obtener solución: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadDetail();
  }, [selectedFilename]);

  // 3. Main Playback Engine
  useEffect(() => {
    if (!isPlaying || !selectedSolution) {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (travelAnimRef.current) cancelAnimationFrame(travelAnimRef.current);
      return;
    }

    const currentStep = selectedSolution.steps[currentStepIndex];
    if (!currentStep) return;

    const hasHandling = currentStep.handlingCount > 0;
    const hasAlpha = currentStep.deliverA > 0;
    const hasBeta = currentStep.pickupB > 0;

    // Phase duration scaled by user speed setting
    const baseDuration = 1800 / speed;

    if (travelProgress < 1) {
      // Animate truck traveling along arc
      const startTime = performance.now();
      const travelDuration = 2200 / speed;

      const animateTravel = (now: number) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / travelDuration);
        setTravelProgress(p);

        if (p < 1) {
          travelAnimRef.current = requestAnimationFrame(animateTravel);
        } else {
          // Arrived! Update cargo simulator state immediately
          setSubPhase('arrival');
        }
      };

      travelAnimRef.current = requestAnimationFrame(animateTravel);
      return () => {
        if (travelAnimRef.current) cancelAnimationFrame(travelAnimRef.current);
      };
    }

    // When at destination (travelProgress === 1), slowly step through the sub-phases
    animTimerRef.current = setTimeout(() => {
      if (subPhase === 'arrival') {
        setSubPhase(hasHandling ? 'handling' : hasAlpha ? 'delivery' : hasBeta ? 'pickup' : 'ready');
      } else if (subPhase === 'handling') {
        setSubPhase(hasAlpha ? 'delivery' : 'reload');
      } else if (subPhase === 'delivery') {
        setSubPhase(hasHandling ? 'reload' : hasBeta ? 'pickup' : 'ready');
      } else if (subPhase === 'reload') {
        setSubPhase(hasBeta ? 'pickup' : 'ready');
      } else if (subPhase === 'pickup') {
        setSubPhase('ready');
      } else if (subPhase === 'ready') {
        // Step completed! Advance to next step
        if (currentStepIndex < selectedSolution.steps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
          setTravelProgress(0);
          setSubPhase('arrival');
        } else {
          // Finished entire tour!
          setIsPlaying(false);
        }
      }
    }, baseDuration);

    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [isPlaying, currentStepIndex, subPhase, travelProgress, selectedSolution, speed]);

  // Step Controls Handlers
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handlePrevStep = () => {
    setIsPlaying(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setTravelProgress(1);
      setSubPhase('arrival');
    }
  };

  const handleNextStep = () => {
    setIsPlaying(false);
    if (selectedSolution && currentStepIndex < selectedSolution.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setTravelProgress(1);
      setSubPhase('arrival');
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setTravelProgress(1);
    setSubPhase('arrival');
  };

  const handleSelectStep = (index: number) => {
    setIsPlaying(false);
    setCurrentStepIndex(index);
    setTravelProgress(1);
    setSubPhase('arrival');
  };

  const handleReplayStep = () => {
    setIsPlaying(true);
    setTravelProgress(0);
    setSubPhase('arrival');
  };

  // Keyboard shortcut listener (Space = play/pause, Arrows = steps)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        handlePrevStep();
      } else if (e.code === 'ArrowRight') {
        handleNextStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevStep, handleNextStep, handleTogglePlay]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Top Header */}
      <Header
        solutions={solutions}
        selectedSolution={selectedSolution}
        selectedFilename={selectedFilename}
        onSelectSolution={setSelectedFilename}
        onRefresh={fetchSolutions}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        
        {/* Error Alert if any */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center gap-3 text-sm text-rose-200 shadow-md">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              onClick={fetchSolutions}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading Spinner State */}
        {isLoading && !selectedSolution ? (
          <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-medium">Cargando soluciones de la carpeta Outputs/...</p>
          </div>
        ) : selectedSolution ? (
          <>
            {/* Top Grid: Left = 2D Map Canvas, Right = Step Explainer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* 2D Topological Map (7 cols) */}
              <div className="lg:col-span-7 flex flex-col">
                <NetworkMap
                  solution={selectedSolution}
                  currentStepIndex={currentStepIndex}
                  travelProgress={travelProgress}
                  onSelectStep={handleSelectStep}
                />
              </div>

              {/* Step Explainer & Real-time Metrics (5 cols) */}
              <div className="lg:col-span-5 flex flex-col">
                <StepExplainer
                  solution={selectedSolution}
                  currentStepIndex={currentStepIndex}
                />
              </div>

            </div>

            {/* Middle Centerpiece: LIFO Cargo Bay Simulator */}
            <LifoCargoBay
              solution={selectedSolution}
              currentStepIndex={currentStepIndex}
              subPhase={subPhase}
              onSelectSubPhase={setSubPhase}
              speed={speed}
            />

            {/* Bottom Playback Bar */}
            <PlaybackControls
              solution={selectedSolution}
              currentStepIndex={currentStepIndex}
              isPlaying={isPlaying}
              speed={speed}
              onTogglePlay={handleTogglePlay}
              onPrevStep={handlePrevStep}
              onNextStep={handleNextStep}
              onReset={handleReset}
              onSetSpeed={setSpeed}
              onSelectStep={handleSelectStep}
              onReplayStep={handleReplayStep}
            />

            {/* Bottom Section: Instance Statistics & Demand Table */}
            <InstanceStats
              solution={selectedSolution}
              currentStepIndex={currentStepIndex}
            />
          </>
        ) : null}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-6 text-center text-xs text-zinc-500 bg-zinc-950/80">
        TSPPD-H Visualizer (Página Web 3) · Optimización Combinatoria de Ruteo con Entregas, Recolecciones y Manipulación LIFO
      </footer>

    </div>
  );
};
