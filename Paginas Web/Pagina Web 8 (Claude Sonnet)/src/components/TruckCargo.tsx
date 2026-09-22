import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Solution, SlotType } from '@/types/solution'
import { cn } from '@/components/ui/cn'
import { Warning, DoorOpen } from '@phosphor-icons/react'

interface TruckCargoProps {
  solution: Solution
  currentStep: number
}

interface SlotItemProps {
  slotIdx: number
  type: SlotType
  animMode: 'in' | 'out' | 'idle' | 'handling'
  staggerDelay: number
  prefersReduced: boolean
}

function SlotItem({ slotIdx, type, animMode, staggerDelay, prefersReduced }: SlotItemProps) {
  if (type === 'EMPTY') {
    return (
      <div
        className="w-full rounded-sm border border-zinc-800/60 bg-zinc-900/30"
        style={{ height: '100%' }}
        title={`Pos ${slotIdx + 1}: Vacío`}
      />
    )
  }

  const isA = type === 'A'
  const colorBg = isA ? 'bg-red-600' : 'bg-cyan-600'
  const colorBorder = isA ? 'border-red-500/60' : 'border-cyan-500/60'
  const colorGlow = isA ? 'shadow-red-500/20' : 'shadow-cyan-500/20'

  const getVariants = () => {
    if (prefersReduced) return {}
    if (animMode === 'in') return {
      initial: { opacity: 0, scaleY: 0, y: 12 },
      animate: { opacity: 1, scaleY: 1, y: 0 },
      transition: { duration: 0.5, delay: staggerDelay, ease: [0.16, 1, 0.3, 1] }
    }
    if (animMode === 'out') return {
      initial: { opacity: 1, scaleY: 1, y: 0 },
      animate: { opacity: 0, scaleY: 0, y: -12 },
      transition: { duration: 0.4, delay: staggerDelay, ease: [0.4, 0, 1, 1] }
    }
    if (animMode === 'handling') return {
      animate: { x: [0, -4, 4, -3, 3, 0], backgroundColor: ['#0891b2', '#f59e0b', '#0891b2'] },
      transition: { duration: 0.8, delay: staggerDelay, ease: 'easeInOut' }
    }
    return {}
  }

  const variants = getVariants()

  return (
    <motion.div
      className={cn(
        'w-full rounded-sm border flex items-center justify-center',
        colorBg, colorBorder, `shadow-sm ${colorGlow}`
      )}
      style={{ height: '100%', originY: animMode === 'in' ? 1 : 0 }}
      title={`Pos ${slotIdx + 1}: ${isA ? 'Entrega α' : 'Recolección β'}`}
      {...variants}
    >
      <span className="text-[7px] font-bold font-mono text-white/80">
        {isA ? 'α' : 'β'}
      </span>
    </motion.div>
  )
}

type AnimPhase = 'idle' | 'unloading' | 'handling' | 'loading'

