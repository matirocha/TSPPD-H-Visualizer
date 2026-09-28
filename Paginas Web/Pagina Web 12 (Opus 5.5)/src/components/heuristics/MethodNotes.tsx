/**
 * Cómo se calculó: el método de Erdoğan, Battarra, Laporte y Vigo (2012), fiel al paper, y
 * cómo reproducir los resultados.
 *
 * Tres pestañas (patrón WAI-ARIA tabs: flechas, Inicio y Fin; se activan al enfocar):
 *   · Algoritmo 2.1 + DP (§2.1): definiciones de p_ij y f(i), Ecs. (1)–(2), costo por parada y
 *     pseudocódigo del Algoritmo 2.1. La validación frente a Gurobi P3 se cuenta en los datos.
 *   · ILS · Algoritmo 4.2 (§4.2): pseudocódigo, parámetros leídos de los archivos ILS (por
 *     tamaño) y decisiones de implementación del script, cada una con su evidencia en los datos.
 *   · Reproducir: comandos con botón de copiar, archivos de salida, opciones y referencia.
 *
 * El texto metodológico sigue el paper y los docstrings de notebooks/tsppd_h_alg21_dp.py y
 * notebooks/tsppd_h_alg42_ils.py; todo número mostrado sale de los JSON de Outputs/Erdogan2012.
 * Los pseudocódigos reproducen los del paper (comentarios traducidos). Al pasar el puntero por
 * una regla o una fase se resaltan sus líneas (la referencia "l. a–b" también está en el texto).
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, type Variants } from 'motion/react';
import { ArrowUpRight, Check, CircleCheck, Copy, FolderOpen, RotateCw, Terminal, TriangleAlert } from 'lucide-react';
import { useCatalog } from '../../state/SimulationProvider';
import { MODELS } from '../../lib/models';
import { fmt, fmtAuto, fmtPct } from '../../lib/format';
import { cn } from '../../lib/cn';
import { spring, springSnappy, springSoft } from '../../lib/motion';
import type { ILSFile } from '../../types/heuristics';
import { Button, Chip, SpotlightCard } from '../ui';
import { Tex } from '../model/Tex';
import { useCopy } from '../model/useCopy';
import { COST_EPS, customerCountsOf, evalFor, sameCost, type HeurInstance } from './data';
import { ERDOGAN_REF, HEUR_METHODS, MethodMark } from './methods';

type TabKey = 'dp' | 'ils' | 'run';
/** Rango de líneas del pseudocódigo (1-based, inclusivo). */
type LineRange = readonly [number, number];

const RUN_DP = 'python notebooks/tsppd_h_alg21_dp.py --customers 5 10 --all-ids';
const RUN_ILS = 'python notebooks/tsppd_h_alg42_ils.py --customers 5 10 --all-ids';
const RUN_BUNDLE = 'npm run bundle';

const int = (v: number) => fmt(v, 0);
/** Porcentaje con decimal solo si hace falta (0,1 → "10 %", 0,125 → "12,5 %"). */
const pct = (v: number) => fmtPct(v, Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? 0 : 1);
/** Etiqueta de h en los nombres de archivo, como h_tag() de los scripts (0.1 → "01"). */
const hTag = (h: number) => String(h).replace('.', '');
const distinctNum = (xs: number[]) => [...new Set(xs.filter(Number.isFinite))].sort((a, b) => a - b);
const distinctStr = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
const list = (xs: number[], f: (v: number) => string = int) => (xs.length ? xs.map(f).join(' / ') : '—');
const joinEs = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const pad2 = (i: number) => String(i).padStart(2, '0');
/** |V_c| en texto corrido (número de clientes). */
const Vc = () => (
  <>
    |V<sub>c</sub>|
  </>
);

/* ───────────────────────── Datos derivados ───────────────────────── */

interface SizeNotes {
  n: number;
  files: number;
  nIter: number[];
  nRand: number[];
  d: number[];
  runs: number[];
  maxRandomTries: number[];
  seedMin: number | null;
  seedMax: number | null;
  neighborhood: string[];
  evaluation: string[];
  tspMethod: string[];
  /** Posiciones factibles del depósito en el ciclo TSP (mín–máx sobre instancias y direcciones). */
  feasibleMin: number | null;
  feasibleMax: number | null;
  /** Llamadas a la DP / vecinos examinados en la corrida reportada (la mejor semilla; ambas direcciones). */
  dpPerNeighbor: number | null;
}

interface Notes {
  instances: number;
  dpFiles: number;
  dpEvals: number;
  /** Modelos Gurobi cuyos tours evaluó la DP (orden canónico). */
  dpModels: string[];
  p3Checks: number;
  p3Matches: number;
  p3Mismatches: string[];
  generalChecks: number;
  generalBelow: number;
  meanDpMs: number | null;
  ilsFiles: number;
  sizes: SizeNotes[];
  twoDirBetter: number;
  /** Instancias con ILS-1dir e ILS-2dir en la corrida reportada. */
  twoDirChecks: number;
  /** Corridas (todas las semillas) donde ILS-2dir mejora estrictamente a ILS-1dir, y total comparable. */
  twoDirRunsBetter: number;
  twoDirRuns: number;
  randomMoves: number;
  exhaustedMoves: number;
  hValues: number[];
  nIter: number[];
  d: number[];
  runs: number[];
  seeds: number[];
  maxRandomTries: number[];
  tspMethod: string[];
  exampleDp: string | null;
  exampleIls: string | null;
}

function sizeNotes(n: number, files: ILSFile[]): SizeNotes {
  const params = files.map((f) => f.params).filter(Boolean);
  const seeds = files.flatMap((f) => f.runsSummary?.seeds ?? []);
  const dirs = files.flatMap((f) => f.directions ?? []);
  const feasible = dirs.map((d) => d.initial?.feasibleShifts).filter((x): x is number => Number.isFinite(x));
  const dpCalls = dirs.reduce((a, d) => a + (d.dpCalls ?? 0), 0);
  const scanned = dirs.reduce((a, d) => a + (d.neighborsScanned ?? 0), 0);
  return {
    n,
    files: files.length,
    nIter: distinctNum(params.map((p) => p.nIter)),
    nRand: distinctNum(params.map((p) => p.nRand)),
    d: distinctNum(params.map((p) => p.d)),
    runs: distinctNum(params.map((p) => p.runs)),
    maxRandomTries: distinctNum(params.map((p) => p.maxRandomTries)),
    seedMin: seeds.length ? Math.min(...seeds) : null,
    seedMax: seeds.length ? Math.max(...seeds) : null,
    neighborhood: distinctStr(params.map((p) => p.neighborhood)),
    evaluation: distinctStr(params.map((p) => p.evaluation)),
    tspMethod: distinctStr(params.map((p) => p.tspMethod)),
    feasibleMin: feasible.length ? Math.min(...feasible) : null,
    feasibleMax: feasible.length ? Math.max(...feasible) : null,
    dpPerNeighbor: scanned > 0 ? dpCalls / scanned : null,
  };
}

