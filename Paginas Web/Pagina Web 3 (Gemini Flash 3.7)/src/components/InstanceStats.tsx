import React, { useState } from 'react';
import { Solution } from '../types/tsppd';
import { Grid, ChevronDown, ChevronUp, Layers, CheckCircle } from 'lucide-react';

interface InstanceStatsProps {
  solution: Solution;
  currentStepIndex: number;
}

export const InstanceStats: React.FC<InstanceStatsProps> = ({
  solution,
  currentStepIndex,
}) => {
  const [showMatrix, setShowMatrix] = useState(false);

  const totalAlpha = solution.nodes
    .filter((n) => !n.isDepot)
    .reduce((sum, n) => sum + n.alpha, 0);

  const totalBeta = solution.nodes
    .filter((n) => !n.isDepot)
    .reduce((sum, n) => sum + n.beta, 0);

  const routingPct = (
    (solution.totalDistance / (solution.objectiveValue || 1)) *
    100
  ).toFixed(1);
  const handlingPct = (
    (solution.handlingCost / (solution.objectiveValue || 1)) *
    100
  ).toFixed(1);

  return (
    <div className="w-full bg-zinc-950 rounded-2xl border border-zinc-800/80 p-4 lg:p-5 flex flex-col gap-4 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100">
              Parámetros de la Instancia y Matriz de Demandas
            </h3>
            <p className="text-xs text-zinc-400">
              Datos base de la instancia {solution.instance}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowMatrix(!showMatrix)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5 text-purple-400" />
          <span>{showMatrix ? 'Ocultar Matriz C_ij' : 'Ver Matriz C_ij'}</span>
          {showMatrix ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Demand Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 font-sans uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Nodo</th>
              <th className="py-2.5 px-3">Tipo</th>
              <th className="py-2.5 px-3 text-rose-400">Demanda Entrega (α)</th>
              <th className="py-2.5 px-3 text-cyan-400">Demanda Recolección (β)</th>
              <th className="py-2.5 px-3">Estado en Tour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/60 text-zinc-300">
            {solution.nodes.map((node) => {
              const isVisited = solution.steps.some(
                (s, i) => i <= currentStepIndex && (s.from === node.id || s.to === node.id)
              );
              const isCurrent = solution.steps[currentStepIndex]?.to === node.id;

              return (
                <tr
                  key={`node-row-${node.id}`}
                  className={`hover:bg-zinc-900/40 transition-colors ${
                    isCurrent ? 'bg-emerald-950/20 font-semibold' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-bold text-zinc-100">
                    {node.id === 0 ? 'Nodo 0 (Depósito)' : `Cliente ${node.id}`}
                  </td>
                  <td className="py-2 px-3">
                    {node.isDepot ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                        Depósito Central
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                        Cliente
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-bold text-rose-400">
                    {node.isDepot ? `Total: ${totalAlpha}` : `${node.alpha} un.`}
                  </td>
                  <td className="py-2 px-3 font-bold text-cyan-400">
                    {node.isDepot ? `Total: ${totalBeta}` : `${node.beta} un.`}
                  </td>
                  <td className="py-2 px-3">
                    {isCurrent ? (
                      <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        En atención
                      </span>
                    ) : isVisited ? (
                      <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        Completado
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-[11px]">
                        Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Optional Distance Matrix Grid */}
      {showMatrix && (
        <div className="mt-1 p-3 bg-zinc-900/90 rounded-xl border border-purple-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
            <span>Matriz de Costos / Distancias C(i, j) en km</span>
            <span className="text-[10px] text-zinc-400 font-mono">Simétrica / Restringida</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-1 px-2">i \ j</th>
                  {solution.nodes.map((n) => (
                    <th key={`head-c-${n.id}`} className="py-1 px-2 text-zinc-300">
                      {n.id === 0 ? 'DEP' : `C${n.id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {solution.distMatrix.map((row, i) => (
                  <tr key={`matrix-row-${i}`} className="hover:bg-zinc-800/40">
                    <td className="py-1 px-2 font-bold text-zinc-400 border-r border-zinc-800">
                      {i === 0 ? 'DEP' : `C${i}`}
                    </td>
                    {row.map((val, j) => {
                      const isDiagonal = i === j;
                      const isTourEdge = solution.steps.some((s) => s.from === i && s.to === j);
                      return (
                        <td
                          key={`cell-${i}-${j}`}
                          className={`py-1 px-2 ${
                            isDiagonal
                              ? 'text-zinc-600'
                              : isTourEdge
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                              : 'text-zinc-300'
                          }`}
                        >
                          {isDiagonal ? '—' : val > 10000 ? '∞' : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Distribution Bar */}
      <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-zinc-200">Distribución de la Función Objetivo</span>
          <span className="font-mono text-zinc-400">
            Z* = {solution.objectiveValue.toFixed(2)}
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
          <div
            style={{ width: `${routingPct}%` }}
            className="bg-blue-500 h-full transition-all"
            title={`Ruteo: ${solution.totalDistance} (${routingPct}%)`}
          />
          <div
            style={{ width: `${handlingPct}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Handling: ${solution.handlingCost} (${handlingPct}%)`}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 pt-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />
            Distancia: {solution.totalDistance} km ({routingPct}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
            Handling: {solution.handlingCost.toFixed(2)} ({handlingPct}%)
          </span>
        </div>
      </div>

    </div>
  );
};
