'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Truck, Package, ArrowDown, ArrowUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '../lib/utils'

export function StepExplanation({ 
  step = {}, 
  isActive = false, 
  isCompleted = false,
  onClick = () => {} 
}) {
  const stepIndex = step.stepIndex ?? 0
  const totalSteps = step.totalSteps ?? 1
  const deliverA = step.deliverA ?? 0
  const pickupB = step.pickupB ?? 0
  const handlingCount = step.handlingCount ?? 0

  const getStepIcon = () => {
    if (stepIndex === 0) return <Truck className="w-5 h-5 text-blue-500" />
    if (stepIndex >= totalSteps - 1) return <CheckCircle className="w-5 h-5 text-green-500" />
    return <Package className="w-5 h-5 text-purple-500" />
  }

  const getActionIcons = () => {
    const icons = []
    if (deliverA > 0) {
      icons.push(
        <div key="deliver" className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
          <ArrowDown className="w-3 h-3" />
          <span>{deliverA}α</span>
        </div>
      )
    }
    if (pickupB > 0) {
      icons.push(
        <div key="pickup" className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 text-xs">
          <ArrowUp className="w-3 h-3" />
          <span>{pickupB}β</span>
        </div>
      )
    }
    if (handlingCount > 0) {
      icons.push(
        <div key="handling" className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
          <AlertTriangle className="w-3 h-3" />
          <span>{handlingCount}H</span>
        </div>
      )
    }
    return icons
  }

  return (
    <motion.div
      layout
      className={cn(
        'group relative p-4 rounded-xl border transition-all duration-300 cursor-pointer',
        isActive 
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
          : 'border-border bg-card hover:border-primary/50',
        isCompleted && !isActive && 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
      )}
      onClick={onClick}
      whileHover={{ y: -2, boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)' }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
          isActive ? 'bg-primary text-primary-foreground' : 
          isCompleted ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
        )}>
          {getStepIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-lg">
              Paso {step.stepIndex + 1}
            </h4>
            <span className="text-sm text-muted-foreground">
              {step.from === 0 ? 'Depósito' : `Cliente ${step.from}`} 
              <ChevronRight className="w-4 h-4 mx-1" />
              {step.to === 0 ? 'Depósito' : `Cliente ${step.to}`}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            <span className="flex items-center gap-1">
              <Truck className="w-3 h-3" />
              {step.distance} km
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              Carga: {step.aOnTruck}α + {step.bOnTruck}β
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {getActionIcons()}
          </div>
        </div>
        
        <ChevronRight 
          className={cn(
            'flex-shrink-0 w-5 h-5 text-muted-foreground transition-transform',
            isActive && 'rotate-90 text-primary'
          )}
        />
      </div>
      
      {/* Expanded explanation */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-border"
          >
            <div 
              className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg"
              dangerouslySetInnerHTML={{ __html: step.explanation }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}