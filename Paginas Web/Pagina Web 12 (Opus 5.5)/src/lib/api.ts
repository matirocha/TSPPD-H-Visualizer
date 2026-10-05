import type { DataSource, ModelType, SolutionData, SolutionMeta } from '../types/solution';
import type { DPFile, HeuristicsBundle, ILSFile } from '../types/heuristics';
import type { BenchmarkFile } from '../types/benchmark';
import type { ItsNrandFile, MetaFile, MetaheuristicsBundle, PaperFile } from '../types/metaheuristics';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Caché de detalles, válida mientras el archivo no cambie (mtime de Outputs/). */
const detailCache = new Map<string, { data: SolutionData; mtime?: number }>();
const inflight = new Map<string, Promise<SolutionData>>();

const MODEL_RULES: { model: ModelType; policy: number; name: string; tokens: string[] }[] = [
  { model: 'TSPPD-H_1', policy: 1, name: 'TSPPD-H_1 (Política 1, Ecs. 17-25)', tokens: ['TSPPD_H1', '_H1_'] },
  { model: 'TSPPD-H_2', policy: 2, name: 'TSPPD-H_2 (Política 2, Ecs. 26-30)', tokens: ['TSPPD_H2', '_H2_'] },
  { model: 'TSPPD-H_3', policy: 3, name: 'TSPPD-H_3 (Política 3, Ecs. 31-48)', tokens: ['TSPPD_H3', '_H3_'] },
];

/** Normaliza la metadata: el modelo se deduce del campo `model` o del nombre de archivo. */
function normalizeMeta(raw: Partial<SolutionMeta> & { filename: string }): SolutionMeta {
  const rule = MODEL_RULES.find((r) => raw.model === r.model || r.tokens.some((t) => raw.filename.includes(t)));
  return {
    filename: raw.filename,
    instance: raw.instance || raw.filename.replace(/\.[^/.]+$/, ''),
    model: rule?.model ?? 'TSPPD-H',
    modelName: raw.modelName || rule?.name || 'TSPPD-H (General, Ecs. 1-16)',
    policy: rule?.policy ?? raw.policy ?? 0,
    numCustomers: raw.numCustomers || 0,
    instanceId: raw.instanceId || 0,
    h: raw.h ?? 0.1,
    capacity: raw.capacity || 0,
    objectiveValue: raw.objectiveValue || 0,
    totalDistance: raw.totalDistance || 0,
    handlingCost: raw.handlingCost || 0,
    tourLength: raw.tourLength,
    stepCount: raw.stepCount,
    mtime: raw.mtime,
    error: raw.error,
  };
}

