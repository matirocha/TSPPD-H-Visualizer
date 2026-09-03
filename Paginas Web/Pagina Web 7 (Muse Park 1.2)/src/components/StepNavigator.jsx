'use client'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Gauge } from 'lucide-react'
import { cn } from '../lib/utils'

export function StepNavigator({ current=0, total=1, isPlaying=false, onStep, onPlayPause, onReset, speed=1, onSpeed }) {
  const safeTotal = Math.max(1, Math.floor(Number(total)||1))
  const safeCur = Math.min(Math.max(0, current), safeTotal-1)
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {[...Array(safeTotal)].map((_, i)=>{
          const active = i===safeCur
          const done = i<safeCur
          return (
            <button
              key={i}
              onClick={()=>onStep(i)}
              className={cn(
                "shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition",
                active ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow" : done ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-[#065F46] dark:text-emerald-200" : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 text-slate-700 dark:text-zinc-300"
              )}
            >
              <span className={cn("w-7 h-7 rounded-full grid place-items-center text-xs font-mono font-bold border", active ? "bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-white" : done ? "bg-[#047857] text-white border-[#047857]" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300")}>{i+1}</span>
              <span className="hidden sm:inline font-medium whitespace-nowrap">{i===0?'Depósito': i===safeTotal-1?'Retorno':'Paso '+(i+1)}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900 animate-pulse hidden sm:inline-block" />}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <motion.button onClick={onReset} whileTap={{scale:0.96}} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 grid place-items-center hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            <RotateCcw className="w-4 h-4" />
          </motion.button>
          <motion.button onClick={()=>onStep(Math.max(0, safeCur-1))} disabled={safeCur===0} whileTap={{scale:0.96}} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 grid place-items-center disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <motion.button onClick={onPlayPause} whileTap={{scale:0.96}} className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center gap-2 font-medium shadow border border-slate-900 dark:border-white">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pausar' : 'Reproducir'}
          </motion.button>
          <motion.button onClick={()=>onStep(Math.min(safeTotal-1, safeCur+1))} disabled={safeCur>=safeTotal-1} whileTap={{scale:0.96}} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 grid place-items-center disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 dark:text-zinc-400"><Gauge className="w-3.5 h-3.5" /> Velocidad</span>
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1">
            {[0.5,1,1.5,2].map(v=>(
              <button key={v} onClick={()=>onSpeed(v)} className={cn("px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border", speed===v ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border-transparent")}>{v}x</button>
            ))}
          </div>
          <span className="text-xs font-mono text-slate-600 dark:text-zinc-400 hidden md:inline">{safeCur+1} / {safeTotal}</span>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden border border-slate-200 dark:border-zinc-700">
        <motion.div className="h-full bg-slate-900 dark:bg-white" initial={{width:0}} animate={{width:`${((safeCur+1)/safeTotal)*100}%`}} transition={{duration:0.5, ease:[0.16,1,0.3,1]}} />
      </div>
    </div>
  )
}
