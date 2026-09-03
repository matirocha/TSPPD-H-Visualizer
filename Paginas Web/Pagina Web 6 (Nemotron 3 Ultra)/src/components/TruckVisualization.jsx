'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

const SLOT_HEIGHT = 28
const SLOT_WIDTH = 14
const SLOT_GAP = 2
const MAX_VISIBLE_SLOTS = 32

export function TruckVisualization({ 
  slots = [], 
  aOnTruck = 0, 
  bOnTruck = 0, 
  capacity = 32,
  isAnimating = false,
  animationType = null,
  handlingCount = 0 
}) {
  const safeSlots = Array.isArray(slots) ? slots : []
  const safeCapacity = Number.isFinite(Number(capacity)) && Number(capacity) > 0 ? Number(capacity) : 32
  const visibleSlots = safeSlots.slice(0, MAX_VISIBLE_SLOTS)
  const emptyCount = Math.max(0, safeCapacity - safeSlots.length)
  const safeEmptySlots = Number.isFinite(emptyCount) ? Math.floor(emptyCount) : 0
  
  const truckVariants = {
    idle: { x: 0 },
    moving: { x: 100 },
    loading: { scale: 1.02 },
  }

  const slotVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: { height: SLOT_HEIGHT, opacity: 1 },
    empty: { height: 0, opacity: 0 },
    handling: { 
      x: [-10, 10, -10, 10, 0],
      y: [0, -15, 0, -15, 0],
      transition: { duration: 0.8, repeat: handlingCount > 0 ? handlingCount : 0 }
    }
  }

  return (
    <div className="relative w-full">
      {/* Truck Container */}
      <motion.div
        className="relative w-full max-w-4xl mx-auto"
        animate={isAnimating ? 'moving' : 'idle'}
        variants={truckVariants}
        transition={{ duration: 2, ease: 'easeInOut' }}
      >
        {/* Truck Cabin */}
        <div className="flex items-end justify-between w-full">
          <div className="flex items-end">
            {/* Cabin */}
            <div className="relative">
              <div className="w-20 h-24 bg-gray-800 rounded-tl-lg rounded-bl-lg relative overflow-hidden">
                <div className="absolute top-2 left-2 w-16 h-10 bg-blue-900 rounded-tl-md" />
                <div className="absolute bottom-2 left-2 w-8 h-6 bg-gray-600 rounded-bl-sm" />
                <div className="absolute bottom-2 right-2 w-8 h-6 bg-gray-600 rounded-br-sm" />
              </div>
              
              {/* Trailer */}
              <div className="relative ml-1">
                <div className="relative h-32 bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-tr-lg rounded-br-lg overflow-hidden">
                  {/* Truck bed floor */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-400 dark:bg-gray-600" />
                  
                  {/* Rear door indicator */}
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-red-500/30 border-l-2 border-red-500/50" />
                  
                  {/* Slots visualization */}
                  <div className="absolute bottom-2 left-2 right-8 top-2 flex items-end gap-[2px] pb-1">
                    <AnimatePresence mode="popLayout">
                      {visibleSlots.map((slot, index) => (
                        <motion.div
                          key={`slot-${index}-${slot}`}
                          className={cn(
                            'relative rounded-t-sm overflow-hidden',
                            slot === 'A' && 'bg-red-500',
                            slot === 'B' && 'bg-cyan-500',
                            slot === 'EMPTY' && 'bg-gray-200 dark:bg-gray-700'
                          )}
                          style={{ 
                            width: SLOT_WIDTH, 
                            height: slot === 'EMPTY' ? 0 : SLOT_HEIGHT 
                          }}
                          initial="hidden"
                          animate="visible"
                          exit="empty"
                          variants={slotVariants}
                          transition={{ 
                            duration: 0.5, 
                            delay: index * 0.03,
                            ease: 'easeOut' 
                          }}
                        >
                          {slot !== 'EMPTY' && (
                            <div className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center text-white text-[8px] font-bold">
                              {slot}
                            </div>
                          )}
                          {animationType === 'handling' && slot !== 'EMPTY' && (
                            <motion.div
                              className="absolute inset-0 bg-white/20 rounded-t-sm"
                              animate="handling"
                              variants={slotVariants}
                            />
                          )}
                        </motion.div>
                      ))}
                      
                      {/* Empty slots */}
                      {[...Array(safeEmptySlots)].map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="w-[14px] h-0 bg-gray-200 dark:bg-gray-700 rounded-t-sm"
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  
                  {/* Capacity indicator */}
                  <div className="absolute top-1 right-8 w-16 text-right text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {safeSlots.filter(s => s !== 'EMPTY').length} / {safeCapacity}
                  </div>
                </div>
                
                {/* Wheels */}
                <div className="flex justify-between mt-1 px-2">
                  <div className="w-6 h-6 bg-gray-900 rounded-full border-2 border-gray-700 relative">
                    <div className="absolute inset-1 bg-gray-700 rounded-full" />
                  </div>
                  <div className="w-6 h-6 bg-gray-900 rounded-full border-2 border-gray-700 relative">
                    <div className="absolute inset-1 bg-gray-700 rounded-full" />
                  </div>
                  <div className="w-6 h-6 bg-gray-900 rounded-full border-2 border-gray-700 relative">
                    <div className="absolute inset-1 bg-gray-700 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Load Summary */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="font-medium text-red-600 dark:text-red-400">
            α Entregas: {aOnTruck}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-cyan-500 rounded" />
          <span className="font-medium text-cyan-600 dark:text-cyan-400">
            β Recolecciones: {bOnTruck}
          </span>
        </div>
        {handlingCount > 0 && (
          <motion.div
            className="flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full border border-amber-300 dark:border-amber-700"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="w-3 h-3 bg-amber-500 rounded animate-pulse" />
            <span className="font-medium text-amber-700 dark:text-amber-300">
              Handling: {handlingCount} ops
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}