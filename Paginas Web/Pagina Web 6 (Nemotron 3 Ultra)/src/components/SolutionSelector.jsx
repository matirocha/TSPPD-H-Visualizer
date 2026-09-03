'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, FileText, Target, MapPin, Clock } from 'lucide-react'
import { cn } from '../lib/utils'

export function SolutionSelector({ 
  solutions = [], 
  selectedSolution = null, 
  onSelect = () => {}, 
  isLoading = false 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const safeSolutions = Array.isArray(solutions) ? solutions : []

  return (
    <div className="relative">
      {/* Selected Solution Display */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-4 py-3 rounded-xl border border-border bg-card text-left',
          'flex items-center gap-3 hover:border-primary/50 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        disabled={isLoading}
      >
        <div className="flex-1 min-w-0">
          {selectedSolution ? (
            <>
              <p className="font-medium text-foreground truncate">
                {selectedSolution.instance || selectedSolution.filename}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedSolution.numCustomers ?? 0} clientes
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  ID: {selectedSolution.instanceId ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Obj: {typeof selectedSolution.objectiveValue === 'number' ? selectedSolution.objectiveValue.toFixed(2) : String(selectedSolution.objectiveValue ?? '')}
                </span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Seleccionar una solución...</p>
          )}
        </div>
        <motion.div
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </motion.div>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="max-h-96 overflow-y-auto">
              {safeSolutions.map((solution, index) => (
                <motion.button
                  key={solution.filename}
                  onClick={() => {
                    onSelect(solution)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-accent transition-colors',
                    'flex items-center gap-3 border-b last:border-0',
                    selectedSolution?.filename === solution.filename 
                      && 'bg-primary/5 border-l-4 border-l-primary'
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ x: 4 }}
                >
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{solution.instance || solution.filename}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                      <span>Clientes: {solution.numCustomers ?? 0}</span>
                      <span>ID: {solution.instanceId ?? 0}</span>
                      <span>Dist: {solution.totalDistance ?? 0}</span>
                      <span>Handling: {typeof solution.handlingCost === 'number' ? solution.handlingCost.toFixed(2) : String(solution.handlingCost ?? '0.00')}</span>
                    </div>
                  </div>
                  {selectedSolution?.filename === solution.filename && (
                    <Target className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </motion.button>
              ))}
            </div>
            
            {safeSolutions.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay soluciones disponibles</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)} 
        />
      )}
    </div>
  )
}