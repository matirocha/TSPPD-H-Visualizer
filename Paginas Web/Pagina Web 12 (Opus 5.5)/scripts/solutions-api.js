// Lógica compartida entre el middleware de Vite (dev) y el servidor Express (prod)
// para leer las soluciones Gurobi de ../../Outputs.
import fs from 'fs';
import path from 'path';

const MODEL_PATTERNS = [
  { model: 'TSPPD-H_1', policy: 1, name: 'TSPPD-H_1 (Política 1, Ecs. 17-25)', tokens: ['TSPPD_H1', '_H1_'] },
  { model: 'TSPPD-H_2', policy: 2, name: 'TSPPD-H_2 (Política 2, Ecs. 26-30)', tokens: ['TSPPD_H2', '_H2_'] },
  { model: 'TSPPD-H_3', policy: 3, name: 'TSPPD-H_3 (Política 3, Ecs. 31-48)', tokens: ['TSPPD_H3', '_H3_'] },
];

/** Identifica el modelo por el campo `model` o, si falta, por el nombre de archivo. */
export function detectModel(content, filename) {
  for (const p of MODEL_PATTERNS) {
    if (content?.model === p.model || p.tokens.some((t) => filename.includes(t))) {
      return { model: p.model, policy: p.policy, defaultName: p.name };
    }
  }
  return { model: 'TSPPD-H', policy: content?.policy ?? 0, defaultName: 'TSPPD-H (General, Ecs. 1-16)' };
}

export function buildMeta(filename, content, mtime) {
  const { model, policy, defaultName } = detectModel(content, filename);
  return {
    filename,
    mtime,
    model,
    modelName: content.modelName || defaultName,
    policy,
    instance: content.instance || filename.replace(/\.[^/.]+$/, ''),
    numCustomers: content.numCustomers || 0,
    instanceId: content.instanceId || 0,
    h: content.h ?? 0.1,
    capacity: content.capacity || 0,
    objectiveValue: content.objectiveValue || 0,
    totalDistance: content.totalDistance || 0,
    handlingCost: content.handlingCost || 0,
    tourLength: content.tour ? content.tour.length : 0,
    stepCount: content.steps ? content.steps.length : 0,
  };
}

const isSolutionFile = (f) => f.endsWith('.txt') || f.endsWith('.json');

export function sortMeta(list) {
  return list.sort(
    (a, b) =>
      (a.numCustomers || 0) - (b.numCustomers || 0) ||
      (a.instanceId || 0) - (b.instanceId || 0) ||
      a.filename.localeCompare(b.filename),
  );
}

export function listSolutions(outputsDir) {
  if (!fs.existsSync(outputsDir)) return [];
  const list = fs
    .readdirSync(outputsDir)
    .filter(isSolutionFile)
    .map((f) => {
      const filePath = path.join(outputsDir, f);
      const stat = fs.statSync(filePath);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return buildMeta(f, content, stat.mtimeMs);
      } catch {
        return { filename: f, mtime: stat.mtimeMs, error: 'Formato JSON no válido' };
      }
    });
  return sortMeta(list);
}

/**
 * Lee una solución por nombre de archivo. Devuelve null si no existe.
 * Rechaza rutas con separadores para impedir path traversal fuera de Outputs/.
 */
