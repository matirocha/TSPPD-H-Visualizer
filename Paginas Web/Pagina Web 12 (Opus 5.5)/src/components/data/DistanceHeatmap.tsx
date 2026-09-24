import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Grid3x3 } from 'lucide-react';
import { useSim } from '../../state/SimulationProvider';
import { useHover } from '../../state/UIProvider';
import { fmtAuto } from '../../lib/format';
import { springSnappy } from '../../lib/motion';
import { cn } from '../../lib/cn';
import { SpotlightCard, Switch } from '../ui';
import { INF, RAMP_CSS, inkOn, instanceFacts, nodeLabel, rampRgb, rgbCss, type InstanceFacts } from './instance';

interface Target {
  r: number;
  c: number;
  /** 'cell' = hover sobre una celda; 'node' = resaltado de un nodo (encabezado u otra vista). */
  via: 'cell' | 'node';
}

interface Band {
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
  /** Al reaparecer, las bandas saltan a su lugar en vez de deslizarse desde la posición anterior. */
  snap: boolean;
}

function readout(t: Target | null, facts: InstanceFacts, tour: number[], current: { from: number; to: number } | null) {
  const { matrix, arcOrder } = facts;
  const L = nodeLabel;
  if (t && t.via === 'node') {
    const n = t.r;
    const p = tour.indexOf(n);
    if (p < 0) return <>{L(n)} · no aparece en el tour</>;
    const next = tour[p + 1] ?? tour[1];
    const prevIdx = n === 0 ? tour.length - 2 : p - 1;
    const prev = tour[prevIdx];
    return (
      <>
        <span className="text-zinc-50">{L(n)}</span> · llega desde {L(prev)}{' '}
        <span className="text-zinc-300">(c = {fmtAuto(matrix[prev]?.[n] ?? 0)})</span> · sale hacia {L(next)}{' '}
        <span className="text-zinc-300">(c = {fmtAuto(matrix[n]?.[next] ?? 0)})</span>
      </>
    );
  }
  if (t) {
    const { r, c } = t;
    if (r === c) return <>{L(r)} · diagonal, sin arco</>;
    const v = matrix[r]?.[c];
    const order = arcOrder.get(`${r}-${c}`);
    const mirror = arcOrder.get(`${c}-${r}`);
    const isCurrent = current && current.from === r && current.to === c;
    return (
      <>
        <span className="text-zinc-50">
          c({L(r)}, {L(c)}) = {v === undefined ? '—' : v >= INF ? '∞' : fmtAuto(v)}
        </span>
        {order ? (
          <> · arco #{order} del tour{isCurrent && <span className="text-zinc-50"> · tramo actual</span>}</>
        ) : mirror && facts.symmetric ? (
          <>
            {' '}
            · simétrico al arco #{mirror} ({L(c)} → {L(r)})
          </>
        ) : (
          <> · fuera del tour</>
        )}
      </>
    );
  }
  if (current) {
    const order = arcOrder.get(`${current.from}-${current.to}`);
    return (
      <>
        Tramo actual ·{' '}
        <span className="text-zinc-50">
          c({L(current.from)}, {L(current.to)}) = {fmtAuto(matrix[current.from]?.[current.to] ?? 0)}
        </span>
        {order && <> · arco #{order} del tour</>}
      </>
    );
  }
  return <>Toca o pasa el cursor por una celda para leer su costo c(i, j)</>;
}

export function DistanceHeatmap() {
  const { solution, step, mode } = useSim();
  const { hoverNode, setHoverNode } = useHover();
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);
  const [tourOnly, setTourOnly] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [band, setBand] = useState<Band>({ x: 0, y: 0, w: 0, h: 0, on: false, snap: true });

  const facts = useMemo(() => (solution ? instanceFacts(solution) : null), [solution]);

  // Colores precalculados por celda (no cambian con el hover).
  const colors = useMemo(() => {
    if (!facts) return [];
    const span = facts.max - facts.min || 1;
    return facts.matrix.map((row, i) =>
      row.map((v, j) => {
        if (i === j || v >= INF) return null;
        const rgb = rampRgb((v - facts.min) / span);
        return { bg: rgbCss(rgb), ink: inkOn(rgb) };
      }),
    );
  }, [facts]);

  const current = (mode === 'transit' || mode === 'stop') && step ? { from: step.from, to: step.to } : null;
  const size = facts?.size ?? 0;
  const target: Target | null = cell
    ? { ...cell, via: 'cell' }
    : hoverNode !== null && hoverNode < size
      ? { r: hoverNode, c: hoverNode, via: 'node' }
      : null;

  // Bandas del crosshair: se posicionan con la geometría real de la celda objetivo.
  const tr = target?.r ?? -1;
  const tc = target?.c ?? -1;
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || tr < 0) {
      setBand((b) => (b.on ? { ...b, on: false } : b));
      return;
    }
    const el = grid.querySelector<HTMLElement>(`[data-rc="${tr}-${tc}"]`);
    if (!el) return;
    setBand((b) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, on: true, snap: !b.on }));
  }, [tr, tc]);

  if (!solution || !facts) return null;
  if (!size) {
    return (
      <SpotlightCard className="p-6 text-sm text-zinc-400">Esta solución no incluye la matriz de costos c_ij.</SpotlightCard>
    );
  }

  const ids = Array.from({ length: size }, (_, i) => i);
  const showValues = size <= 20;
  const isHi = (id: number) => target !== null && (target.r === id || target.c === id);

  return (
    <SpotlightCard className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2">
            <Grid3x3 aria-hidden className="h-3.5 w-3.5" />
            Matriz de costos
          </p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-50">
            <span className="font-serif italic">c</span>
            <sub className="font-serif italic">ij</sub> · {size}×{size}{' '}
            <span className="font-normal text-zinc-400">· {facts.symmetric ? 'simétrica' : 'asimétrica'}</span>
          </h3>
          <p className="mt-1 text-[12.5px] text-zinc-400">Fila = origen i, columna = destino j. Los arcos del tour llevan su número de orden.</p>
        </div>
        <Switch checked={tourOnly} onChange={setTourOnly} label="Solo arcos del tour" />
      </header>

      <div className="scrollbar-thin -mx-1 mt-5 overflow-x-auto px-1 pb-1">
        <div
          ref={gridRef}
          role="table"
          aria-label={`Matriz de costos c_ij de ${size} nodos`}
          aria-rowcount={size + 1}
          className="relative grid gap-[2px]"
          style={{ gridTemplateColumns: `2.5rem repeat(${size}, minmax(2.25rem, 1fr))`, minWidth: `${40 + size * 38}px` }}
          onMouseLeave={() => setCell(null)}
        >
          {/* Crosshair: bandas de fila y columna que se deslizan con resorte */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 rounded-md bg-white/[0.07] ring-1 ring-white/10"
            initial={false}
            animate={{ y: band.y, height: band.h, opacity: band.on ? 1 : 0 }}
            transition={band.snap ? { y: { duration: 0 }, height: { duration: 0 }, opacity: springSnappy } : springSnappy}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 rounded-md bg-white/[0.07] ring-1 ring-white/10"
            initial={false}
            animate={{ x: band.x, width: band.w, opacity: band.on ? 1 : 0 }}
            transition={band.snap ? { x: { duration: 0 }, width: { duration: 0 }, opacity: springSnappy } : springSnappy}
          />

          <div role="row" className="contents">
            <div role="columnheader" className="flex h-8 items-end justify-center pb-1 font-mono text-[10px] text-zinc-500">
              <span aria-hidden>i\j</span>
              <span className="sr-only">Origen \ destino</span>
            </div>
            {ids.map((j) => (
              <div
                key={j}
                role="columnheader"
                onMouseEnter={() => {
                  setCell(null);
                  setHoverNode(j);
                }}
                onMouseLeave={() => setHoverNode(null)}
                className={cn(
                  'num flex h-8 cursor-default items-center justify-center rounded-md text-[11px] font-medium transition-colors',
                  isHi(j) ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400',
                )}
              >
                {nodeLabel(j)}
              </div>
            ))}
          </div>

          {ids.map((i) => (
            <div role="row" key={i} className="contents">
              <div
                role="rowheader"
                onMouseEnter={() => {
                  setCell(null);
                  setHoverNode(i);
                }}
                onMouseLeave={() => setHoverNode(null)}
                className={cn(
                  'num flex h-9 cursor-default items-center justify-center rounded-md text-[11px] font-medium transition-colors',
                  isHi(i) ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400',
                )}
              >
                {nodeLabel(i)}
              </div>
              {ids.map((j) => {
                const v = facts.matrix[i]?.[j];
                const col = colors[i]?.[j];
                const order = facts.arcOrder.get(`${i}-${j}`);
                const isCurrent = current !== null && current.from === i && current.to === j;
                const diag = i === j;
                return (
                  <div
                    key={j}
                    role="cell"
                    data-rc={`${i}-${j}`}
                    onMouseEnter={() => setCell({ r: i, c: j })}
                    aria-label={
                      diag
                        ? `${nodeLabel(i)}: diagonal`
                        : `c(${nodeLabel(i)}, ${nodeLabel(j)}) = ${v}${order ? `, arco ${order} del tour` : ''}`
                    }
                    className={cn(
                      'num relative flex h-9 items-center justify-center rounded-[5px] text-[11px] transition-opacity duration-300',
                      diag && 'hatch bg-zinc-950/60 text-zinc-500',
                      order && 'font-semibold',
                      tourOnly && !order && 'opacity-[0.18]',
                    )}
                    style={
                      col
                        ? {
                            backgroundColor: col.bg,
                            color: order ? '#fafafa' : col.ink,
                            boxShadow: order
                              ? isCurrent
                                ? 'inset 0 0 0 2px #fafafa, 0 0 0 3px rgb(255 255 255 / 0.18)'
                                : 'inset 0 0 0 1.5px #fafafa'
                              : undefined,
                          }
                        : undefined
                    }
                  >
                    <span aria-hidden>{diag ? '—' : showValues && v !== undefined ? (v >= INF ? '∞' : fmtAuto(v)) : ''}</span>
                    {order && (
                      <span aria-hidden className="absolute top-[3px] left-[4px] font-mono text-[8.5px] leading-none font-medium text-zinc-100">
                        {order}
                      </span>
                    )}
                    {isCurrent && (
                      <span aria-hidden className="absolute top-[4px] right-[4px] h-1.5 w-1.5 animate-soft-pulse rounded-full bg-white" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="num mt-4 min-h-[1.25rem] truncate text-[12px] text-zinc-400">
        {readout(target, facts, solution.tour, current)}
      </p>

      <footer className="mt-auto flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-zinc-800/80 pt-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-zinc-400">
          <span className="flex items-center gap-2">
            <span className="num">{fmtAuto(facts.min)}</span>
            <span aria-hidden className="h-2 w-24 rounded-full" style={{ background: RAMP_CSS }} />
            <span className="num">{fmtAuto(facts.max)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-[3px] bg-zinc-800 shadow-[inset_0_0_0_1.5px_#fafafa]" />
            Arco del tour
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
            Tramo actual
          </span>
        </div>
        <p className="text-[11.5px] text-zinc-400">
          Costo medio por arco: <span className="num text-zinc-100">{fmtAuto(facts.tourMean, 1)}</span> en el tour ·{' '}
          <span className="num text-zinc-300">{fmtAuto(facts.mean, 1)}</span> en la matriz
        </p>
      </footer>
    </SpotlightCard>
  );
}
