import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import type { ModelMeta } from '../../lib/models';
import { fmt, fmtAuto } from '../../lib/format';
import { staggerChild, staggerParent } from '../../lib/motion';
import { cn } from '../../lib/cn';
import { Chip, SpotlightCard } from '../ui';
import { FORMULATIONS, NOTATION, type EqGroup, type EqLine } from './formulations';
import { Tex } from './Tex';
import { TONE_ACCENT } from './tones';
import { useCopy } from './useCopy';

function range(eqs: EqLine[]) {
  if (eqs.length === 1) return eqs[0].n;
  return `${eqs[0].n}–${eqs[eqs.length - 1].n}`;
}

function domainTex(domain: string) {
  return domain.startsWith('\\ge') ? domain : `\\in ${domain}`;
}

function BlockTitle({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-zinc-800/80 pb-2.5">
      <h4 className="text-[13px] font-medium tracking-tight text-zinc-100">{children}</h4>
      {meta && <span className="num text-[11px] text-zinc-400">{meta}</span>}
    </div>
  );
}

/** Una línea de ecuación: número del paper + fórmula (con scroll horizontal interno) + dominio. */
function EquationRow({ eq, emphasis = false }: { eq: EqLine; emphasis?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="num w-10 shrink-0 text-[11.5px] text-zinc-400">{eq.n}</span>
      <div className="scrollbar-thin min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className={cn('flex w-max items-center gap-x-5 py-1.5 pr-2', emphasis ? 'text-zinc-50' : 'text-zinc-100')}>
          <Tex tex={eq.tex} displayStyle />
          {eq.where && <Tex tex={eq.where} className="text-[0.9em] text-zinc-400" />}
        </div>
      </div>
    </div>
  );
}

