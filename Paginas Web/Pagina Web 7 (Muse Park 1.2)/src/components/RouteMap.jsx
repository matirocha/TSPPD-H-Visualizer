'use client'
import { motion } from 'framer-motion'
import { Home, MapPin } from 'lucide-react'
import { cn } from '../lib/utils'

export function RouteMap({ tour=[], nodes=[], currentStep=0, steps=[] }) {
  const safeTour = Array.isArray(tour) ? tour : []
  const safeNodes = Array.isArray(nodes) ? nodes : []
  const safeSteps = Array.isArray(steps) ? steps : []
  const depot = safeNodes.find(n=>n.isDepot) || {id:0,label:'Depósito'}
  const customers = safeNodes.filter(n=>!n.isDepot)

  const positions = {}
  const cx=50, cy=50, R=34
  positions[0]={x:cx,y:cy}
  const n = Math.max(1, customers.length)
  customers.forEach((c, i)=>{
    const ang = (i/n)*2*Math.PI - Math.PI/2
    positions[c.id]={ x: cx + R*Math.cos(ang), y: cy + R*Math.sin(ang) }
  })

  const getPath = (a,b)=>{
    const f=positions[a]||{x:cx,y:cy}, t=positions[b]||{x:cx,y:cy}
    const mx=(f.x+t.x)/2, my=(f.y+t.y)/2
    const ctrlX = mx + (f.y - t.y)*0.12
    const ctrlY = my + (t.x - f.x)*0.12
    return `M${f.x},${f.y} Q${ctrlX},${ctrlY} ${t.x},${t.y}`
  }

  const current = safeSteps[currentStep]
  const fromPos = current ? positions[current.from] : null
  const toPos = current ? positions[current.to] : null

  return (
    <div className="relative w-full aspect-[1.22] lg:aspect-square rounded-2xl overflow-hidden border bg-white dark:bg-zinc-950">
      {/* grid sutil pero visible */}
      <div className="absolute inset-0 opacity-[0.08]" style={{backgroundImage:'linear-gradient(to right, #64748B 1px, transparent 1px), linear-gradient(to bottom, #64748B 1px, transparent 1px)', backgroundSize:'24px 24px'}} />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-transparent to-slate-50 dark:from-zinc-900/40 dark:via-transparent dark:to-zinc-900/20" />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rg7" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#71717a" />
          </linearGradient>
          <marker id="arr7" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#18181b" className="dark:fill-white" />
          </marker>
        </defs>

        {/* completed / future — contraste mejorado */}
        {safeTour.slice(0,-1).map((fid, idx)=>{
          const tid = safeTour[idx+1]
          const isDone = idx < currentStep
          const isCurr = idx === currentStep
          const isFuture = idx > currentStep
          return (
            <g key={idx}>
              <motion.path
                d={getPath(fid,tid)}
                fill="none"
                stroke={isDone ? '#047857' : isCurr ? 'url(#rg7)' : '#94A3B8'}
                strokeWidth={isCurr ? 1.1 : 0.9}
                strokeDasharray={isCurr ? '2 1.2' : undefined}
                className={isCurr ? 'animate-dash' : ''}
                opacity={isFuture ? 0.95 : 1}
                initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:0.6, delay:idx*0.05}}
                markerEnd="url(#arr7)"
              />
              {/* distance label */}
              {isCurr && safeSteps[idx] && (
                <g>
                  {(()=>{
                    const f=positions[fid], t=positions[tid]
                    const mx=(f.x+t.x)/2 + (f.y - t.y)*0.04
                    const my=(f.y+t.y)/2 + (t.x - f.x)*0.04
                    return (
                      <g transform={`translate(${mx},${my})`}>
                        <rect x="-5" y="-2.2" width="10" height="4.4" rx="1.2" fill="white" stroke="#e4e4e7" strokeWidth="0.2" />
                        <text textAnchor="middle" dy="0.35em" fontSize="2.2" fontFamily="JetBrains Mono" fill="#18181b" fontWeight="600">{safeSteps[idx].distance}</text>
                      </g>
                    )
                  })()}
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* nodes */}
      {safeNodes.map(node=>{
        const pos = positions[node.id]
        if(!pos) return null
        const isFrom = current?.from===node.id
        const isTo = current?.to===node.id
        const visitedIdx = safeTour.indexOf(node.id)
        const visited = visitedIdx>=0 && visitedIdx <= currentStep + (current?.to===node.id ? 1 : 0)
        const isDepot = node.isDepot
        return (
          <motion.div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{left:`${pos.x}%`, top:`${pos.y}%`}}
            initial={{scale:0, opacity:0}} animate={{scale: isFrom||isTo?1.08:1, opacity:1}} transition={{type:'spring', stiffness:320, damping:18, delay: (Math.max(0,visitedIdx)*0.04)}}
          >
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "relative w-11 h-11 rounded-2xl grid place-items-center border shadow-sm bg-white dark:bg-zinc-900 transition",
                isDepot ? "w-14 h-14 rounded-[18px] border-slate-900 dark:border-white shadow-md" : "border-slate-200 dark:border-zinc-700 bg-white",
                isTo && "border-[#047857] ring-4 ring-emerald-200 dark:ring-emerald-900/40",
                isFrom && "border-[#B45309] ring-4 ring-amber-200 dark:ring-amber-900/40",
                visited && !isDepot && !isFrom && !isTo && "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
              )}>
                {isDepot ? <Home className="w-6 h-6 text-slate-900 dark:text-white" /> : <span className="text-[11px] font-mono font-bold text-slate-900">{node.id}</span>}
                {!isDepot && visited && <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#047857] rounded-full border-2 border-white dark:border-zinc-900" />}
              </div>
              <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded-full border bg-white dark:bg-zinc-900 shadow-sm", isDepot ? "border-slate-900 dark:border-white text-slate-900 dark:text-white" : "border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300")}>
                {isDepot ? 'Depósito' : `C${node.id}`}
              </span>
              {!isDepot && (
                <span className="text-[10px] font-mono flex gap-1">
                  <span className="px-1 py-0 rounded bg-[#FEF2F2] dark:bg-red-950/30 text-[#DC2626] dark:text-red-300 border border-red-200 dark:border-red-900">α{node.alpha}</span>
                  <span className="px-1 py-0 rounded bg-[#ECFEFF] dark:bg-cyan-950/30 text-[#0E7490] dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800">β{node.beta}</span>
                </span>
              )}
            </div>
          </motion.div>
        )
      })}

      {/* truck dot traveling */}
      {current && fromPos && toPos && (
        <motion.div
          key={`truck-${currentStep}`}
          className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          initial={{ left: `${fromPos.x}%`, top: `${fromPos.y}%` }}
          animate={{ left: `${toPos.x}%`, top: `${toPos.y}%` }}
          transition={{ duration: 1.4, ease: [0.16,1,0.3,1] }}
        >
          <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 grid place-items-center shadow-lg border-2 border-white dark:border-zinc-900">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
          </div>
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 whitespace-nowrap shadow border border-slate-900">
            {current.distance} km
          </span>
        </motion.div>
      )}

      {/* legend — texto más oscuro */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono bg-white dark:bg-zinc-900 backdrop-blur px-2 py-1 rounded-full border shadow-sm text-slate-700 dark:text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-[#047857]" /> completado
          <span className="w-4 h-0.5 bg-slate-900 dark:bg-white ml-1" /> actual
          <span className="w-2 h-2 rounded-full bg-slate-400 ml-1" /> pendiente
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono bg-white dark:bg-zinc-900 backdrop-blur px-2 py-1 rounded-full border shadow-sm text-slate-700 dark:text-zinc-300">
          <span className="w-2 h-2 rounded bg-[#DC2626]" /> α
          <span className="w-2 h-2 rounded bg-[#0E7490] ml-1" /> β
        </div>
      </div>
    </div>
  )
}
