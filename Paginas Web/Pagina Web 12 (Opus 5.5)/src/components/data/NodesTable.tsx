import { useMemo, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { Rows3 } from 'lucide-react';
import { useSim } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { modelMeta } from '../../lib/models';
import { nodePolicy } from '../../lib/policy';
import { fmt } from '../../lib/format';
import { springSoft } from '../../lib/motion';
import { cn } from '../../lib/cn';
import { Chip, Segmented, SpotlightCard } from '../ui';
import { instanceFacts, jumpToSimulator, nodeLabel } from './instance';

type SortKey = 'id' | 'visit';

interface Row {
  id: number;
  isDepot: boolean;
  alpha: number;
  beta: number;
  visit: number;
  stepIndex: number;
  handling: number;
  handlingCost: number;
  policy: 1 | 2 | null;
}

export function NodesTable() {
  const { solution, actions, step, mode, activeModel } = useSim();
  const { hoverNode, setHoverNode } = useHover();
  const [sort, setSort] = useState<SortKey>('id');

  const data = useMemo(() => {
    if (!solution) return null;
    const facts = instanceFacts(solution);
    const rows: Row[] = [...solution.nodes]
      .sort((a, b) => a.id - b.id)
      .map((n) => {
        const stepIndex = facts.stepTo.get(n.id) ?? -1;
        const s = solution.steps[stepIndex];
        return {
          id: n.id,
          isDepot: n.isDepot || n.id === 0,
          alpha: n.alpha,
          beta: n.beta,
          visit: facts.visit.get(n.id) ?? -1,
          stepIndex,
          handling: s?.handlingCount ?? 0,
          handlingCost: s?.handlingCost ?? 0,
          policy: nodePolicy(solution, n.id),
        };
      });
    const totalOps = solution.steps.reduce((a, s) => a + s.handlingCount, 0);
    const p1 = rows.filter((r) => r.policy === 1).length;
    const p2 = rows.filter((r) => r.policy === 2).length;
    return { rows, facts, totalOps, p1, p2, lastVisit: solution.tour.length - 1 };
  }, [solution]);

  if (!solution || !data) return null;

  const rows = sort === 'id' ? data.rows : [...data.rows].sort((a, b) => a.visit - b.visit);
  const model = modelMeta(activeModel);
  const isP3 = activeModel === 'TSPPD-H_3';
  const liveNode = (mode === 'stop' || mode === 'transit') && step ? step.to : null;

  const go = (r: Row) => {
    if (r.stepIndex < 0) return;
    jumpToSimulator(() => actions.selectStep(r.stepIndex));
  };
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, r: Row) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go(r);
    }
  };

  return (
    <SpotlightCard className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Rows3 aria-hidden className="h-3.5 w-3.5" />
            Nodos
          </p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-50">
            Depósito + {solution.numCustomers || data.rows.length - 1} clientes
          </h3>
          <p className="mt-1 text-[12.5px] text-zinc-400">Clic en una fila para saltar a esa parada.</p>
        </div>
        <Segmented<SortKey>
          size="xs"
          ariaLabel="Ordenar nodos"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'id', label: 'ID' },
            { value: 'visit', label: 'Visita' },
          ]}
        />
      </header>

      <div className="scrollbar-thin -mx-2 mt-4 overflow-x-auto px-2">
        <table className="w-full min-w-[330px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-zinc-400">
              <th scope="col" className="border-b border-zinc-800 py-2 pr-2 font-medium">
                Nodo
              </th>
              <th scope="col" className="border-b border-zinc-800 px-2 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-alpha" />
                  α<sub>i</sub>
                </span>
              </th>
              <th scope="col" className="border-b border-zinc-800 px-2 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-beta" />
                  β<sub>i</sub>
                </span>
              </th>
              <th scope="col" className="border-b border-zinc-800 px-2 py-2 text-right font-medium">
                Visita
              </th>
              <th scope="col" className="border-b border-zinc-800 px-2 py-2 font-medium">
                Política
              </th>
              <th scope="col" className="border-b border-zinc-800 py-2 pl-2 text-right font-medium" title="Manipulaciones LIFO en la parada">
                Manip.
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hovered = hoverNode === r.id;
              const live = liveNode === r.id;
              return (
                <motion.tr
                  key={r.id}
                  layout="position"
                  transition={springSoft}
                  tabIndex={0}
                  title="Ir a esta parada en el simulador"
                  onClick={() => go(r)}
                  onKeyDown={(e) => onKey(e, r)}
                  onMouseEnter={() => setHoverNode(r.id)}
                  onMouseLeave={() => setHoverNode(null)}
                  onFocus={() => setHoverNode(r.id)}
                  onBlur={() => setHoverNode(null)}
                  className={cn(
                    'group cursor-pointer outline-none transition-colors duration-150',
                    hovered ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40',
                    'focus-visible:bg-zinc-800/70',
                  )}
                >
                  <td className="relative border-b border-zinc-800/60 py-2 pr-2">
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-1.5 bottom-1.5 -left-2 w-[2px] rounded-full transition-opacity',
                        live ? 'bg-zinc-50 opacity-100' : 'bg-zinc-500 opacity-0 group-hover:opacity-60 group-focus-visible:opacity-100',
                      )}
                    />
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'num grid h-6 min-w-6 place-items-center rounded-md border px-1 text-[11px] font-medium',
                          r.isDepot ? 'border-zinc-600 bg-zinc-100 text-zinc-950' : 'border-zinc-700 bg-zinc-900 text-zinc-100',
                        )}
                      >
                        {nodeLabel(r.id)}
                      </span>
                      <span className="hidden text-zinc-300 xl:inline">{r.isDepot ? 'Depósito' : `Cliente ${r.id}`}</span>
                      {live && <span className="sr-only">(parada actual)</span>}
                    </span>
                  </td>
                  <td className="num border-b border-zinc-800/60 px-2 py-2 text-right text-zinc-100">
                    {r.isDepot ? <span className="text-zinc-500">—</span> : r.alpha}
                  </td>
                  <td className="num border-b border-zinc-800/60 px-2 py-2 text-right text-zinc-100">
                    {r.isDepot ? <span className="text-zinc-500">—</span> : r.beta}
                  </td>
                  <td className="num border-b border-zinc-800/60 px-2 py-2 text-right text-zinc-300">
                    {r.isDepot ? `0 / ${data.lastVisit}` : r.visit >= 0 ? `#${r.visit}` : '—'}
                  </td>
                  <td className="border-b border-zinc-800/60 px-2 py-2">
                    {r.isDepot ? (
                      <span className="text-zinc-500">—</span>
                    ) : isP3 && r.policy ? (
                      <Chip tone={r.policy === 1 ? 'p1' : 'p2'} title={r.policy === 1 ? 's_i = 1 · Política 1' : 's_i = 0 · Política 2'}>
                        P{r.policy}
                      </Chip>
                    ) : (
                      <Chip tone="muted" title={activeModel === 'TSPPD-H' ? 'Posiciones libres' : 'Política fija del modelo'}>
                        {activeModel === 'TSPPD-H' ? 'libre' : model.short}
                      </Chip>
                    )}
                  </td>
                  <td
                    className={cn(
                      'num border-b border-zinc-800/60 py-2 pl-2 text-right',
                      r.handling > 0 ? 'text-handling' : 'text-zinc-400',
                    )}
                    title={r.handling > 0 ? `Costo ${fmt(r.handlingCost, 2)}` : undefined}
                  >
                    {r.handling}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-zinc-50">
              <th scope="row" className="pt-2.5 pr-2 text-left text-[12px] font-medium text-zinc-300">
                Σ
              </th>
              <td className="num px-2 pt-2.5 text-right font-medium">{data.facts.sumAlpha}</td>
              <td className="num px-2 pt-2.5 text-right font-medium">{data.facts.sumBeta}</td>
              <td className="num px-2 pt-2.5 text-right text-zinc-500">—</td>
              <td className="px-2 pt-2.5">
                {isP3 ? (
                  <span className="num text-[11px] whitespace-nowrap text-zinc-300">
                    <span className="text-p1">{data.p1}</span> · <span className="text-p2">{data.p2}</span>
                  </span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
              <td className="num pt-2.5 pl-2 text-right font-medium text-handling" title={`Costo total ${fmt(solution.handlingCost, 2)}`}>
                {data.totalOps}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-auto pt-4 text-[11.5px] leading-relaxed text-zinc-400">
        Manip. = unidades evacuadas y recargadas en la parada (costo h c/u).
        {isP3 && ' Política = decisión s_i del modelo híbrido.'}
      </p>
    </SpotlightCard>
  );
}