function deriveNotes(instances: HeurInstance[]): Notes {
  const dps = instances.flatMap((x) => (x.dp ? [x.dp] : []));
  const ils = instances.flatMap((x) => (x.ils ? [x.ils] : []));
  const evals = dps.flatMap((d) => d.evaluations ?? []);

  let p3Checks = 0;
  let p3Matches = 0;
  let generalChecks = 0;
  let generalBelow = 0;
  const p3Mismatches: string[] = [];
  // evalFor supone que el DP trae `evaluations`; un archivo incompleto no debe romper la tarjeta.
  const safeEval = (inst: HeurInstance, model: 'TSPPD-H' | 'TSPPD-H_3') => (Array.isArray(inst.dp?.evaluations) ? evalFor(inst, model) : null);
  for (const inst of instances) {
    const p3 = safeEval(inst, 'TSPPD-H_3');
    if (p3) {
      p3Checks++;
      if (sameCost(p3.handlingDP, p3.gurobiHandling)) p3Matches++;
      else p3Mismatches.push(`${inst.numCustomers} clientes · ID ${inst.instanceId}`);
    }
    const gen = safeEval(inst, 'TSPPD-H');
    if (gen) {
      generalChecks++;
      if (gen.gurobiHandling < gen.handlingDP - COST_EPS) generalBelow++;
    }
  }

  const models = new Set(evals.map((e) => e.model));
  const times = evals.map((e) => e.dpTimeMs).filter(Number.isFinite);

  // ILS-2dir se queda con la mejor dirección: solo "mejora" si la inversa es estrictamente mejor.
  let twoDirBetter = 0;
  let twoDirChecks = 0;
  let twoDirRunsBetter = 0;
  let twoDirRuns = 0;
  let randomMoves = 0;
  let exhaustedMoves = 0;
  for (const s of ils) {
    if (s.best && s.oneDir) {
      twoDirChecks++;
      if (s.best.objectiveValue < s.oneDir.objectiveValue && !sameCost(s.best.objectiveValue, s.oneDir.objectiveValue)) twoDirBetter++;
    }
    const two = s.runsSummary?.objectives ?? [];
    const one = s.runsSummary?.oneDirObjectives ?? [];
    two.forEach((z, i) => {
      if (!Number.isFinite(z) || !Number.isFinite(one[i])) return;
      twoDirRuns++;
      if (z < one[i] && !sameCost(z, one[i])) twoDirRunsBetter++;
    });
    // `directions` es la corrida reportada. Con un solo cliente no hay movimientos (la traza es constante).
    if (s.numCustomers < 2) continue;
    for (const d of s.directions ?? []) {
      randomMoves += (d.history?.length ?? 0) * (s.params?.nRand ?? 0);
      exhaustedMoves += d.discardedRandomMoves ?? 0;
    }
  }

  const params = ils.map((s) => s.params).filter(Boolean);
  return {
    instances: instances.length,
    dpFiles: dps.length,
    dpEvals: evals.length,
    dpModels: MODELS.filter((m) => models.has(m.id)).map((m) => m.short),
    p3Checks,
    p3Matches,
    p3Mismatches,
    generalChecks,
    generalBelow,
    meanDpMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    ilsFiles: ils.length,
    sizes: customerCountsOf(instances)
      .map((n) => sizeNotes(n, ils.filter((s) => s.numCustomers === n)))
      .filter((s) => s.files > 0),
    twoDirBetter,
    twoDirChecks,
    twoDirRunsBetter,
    twoDirRuns,
    randomMoves,
    exhaustedMoves,
    hValues: distinctNum([...dps.map((d) => d.h), ...ils.map((s) => s.h)]),
    nIter: distinctNum(params.map((p) => p.nIter)),
    d: distinctNum(params.map((p) => p.d)),
    runs: distinctNum(params.map((p) => p.runs)),
    seeds: distinctNum(params.map((p) => p.seed)),
    maxRandomTries: distinctNum(params.map((p) => p.maxRandomTries)),
    tspMethod: distinctStr(params.map((p) => p.tspMethod)),
    exampleDp: dps[0]?.filename ?? null,
    exampleIls: ils[0]?.filename ?? null,
  };
}

/* ───────────────────────── Pseudocódigo ───────────────────────── */

/** Algoritmo 2.1 · P(a, b, h_a, h_b), tal como en el paper (comentarios traducidos). */
const ALG21: string[] = [
  'for i = 0 to (n − 1)',
  '  b′ = 0;',
  '  y = 0;  // se aplicó Política 2 en i',
  '  // entregas remanentes a bordo',
  '  a′ = a_0;',
  '  for j = 1 to i',
  '    a′ = a′ − a_j;',
  '  for j = i + 1 to n',
  '    a′ = a′ − a_j;  // entregar (P1 ó P2)',
  '    // costo de P1 hasta aquí + P2 en j',
  '    if (b′ + b_j > 0)',
  '      p_ij = y + h_a a′ + h_b b′',
  '    else',
  '      p_ij = y',
  '    // Política 1',
  '    if (a_j > 0)',
  '      y = y + h_b b′',
  '    // recoger como si se usara P1',
  '    b′ = b′ + b_j',
];

/** Algoritmo 4.2 · ILS(N_iter, N_rand, Tour), tal como en el paper. */
const ALG42: string[] = [
  'costCurrent ← CostOfInitialTour',
  'bestTour ← Tour',
  'for it ← 1 to N_iter',
  '  Tour ← bestTour',
  '  for r ← 1 to N_rand',
  '    i, j ← RandomNumber(1, …, |V_c|)',
  '    if (i = j)',
  '      p ← RandomNumber(1, …, |V_c|, p ≠ i)',
  '      1OPT(Tour, i, p)',
  '    else',
  '      2OPT(Tour, i, j)',
  '  while (improvement)',
  '    costNew ← Perform Best Move(Tour)',
  '  if (costNew < costCurrent)',
  '    costCurrent ← costNew',
  '    bestTour ← Tour',
];

