'use client'

import { motion } from 'framer-motion'
import { Target, MapPin, Truck, Clock, Calculator, TrendingUp } from 'lucide-react'
import { cn, formatNumber } from '../lib/utils'

export function ObjectiveInfo({ solution }) {
  if (!solution) return null

  const routingCost = solution?.totalDistance ?? 0
  const handlingCost = solution?.handlingCost ?? 0
  const objectiveValue = solution?.objectiveValue ?? 0
  const capacity = solution?.capacity ?? 0
  const hVal = solution?.h ?? 0.1

  const stats = [
    {
      label: 'Función Objetivo',
      value: typeof objectiveValue === 'number' ? objectiveValue.toFixed(2) : String(objectiveValue),
      icon: Target,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      description: 'Valor óptimo total (ruteo + handling)',
    },
    {
      label: 'Costo de Ruteo',
      value: formatNumber(routingCost),
      icon: MapPin,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      description: 'Distancia total recorrida (km)',
    },
    {
      label: 'Costo de Handling',
      value: typeof handlingCost === 'number' ? handlingCost.toFixed(2) : String(handlingCost),
      icon: Calculator,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      description: 'Costo por manipulación LIFO (h × ops)',
    },
    {
      label: 'Capacidad Camión',
      value: formatNumber(capacity),
      icon: Truck,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      description: 'Capacidad máxima (slots)',
    },
    {
      label: 'Parámetro h',
      value: typeof hVal === 'number' ? hVal.toFixed(2) : String(hVal),
      icon: TrendingUp,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-100 dark:bg-cyan-900/30',
      description: 'Costo unitario de manipulación',
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          className={cn(
            'p-4 rounded-xl border border-border bg-card',
            'hover:shadow-md transition-shadow'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + index * 0.05 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('p-2 rounded-lg', stat.bg)}>
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}