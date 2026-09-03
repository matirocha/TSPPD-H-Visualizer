'use client'

import { motion } from 'framer-motion'
import { MapPin, Home, Circle } from 'lucide-react'
import { cn } from '../lib/utils'

export function RouteMap({ 
  tour = [], 
  nodes = [], 
  currentStep = 0, 
  steps = [] 
}) {
  const safeTour = Array.isArray(tour) ? tour : []
  const safeNodes = Array.isArray(nodes) ? nodes : []
  const safeSteps = Array.isArray(steps) ? steps : []

  const depot = safeNodes.find(n => n.isDepot) || { id: 0, label: 'Depósito' }
  const customers = safeNodes.filter(n => !n.isDepot)
  
  // Simple layout positions for nodes
  const nodePositions = {}
  const centerX = 50
  const centerY = 50
  const radius = 35
  
  // Position depot at center
  nodePositions[0] = { x: centerX, y: centerY }
  
  // Position customers in a circle
  const customerCount = Math.max(1, customers.length)
  customers.forEach((customer, index) => {
    const angle = (index / customerCount) * 2 * Math.PI - Math.PI / 2
    nodePositions[customer.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  })

  const getPath = (fromId, toId) => {
    const from = nodePositions[fromId] || { x: centerX, y: centerY }
    const to = nodePositions[toId] || { x: centerX, y: centerY }
    
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const ctrlX = midX + (from.y - to.y) * 0.15
    const ctrlY = midY + (to.x - from.x) * 0.15
    
    return `M${from.x},${from.y} Q${ctrlX},${ctrlY} ${to.x},${to.y}`
  }

  return (
    <div className="relative w-full aspect-square bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border border-border overflow-hidden">
      {/* SVG Routes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker 
            id="arrowhead" 
            markerWidth="10" 
            markerHeight="7" 
            refX="9" 
            refY="3.5" 
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,7 L9,3.5 Z" fill="currentColor" />
          </marker>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        
        {/* Completed routes */}
        {(tour || []).slice(0, -1).map((fromId, idx) => {
          const toId = tour[idx + 1]
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep
          
          return (
            <motion.path
              key={`route-${idx}`}
              d={getPath(fromId, toId)}
              stroke={isCompleted ? '#22c55e' : isCurrent ? 'url(#routeGradient)' : '#94a3b8'}
              strokeWidth={isCurrent ? 3 : 2}
              strokeDasharray={isCurrent ? '8,4' : 'none'}
              fill="none"
              markerEnd="url(#arrowhead)"
              className={cn(
                'transition-all duration-500',
                isCurrent && 'animate-dash'
              )}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
            />
          )
        })}
      </svg>
      
      {/* Nodes */}
      {safeNodes.map(node => {
        const pos = nodePositions[node.id]
        if (!pos) return null
        
        const isCurrentFrom = safeSteps.length > 0 && currentStep < safeSteps.length && safeSteps[currentStep]?.from === node.id
        const isCurrentTo = safeSteps.length > 0 && currentStep < safeSteps.length && safeSteps[currentStep]?.to === node.id
        const isVisited = safeTour.slice(0, currentStep + 1).includes(node.id)
        const tourIdx = safeTour.indexOf(node.id)
        const animDelay = tourIdx >= 0 ? tourIdx * 0.08 : 0
        
        return (
          <motion.div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isCurrentFrom || isCurrentTo ? 1.3 : 1, 
              opacity: 1 
            }}
            transition={{ 
              type: isCurrentFrom || isCurrentTo ? 'spring' : 'tween',
              stiffness: 300,
              damping: 15,
              delay: animDelay
            }}
          >
            <div className={cn(
              'flex flex-col items-center gap-1',
              node.isDepot ? 'w-20' : 'w-16'
            )}>
              <div className={cn(
                'relative flex items-center justify-center rounded-full border-4 transition-all duration-300',
                node.isDepot 
                  ? 'w-14 h-14 bg-white border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'w-10 h-10 bg-white border-gray-300 dark:border-gray-600',
                isCurrentFrom && 'border-amber-500 ring-4 ring-amber-500/30',
                isCurrentTo && 'border-green-500 ring-4 ring-green-500/30',
                isVisited && !node.isDepot && 'border-green-500 bg-green-50 dark:bg-green-900/30',
              )}>
                {node.isDepot ? (
                  <Home className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                ) : (
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {node.id}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-xs font-medium text-center whitespace-nowrap px-1',
                node.isDepot ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'
              )}>
                {node.label || (node.isDepot ? 'Depósito' : `Cliente ${node.id}`)}
              </span>
              {!node.isDepot && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="text-red-500">α{node.alpha ?? 0}</span>
                  <span className="text-cyan-500">β{node.beta ?? 0}</span>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
      
      {/* Current truck position indicator */}
      {safeSteps.length > 0 && currentStep < safeSteps.length && safeSteps[currentStep] && (
        <motion.div
          className="absolute pointer-events-none"
          style={{ 
            left: `${nodePositions[safeSteps[currentStep].from]?.x || centerX}%`, 
            top: `${nodePositions[safeSteps[currentStep].from]?.y || centerY}%` 
          }}
          animate={{
            x: [
              0,
              (nodePositions[safeSteps[currentStep].to]?.x || centerX) - (nodePositions[safeSteps[currentStep].from]?.x || centerX),
            ],
            y: [
              0,
              (nodePositions[safeSteps[currentStep].to]?.y || centerY) - (nodePositions[safeSteps[currentStep].from]?.y || centerY),
            ],
          }}
          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
        >
          <div className="w-8 h-8 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <TruckIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-600" />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}