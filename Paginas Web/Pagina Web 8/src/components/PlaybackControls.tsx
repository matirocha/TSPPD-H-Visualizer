import { motion } from 'motion/react'
import {
  SkipBack,
  CaretLeft,
  Play,
  Pause,
  CaretRight,
  SkipForward
} from '@phosphor-icons/react'
import { cn } from '@/components/ui/cn'

interface PlaybackControlsProps {
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  playSpeed: number
  onPlay: () => void
  onPause: () => void
  onPrev: () => void
  onNext: () => void
  onFirst: () => void
  onLast: () => void
  onSpeedChange: (ms: number) => void
}

const SPEED_OPTIONS = [
  { label: '0.5×', ms: 6000 },
  { label: '1×', ms: 3000 },
  { label: '1.5×', ms: 2000 },
  { label: '2×', ms: 1500 },
  { label: '3×', ms: 1000 },
]

export default function PlaybackControls({
  currentStep,
  totalSteps,
  isPlaying,
  playSpeed,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onFirst,
  onLast,
  onSpeedChange,
}: PlaybackControlsProps) {
  const isAtStart = currentStep === 0
  const isAtEnd = currentStep === totalSteps - 1

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-950/60">
      {/* Step counter */}
      <span className="text-[11px] font-mono text-zinc-500 w-16 text-center flex-shrink-0">
        {currentStep + 1} / {totalSteps}
      </span>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        {/* Skip to start */}
        <motion.button
          onClick={onFirst}
          disabled={isAtStart}
          whileHover={!isAtStart ? { scale: 1.1 } : {}}
          whileTap={!isAtStart ? { scale: 0.9 } : {}}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isAtStart
              ? 'text-zinc-700 cursor-not-allowed'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          )}
        >
          <SkipBack size={14} weight="bold" />
        </motion.button>

        {/* Previous */}
        <motion.button
          onClick={onPrev}
          disabled={isAtStart}
          whileHover={!isAtStart ? { scale: 1.1 } : {}}
          whileTap={!isAtStart ? { scale: 0.9 } : {}}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isAtStart
              ? 'text-zinc-700 cursor-not-allowed'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          )}
        >
          <CaretLeft size={14} weight="bold" />
        </motion.button>

        {/* Play / Pause */}
        <motion.button
          onClick={isPlaying ? onPause : onPlay}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition-colors flex-shrink-0"
        >
          {isPlaying
            ? <Pause size={16} weight="fill" />
            : <Play size={16} weight="fill" />
          }
        </motion.button>

        {/* Next */}
        <motion.button
          onClick={onNext}
          disabled={isAtEnd}
          whileHover={!isAtEnd ? { scale: 1.1 } : {}}
          whileTap={!isAtEnd ? { scale: 0.9 } : {}}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isAtEnd
              ? 'text-zinc-700 cursor-not-allowed'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          )}
        >
          <CaretRight size={14} weight="bold" />
        </motion.button>

        {/* Skip to end */}
        <motion.button
          onClick={onLast}
          disabled={isAtEnd}
          whileHover={!isAtEnd ? { scale: 1.1 } : {}}
          whileTap={!isAtEnd ? { scale: 0.9 } : {}}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isAtEnd
              ? 'text-zinc-700 cursor-not-allowed'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          )}
        >
          <SkipForward size={14} weight="bold" />
        </motion.button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-800 flex-shrink-0" />

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-zinc-600 font-mono mr-1">vel.</span>
        {SPEED_OPTIONS.map(opt => (
          <motion.button
            key={opt.ms}
            onClick={() => onSpeedChange(opt.ms)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'text-[10px] font-mono px-2 py-1 rounded transition-colors',
              playSpeed === opt.ms
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
            )}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          animate={{ width: `${((currentStep) / Math.max(totalSteps - 1, 1)) * 100}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