export function readSolution(outputsDir, filename) {
  if (!filename || filename !== path.basename(filename) || !isSolutionFile(filename)) return null;
  const filePath = path.join(outputsDir, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ── Heurísticas de Erdoğan et al. (2012) ─────────────────────────────────────
// notebooks/tsppd_h_alg21_dp.py y notebooks/tsppd_h_alg42_ils.py guardan sus resultados
// en Outputs/Erdogan2012/ (subcarpeta: el catálogo de soluciones solo lee el nivel superior).
export const HEURISTICS_SUBDIR = 'Erdogan2012';

const HEURISTIC_KINDS = { 'alg21-dp': 'dp', 'alg42-ils': 'ils' };

/**
 * Lee todos los resultados del Algoritmo 2.1 + DP (`DP_*.json`) y del ILS (`ILS_*.json`).
 * Los archivos ilegibles o de otro tipo se omiten; si la carpeta no existe devuelve listas vacías.
 */
export function readHeuristics(outputsDir) {
  const dir = path.join(outputsDir, HEURISTICS_SUBDIR);
  const result = { dp: [], ils: [] };
  if (!fs.existsSync(dir)) return result;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const content = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const kind = HEURISTIC_KINDS[content?.algorithm];
      if (kind) result[kind].push({ filename: f, ...content });
    } catch {
      // Archivo a medio escribir o corrupto: se ignora.
    }
  }
  const byInstance = (a, b) => (a.numCustomers || 0) - (b.numCustomers || 0) || (a.instanceId || 0) - (b.instanceId || 0);
  result.dp.sort(byInstance);
  result.ils.sort(byInstance);
  return result;
}

// ── Benchmark de tiempos (notebooks/tsppd_h_benchmark.py) ────────────────────
// Gurobi (General, Políticas 1-3) vs Algoritmo 2.1 + DP e ILS. El script escribe en
// Outputs/Benchmark/ un consolidado (benchmark_tiempos.json, reemplazado atómicamente tras
// cada ejecución) y un registro incremental (registros.jsonl, una línea JSON por ejecución).
export const BENCHMARK_SUBDIR = 'Benchmark';
const BENCHMARK_SUMMARY = 'benchmark_tiempos.json';
const BENCHMARK_RECORDS = 'registros.jsonl';
const BENCHMARK_TITLE = 'Benchmark de tiempos TSPPD-H';

/** Métodos en el orden canónico de las tablas (mismas etiquetas que METHOD_LABELS del script). */
const BENCH_METHODS = [
  { key: 'general', label: 'Modelo General' },
  { key: 'p1', label: 'Política 1' },
  { key: 'p2', label: 'Política 2' },
  { key: 'p3', label: 'Política 3' },
  { key: 'dp', label: 'Algoritmo 2.1 + DP (dos fases)' },
  { key: 'ils', label: 'ILS-2dir (Algoritmo 4.2)' },
];
const BENCH_METHOD_KEYS = BENCH_METHODS.map((m) => m.key);

/**
 * JSON.parse tolerante: Python (`allow_nan=True`) puede escribir NaN / Infinity, que no son
 * JSON válido. Solo si el parseo estricto falla, esos literales se cambian por null. Lanza
 * si el texto sigue sin ser JSON (p. ej. una línea a medio escribir).
 */
function parseJsonLenient(text) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return JSON.parse(clean);
  } catch (err) {
    const fixed = clean.replace(/([:[,]\s*)-?(?:NaN|Infinity)(?=\s*[,\]}])/g, '$1null');
    if (fixed === clean) throw err;
    return JSON.parse(fixed);
  }
}

const isBenchRecord = (r) =>
  !!r &&
  typeof r === 'object' &&
  typeof r.key === 'string' &&
  BENCH_METHOD_KEYS.includes(r.method) &&
  Number.isFinite(r.numCustomers) &&
  Number.isFinite(r.instanceId) &&
  Number.isFinite(r.h);

/** Último registro por clave; orden del script: h, |Vc|, Id, método. */
function tidyRecords(list) {
  const byKey = new Map();
  for (const r of list) if (isBenchRecord(r)) byKey.set(r.key, r);
  return [...byKey.values()].sort(
    (a, b) =>
      a.h - b.h ||
      a.numCustomers - b.numCustomers ||
      a.instanceId - b.instanceId ||
      BENCH_METHOD_KEYS.indexOf(a.method) - BENCH_METHOD_KEYS.indexOf(b.method),
  );
}

/** Lee un archivo y su mtime; null si no existe o no se puede leer en este momento. */
function readText(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return { text: fs.readFileSync(filePath, 'utf-8'), mtime: stat.mtime };
  } catch {
    return null;
  }
}

const isoOf = (date) => {
  const t = date instanceof Date ? date.getTime() : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
};