function sortMeta(list: SolutionMeta[]) {
  return list.sort(
    (a, b) => a.numCustomers - b.numCustomers || a.instanceId - b.instanceId || a.filename.localeCompare(b.filename),
  );
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Lista de soluciones. Prioridad:
 *  1. API en vivo (`/api/solutions`, servida por Vite dev o por server.js) → lee Outputs/.
 *  2. Soluciones empaquetadas en `public/solutions/index.json` (hosting estático / Vercel).
 */
export async function fetchSolutionsList(): Promise<{ solutions: SolutionMeta[]; source: DataSource }> {
  const api = await getJson<{ success: boolean; solutions: SolutionMeta[] }>(`${BASE}/api/solutions`);
  if (api?.success && Array.isArray(api.solutions) && api.solutions.length > 0) {
    return { solutions: sortMeta(api.solutions.filter((s) => !s.error).map(normalizeMeta)), source: 'api' };
  }
  const bundled = await getJson<{ solutions: SolutionMeta[] }>(`${BASE}/solutions/index.json`);
  if (bundled && Array.isArray(bundled.solutions) && bundled.solutions.length > 0) {
    return { solutions: sortMeta(bundled.solutions.map(normalizeMeta)), source: 'static' };
  }
  throw new Error('No se encontraron soluciones: ni la API local (/api/solutions) ni el paquete estático respondieron.');
}

/**
 * Detalle de una solución. `mtime` (de la metadata de la lista) invalida la caché si el
 * solver reescribió el archivo; las peticiones simultáneas del mismo archivo se comparten.
 */
export function fetchSolutionDetail(filename: string, source: DataSource, mtime?: number): Promise<SolutionData> {
  const cached = detailCache.get(filename);
  if (cached && (mtime === undefined || cached.mtime === undefined || cached.mtime === mtime)) return Promise.resolve(cached.data);
  const key = `${filename}@${mtime ?? ''}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = loadDetail(filename, source, mtime).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function loadDetail(filename: string, source: DataSource, mtime?: number): Promise<SolutionData> {
  let data: SolutionData | null = null;
  if (source === 'api') {
    const res = await getJson<{ success: boolean; data: SolutionData }>(`${BASE}/api/solutions/${encodeURIComponent(filename)}`);
    if (res?.success && res.data) data = res.data;
  }
  if (!data) data = await getJson<SolutionData>(`${BASE}/solutions/${encodeURIComponent(filename)}.json`);
  if (!data) throw new Error(`Solución no encontrada: ${filename}`);
  const normalized: SolutionData = { ...data, model: normalizeMeta({ filename, model: data.model }).model };
  detailCache.set(filename, { data: normalized, mtime });
  return normalized;
}

/** Precarga en segundo plano (p. ej. las otras políticas de la misma instancia). */
export function prefetchSolutions(items: { filename: string; mtime?: number }[], source: DataSource) {
  for (const it of items) void fetchSolutionDetail(it.filename, source, it.mtime).catch(() => undefined);
}

/**
 * Resultados del Algoritmo 2.1 + DP y del ILS (Outputs/Erdogan2012/). Con la API en vivo
 * se lee `/api/heuristics`; si no responde o aún no hay resultados, se usa el paquete
 * estático `solutions/heuristics.json`. Devuelve listas vacías si no hay ninguno.
 */
export async function fetchHeuristics(source: DataSource): Promise<HeuristicsBundle> {
  type Raw = { success?: boolean; dp?: DPFile[]; ils?: ILSFile[] };
  const has = (r: Raw | null): r is Raw => !!r && (Array.isArray(r.dp) || Array.isArray(r.ils)) && (r.dp?.length ?? 0) + (r.ils?.length ?? 0) > 0;
  if (source === 'api') {
    const api = await getJson<Raw>(`${BASE}/api/heuristics`);
    if (api?.success !== false && has(api)) return { dp: api.dp ?? [], ils: api.ils ?? [], source: 'api' };
  }
  const bundled = await getJson<Raw>(`${BASE}/solutions/heuristics.json`);
  if (has(bundled)) return { dp: bundled.dp ?? [], ils: bundled.ils ?? [], source: 'static' };
  return { dp: [], ils: [], source };
}

/** Etiquetas del script de Python (METHOD_LABELS), por si el archivo no las trae. */
const BENCH_METHOD_LABELS: BenchmarkFile['methods'] = [
  { key: 'general', label: 'Modelo General' },
  { key: 'p1', label: 'Política 1' },
  { key: 'p2', label: 'Política 2' },
  { key: 'p3', label: 'Política 3' },
  { key: 'dp', label: 'Algoritmo 2.1 + DP (dos fases)' },
  { key: 'ils', label: 'ILS-2dir (Algoritmo 4.2)' },
];

/** Acepta un BenchmarkFile (al menos con `records`) y completa los campos opcionales. */
function asBenchmarkFile(raw: unknown): BenchmarkFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<BenchmarkFile>;
  if (!Array.isArray(f.records)) return null;
  return {
    title: f.title || 'Benchmark de tiempos TSPPD-H',
    reference: f.reference ?? '',
    generatedAt: f.generatedAt ?? '',
    meta: f.meta ?? null,
    methods: Array.isArray(f.methods) && f.methods.length ? f.methods : BENCH_METHOD_LABELS,
    count: f.records.length,
    records: f.records,
  };
}

/**
 * Benchmark de tiempos Gurobi vs Algoritmo 2.1 + DP e ILS (Outputs/Benchmark/). Con la API en
 * vivo se lee `/api/benchmark`; si no responde o aún no hay resultados (data null), se usa el
 * paquete estático `solutions/benchmark.json`. Devuelve null si no hay ninguno.
 */
export async function fetchBenchmark(source: DataSource): Promise<BenchmarkFile | null> {
  if (source === 'api') {
    const api = await getJson<{ success?: boolean; data?: unknown }>(`${BASE}/api/benchmark`);
    const live = api?.success ? asBenchmarkFile(api.data) : null;
    if (live) return live;
  }
  return asBenchmarkFile(await getJson<unknown>(`${BASE}/solutions/benchmark.json`));
}

const asMetaFile = (raw: unknown): MetaFile | null => {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as MetaFile).records)) return null;
  const f = raw as Partial<MetaFile>;
  return {
    title: f.title || 'Benchmark de metaheurísticas TSPPD-H',
    reference: f.reference ?? '',
    generatedAt: f.generatedAt ?? '',
    meta: f.meta ?? null,
    methods: Array.isArray(f.methods) ? f.methods : [],
    count: f.records!.length,
    records: f.records!,
  };
};
const asItsNrand = (raw: unknown): ItsNrandFile | null =>
  raw && typeof raw === 'object' && Array.isArray((raw as ItsNrandFile).runs) && (raw as ItsNrandFile).runs.length ? (raw as ItsNrandFile) : null;
const asPaperFile = (raw: unknown): PaperFile | null =>
  raw && typeof raw === 'object' && Array.isArray((raw as PaperFile).instances) ? (raw as PaperFile) : null;

/**
 * Benchmark de metaheurísticas a gran escala y cifras del paper (Outputs/BenchmarkErdogan2012/).
 * Con la API en vivo se lee `/api/metaheuristics`; si no responde o no trae nada, se usa el paquete
 * estático `solutions/metaheuristics.json`. data y paper son null si no hay ninguno.
 */
export async function fetchMetaheuristics(source: DataSource): Promise<MetaheuristicsBundle> {
  type Raw = { success?: boolean; data?: unknown; paper?: unknown; itsNrand?: unknown };
  if (source === 'api') {
    const api = await getJson<Raw>(`${BASE}/api/metaheuristics`);
    if (api?.success) {
      const data = asMetaFile(api.data);
      const paper = asPaperFile(api.paper);
      if (data || paper) return { data, paper, itsNrand: asItsNrand(api.itsNrand), source: 'api' };
    }
  }
  const bundled = await getJson<Raw>(`${BASE}/solutions/metaheuristics.json`);
  return {
    data: asMetaFile(bundled?.data),
    paper: asPaperFile(bundled?.paper),
    itsNrand: asItsNrand(bundled?.itsNrand),
    source: bundled ? 'static' : source,
  };
}
