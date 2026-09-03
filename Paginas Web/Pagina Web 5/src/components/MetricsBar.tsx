import React from 'react';
import { Solution } from '../types/solution';
import { Target, Route, PackageOpen, Container, Settings, Users } from 'lucide-react';
import { cn } from '../lib/cn';

interface MetricsBarProps {
  solution: Solution;
}

export function MetricsBar({ solution }: MetricsBarProps) {
  const distanceRatio = (solution.totalDistance / solution.objectiveValue) * 100;
  const handlingRatio = (solution.handlingCost / solution.objectiveValue) * 100;

  return (
    <div className="bg-zinc-900/80 rounded-2xl p-4 flex flex-col gap-4 border border-zinc-800/50">
      <div className="flex flex-wrap gap-4">
        <MetricCard icon={Target} label="Función Objetivo" value={solution.objectiveValue.toFixed(2)} valueClassName="text-emerald-400" />
        <MetricCard icon={Route} label="Distancia Total" value={`${solution.totalDistance.toFixed(2)} km`} />
        <MetricCard icon={PackageOpen} label="Costo Handling" value={solution.handlingCost.toFixed(2)} />
        <MetricCard icon={Container} label="Capacidad Q" value={solution.capacity.toString()} />
        <MetricCard icon={Settings} label="Parámetro h" value={solution.h.toString()} />
        <MetricCard icon={Users} label="Clientes" value={solution.numCustomers.toString()} />
      </div>

      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden flex">
        <div 
          className="bg-blue-500 h-full" 
          style={{ width: `${distanceRatio}%` }}
          title={`Distancia: ${distanceRatio.toFixed(1)}%`}
        />
        <div 
          className="bg-amber-500 h-full" 
          style={{ width: `${handlingRatio}%` }}
          title={`Handling: ${handlingRatio.toFixed(1)}%`}
        />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, valueClassName }: { icon: React.ElementType, label: string, value: string, valueClassName?: string }) {
  return (
    <div className="flex-1 min-w-[140px] bg-zinc-950/50 rounded-xl p-3 flex items-start gap-3 border border-zinc-800/50">
      <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs text-zinc-500 font-medium mb-1">{label}</div>
        <div className={cn("text-lg font-semibold text-zinc-100", valueClassName)}>{value}</div>
      </div>
    </div>
  );
}
