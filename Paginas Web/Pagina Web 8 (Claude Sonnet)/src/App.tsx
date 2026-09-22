import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Solution, SolutionSummary } from '@/types/solution'
import SolutionSelector from '@/components/SolutionSelector'
import MetricsBar from '@/components/MetricsBar'
import RouteMap from '@/components/RouteMap'
import TruckCargo from '@/components/TruckCargo'
import StepExplanation from '@/components/StepExplanation'
import StepTimeline from '@/components/StepTimeline'
import PlaybackControls from '@/components/PlaybackControls'
import { Truck, FolderOpen, CircleNotch } from '@phosphor-icons/react'

export default function App() {
  const [solutions, setSolutions] = useState<SolutionSummary[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [solution, setSolution] = useState<Solution | null>(null)
  const [loadingSolution, setLoadingSolution] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(3000)

  // Fetch solutions list on mount
  useEffect(() => {
    fetch('/api/solutions')
      .then(r => r.json())
      .then(setSolutions)
      .catch(err => console.error('Error fetching solutions:', err))
  }, [])

  // Fetch full solution when file selected
  useEffect(() => {
    if (!selectedFile) return
    setLoadingSolution(true)
    setCurrentStep(0)
    setIsPlaying(false)
    setSolution(null)
    fetch(`/api/solutions/${encodeURIComponent(selectedFile)}`)
      .then(r => r.json())
      .then(data => {
        setSolution(data)
        setLoadingSolution(false)
      })
      .catch(err => {
        console.error('Error fetching solution:', err)
        setLoadingSolution(false)
      })
  }, [selectedFile])

  // Auto-play timer
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (playTimerRef.current) clearTimeout(playTimerRef.current)
    if (!isPlaying || !solution) return
    playTimerRef.current = setTimeout(() => {
      if (currentStep < solution.steps.length - 1) {
        setCurrentStep(prev => prev + 1)
      } else {
        setIsPlaying(false)
      }
    }, playSpeed)
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current)
    }
  }, [isPlaying, currentStep, solution, playSpeed])

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step)
    setIsPlaying(false)
  }, [])

  const handlePlay = useCallback(() => {
    if (!solution) return
    if (currentStep === solution.steps.length - 1) {
      setCurrentStep(0)
    }
    setIsPlaying(true)
  }, [solution, currentStep])

  const handlePause = useCallback(() => setIsPlaying(false), [])
  const handlePrev = useCallback(() => {
    setCurrentStep(p => Math.max(0, p - 1))
    setIsPlaying(false)
  }, [])
  const handleNext = useCallback(() => {
    if (!solution) return
    setCurrentStep(p => Math.min(solution.steps.length - 1, p + 1))
    setIsPlaying(false)
  }, [solution])
  const handleFirst = useCallback(() => {
    setCurrentStep(0)
    setIsPlaying(false)
  }, [])
  const handleLast = useCallback(() => {
    if (!solution) return
    setCurrentStep(solution.steps.length - 1)
    setIsPlaying(false)
  }, [solution])

  const step = solution?.steps[currentStep]

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-72 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
        {/* Logo / Title */}
        <div className="p-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Truck size={16} weight="bold" className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-zinc-100">TSPPD-H</h1>
              <p className="text-[10px] text-zinc-500 font-mono">Visualizador v8</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed mt-2">
            Selecciona una solución para visualizar la ruta óptima con animaciones de carga LIFO.
          </p>
        </div>

        {/* Solution list */}
        <div className="flex-1 overflow-y-auto">
          <SolutionSelector
            solutions={solutions}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 flex-shrink-0">
          <p className="text-[9px] font-mono text-zinc-700 text-center">
            Outputs: {solutions.length} archivos · Puerto 3008
          </p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AnimatePresence mode="wait">
          {/* Loading state */}
          {loadingSolution && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <CircleNotch size={32} className="text-blue-400 animate-spin" />
                <p className="text-sm text-zinc-400">Cargando solución...</p>
              </div>
            </motion.div>
          )}

          {/* Empty / no selection state */}
          {!loadingSolution && !solution && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8"
            >
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <FolderOpen size={36} className="text-zinc-700" />
              </div>
              <div className="max-w-sm">
                <h2 className="text-base font-semibold text-zinc-400 mb-2">
                  Sin solución seleccionada
                </h2>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Selecciona una instancia del panel izquierdo para visualizar la solución óptima del modelo TSPPD-H con animaciones de ruta y compartimiento LIFO.
                </p>
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-zinc-700">
                <span>🔴 α = entregas</span>
                <span>🔵 β = recolecciones</span>
                <span>⚠️ = handling LIFO</span>
              </div>
            </motion.div>
          )}

          {/* Solution view */}
          {!loadingSolution && solution && step && (
            <motion.div
              key={solution.instance}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Metrics bar */}
              <MetricsBar solution={solution} />

              {/* Middle: Map + Cargo */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Route Map */}
                <div className="flex-1 p-3 min-w-0 overflow-hidden">
                  <RouteMap solution={solution} currentStep={currentStep} />
                </div>

                {/* Truck Cargo */}
                <div className="w-80 flex-shrink-0 p-3 border-l border-zinc-800 overflow-hidden">
                  <TruckCargo solution={solution} currentStep={currentStep} />
                </div>
              </div>

              {/* Bottom panel */}
              <div className="border-t border-zinc-800 flex-shrink-0">
                {/* Step explanation */}
                <StepExplanation
                  step={step}
                  stepNumber={currentStep + 1}
                  totalSteps={solution.steps.length}
                  nodes={solution.nodes}
                />

                {/* Timeline */}
                <StepTimeline
                  steps={solution.steps}
                  currentStep={currentStep}
                  onStepChange={handleStepChange}
                  nodes={solution.nodes}
                />

                {/* Playback controls */}
                <PlaybackControls
                  currentStep={currentStep}
                  totalSteps={solution.steps.length}
                  isPlaying={isPlaying}
                  playSpeed={playSpeed}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  onFirst={handleFirst}
                  onLast={handleLast}
                  onSpeedChange={setPlaySpeed}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
