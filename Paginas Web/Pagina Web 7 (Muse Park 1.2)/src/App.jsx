'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, Truck, MapPin, Package, Info, Route, Layers, Sparkles, ArrowUpRight, Gauge } from 'lucide-react'
import { SolutionSelector } from './components/SolutionSelector'
import { ObjectiveInfo } from './components/ObjectiveInfo'
import { RouteMap } from './components/RouteMap'
import { CargoBay } from './components/CargoBay'
import { StepNavigator } from './components/StepNavigator'
import { StepExplanation } from './components/StepExplanation'

const API_BASE = '/api'

export default function App(){
  const [solutions, setSolutions]=useState([])
  const [selected, setSelected]=useState(null)
  const [data, setData]=useState(null)
  const [loading, setLoading]=useState(false)
  const [step, setStep]=useState(0)
  const [playing, setPlaying]=useState(false)
  const [speed, setSpeed]=useState(1)
  const [showExplanations, setShowExplanations]=useState(true)
  const timerRef=useRef(null)

  useEffect(()=>{ loadSolutions() },[])

  async function loadSolutions(){
    setLoading(true)
    try{
      const r=await fetch(`${API_BASE}/solutions`)
      if(!r.ok) throw new Error(r.status)
      const j=await r.json()
      if(Array.isArray(j)){
        setSolutions(j)
        if(j.length && !selected) await loadSolution(j[0])
      }
    }catch(e){ console.error(e)} finally{setLoading(false)}
  }
  async function loadSolution(s){
    if(!s?.filename) return
    setLoading(true)
    try{
      const r=await fetch(`${API_BASE}/solutions/${encodeURIComponent(s.filename)}`)
      if(!r.ok) throw new Error(r.status)
      const j=await r.json()
      setSelected(s)
      setData(j)
      setStep(0)
      setPlaying(false)
    }catch(e){console.error(e)} finally{setLoading(false)}
  }

  // autoplay
  useEffect(()=>{
    if(!playing || !data?.steps) return
    const total = data.steps.length
    // wait for cargo theater to finish (approx) + travel
    // cargo duration approx: handling + deliver + pickup
    const cur = data.steps[step]
    const handlingOps = cur?.handlingCount || 0
    const deliver = cur?.deliverA || 0
    const pickup = cur?.pickupB || 0
    const est = 1200 + handlingOps*260 + deliver*320 + pickup*300 + 900
    const duration = Math.max(3200, est) / speed
    timerRef.current = setTimeout(()=>{
      if(step < total - 1) setStep(s=>s+1)
      else setPlaying(false)
    }, duration)
    return ()=> clearTimeout(timerRef.current)
  }, [playing, step, data, speed])

  const handlePlay=()=>{
    if(!data) return
    if(step >= (data.steps?.length||1)-1) setStep(0)
    setPlaying(!playing)
  }
  const handleStep=(i)=>{ setStep(i); setPlaying(false) }

  if(!data){
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 grid place-items-center p-6">
        <div className="max-w-sm w-full rounded-[24px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 grid place-items-center mx-auto">
            <Truck className="w-7 h-7 animate-pulse" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Muse Park 1.2 — Cargando</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{loading ? 'Leyendo Outputs/…' : 'No se pudo cargar ninguna solución.'}</p>
          {!loading && <button onClick={loadSolutions} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium">Reintentar</button>}
        </div>
      </div>
    )
  }

  const steps = data.steps || []
  const total = steps.length
  const cur = steps[step] || {}
  const prev = step>0 ? steps[step-1] : null
  const progress = total ? ((step+1)/total)*100 : 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground">
      {/* top accent bar — slate ink */}
      <div className="h-1 w-full bg-slate-900 dark:bg-white" />

      {/* header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[72px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 grid place-items-center shrink-0">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[15px] sm:text-[16px] font-semibold tracking-tight leading-none flex items-center gap-2 text-slate-900 dark:text-white">
                  TSPPD-H <span className="hidden sm:inline font-mono text-[11px] px-1.5 py-0.5 rounded-md border bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900">MUSE PARK 1.2</span>
                  <span className="hidden lg:inline-flex items-center gap-1 text-xs font-normal text-slate-600 dark:text-zinc-400"><Sparkles className="w-3 h-3" /> Laboratorio de Ruteo</span>
                </h1>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 truncate">Visualizador de la solución óptima · Gurobi · LIFO con handling</p>
              </div>
            </div>
            <SolutionSelector solutions={solutions} selected={selected} onSelect={loadSolution} isLoading={loading} />
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* kpi */}
        <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.4}}>
          <ObjectiveInfo solution={data} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 flex items-center gap-1.5"><Route className="w-3 h-3" /> Ruta: {data.tour.map(n=> n===0?'D':`C${n}`).join(' → ')}</span>
            <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200">Capacidad Q {data.capacity}</span>
            <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200">h = {data.h}</span>
            <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-slate-600 dark:text-zinc-400"><Layers className="w-3 h-3" /> {total-1} clientes + depósito · {total} tramos</span>
          </div>
        </motion.section>

        {/* progress — alto contraste */}
        <div className="mt-6 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden border border-slate-200 dark:border-zinc-700">
          <motion.div className="h-full bg-slate-900 dark:bg-white" initial={{width:0}} animate={{width:`${progress}%`}} transition={{duration:0.5, ease:[0.16,1,0.3,1]}} />
        </div>

        {/* controls bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-600 dark:text-zinc-400 hidden sm:inline">Navegación:</span>
            <span className="px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-mono font-semibold border border-slate-900 dark:border-white">Paso {step+1} / {total}</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200">
              <span className="w-2 h-2 rounded-full bg-[#047857]" /> {cur.from===0?'Depósito':`C${cur.from}`} → {cur.to===0?'Depósito':`C${cur.to}`} · {cur.distance} km
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300">
            <input type="checkbox" checked={showExplanations} onChange={e=>setShowExplanations(e.target.checked)} className="w-4 h-4 rounded border border-slate-300 dark:border-zinc-600" />
            Mostrar explicaciones
          </label>
        </div>

        {/* main split — cards con borde slate para separar del fondo */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
          {/* map */}
          <motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.06}} className="rounded-[24px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><MapPin className="w-4 h-4" /> Mapa de Ruta</h2>
              <span className="text-xs font-mono text-slate-600 dark:text-zinc-400 hidden sm:inline-flex items-center gap-1.5"><Gauge className="w-3 h-3" /> {cur.distance} km este tramo</span>
            </div>
            <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900">
              <RouteMap tour={data.tour} nodes={data.nodes} currentStep={step} steps={steps} />
            </div>
            <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">ORIGEN</p>
                <p className="font-medium text-slate-900 dark:text-white">{cur.from===0?'Depósito (0)':`Cliente ${cur.from}`}</p>
                <p className="font-mono text-slate-600 dark:text-zinc-400">α {data.nodes.find(n=>n.id===cur.from)?.alpha ?? 0} · β {data.nodes.find(n=>n.id===cur.from)?.beta ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">DISTANCIA</p>
                <p className="font-mono font-bold text-base text-slate-900 dark:text-white">{cur.distance}<span className="text-xs font-normal text-slate-600 dark:text-zinc-400"> km</span></p>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400">{step===0?'Salida depósito': step===total-1?'Retorno':`Tramo ${step+1}/${total}`}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">DESTINO</p>
                <p className="font-medium text-slate-900 dark:text-white">{cur.to===0?'Depósito (0)':`Cliente ${cur.to}`}</p>
                <p className="font-mono text-slate-600 dark:text-zinc-400">entrega α {cur.deliverA} · recojo β {cur.pickupB}</p>
              </div>
            </div>
          </motion.section>

          {/* cargo bay */}
          <motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.09}} className="rounded-[24px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><Truck className="w-4 h-4" /> Bahía de Carga — LIFO</h2>
              <span className="text-xs font-mono px-2 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-semibold">{cur.aOnTruck}α · {cur.bOnTruck}β · {cur.aOnTruck+cur.bOnTruck}/{data.capacity}</span>
            </div>
            <div className="p-3 sm:p-4 flex-1 bg-white dark:bg-zinc-900">
              <CargoBay step={{...cur, capacity:data.capacity}} prevStep={prev ? {...prev, capacity:data.capacity} : null} isPlaying={playing} speed={speed} />
            </div>
          </motion.section>
        </div>

        {/* navigator */}
        <motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.12}} className="mt-6 rounded-[24px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm">
          <StepNavigator current={step} total={total} isPlaying={playing} onStep={handleStep} onPlayPause={handlePlay} onReset={()=>{setStep(0); setPlaying(false)}} speed={speed} onSpeed={setSpeed} />
        </motion.section>

        {/* current step detail */}
        <motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.14}} className="mt-6 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="rounded-[24px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><Package className="w-4 h-4" /> Detalle del Paso {step+1}</h3>
              <span className="text-xs font-mono px-2 py-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-slate-900 font-semibold">{cur.distance} km</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-3">
                  <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">ORIGEN → DESTINO</p>
                  <p className="mt-1 font-medium text-sm flex items-center gap-1.5 text-slate-900 dark:text-white">{cur.from===0?'Depósito':`C${cur.from}`} <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" /> {cur.to===0?'Depósito':`C${cur.to}`}</p>
                  <p className="text-xs font-mono text-slate-600 dark:text-zinc-400 mt-1">{data.nodes.find(n=>n.id===cur.from)?.label} → {data.nodes.find(n=>n.id===cur.to)?.label}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-3">
                  <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">OPERACIONES</p>
                  <div className="mt-1 space-y-1 text-xs font-mono">
                    <p className={cur.deliverA? "text-[#DC2626] dark:text-red-300 font-semibold" : "text-slate-500"}>Entregar α: {cur.deliverA}</p>
                    <p className={cur.pickupB? "text-[#0E7490] dark:text-cyan-300 font-semibold" : "text-slate-500"}>Recoger β: {cur.pickupB}</p>
                    <p className={cur.handlingCount? "text-[#92400E] dark:text-amber-300 font-bold" : "text-slate-500"}>Handling: {cur.handlingCount} (${Number(cur.handlingCost).toFixed(2)})</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-3">
                  <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400">CARGA A BORDO</p>
                  <p className="mt-1 font-mono text-sm"><span className="text-[#DC2626] dark:text-red-300 font-bold">{cur.aOnTruck} α</span> <span className="text-slate-400">·</span> <span className="text-[#0E7490] dark:text-cyan-300 font-bold">{cur.bOnTruck} β</span></p>
                  <p className="text-xs font-mono text-slate-600 dark:text-zinc-400 mt-1">{cur.aOnTruck+cur.bOnTruck} / {data.capacity} ocupados</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden"><div className="h-full bg-slate-900 dark:bg-white" style={{width:`${(cur.aOnTruck+cur.bOnTruck)/Math.max(1,data.capacity)*100}%`}} /></div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-4">
                <p className="text-[10px] tracking-[0.12em] font-semibold text-slate-600 dark:text-zinc-400 mb-2 flex items-center gap-1.5"><Info className="w-3 h-3" /> EXPLICACIÓN DEL MODELO (EC. 1-16)</p>
                <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-slate dark:prose-invert" dangerouslySetInnerHTML={{__html: cur.explanation}} />
              </div>
            </div>
          </div>

          {/* explanations list */}
          {showExplanations && (
            <div className="rounded-[24px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col max-h-[640px]">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><Info className="w-4 h-4" /> Historial de pasos</h3>
                <span className="text-xs font-mono text-slate-600 dark:text-zinc-400">{total} pasos</span>
              </div>
              <div className="p-3 space-y-2 overflow-auto bg-slate-50/50 dark:bg-zinc-900">
                <AnimatePresence>
                  {steps.map((s, idx)=>(
                    <StepExplanation key={s.stepIndex} step={s} isActive={idx===step} isCompleted={idx<step} onClick={()=>handleStep(idx)} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.section>

        {/* params — alto contraste sobre ink */}
        <motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.16}} className="mt-6 rounded-[24px] border border-slate-900 bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Parámetros de la instancia</h3>
              <p className="text-sm text-slate-300 dark:text-slate-600 mt-1 max-w-[60ch]">Solución óptima generada por <span className="font-mono font-semibold text-white dark:text-slate-900">tsppd_h_gurobi.py</span> (Gurobi, ecuaciones 1-16). Costos con handling LIFO y MTZ para subtours.</p>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-white dark:border-slate-900 text-xs font-mono font-semibold">{data.instance}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ['Clientes', String(data.numCustomers)],
              ['ID instancia', String(data.instanceId)],
              ['Parámetro h', String(data.h)],
              ['Capacidad Q', String(data.capacity)],
            ].map(([k,v])=>(
              <div key={k} className="rounded-2xl bg-white/10 dark:bg-slate-900/5 border border-white/20 dark:border-slate-900/10 p-3 backdrop-blur">
                <p className="text-[10px] tracking-[0.14em] font-semibold text-white/70 dark:text-slate-500">{k.toUpperCase()}</p>
                <p className="font-mono font-semibold mt-1 text-white dark:text-slate-900">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 border border-white dark:border-slate-800">
            <p className="text-xs tracking-[0.14em] font-semibold text-slate-600 dark:text-slate-400">RUTA COMPLETA</p>
            <p className="font-mono text-sm mt-1 break-all text-slate-900 dark:text-white">{data.tour.map(n=> n===0?'Depósito':`Cliente ${n}`).join(' → ')}</p>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-2">Distancias por tramo: {steps.map(s=>s.distance).join(' · ')} km · Total {data.totalDistance} km · Handling {Number(data.handlingCost).toFixed(2)} · Objetivo {Number(data.objectiveValue).toFixed(2)}</p>
          </div>
        </motion.section>
      </main>

      <footer className="mt-10 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400">
          <span className="font-mono">TSPPD-H · Pagina Web 7 (Muse Park 1.2) · Node.js + Vite + Framer Motion + shadcn/ui · paleta Ink & Paper</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#047857]" /> Gurobi optimal · Outputs/</span>
        </div>
      </footer>
    </div>
  )
}
