'use client'
import { motion } from 'framer-motion'
import { Info, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { cn } from '../lib/utils'

export function StepExplanation({ step, isActive, isCompleted, onClick }) {
  if (!step) return null
  return (
    <motion.button
      onClick={onClick}
      layout
      className={cn(
        "w-full text-left rounded-2xl border p-4 transition flex gap-3",
        isActive ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-lg" : isCompleted ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600"
      )}
    >
      <span className={cn("w-9 h-9 rounded-xl grid place-items-center shrink-0 border text-xs font-mono font-bold",
        isActive ? "bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-white dark:border-slate-900" : isCompleted ? "bg-[#047857] text-white border-[#047857]" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
      )}>
        {isCompleted && !isActive ? <CheckCircle2 className="w-4 h-4" /> : step.stepIndex+1}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold flex items-center gap-2", isActive ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-zinc-100")}>
          {step.from===0?'Depósito':`Cliente ${step.from}`} <ArrowRight className={cn("w-3.5 h-3.5", isActive ? "text-white/70 dark:text-slate-500" : "text-slate-500")} /> {step.to===0?'Depósito':`Cliente ${step.to}`}
          <span className={cn("ml-auto text-xs font-mono px-2 py-0.5 rounded-full border font-semibold", isActive ? "bg-white text-slate-900 border-white dark:bg-slate-900 dark:text-white dark:border-slate-900" : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300")}>{step.distance} km</span>
        </p>
        <div className={cn("mt-2 text-[13px] leading-relaxed prose prose-sm max-w-none",
          isActive ? "prose-invert dark:prose-invert-0" : "prose-slate dark:prose-invert"
        )} dangerouslySetInnerHTML={{__html: step.explanation}} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {step.deliverA>0 && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-mono border font-semibold", isActive ? "bg-[#DC2626] text-white border-[#991B1B]" : "bg-[#FEF2F2] dark:bg-red-950/30 text-[#991B1B] dark:text-red-200 border-red-200 dark:border-red-800")}>α {step.deliverA} entrega</span>}
          {step.pickupB>0 && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-mono border font-semibold", isActive ? "bg-[#0E7490] text-white border-[#0C5A6E]" : "bg-[#ECFEFF] dark:bg-cyan-950/30 text-[#0C5A6E] dark:text-cyan-200 border-cyan-200 dark:border-cyan-800")}>β {step.pickupB} recojo</span>}
          {step.handlingCount>0 && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-mono border inline-flex items-center gap-1 font-semibold", isActive ? "bg-[#F59E0B] text-slate-900 border-[#D97706]" : "bg-amber-50 dark:bg-amber-950/30 text-[#92400E] dark:text-amber-200 border-amber-200 dark:border-amber-800")}><AlertTriangle className="w-3 h-3" /> Handling {step.handlingCount} · ${Number(step.handlingCost).toFixed(2)}</span>}
          {step.handlingCount===0 && step.deliverA+step.pickupB>0 && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-mono border", isActive ? "bg-white/15 border-white/30 text-white dark:bg-slate-900 dark:text-zinc-300 dark:border-zinc-700" : "bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700")}>sin handling</span>}
        </div>
      </div>
    </motion.button>
  )
}
