import { Fragment, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronRight, Copy, FileCode } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import type { ModelMeta } from '../../lib/models';
import { nodePolicy } from '../../lib/policy';
import { springSoft } from '../../lib/motion';
import { cn } from '../../lib/cn';
import { Chip, SpotlightCard } from '../ui';
import { LoadingPattern } from './LoadingPattern';
import { useCopy } from './useCopy';
import { TONE_ACCENT } from './tones';

type FlowTone = 'handling' | 'alpha' | 'beta';
type Flow = { label: string; tone: FlowTone }[];

/** Secuencia de fases que el simulador muestra en cada parada de cliente (tras «Llegada»). */
const FLOW_P1: Flow = [
  { label: 'Evacuar β', tone: 'handling' },
  { label: 'Entregar α', tone: 'alpha' },
  { label: 'Reingreso β', tone: 'handling' },
  { label: 'Recoger β en compuerta', tone: 'beta' },
];
const FLOW_P2: Flow = [
  { label: 'Entregar α', tone: 'alpha' },
  { label: 'Evacuar α remanentes', tone: 'handling' },
  { label: 'β al fondo', tone: 'beta' },
  { label: 'Reingreso α', tone: 'handling' },
];
/** P3 con s_i = 0: si hay β en la compuerta (z > 0) primero se evacúan (término h_b z_ij). */
const FLOW_P3_P2: Flow = [{ label: 'Evacuar β de la compuerta (si hay)', tone: 'handling' }, ...FLOW_P2];
const FLOW_GEN: Flow = [
  { label: 'Evacuar lo que bloquea', tone: 'handling' },
  { label: 'Entregar α', tone: 'alpha' },
  { label: 'Recargar y recoger en cualquier posición', tone: 'beta' },
];

const DOT: Record<FlowTone, string> = {
  handling: 'bg-handling',
  alpha: 'bg-alpha',
  beta: 'bg-beta',
};

function FlowRow({ flow, lead }: { flow: Flow; lead?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
      {lead}
      {flow.map((f, i) => (
        <Fragment key={f.label}>
          {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-[12.5px] text-zinc-200">
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', DOT[f.tone])} />
            {f.label}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

/** Decisiones s_i de la instancia activa (solo P3), en orden de visita. */
function PolicyDecisions() {
  const { solution } = useCatalog();
  const { hoverNode, setHoverNode } = useHover();
  const decisions = useMemo(() => {
    if (!solution) return [];
    return solution.tour.filter((id) => id !== 0).map((id) => ({ id, policy: nodePolicy(solution, id) }));
  }, [solution]);
  if (!decisions.length) return null;
  const p1 = decisions.filter((d) => d.policy === 1).length;
  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-[12.5px] text-zinc-400">
        En la instancia activa: <span className="num text-p1">s_i = 1</span> en {p1} clientes ·{' '}
        <span className="num text-p2">s_i = 0</span> en {decisions.length - p1}
      </p>
      <ol aria-label="Decisiones s_i en orden de visita" className="mt-2.5 flex flex-wrap gap-1">
        {decisions.map((d) => (
          <li key={d.id}>
            <Chip
              tone={d.policy === 2 ? 'p2' : 'p1'}
              title={`Cliente ${d.id}: ${d.policy === 2 ? 'Política 2 (s_i = 0)' : 'Política 1 (s_i = 1)'}`}
              onMouseEnter={() => setHoverNode(d.id)}
              onMouseLeave={() => setHoverNode(null)}
              className={cn('cursor-default transition-transform', hoverNode === d.id && 'scale-110')}
            >
              C{d.id}
            </Chip>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ModelSummaryCard({ model, isActive }: { model: ModelMeta; isActive: boolean }) {
  const { copied, copy } = useCopy();

  return (
    <SpotlightCard className="relative p-5 sm:p-7">
      <span aria-hidden className={cn('absolute inset-x-7 top-0 h-px opacity-80', TONE_ACCENT[model.tone])} />

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={model.tone} size="sm">
          {model.short}
        </Chip>
        <span className="num text-xs text-zinc-400">{model.equations}</span>
      </div>

      <motion.div key={model.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springSoft}>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance text-zinc-50">{model.name}</h3>
        <p className="mt-2 max-w-[65ch] text-[14.5px] leading-relaxed text-pretty text-zinc-400">{model.summary}</p>
      </motion.div>

      <div className="mt-7">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Patrón de carga</p>
          <code className="num text-[12px] text-zinc-300">{model.pattern}</code>
        </div>
        <LoadingPattern model={model.id} />
      </div>

      <div className="mt-8">
        <p className="eyebrow mb-3">Cómo se ve en el simulador</p>
        <motion.div key={model.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={springSoft} className="space-y-2.5">
          {model.id === 'TSPPD-H_1' && <FlowRow flow={FLOW_P1} />}
          {model.id === 'TSPPD-H_2' && <FlowRow flow={FLOW_P2} />}
          {model.id === 'TSPPD-H' && <FlowRow flow={FLOW_GEN} />}
          {model.id === 'TSPPD-H_3' && (
            <>
              <FlowRow
                flow={FLOW_P1}
                lead={
                  <Chip tone="p1" className="mr-1">
                    s_i = 1
                  </Chip>
                }
              />
              <FlowRow
                flow={FLOW_P3_P2}
                lead={
                  <Chip tone="p2" className="mr-1">
                    s_i = 0
                  </Chip>
                }
              />
            </>
          )}
          <p className="pt-1 text-[12.5px] leading-relaxed text-pretty text-zinc-400">
            {model.id === 'TSPPD-H_1' && 'Si el cliente no tiene entrega (α_j = 0) no hay evacuación: las β nuevas solo se suman a la compuerta.'}
            {model.id === 'TSPPD-H_2' && 'Si el cliente no tiene recogida (β_i = 0) no hace falta reubicar las α: la entrega es directa.'}
            {model.id === 'TSPPD-H_3' && 'Cada cliente toma una de las dos secuencias según su decisión s_i, y el simulador indica en cada parada qué política se aplicó.'}
            {model.id === 'TSPPD-H' &&
              'El modelo decide qué posiciones k se manipulan (r_i^k = 1) respetando LIFO y dónde recargar cada unidad; puede intercalar α y β.'}{' '}
            Cada parada abre con «Llegada» y el tour cierra con la descarga total de β en el depósito.
          </p>
        </motion.div>
        {model.id === 'TSPPD-H_3' && isActive && <PolicyDecisions />}
      </div>

      <div className="mt-8 flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50 py-1.5 pr-1.5 pl-3">
        <FileCode aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-zinc-400">Script del solver (Gurobi)</p>
          <code className="num block truncate text-[12.5px] text-zinc-200" title={model.script}>
            {model.script}
          </code>
        </div>
        <button
          type="button"
          onClick={() => void copy('script', model.script)}
          aria-label={copied === 'script' ? 'Ruta copiada' : `Copiar ruta ${model.script}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          {copied === 'script' ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </SpotlightCard>
  );
}
