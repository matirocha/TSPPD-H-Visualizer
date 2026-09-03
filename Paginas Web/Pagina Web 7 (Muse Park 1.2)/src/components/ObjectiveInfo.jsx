'use client'
import { motion } from 'framer-motion'

export function ObjectiveInfo({ solution }) {
  if(!solution) return null
  const items = [
    { k:'OBJETIVO', v: Number(solution.objectiveValue).toFixed(2), sub: 'ruteo + handling', accent:'text-slate-900 dark:text-white', bar:'bg-slate-900 dark:bg-white' },
    { k:'RUTEO', v: String(solution.totalDistance), sub: 'km totales', accent:'text-slate-900 dark:text-white', bar:'bg-slate-900 dark:bg-white' },
    { k:'HANDLING', v: Number(solution.handlingCost).toFixed(2), sub: `h=${solution.h} × ops`, accent: Number(solution.handlingCost)>0 ? 'text-[#B45309] dark:text-amber-300' : 'text-slate-900 dark:text-white', bar: Number(solution.handlingCost)>0 ? 'bg-[#B45309]' : 'bg-slate-900 dark:bg-white' },
    { k:'CAPACIDAD Q', v: String(solution.capacity), sub: 'slots LIFO', accent:'text-slate-900 dark:text-white', bar:'bg-slate-900 dark:bg-white' },
    { k:'CLIENTES', v: String(solution.numCustomers), sub: `ID ${solution.instanceId}`, accent:'text-slate-900 dark:text-white', bar:'bg-slate-900 dark:bg-white' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {items.map((it, i)=>(
        <motion.div
          key={it.k}
          initial={{opacity:0, y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04, duration:0.4, ease:[0.16,1,0.3,1]}}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 relative overflow-hidden group shadow-sm"
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-slate-50 to-transparent dark:from-zinc-800/40 pointer-events-none" />
          <p className="text-[10px] tracking-[0.16em] font-semibold text-slate-600 dark:text-zinc-400">{it.k}</p>
          <p className={`mt-2 text-2xl font-mono font-bold tracking-tight ${it.accent}`}>{it.v}</p>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{it.sub}</p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <motion.div initial={{width:0}} animate={{width:'100%'}} transition={{delay:0.3+i*0.06, duration:0.6}} className={`h-full ${it.bar}`} style={{opacity: 0.9}} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}
