/**
 * Esta instancia: las cuatro variantes (General, P1, P2, P3) con Z* descompuesto en
 * distancia + manipulación sobre una escala común, brecha frente al mejor y dos lecturas
 * breves calculadas a partir de los datos (nunca texto fijo).
 */
import { useMemo, useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import { Check } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import { TONE_CHIP } from '../../lib/models';
import { cn } from '../../lib/cn';
import { fmt, fmtDelta, fmtKm, fmtPct } from '../../lib/format';
import { hoverLift, spring, springSnappy, staggerChild, staggerParent, tapPress } from '../../lib/motion';
import { Chip, SpotlightCard } from '../ui';
import { COLOR, LegendItem } from './chart';
import { EPS, orderedVariants, type VariantRow } from './compareData';

type PresentRow = VariantRow & { meta: NonNullable<VariantRow['meta']> };

interface CompareData {
  rows: VariantRow[];
  present: PresentRow[];
  best: number;
  maxZ: number;
  sameDist: boolean;
  minDist: number;
  maxDist: number;
}

export function InstanceCompare() {
  const { siblings, activeModel, meta, actions } = useCatalog();
  const listRef = useRef<HTMLUListElement>(null);
  const visible = useInView(listRef, { once: true, margin: '-60px' });

  const data = useMemo((): CompareData | null => {
    const rows = orderedVariants(siblings);
    const present = rows.filter((r): r is PresentRow => r.meta !== null);
    if (!present.length) return null;
    const zs = present.map((r) => r.meta.objectiveValue);
    const best = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const dists = present.map((r) => r.meta.totalDistance);
    const sameDist = Math.max(...dists) - Math.min(...dists) < EPS;
    return { rows, present, best, maxZ, sameDist, minDist: Math.min(...dists), maxDist: Math.max(...dists) };
  }, [siblings]);

  if (!data || !meta) {
    return (
      <SpotlightCard className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
        No hay variantes disponibles para esta instancia.
      </SpotlightCard>
    );
  }

  const { rows, best, maxZ } = data;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Esta instancia</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">
            Instancia <span className="num">{meta.instanceId}</span> · <span className="num">{meta.numCustomers}</span> clientes
          </h3>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Q = <span className="num text-zinc-300">{meta.capacity}</span> · h = <span className="num text-zinc-300">{fmt(meta.h, 2)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1" aria-label="Leyenda">
          <LegendItem kind="bar" color={COLOR.dist}>
            Distancia
          </LegendItem>
          <LegendItem kind="bar" color={COLOR.handling}>
            Manipulación
          </LegendItem>
        </div>
      </div>

      <motion.ul
        ref={listRef}
        className="mt-4 flex flex-col gap-2"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        {rows.map((r) => (
          <motion.li key={r.model.id} variants={staggerChild}>
            {r.meta ? (
              <VariantButton
                row={r}
                best={best}
                maxZ={maxZ}
                visible={visible}
                current={r.model.id === activeModel}
                onSelect={() => actions.selectModel(r.model.id)}
              />
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-4 py-3.5 text-[13px] text-zinc-500">
                <Chip tone={r.model.tone}>{r.model.short}</Chip>
                Sin solución exportada para {r.model.label} en esta instancia.
              </div>
            )}
          </motion.li>
        ))}
      </motion.ul>

      <Insights data={data} />
    </SpotlightCard>
  );
}

function VariantButton({
  row,
  best,
  maxZ,
  visible,
  current,
  onSelect,
}: {
  row: VariantRow;
  best: number;
  maxZ: number;
  visible: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const m = row.meta!;
  const z = m.objectiveValue;
  const isBest = z - best <= EPS;
  const gap = best > 0 ? (z - best) / best : 0;
  const distPct = visible ? (m.totalDistance / (maxZ || 1)) * 100 : 0;
  const handPct = visible ? (m.handlingCost / (maxZ || 1)) * 100 : 0;
  const label = `${row.model.label}: Z* ${fmt(z)} (distancia ${fmtKm(m.totalDistance)} más manipulación ${fmt(m.handlingCost)})${
    isBest ? ', mejor de la instancia' : `, ${fmtDelta(z - best)} (${fmtPct(gap, 1)}) sobre el mejor`
  }${current ? '. Es el modelo cargado en el simulador.' : '. Pulsa para cargarlo en el simulador.'}`;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={current}
      aria-label={label}
      whileHover={hoverLift}
      whileTap={tapPress}
      transition={springSnappy}
      className={cn(
        'group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3.5 text-left',
        'transition-colors duration-150 sm:grid-cols-[10rem_minmax(0,1fr)_7.5rem]',
        current ? 'border-zinc-500/70 bg-zinc-800/45' : 'border-zinc-800/80 bg-zinc-950/30 hover:border-zinc-700 hover:bg-zinc-900/60',
      )}
    >
      {current && (
        <motion.span
          layoutId="compare-current-marker"
          transition={spring}
          aria-hidden
          className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-zinc-50"
        />
      )}

      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className={cn('inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 font-mono text-[11px] font-medium', TONE_CHIP[row.model.tone])}>
            {row.model.short}
          </span>
          <span className="truncate text-[13.5px] font-medium text-zinc-100">{row.model.label}</span>
        </span>
        {current && <span className="text-[11px] text-zinc-400">en simulador</span>}
      </span>

      <span className="order-last col-span-2 flex min-w-0 flex-col gap-1.5 sm:order-none sm:col-span-1">
        <span className="relative block h-2.5 w-[calc(100%-2px)]" aria-hidden>
          <motion.span
            className="absolute inset-y-0 left-0 rounded-l-[2px] bg-zinc-300"
            initial={false}
            animate={{ width: `${distPct}%` }}
            transition={spring}
            style={{ borderTopRightRadius: m.handlingCost > 0 ? 0 : 4, borderBottomRightRadius: m.handlingCost > 0 ? 0 : 4 }}
          />
          {m.handlingCost > 0 && (
            <motion.span
              className="absolute inset-y-0 ml-[2px] min-w-[2px] rounded-r-[4px] bg-handling"
              initial={false}
              animate={{ left: `${distPct}%`, width: `${handPct}%` }}
              transition={spring}
            />
          )}
        </span>
        <span className="flex items-baseline gap-1.5 text-[11.5px] text-zinc-500">
          <span className="num text-zinc-300">{fmtKm(m.totalDistance)}</span>+
          <span className="num text-zinc-300">{fmt(m.handlingCost)}</span>manip.
        </span>
      </span>

      <span className="flex flex-col items-end gap-1 text-right">
        <span className="num text-[15px] font-medium text-zinc-50">{fmt(z)}</span>
        {isBest ? (
          <Chip tone="ok">
            <Check className="h-3 w-3" aria-hidden />
            Mejor
          </Chip>
        ) : (
          <span className="num text-[11.5px] whitespace-nowrap text-zinc-400">
            {fmtDelta(z - best)} <span className="text-zinc-500">· {fmtPct(gap, 1)}</span>
          </span>
        )}
      </span>
    </motion.button>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

/** Dos lecturas breves: rol de la distancia y ahorro de la política híbrida P3. */
function Insights({ data }: { data: CompareData }) {
  const { present, sameDist, minDist, maxDist } = data;
  const by = (id: string) => present.find((r) => r.model.id === id)?.meta ?? null;
  const items: ReactNode[] = [];

  if (present.length > 1) {
    items.push(
      sameDist ? (
        <>
          Misma distancia (<Em>{fmtKm(minDist)}</Em>): la brecha es solo manipulación.
        </>
      ) : (
        <>
          Distancia entre <Em>{fmtKm(minDist)}</Em> y <Em>{fmtKm(maxDist)}</Em>: las rutas también difieren.
        </>
      ),
    );
  }

  const p3 = by('TSPPD-H_3');
  if (p3) {
    const parts: ReactNode[] = [];
    for (const [ref, code] of [
      [by('TSPPD-H_1'), 'P1'],
      [by('TSPPD-H_2'), 'P2'],
    ] as const) {
      if (!ref) continue;
      const s = ref.handlingCost - p3.handlingCost;
      parts.push(
        Math.abs(s) <= EPS ? (
          <span key={code}>iguala a {code}</span>
        ) : (
          <span key={code}>
            {s > 0 ? 'ahorra' : 'gasta'} <Em>{fmt(Math.abs(s))}</Em> {s > 0 ? 'vs' : 'más que'} {code}
          </span>
        ),
      );
    }
    if (parts.length) {
      items.push(
        <>
          En manipulación, P3{' '}
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 && ' y '}
              {p}
            </span>
          ))}
          .
        </>,
      );
    }
  }
  if (!items.length) return null;

  return (
    <ul className="mt-5 space-y-1.5 border-t border-zinc-800/70 pt-4">
      {items.map((node, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-pretty text-zinc-400">
          <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
          <span>{node}</span>
        </li>
      ))}
    </ul>
  );
}
