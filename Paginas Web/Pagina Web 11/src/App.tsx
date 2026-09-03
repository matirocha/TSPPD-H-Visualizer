import React, { useState, useEffect, useRef, useCallback } from "react";
import { SolutionData, SolutionFileSummary, AnimationPhase, StepDef } from "./types/tsppd";
import { DEFAULT_SOLUTIONS } from "./lib/defaultSolutions";
import { Header } from "./components/Header";
import { MetricsBar } from "./components/MetricsBar";
import { RouteMap } from "./components/RouteMap";
import { CargoBaySimulator } from "./components/CargoBaySimulator";
import { ControlsDeck } from "./components/ControlsDeck";
import { ExplanationCard } from "./components/ExplanationCard";
import { StepTimeline } from "./components/StepTimeline";
import confetti from "canvas-confetti";

export const App: React.FC = () => {
  // 1. Soluciones disponibles
  const defaultKeys = Object.keys(DEFAULT_SOLUTIONS);
  const initialFilename = defaultKeys[0] || "Solucion_5_Clientes_ID1_H_01.txt";

  const [solutionsList, setSolutionsList] = useState<SolutionFileSummary[]>(() => {
    return defaultKeys.map((key) => {
      const data = DEFAULT_SOLUTIONS[key];
      return {
        filename: key,
        instance: data.instance || key,
        numCustomers: data.numCustomers || 5,
        instanceId: data.instanceId || 1,
        h: data.h || 0.1,
        objectiveValue: data.objectiveValue || 0,
        totalDistance: data.totalDistance || 0,
        handlingCost: data.handlingCost || 0,
      };
    });
  });

  const [selectedFilename, setSelectedFilename] = useState<string>(initialFilename);
  const [currentSolution, setCurrentSolution] = useState<SolutionData>(
    DEFAULT_SOLUTIONS[initialFilename]
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 2. Estado de la Simulación
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [animationProgress, setAnimationProgress] = useState<number>(0); // 0 a 1 a lo largo del arco
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("ready");
  const [phaseProgress, setPhaseProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const totalSteps = currentSolution.steps.length;
  const currentStep: StepDef = currentSolution.steps[currentStepIndex] || currentSolution.steps[0];

  // Fetch lista de soluciones desde la API de Vite
  const fetchSolutionsList = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/solutions");
      if (res.ok) {
        const data: SolutionFileSummary[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSolutionsList(data);
        }
      }
    } catch (err) {
      console.warn("API /api/solutions no disponible, usando soluciones preempaquetadas:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolutionsList();
  }, [fetchSolutionsList]);

  // Cargar una solución seleccionada
  const handleSelectSolution = async (filename: string) => {
    setSelectedFilename(filename);
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setAnimationProgress(0);
    setAnimationPhase("ready");

    // Revisar primero en la API
    try {
      const res = await fetch(`/api/solutions/${encodeURIComponent(filename)}`);
      if (res.ok) {
        const data: SolutionData = await res.json();
        setCurrentSolution(data);
        return;
      }
    } catch (e) {
      console.warn("Fallo fetch en /api/solutions/" + filename, e);
    }

    // Fallback a DEFAULT_SOLUTIONS
    if (DEFAULT_SOLUTIONS[filename]) {
      setCurrentSolution(DEFAULT_SOLUTIONS[filename]);
    }
  };

  // Cargar solución subida por el usuario
  const handleUploadSolution = (data: SolutionData, filename: string) => {
    setCurrentSolution(data);
    setSelectedFilename(filename);
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setAnimationProgress(0);
    setAnimationPhase("ready");

    // Agregar a la lista si no existe
    setSolutionsList((prev) => {
      const exists = prev.some((s) => s.filename === filename);
      if (!exists) {
        return [
          {
            filename,
            instance: data.instance || filename,
            numCustomers: data.numCustomers,
            instanceId: data.instanceId,
            h: data.h,
            objectiveValue: data.objectiveValue,
            totalDistance: data.totalDistance,
            handlingCost: data.handlingCost,
          },
          ...prev,
        ];
      }
      return prev;
    });
  };

  // --- BUCLE DE SIMULACIÓN Y ANIMACIÓN ---
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      return;
    }

    const step = currentSolution.steps[currentStepIndex];
    if (!step) return;

    const animate = (time: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = time;
      }
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Duraciones base calibradas para ser lentas, didácticas y comprensibles
      const travelDuration = Math.max(1.4, Math.min(3.2, (step.distance / 30) * 1.5)) / playbackSpeed;
      const arrivedDuration = 1.0 / playbackSpeed;
      const handlingDuration = 2.4 / playbackSpeed;
      const deliverDuration = 2.0 / playbackSpeed;
      const reloadDuration = 2.0 / playbackSpeed;
      const loadDuration = 2.0 / playbackSpeed;
      const readyDuration = 1.2 / playbackSpeed;

      if (animationPhase === "traveling") {
        setAnimationProgress((prev) => {
          const next = prev + delta / travelDuration;
          if (next >= 1) {
            setAnimationPhase("arrived");
            return 1;
          }
          return next;
        });
      } else if (animationPhase === "arrived") {
        setPhaseProgress((prev) => {
          const next = prev + delta / arrivedDuration;
          if (next >= 1) {
            if (step.handlingCount > 0) {
              setAnimationPhase("handling");
            } else if (step.deliverA > 0) {
              setAnimationPhase("delivering_alpha");
            } else if (step.pickupB > 0) {
              setAnimationPhase("loading_beta");
            } else {
              setAnimationPhase("ready");
            }
            return 0;
          }
          return next;
        });
      } else if (animationPhase === "handling") {
        setPhaseProgress((prev) => {
          const next = prev + delta / handlingDuration;
          if (next >= 1) {
            if (step.deliverA > 0) {
              setAnimationPhase("delivering_alpha");
            } else {
              setAnimationPhase("reloading_beta");
            }
            return 0;
          }
          return next;
        });
      } else if (animationPhase === "delivering_alpha") {
        setPhaseProgress((prev) => {
          const next = prev + delta / deliverDuration;
          if (next >= 1) {
            if (step.handlingCount > 0) {
              setAnimationPhase("reloading_beta");
            } else if (step.pickupB > 0) {
              setAnimationPhase("loading_beta");
            } else {
              setAnimationPhase("ready");
            }
            return 0;
          }
          return next;
        });
      } else if (animationPhase === "reloading_beta") {
        setPhaseProgress((prev) => {
          const next = prev + delta / reloadDuration;
          if (next >= 1) {
            if (step.pickupB > 0) {
              setAnimationPhase("loading_beta");
            } else {
              setAnimationPhase("ready");
            }
            return 0;
          }
          return next;
        });
      } else if (animationPhase === "loading_beta") {
        setPhaseProgress((prev) => {
          const next = prev + delta / loadDuration;
          if (next >= 1) {
            setAnimationPhase("ready");
            return 0;
          }
          return next;
        });
      } else if (animationPhase === "ready") {
        setPhaseProgress((prev) => {
          const next = prev + delta / readyDuration;
          if (next >= 1) {
            if (currentStepIndex < totalSteps - 1) {
              // Avanzar al siguiente paso
              setCurrentStepIndex((s) => s + 1);
              setAnimationProgress(0);
              setAnimationPhase("traveling");
              return 0;
            } else {
              // Fin del tour completo
              setIsPlaying(false);
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#10b981', '#06b6d4', '#f43f5e', '#f59e0b']
              });
              return 1;
            }
          }
          return next;
        });
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animationPhase, currentStepIndex, totalSteps, currentSolution, playbackSpeed]);

  // Controles manuales
  const handleTogglePlay = () => {
    if (!isPlaying) {
      if (currentStepIndex >= totalSteps - 1 && animationPhase === "ready") {
        // Si ya llegó al final y presiona play, reiniciar
        setCurrentStepIndex(0);
        setAnimationProgress(0);
        setAnimationPhase("traveling");
      } else if (animationPhase === "ready") {
        setAnimationProgress(0);
        setAnimationPhase("traveling");
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setAnimationProgress(0);
    setAnimationPhase("traveling");
    setPhaseProgress(0);
  };

  const handlePrevStep = () => {
    setIsPlaying(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((s) => s - 1);
      setAnimationProgress(1);
      setAnimationPhase("ready");
    }
  };

  const handleNextStep = () => {
    setIsPlaying(false);
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((s) => s + 1);
      setAnimationProgress(1);
      setAnimationPhase("ready");
    }
  };

  const handleSelectStep = (index: number) => {
    setIsPlaying(false);
    setCurrentStepIndex(index);
    setAnimationProgress(1);
    setAnimationPhase("ready");
  };

  // Navegación de micro-fases manual
  const phaseOrder: AnimationPhase[] = [
    "traveling",
    "arrived",
    "handling",
    "delivering_alpha",
    "reloading_beta",
    "loading_beta",
    "ready",
  ];

  const handleNextPhase = () => {
    setIsPlaying(false);
    const currIdx = phaseOrder.indexOf(animationPhase);
    if (currIdx < phaseOrder.length - 1) {
      setAnimationPhase(phaseOrder[currIdx + 1]);
      if (phaseOrder[currIdx + 1] !== "traveling") {
        setAnimationProgress(1);
      }
    }
  };

  const handlePrevPhase = () => {
    setIsPlaying(false);
    const currIdx = phaseOrder.indexOf(animationPhase);
    if (currIdx > 0) {
      setAnimationPhase(phaseOrder[currIdx - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* 1. Header con selector de solución */}
      <Header
        currentSolution={currentSolution}
        solutionsList={solutionsList}
        selectedFilename={selectedFilename}
        onSelectSolution={handleSelectSolution}
        onUploadSolution={handleUploadSolution}
        onRefreshList={fetchSolutionsList}
        isLoading={isLoading}
      />

      {/* 2. Contenido Principal */}
      <main className="flex-1 mx-auto w-full max-w-[1600px] p-4 sm:p-6 space-y-4">
        {/* Barra de métricas Bento */}
        <MetricsBar
          solution={currentSolution}
          currentStepIndex={currentStepIndex}
          currentStep={currentStep}
        />

        {/* Deck de Controles de Reproducción y Velocidad */}
        <ControlsDeck
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onPrevStep={handlePrevStep}
          onNextStep={handleNextStep}
          onReset={handleReset}
          onNextPhase={handleNextPhase}
          onPrevPhase={handlePrevPhase}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          playbackSpeed={playbackSpeed}
          onChangeSpeed={setPlaybackSpeed}
          animationPhase={animationPhase}
          currentStep={currentStep}
        />

        {/* Cockpit Principal en 2 Columnas Grandes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Columna Izquierda: Mapa de Ruteo del Camión (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <RouteMap
              solution={currentSolution}
              currentStepIndex={currentStepIndex}
              currentStep={currentStep}
              animationProgress={animationProgress}
              onSelectStep={handleSelectStep}
            />

            {/* Explicación Operativa y Matemática del Paso */}
            <ExplanationCard
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              totalSteps={totalSteps}
              solution={currentSolution}
            />
          </div>

          {/* Columna Derecha: Simulador de Compartimiento LIFO & Timeline (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <CargoBaySimulator
              solution={currentSolution}
              currentStepIndex={currentStepIndex}
              currentStep={currentStep}
              animationPhase={animationPhase}
              phaseProgress={phaseProgress}
              playbackSpeed={playbackSpeed}
            />

            {/* Timeline de Paradas de la Ruta */}
            <StepTimeline
              solution={currentSolution}
              currentStepIndex={currentStepIndex}
              onSelectStep={handleSelectStep}
            />
          </div>
        </div>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-3 px-6 text-center text-xs text-zinc-500">
        TSPPD-H Visualizer — Modelo de Despacho LIFO con Manipulación &middot; Universidad &bull; Taller de Investigación
      </footer>
    </div>
  );
};

export default App;