type TokKind = 'kw' | 'fn' | 'alpha' | 'beta' | 'cost' | 'dp' | 'var' | 'num' | 'op' | 'cm';

/** Tinte semántico con los tokens del sistema: α naranjo, β cian, manipulación rosa, p_ij ámbar. */
const TOK_CLASS: Record<TokKind, string> = {
  kw: 'font-semibold text-zinc-50',
  fn: 'text-ils',
  alpha: 'text-alpha',
  beta: 'text-beta',
  cost: 'text-handling',
  dp: 'text-dp',
  var: 'text-zinc-200',
  num: 'text-zinc-300',
  op: 'text-zinc-400',
  cm: 'italic text-zinc-500',
};

const KEYWORDS = new Set(['for', 'to', 'if', 'else', 'while']);
const FUNCTIONS = new Set(['RandomNumber', 'CostOfInitialTour', 'Perform', 'Best', 'Move']);
// comentario · 1OPT/2OPT · identificador (con _subíndice y ′ opcionales) · número · espacio · operador
const TOKEN_RE = /(\/\/.*$)|([12]OPT\b)|([A-Za-z]+(?:_[A-Za-z0-9]+)?′?)|(\d+)|(\s+)|([^\sA-Za-z0-9]+)/gu;

function classify(word: string): TokKind {
  if (KEYWORDS.has(word)) return 'kw';
  if (FUNCTIONS.has(word)) return 'fn';
  if (word.startsWith('p_')) return 'dp';
  if (word === 'y') return 'cost';
  const base = word.replace('′', '').split('_')[0];
  if (base === 'a') return 'alpha';
  if (base === 'b') return 'beta';
  if (base === 'h') return 'cost';
  return 'var';
}

function tokenize(line: string): { text: string; kind: TokKind | null }[] {
  const out: { text: string; kind: TokKind | null }[] = [];
  for (const m of line.matchAll(TOKEN_RE)) {
    const [text, comment, opt, word, num, space] = m;
    const kind: TokKind | null = comment ? 'cm' : opt ? 'fn' : word ? classify(word) : num ? 'num' : space ? null : 'op';
    out.push({ text, kind });
  }
  return out;
}

/** "a_j" → a<sub>j</sub>; conserva la prima (a′). */
function renderIdent(word: string): ReactNode {
  const prime = word.endsWith('′');
  const core = prime ? word.slice(0, -1) : word;
  const cut = core.indexOf('_');
  if (cut < 0) return word;
  return (
    <>
      {core.slice(0, cut)}
      <sub>{core.slice(cut + 1)}</sub>
      {prime ? '′' : null}
    </>
  );
}

const codeList: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.018 } } };
const codeLine: Variants = { hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0, transition: springSoft } };

