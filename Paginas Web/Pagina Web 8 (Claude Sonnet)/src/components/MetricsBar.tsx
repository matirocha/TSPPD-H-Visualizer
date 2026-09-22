import { motion } from 'motion/react'
import { Solution } from '@/types/solution'
import {
  MapTrifold,
  Package,
  Coins,
  Truck,
  Users,
  Database
} from '@phosphor-icons/react'

interface MetricsBarProps {
  solution: Solution
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  accent?: string
}

function MetricCard({ icon, label, value, sub, accent = 'text-zinc-100' }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 border-r border-zinc-800 last:border-r-0"
    >
      <div className="text-zinc-500 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{label}</p>
        <p className={`text-base font-bold font-mono leading-tight ${accent}`}>{value}</p>
        {sub && <p className="text-[10px] text-zinc-600 font-mono">{sub}</p>}
      </div>
    </motion.div>
  )
}

export default function MetricsBar({ solution }: MetricsBarProps) {
  const handlingPct = solution.objectiveValue > 0
    ? ((solution.handlingCost / solution.objectiveValue) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="flex items-stretch border-b border-zinc-800 bg-zinc-900/50 overflow-x-auto flex-shrink-0">
      <MetricCard
        icon={<Truck size={16} weight="bold" />}
        label="Obj. Value"
        value={solution.objectiveValue.toFixed(2)}
        sub="Costo total óptimo"
        accent="text-blue-400"
      />
      <MetricCard
        icon={<MapTrifold size={16} weight="bold" />}
        label="Distancia"
        value={`${solution.totalDistance} km`}
        sub="Costo de ruteo"
        accent="text-emerald-400"
      />
      <MetricCard
        icon={<Package size={16} weight="bold" />}
        label="Handling"
        value={solution.handlingCost.toFixed(2)}
        sub={`${handlingPct}% del total`}
        accent={solution.handlingCost > 0 ? 'text-amber-400' : 'text-zinc-400'}
      />
      <MetricCard
        icon={<Database size={16} weight="bold" />}
        label="Capacidad"
        value={`Q = ${solution.capacity}`}
        sub="Posiciones LIFO"
        accent="text-zinc-300"
      />
      <MetricCard
        icon={<Users size={16} weight="bold" />}
        label="Clientes"
        value={solution.numCustomers}
        sub={`ID #${solution.instanceId}`}
        accent="text-zinc-300"
      />
      <MetricCard
        icon={<Coins size={16} weight="bold" />}
        label="h (handling)"
        value={solution.h}
        sub={`h_α=${solution.h_a} · h_β=${solution.h_b}`}
        accent="text-zinc-300"
      />
    </div>
  )
}
