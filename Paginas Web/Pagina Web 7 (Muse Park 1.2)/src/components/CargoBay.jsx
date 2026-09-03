'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ArrowDown, ArrowUp, Layers, AlertTriangle, Truck } from 'lucide-react'
import { cn } from '../lib/utils'

// Visualiza la bahía LIFO con animación lenta por fases
// fases: 'travel' -> 'arrive' -> 'handlingOut' -> 'deliver' -> 'handlingIn' -> 'pickup' -> 'done'

export function CargoBay({ step, prevStep, isPlaying, speed=1 }) {
  const [phase, setPhase] = useState('idle')
  const [visibleSlots, setVisibleSlots] = useState(step?.slots || [])
  const [handlingOut, setHandlingOut] = useState([]) // B units temporarily outside
  const [delivering, setDelivering] = useState([]) // A units being delivered
  const [picking, setPicking] = useState([]) // new B arriving
  const timerRef = useRef(null)

  const capacity = step?.capacity ?? step?.slots?.length ?? 32
  const deliverA = step?.deliverA ?? 0
  const pickupB = step?.pickupB ?? 0
  const handlingCount = step?.handlingCount ?? 0

  // derive handling B indices : those B at rear that block A
  // heuristic: take B from rear side (rightmost) up to handlingCount
  const bIndicesRear = useMemo(()=>{
    if(!step?.slots) return []
    const arr = step.slots.map((v,i)=>({v,i})).filter(x=>x.v==='B')
    // rear = higher index
    return arr.sort((a,b)=>b.i - a.i).slice(0, Math.min(handlingCount, arr.length)).map(x=>x.i)
  }, [step, handlingCount])

  const aIndicesToDeliver = useMemo(()=>{
    if(!step?.slots || deliverA===0) return []
    // deliverA units should be A that were at rear before? Use last A positions
    // For visual clarity pick A from rear side
    const arr = step.slots.map((v,i)=>({v,i})).filter(x=>x.v==='A')
    // but step.slots is AFTER operation? In data, slots are during arc (u->v) so after pickup, before next.
    // For animation we treat visible before operation as prevStep slots
    // So just pick first deliverA A from rear of prev slots if available else from current
    return arr.slice(0, deliverA).map(x=>x.i)
  }, [step, deliverA])

  useEffect(()=>{
    // when step changes, reset and auto-run theater slowly
    setPhase('travel')
    setHandlingOut([])
    setDelivering([])
    setPicking([])
    setVisibleSlots(prevStep?.slots ?? step?.slots ?? [])

    if (!step) return

    const base = 900 / Math.max(0.5, speed)
    const seq = []

    // travel brief
    seq.push(()=> setPhase('arrive'))

    if (handlingCount>0) {
      seq.push(()=> {
        setPhase('handlingOut')
        // animate B out one by one slowly
        const ids = bIndicesRear
        ids.forEach((_, idx)=>{
          setTimeout(()=>{
            setHandlingOut(prev=> [...prev, idx])
          }, idx * (260 / speed))
        })
      })
    }
    if (deliverA>0) {
      seq.push(()=> {
        setPhase('deliver')
        // animate A deliver
        for(let i=0;i<deliverA;i++){
          setTimeout(()=> setDelivering(prev=> [...prev, i]), i * (320 / speed))
        }
      })
    }
    if (handlingCount>0) {
      seq.push(()=> {
        setPhase('handlingIn')
        // bring B back slowly reverse
        const total = bIndicesRear.length
        for(let i=0;i<total;i++){
          setTimeout(()=>{
            setHandlingOut(prev=> prev.slice(0, -1))
          }, i * (240 / speed))
        }
      })
    }
    if (pickupB>0) {
      seq.push(()=> {
        setPhase('pickup')
        for(let i=0;i<pickupB;i++){
          setTimeout(()=> setPicking(prev=> [...prev, i]), i * (300 / speed))
        }
      })
    }
    seq.push(()=> {
      setPhase('done')
      setVisibleSlots(step.slots || [])
      setHandlingOut([]); setDelivering([]); setPicking([])
    })

    let t = 600 / speed
    seq.forEach(fn=>{
      timerRef.current = setTimeout(fn, t)
      // estimate next delay
      if (fn.toString().includes('handlingOut')) t += (bIndicesRear.length * 260 / speed) + 700 / speed
      else if (fn.toString().includes('deliver')) t += (deliverA * 320 / speed) + 700 / speed
      else if (fn.toString().includes('handlingIn')) t += (bIndicesRear.length * 240 / speed) + 600 / speed
      else if (fn.toString().includes('pickup')) t += (pickupB * 300 / speed) + 600 / speed
      else t += base
    })

    return ()=> {
      if(timerRef.current) clearTimeout(timerRef.current)
    }
  }, [step?.stepIndex, speed]) // eslint-disable-line

  const totalA = step?.aOnTruck ?? 0
  const totalB = step?.bOnTruck ?? 0

  const slotW = 16
  const gap = 2

  // helper to render slot box — paleta accesible: α #DC2626, β #0E7490
  const renderSlot = (val, idx, opts={})=>{
    const isBHandling = bIndicesRear.includes(idx) && phase==='handlingOut' && handlingOut.length > bIndicesRear.indexOf(idx)
    const isADelivering = delivering.includes(idx)
    const baseClass = cn(
      "relative rounded-t-[3px] border transition-all",
      val==='A' && "bg-[#DC2626] border-[#991B1B] text-white",
      val==='B' && "bg-[#0E7490] border-[#0C5A6E] text-white",
      val==='EMPTY' && "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700",
      isBHandling && "opacity-30 translate-y-2",
      isADelivering && "opacity-0 scale-90"
    )
    return (
      <motion.div
        key={`${idx}-${val}`}
        layout
        initial={{opacity:0, y:8}} animate={{opacity: isBHandling?0.4 : 1, y: isBHandling? -6 : 0}} transition={{duration:0.45, delay: idx*0.012}}
        className={baseClass}
        style={{ width: slotW, height: val==='EMPTY' ? 0 : 28 }}
      >
        {val!=='EMPTY' && (
          <span className="absolute inset-0 grid place-items-center text-[8px] font-bold font-mono">{val}</span>
        )}
      </motion.div>
    )
  }

  return (
    <div className="w-full">
      {/* phase indicator — paleta WCAG AA */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border flex items-center gap-1.5",
          phase==='travel' && "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900",
          phase==='arrive' && "bg-[#B45309] text-white border-[#92400E]",
          phase==='handlingOut' && "bg-amber-50 text-[#92400E] border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
          phase==='deliver' && "bg-[#DC2626] text-white border-[#991B1B]",
          phase==='handlingIn' && "bg-amber-50 text-[#92400E] border-amber-200 dark:bg-amber-950/40 dark:text-amber-200",
          phase==='pickup' && "bg-[#0E7490] text-white border-[#0C5A6E]",
          phase==='done' && "bg-[#047857] text-white border-[#065F46]",
          phase==='idle' && "bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {phase==='travel' && 'En tránsito'}
          {phase==='arrive' && 'Llegada · puerta trasera abierta'}
          {phase==='handlingOut' && `Handling · moviendo ${handlingOut.length}/${bIndicesRear.length} β afuera`}
          {phase==='deliver' && `Descarga · ${delivering.length}/${deliverA} α entregadas`}
          {phase==='handlingIn' && `Handling · reingresando ${bIndicesRear.length - handlingOut.length}/${bIndicesRear.length} β`}
          {phase==='pickup' && `Carga · ${picking.length}/${pickupB} β ingresando`}
          {phase==='done' && 'Operación completada'}
          {phase==='idle' && 'Esperando'}
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
          <Layers className="w-3 h-3" /> LIFO · puerta a la derecha
        </span>
        {handlingCount>0 && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-[#92400E] dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-mono font-semibold">
            <AlertTriangle className="w-3 h-3" /> Handling {handlingCount} · ${Number(step.handlingCost).toFixed(2)}
          </span>
        )}
      </div>

      {/* truck shell */}
      <div className="relative rounded-[20px] border bg-zinc-50 dark:bg-zinc-900/40 p-3 sm:p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950" />
        <div className="relative flex items-stretch gap-3">
          {/* cab */}
          <div className="w-[86px] shrink-0 flex flex-col">
            <div className="flex-1 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 p-2 flex flex-col justify-between border border-zinc-800 dark:border-zinc-200 shadow-sm">
              <div className="space-y-1.5">
                <div className="h-10 rounded-xl bg-white/10 dark:bg-zinc-900/10 border border-white/15 dark:border-zinc-900/10 grid place-items-center">
                  <Truck className="w-6 h-6" />
                </div>
                <p className="text-[10px] tracking-[0.14em] font-semibold opacity-70">CABINA</p>
                <p className="text-xs font-mono leading-none">{totalA}α · {totalB}β</p>
              </div>
              <div className="mt-2 text-[10px] font-mono opacity-60">CAP {capacity}</div>
            </div>
            <div className="mt-2 flex justify-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-700 border-2 border-zinc-700 dark:border-zinc-600 grid place-items-center"><span className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-400" /></span>
              <span className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-700 border-2 border-zinc-700 dark:border-zinc-600 grid place-items-center"><span className="w-2 h-2 rounded-full bg-zinc-600 dark:bg-zinc-400" /></span>
            </div>
          </div>

          {/* trailer */}
          <div className="flex-1 min-w-0">
            <div className="relative h-[132px] rounded-2xl border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden flex flex-col">
              {/* top bar */}
              <div className="h-7 flex items-center justify-between px-3 border-b bg-slate-50/90 dark:bg-zinc-900/60 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300"><span className="w-2 h-2 rounded-full bg-[#047857] animate-pulse" />Bahía de carga · frente ← · → puerta</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                  <span className="w-2.5 h-2.5 rounded bg-[#DC2626]" /> α {totalA}
                  <span className="w-2.5 h-2.5 rounded bg-[#0E7490] ml-2" /> β {totalB}
                  <span className="ml-2 text-slate-500">{(visibleSlots||[]).filter(s=>s!=='EMPTY').length}/{capacity} ocupados</span>
                </span>
              </div>

              {/* slots area */}
              <div className="flex-1 relative flex items-end gap-[2px] px-3 pb-3 pt-2 overflow-hidden">
                {/* door on right */}
                <div className={cn("absolute right-0 top-0 bottom-0 w-[10px] border-l-2 flex flex-col items-center justify-center gap-1 transition",
                  phase==='arrive' || phase==='handlingOut' || phase==='deliver' || phase==='handlingIn' || phase==='pickup' ? "bg-[#047857]/15 border-[#047857]" : "bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
                )}>
                  <span className="w-1 h-6 rounded-full bg-current opacity-30" />
                  <span className="text-[7px] font-mono -rotate-90 whitespace-nowrap opacity-60">PUERTA</span>
                </div>

                <div className="flex items-end gap-[2px] pr-4 flex-wrap content-end">
                  <AnimatePresence mode="popLayout">
                    {(visibleSlots||[]).slice(0, capacity).map((v,i)=> renderSlot(v,i))}
                  </AnimatePresence>
                  {/* picking preview ghost */}
                  {phase==='pickup' && picking.length>0 && (
                    <div className="flex items-end gap-[2px] ml-1">
                      {[...Array(picking.length)].map((_,k)=>(
                        <motion.div key={`pick-${k}`} initial={{x:20, opacity:0, scale:0.8}} animate={{x:0, opacity:1, scale:1}} transition={{duration:0.45, delay:k*0.08}} className="w-[16px] h-[28px] rounded-t-[3px] bg-[#0E7490] border border-[#0C5A6E] grid place-items-center text-white text-[8px] font-bold font-mono">
                          B
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* shimmer when travel */}
                {phase==='travel' && <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-900/[0.04] to-transparent dark:via-white/[0.06]" initial={{x:'-100%'}} animate={{x:'100%'}} transition={{duration:1.2, repeat:Infinity, ease:'linear'}} />}
              </div>

              {/* floor */}
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 border-t border-zinc-300 dark:border-zinc-700" />
            </div>

            {/* handling staging area */}
            <div className="mt-2 min-h-[54px]">
              {(handlingCount>0) && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                  <p className="text-[10px] tracking-[0.14em] font-semibold text-[#92400E] dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> ZONA TEMPORAL DE HANDLING — LIFO bloqueado
                    <span className="ml-auto font-mono text-[11px]">{handlingOut.length}/{bIndicesRear.length} β fuera</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 min-h-[28px]">
                    <AnimatePresence>
                      {handlingOut.map((_, idx)=>(
                        <motion.div
                          key={`h-${idx}`}
                          initial={{y:-10, opacity:0, scale:0.8}} animate={{y:0, opacity:1, scale:1}} exit={{y:-10, opacity:0, scale:0.8}}
                          transition={{duration:0.45, delay: idx*0.06}}
                          className="w-[22px] h-[28px] rounded-t-[4px] bg-[#0E7490] border border-[#0C5A6E] grid place-items-center text-white text-[8px] font-bold shadow-sm"
                        >
                          B
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {handlingOut.length===0 && <span className="text-xs text-[#92400E]/70 dark:text-amber-200/70 font-mono">(vacía — se llenará si hay bloqueo LIFO)</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* bottom stats — texto más contrastado */}
        <div className="relative mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border bg-white dark:bg-zinc-950 px-3 py-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FEF2F2] dark:bg-red-950/30 border border-red-200 dark:border-red-900 grid place-items-center"><Package className="w-4 h-4 text-[#DC2626] dark:text-red-400" /></span>
            <div>
              <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">ENTREGA α</p>
              <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">{deliverA} unidades {phase==='deliver' && <span className="text-[#DC2626]">· {delivering.length} ↓</span>}</p>
            </div>
            <ArrowDown className={cn("ml-auto w-4 h-4", phase==='deliver' ? "text-[#DC2626] animate-bounce" : "text-slate-300")} />
          </div>
          <div className="rounded-xl border bg-white dark:bg-zinc-950 px-3 py-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#ECFEFF] dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900 grid place-items-center"><Package className="w-4 h-4 text-[#0E7490] dark:text-cyan-300" /></span>
            <div>
              <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">RECOJO β</p>
              <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">{pickupB} unidades {phase==='pickup' && <span className="text-[#0E7490]">· {picking.length} ↑</span>}</p>
            </div>
            <ArrowUp className={cn("ml-auto w-4 h-4", phase==='pickup' ? "text-[#0E7490] animate-bounce" : "text-slate-300")} />
          </div>
          <div className="rounded-xl border bg-white dark:bg-zinc-950 px-3 py-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 grid place-items-center"><Layers className="w-4 h-4 text-slate-700" /></span>
            <div>
              <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">OCUPACIÓN</p>
              <p className="font-mono font-semibold text-slate-900 dark:text-zinc-100">{totalA+totalB}/{capacity} <span className="text-slate-500 font-normal">({Math.round((totalA+totalB)/Math.max(1,capacity)*100)}%)</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* legend slow explanation */}
      <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
        La carga se actualiza <span className="font-semibold text-slate-900 dark:text-white">al llegar</span>. Primero se abre la puerta trasera (derecha). Si hay <span className="font-mono text-[#B45309] dark:text-amber-300 font-semibold">handling</span>, las β que bloquean se mueven lentamente a la zona temporal; luego salen las α rojas por la puerta, vuelven las β, y finalmente ingresan las nuevas β. Cada unidad aparece con retardo intencional para que se entienda el LIFO.
      </p>
    </div>
  )
}
