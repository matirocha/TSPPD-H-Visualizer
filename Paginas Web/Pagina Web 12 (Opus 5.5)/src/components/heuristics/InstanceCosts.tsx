/**
 * Esta instancia: costo de cada método en una tabla simple. Una barra horizontal por fila
 * muestra la manipulación en una escala común; al lado, la distancia y el costo total
 * Z = distancia + manipulación. Arriba los cuatro modelos exactos de Gurobi, abajo el
 * Algoritmo 2.1 (sobre la ruta de Gurobi P3) y el ILS (con su propia ruta).
 */
import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import { MODELS } from '../../lib/models';
import { fmt, fmtDelta, fmtKm } from '../../lib/format';
import { spring } from '../../lib/motion';
import { cn } from '../../lib/cn';
import { Chip, SpotlightCard } from '../ui';
import { evalFor, gurobiFor, sameCost, type HeurInstance } from './data';
import { HEUR_METHODS, METHOD_COLOR, MethodMark, type MethodTone } from './methods';

interface CostRow {
  key: string;
  tone: MethodTone;
  name: string;
  /** Subtítulo visible (solo heurísticas); en los modelos Gurobi va como tooltip. */
  note?: string;
  hint?: string;
  distance: number;
  handling: number;
  z: number;
}

const MODEL_NOTE: Record<string, string> = {
  'TSPPD-H': 'carga libre, sin política',
  'TSPPD-H_1': 'β siempre en la compuerta',
  'TSPPD-H_2': 'β siempre al fondo',
  'TSPPD-H_3': 'P1 o P2 en cada cliente',
};

function buildRows(inst: HeurInstance): { gurobi: CostRow[]; heur: CostRow[] } {
  const gurobi: CostRow[] = [];
  for (const m of MODELS) {
    const g = gurobiFor(inst, m.id);
    if (!g) continue;
    gurobi.push({
      key: m.id,
      tone: m.tone,
      name: m.tone === 'general' ? 'Modelo General' : m.label,
      hint: MODEL_NOTE[m.id],
      distance: g.totalDistance,
      handling: g.handlingCost,
      z: g.objectiveValue,
    });
  }
  const heur: CostRow[] = [];
  const p3 = evalFor(inst, 'TSPPD-H_3');
  if (p3) {
    heur.push({
      key: 'dp',
      tone: 'dp',
      name: HEUR_METHODS.dp.label,
      note: 'sobre la ruta de Gurobi P3',
      distance: p3.totalDistance,
      handling: p3.handlingDP,
      z: p3.objectiveDP,
    });
  }
  const best = inst.ils?.best;
  if (best) {
    heur.push({
      key: 'ils',
      tone: 'ils',
      name: HEUR_METHODS.ils.label,
      note: 'busca su propia ruta',
      distance: best.totalDistance,
      handling: best.handlingCost,
      z: best.objectiveValue,
    });
  }
  return { gurobi, heur };
}

export function InstanceCosts({ inst }: { inst: HeurInstance | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  if (!inst || (!inst.dp && !inst.ils)) {
    return (
      <SpotlightCard className="flex h-full items-center p-6 text-[13px] text-zinc-500">
        Sin resultados de las heurísticas para esta instancia.
      </SpotlightCard>
    );
  }

  const { gurobi, heur } = buildRows(inst);
  const all = [...gurobi, ...heur];
  const maxH = Math.max(0, ...all.map((r) => r.handling));
  const minZ = Math.min(...all.map((r) => r.z));
  const capacity = inst.dp?.capacity ?? inst.ils?.capacity;
  const h = inst.dp?.h ?? inst.ils?.h;

  return (
    <SpotlightCard ref={ref} className="flex h-full flex-col p-5 sm:p-6">
      <p className="eyebrow">Esta instancia</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">
        Costo por método · inst. <span className="num">{inst.instanceId}</span>, <span className="num">{inst.numCustomers}</span> clientes
      </h3>
      <p className="mt-1 text-[12.5px] text-zinc-500">
        {capacity !== undefined && (
          <>
            Q = <span className="num text-zinc-300">{capacity}</span> ·{' '}
          </>
        )}
        {h !== undefined && (
          <>
            h = <span className="num text-zinc-300">{fmt(h, 2)}</span> ·{' '}
          </>
        )}
        Z = distancia + manip.
      </p>

      <div className="scrollbar-thin mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">
            Distancia, manipulación y costo total Z de cada método en la instancia {inst.instanceId} de {inst.numCustomers} clientes
          </caption>
          <thead>
            <tr className="text-left text-[11.5px] text-zinc-500">
              <th scope="col" className="border-b border-zinc-800 pr-3 pb-2 font-medium">
                Método
              </th>
              <th scope="col" className="w-[42%] border-b border-zinc-800 px-2 pb-2 font-medium sm:px-3">
                Manipulación
              </th>
              <th scope="col" className="hidden border-b border-zinc-800 px-3 pb-2 text-right font-medium sm:table-cell">
                Distancia
              </th>
              <th scope="col" className="border-b border-zinc-800 pb-2 pl-2 text-right font-medium sm:pl-3">
                Costo total Z
              </th>
            </tr>
          </thead>
          <tbody>
            <GroupRow>Gurobi · modelos exactos</GroupRow>
            {gurobi.map((r, i) => (
              <Row key={r.key} row={r} maxH={maxH} best={sameCost(r.z, minZ)} inView={inView} delay={i * 0.05} />
            ))}
            {heur.length > 0 && <GroupRow>Erdoğan et al. (2012)</GroupRow>}
            {heur.map((r, i) => (
              <Row key={r.key} row={r} maxH={maxH} best={sameCost(r.z, minZ)} inView={inView} delay={(gurobi.length + i) * 0.05} />
            ))}
          </tbody>
        </table>
      </div>

      <Readings inst={inst} />
    </SpotlightCard>
  );
}

function GroupRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <th scope="colgroup" colSpan={4} className="pt-4 pb-1.5 text-left font-mono text-[10.5px] font-normal tracking-[0.12em] text-zinc-500 uppercase">
        {children}
      </th>
    </tr>
  );
}

