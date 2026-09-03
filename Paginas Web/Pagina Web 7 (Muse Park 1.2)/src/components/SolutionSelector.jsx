'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, Layers, Route, Box } from 'lucide-react'
import { cn } from '../lib/utils'

export function SolutionSelector({ solutions=[], selected, onSelect, isLoading }) {
  const [open, setOpen] = useState(false)
  const safe = Array.isArray(solutions) ? solutions : []
  return (
    <div className="relative">
      <motion.button
        onClick={()=>setOpen(!open)}
        disabled={isLoading}
        className={cn(
          "min-w-[280px] flex items-center gap-3 pl-3 pr-2 py-2 rounded-2xl border bg-white dark:bg-zinc-900 text-left",
          "border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600",
          "shadow-sm hover:shadow transition-all"
        )}
        whileTap={{scale:0.98}}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 grid place-items-center shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none truncate text-slate-900 dark:text-white">{selected ? selected.instance : (isLoading ? 'Cargando…' : 'Seleccionar solución')}</p>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 flex items-center gap-2">
            {selected ? (
              <>
                <span className="inline-flex items-center gap-1"><Route className="w-3 h-3"/>{selected.tour?.length ? selected.tour.length-1 : '—'} tramos</span>
                <span>·</span>
                <span className="font-mono">Q {selected.capacity ?? '—'}</span>
                <span>·</span>
                <span className="font-mono">h {selected.h ?? 0.1}</span>
              </>
            ) : <span className="text-zinc-400">10 instancias disponibles en Outputs/</span>}
          </p>
        </div>
        <div className={cn("w-8 h-8 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 grid place-items-center transition", open && "rotate-180")}>
          <ChevronDown className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{opacity:0, y:8, scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:0.98}}
              transition={{duration:0.18, ease:[0.16,1,0.3,1]}}
              className="absolute z-50 top-[calc(100%+10px)] right-0 w-[420px] max-w-[92vw] rounded-2xl border bg-popover shadow-xl overflow-hidden"
            >
              <div className="p-3 border-b bg-slate-50 dark:bg-zinc-800 flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                <Search className="w-4 h-4" /> {safe.length} soluciones óptimas · TSPPD-H Gurobi
              </div>
              <div className="max-h-[380px] overflow-auto p-2 space-y-1">
                {safe.map(s=>{
                  const active = selected?.filename===s.filename
                  return (
                    <button
                      key={s.filename}
                      onClick={()=>{ onSelect(s); setOpen(false)}}
                      className={cn(
                        "w-full text-left rounded-xl border px-3 py-3 flex items-start gap-3 transition",
                        active ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" : "bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                      )}
                    >
                      <div className={cn("w-9 h-9 rounded-lg grid place-items-center shrink-0 border", active ? "bg-white/15 border-white/20 text-white dark:bg-slate-900 dark:text-white dark:border-slate-900" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300")}>
                        <Box className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold leading-none truncate", active ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-zinc-100")}>{s.instance}</p>
                        <div className={cn("flex flex-wrap gap-2 mt-1.5 text-[11px] font-mono", active ? "text-white/80 dark:text-slate-600" : "text-slate-600 dark:text-zinc-400")}>
                          <span className={cn("px-1.5 py-0.5 rounded-md border text-[11px] font-medium", active ? "bg-white/15 border-white/20 text-white dark:bg-slate-900 dark:text-white dark:border-slate-800" : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700")}>ID {s.instanceId} · {s.numCustomers} clientes</span>
                          <span>Obj {Number(s.objectiveValue).toFixed(1)}</span>
                          <span>Dist {s.totalDistance}</span>
                          <span className={active ? "text-amber-200 dark:text-amber-700 font-semibold" : "text-[#B45309] dark:text-amber-300 font-semibold"}>H {Number(s.handlingCost).toFixed(2)}</span>
                        </div>
                        <p className={cn("text-[11px] mt-1 truncate font-mono", active ? "text-white/70 dark:text-slate-500" : "text-slate-500 dark:text-zinc-500")}>{(s.tour||[]).join(' → ')}</p>
                      </div>
                      {active && <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0" />}
                    </button>
                  )
                })}
                {safe.length===0 && <div className="p-8 text-center text-sm text-muted-foreground">No se encontraron soluciones en <span className="font-mono">Outputs/</span></div>}
              </div>
            </motion.div>
            <div className="fixed inset-0 z-40" onClick={()=>setOpen(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
