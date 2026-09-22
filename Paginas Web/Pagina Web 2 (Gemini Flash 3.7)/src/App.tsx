import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SolutionData, SolutionMeta, PlaybackStatus, AnimationSpeed, MapLayoutMode, NodeDef } from './types/solution';
import { fetchSolutionsList, fetchSolutionDetail } from './lib/api';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { TourMap } from './components/TourMap';
import { CargoBay } from './components/CargoBay';
import { PlaybackControls } from './components/PlaybackControls';
import { StepExplanation } from './components/StepExplanation';
import { SolutionSelectorModal } from './components/SolutionSelectorModal';
import { DistanceMatrixModal } from './components/DistanceMatrixModal';
import { ModelFormulaModal } from './components/ModelFormulaModal';
import { NodeDetailsModal } from './components/NodeDetailsModal';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  // Solutions State
  const [solutions, setSolutions] = useState<SolutionMeta[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [currentSolution, setCurrentSolution] = useState<SolutionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Playback & Animation State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0); // 0 to 1
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const [isArrived, setIsArrived] = useState<boolean>(false);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<MapLayoutMode>('mds');

  // Modals
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);
  const [isModelOpen, setIsModelOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null);

  // Animation Loop Ref
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load available solutions from Outputs/
  const loadSolutionsList = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await fetchSolutionsList();
      setSolutions(list);
      if (list.length > 0) {
        // Default to first solution or keep currently selected if still available
        setSelectedFilename((prev) => (list.some((s) => s.filename === prev) ? prev : list[0].filename));
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSolutionsList();
  }, [loadSolutionsList]);

  // 2. Load detail of selected solution
  useEffect(() => {
    if (!selectedFilename) return;

    let isMounted = true;
    const loadDetail = async () => {
      try {
        setIsLoading(true);
        const data = await fetchSolutionDetail(selectedFilename);
        if (isMounted) {
          setCurrentSolution(data);
          setCurrentStepIndex(0);
          setProgress(0);
          setIsArrived(false);
          setPlaybackStatus('idle');
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedFilename]);

  // 3. Animation Engine
  useEffect(() => {
    if (playbackStatus !== 'playing' || !currentSolution) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = null;
      return;
    }

    const durationMs = 3200 / speed; // Travel transit time along one edge

    const stepAnimation = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        const nextProgress = prev + delta / durationMs;
        if (nextProgress >= 1) {
          // Reached destination!
          setIsArrived(true);
          return 1;
        }
        return nextProgress;
      });

      if (playbackStatus === 'playing') {
        animRef.current = requestAnimationFrame(stepAnimation);
      }
    };

    animRef.current = requestAnimationFrame(stepAnimation);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    };
  }, [playbackStatus, speed, currentSolution, currentStepIndex]);

  // Handlers
  const handleContinueJourney = useCallback(() => {
    if (!currentSolution) return;
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    if (currentStepIndex < currentSolution.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setProgress(0);
      setIsArrived(false);
    } else {
      // End of tour reached (arrived at depot)
      setPlaybackStatus('idle');
      setIsArrived(true);
    }
  }, [currentSolution, currentStepIndex]);

  // Playback handlers
  const handlePlay = () => {
    if (currentSolution && currentStepIndex >= currentSolution.steps.length - 1 && progress >= 1) {
      setCurrentStepIndex(0);
      setProgress(0);
      setIsArrived(false);
    }
    setPlaybackStatus('playing');
  };

  const handlePause = () => {
    setPlaybackStatus('paused');
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  const handlePrev = () => {
    handlePause();
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setProgress(0);
      setIsArrived(false);
    }
  };

  const handleNext = () => {
    handlePause();
    if (currentSolution && currentStepIndex < currentSolution.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setProgress(0);
      setIsArrived(false);
    }
  };

  const handleReset = () => {
    handlePause();
    setCurrentStepIndex(0);
    setProgress(0);
    setIsArrived(false);
  };

  const handleSelectStep = (idx: number) => {
    handlePause();
    setCurrentStepIndex(idx);
    setProgress(0);
    setIsArrived(false);
  };

  const currentStep = currentSolution?.steps[currentStepIndex];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Header with Solution Selector and Modals */}
      <Header
        solutions={solutions}
        selectedFilename={selectedFilename}
        onSelectSolution={setSelectedFilename}
        onOpenSelectorModal={() => setIsSelectorOpen(true)}
        onOpenModelModal={() => setIsModelOpen(true)}
        onOpenMatrixModal={() => setIsMatrixOpen(true)}
        isLoading={isLoading}
        onRefresh={loadSolutionsList}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <div>
                <strong className="block text-sm font-semibold">Error al cargar soluciones</strong>
                <span className="text-xs text-rose-300">{error}</span>
              </div>
            </div>
            <button
              onClick={loadSolutionsList}
              className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-xs font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !currentSolution && (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-medium">Cargando soluciones desde la carpeta Outputs...</p>
          </div>
        )}

        {/* Loaded Solution Dashboard */}
        {currentSolution && currentStep && (
          <>
            {/* 1. Bento Metrics Overview */}
            <MetricsOverview
              solution={currentSolution}
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
            />

            {/* 2. Elongated Cargo Bay Compartment (Full Width - No Scroll) */}
            <CargoBay
              solution={currentSolution}
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              isArrived={isArrived}
              isContinuousMode={isContinuousMode}
              speed={speed}
              onContinueJourney={handleContinueJourney}
            />

            {/* 3. Map & Step Explanation Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Route Tour Map & Controls (Col span 7) */}
              <div className="lg:col-span-7 space-y-4">
                <TourMap
                  solution={currentSolution}
                  currentStep={currentStep}
                  currentStepIndex={currentStepIndex}
                  progress={progress}
                  layoutMode={layoutMode}
                  onToggleLayoutMode={() => setLayoutMode((m) => (m === 'mds' ? 'circular' : 'mds'))}
                  onSelectNode={setSelectedNode}
                />

                {/* Playback & Step Controls */}
                <PlaybackControls
                  currentStepIndex={currentStepIndex}
                  totalSteps={currentSolution.steps.length}
                  status={playbackStatus}
                  speed={speed}
                  progress={progress}
                  isContinuousMode={isContinuousMode}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  onReset={handleReset}
                  onSelectStep={handleSelectStep}
                  onChangeSpeed={setSpeed}
                  onToggleContinuousMode={setIsContinuousMode}
                />
              </div>

              {/* Right Column: Step Explanation & Insights (Col span 5) */}
              <div className="lg:col-span-5 space-y-4">
                <StepExplanation
                  solution={currentSolution}
                  currentStep={currentStep}
                  currentStepIndex={currentStepIndex}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <SolutionSelectorModal
        solutions={solutions}
        selectedFilename={selectedFilename}
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelectSolution={(fn) => {
          setSelectedFilename(fn);
        }}
      />

      {currentSolution && (
        <>
          <DistanceMatrixModal
            solution={currentSolution}
            isOpen={isMatrixOpen}
            onClose={() => setIsMatrixOpen(false)}
          />

          <ModelFormulaModal
            isOpen={isModelOpen}
            onClose={() => setIsModelOpen(false)}
          />

          <NodeDetailsModal
            node={selectedNode}
            solution={currentSolution}
            isOpen={selectedNode !== null}
            onClose={() => setSelectedNode(null)}
          />
        </>
      )}

      {/* Subtle Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 px-4 py-4 mt-8 text-center text-xs text-zinc-400 font-mono">
        TSPPD-H Visualizer (Página Web 2) &middot; Optimización con Gurobi &middot; Formulación LIFO de Manejo de Cargas
      </footer>
    </div>
  );
};
export default App;
