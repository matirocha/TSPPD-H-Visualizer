/**
 * Algoritmo 2.1 sobre la ruta de cada modelo: se deja fija la ruta que encontró Gurobi y
 * el algoritmo recalcula la menor manipulación posible con la Política 3. Tabla de cuatro
 * filas: manipulación de Gurobi, la del Algoritmo 2.1 y la diferencia entre ambas.
 */
import type { ReactNode } from 'react';
import { MODELS } from '../../lib/models';
import { fmt, fmtDelta, fmtPct } from '../../lib/format';
import { cn } from '../../lib/cn';
import { SpotlightCard } from '../ui';
import { evalFor, sameCost, type HeurInstance } from './data';
import { MethodMark } from './methods';

export function RouteDpTable({ inst }: { inst: HeurInstance | null }) {
  const rows = MODELS.map((m) => ({ m, e: evalFor(inst, m.id) })).filter((r) => r.e !== null);

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <p className="eyebrow">Algoritmo 2.1</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">La misma ruta, con la mejor carga</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-pretty text-zinc-400">
        Se toma la ruta que encontró cada modelo de Gurobi y el Algoritmo 2.1 calcula su menor manipulación posible, eligiendo en cada cliente
        entre la <span className="text-p1">Política 1</span> y la <span className="text-p2">Política 2</span>.
      </p>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-zinc-800 px-4 py-4 text-[13px] text-zinc-500">
          Sin evaluaciones del Algoritmo 2.1 para esta instancia.
        </p>
      ) : (
        <div className="scrollbar-thin mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <caption className="sr-only">Manipulación de Gurobi y del Algoritmo 2.1 sobre la ruta de cada modelo</caption>
            <thead>
              <tr className="text-[11.5px] text-zinc-500">
                <th scope="col" className="border-b border-zinc-800 pr-3 pb-2 text-left font-medium">
                  Ruta de
                </th>
                <th scope="col" className="border-b border-zinc-800 px-2 pb-2 text-right font-medium sm:px-3">
                  Gurobi
                </th>
                <th scope="col" className="border-b border-zinc-800 px-2 pb-2 text-right font-medium sm:px-3">
                  Alg. 2.1
                </th>
                <th scope="col" className="border-b border-zinc-800 pb-2 pl-2 text-right font-medium sm:pl-3">
                  Diferencia
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, e }) => {
                const d = e!.handlingDP - e!.gurobiHandling;
                const equal = sameCost(e!.handlingDP, e!.gurobiHandling);
                const rel = e!.gurobiHandling > 0 ? Math.abs(d) / e!.gurobiHandling : null;
                return (
                  <tr key={m.id}>
                    <th scope="row" className="border-b border-zinc-800/60 py-2.5 pr-3 text-left font-normal">
                      <span className="flex items-center gap-2 text-zinc-100">
                        <MethodMark tone={m.tone} size={12} />
                        {m.tone === 'general' ? 'Modelo General' : m.label}
                      </span>
                    </th>
                    <td className="num border-b border-zinc-800/60 px-2 py-2.5 text-right sm:px-3 text-zinc-300">{fmt(e!.gurobiHandling)}</td>
                    <td className="num border-b border-zinc-800/60 px-2 py-2.5 text-right sm:px-3 text-zinc-100">{fmt(e!.handlingDP)}</td>
                    <td className="border-b border-zinc-800/60 py-2.5 pl-2 text-right whitespace-nowrap sm:pl-3">
                      {equal ? (
                        <span className="text-[12px] text-ok">igual</span>
                      ) : (
                        <span className={cn('num', d < 0 ? 'text-dp' : 'text-zinc-400')}>
                          {fmtDelta(d)}
                          {rel !== null && <span className="ml-1 hidden text-[11.5px] text-zinc-500 sm:inline">({fmtPct(rel)})</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Notes rows={rows.map((r) => ({ id: r.m.id, gurobi: r.e!.gurobiHandling, dp: r.e!.handlingDP }))} />
    </SpotlightCard>
  );
}

function Notes({ rows }: { rows: { id: string; gurobi: number; dp: number }[] }) {
  const gen = rows.find((r) => r.id === 'TSPPD-H');
  const items: ReactNode[] = [
    <>
      Diferencia <span className="text-dp">negativa</span>: con la misma ruta, el Algoritmo 2.1 manipula menos que Gurobi, porque combina ambas
      políticas en vez de usar una sola.
    </>,
  ];
  if (gen && gen.gurobi < gen.dp && !sameCost(gen.gurobi, gen.dp)) {
    items.push(
      <>
        Diferencia positiva en el Modelo General: ese modelo puede acomodar la carga libremente, sin limitarse a las Políticas 1 y 2.
      </>,
    );
  }
  return (
    <ul className="mt-5 space-y-2 text-[12.5px] leading-relaxed text-pretty text-zinc-400">
      {items.map((node, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
          <span>{node}</span>
        </li>
      ))}
    </ul>
  );
}