function ConstraintGroup({ group, index }: { group: EqGroup; index: number }) {
  return (
    <motion.li variants={staggerChild} className="rounded-xl border border-zinc-800/80 bg-zinc-950/35 p-4">
      <div className="flex items-baseline gap-3">
        <span className="num w-10 shrink-0 text-[11px] text-zinc-500" aria-hidden>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h5 className="text-[13.5px] font-medium tracking-tight text-zinc-100">{group.title}</h5>
          <span className="num text-[11px] text-zinc-400">{range(group.eqs)}</span>
        </div>
      </div>
      <p className="mt-1 pl-[3.25rem] text-[13px] leading-relaxed text-pretty text-zinc-400">{group.note}</p>
      <div className="mt-2.5 space-y-0.5">
        {group.eqs.map((eq) => (
          <EquationRow key={eq.n} eq={eq} />
        ))}
        {group.impl && (
          <div className="mt-2 flex items-center gap-3 border-t border-dashed border-zinc-800 pt-2.5">
            <span className="w-10 shrink-0">
              <Chip tone="muted" title="Implementación de los scripts; no forma parte del paper">
                MTZ
              </Chip>
            </span>
            <div className="scrollbar-thin min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex w-max items-center gap-x-4 py-1 pr-2 text-zinc-300">
                <Tex tex={group.impl.tex} />
                <Tex tex={String.raw`i \ne j \in V_c`} className="text-[0.9em] text-zinc-400" />
                <span className="text-[12px] text-zinc-400">Así se implementa en los scripts Gurobi</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function MathCard({ model }: { model: ModelMeta }) {
  const { siblings, meta } = useCatalog();
  const f = FORMULATIONS[model.id];
  const sibling = siblings.find((s) => s.model === model.id);
  const { copied, copy } = useCopy();

  return (
    <SpotlightCard className="relative p-5 sm:p-7">
      <span aria-hidden className={cn('absolute inset-x-7 top-0 h-px opacity-80', TONE_ACCENT[model.tone])} />

      <motion.div key={model.id} variants={staggerParent} initial="hidden" animate="show">
        <motion.header variants={staggerChild} className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{f.section}</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
              <Tex tex={f.paperName} />
            </h3>
          </div>
          <Chip tone={model.tone} size="sm">
            {model.equations}
          </Chip>
        </motion.header>

        {/* Variables */}
        <motion.section variants={staggerChild} className="mt-7" aria-label="Variables">
          <BlockTitle meta={`${f.variables.length} símbolos`}>Variables</BlockTitle>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(7.5rem,auto)_1fr]">
            {f.variables.map((v) => (
              <div key={v.sym} className="contents">
                <dt className="flex flex-wrap items-baseline gap-x-1.5 text-zinc-50">
                  <Tex tex={v.sym} />
                  {v.domain && <Tex tex={domainTex(v.domain)} className="text-zinc-400" />}
                </dt>
                <dd className="-mt-2 text-[13px] leading-relaxed text-pretty text-zinc-400 sm:mt-0">{v.text}</dd>
              </div>
            ))}
          </dl>
        </motion.section>

        {/* Función objetivo */}
        <motion.section variants={staggerChild} className="mt-8" aria-label="Función objetivo">
          <BlockTitle meta={f.objective.n}>Función objetivo</BlockTitle>
          <div className="rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] sm:p-5">
            <div className="flex items-start gap-2">
              <div className="scrollbar-thin min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                <div className="w-max py-2 pr-2 text-[1.08rem] text-zinc-50">
                  <Tex tex={f.objective.tex} displayStyle />
                </div>
              </div>
              <span className="num shrink-0 pt-3 text-xs text-zinc-400">{f.objective.n}</span>
              <button
                type="button"
                onClick={() => void copy('objective', f.objective.tex)}
                aria-label={copied === 'objective' ? 'LaTeX copiado' : `Copiar LaTeX de la ecuación ${f.objective.n}`}
                title="Copiar LaTeX"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
              >
                {copied === 'objective' ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-400">{f.objective.note}</p>

            <div className="mt-4 border-t border-zinc-800/80 pt-3.5">
              {sibling ? (
                <>
                  <p className="text-[11.5px] text-zinc-400">
                    Solución Gurobi en la instancia actual · {meta?.numCustomers ?? sibling.numCustomers} clientes · ID{' '}
                    {meta?.instanceId ?? sibling.instanceId}
                  </p>
                  <dl className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <div className="flex items-baseline gap-2">
                      <dt className="text-[12px] text-zinc-400">Ruteo</dt>
                      <dd className="num text-[15px] text-zinc-100">{fmtAuto(sibling.totalDistance)}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt className="text-[12px] text-zinc-400">Manipulación</dt>
                      <dd className="num text-[15px] text-handling">{fmt(sibling.handlingCost, 2)}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt className="text-[12px] text-zinc-400">Valor objetivo</dt>
                      <dd className="num text-[15px] font-semibold text-zinc-50">{fmt(sibling.objectiveValue, 2)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="text-[12px] text-zinc-400">No hay solución de este modelo para la instancia actual.</p>
              )}
            </div>
          </div>
        </motion.section>

        {/* Restricciones */}
        <motion.section variants={staggerChild} className="mt-8" aria-label="Restricciones clave">
          <BlockTitle meta={`${f.groups.reduce((a, g) => a + g.eqs.length, 0)} ecuaciones`}>Restricciones clave</BlockTitle>
          <motion.ol variants={staggerParent} className="space-y-2.5">
            {f.groups.map((g, i) => (
              <ConstraintGroup key={g.id} group={g} index={i} />
            ))}
          </motion.ol>
        </motion.section>

        {/* Política 2: equivalencia con la Política 1 */}
        {f.extra && (
          <motion.section variants={staggerChild} className="mt-8" aria-label={f.extra.title}>
            <BlockTitle meta={range(f.extra.eqs)}>{f.extra.title}</BlockTitle>
            <p className="max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-400">{f.extra.lead}</p>
            <div className="mt-3 space-y-3">
              {f.extra.eqs.map((eq) => (
                <div key={eq.n} className="rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-4 py-3">
                  <EquationRow eq={eq} />
                  <p className="mt-1 pl-[3.25rem] text-[12.5px] leading-relaxed text-pretty text-zinc-400">{eq.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl border border-p2/25 bg-p2/[0.06] px-4 py-3 text-[13px] leading-relaxed text-pretty text-zinc-300">
              {f.extra.closing}
            </p>
          </motion.section>
        )}

        {/* Notación común */}
        <motion.footer variants={staggerChild} className="mt-8 border-t border-zinc-800/80 pt-5">
          <p className="eyebrow mb-3">Notación</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {NOTATION.map((n) => (
              <li key={n.tex} className="flex items-baseline gap-2 text-[12.5px] text-zinc-400">
                <Tex tex={n.tex} className="text-zinc-200" />
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </motion.footer>
      </motion.div>
    </SpotlightCard>
  );
}
