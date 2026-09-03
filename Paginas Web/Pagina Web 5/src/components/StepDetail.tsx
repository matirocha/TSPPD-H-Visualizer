import React from 'react';
import { Step, NodeDef, AnimationPhase } from '../types/solution';
import { cn } from '../lib/cn';
import { Box, Archive, Repeat } from 'lucide-react';
import { motion } from 'motion/react';

interface StepDetailProps {
  step: Step | null;
  nodes: NodeDef[];
  phase: AnimationPhase;
}

const PHASE_LABELS: Record<AnimationPhase, string> = {
  'idle': 'En espera',
  'moving': 'Moviendo',
  'handling-out': 'Descargando (Handling)',
  'unloading-alpha': 'Descargando α',
  'handling-back': 'Cargando (Handling)',
  'loading-beta': 'Cargando β',
  'step-complete': 'Paso completado'
};

export function StepDetail({ step, phase }: StepDetailProps) {
  if (!step) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5 h-full flex items-center justify-center text-zinc-500 text-sm">
        No hay paso seleccionado
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5 flex flex-col h-full gap-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-100 font-semibold flex items-center gap-2">
          Detalle del Paso {step.stepIndex + 1}
        </h3>
        <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
          <motion.div 
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
          <span className="text-xs font-medium text-emerald-400">
            {PHASE_LABELS[phase]}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge icon={Box} label="α entregadas" value={step.deliverA} colorClass="bg-red-500/10 text-red-400 border-red-500/20" />
        <Badge icon={Archive} label="β recolectadas" value={step.pickupB} colorClass="bg-cyan-500/10 text-cyan-400 border-cyan-500/20" />
        <Badge icon={Repeat} label="Handling Count" value={step.handlingCount} colorClass="bg-amber-500/10 text-amber-400 border-amber-500/20" />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div 
          className="text-sm leading-relaxed text-zinc-300 [&_strong]:text-zinc-100 [&_span]:!text-emerald-400 space-y-2"
          dangerouslySetInnerHTML={{ __html: step.explanation }}
        />
      </div>
    </div>
  );
}

function Badge({ icon: Icon, label, value, colorClass }: any) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium", colorClass)}>
      <Icon size={14} />
      <span>{label}: <strong>{value}</strong></span>
    </div>
  );
}
