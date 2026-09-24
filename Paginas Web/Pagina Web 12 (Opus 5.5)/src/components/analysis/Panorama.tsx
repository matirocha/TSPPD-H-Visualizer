/**
 * Panorama entre instancias: tira de puntos con la brecha de cada modelo frente al mejor
 * de su instancia (0 % a la izquierda). Una fila por instancia; los puntos que coinciden
 * se apilan verticalmente. Codificación doble color + forma (ver ModelMark).
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useInView } from 'motion/react';
import { useCatalog } from '../../state/SimulationProvider';
import { MODELS, TONE_COLOR } from '../../lib/models';
import { fmt, fmtPct } from '../../lib/format';
import { spring, springSoft } from '../../lib/motion';
import { Segmented, SpotlightCard } from '../ui';
import { COLOR, ChartTooltip, TipHeader, clamp, niceScale, useElementWidth } from './chart';
import { EPS, customerCounts, instanceRows, modelSummaries, type InstanceRow } from './compareData';
import { ModelMark, ModelMarkSvg } from './ModelMark';

const ROW_H = 30;
const TOP = 6;
const AXIS_H = 34;
const ML = 62;
const MR = 18;

export function Panorama() {
  const { solutions, meta, actions } = useCatalog();
  const counts = useMemo(() => customerCounts(solutions), [solutions]);
  const curN = meta?.numCustomers ?? counts[counts.length - 1] ?? 10;
  const [n, setN] = useState(curN);
  const [prevCur, setPrevCur] = useState(curN);
  if (curN !== prevCur) {
    setPrevCur(curN);
    setN(curN);
  }

  const rows = useMemo(() => instanceRows(solutions, n), [solutions, n]);
  const summaries = useMemo(() => modelSummaries(rows), [rows]);
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const inView = useInView(wrapRef, { once: true, margin: '-60px' });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const rowRefs = useRef<(SVGGElement | null)[]>([]);

  const maxGapPct = Math.max(0, ...rows.map((r) => r.maxGap * 100));
  const scale = niceScale(Math.max(maxGapPct, 0.5), 4);
  const innerW = Math.max(0, width - ML - MR);
  const xOf = (pct: number) => ML + (pct / scale.max) * innerW;
  const height = TOP + rows.length * ROW_H + AXIS_H;
  const isCurrentN = meta?.numCustomers === n;
  const currentIdx = isCurrentN ? rows.findIndex((r) => r.instanceId === meta?.instanceId) : -1;
  const pointerIdx = hoverIdx ?? focusIdx;
  const tabStop = focusIdx ?? (currentIdx >= 0 ? currentIdx : 0);
  const decimals = scale.step < 1 ? 1 : 0;

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      actions.selectInstance(n, rows[i].instanceId);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    rowRefs.current[next]?.focus();
  };

  const active = pointerIdx !== null ? rows[pointerIdx] : null;
  const anchor =
    active && pointerIdx !== null ? { x: clamp(xOf(active.maxGap * 100) + 10, ML, width), y: TOP + pointerIdx * ROW_H + ROW_H / 2 } : null;

  return (
    <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow">Panorama</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-balance text-zinc-50">Brecha frente al mejor modelo, por instancia</h3>
        </div>
        {counts.length > 1 && (
          <Segmented<number>
            ariaLabel="Cantidad de clientes"
            size="xs"
            value={n}
            onChange={setN}
            options={counts.map((c) => ({ value: c, label: `${c} clientes` }))}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-zinc-800/70 py-2.5" aria-label="Leyenda">
        {MODELS.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
            <ModelMark tone={m.tone} />
            {m.label}
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative mt-3 w-full" style={{ height: rows.length ? height : undefined }} onPointerLeave={() => setHoverIdx(null)}>
          {rows.length === 0 && <p className="py-6 text-sm text-zinc-500">No hay instancias con {n} clientes en el catálogo.</p>}
          {width > 0 && rows.length > 0 && (
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="group"
              aria-labelledby="panorama-title panorama-desc"
              className="block overflow-visible select-none"
            >
              <title id="panorama-title">{`Brecha de cada modelo frente al mejor, instancias de ${n} clientes`}</title>
              <desc id="panorama-desc">
                Una fila por instancia; cada marca es un modelo ubicado según su brecha porcentual respecto del mejor Z* de esa instancia. Flechas
                arriba y abajo para recorrer, Enter para abrir la instancia en el simulador.
              </desc>

              {/* Rejilla vertical + eje */}
              <g aria-hidden>
                {scale.ticks.map((t) => (
                  <g key={t}>
                    <line
                      x1={xOf(t)}
                      x2={xOf(t)}
                      y1={TOP}
                      y2={TOP + rows.length * ROW_H}
                      stroke={t === 0 ? COLOR.axis : COLOR.grid}
                      strokeWidth={1}
                      shapeRendering="crispEdges"
                    />
                    <text
                      x={xOf(t)}
                      y={TOP + rows.length * ROW_H + 15}
                      textAnchor={t === 0 ? 'start' : t === scale.max ? 'end' : 'middle'}
                      fill={COLOR.tick}
                      fontSize={10.5}
                      className="num"
                    >
                      {`${fmt(t, decimals)} %`}
                    </text>
                  </g>
                ))}
                <text x={ML} y={TOP + rows.length * ROW_H + 30} fill={COLOR.label} fontSize={10.5}>
                  Brecha vs. el mejor Z* de la instancia →
                </text>
              </g>

              {/* Filas */}
              {rows.map((r, i) => (
                <PanoramaRow
                  key={r.instanceId}
                  row={r}
                  y={TOP + i * ROW_H}
                  width={width}
                  xOf={xOf}
                  current={i === currentIdx}
                  highlighted={i === pointerIdx}
                  visible={inView}
                  index={i}
                />
              ))}

              {/* Interacción por fila */}
              <g>
                {rows.map((r, i) => (
                  <g
                    key={r.instanceId}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    role="button"
                    tabIndex={i === tabStop ? 0 : -1}
                    aria-current={i === currentIdx ? 'true' : undefined}
                    aria-label={rowLabel(r, n)}
                    className="group cursor-pointer outline-none"
                    onPointerEnter={() => setHoverIdx(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => actions.selectInstance(n, r.instanceId)}
                    onFocus={() => setFocusIdx(i)}
                    onBlur={() => setFocusIdx(null)}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    <rect x={0} y={TOP + i * ROW_H} width={width} height={ROW_H} fill="transparent" />
                    <rect
                      x={1}
                      y={TOP + i * ROW_H + 1}
                      width={Math.max(0, width - 2)}
                      height={ROW_H - 2}
                      rx={8}
                      fill="none"
                      stroke={COLOR.ink}
                      strokeOpacity={0.7}
                      strokeWidth={1.5}
                      className="opacity-0 transition-opacity group-focus-visible:opacity-100"
                    />
                  </g>
                ))}
              </g>
            </svg>
          )}

          <ChartTooltip anchor={anchor} bounds={width} placement="side" offset={8} minTop={-40} maxBottom={height}>
            {active && (
              <>
                <TipHeader>
                  Instancia {active.instanceId} · {n} clientes
                </TipHeader>
                {MODELS.map((m) => {
                  const s = active.byModel[m.id];
                  const g = active.gaps[m.id];
                  return (
                    <div key={m.id} className="flex items-center gap-2 py-[1px] text-[12px] leading-5">
                      <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: TONE_COLOR[m.tone] }} />
                      <span className="num w-14 font-medium text-zinc-50">{s ? fmt(s.objectiveValue) : '—'}</span>
                      <span className="w-9 text-zinc-400">{m.short}</span>
                      <span className="num text-zinc-500">
                        {g === undefined ? 'sin datos' : g <= EPS ? 'mejor' : `+${fmtPct(g, 1)}`}
                      </span>
                    </div>
                  );
                })}
                <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[11px] text-zinc-500">Clic para abrir en el simulador</p>
              </>
            )}
          </ChartTooltip>
      </div>

      {/* Resumen por modelo */}
      <ul className="mt-5 grid grid-cols-2 gap-2">
        {summaries.map((s) => (
          <motion.li
            key={s.model.id}
            initial={false}
            animate={{ opacity: s.total ? 1 : 0.5 }}
            transition={springSoft}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-3 py-2.5"
          >
            <p className="flex items-center gap-1.5 text-[12px] text-zinc-300">
              <ModelMark tone={s.model.tone} size={11} />
              <span className="truncate font-medium">{s.model.label}</span>
            </p>
            <p className="mt-1 text-[12px] text-zinc-400">
              Mejor en{' '}
              <span className="num text-zinc-100">
                {s.bestCount}/{s.total}
              </span>
            </p>
            <p className="text-[12px] text-zinc-400">
              brecha media <span className="num text-zinc-100">{s.meanGap === null ? '—' : fmtPct(s.meanGap, 1)}</span>
            </p>
          </motion.li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11.5px] text-zinc-500">Los empates cuentan como «mejor» para cada modelo empatado.</p>

      <table className="sr-only">
        <caption>{`Z* por modelo en las instancias de ${n} clientes`}</caption>
        <thead>
          <tr>
            <th scope="col">Instancia</th>
            {MODELS.map((m) => (
              <th key={m.id} scope="col">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.instanceId}>
              <th scope="row">{r.instanceId}</th>
              {MODELS.map((m) => {
                const s = r.byModel[m.id];
                const g = r.gaps[m.id];
                return <td key={m.id}>{s ? `${fmt(s.objectiveValue)} (${g !== undefined && g <= EPS ? 'mejor' : `+${fmtPct(g ?? 0, 1)}`})` : 'sin datos'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </SpotlightCard>
  );
}

function rowLabel(r: InstanceRow, n: number): string {
  const parts = MODELS.map((m) => {
    const s = r.byModel[m.id];
    const g = r.gaps[m.id];
    if (!s || g === undefined) return `${m.label} sin datos`;
    return `${m.label} ${fmt(s.objectiveValue)}${g <= EPS ? ' (mejor)' : ` (+${fmtPct(g, 1)})`}`;
  });
  return `Instancia ${r.instanceId} de ${n} clientes: ${parts.join(', ')}. Enter para abrirla en el simulador.`;
}

/** Fila de la tira: banda, rango y marcas (apiladas cuando coinciden). */
function PanoramaRow({
  row,
  y,
  width,
  xOf,
  current,
  highlighted,
  visible,
  index,
}: {
  row: InstanceRow;
  y: number;
  width: number;
  xOf: (pct: number) => number;
  current: boolean;
  highlighted: boolean;
  visible: boolean;
  index: number;
}) {
  const cy = y + ROW_H / 2;
  // Posiciones y apilado de marcas coincidentes (separación mínima 9 px)
  const marks = MODELS.filter((m) => row.gaps[m.id] !== undefined)
    .map((m) => ({ m, x: xOf((row.gaps[m.id] ?? 0) * 100) }))
    .sort((a, b) => a.x - b.x);
  const placed: { m: (typeof MODELS)[number]; x: number; dy: number }[] = [];
  let group: typeof marks = [];
  const flush = () => {
    group.forEach((g, j) => placed.push({ ...g, dy: (j - (group.length - 1) / 2) * 7 }));
    group = [];
  };
  for (const mk of marks) {
    if (group.length && mk.x - group[group.length - 1].x >= 9) flush();
    group.push(mk);
  }
  flush();

  return (
    <g aria-hidden>
      {(current || highlighted) && (
        <rect
          x={0}
          y={y + 1}
          width={width}
          height={ROW_H - 2}
          rx={8}
          fill={current ? 'rgb(255 255 255 / 0.055)' : 'rgb(255 255 255 / 0.03)'}
        />
      )}
      {current && <rect x={0} y={y + 6} width={3} height={ROW_H - 12} rx={1.5} fill={COLOR.ink} />}
      <text x={12} y={cy + 3.5} fill={current ? COLOR.ink : COLOR.label} fontSize={11} fontWeight={current ? 600 : 400}>
        Inst. <tspan className="num">{row.instanceId}</tspan>
      </text>
      <line x1={xOf(0)} x2={xOf(row.maxGap * 100)} y1={cy} y2={cy} stroke={current || highlighted ? COLOR.tick : COLOR.axis} strokeWidth={1} />
      {placed.map(({ m, x, dy }, j) => (
        <motion.g
          key={m.id}
          initial={{ opacity: 0, x: xOf(0), y: cy }}
          animate={visible ? { opacity: 1, x, y: cy + dy } : { opacity: 0, x: xOf(0), y: cy }}
          transition={{ ...spring, delay: visible ? 0.04 * index + 0.03 * j : 0 }}
        >
          <ModelMarkSvg tone={m.tone} x={0} y={0} r={4.5} />
        </motion.g>
      ))}
    </g>
  );
}
