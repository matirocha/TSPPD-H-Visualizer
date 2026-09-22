import { motion } from 'motion/react'
import { SolutionStep } from '@/types/solution'
import { cn } from '@/components/ui/cn'
import { Warning, CheckCircle, ArrowRight, Package } from '@phosphor-icons/react'

interface StepExplanationProps {
  step: SolutionStep
  stepNumber: number
  totalSteps: number
  nodes: Array<{ id: number; label: string; isDepot: boolean }>
}

export default function StepExplanation({ step, stepNumber, totalSteps, nodes }: StepExplanationProps) {
  const fromNode = nodes.find(n => n.id === step.from)
  const toNode = nodes.find(n => n.id === step.to)
  const hasHandling = step.handlingCount > 0
  const isLast = step.to === 0

  return (
    <motion.div
      key={step.stepIndex}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30"
    >
      <div className="flex items-start gap-3">
        {/* Step indicator */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
          <span className="text-[10px] font-bold font-mono text-blue-400">{stepNumber}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* From → To */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={cn(
              'text-xs font-semibold font-mono px-2 py-0.5 rounded',
              fromNode?.isDepot ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-300'
            )}>
              {fromNode?.label ?? `Nodo ${step.from}`}
            </span>
            <ArrowRight size={12} className="text-zinc-600 flex-shrink-0" />
            <span className={cn(
              'text-xs font-semibold font-mono px-2 py-0.5 rounded',
              toNode?.isDepot ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-300'
            )}>
              {toNode?.label ?? `Nodo ${step.to}`}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono ml-1">{step.distance} km</span>
          </div>

          {/* Cargo info row */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {step.deliverA > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-red-500 flex-shrink-0" />
                <span className="text-[11px] text-red-300 font-mono">
                  Entrega {step.deliverA}α
                </span>
              </div>
            )}
            {step.pickupB > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-cyan-500 flex-shrink-0" />
                <span className="text-[11px] text-cyan-300 font-mono">
                  Recoge {step.pickupB}β
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[10px] text-zinc-600 font-mono">
                En camión:
              </span>
              <span className="text-[10px] text-red-400 font-mono">{step.aOnTruck}α</span>
              <span className="text-[10px] text-zinc-600 font-mono">·</span>
              <span className="text-[10px] text-cyan-400 font-mono">{step.bOnTruck}β</span>
            </div>
          </div>

          {/* Handling warning */}
          {hasHandling && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5 mb-2"
            >
              <Warning size={13} className="text-amber-400 flex-shrink-0 mt-0.5 animate-pulse-warning" weight="fill" />
              <div>
                <span className="text-[11px] text-amber-300 font-semibold">
                  Conflicto LIFO · {step.handlingCount} operaciones handling
                </span>
                <span className="text-[10px] text-amber-400/70 font-mono ml-2">
                  +{step.handlingCost.toFixed(2)} costo
                </span>
              </div>
            </motion.div>
          )}

          {/* Natural language explanation */}
          <p
            className="text-[11px] text-zinc-400 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: step.explanation }}
          />

          {/* Final step badge */}
          {isLast && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 mt-2"
            >
              <CheckCircle size={14} className="text-emerald-400" weight="fill" />
              <span className="text-[11px] text-emerald-400 font-semibold">Tour completado exitosamente</span>
            </motion.div>
          )}
        </div>

        {/* Step counter */}
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] font-mono text-zinc-600">
            {stepNumber}/{totalSteps}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
