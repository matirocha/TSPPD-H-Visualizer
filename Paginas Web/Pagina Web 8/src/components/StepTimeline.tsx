import { motion } from 'motion/react'
import { SolutionStep } from '@/types/solution'
import { cn } from '@/components/ui/cn'
import { Warning } from '@phosphor-icons/react'

interface StepTimelineProps {
  steps: SolutionStep[]
  currentStep: number
  onStepChange: (step: number) => void
  nodes: Array<{ id: number; label: string; isDepot: boolean }>
}

export default function StepTimeline({ steps, currentStep, onStepChange, nodes }: StepTimelineProps) {
  const getNodeLabel = (id: number) => {
    const n = nodes.find(n => n.id === id)
    if (!n) return `N${id}`
    if (n.isDepot) return 'D'
    return `C${id}`
  }

  return (
    <div className="px-4 py-2 border-b border-zinc-800 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep
          const isPast = idx < currentStep
          const hasHandling = step.handlingCount > 0

          return (
            <div key={idx} className="flex items-center gap-1">
              {/* Step button */}
              <motion.button
                onClick={() => onStepChange(idx)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                title={`Paso ${idx + 1}: ${nodes.find(n => n.id === step.from)?.label} → ${nodes.find(n => n.id === step.to)?.label} (${step.distance} km)`}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-colors',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                  isActive
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : isPast
                      ? 'bg-zinc-800/60 border border-zinc-700/50'
                      : 'bg-transparent border border-transparent hover:bg-zinc-800/40 hover:border-zinc-700'
                )}
              >
                {/* Handling indicator */}
                {hasHandling && (
                  <Warning
                    size={8}
                    weight="fill"
                    className="absolute -top-0.5 -right-0.5 text-amber-400"
                  />
                )}

                {/* Step number */}
                <span className={cn(
                  'text-[9px] font-mono font-bold',
                  isActive ? 'text-blue-300' : isPast ? 'text-zinc-500' : 'text-zinc-600'
                )}>
                  {idx + 1}
                </span>

                {/* From → To */}
                <span className={cn(
                  'text-[9px] font-mono leading-none',
                  isActive ? 'text-blue-200' : isPast ? 'text-zinc-500' : 'text-zinc-600'
                )}>
                  {getNodeLabel(step.from)}→{getNodeLabel(step.to)}
                </span>

                {/* Distance */}
                <span className={cn(
                  'text-[8px] font-mono',
                  isActive ? 'text-blue-400/70' : 'text-zinc-700'
                )}>
                  {step.distance}km
                </span>

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="timeline-indicator"
                    className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-400 rounded-full"
                  />
                )}
              </motion.button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className={cn(
                  'w-3 h-px rounded-full flex-shrink-0',
                  idx < currentStep ? 'bg-zinc-600' : 'bg-zinc-800'
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
