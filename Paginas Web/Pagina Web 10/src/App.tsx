import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SolutionData,
  SolutionMeta,
  PlaybackStatus,
  AnimationSpeed,
  NodeDef,
} from './types/solution';
import { fetchSolutionsList, fetchSolutionDetail } from './lib/api';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { RouteCanvas } from './components/RouteCanvas';
import { LifoCargoBay } from './components/LifoCargoBay';
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

  // Modals
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);
  const [isModelOpen, setIsModelOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null);

  // Animation Loop Ref
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // 1. Load solutions list from Outputs/
  const loadSolutionsList = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await fetchSolutionsList();
      setSolutions(list);
      if (list.length > 0) {
        setSelectedFilename((prev) => (list.some((s) => s.filename === prev) ? prev : list[0].filename));
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor para leer Outputs/');
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

  // 3. Animation Engine for truck traversal along the arc
  useEffect(() => {
    if (playbackStatus !== 'playing' || !currentSolution || isArrived) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = null;
      return;
    }

    const durationMs = 3200 / speed; // Travel transit time along the edge

    const stepAnimation = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        const nextProgress = prev + delta / durationMs;
        if (nextProgress >= 1) {
          // Reached destination node!
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
    };
  }, [playbackStatus, speed, currentSolution, currentStepIndex, isArrived]);

  // Handler to proceed to the next leg of the tour
  const handleContinueJourney = useCallback(() => {
    if (!currentSolution) return;
    if (currentStepIndex < currentSolution.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setProgress(0);
      setIsArrived(false);
    } else {
      // Tour completed!
      setPlaybackStatus('idle');
      setIsArrived(true);
    }
  }, [currentSolution, currentStepIndex]);

  // Playback Control Handlers
  const handlePlay = () => {
    if (currentSolution && currentStepIndex >= currentSolution.steps.length - 1 && isArrived) {
      setCurrentStepIndex(0);
      setProgress(0);
      setIsArrived(false);
    }
    setPlaybackStatus('playing');
  };

  const handlePause = () => {
    setPlaybackStatus('paused');
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
      {/* Header with quick selector & modals */}
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
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <div>
                <strong className="block text-sm font-semibold">Error al cargar soluciones</strong>
                <span className="text-xs text-rose-300">{error}</span>
              </div>
            </div>
            <button
              onClick={loadSolutionsList}
              className="px-3 py-1.5 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-xs font-semibold cursor-pointer transition-all"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !currentSolution && (
          <div className="py-28 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-mono font-medium">Cargando soluciones óptimas desde Outputs/...</p>
          </div>
        )}

        {/* Loaded Solution Workspace */}
        {currentSolution && currentStep && (
          <>
            {/* 1. Bento Metrics Overview */}
            <MetricsOverview
              solution={currentSolution}
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
            />

            {/* 2. LIFO Cargo Bay Compartment (Design of Pagina Web 3 + Sub-step Functionality of Pagina Web 2) */}
            <LifoCargoBay
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
              {/* Left Column: Route Canvas (Map based on Pagina Web 5) & Controls (Col span 7) */}
              <div className="lg:col-span-7 space-y-4">
                <RouteCanvas
                  solution={currentSolution}
                  currentStepIndex={currentStepIndex}
                  progress={progress}
                  isArrived={isArrived}
                  onSelectNode={setSelectedNode}
                />

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

              {/* Right Column: Step Explanation & Logistics Detail (Col span 5) */}
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
      <footer className="border-t border-zinc-900 bg-zinc-950/80 px-4 py-4 mt-8 text-center text-xs text-zinc-500 font-mono">
        TSPPD-H Visualizer (Página Web 10) &middot; Visualización de Soluciones Gurobi &middot; Formulación LIFO
      </footer>
    </div>
  );
};

export default App;
