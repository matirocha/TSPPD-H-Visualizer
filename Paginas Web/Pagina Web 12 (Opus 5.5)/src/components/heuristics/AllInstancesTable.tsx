/**
 * Todas las instancias de un tamaño en una tabla: manipulación (o costo total Z) de los
 * cuatro modelos Gurobi, del Algoritmo 2.1 (sobre la ruta de P3) y del ILS, con una fila de
 * promedios y la comparación del ILS con el óptimo de Gurobi P3. Pulsar la instancia la
 * abre en el simulador y en toda la sección.
 */
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import { MODELS } from '../../lib/models';
import { fmt, fmtDelta } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Segmented, SpotlightCard } from '../ui';
import { customerCountsOf, evalFor, gurobiFor, sameCost, type HeurInstance } from './data';
import { HEUR_METHODS, MethodMark, type MethodTone } from './methods';

type Metric = 'handling' | 'z';

interface Column {
  key: string;
  tone: MethodTone;
  label: string;
  title: string;
  value: (inst: HeurInstance, metric: Metric) => number | null;
}

const COLUMNS: Column[] = [
  ...MODELS.map((m) => ({
    key: m.id,
    tone: m.tone,
    label: m.tone === 'general' ? 'General' : m.short,
    title: `Gurobi · ${m.label}`,
    value: (inst: HeurInstance, metric: Metric) => {
      const g = gurobiFor(inst, m.id);
      return g ? (metric === 'handling' ? g.handlingCost : g.objectiveValue) : null;
    },
  })),
  {
    key: 'dp',
    tone: 'dp',
    label: HEUR_METHODS.dp.short,
    title: `${HEUR_METHODS.dp.label} sobre la ruta de Gurobi P3`,
    value: (inst, metric) => {
      const e = evalFor(inst, 'TSPPD-H_3');
      return e ? (metric === 'handling' ? e.handlingDP : e.objectiveDP) : null;
    },
  },
  {
    key: 'ils',
    tone: 'ils',
    label: HEUR_METHODS.ils.short,
    title: `${HEUR_METHODS.ils.label}: ruta y manipulación propias`,
    value: (inst, metric) => {
      const b = inst.ils?.best;
      return b ? (metric === 'handling' ? b.handlingCost : b.objectiveValue) : null;
    },
  },
];

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function AllInstancesTable({ instances }: { instances: HeurInstance[] }) {
  const { meta, actions } = useCatalog();
  const counts = useMemo(() => customerCountsOf(instances), [instances]);
  // Sigue al tamaño cargado en el simulador, pero el usuario puede cambiarlo.
  const curN = meta?.numCustomers ?? counts[counts.length - 1] ?? 10;
  const [n, setN] = useState(curN);
  const [prevCur, setPrevCur] = useState(curN);
  if (curN !== prevCur) {
    setPrevCur(curN);
    setN(curN);
  }
  const [metric, setMetric] = useState<Metric>('handling');

  const rows = useMemo(() => instances.filter((x) => x.numCustomers === n), [instances, n]);
  const values = useMemo(() => rows.map((inst) => COLUMNS.map((c) => c.value(inst, metric))), [rows, metric]);
  const averages = COLUMNS.map((_, j) => mean(values.map((v) => v[j]).filter(finite)));
  const ilsHits = rows.filter((inst) => {
    const p3 = gurobiFor(inst, 'TSPPD-H_3');
    return p3 && inst.ils?.best && sameCost(inst.ils.best.objectiveValue, p3.objectiveValue);
  }).length;
  const current = meta?.numCustomers === n ? meta.instanceId : null;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Todas las instancias</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">
            {metric === 'handling' ? 'Costo de manipulación' : 'Costo total Z'} en las{' '}
            <span className="num">{rows.length}</span> instancias de <span className="num">{n}</span> clientes
          </h3>
          <p className="mt-1 text-[12.5px] text-zinc-500">Pulsa una instancia para abrirla · en negrita, el menor.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {counts.length > 1 && (
            <Segmented<number>
              ariaLabel="Cantidad de clientes"
              size="xs"
              value={n}
              onChange={setN}
              options={counts.map((c) => ({ value: c, label: `${c} clientes` }))}
            />
          )}
          <Segmented<Metric>
            ariaLabel="Costo mostrado"
            size="xs"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'handling', label: 'Manipulación' },
              { value: 'z', label: 'Costo total Z' },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-500">No hay instancias con {n} clientes.</p>
      ) : (
        <div className="scrollbar-thin mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-[13px]">
            <caption className="sr-only">
              {metric === 'handling' ? 'Costo de manipulación' : 'Costo total Z'} por método en las instancias de {n} clientes
            </caption>
            <thead>
              <tr className="text-[10.5px] text-zinc-500">
                <td />
                <th scope="colgroup" colSpan={4} className="px-3 pb-1 text-center font-mono font-normal tracking-[0.12em] uppercase">
                  Gurobi
                </th>
                <th scope="colgroup" colSpan={2} className="border-l border-l-zinc-800 px-3 pb-1 text-center font-mono font-normal tracking-[0.12em] uppercase">
                  Erdoğan et al.
                </th>
                <td />
              </tr>
              <tr className="text-[11.5px] text-zinc-500">
                <th scope="col" className="border-b border-zinc-800 pr-3 pb-2 text-left font-medium">
                  Instancia
                </th>
                {COLUMNS.map((c, j) => (
                  <th
                    key={c.key}
                    scope="col"
                    title={c.title}
                    className={cn('border-b border-zinc-800 px-3 pb-2 text-right font-medium', j === 4 && 'border-l border-l-zinc-800')}
                  >
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <MethodMark tone={c.tone} size={11} />
                      <span className="text-zinc-300">{c.label}</span>
                    </span>
                  </th>
                ))}
                <th scope="col" className="border-b border-zinc-800 pb-2 pl-3 text-right font-medium" title="Costo total Z del ILS frente al de Gurobi P3">
                  ILS vs P3 (Z)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inst, i) => {
                const vals = values[i];
                const present = vals.filter(finite);
                const min = present.length ? Math.min(...present) : null;
                const isCurrent = inst.instanceId === current;
                return (
                  <tr key={inst.key} className={cn(isCurrent && 'bg-zinc-800/40')}>
                    <th scope="row" className="border-b border-zinc-800/60 py-0 pr-3 text-left font-normal">
                      <button
                        type="button"
                        onClick={() => actions.selectInstance(n, inst.instanceId)}
                        aria-current={isCurrent ? 'true' : undefined}
                        aria-label={`Abrir la instancia ${inst.instanceId} de ${n} clientes`}
                        className={cn(
                          'my-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/70 hover:text-zinc-50',
                          isCurrent ? 'font-semibold text-zinc-50' : 'text-zinc-300',
                        )}
                      >
                        Inst. <span className="num">{inst.instanceId}</span>
                      </button>
                    </th>
                    {vals.map((v, j) => {
                      const isMin = finite(v) && min !== null && sameCost(v, min);
                      return (
                        <td
                          key={COLUMNS[j].key}
                          className={cn(
                            'num border-b border-zinc-800/60 px-3 py-2 text-right',
                            j === 4 && 'border-l border-l-zinc-800',
                            isMin ? 'font-semibold text-zinc-50' : 'text-zinc-400',
                          )}
                        >
                          {finite(v) ? fmt(v) : '—'}
                        </td>
                      );
                    })}
                    <td className="border-b border-zinc-800/60 py-2 pl-3 text-right">
                      <IlsVsP3 inst={inst} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="pt-3 pr-3 text-left text-[12px] font-medium text-zinc-300">
                  Promedio
                </th>
                {averages.map((a, j) => (
                  <td
                    key={COLUMNS[j].key}
                    className={cn('num px-3 pt-3 text-right text-zinc-100', j === 4 && 'border-l border-l-zinc-800')}
                  >
                    {a === null ? '—' : fmt(a)}
                  </td>
                ))}
                <td className="pt-3 pl-3 text-right text-[12px] text-zinc-300">
                  <span className="num">{ilsHits}</span>/<span className="num">{rows.length}</span> iguales
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

    </SpotlightCard>
  );
}

function IlsVsP3({ inst }: { inst: HeurInstance }) {
  const p3 = gurobiFor(inst, 'TSPPD-H_3');
  const ils = inst.ils?.best;
  if (!p3 || !ils) return <span className="text-zinc-500">—</span>;
  if (sameCost(ils.objectiveValue, p3.objectiveValue)) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-ok">
        <Check className="h-3.5 w-3.5" aria-hidden />
        igual
      </span>
    );
  }
  return <span className="num text-zinc-300">{fmtDelta(ils.objectiveValue - p3.objectiveValue)}</span>;
}