/** Consolidado benchmark_tiempos.json normalizado, o null si falta o no es un consolidado legible. */
function readBenchmarkSummary(dir) {
  const file = readText(path.join(dir, BENCHMARK_SUMMARY));
  if (!file) return null;
  let raw;
  try {
    raw = parseJsonLenient(file.text);
  } catch {
    return null; // corrupto o a medio escribir: se reconstruye desde registros.jsonl
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.records)) return null;
  const records = tidyRecords(raw.records);
  // Consolidado sin registros válidos (p. ej. `--consolidate` con el JSONL vacío): «no hay nada»,
  // así se prueba registros.jsonl y, si tampoco hay, readBenchmark devuelve null.
  if (!records.length) return null;
  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : BENCHMARK_TITLE,
    reference: typeof raw.reference === 'string' ? raw.reference : '',
    generatedAt: typeof raw.generatedAt === 'string' && raw.generatedAt ? raw.generatedAt : isoOf(file.mtime),
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : null,
    methods: Array.isArray(raw.methods) && raw.methods.length ? raw.methods : BENCH_METHODS.map((m) => ({ ...m })),
    count: records.length,
    records,
  };
}

/** Reconstrucción desde registros.jsonl (última línea por clave gana; líneas ilegibles se ignoran). */
function readBenchmarkRecords(dir) {
  const file = readText(path.join(dir, BENCHMARK_RECORDS));
  if (!file) return null;
  const parsed = [];
  for (const line of file.text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      parsed.push(parseJsonLenient(s));
    } catch {
      // Línea corrupta o aún en escritura: se ignora.
    }
  }
  const records = tidyRecords(parsed);
  if (!records.length) return null;
  return {
    title: BENCHMARK_TITLE,
    reference: '',
    generatedAt: isoOf(file.mtime),
    meta: null,
    methods: BENCH_METHODS.map((m) => ({ ...m })),
    count: records.length,
    records,
  };
}

/**
 * Benchmark de tiempos (forma BenchmarkFile de src/types/benchmark.ts). Usa el consolidado;
 * si no existe o no se puede parsear, lo reconstruye desde registros.jsonl con `meta: null`.
 * Devuelve null si no hay ningún resultado. No lanza por archivos ausentes, bloqueados o a
 * medio escribir (el benchmark puede estar corriendo mientras se lee).
 */
export function readBenchmark(outputsDir) {
  const dir = path.join(outputsDir, BENCHMARK_SUBDIR);
  return readBenchmarkSummary(dir) ?? readBenchmarkRecords(dir);
}

// ── Benchmark de metaheurísticas a gran escala (notebooks/erdogan2012/benchmark.mjs) ──────────
// Dos fases, ILS e ITS (heurístico/exacto, 1 y 2 direcciones) en las instancias de |Vc| = 20…200
// de Erdoğan et al. (2012), Tablas 8–9. El script reescribe atómicamente el consolidado tras cada
// ejecución y agrega una línea a registros.jsonl; paper_erdogan2012.json trae las cifras del paper.
export const METAHEURISTICS_SUBDIR = 'BenchmarkErdogan2012';
const META_SUMMARY = 'benchmark_metaheuristicas.json';
const META_RECORDS = 'registros.jsonl';
const META_PAPER = 'paper_erdogan2012.json';
const META_ITS_NRAND = 'its_nrand.json';
const META_TITLE = 'Benchmark de metaheurísticas TSPPD-H (Erdoğan et al. 2012, Tablas 8–9)';
const META_METHODS = [
  { key: 'twophase', label: 'Dos fases (TSP + Alg. 2.1)' },
  { key: 'ils-heuristic', label: 'ILS heurístico' },
  { key: 'ils-exact', label: 'ILS exacto' },
  { key: 'its-heuristic', label: 'ITS heurístico' },
  { key: 'its-exact', label: 'ITS exacto' },
];
const META_METHOD_KEYS = new Set(['tsp', ...META_METHODS.map((m) => m.key), 'ilsd-heuristic', 'ilsd-exact']);

const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : x);