export default function TruckCargo({ solution, currentStep }: TruckCargoProps) {
  const prefersReduced = useReducedMotion() ?? false
  const step = solution.steps[currentStep]
  const nextStep = solution.steps[currentStep + 1]

  // Display slots: animates between current step state and next step state
  // While traveling: show current step slots
  // We animate on step change
  const currentSlots = step.slots
  const [displaySlots, setDisplaySlots] = useState<SlotType[]>(currentSlots)
  const [animPhase, setAnimPhase] = useState<AnimPhase>('idle')
  const [changingIdxs, setChangingIdxs] = useState<Set<number>>(new Set())
  const prevStepRef = useRef(currentStep)
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    phaseTimersRef.current.forEach(t => clearTimeout(t))
    phaseTimersRef.current = []
  }

  useEffect(() => {
    const prevStep = prevStepRef.current
    prevStepRef.current = currentStep

    if (prefersReduced) {
      setDisplaySlots(currentSlots)
      setAnimPhase('idle')
      setChangingIdxs(new Set())
      return
    }

    clearTimers()

    // Find which slots changed from previous display to current
    const prevSlots = displaySlots
    const removedIdxs: number[] = []
    const addedIdxs: number[] = []

    currentSlots.forEach((slot, i) => {
      const prev = prevSlots[i] ?? 'EMPTY'
      if (slot === 'EMPTY' && prev !== 'EMPTY') removedIdxs.push(i)
      if (slot !== 'EMPTY' && prev === 'EMPTY') addedIdxs.push(i)
    })

    if (removedIdxs.length === 0 && addedIdxs.length === 0) {
      setDisplaySlots(currentSlots)
      setAnimPhase('idle')
      setChangingIdxs(new Set())
      return
    }

    // Phase 1: Unloading (animate out items that are being removed)
    if (removedIdxs.length > 0) {
      setAnimPhase('unloading')
      setChangingIdxs(new Set(removedIdxs))

      const unloadDuration = Math.min(removedIdxs.length * 100 + 600, 2000)

      const t1 = setTimeout(() => {
        // Phase 2: Handling (if applicable) or directly to loading
        const hasHandling = step.handlingCount > 0
        if (hasHandling) {
          setAnimPhase('handling')
          // Find B items that are in the new slots (they survived = picked up)
          const handlingIdxs = currentSlots
            .map((s, i) => s === 'B' ? i : -1)
            .filter(i => i !== -1)
          setChangingIdxs(new Set(handlingIdxs.slice(0, Math.min(handlingIdxs.length, 6))))

          const t2 = setTimeout(() => {
            // Update display to final state (remove delivered items)
            const intermediate = prevSlots.map((s, i) => {
              if (removedIdxs.includes(i)) return 'EMPTY' as SlotType
              return s
            })
            setDisplaySlots(intermediate)

            // Phase 3: Loading
            if (addedIdxs.length > 0) {
              setAnimPhase('loading')
              setChangingIdxs(new Set(addedIdxs))
              const loadDuration = Math.min(addedIdxs.length * 120 + 500, 2500)
              const t3 = setTimeout(() => {
                setDisplaySlots(currentSlots)
                setAnimPhase('idle')
                setChangingIdxs(new Set())
              }, loadDuration)
              phaseTimersRef.current.push(t3)
            } else {
              setDisplaySlots(currentSlots)
              setAnimPhase('idle')
              setChangingIdxs(new Set())
            }
          }, 900)
          phaseTimersRef.current.push(t2)
        } else {
          // No handling, go directly to loading
          const intermediate = prevSlots.map((s, i) => {
            if (removedIdxs.includes(i)) return 'EMPTY' as SlotType
            return s
          })
          setDisplaySlots(intermediate)

          if (addedIdxs.length > 0) {
            setAnimPhase('loading')
            setChangingIdxs(new Set(addedIdxs))
            const loadDuration = Math.min(addedIdxs.length * 120 + 500, 2500)
            const t2 = setTimeout(() => {
              setDisplaySlots(currentSlots)
              setAnimPhase('idle')
              setChangingIdxs(new Set())
            }, loadDuration)
            phaseTimersRef.current.push(t2)
          } else {
            setDisplaySlots(currentSlots)
            setAnimPhase('idle')
            setChangingIdxs(new Set())
          }
        }
      }, unloadDuration)
      phaseTimersRef.current.push(t1)
    } else if (addedIdxs.length > 0) {
      // Only loading (no unloading)
      setAnimPhase('loading')
      setChangingIdxs(new Set(addedIdxs))
      const loadDuration = Math.min(addedIdxs.length * 120 + 500, 2500)
      const t1 = setTimeout(() => {
        setDisplaySlots(currentSlots)
        setAnimPhase('idle')
        setChangingIdxs(new Set())
      }, loadDuration)
      phaseTimersRef.current.push(t1)
    }

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  const capacity = solution.capacity
  const aCount = displaySlots.filter(s => s === 'A').length
  const bCount = displaySlots.filter(s => s === 'B').length
  const emptyCount = displaySlots.filter(s => s === 'EMPTY').length

  // Layout: 8 columns, N rows
  const COLS = 8
  const rows: Array<Array<{ slotIdx: number; type: SlotType }>> = []
  for (let i = 0; i < capacity; i += COLS) {
    const row: Array<{ slotIdx: number; type: SlotType }> = []
    for (let j = i; j < Math.min(i + COLS, capacity); j++) {
      row.push({ slotIdx: j, type: displaySlots[j] ?? 'EMPTY' })
    }
    rows.push(row)
  }

  const phaseLabels: Record<AnimPhase, string> = {
    idle: 'En tránsito',
    unloading: 'Descargando α...',
    handling: 'Manipulando (LIFO)...',
    loading: 'Cargando β...',
  }
  const phaseColors: Record<AnimPhase, string> = {
    idle: 'text-zinc-500',
    unloading: 'text-red-400',
    handling: 'text-amber-400',
    loading: 'text-cyan-400',
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
          Compartimiento LIFO
        </p>
        <div className="flex items-center gap-2">
          {animPhase !== 'idle' && (
            <motion.span
              key={animPhase}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn('text-[10px] font-mono font-semibold', phaseColors[animPhase])}
            >
              {phaseLabels[animPhase]}
            </motion.span>
          )}
          {step.handlingCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5"
            >
              <Warning size={9} weight="fill" className="text-amber-400 animate-pulse-warning" />
              <span className="text-[9px] font-mono text-amber-300">{step.handlingCount} handling</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Truck compartment container */}
      <div className="flex-1 flex flex-col bg-zinc-900/40 rounded-xl border border-zinc-800 overflow-hidden">
        {/* Door label */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 flex-shrink-0">
          <DoorOpen size={12} className="text-zinc-500" />
          <span className="text-[9px] font-mono text-zinc-600">PUERTA (pos 1)</span>
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[9px] font-mono text-zinc-600">FONDO (pos {capacity})</span>
        </div>

        {/* Slots grid */}
        <div className="flex-1 p-2.5 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1">
                {/* Row position label */}
                <div className="w-5 flex-shrink-0 flex items-center">
                  <span className="text-[7px] font-mono text-zinc-700">
                    {rowIdx * COLS + 1}
                  </span>
                </div>
                {/* Slots */}
                {row.map(({ slotIdx, type }) => {
                  const isChanging = changingIdxs.has(slotIdx)
                  let mode: 'in' | 'out' | 'idle' | 'handling' = 'idle'
                  if (isChanging) {
                    if (animPhase === 'unloading') mode = 'out'
                    else if (animPhase === 'loading') mode = 'in'
                    else if (animPhase === 'handling') mode = 'handling'
                  }

                  // Stagger delay within row
                  const staggerDelay = isChanging
                    ? Array.from(changingIdxs).indexOf(slotIdx) * 0.08
                    : 0

                  return (
                    <div key={slotIdx} className="flex-1" style={{ height: 18 }}>
                      <SlotItem
                        slotIdx={slotIdx}
                        type={type}
                        animMode={mode}
                        staggerDelay={staggerDelay}
                        prefersReduced={prefersReduced}
                      />
                    </div>
                  )
                })}
                {/* Fill empty cells if last row is not full */}
                {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Cargo stats footer */}
        <div className="flex items-center justify-around px-3 py-2 border-t border-zinc-800 bg-zinc-900/60 flex-shrink-0">
          <div className="text-center">
            <motion.p
              key={`a-${aCount}`}
              initial={{ scale: 1.3, color: '#ef4444' }}
              animate={{ scale: 1, color: '#fca5a5' }}
              transition={{ duration: 0.4 }}
              className="text-base font-bold font-mono text-red-400 leading-none"
            >
              {aCount}
            </motion.p>
            <p className="text-[9px] font-mono text-red-600">unid. α</p>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="text-center">
            <motion.p
              key={`b-${bCount}`}
              initial={{ scale: 1.3, color: '#06b6d4' }}
              animate={{ scale: 1, color: '#67e8f9' }}
              transition={{ duration: 0.4 }}
              className="text-base font-bold font-mono text-cyan-400 leading-none"
            >
              {bCount}
            </motion.p>
            <p className="text-[9px] font-mono text-cyan-600">unid. β</p>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="text-center">
            <p className="text-base font-bold font-mono text-zinc-600 leading-none">{emptyCount}</p>
            <p className="text-[9px] font-mono text-zinc-700">vacíos</p>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="text-center">
            <p className="text-base font-bold font-mono text-zinc-400 leading-none">{capacity}</p>
            <p className="text-[9px] font-mono text-zinc-600">Q total</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-shrink-0">
        <LegendItem color="bg-red-600" label="α Entrega (LIFO fondo)" />
        <LegendItem color="bg-cyan-600" label="β Recolección (LIFO puerta)" />
        <LegendItem color="bg-zinc-800" label="Vacío" border />
      </div>
    </div>
  )
}

function LegendItem({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-3 h-3 rounded-sm flex-shrink-0', color, border && 'border border-zinc-700')} />
      <span className="text-[9px] font-mono text-zinc-500">{label}</span>
    </div>
  )
}
