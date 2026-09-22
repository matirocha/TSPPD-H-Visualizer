import { motion, AnimatePresence } from 'motion/react'
import { SolutionSummary } from '@/types/solution'
import { cn } from '@/components/ui/cn'
import { MapTrifold, Package, Coins, ChartBar } from '@phosphor-icons/react'

interface SolutionSelectorProps {
  solutions: SolutionSummary[]
  selectedFile: string | null
  onSelect: (filename: string) => void
}

export default function SolutionSelector({ solutions, selectedFile, onSelect }: SolutionSelectorProps) {
  if (solutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 p-6 text-center">
        <Package size={32} className="text-zinc-700 mb-3" />
        <p className="text-xs text-zinc-500">Sin soluciones en Outputs/</p>
        <p className="text-[10px] text-zinc-700 mt-1">Ejecuta el modelo TSPPD-H primero</p>
      </div>
    )
  }

  return (
    <div className="p-2 flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 px-2 pt-2 pb-1 font-mono">
        {solutions.length} soluciones disponibles
      </p>
      {solutions.map((sol, idx) => {
        const isSelected = sol.filename === selectedFile
        const handlingPct = sol.objectiveValue > 0
          ? ((sol.handlingCost / sol.objectiveValue) * 100).toFixed(0)
          : '0'
        return (
          <motion.button
            key={sol.filename}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => onSelect(sol.filename)}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2.5 transition-colors border',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
              isSelected
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700'
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold leading-tight font-mono">
                ID #{sol.instanceId}
              </span>
              <span className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold',
                isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-500'
              )}>
                {sol.numCustomers} clientes
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
              <div className="flex items-center gap-1">
                <ChartBar size={10} className={isSelected ? 'text-blue-400' : 'text-zinc-600'} />
                <span className={cn('text-[10px] font-mono', isSelected ? 'text-blue-200' : 'text-zinc-400')}>
                  {sol.objectiveValue.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MapTrifold size={10} className={isSelected ? 'text-emerald-400' : 'text-zinc-600'} />
                <span className={cn('text-[10px] font-mono', isSelected ? 'text-emerald-300' : 'text-zinc-400')}>
                  {sol.totalDistance} km
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Package size={10} className={sol.handlingCost > 0 ? 'text-amber-400' : 'text-zinc-600'} />
                <span className={cn(
                  'text-[10px] font-mono',
                  sol.handlingCost > 0 ? 'text-amber-300' : 'text-zinc-500'
                )}>
                  {sol.handlingCost.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Coins size={10} className={isSelected ? 'text-zinc-400' : 'text-zinc-600'} />
                <span className="text-[10px] font-mono text-zinc-500">h={sol.h}</span>
              </div>
            </div>

            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 pt-2 border-t border-blue-500/20">
                    <p className="text-[9px] text-blue-400/70 font-mono">
                      Tour: {sol.tour.join(' → ')}
                    </p>
                    <p className="text-[9px] text-blue-400/50 font-mono mt-0.5">
                      Q={sol.capacity} · Handling {handlingPct}%
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </div>
  )
}
