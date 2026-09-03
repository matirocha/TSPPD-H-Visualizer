'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Truck, Package, MapPin, Target, RotateCcw, 
  Info, AlertTriangle, CheckCircle, Settings 
} from 'lucide-react'
import { SolutionSelector } from './components/SolutionSelector'
import { TruckVisualization } from './components/TruckVisualization'
import { StepExplanation } from './components/StepExplanation'
import { RouteMap } from './components/RouteMap'
import { ObjectiveInfo } from './components/ObjectiveInfo'
import { StepNavigator } from './components/StepNavigator'
import { formatNumber } from './lib/utils'

const API_BASE = '/api'

export default function App() {
  const [solutions, setSolutions] = useState([])
  const [selectedSolution, setSelectedSolution] = useState(null)
  const [solutionData, setSolutionData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const [showExplanation, setShowExplanation] = useState(true)
  const [viewMode, setViewMode] = useState('truck')
  
  const animationRef = useRef(null)

  useEffect(() => {
    loadSolutions()
  }, [])

  const loadSolutions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/solutions`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setSolutions(data)
        if (data.length > 0 && !selectedSolution) {
          await loadSolution(data[0])
        }
      }
    } catch (err) {
      console.error('Error loading solutions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSolution = async (solution) => {
    if (!solution || !solution.filename) return
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/solutions/${encodeURIComponent(solution.filename)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSelectedSolution(solution)
      setSolutionData(data)
      setCurrentStep(0)
      setIsPlaying(false)
    } catch (err) {
      console.error('Error loading solution:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSolution = (solution) => {
    loadSolution(solution)
  }

  useEffect(() => {
    if (!isPlaying || !solutionData || !solutionData.steps) return

    const step = solutionData.steps[currentStep]
    const baseDuration = 3000
    const duration = baseDuration / animationSpeed
    
    animationRef.current = setTimeout(() => {
      if (currentStep < (solutionData.steps?.length || 0) - 1) {
        setCurrentStep(prev => prev + 1)
      } else {
        setIsPlaying(false)
      }
    }, duration)

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [isPlaying, currentStep, solutionData, animationSpeed])

  const handlePlayPause = () => {
    const total = solutionData?.steps?.length || 0
    if (currentStep >= total - 1) {
      setCurrentStep(0)
    }
    setIsPlaying(!isPlaying)
  }

  const handleStepChange = (step) => {
    setCurrentStep(step)
    setIsPlaying(false)
  }

  const handleReset = () => {
    setCurrentStep(0)
    setIsPlaying(false)
  }

  const handleSpeedChange = (speed) => {
    setAnimationSpeed(speed)
  }

  if (!solutionData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Truck className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
          <h2 className="text-lg font-bold text-foreground mb-1">Cargando visualizador TSPPD-H</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isLoading ? 'Obteniendo soluciones...' : 'No se pudieron cargar las soluciones.'}
          </p>
          {!isLoading && (
            <button
              onClick={loadSolutions}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl shadow hover:bg-primary/90 transition-colors"
            >
              Reintentar carga
            </button>
          )}
        </div>
      </div>
    )
  }

  const steps = solutionData.steps || []
  const totalSteps = steps.length
  const step = steps[currentStep] || {}
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">TSPPD-H Visualizador</h1>
                <p className="text-sm text-muted-foreground">Soluciones óptimas con animaciones LIFO</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <SolutionSelector
                solutions={solutions}
                selectedSolution={selectedSolution}
                onSelect={handleSelectSolution}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ObjectiveInfo solution={solutionData} />
        </motion.section>

        <motion.div
          className="mb-6 h-2 bg-muted rounded-full overflow-hidden"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-cyan-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </motion.div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Vista:</span>
            <div className="flex bg-muted rounded-lg p-1">
              {['truck', 'map', 'both'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === mode
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'truck' && <Truck className="w-4 h-4 inline mr-1" />}
                  {mode === 'map' && <MapPin className="w-4 h-4 inline mr-1" />}
                  {mode === 'both' && <Package className="w-4 h-4 inline mr-1" />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExplanation}
              onChange={(e) => setShowExplanation(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            Mostrar explicaciones
          </label>
        </div>

        <div className={`
          grid gap-6
          ${viewMode === 'both' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}
        `}>
          {(viewMode === 'truck' || viewMode === 'both') && (
            <motion.section
              className="bg-card rounded-2xl border border-border overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Camión y Carga (LIFO)
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-red-500" />
                    α: {step.aOnTruck}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-cyan-500" />
                    β: {step.bOnTruck}
                  </span>
                  {step.handlingCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      Handling: {step.handlingCount} (${step.handlingCost.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-4">
                <TruckVisualization
                  slots={step.slots}
                  aOnTruck={step.aOnTruck}
                  bOnTruck={step.bOnTruck}
                  capacity={solutionData.capacity}
                  isAnimating={isPlaying && currentStep === solutionData.steps.indexOf(step)}
                  animationType={step.handlingCount > 0 ? 'handling' : null}
                  handlingCount={step.handlingCount}
                />
              </div>
            </motion.section>
          )}

          {(viewMode === 'map' || viewMode === 'both') && (
            <motion.section
              className="bg-card rounded-2xl border border-border overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Mapa de Ruta
                </h2>
              </div>
              <div className="p-4">
                <RouteMap
                  tour={solutionData.tour}
                  nodes={solutionData.nodes}
                  currentStep={currentStep}
                  steps={solutionData.steps}
                />
              </div>
            </motion.section>
          )}

          {showExplanation && (
            <motion.section
              className={`
                bg-card rounded-2xl border border-border overflow-hidden
                ${viewMode === 'both' ? 'lg:col-span-2' : ''}
              `}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Detalle de Pasos
                </h2>
                <span className="text-sm text-muted-foreground">
                  Paso {currentStep + 1} de {totalSteps}
                </span>
              </div>
              
              <div className="p-4 max-h-96 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {solutionData.steps.map((s, idx) => (
                    <StepExplanation
                      key={s.stepIndex}
                      step={{ ...s, totalSteps }}
                      isActive={idx === currentStep}
                      isCompleted={idx < currentStep}
                      onClick={() => handleStepChange(idx)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}

          <motion.section
            className={`
              bg-card rounded-2xl border border-border overflow-hidden
              ${viewMode === 'both' ? 'lg:col-span-2' : ''}
            `}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5" />
                Paso Actual: {currentStep + 1} / {totalSteps}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-muted rounded-lg font-mono">
                  {step.distance} km
                </span>
                {step.handlingCount > 0 && (
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {step.handlingCount} handling
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">Origen → Destino</h3>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {step.from === 0 ? 'Depósito' : `Cliente ${step.from}`}
                    </p>
                    <p className="text-sm text-muted-foreground">Salida</p>
                  </div>
                  <RotateCcw className="w-5 h-5 text-muted-foreground mx-2" />
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {step.to === 0 ? 'Depósito' : `Cliente ${step.to}`}
                    </p>
                    <p className="text-sm text-muted-foreground">Llegada</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">Operaciones</h3>
                <div className="space-y-2">
                  {step.deliverA > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <Package className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-red-700 dark:text-red-300">Entregar α</p>
                        <p className="text-sm text-red-600 dark:text-red-400">{step.deliverA} unidades</p>
                      </div>
                    </div>
                  )}
                  {step.pickupB > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
                      <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                        <Package className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-medium text-cyan-700 dark:text-cyan-300">Recoger β</p>
                        <p className="text-sm text-cyan-600 dark:text-cyan-400">{step.pickupB} unidades</p>
                      </div>
                    </div>
                  )}
                  {step.deliverA === 0 && step.pickupB === 0 && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-300">Tour completado</p>
                        <p className="text-sm text-green-600 dark:text-green-400">Regreso al depósito</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">Estado del Camión</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{step.aOnTruck}</p>
                    <p className="text-xs text-muted-foreground">α a bordo</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{step.bOnTruck}</p>
                    <p className="text-xs text-muted-foreground">β a bordo</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-xl text-center col-span-2">
                    <p className="text-2xl font-bold text-foreground">{step.aOnTruck + step.bOnTruck} / {solutionData.capacity}</p>
                    <p className="text-xs text-muted-foreground">Ocupación total</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <h3 className="font-medium text-sm text-muted-foreground mb-2">Explicación detallada</h3>
              <div 
                className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-xl"
                dangerouslySetInnerHTML={{ __html: step.explanation }}
              />
            </div>
          </motion.section>
        </div>

        <motion.section
          className="mt-6 bg-card rounded-2xl border border-border p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StepNavigator
            currentStep={currentStep}
            totalSteps={totalSteps}
            isPlaying={isPlaying}
            onStepChange={handleStepChange}
            onPlayPause={handlePlayPause}
            onReset={handleReset}
            onSpeedChange={handleSpeedChange}
            speed={animationSpeed}
          />
        </motion.section>

        <motion.section
          className="mt-6 bg-card rounded-2xl border border-border p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Parámetros de la Instancia
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Clientes</p>
              <p className="font-medium">{solutionData.numCustomers}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ID Instancia</p>
              <p className="font-medium">{solutionData.instanceId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Parámetro h</p>
              <p className="font-medium">{solutionData.h}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Capacidad Q</p>
              <p className="font-medium">{solutionData.capacity}</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-medium mb-2">Ruta completa:</h4>
            <p className="font-mono text-sm text-muted-foreground break-all">
              {solutionData.tour.map((n, i) => 
                n === 0 ? 'Depósito' : `Cliente ${n}`
              ).join(' → ')}
            </p>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border bg-card/50 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          TSPPD-H Visualizador - Two-Echelon Vehicle Routing Problem with Handling Costs
        </div>
      </footer>
    </div>
  )
}