function Row({ row, maxH, best, inView, delay }: { row: CostRow; maxH: number; best: boolean; inView: boolean; delay: number }) {
  const pct = maxH > 0 ? (row.handling / maxH) * 100 : 0;
  return (
    <tr>
      <th scope="row" className="border-b border-zinc-800/60 py-2.5 pr-2 text-left font-normal sm:pr-3">
        <span className="flex items-center gap-2">
          <MethodMark tone={row.tone} size={12} />
          <span className="min-w-0">
            <span className="block font-medium text-zinc-100" title={row.hint}>
              {row.name}
            </span>
            {row.note && <span className="block text-[11.5px] text-zinc-500">{row.note}</span>}
          </span>
        </span>
      </th>
      <td className="border-b border-zinc-800/60 px-2 py-2.5 sm:px-3">
        <span className="flex items-center gap-2 sm:gap-2.5">
          <span aria-hidden className="relative h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-zinc-800/70">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundColor: METHOD_COLOR[row.tone] }}
              initial={{ width: 0 }}
              animate={{ width: inView ? `${pct}%` : 0 }}
              transition={{ ...spring, delay: inView ? delay : 0 }}
            />
          </span>
          <span className="num w-11 shrink-0 text-right text-zinc-100">{fmt(row.handling)}</span>
        </span>
      </td>
      <td className="num hidden border-b border-zinc-800/60 px-3 py-2.5 text-right text-zinc-400 sm:table-cell">{fmtKm(row.distance)}</td>
      <td className="border-b border-zinc-800/60 py-2.5 pl-2 text-right whitespace-nowrap sm:pl-3">
        <span className={cn('num', best ? 'font-semibold text-zinc-50' : 'text-zinc-300')}>{fmt(row.z)}</span>
        {best && (
          <Chip tone="ok" className="ml-2 hidden align-middle sm:inline-flex">
            menor
          </Chip>
        )}
      </td>
    </tr>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

/** Una línea: Algoritmo 2.1 frente a Gurobi P3 (manipulación) e ILS frente al óptimo de P3 (Z). */
function Readings({ inst }: { inst: HeurInstance }) {
  const p3 = evalFor(inst, 'TSPPD-H_3');
  const p3z = gurobiFor(inst, 'TSPPD-H_3')?.objectiveValue;
  const ils = inst.ils?.best;
  const items: ReactNode[] = [];

  if (p3) {
    items.push(
      <span key="dp">
        Alg. 2.1:{' '}
        {sameCost(p3.handlingDP, p3.gurobiHandling) ? (
          <span className="text-ok">igual a Gurobi P3</span>
        ) : (
          <>
            <Em>{fmt(p3.handlingDP)}</Em> vs <Em>{fmt(p3.gurobiHandling)}</Em> de Gurobi P3
          </>
        )}
      </span>,
    );
  }
  if (ils && p3z !== undefined) {
    const d = ils.objectiveValue - p3z;
    items.push(
      <span key="ils">
        ILS:{' '}
        {sameCost(ils.objectiveValue, p3z) ? (
          <span className="text-ok">igual al óptimo de P3</span>
        ) : (
          <>
            <Em>{fmtDelta(d)}</Em> vs el óptimo de P3
          </>
        )}
      </span>,
    );
  }
  if (!items.length) return null;

  return (
    <p className="mt-4 border-t border-zinc-800/70 pt-3 text-[12.5px] text-zinc-400">
      {items.map((node, i) => (
        <span key={i}>
          {i > 0 && <span className="text-zinc-600"> · </span>}
          {node}
        </span>
      ))}
    </p>
  );
}