/**
 * Registro sin lo que la página no usa (tours, óptimos locales): el consolidado pesa varios MB.
 * La traza `history` se conserva redondeada a centésimas (gráfico de convergencia).
 */
function slimMetaRecord(r) {
  const { tour: _tour, localOptima: _lo, history, initial, best, dirs, ...rest } = r;
  const sol = (s) => {
    if (!s || typeof s !== 'object') return s;
    const { tour: _t, ...keep } = s;
    return keep;
  };
  const out = { ...rest };
  if (initial) out.initial = sol(initial);
  if (best) out.best = sol(best);
  if (Array.isArray(dirs)) out.dirs = dirs.map(sol);
  if (Array.isArray(history)) out.history = history.map(r2);
  return out;
}

const isMetaRecord = (r) =>
  !!r &&
  typeof r === 'object' &&
  typeof r.key === 'string' &&
  META_METHOD_KEYS.has(r.method) &&
  Number.isFinite(r.n) &&
  Number.isFinite(r.id);

function tidyMetaRecords(list) {
  const byKey = new Map();
  for (const r of list) if (isMetaRecord(r)) byKey.set(r.key, slimMetaRecord(r));
  return [...byKey.values()].sort(
    (a, b) => a.n - b.n || a.id - b.id || String(a.method).localeCompare(String(b.method)) || (a.dir ?? 0) - (b.dir ?? 0),
  );
}

function readMetaSummary(dir) {
  const file = readText(path.join(dir, META_SUMMARY));
  if (!file) return null;
  let raw;
  try {
    raw = parseJsonLenient(file.text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.records)) return null;
  const records = tidyMetaRecords(raw.records);
  if (!records.length) return null;
  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : META_TITLE,
    reference: typeof raw.reference === 'string' ? raw.reference : '',
    generatedAt: typeof raw.generatedAt === 'string' && raw.generatedAt ? raw.generatedAt : isoOf(file.mtime),
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : null,
    methods: Array.isArray(raw.methods) && raw.methods.length ? raw.methods : META_METHODS.map((m) => ({ ...m })),
    count: records.length,
    records,
  };
}

function readMetaRecords(dir) {
  const file = readText(path.join(dir, META_RECORDS));
  if (!file) return null;
  const parsed = [];
  for (const line of file.text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      parsed.push(parseJsonLenient(s));
    } catch {
      // Línea corrupta o aún en escritura: se ignora.
    }
  }
  const records = tidyMetaRecords(parsed);
  if (!records.length) return null;
  return {
    title: META_TITLE,
    reference: '',
    generatedAt: isoOf(file.mtime),
    meta: null,
    methods: META_METHODS.map((m) => ({ ...m })),
    count: records.length,
    records,
  };
}

function readMetaPaper(dir) {
  const file = readText(path.join(dir, META_PAPER));
  if (!file) return null;
  try {
    const raw = parseJsonLenient(file.text);
    return raw && typeof raw === 'object' && Array.isArray(raw.instances) && raw.instances.length ? raw : null;
  } catch {
    return null;
  }
}

/** Experimento de sensibilidad del ITS exacto a Nrand (notebooks/erdogan2012/its_nrand.mjs), o null. */
function readMetaItsNrand(dir) {
  const file = readText(path.join(dir, META_ITS_NRAND));
  if (!file) return null;
  try {
    const raw = parseJsonLenient(file.text);
    return raw && typeof raw === 'object' && Array.isArray(raw.runs) && raw.runs.length ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Benchmark de metaheurísticas: { data, paper, itsNrand } (formas MetaFile, PaperFile e ItsNrandFile de
 * src/types/metaheuristics.ts). data viene del consolidado o, si falta o no se puede parsear,
 * de registros.jsonl (meta null). Cada uno es null si no existe. No lanza por archivos
 * ausentes, bloqueados o a medio escribir.
 */
export function readMetaheuristics(outputsDir) {
  const dir = path.join(outputsDir, METAHEURISTICS_SUBDIR);
  return { data: readMetaSummary(dir) ?? readMetaRecords(dir), paper: readMetaPaper(dir), itsNrand: readMetaItsNrand(dir) };
}
