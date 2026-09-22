import React from 'react';
import { Step, NodeDef } from '../types/solution';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  nodes: NodeDef[];
  onStepClick: (step: number) => void;
}

export function StepProgress({ steps, currentStep, nodes, onStepClick }: StepProgressProps) {
  const getNodeLabel = (id: number) => nodes.find(n => n.id === id)?.label || String(id);

  return (
    <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-4 px-2">
      <div className="flex items-center min-w-max relative">
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -translate-y-1/2 rounded-full z-0" />
        
        <div 
          className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 rounded-full z-0 transition-all duration-300" 
          style={{ width: steps.length > 1 ? `${(Math.min(currentStep, steps.length - 1) / (steps.length - 1)) * 100}%` : '0%' }}
        />

        {steps.map((step, index) => {
          const isPast = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <div 
              key={index} 
              className="relative z-10 flex-1 flex justify-center group cursor-pointer px-4 min-w-[40px]"
              onClick={() => onStepClick(index)}
            >
              {isCurrent && (
                <motion.div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-emerald-500 pointer-events-none"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              
              <div 
                className={cn(
                  "w-3 h-3 rounded-full transition-colors relative z-10",
                  isPast ? "bg-emerald-500" : isCurrent ? "bg-emerald-400" : "bg-zinc-700",
                  "group-hover:ring-4 ring-zinc-700/50"
                )} 
              />
              
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-max">
                <div className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-lg shadow-xl flex flex-col items-center">
                  <div className="font-semibold text-zinc-400 mb-0.5">Paso {index + 1}</div>
                  <div>{getNodeLabel(step.from)} &rarr; {getNodeLabel(step.to)}</div>
                  <div className="text-zinc-500">{step.distance.toFixed(2)} km</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
