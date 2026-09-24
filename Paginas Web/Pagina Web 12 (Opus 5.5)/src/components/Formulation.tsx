import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { CircleCheck, Play } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { useCatalog } from '../state/SimulationProvider';
import { MODELS, modelMeta, type ModelMeta } from '../lib/models';
import { spring } from '../lib/motion';
import { cn } from '../lib/cn';
import type { ModelType } from '../types/solution';
import { Button, Chip, SectionHeader } from './ui';
import { ModelSummaryCard } from './model/ModelSummaryCard';
import { MathCard } from './model/MathCard';
import { TONE_ACCENT, TONE_TEXT } from './model/tones';

/** Mini-glifo del patrón de carga (F a la izquierda, compuerta a la derecha). */
function PatternGlyph({ model }: { model: ModelType }) {
  const cell = 'h-full rounded-[2px]';
  const A = 'bg-alpha/70';
  const B = 'bg-beta/70';
  return (
    <span aria-hidden className="flex h-2 w-16 items-stretch gap-[2px] rounded-[3px] bg-zinc-800/80 p-[2px]">
      {model === 'TSPPD-H' &&
        ['A', 'B', 'A', 'E', 'B', 'A', 'B', 'A'].map((k, i) => (
          <span key={i} className={cn(cell, 'flex-1', k === 'A' ? A : k === 'B' ? B : 'bg-transparent')} />
        ))}
      {model === 'TSPPD-H_1' && (
        <>
          <span className={cn(cell, A, 'flex-[5]')} />
          <span className={cn(cell, B, 'flex-[3]')} />
        </>
      )}
      {model === 'TSPPD-H_2' && (
        <>
          <span className={cn(cell, B, 'flex-[3]')} />
          <span className={cn(cell, A, 'flex-[5]')} />
        </>
      )}
      {model === 'TSPPD-H_3' && (
        <>
          <span className={cn(cell, B, 'flex-[2]')} />
          <span className={cn(cell, A, 'flex-[4]')} />
          <span className={cn(cell, B, 'flex-[2]')} />
        </>
      )}
    </span>
  );
}

function ModelTabs({
  value,
  active,
  onChange,
  idBase,
}: {
  value: ModelType;
  active: ModelType;
  onChange: (m: ModelType) => void;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % MODELS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + MODELS.length) % MODELS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MODELS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(MODELS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Formulaciones del TSPPD-H"
      aria-orientation="horizontal"
      className="grid grid-cols-2 gap-1 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-1 sm:grid-cols-4"
    >
      {MODELS.map((m, i) => {
        const selected = m.id === value;
        return (
          <button
            key={m.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${m.hashKey}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'group relative flex min-w-0 flex-col items-start gap-2 rounded-xl px-3.5 py-3 text-left transition-colors duration-150',
              selected ? 'text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${idBase}-indicator`}
                transition={spring}
                className="absolute inset-0 rounded-xl border border-zinc-700/80 bg-zinc-800/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
              >
                <span className={cn('absolute inset-x-4 -top-px h-px', TONE_ACCENT[m.tone])} />
              </motion.span>
            )}
            <span className="relative z-10 flex w-full items-center justify-between gap-2">
              <span className={cn('text-[13.5px] font-medium tracking-tight', selected && TONE_TEXT[m.tone])}>{m.label}</span>
              {m.id === active && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ok" title="Modelo activo en el simulador">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
                  <span className="sr-only sm:not-sr-only">activo</span>
                </span>
              )}
            </span>
            <span className="relative z-10 flex w-full flex-wrap items-center justify-between gap-2">
              <span className="num text-[11px] text-zinc-400">{m.equations}</span>
              <PatternGlyph model={m.id} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ActivateAside({ tab, meta }: { tab: ModelType; meta: ModelMeta }) {
  const { activeModel, actions } = useCatalog();
  if (tab === activeModel)
    return (
      <Chip tone="ok" size="sm" mono={false} className="h-8 gap-1.5 rounded-xl px-3 text-[13px]">
        <CircleCheck aria-hidden className="h-3.5 w-3.5" />
        Activo en el simulador
      </Chip>
    );
  return (
    <Button variant="primary" size="md" onClick={() => actions.selectModel(tab)}>
      <Play aria-hidden className="h-3.5 w-3.5" />
      Activar {meta.label} en el simulador
    </Button>
  );
}

export function Formulation() {
  const { activeModel } = useCatalog();
  const [tab, setTab] = useState<ModelType>(activeModel);
  const idBase = useId().replace(/:/g, '');

  // La pestaña sigue al simulador cada vez que cambia el modelo activo.
  useEffect(() => {
    setTab(activeModel);
  }, [activeModel]);

  const meta = modelMeta(tab);

  return (
    <div>
      <SectionHeader
        index="04"
        eyebrow="Modelo matemático"
        title="Cuatro formulaciones, una misma red"
        description="Formulaciones de Battarra, Erdoğan, Laporte y Vigo (2010) implementadas en Gurobi. Cada política restringe cómo se ordena la carga y, con ello, qué manipulaciones cuestan."
        aside={<ActivateAside tab={tab} meta={meta} />}
      />

      <div className="mt-10">
        <ModelTabs value={tab} active={activeModel} onChange={setTab} idBase={idBase} />
      </div>

      <div
        role="tabpanel"
        id={`${idBase}-panel`}
        aria-labelledby={`${idBase}-tab-${meta.hashKey}`}
        tabIndex={0}
        className="mt-4 grid grid-cols-1 items-start gap-4 rounded-2xl focus-visible:outline-offset-4 lg:grid-cols-12"
      >
        <div className="min-w-0 lg:sticky lg:top-20 lg:col-span-5">
          <ModelSummaryCard model={meta} isActive={tab === activeModel} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <MathCard model={meta} />
        </div>
      </div>
    </div>
  );
}
