'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, SkipBack, SkipForward, StepBack, StepForward, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'

export function StepNavigator({ 
  currentStep = 0, 
  totalSteps = 1, 
  isPlaying = false, 
  onStepChange = () => {}, 
  onPlayPause = () => {}, 
  onReset = () => {},
  onSpeedChange = () => {},
  speed = 1
}) {
  const [hoveredStep, setHoveredStep] = useState(null)
  const safeTotalSteps = Number.isFinite(Number(totalSteps)) && Number(totalSteps) > 0 ? Math.floor(Number(totalSteps)) : 1
  const safeCurrentStep = Math.min(Math.max(0, currentStep), safeTotalSteps - 1)

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-1 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {[...Array(safeTotalSteps)].map((_, index) => (
          <motion.button
            key={index}
            onClick={() => onStepChange(index)}
            onMouseEnter={() => setHoveredStep(index)}
            onMouseLeave={() => setHoveredStep(null)}
            className={cn(
              'relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all',
              'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              index === safeCurrentStep 
                ? 'bg-primary text-primary-foreground' 
                : index < safeCurrentStep 
                  ? 'bg-green-500 text-white' 
                  : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
          >
            <div className={cn(
              'step-indicator w-8 h-8',
              index === safeCurrentStep && 'active',
              index < safeCurrentStep && 'completed',
              index > safeCurrentStep && 'pending'
            )}>
              {index + 1}
            </div>
            <span className="text-xs font-medium whitespace-nowrap hidden sm:block">
              {index === 0 ? 'Inicio' : index === safeTotalSteps - 1 ? 'Fin' : `Paso ${index + 1}`}
            </span>
            
            {/* Connecting lines */}
            {index < safeTotalSteps - 1 && (
              <motion.div
                className={cn(
                  'step-line w-12 h-0.5 -ml-6',
                  index < safeCurrentStep ? 'completed' : 'pending'
                )}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: index < safeCurrentStep ? 1 : 0 }}
                transition={{ duration: 0.3, delay: 0.1 + index * 0.03 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <motion.button
          onClick={onReset}
          className={cn(
            'p-2.5 rounded-xl bg-muted hover:bg-accent transition-colors',
            'flex items-center justify-center',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Reiniciar"
        >
          <RotateCcw className="w-5 h-5" />
        </motion.button>

        <motion.button
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className={cn(
            'p-2.5 rounded-xl bg-muted hover:bg-accent transition-colors',
            'flex items-center justify-center',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Paso anterior"
        >
          <StepBack className="w-5 h-5" />
        </motion.button>

        <motion.button
          onClick={onPlayPause}
          className={cn(
            'p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
            'flex items-center justify-center',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'shadow-lg shadow-primary/30'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </motion.button>

        <motion.button
          onClick={() => onStepChange(Math.min(safeTotalSteps - 1, safeCurrentStep + 1))}
          disabled={safeCurrentStep >= safeTotalSteps - 1}
          className={cn(
            'p-2.5 rounded-xl bg-muted hover:bg-accent transition-colors',
            'flex items-center justify-center',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Siguiente paso"
        >
          <StepForward className="w-5 h-5" />
        </motion.button>

        {/* Speed control */}
        <div className="flex items-center gap-2 ml-4 px-3 py-1.5 bg-muted rounded-xl">
          <span className="text-xs text-muted-foreground">Velocidad:</span>
          <select
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="text-sm bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1 py-0.5 text-foreground"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>

      {/* Current step info */}
      <motion.p
        className="text-center text-sm text-muted-foreground mt-3"
        key={safeCurrentStep}
      >
        {safeCurrentStep === 0 ? 'En el depósito, listo para partir' : 
         safeCurrentStep >= safeTotalSteps - 1 ? 'Tour completado - Regreso al depósito' :
         `Paso ${safeCurrentStep + 1} de ${safeTotalSteps}`}
      </motion.p>
    </motion.div>
  )
}