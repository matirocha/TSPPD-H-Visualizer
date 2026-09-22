import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { Step, AnimationPhase } from '../types/solution';

interface CargoCompartmentProps {
  step: Step | null;
  prevStep: Step | null;
  phase: AnimationPhase;
  phaseProgress: number;
}

export function CargoCompartment({ step, prevStep, phase }: CargoCompartmentProps) {
  const currentSlots = step?.slots || [];
  const prevSlots = prevStep?.slots || Array(currentSlots.length).fill('EMPTY');
  
  const handlingCount = step?.handlingCount || 0;
  const isHandling = handlingCount > 0 && phase !== 'moving' && phase !== 'idle' && phase !== 'step-complete';

  // Determine active slots based on phase
  const displaySlots = useMemo(() => {
    if (phase === 'idle' || phase === 'step-complete') {
      return currentSlots;
    }
    if (phase === 'moving') {
      return prevSlots;
    }
    
    let slots = [...prevSlots];
    
    if (phase === 'handling-out' || phase === 'unloading-alpha' || phase === 'handling-back') {
      // Temporary items are the first `handlingCount` of prevSlots
      for (let i = 0; i < handlingCount; i++) {
        slots[i] = 'EMPTY';
      }
      
      if (phase === 'unloading-alpha' || phase === 'handling-back') {
        // Alpha items are delivered
        if (step) {
          for (let i = 0; i < step.deliverA; i++) {
            const idx = slots.indexOf('A');
            if (idx !== -1) slots[idx] = 'EMPTY';
          }
        }
      }
    }
    
    if (phase === 'handling-back' || phase === 'loading-beta') {
      // Put handling items back
      let putBackCount = 0;
      for(let i = 0; i < handlingCount; i++) {
         const type = prevSlots[i];
         const emptyIdx = slots.indexOf('EMPTY');
         if (emptyIdx !== -1) {
             slots[emptyIdx] = type;
         }
      }
    }

    if (phase === 'loading-beta') {
      return currentSlots;
    }

    return slots;
  }, [phase, currentSlots, prevSlots, step, handlingCount]);

  const temporaryItems = useMemo(() => {
    if (phase === 'handling-out' || phase === 'unloading-alpha') {
      return prevSlots.slice(0, handlingCount);
    }
    return [];
  }, [phase, prevSlots, handlingCount]);

  const countA = displaySlots.filter(s => s === 'A').length;
  const countB = displaySlots.filter(s => s === 'B').length;

  return (
    <div className="bg-zinc-900/60 rounded-2xl p-5 border border-zinc-800 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h3 className="text-zinc-200 font-semibold tracking-wide">Compartimiento LIFO</h3>
        <div className="flex items-center gap-4 text-sm font-medium">
          <span className="text-red-400">α: {countA}</span>
          <span className="text-cyan-400">β: {countB}</span>
        </div>
      </div>

      {isHandling && (
        <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 p-2 rounded-lg text-sm border border-amber-400/20">
          <AlertCircle className="w-4 h-4" />
          <span>Handling en progreso ({handlingCount} mov.)</span>
        </div>
      )}

      <div className="flex flex-col gap-6 pt-2">
        <div className="flex items-center justify-between text-xs text-zinc-500 uppercase tracking-wider font-bold">
          <div className="flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Puerta Trasera</div>
          <div className="flex items-center gap-1">Fondo del Camion <ArrowRight className="w-3 h-3" /></div>
        </div>

        <div className="relative border-4 border-l-0 border-zinc-700/50 rounded-r-lg p-3 min-h-[120px] bg-zinc-950/50">
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {displaySlots.map((type, idx) => {
                const isA = type === 'A';
                const isB = type === 'B';
                
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -20 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 300, 
                      damping: 25, 
                      delay: idx * 0.05 
                    }}
                    key={`slot-${idx}-${type}`}
                    className={cn(
                      "w-10 h-10 rounded-md border-2 flex items-center justify-center font-bold text-sm shadow-sm",
                      isA ? "bg-red-500/80 border-red-400 text-red-50" : 
                      isB ? "bg-cyan-500/80 border-cyan-400 text-cyan-50" : 
                      "bg-zinc-800/40 border-zinc-700/50 text-transparent"
                    )}
                  >
                    {isA ? 'α' : isB ? 'β' : ''}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {temporaryItems.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-4 p-3 bg-zinc-950/50 rounded-lg border border-dashed border-zinc-700"
            >
              <div className="text-xs text-zinc-400 mb-2 font-medium">Area temporal (Handling)</div>
              <div className="flex gap-2">
                {temporaryItems.map((type, idx) => (
                  <motion.div
                    key={`temp-${idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                      "w-8 h-8 rounded border-2 flex items-center justify-center font-bold text-xs",
                      type === 'B' ? "bg-cyan-500/50 border-cyan-500/80 text-cyan-100" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                    )}
                  >
                    {type === 'B' ? 'β' : ''}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
