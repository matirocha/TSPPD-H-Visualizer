import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SolutionData,
  SolutionMeta,
  PlaybackStatus,
  AnimationSpeed,
  NodeDef,
  ModelType,
} from './types/solution';
import { fetchSolutionsList, fetchSolutionDetail } from './lib/api';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { RouteCanvas } from './components/RouteCanvas';
import { LifoCargoBay } from './components/LifoCargoBay';
import { SolutionSelectorModal } from './components/SolutionSelectorModal';
import { NodeDetailsModal } from './components/NodeDetailsModal';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  // Solutions & Model State
  const [solutions, setSolutions] = useState<SolutionMeta[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [activeModel, setActiveModel] = useState<ModelType>('TSPPD-H');
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
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null);

  // Animation Loop Ref
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Handler to switch active model and automatically match the current instance ID
  const handleSelectModel = useCallback(
    (newModel: ModelType) => {
      setActiveModel(newModel);
      const targetId = currentSolution ? currentSolution.instanceId : 1;
      const matchingSolution = solutions.find(
        (s) => (s.model || 'TSPPD-H') === newModel && s.instanceId === targetId
      );
      if (matchingSolution) {
        setSelectedFilename(matchingSolution.filename);
      } else {
        const firstMatch = solutions.find((s) => (s.model || 'TSPPD-H') === newModel);
        if (firstMatch) setSelectedFilename(firstMatch.filename);
      }
    },
    [currentSolution, solutions]
  );

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
          if (data.model && data.model !== activeModel) {
            setActiveModel(data.model);
          }
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
      lastTimeRef.current = null;
      if (!isContinuousMode || playbackStatus !== 'playing') {
        setPlaybackStatus('paused');
      }
    } else {
      // Tour completed!
      setPlaybackStatus('idle');
      setIsArrived(true);
      setProgress(1);
    }
  }, [currentSolution, currentStepIndex, isContinuousMode, playbackStatus]);

  // Playback Control Handlers
  const handlePlay = () => {
    if (!currentSolution) return;
    // If tour was finished, restart from depot
    if (currentStepIndex >= currentSolution.steps.length - 1 && isArrived) {
      setCurrentStepIndex(0);
      setProgress(0);
      setIsArrived(false);
      lastTimeRef.current = null;
      setPlaybackStatus('playing');
      return;
    }
    // If at depot initial state, start route towards first customer
    if (currentStepIndex === 0 && !isArrived && progress === 0) {
      lastTimeRef.current = null;
      setPlaybackStatus('playing');
      return;
    }
    lastTimeRef.current = null;
    setPlaybackStatus('playing');
  };

  const handlePause = () => {
    setPlaybackStatus('paused');
    if (animRef.current) cancelAnimationFrame(animRef.current);
    lastTimeRef.current = null;
  };

  const handlePrev = () => {
    handlePause();
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setProgress(1);
      setIsArrived(true);
    } else {
      setProgress(0);
      setIsArrived(false);
    }
  };

  const handleNext = () => {
    handlePause();
    if (currentSolution && currentStepIndex < currentSolution.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setProgress(1);
      setIsArrived(true);
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
    setProgress(1);
    setIsArrived(true);
  };

  const currentStep = currentSolution?.steps[currentStepIndex];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Header with quick selector & modals */}
      <Header
        solutions={solutions}
        selectedFilename={selectedFilename}
        activeModel={activeModel}
        onSelectModel={handleSelectModel}
        onSelectSolution={setSelectedFilename}
        onOpenSelectorModal={() => setIsSelectorOpen(true)}
        isLoading={isLoading}
        onRefresh={loadSolutionsList}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 py-3 lg:px-6 lg:py-3.5 space-y-3">
        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex items-center justify-between shadow-lg">
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
            {/* 1. Bento Metrics Overview (Barra HUD Compacta) */}
            <MetricsOverview
              solution={currentSolution}
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
            />

            {/* 2. Command Center: Dual Panel for simultaneous Map & Cargo Bay visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* Left Column (lg:col-span-6): Network Route Map with Integrated Playback */}
              <div className="lg:col-span-6">
                <RouteCanvas
                  solution={currentSolution}
                  currentStepIndex={currentStepIndex}
                  progress={progress}
                  isArrived={isArrived}
                  playbackStatus={playbackStatus}
                  speed={speed}
                  isContinuousMode={isContinuousMode}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  onReset={handleReset}
                  onSelectStep={handleSelectStep}
                  onChangeSpeed={setSpeed}
                  onToggleContinuousMode={setIsContinuousMode}
                  onSelectNode={setSelectedNode}
                />
              </div>

              {/* Right Column (lg:col-span-6): Compact LIFO Cargo Bay & Pequeña Explicación Inferior */}
              <div className="lg:col-span-6">
                <LifoCargoBay
                  solution={currentSolution}
                  currentStep={currentStep}
                  currentStepIndex={currentStepIndex}
                  isArrived={isArrived}
                  playbackStatus={playbackStatus}
                  isContinuousMode={isContinuousMode}
                  speed={speed}
                  onContinueJourney={handleContinueJourney}
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
        activeModel={activeModel}
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelectSolution={(fn) => {
          setSelectedFilename(fn);
          const picked = solutions.find((s) => s.filename === fn);
          if (picked?.model && picked.model !== activeModel) {
            setActiveModel(picked.model);
          }
          setIsSelectorOpen(false);
        }}
      />

      {currentSolution && (
        <NodeDetailsModal
          node={selectedNode}
          solution={currentSolution}
          isOpen={selectedNode !== null}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

export default App;
