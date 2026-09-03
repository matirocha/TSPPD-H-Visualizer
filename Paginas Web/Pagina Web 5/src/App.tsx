import { useSolutionLoader } from './hooks/useSolutionLoader'
import { usePlayback } from './hooks/usePlayback'
import { SolutionPicker } from './components/SolutionPicker'
import { MetricsBar } from './components/MetricsBar'
import { RouteCanvas } from './components/RouteCanvas'
import { CargoCompartment } from './components/CargoCompartment'
import { StepProgress } from './components/StepProgress'
import { StepDetail } from './components/StepDetail'
import { PlaybackControls } from './components/PlaybackControls'
import { Truck } from 'lucide-react'

export default function App() {
  const { files, solution, loading, error, loadSolution, selectedFile } = useSolutionLoader()
  const {
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
    phaseProgress,
  } = usePlayback(solution)

  const currentStepData = solution?.steps[currentStep] ?? null
  const prevStepData = currentStep > 0 ? (solution?.steps[currentStep - 1] ?? null) : null

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center p-8">
        <div className="bg-red-950/50 border border-red-800 rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-red-400 text-lg font-semibold mb-2">Error al cargar datos</h2>
          <p className="text-red-300/80 text-sm">{error}</p>
          <p className="text-zinc-500 text-xs mt-4">
            Asegurate de ejecutar <code className="bg-zinc-900 px-2 py-0.5 rounded">node scripts/copy-outputs.js</code> antes de iniciar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-100">
                  Visualizador TSPPD-H
                </h1>
                <p className="text-xs text-zinc-500">
                  Problema del Viajante con Recoleccion, Entrega y Manipulacion
                </p>
              </div>
            </div>
            {solution && (
              <div className="hidden md:block text-right">
                <div className="text-xs text-zinc-500">Instancia activa</div>
                <div className="text-sm font-semibold text-emerald-400">{solution.instance}</div>
              </div>
            )}
          </div>
          <SolutionPicker
            files={files}
            selectedFile={selectedFile}
            onSelect={loadSolution}
            loading={loading}
          />
        </div>
      </header>

      {/* Main Content */}
      {solution ? (
        <main className="flex-1 flex flex-col max-w-[1600px] mx-auto w-full">
          {/* Metrics */}
          <section className="px-6 pt-5">
            <MetricsBar solution={solution} />
          </section>

          {/* Central Split: Route Map + Cargo */}
          <section className="flex-1 px-6 pt-5 grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0">
            {/* Route Map - 60% */}
            <div className="lg:col-span-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 p-4 flex items-center justify-center overflow-hidden">
              <RouteCanvas
                solution={solution}
                currentStep={currentStep}
                phase={phase}
                phaseProgress={phaseProgress}
              />
            </div>

            {/* Right panel: Cargo + Detail */}
            <div className="lg:col-span-2 flex flex-col gap-5 min-h-0">
              <CargoCompartment
                step={currentStepData}
                prevStep={prevStepData}
                phase={phase}
                phaseProgress={phaseProgress}
              />
              <div className="flex-1 min-h-[180px]">
                <StepDetail
                  step={currentStepData}
                  nodes={solution.nodes}
                  phase={phase}
                />
              </div>
            </div>
          </section>

          {/* Bottom: Timeline + Controls */}
          <section className="px-6 py-5 flex flex-col gap-3">
            <StepProgress
              steps={solution.steps}
              currentStep={currentStep}
              nodes={solution.nodes}
              onStepClick={goToStep}
            />
            <PlaybackControls
              currentStep={currentStep}
              totalSteps={solution.steps.length}
              isPlaying={isPlaying}
              speed={speed}
              phase={phase}
              onPlay={play}
              onPause={pause}
              onReset={reset}
              onNext={nextStep}
              onPrev={prevStep}
              onSpeedChange={setSpeed}
            />
          </section>
        </main>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm">Cargando solucion...</p>
            </div>
          ) : (
            <p className="text-zinc-500">Selecciona una solucion para comenzar</p>
          )}
        </div>
      )}
    </div>
  )
}
