import { useMemo, useRef, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Solution } from '@/types/solution'

interface RouteMapProps {
  solution: Solution
  currentStep: number
}

interface NodePos {
  x: number
  y: number
}

const W = 600
const H = 360

function computeNodePositions(solution: Solution): Record<number, NodePos> {
  const { nodes } = solution
  const cx = W / 2
  const cy = H / 2
  const radius = Math.min(W, H) * 0.36

  const positions: Record<number, NodePos> = {}
  const depot = nodes.find(n => n.isDepot)
  const customers = nodes.filter(n => !n.isDepot)

  if (depot) positions[depot.id] = { x: cx, y: cy }

  customers.forEach((node, i) => {
    const angle = (i / customers.length) * 2 * Math.PI - Math.PI / 2
    positions[node.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    }
  })

  return positions
}

// Format large distances (sentinel = 10000000)
function validDist(d: number) { return d < 9000000 }

// Generate a label for a node
function nodeLabel(id: number, isDepot: boolean) {
  return isDepot ? 'D' : `C${id}`
}

export default function RouteMap({ solution, currentStep }: RouteMapProps) {
  const prefersReduced = useReducedMotion()
  const nodePos = useMemo(() => computeNodePositions(solution), [solution])
  const step = solution.steps[currentStep]

  // For truck animation: target position is the destination of current step
  const truckTargetPos = nodePos[step.to]

  // Draw all tour edges (the visited sequence so far) and the full tour path
  const tour = solution.tour

  // Track animation phase for truck pulsing at destination
  const [truckArrived, setTruckArrived] = useState(false)
  useEffect(() => {
    setTruckArrived(false)
    const t = setTimeout(() => setTruckArrived(true), 1200)
    return () => clearTimeout(t)
  }, [currentStep])

  const completedEdges: Array<[number, number]> = []
  for (let i = 0; i < currentStep; i++) {
    completedEdges.push([solution.steps[i].from, solution.steps[i].to])
  }

  const activeFrom = nodePos[step.from]
  const activeTo = nodePos[step.to]

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Mapa de Ruta</p>
        <div className="flex items-center gap-3">
          <LegendDot color="#ef4444" label="Entrega α" />
          <LegendDot color="#06b6d4" label="Recolección β" />
          <LegendDot color="#3b82f6" label="Ruta activa" />
        </div>
      </div>

      {/* SVG Map */}
      <div className="flex-1 relative bg-zinc-900/40 rounded-xl border border-zinc-800 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ display: 'block' }}
        >
          {/* Background grid dots */}
          {Array.from({ length: 12 }, (_, row) =>
            Array.from({ length: 20 }, (_, col) => (
              <circle
                key={`dot-${row}-${col}`}
                cx={col * (W / 19)}
                cy={row * (H / 11)}
                r={1}
                fill="#27272a"
              />
            ))
          )}

          {/* All tour edges (faint) */}
          {tour.slice(0, -1).map((from, i) => {
            const to = tour[i + 1]
            const p1 = nodePos[from]
            const p2 = nodePos[to]
            if (!p1 || !p2) return null
            return (
              <line
                key={`full-edge-${i}`}
                x1={p1.x} y1={p1.y}
                x2={p2.x} y2={p2.y}
                stroke="#3f3f46"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )
          })}

          {/* Completed edges (brighter) */}
          {completedEdges.map(([from, to], i) => {
            const p1 = nodePos[from]
            const p2 = nodePos[to]
            if (!p1 || !p2) return null
            return (
              <line
                key={`done-edge-${i}`}
                x1={p1.x} y1={p1.y}
                x2={p2.x} y2={p2.y}
                stroke="#22c55e"
                strokeWidth={2}
                strokeOpacity={0.5}
              />
            )
          })}

          {/* Active edge — animated path */}
          {activeFrom && activeTo && (
            <motion.path
              key={`active-${step.from}-${step.to}`}
              d={`M ${activeFrom.x} ${activeFrom.y} L ${activeTo.x} ${activeTo.y}`}
              stroke="#3b82f6"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              initial={prefersReduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
            />
          )}

          {/* Distance label on active edge */}
          {activeFrom && activeTo && (
            <motion.text
              key={`dist-label-${step.from}-${step.to}`}
              x={(activeFrom.x + activeTo.x) / 2}
              y={(activeFrom.y + activeTo.y) / 2 - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#60a5fa"
              fontFamily="monospace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {step.distance} km
            </motion.text>
          )}

          {/* Nodes */}
          {solution.nodes.map(node => {
            const pos = nodePos[node.id]
            if (!pos) return null
            const isDepot = node.isDepot
            const isFrom = node.id === step.from
            const isTo = node.id === step.to
            const r = isDepot ? 20 : 16

            return (
              <g key={`node-${node.id}`}>
                {/* Glow ring for active nodes */}
                {(isFrom || isTo) && (
                  <motion.circle
                    cx={pos.x} cy={pos.y}
                    r={r + 8}
                    fill="none"
                    stroke={isDepot ? '#a855f7' : isTo ? '#3b82f6' : '#22c55e'}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    animate={{ r: [r + 6, r + 12, r + 6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={isDepot ? '#7c3aed' : '#1e293b'}
                  stroke={isDepot ? '#a855f7' : isTo ? '#3b82f6' : isFrom ? '#22c55e' : '#3f3f46'}
                  strokeWidth={isDepot || isFrom || isTo ? 2 : 1}
                />

                {/* Node label */}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isDepot ? 11 : 10}
                  fontWeight="700"
                  fontFamily="monospace"
                  fill={isDepot ? '#e879f9' : '#e2e8f0'}
                >
                  {nodeLabel(node.id, node.isDepot)}
                </text>

                {/* Node name below */}
                <text
                  x={pos.x}
                  y={pos.y + r + 10}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="monospace"
                  fill={isDepot ? '#a855f7' : '#71717a'}
                >
                  {node.label}
                </text>

                {/* Alpha/Beta indicators */}
                {!isDepot && (
                  <g>
                    <text
                      x={pos.x - 12}
                      y={pos.y - r - 4}
                      textAnchor="middle"
                      fontSize="7"
                      fontFamily="monospace"
                      fill="#ef4444"
                    >
                      α{node.alpha}
                    </text>
                    <text
                      x={pos.x + 12}
                      y={pos.y - r - 4}
                      textAnchor="middle"
                      fontSize="7"
                      fontFamily="monospace"
                      fill="#06b6d4"
                    >
                      β{node.beta}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Animated Truck */}
          {truckTargetPos && (
            <motion.g
              animate={prefersReduced ? undefined : {
                x: truckTargetPos.x,
                y: truckTargetPos.y - 36
              }}
              initial={{ x: nodePos[step.from]?.x ?? truckTargetPos.x, y: (nodePos[step.from]?.y ?? truckTargetPos.y) - 36 }}
              transition={{ duration: prefersReduced ? 0 : 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Truck body */}
              <rect x={-14} y={-10} width={28} height={16} rx={3} fill="#1d4ed8" stroke="#3b82f6" strokeWidth={1.5} />
              {/* Cab */}
              <rect x={8} y={-14} width={10} height={11} rx={2} fill="#2563eb" stroke="#3b82f6" strokeWidth={1} />
              {/* Window */}
              <rect x={10} y={-12} width={6} height={5} rx={1} fill="#93c5fd" opacity={0.8} />
              {/* Wheels */}
              <circle cx={-7} cy={7} r={3.5} fill="#374151" stroke="#4b5563" strokeWidth={1} />
              <circle cx={10} cy={7} r={3.5} fill="#374151" stroke="#4b5563" strokeWidth={1} />
              {/* Wheel hubs */}
              <circle cx={-7} cy={7} r={1.2} fill="#60a5fa" />
              <circle cx={10} cy={7} r={1.2} fill="#60a5fa" />
              {/* Connector to node */}
              <line x1={0} y1={8} x2={0} y2={16} stroke="#3b82f6" strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.4} />
            </motion.g>
          )}
        </svg>

        {/* Arrived indicator */}
        {truckArrived && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-3 right-3 text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded-md"
          >
            En {solution.nodes.find(n => n.id === step.to)?.label ?? `N${step.to}`}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-zinc-500 font-mono">{label}</span>
    </div>
  )
}
