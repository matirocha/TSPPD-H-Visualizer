import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Truck, ArrowRight } from 'lucide-react';
import { cn } from './lib/utils';

interface NodeDef {
  id: number;
  alpha: number;
  beta: number;
  isDepot: boolean;
  label: string;
}

interface Step {
  stepIndex: number;
  from: number;
  to: number;
  distance: number;
  deliverA: number;
  pickupB: number;
  aOnTruck: number;
  bOnTruck: number;
  slots: string[];
  handlingCount: number;
  handlingCost: number;
  explanation: string;
}

interface Solution {
  instance: string;
  numCustomers: number;
  instanceId: number;
  h: number;
  capacity: number;
  objectiveValue: number;
  totalDistance: number;
  handlingCost: number;
  tour: number[];
  nodes: NodeDef[];
  steps: Step[];
}

export default function TruckVisualizer({ solution }: { solution: Solution }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Animation phases: 'travelling' -> 'arrived' -> 'unloading' -> 'loading' -> 'done'
  const [phase, setPhase] = useState<'travelling' | 'arrived' | 'unloading' | 'loading' | 'done'>('travelling');

  useEffect(() => {
    setCurrentStep(0);
    setPhase('travelling');
    setIsPlaying(false);
  }, [solution]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isPlaying) {
      if (phase === 'travelling') {
        timer = setTimeout(() => setPhase('arrived'), 2500); // 2.5s travel
      } else if (phase === 'arrived') {
        timer = setTimeout(() => setPhase('unloading'), 1000); // 1s pause at arrival
      } else if (phase === 'unloading') {
        timer = setTimeout(() => setPhase('loading'), 2000); // 2s unloading
      } else if (phase === 'loading') {
        timer = setTimeout(() => setPhase('done'), 2000); // 2s loading
      } else if (phase === 'done') {
        timer = setTimeout(() => {
          if (currentStep < solution.steps.length - 1) {
            setCurrentStep(s => s + 1);
            setPhase('travelling');
          } else {
            setIsPlaying(false);
          }
        }, 1500);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, phase, currentStep, solution.steps.length]);

  const step = solution.steps[currentStep];
  const fromNode = solution.nodes.find(n => n.id === step.from);
  const toNode = solution.nodes.find(n => n.id === step.to);

  // We need to know previous slots to animate correctly. 
  // If we are at step 0, prevSlots is empty truck at depot before loading? 
  // Actually, step 0 is travelling from Depot to first customer. It is already loaded.
  // The problem statement says: "La carga del camion se tiene que actualizar apenas llegue al destino y tiene que mostrar animaciones de carga y descarga de los objetos".
  // So while 'travelling', we show `step.slots`.
  // At 'arrived', we still show `step.slots`.
  // At 'unloading' and 'loading', we animate changes to the NEXT step's slots.
  
  const currentSlots = step.slots;
  const nextSlots = currentStep < solution.steps.length - 1 ? solution.steps[currentStep + 1].slots : Array(solution.capacity).fill('EMPTY');

  // Display slots based on phase
  let displaySlots = currentSlots;
  if (phase === 'done') {
    displaySlots = nextSlots; // Ready for next travel
  }

  const handleNext = () => {
    if (currentStep < solution.steps.length - 1) {
      setCurrentStep(s => s + 1);
      setPhase('travelling');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
      setPhase('travelling');
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
      
      {/* Header Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-sm font-medium mb-1">Costo Objetivo</div>
          <div className="text-3xl font-light text-zinc-100">{solution.objectiveValue}</div>
        </div>
        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-sm font-medium mb-1">Distancia Total</div>
          <div className="text-3xl font-light text-zinc-100">{solution.totalDistance} <span className="text-lg">km</span></div>
        </div>
        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-sm font-medium mb-1">Costo Handling</div>
          <div className="text-3xl font-light text-rose-400">{solution.handlingCost}</div>
        </div>
        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-sm font-medium mb-1">Capacidad</div>
          <div className="text-3xl font-light text-zinc-100">{solution.capacity}</div>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="relative h-96 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex flex-col justify-between">
        
        {/* Road and Truck Animation */}
        <div className="flex-1 relative flex items-center px-12">
          {/* Nodes */}
          <div className="absolute left-12 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center z-10">
              <span className="font-bold text-lg text-zinc-300">{fromNode?.label === 'Depósito' ? 'D' : fromNode?.id}</span>
            </div>
            <span className="text-xs text-zinc-400 mt-2 font-medium">{fromNode?.label}</span>
          </div>

          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center z-10">
              <span className="font-bold text-lg text-zinc-300">{toNode?.label === 'Depósito' ? 'D' : toNode?.id}</span>
            </div>
            <span className="text-xs text-zinc-400 mt-2 font-medium">{toNode?.label}</span>
          </div>

          {/* Road Line */}
          <div className="absolute left-28 right-28 top-1/2 -translate-y-1/2 h-1 bg-zinc-800 border-y border-zinc-700/50"></div>

          {/* Truck */}
          <motion.div
            className="absolute z-20 flex flex-col items-center"
            initial={{ left: '5rem' }}
            animate={{ left: phase === 'travelling' ? '5rem' : 'calc(100% - 11rem)' }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
          >
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Truck size={48} className="text-emerald-400" />
            </div>
          </motion.div>
        </div>

        {/* Cargo Visualizer */}
        <div className="h-40 bg-zinc-900 border-t border-zinc-800 p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center px-2">
            <div className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Estado de Carga (LIFO)</div>
            
            <div className="flex gap-4">
               {phase === 'unloading' && step.deliverA > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-rose-400 text-sm font-bold flex items-center gap-1">
                    <ArrowRight size={14} className="rotate-90"/> Descargando {step.deliverA} α
                  </motion.div>
               )}
               {phase === 'loading' && step.pickupB > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-cyan-400 text-sm font-bold flex items-center gap-1">
                    <ArrowRight size={14} className="-rotate-90"/> Cargando {step.pickupB} β
                  </motion.div>
               )}
            </div>
          </div>
          
          {/* Slots representation */}
          <div className="flex-1 flex gap-1 items-end overflow-x-auto pb-2 px-2">
            <AnimatePresence mode="popLayout">
              {displaySlots.map((slot, idx) => (
                <motion.div
                  key={`${idx}-${slot}`}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: (phase === 'unloading' || phase === 'loading') ? Math.abs(displaySlots.length - idx) * 0.05 : 0 
                  }}
                  className={cn(
                    "w-6 h-12 rounded-sm border flex flex-col justify-end p-1 shrink-0",
                    slot === 'A' ? "bg-rose-500/10 border-rose-500/50" : 
                    slot === 'B' ? "bg-cyan-500/10 border-cyan-500/50" : 
                    "bg-zinc-800/50 border-zinc-800/50"
                  )}
                >
                  {slot === 'A' && <div className="w-full h-full bg-rose-500 rounded-[1px] shadow-[0_0_8px_rgba(244,63,94,0.4)]" />}
                  {slot === 'B' && <div className="w-full h-full bg-cyan-500 rounded-[1px] shadow-[0_0_8px_rgba(6,182,212,0.4)]" />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="text-xs text-zinc-500 text-right pr-2">Puerta Trasera →</div>
        </div>
      </div>

      {/* Explanation and Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 bg-zinc-950 border border-zinc-800 rounded-xl">
          <div className="text-zinc-500 text-sm font-medium mb-3 uppercase tracking-widest">Explicación del Paso</div>
          <div 
            className="text-zinc-300 leading-relaxed text-lg"
            dangerouslySetInnerHTML={{ __html: step.explanation }}
          />
        </div>

        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col justify-center items-center gap-6">
          <div className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Controles</div>
          <div className="flex gap-4">
            <button 
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 rounded-full text-zinc-100 transition-colors"
            >
              <SkipBack size={24} />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors"
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} />}
            </button>
            <button 
              onClick={handleNext}
              disabled={currentStep === solution.steps.length - 1}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 rounded-full text-zinc-100 transition-colors"
            >
              <SkipForward size={24} />
            </button>
          </div>
          <div className="text-zinc-400 font-medium">
            Paso {currentStep + 1} de {solution.steps.length}
          </div>
        </div>
      </div>

    </div>
  );
}