function CodeBlock({
  caption,
  meta,
  lines,
  highlight,
  tone,
}: {
  caption: ReactNode;
  meta: ReactNode;
  lines: string[];
  highlight: LineRange | null;
  tone: 'dp' | 'ils';
}) {
  const hlClass = tone === 'dp' ? 'bg-dp/[0.09] shadow-[inset_2px_0_0_0_var(--color-dp)]' : 'bg-ils/[0.09] shadow-[inset_2px_0_0_0_var(--color-ils)]';
  return (
    <figure className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/60">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-zinc-800/80 px-3.5 py-2">
        <span className="text-[12.5px] font-medium text-zinc-100">{caption}</span>
        <span className="num text-[11px] text-zinc-400">{meta}</span>
      </figcaption>
      {/* Scroll horizontal interno: las líneas largas nunca desbordan la página */}
      <div className="scrollbar-thin overflow-x-auto" tabIndex={0} role="region" aria-label="Pseudocódigo (desplazable)">
        <motion.ol variants={codeList} className="w-max min-w-full py-2 font-mono text-[12px] leading-[1.7]">
          {lines.map((line, i) => {
            const on = !!highlight && i + 1 >= highlight[0] && i + 1 <= highlight[1];
            return (
              <motion.li key={i} variants={codeLine} className={cn('flex pr-4 transition-colors duration-200', on && hlClass)}>
                <span aria-hidden className="num w-9 shrink-0 pr-3 text-right text-[11px] text-zinc-500 select-none">
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  {tokenize(line).map((t, k) =>
                    t.kind === null ? (
                      t.text
                    ) : (
                      <span key={k} className={TOK_CLASS[t.kind]}>
                        {t.kind === 'cm' || t.kind === 'op' || t.kind === 'num' ? t.text : renderIdent(t.text)}
                      </span>
                    ),
                  )}
                </span>
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </figure>
  );
}

/* ───────────────────────── Piezas comunes ───────────────────────── */

const panelItem: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: springSoft } };

function Block({ title, meta, children, className }: { title: ReactNode; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={panelItem} className={cn('mt-6', className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-zinc-800/80 pb-2">
        <h4 className="text-[13px] font-medium tracking-tight text-zinc-100">{title}</h4>
        {meta && <span className="num min-w-0 text-[11px] break-all text-zinc-400">{meta}</span>}
      </div>
      {children}
    </motion.section>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <span className="num text-zinc-100">{children}</span>;
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <motion.p variants={panelItem} className="max-w-[65ch] text-[13px] leading-relaxed text-pretty text-zinc-400">
      {children}
    </motion.p>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-[12.5px] leading-relaxed text-pretty text-zinc-400">{children}</p>
  );
}

function LineRef({ range }: { range: LineRange }) {
  return (
    <span className="num shrink-0 text-[11px] text-zinc-500">
      l. {range[0]}–{range[1]}
    </span>
  );
}

/** Fila que resalta un rango de líneas del pseudocódigo al pasar el puntero (mejora progresiva). */
function HoverRow({ range, onHighlight, children }: { range: LineRange; onHighlight: (r: LineRange | null) => void; children: ReactNode }) {
  return (
    <li
      onMouseEnter={() => onHighlight(range)}
      onMouseLeave={() => onHighlight(null)}
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-3.5 py-2.5 transition-colors duration-150 hover:border-zinc-700 hover:bg-zinc-900/50"
    >
      {children}
    </li>
  );
}

function CommandRow({ cmd, prompt = true, copyKey, copied, onCopy }: { cmd: string; prompt?: boolean; copyKey: string; copied: boolean; onCopy: (key: string, text: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/80 pr-1 pl-3">
      <code className="scrollbar-thin min-w-0 flex-1 overflow-x-auto py-2 font-mono text-[12px] whitespace-pre text-zinc-200">
        {prompt && (
          <span aria-hidden className="text-zinc-500 select-none">
            ${' '}
          </span>
        )}
        {cmd}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onCopy(copyKey, cmd)}
        aria-label={copied ? `Copiado: ${cmd}` : `Copiar: ${cmd}`}
        title={copied ? 'Copiado' : 'Copiar'}
        className="text-zinc-400"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'ok' : 'copy'}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={springSnappy}
            className="grid place-items-center"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-ok" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          </motion.span>
        </AnimatePresence>
      </Button>
    </div>
  );
}

/* ───────────────────────── Pestañas ───────────────────────── */

const TABS: { key: TabKey; label: string; meta: string; accent: string }[] = [
  { key: 'dp', label: 'Alg. 2.1 + DP', meta: '§2.1 · O(n²)', accent: 'bg-dp' },
  { key: 'ils', label: 'ILS · Alg. 4.2', meta: '§4.2 · P3', accent: 'bg-ils' },
  { key: 'run', label: 'Reproducir', meta: 'CLI', accent: 'bg-zinc-100' },
];

function NotesTabs({ value, onChange, idBase }: { value: TabKey; onChange: (t: TabKey) => void; idBase: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(TABS[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Cómo se calculó"
      aria-orientation="horizontal"
      className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1"
    >
      {TABS.map((t, i) => {
        const selected = t.key === value;
        return (
          <motion.button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.key}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            whileTap={{ scale: 0.98 }}
            transition={springSnappy}
            className={cn(
              'relative flex min-w-0 flex-col items-start gap-1 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150',
              selected ? 'text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${idBase}-indicator`}
                transition={spring}
                className="absolute inset-0 rounded-[10px] border border-zinc-700/80 bg-zinc-800/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
              >
                <span className={cn('absolute inset-x-3 -top-px h-px', t.accent)} />
              </motion.span>
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {t.key === 'run' ? <Terminal className="h-3 w-3 text-zinc-300" aria-hidden /> : <MethodMark tone={t.key} size={11} />}
              <span className="num text-[10.5px] text-zinc-400">{t.meta}</span>
            </span>
            <span className="relative z-10 text-[12.5px] leading-tight font-medium tracking-tight text-balance">{t.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── A · Algoritmo 2.1 + DP ───────────────────────── */

const P1_LINES: LineRange = [15, 17];
const P2_LINES: LineRange = [10, 14];

function DpPanel({ notes }: { notes: Notes }) {
  const [hl, setHl] = useState<LineRange | null>(null);

  return (
    <>
      <Lead>
        Para un tour fijo, con los clientes renumerados <Tex tex="1,\dots,n" /> según su orden de visita, la DP decide en cada cliente entre{' '}
        <span className="text-p1">Política 1</span> (β en la compuerta) y <span className="text-p2">Política 2</span> (β al fondo). El vehículo
        sale del depósito con <Tex tex="a_0=\sum_{i\in V_c} a_i" /> entregas a bordo.
      </Lead>

      <Block title="Definiciones" meta="§2.1">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5">
          <dt className="text-zinc-50">
            <Tex tex="p_{ij}" />
          </dt>
          <dd className="text-[12.5px] leading-relaxed text-pretty text-zinc-400">
            Costo de aplicar Política 1 en los clientes <Tex tex="i+1,\dots,j-1" /> y Política 2 en el cliente <Tex tex="j" />.
          </dd>
          <dt className="text-zinc-50">
            <Tex tex="f(i)" />
          </dt>
          <dd className="text-[12.5px] leading-relaxed text-pretty text-zinc-400">
            Costo óptimo de manipular los clientes <Tex tex="i+1,\dots,n" /> dado que se aplicó Política 2 en <Tex tex="i" />.
          </dd>
          <dt className="text-zinc-50">
            <Tex tex="a',\ b',\ y" />
          </dt>
          <dd className="text-[12.5px] leading-relaxed text-pretty text-zinc-400">
            Entregas α a bordo, recogidas β a bordo (en la compuerta) y costo acumulado de aplicar Política 1.
          </dd>
        </dl>
      </Block>

      <Block title="Programación dinámica" meta="Ecs. (1)–(2)">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 py-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="num w-7 shrink-0 text-[11.5px] text-zinc-400">(1)</span>
              <div className="scrollbar-thin min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1 text-zinc-50">
                  <Tex tex="f(i)=\min_{j\in\{i+1,\dots,n\}}\left\{p_{ij}+f(j)\right\}" displayStyle />
                  <Tex tex="\forall\, i\in\{0,\dots,n-1\}" className="text-[0.9em] text-zinc-400" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="num w-7 shrink-0 text-[11.5px] text-zinc-400">(2)</span>
              <div className="py-1 text-zinc-50">
                <Tex tex="f(n)=0" />
              </div>
            </div>
          </div>
          <p className="mt-2 border-t border-zinc-800/80 pt-2.5 text-[12.5px] leading-relaxed text-pretty text-zinc-400">
            La manipulación óptima del tour es <Tex tex="f(0)" className="text-zinc-100" />. Son <Tex tex="n" /> estados de costo{' '}
            <Tex tex="O(n)" />: <Tex tex="O(n^2)" className="text-zinc-100" />, igual que el Algoritmo 2.1, que calcula antes todos los{' '}
            <Tex tex="p_{ij}" />.
          </p>
        </div>
      </Block>

      <Block title="Costo en cada parada j" meta="Algoritmo 2.1">
        <ul className="space-y-1.5">
          <HoverRow range={P1_LINES} onHighlight={setHl}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Chip tone="p1">P1 · compuerta</Chip>
              <Tex tex="h_b\,b'" className="text-zinc-50" />
              <span className="text-[12px] text-zinc-400">si</span>
              <Tex tex="a_j>0" className="text-zinc-200" />
              <span className="ml-auto">
                <LineRef range={P1_LINES} />
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-pretty text-zinc-400">
              Si j recibe entregas, las β de la compuerta obstruyen: se descargan y recargan. Las nuevas β quedan en la compuerta.
            </p>
          </HoverRow>
          <HoverRow range={P2_LINES} onHighlight={setHl}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Chip tone="p2">P2 · fondo</Chip>
              <Tex tex="h_a\,a'+h_b\,b'" className="text-zinc-50" />
              <span className="text-[12px] text-zinc-400">si</span>
              <Tex tex="b'+b_j>0" className="text-zinc-200" />
              <span className="ml-auto">
                <LineRef range={P2_LINES} />
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-pretty text-zinc-400">
              Si hay β que reubicar, se evacúan las β de la compuerta y las α que siguen a bordo tras entregar en j; todas las β pasan al fondo.
            </p>
          </HoverRow>
        </ul>
      </Block>

      <Block title="Pseudocódigo" meta="comentarios traducidos">
        <CodeBlock
          caption={
            <>
              Algoritmo 2.1 · <Tex tex="P(a,b,h_a,h_b)" />
            </>
          }
          meta={`${ALG21.length} líneas`}
          lines={ALG21}
          highlight={hl}
          tone="dp"
        />
      </Block>

      <Block title="Validación" meta={HEUR_METHODS.dp.script}>
        <DpValidation notes={notes} />
      </Block>
    </>
  );
}

function DpValidation({ notes }: { notes: Notes }) {
  if (notes.p3Checks === 0) {
    return (
      <EmptyNote>
        No hay evaluaciones de la DP sobre tours de la Política 3. Ejecuta el Algoritmo 2.1 (pestaña Reproducir) para contrastarla con Gurobi.
      </EmptyNote>
    );
  }
  const all = notes.p3Matches === notes.p3Checks;
  return (
    <div className="space-y-2">
      <div className={cn('rounded-xl border px-4 py-3', all ? 'border-ok/25 bg-ok/[0.06]' : 'border-handling/30 bg-handling/[0.06]')}>
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-pretty text-zinc-300">
          {all ? (
            <CircleCheck className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
          ) : (
            <TriangleAlert className="mt-[3px] h-3.5 w-3.5 shrink-0 text-handling" aria-hidden />
          )}
          <span>
            Sobre el tour de la Política 3, la DP reproduce la manipulación óptima de Gurobi en <Em>{int(notes.p3Matches)}</Em>/
            <Em>{int(notes.p3Checks)}</Em> rutas
            {!all && <> (no coincide en {joinEs(notes.p3Mismatches)})</>}.
          </span>
        </p>
        <p className="mt-1.5 pl-[22px] text-[12px] leading-relaxed text-pretty text-zinc-400">
          <Em>{int(notes.dpEvals)}</Em> tours Gurobi evaluados{notes.dpModels.length > 0 && <> ({joinEs(notes.dpModels)})</>}
          {notes.meanDpMs !== null && (
            <>
              {' '}
              · <Em>{fmt(notes.meanDpMs, 3)}</Em> ms por tour en promedio
            </>
          )}
          . Cada evaluación exportada coincide con una simulación física de la carga, y <code className="font-mono text-zinc-300">--verify</code> compara
          la DP con la enumeración de las <Tex tex="2^n" /> combinaciones de políticas.
        </p>
      </div>
      {notes.generalChecks > 0 &&
        (notes.generalBelow > 0 ? (
          <p className="text-[12px] leading-relaxed text-pretty text-zinc-400">
            En la ruta del Modelo General, Gurobi manipula menos que la DP en <Em>{int(notes.generalBelow)}</Em>/<Em>{int(notes.generalChecks)}</Em>{' '}
            rutas: el modelo general no se limita a las Políticas 1 y 2, así que la Política 3 es una restricción, no un error.
          </p>
        ) : (
          <p className="text-[12px] leading-relaxed text-pretty text-zinc-400">
            En la ruta del Modelo General, Gurobi no manipula menos que la DP en ninguna de las <Em>{int(notes.generalChecks)}</Em> rutas.
          </p>
        ))}
    </div>
  );
}

/* ───────────────────────── B · ILS · Algoritmo 4.2 ───────────────────────── */

const ILS_PHASES: { range: LineRange; title: string; text: ReactNode }[] = [
  {
    range: [1, 2],
    title: 'Inicio',
    text: 'Tour inicial: el ciclo TSP con el depósito reubicado; costCurrent es su costo exacto.',
  },
  {
    range: [5, 11],
    title: 'Diversificación',
    text: (
      <>
        <Tex tex="N_{\text{rand}}" /> movimientos al azar sobre bestTour: si i = j, el cliente de la posición i pasa a p ≠ i (1-opt); si no, se
        invierte la cadena entre i y j (2-opt).
      </>
    ),
  },
  {
    range: [12, 13],
    title: 'Búsqueda local',
    text: 'Mientras un relocate o 2-opt factible mejore el tour, se aplica el mejor movimiento.',
  },
  {
    range: [14, 16],
    title: 'Aceptación',
    text: 'Si el óptimo local mejora a costCurrent, pasa a ser bestTour; la iteración siguiente parte de él.',
  },
];

function IlsPanel({ notes }: { notes: Notes }) {
  const [hl, setHl] = useState<LineRange | null>(null);

  return (
    <>
      <Lead>
        Búsqueda local iterada sobre la Política 3. El costo de cada tour es ruteo + manipulación óptima, calculada con el Algoritmo 2.1 + DP
        (evaluación exacta del vecindario relocate + 2-opt).
      </Lead>

      <Block title="Pseudocódigo" meta={HEUR_METHODS.ils.reference}>
        <CodeBlock
          caption={
            <>
              Algoritmo 4.2 · ILS(<Tex tex="N_{\text{iter}},N_{\text{rand}}" />, Tour)
            </>
          }
          meta={`${ALG42.length} líneas`}
          lines={ALG42}
          highlight={hl}
          tone="ils"
        />
        <ul className="mt-2.5 space-y-1.5">
          {ILS_PHASES.map((p) => (
            <HoverRow key={p.title} range={p.range} onHighlight={setHl}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium text-zinc-100">{p.title}</span>
                <LineRef range={p.range} />
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-pretty text-zinc-400">{p.text}</p>
            </HoverRow>
          ))}
        </ul>
      </Block>

      <Block title="Parámetros" meta={notes.ilsFiles > 0 ? `${int(notes.ilsFiles)} archivos ILS` : undefined}>
        {notes.sizes.length === 0 ? (
          <EmptyNote>Sin resultados del ILS: los parámetros se leen de los archivos ILS_… al ejecutar el script (pestaña Reproducir).</EmptyNote>
        ) : (
          <ParamsTable sizes={notes.sizes} />
        )}
      </Block>

      <Block title="Decisiones de implementación" meta={HEUR_METHODS.ils.script}>
        <Decisions notes={notes} />
      </Block>
    </>
  );
}

interface ParamRow {
  key: string;
  label: ReactNode;
  hint?: ReactNode;
  cells: ReactNode[];
  /** Texto común a todos los tamaños (se muestra en una sola celda). */
  merged?: string | null;
}

function ParamsTable({ sizes }: { sizes: SizeNotes[] }) {
  const textRow = (key: string, label: string, pick: (s: SizeNotes) => string[]): ParamRow => {
    const per = sizes.map((s) => pick(s).join(' / ') || '—');
    return { key, label, cells: per, merged: per.every((v) => v === per[0]) ? per[0] : null };
  };

  const rows: ParamRow[] = [
    { key: 'iter', label: <Tex tex="N_{\text{iter}}" />, hint: 'iteraciones por dirección', cells: sizes.map((s) => list(s.nIter)) },
    {
      key: 'd',
      label: <Tex tex="d" />,
      hint: (
        <>
          fracción de <Vc />
        </>
      ),
      cells: sizes.map((s) => list(s.d, pct)),
    },
    {
      key: 'rand',
      label: <Tex tex="N_{\text{rand}}" />,
      hint: (
        <>
          d·<Vc />, redondeado (mín. 1)
        </>
      ),
      cells: sizes.map((s) => (
        <>
          {list(s.nRand)}
          <span className="block text-[11px] text-zinc-500">d·<Vc /> = {s.d.length ? s.d.map((d) => fmtAuto(d * s.n, 2)).join(' / ') : '—'}</span>
        </>
      )),
    },
    {
      key: 'runs',
      label: 'Corridas',
      hint: 'semillas consecutivas',
      cells: sizes.map((s) => (
        <>
          {list(s.runs)}
          {s.seedMin !== null && s.seedMax !== null && (
            <span className="block text-[11px] text-zinc-500">
              semillas {int(s.seedMin)}–{int(s.seedMax)}
            </span>
          )}
        </>
      )),
    },
    { key: 'tries', label: 'Intentos', hint: 'por movimiento aleatorio', cells: sizes.map((s) => list(s.maxRandomTries)) },
    textRow('nb', 'Vecindario', (s) => s.neighborhood),
    textRow('ev', 'Evaluación', (s) => s.evaluation),
    textRow('tsp', 'Tour TSP inicial', (s) => s.tspMethod),
  ];

  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-zinc-800/80">
      <table className="w-full text-left text-[12.5px]">
        <caption className="sr-only">Parámetros del ILS leídos de los archivos de resultados, por número de clientes</caption>
        <thead className="bg-zinc-950/40 text-[11px] text-zinc-400">
          <tr>
            <th scope="col" className="px-3 py-2 font-normal">
              Parámetro
            </th>
            {sizes.map((s) => (
              <th key={s.n} scope="col" className="px-3 py-2 font-normal">
                <span className="text-zinc-200">
                  <span className="num">{s.n}</span> clientes
                </span>
                <span className="num block text-[10.5px] text-zinc-500">{int(s.files)} archivos</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-zinc-800/70 align-top">
              <th scope="row" className="px-3 py-2 font-normal text-zinc-300">
                {r.label}
                {r.hint && <span className="block text-[11px] text-zinc-500">{r.hint}</span>}
              </th>
              {r.merged != null ? (
                <td colSpan={sizes.length} className="px-3 py-2 text-pretty text-zinc-100">
                  {r.merged}
                </td>
              ) : (
                r.cells.map((c, i) => (
                  <td key={sizes[i].n} className="num px-3 py-2 text-zinc-100">
                    {c}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Decisiones del script que el paper no fija (o resuelve con software externo), con su evidencia en los datos. */
function Decisions({ notes }: { notes: Notes }) {
  const has = notes.ilsFiles > 0;
  const perSize = (f: (s: SizeNotes) => ReactNode) => (
    <>
      (
      {notes.sizes.map((s, i) => (
        <span key={s.n}>
          {i > 0 && ' · '}
          <Em>{s.n}</Em> clientes: {f(s)}
        </span>
      ))}
      )
    </>
  );

  const items: { title: string; text: ReactNode; evidence: ReactNode | null }[] = [
    {
      title: 'Tour TSP inicial',
      text: 'Held-Karp (TSP óptimo exacto) en lugar del Lin–Kernighan de Concorde que usa el paper; el script lo aplica hasta 12 clientes y, con más clientes, vecino más cercano + 2-opt/relocate.',
      evidence: has && notes.tspMethod.length > 0 ? <>método registrado: {notes.tspMethod.join(' / ')}.</> : null,
    },
    {
      title: 'Reubicación del depósito (Mosheiov, 1994)',
      text: 'Entre las posiciones del depósito a lo largo del ciclo TSP se elige la factible de menor ruteo + manipulación, como en el paper.',
      evidence: has ? (
        <>
          posiciones factibles del depósito{' '}
          {perSize((s) =>
            s.feasibleMin === null ? (
              '—'
            ) : (
              <>
                <Em>{s.feasibleMin === s.feasibleMax ? int(s.feasibleMin) : `${int(s.feasibleMin)}–${int(s.feasibleMax ?? s.feasibleMin)}`}</Em> de{' '}
                <Em>{s.n}</Em>
              </>
            ),
          )}
          .
        </>
      ) : null,
    },
    {
      title: 'Dos direcciones',
      text: 'ILS-2dir ejecuta el ILS desde el ciclo TSP y desde su inverso y reporta el mejor; ILS-1dir es solo la ejecución desde el ciclo TSP (dirección 1) de la misma corrida.',
      evidence:
        has && notes.twoDirChecks > 0 ? (
          <>
            {notes.twoDirBetter === 0 ? (
              <>
                en la corrida reportada, ILS-1dir ya iguala a ILS-2dir en las <Em>{int(notes.twoDirChecks)}</Em> instancias
              </>
            ) : (
              <>
                en la corrida reportada, la dirección inversa mejora el resultado en <Em>{int(notes.twoDirBetter)}</Em>/
                <Em>{int(notes.twoDirChecks)}</Em> instancias
              </>
            )}
            {notes.twoDirRuns > 0 && (
              <>
                ; entre todas las corridas, ILS-2dir mejora a ILS-1dir en <Em>{int(notes.twoDirRunsBetter)}</Em> de{' '}
                <Em>{int(notes.twoDirRuns)}</Em>
              </>
            )}
            .
          </>
        ) : null,
    },
    {
      title: 'Solo movimientos factibles',
      text: (
        <>
          Relocate y 2-opt se limitan a tours que respetan la capacidad Q, también en la diversificación: un movimiento aleatorio infactible se
          descarta y se sortea otro
          {notes.maxRandomTries.length > 0 && (
            <>
              {' '}
              (máx. <Em>{list(notes.maxRandomTries)}</Em> intentos)
            </>
          )}
          .
        </>
      ),
      evidence:
        has && notes.randomMoves > 0 ? (
          notes.exhaustedMoves === 0 ? (
            <>
              ninguno de los <Em>{int(notes.randomMoves)}</Em> movimientos aleatorios de la corrida reportada (ambas direcciones) agotó los
              intentos.
            </>
          ) : (
            <>
              <Em>{int(notes.exhaustedMoves)}</Em> de <Em>{int(notes.randomMoves)}</Em> movimientos aleatorios de la corrida reportada (ambas
              direcciones) agotaron los intentos y se omitieron.
            </>
          )
        ) : null,
    },
    {
      title: 'Poda exacta en Perform Best Move',
      text: 'Un vecino cuyo ruteo ya iguala o supera al mejor costo del vecindario se descarta sin llamar a la DP (la manipulación es ≥ 0): el movimiento elegido es idéntico al de evaluar todo el vecindario.',
      evidence: has ? (
        <>
          llamadas a la DP por vecino examinado {perSize((s) => (s.dpPerNeighbor === null ? '—' : <Em>{fmtPct(s.dpPerNeighbor)}</Em>))}.
        </>
      ) : null,
    },
  ];

  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={it.title} className="flex gap-3">
          <span className="num mt-[2px] shrink-0 text-[11px] text-zinc-500">{pad2(i + 1)}</span>
          <div className="min-w-0">
            <p className="text-[12.5px] leading-relaxed text-pretty text-zinc-400">
              <span className="font-medium text-zinc-100">{it.title}.</span> {it.text}
            </p>
            {it.evidence && (
              <p className="mt-1 text-[12px] leading-relaxed text-pretty text-zinc-400">
                <span className="font-mono text-[10.5px] tracking-wider text-ils uppercase">En los datos</span> · {it.evidence}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────── C · Reproducir ───────────────────────── */

type Script = 'dp' | 'ils';

function RunPanel({ notes, copied, onCopy }: { notes: Notes; copied: string | null; onCopy: (key: string, text: string) => void }) {
  const { actions, loading, source } = useCatalog();
  const tag = notes.hValues.length === 1 ? hTag(notes.hValues[0]) : '<h>';
  const hText = notes.hValues.length ? list(notes.hValues, (v) => fmtAuto(v, 3)) : null;

  const flags: { flag: string; scripts: Script[]; text: ReactNode; data: string | null }[] = [
    { flag: '--id <k>', scripts: ['dp', 'ils'], text: 'Una sola instancia, en lugar de --all-ids.', data: null },
    {
      flag: '--h <h>',
      scripts: ['dp', 'ils'],
      text: (
        <>
          Costo unitario de manipulación <Tex tex="h=h_a=h_b" />.
        </>
      ),
      data: hText,
    },
    {
      flag: '--iters <N>',
      scripts: ['ils'],
      text: (
        <>
          <Tex tex="N_{\text{iter}}" /> por dirección.
        </>
      ),
      data: notes.nIter.length ? list(notes.nIter) : null,
    },
    {
      flag: '--d <d>',
      scripts: ['ils'],
      text: (
        <>
          <Tex tex="N_{\text{rand}}=d\,|V_c|" />.
        </>
      ),
      data: notes.d.length ? list(notes.d, (v) => fmtAuto(v, 3)) : null,
    },
    { flag: '--runs <R>', scripts: ['ils'], text: 'Corridas con semillas consecutivas.', data: notes.runs.length ? list(notes.runs) : null },
    { flag: '--seed <s>', scripts: ['ils'], text: 'Semilla inicial: las corridas usan s, s+1, …; se reporta la mejor.', data: notes.seeds.length ? list(notes.seeds) : null },
    { flag: '--tour 0,…,0', scripts: ['dp'], text: 'Evalúa un tour propio (con --customers y --id).', data: null },
    { flag: '--verify', scripts: ['dp'], text: 'Compara la DP con la enumeración de las 2ⁿ combinaciones de políticas en tours aleatorios.', data: null },
  ];

  const steps: { title: ReactNode; note: ReactNode; body?: ReactNode }[] = [
    {
      title: (
        <>
          <MethodMark tone="dp" size={11} />
          {HEUR_METHODS.dp.label}
        </>
      ),
      note: 'Evalúa con la DP los tours que Gurobi guardó en Outputs/ (Modelo General y Políticas 1, 2 y 3).',
      body: <CommandRow cmd={RUN_DP} copyKey="dp" copied={copied === 'dp'} onCopy={onCopy} />,
    },
    {
      title: (
        <>
          <MethodMark tone="ils" size={11} />
          {HEUR_METHODS.ils.label}
        </>
      ),
      note: 'Busca la ruta desde el TSP en ambas direcciones; las soluciones Gurobi de Outputs/ solo sirven de referencia.',
      body: <CommandRow cmd={RUN_ILS} copyKey="ils" copied={copied === 'ils'} onCopy={onCopy} />,
    },
    {
      title: 'Resultados',
      note: (
        <>
          Un JSON por instancia y algoritmo
          {(notes.dpFiles > 0 || notes.ilsFiles > 0) && (
            <>
              ; ahora hay <Em>{int(notes.dpFiles)}</Em> DP y <Em>{int(notes.ilsFiles)}</Em> ILS cargados
            </>
          )}
          .
        </>
      ),
      body: (
        <ul className="space-y-1 rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-3 py-2.5 font-mono text-[11.5px] text-zinc-300">
          <li className="flex items-center gap-1.5 text-zinc-200">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
            Outputs/Erdogan2012/
          </li>
          <li className="flex min-w-0 items-center gap-1.5 pl-5">
            <MethodMark tone="dp" size={10} />
            <span className="min-w-0 break-all">{`DP_<n>_Clientes_ID<id>_H_${tag}.json`}</span>
          </li>
          <li className="flex min-w-0 items-center gap-1.5 pl-5">
            <MethodMark tone="ils" size={10} />
            <span className="min-w-0 break-all">{`ILS_<n>_Clientes_ID<id>_H_${tag}.json`}</span>
          </li>
          {(notes.exampleDp || notes.exampleIls) && (
            <li className="pt-1 pl-5 font-sans text-[11.5px] text-zinc-500">
              p. ej. <span className="font-mono text-zinc-400">{notes.exampleDp ?? notes.exampleIls}</span>
            </li>
          )}
        </ul>
      ),
    },
    {
      title: 'Ver en la página',
      note: (
        <>
          Con el servidor (<code className="font-mono text-zinc-300">npm start</code>) la sección relee Outputs/Erdogan2012: pulsa Recargar (↻) en la barra
          superior. Para el paquete estático, regenera public/solutions/ con:
        </>
      ),
      body: (
        <div className="space-y-2.5">
          <CommandRow cmd={RUN_BUNDLE} copyKey="bundle" copied={copied === 'bundle'} onCopy={onCopy} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={actions.refresh} aria-busy={loading}>
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
              Recargar ahora
            </Button>
            {source && (
              <Chip tone={source === 'api' ? 'ok' : 'muted'} mono={false}>
                Fuente actual: {source === 'api' ? 'servidor en vivo' : 'paquete estático'}
              </Chip>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <Lead>
        Desde la raíz del repositorio. Ambos scripts necesitan las soluciones Gurobi de Outputs/ para comparar, y guardan sus resultados en una
        subcarpeta propia.
      </Lead>

      <Block title="Pasos" meta={`${steps.length} pasos`}>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="relative flex gap-3">
              {i < steps.length - 1 && <span aria-hidden className="absolute top-7 -bottom-3 left-3 w-px bg-zinc-800" />}
              <span className="num relative grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-medium tracking-tight text-zinc-100">{s.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-pretty text-zinc-400">{s.note}</p>
                {s.body && <div className="mt-2">{s.body}</div>}
              </div>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="Opciones" meta="además de --customers y --all-ids">
        <ul className="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/80 bg-zinc-950/30">
          {flags.map((f) => (
            <li key={f.flag} className="grid grid-cols-1 gap-x-3 gap-y-0.5 px-3.5 py-2 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
              <code className="font-mono text-[12px] whitespace-nowrap text-zinc-100">{f.flag}</code>
              <div className="min-w-0 text-[12px] leading-relaxed text-pretty text-zinc-400">
                <span className="mr-1.5 inline-flex translate-y-[1px] items-center gap-1 align-baseline">
                  {f.scripts.map((k) => (
                    <span key={k} className="inline-flex" title={HEUR_METHODS[k].label}>
                      <MethodMark tone={k} size={10} />
                      <span className="sr-only">{HEUR_METHODS[k].short}</span>
                    </span>
                  ))}
                </span>
                {f.text}
                {f.data && (
                  <span className="text-zinc-500">
                    {' '}
                    · en los datos: <Em>{f.data}</Em>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Referencia" meta="§2.1 · §4.2">
        <p className="text-[13px] leading-relaxed text-pretty text-zinc-300">
          {ERDOGAN_REF.authors}. <cite className="text-zinc-100 italic">{ERDOGAN_REF.title}</cite>.{' '}
          <span className="text-zinc-400">
            {ERDOGAN_REF.journal}, <span className="italic">{ERDOGAN_REF.volume}</span>, {ERDOGAN_REF.pages}.
          </span>
        </p>
        <a
          href={`https://doi.org/${ERDOGAN_REF.doi}`}
          target="_blank"
          rel="noreferrer"
          className="group mt-2.5 inline-flex items-center gap-1 rounded-md font-mono text-xs text-zinc-400 transition-colors hover:text-zinc-50"
        >
          doi:{ERDOGAN_REF.doi}
          <ArrowUpRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-200 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] text-zinc-400">PDF en el repositorio</p>
          <CommandRow cmd={ERDOGAN_REF.pdf} prompt={false} copyKey="pdf" copied={copied === 'pdf'} onCopy={onCopy} />
        </div>
      </Block>
    </>
  );
}

/* ───────────────────────── Tarjeta ───────────────────────── */

export function MethodNotes({ instances }: { instances: HeurInstance[] }) {
  const notes = useMemo(() => deriveNotes(instances), [instances]);
  const [tab, setTab] = useState<TabKey>('dp');
  const idBase = `notes-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: '-60px' });
  const { copied, copy } = useCopy();
  const onCopy = (key: string, text: string) => void copy(key, text);

  return (
    <SpotlightCard ref={rootRef} className="@container flex h-full flex-col p-5 sm:p-6">
      <div className="min-w-0">
        <p className="eyebrow">Cómo se calculó</p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">El método, tal como en el paper</h3>
        <p className="mt-1 text-[12.5px] text-zinc-500">
          Erdoğan et al. (2012) · §2.1 y §4.2
          {notes.hValues.length > 0 && (
            <>
              {' '}
              · h = <span className="num text-zinc-300">{list(notes.hValues, (v) => fmtAuto(v, 3))}</span>
            </>
          )}
          {notes.instances > 0 && (
            <>
              {' '}
              · <span className="num text-zinc-300">{int(notes.instances)}</span> instancias
            </>
          )}
        </p>
      </div>

      <div className="mt-4">
        <NotesTabs value={tab} onChange={setTab} idBase={idBase} />
      </div>

      <div
        role="tabpanel"
        id={`${idBase}-panel`}
        aria-labelledby={`${idBase}-tab-${tab}`}
        tabIndex={0}
        className="mt-5 min-w-0 flex-1 rounded-xl focus-visible:outline-offset-4"
      >
        {/* Cada pestaña entra escalonada; solo una vez que la tarjeta está a la vista */}
        {/* A lo ancho (≥ 64rem) los bloques fluyen en dos columnas sin partirse */}
        <motion.div
          key={tab}
          className="@5xl:columns-2 @5xl:gap-x-10 [&>*]:break-inside-avoid"
          initial="hidden"
          animate={inView ? 'show' : 'hidden'}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        >
          {tab === 'dp' && <DpPanel notes={notes} />}
          {tab === 'ils' && <IlsPanel notes={notes} />}
          {tab === 'run' && <RunPanel notes={notes} copied={copied} onCopy={onCopy} />}
        </motion.div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copiado al portapapeles' : ''}
      </span>
    </SpotlightCard>
  );
}
