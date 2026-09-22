import { useState, useEffect, useRef, useCallback } from "react";
import { SolutionData, SolutionSummary, OperationPhase } from "@/types/tsppd";
import { Header } from "@/components/Header";
import { SolutionSelector } from "@/components/SolutionSelector";
import { RouteCanvas } from "@/components/RouteCanvas";
import { CargoCompartment } from "@/components/CargoCompartment";
import { StepPlayer } from "@/components/StepPlayer";
import { StepTimeline } from "@/components/StepTimeline";
import { HandlingInspector } from "@/components/HandlingInspector";
import { CostBreakdown } from "@/components/CostBreakdown";
import { Loader2, AlertCircle } from "lucide-react";

export function App() {
  const [solutions, setSolutions] = useState<SolutionSummary[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [solution, setSolution] = useState<SolutionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);

  // Animation and Playback State
  const [currentStep, setCurrentStep] = useState<number>(-1); // -1 = Initial Depot State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [truckProgress, setTruckProgress] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [operationPhase, setOperationPhase] = useState<OperationPhase>("IDLE");

  const animFrameRef = useRef<number | null>(null);
  const phaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

  const currentStepRef = useRef<number>(currentStep);
  currentStepRef.current = currentStep;

  // 1. Fetch available solutions from API
  const fetchSolutions = async (autoSelectFirst = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/solutions");
      const json = await res.json();
      if (json.success && json.solutions) {
        setSolutions(json.solutions);
        if (json.solutions.length > 0 && autoSelectFirst && !selectedFilename) {
          const defaultSol = json.solutions[0].filename;
          setSelectedFilename(defaultSol);
          loadSolutionData(defaultSol);
        }
      } else {
        setError(json.error || "No se pudieron obtener las soluciones.");
      }
    } catch (err: any) {
      setError("Error de conexión al servidor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch specific solution content
  const loadSolutionData = async (filename: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/solutions/${encodeURIComponent(filename)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSolution(json.data);
        setSelectedFilename(filename);
        resetPlayback();
      } else {
        alert("Error cargando solución: " + json.error);
      }
    } catch (err: any) {
      alert("Error de red: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolutions(true);
  }, []);

  const clearAllTimeouts = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
  };

  const resetPlayback = useCallback(() => {
    clearAllTimeouts();
    setIsPlaying(false);
    setIsAnimating(false);
    setTruckProgress(0);
    setCurrentStep(-1);
    setOperationPhase("IDLE");
  }, []);

  // 3. Multi-phase step animation:
  // Traveling -> Handling Unload (if any) -> Deliver A (if any) -> Handling Reload (if any) -> Pickup B (if any) -> Finished
  const playStepPhases = useCallback(
    (stepIdx: number, onStepEnd?: () => void) => {
      clearAllTimeouts();
      if (!solution || stepIdx < 0 || stepIdx >= solution.steps.length) return;

      const step = solution.steps[stepIdx];
      setCurrentStep(stepIdx);
      setIsAnimating(true);
      setTruckProgress(0);
      setOperationPhase("TRAVELING");

      const travelDuration = 1500 / speedRef.current;
      const subphaseDuration = 900 / speedRef.current;
      const startTime = performance.now();

      // Part A: Transit on edge
      const transitLoop = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / travelDuration, 1);
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        setTruckProgress(eased);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(transitLoop);
        } else {
          // Arrived at destination node!
          setTruckProgress(1);
          setIsAnimating(false);
          executeArrivalPhases(step, subphaseDuration, onStepEnd);
        }
      };

      animFrameRef.current = requestAnimationFrame(transitLoop);
    },
    [solution]
  );

  const executeArrivalPhases = (
    step: any,
    subphaseDuration: number,
    onStepEnd?: () => void
  ) => {
    const hasHandling = step.handlingCount > 0;
    const hasDeliver = step.deliverA > 0;
    const hasPickup = step.pickupB > 0;

    // Sequence builder
    const phaseSequence: { phase: OperationPhase; duration: number }[] = [];

    if (hasHandling) {
      phaseSequence.push({ phase: "HANDLING_UNLOAD", duration: subphaseDuration });
    }
    if (hasDeliver) {
      phaseSequence.push({ phase: "DELIVERING_A", duration: subphaseDuration });
    }
    if (hasHandling) {
      phaseSequence.push({ phase: "HANDLING_RELOAD", duration: subphaseDuration });
    }
    if (hasPickup) {
      phaseSequence.push({ phase: "PICKING_UP_B", duration: subphaseDuration });
    }
    phaseSequence.push({ phase: "FINISHED_STEP", duration: 700 / speedRef.current });

    let phaseIndex = 0;

    const runNextPhase = () => {
      if (phaseIndex < phaseSequence.length) {
        const item = phaseSequence[phaseIndex];
        setOperationPhase(item.phase);
        phaseIndex++;
        phaseTimeoutRef.current = setTimeout(runNextPhase, item.duration);
      } else {
        setOperationPhase("IDLE");
        if (onStepEnd) {
          onStepEnd();
        }
      }
    };

    runNextPhase();
  };

  const playNextStep = useCallback(() => {
    if (!isPlayingRef.current || !solution) return;

    const nextIdx = currentStepRef.current + 1;
    if (nextIdx >= solution.steps.length) {
      // Tour reached end
      setIsPlaying(false);
      setIsAnimating(false);
      setOperationPhase("IDLE");
      return;
    }

    playStepPhases(nextIdx, () => {
      if (isPlayingRef.current) {
        playNextStep();
      }
    });
  }, [solution, playStepPhases]);

  const handlePlayToggle = () => {
    if (!solution) return;
    if (isPlaying) {
      clearAllTimeouts();
      setIsPlaying(false);
      setIsAnimating(false);
      setOperationPhase("IDLE");
    } else {
      setIsPlaying(true);
      if (currentStep >= solution.steps.length - 1) {
        // Reset and start from step 0
        setCurrentStep(-1);
        setTimeout(() => {
          playStepPhases(0, () => {
            if (isPlayingRef.current) playNextStep();
          });
        }, 150);
      } else {
        const targetStep = currentStep < 0 ? 0 : currentStep + 1;
        playStepPhases(targetStep, () => {
          if (isPlayingRef.current) playNextStep();
        });
      }
    }
  };

  const handleNextStep = () => {
    if (!solution || currentStep >= solution.steps.length - 1) return;
    clearAllTimeouts();
    setIsPlaying(false);
    const nextIdx = currentStep + 1;
    playStepPhases(nextIdx);
  };

  const handlePrevStep = () => {
    clearAllTimeouts();
    setIsPlaying(false);
    setIsAnimating(false);
    setTruckProgress(1);
    setOperationPhase("IDLE");
    setCurrentStep((prev) => Math.max(-1, prev - 1));
  };

  const handleFirstStep = () => {
    resetPlayback();
  };

  const handleLastStep = () => {
    if (!solution) return;
    clearAllTimeouts();
    setIsPlaying(false);
    setIsAnimating(false);
    setTruckProgress(1);
    setOperationPhase("IDLE");
    setCurrentStep(solution.steps.length - 1);
  };

  const handleSelectStep = (stepIdx: number) => {
    clearAllTimeouts();
    setIsPlaying(false);
    setIsAnimating(false);
    setTruckProgress(1);
    setOperationPhase("IDLE");
    setCurrentStep(stepIdx);
  };

  const handleUploadCustomFile = (customData: SolutionData, filename: string) => {
    setSolution(customData);
    setSelectedFilename(filename);
    resetPlayback();
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        handlePlayToggle();
      } else if (e.code === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        handleNextStep();
      } else if (e.code === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        handlePrevStep();
      } else if (e.code === "Home") {
        e.preventDefault();
        handleFirstStep();
      } else if (e.code === "End") {
        e.preventDefault();
        handleLastStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [solution, isPlaying, currentStep, handlePlayToggle]);

  return (
    <div className="min-h-screen bg-[#080c14] text-zinc-100 flex flex-col antialiased">
      {/* Top Header */}
      <Header
        solution={solution}
        selectedFilename={selectedFilename}
        onOpenSelector={() => setIsSelectorOpen(true)}
        onReset={resetPlayback}
        solutionsCount={solutions.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1650px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {loading && !solution ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm font-medium">Cargando soluciones óptimas desde Outputs/...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-center max-w-lg mx-auto my-12 space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h3 className="font-bold text-base">Error al cargar soluciones</h3>
            <p className="text-xs text-zinc-400">{error}</p>
            <button
              onClick={() => fetchSolutions(true)}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 rounded-xl text-xs font-semibold transition-all"
            >
              Reintentar
            </button>
          </div>
        ) : solution ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Route Canvas + Player + Cargo Bay */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
              {/* Route Map Canvas */}
              <div className="w-full">
                <RouteCanvas
                  solution={solution}
                  currentStep={currentStep}
                  truckProgress={truckProgress}
                  isAnimating={isAnimating}
                  operationPhase={operationPhase}
                />
              </div>

              {/* Player Controls Bar */}
              <StepPlayer
                currentStep={currentStep}
                totalSteps={solution.steps.length}
                isPlaying={isPlaying}
                speed={speed}
                onPlayToggle={handlePlayToggle}
                onNext={handleNextStep}
                onPrev={handlePrevStep}
                onFirst={handleFirstStep}
                onLast={handleLastStep}
                onSpeedChange={setSpeed}
              />

              {/* LIFO Cargo Compartment */}
              <CargoCompartment
                solution={solution}
                currentStep={currentStep}
                operationPhase={operationPhase}
                isAnimating={isAnimating}
              />
            </div>

            {/* Right Column: Insights + Timeline + Formula */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
              {/* Step Explanation & Handling Inspector */}
              <HandlingInspector solution={solution} currentStep={currentStep} />

              {/* Step Sequence Timeline */}
              <StepTimeline
                solution={solution}
                currentStep={currentStep}
                onSelectStep={handleSelectStep}
              />

              {/* Objective Function Mathematical Breakdown */}
              <CostBreakdown solution={solution} />
            </div>
          </div>
        ) : null}
      </main>

      {/* Solution Selector Modal */}
      <SolutionSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        solutions={solutions}
        selectedFilename={selectedFilename}
        onSelectSolution={(filename) => loadSolutionData(filename)}
        onUploadCustomFile={handleUploadCustomFile}
        onRefresh={() => fetchSolutions(false)}
        loading={loading}
      />
    </div>
  );
}
