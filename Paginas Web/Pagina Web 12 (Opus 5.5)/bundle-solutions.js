// Empaqueta las soluciones de ../../Outputs como JSON estáticos en public/solutions/
// para que la app funcione sin backend (vite preview, Vercel, hosting estático).
// Cada solución se descarga bajo demanda; index.json contiene solo la metadata.
// heuristics.json reúne los resultados del Algoritmo 2.1 + DP y del ILS (Outputs/Erdogan2012/).
// benchmark.json es el benchmark de tiempos Gurobi vs Alg. 2.1 + DP e ILS (Outputs/Benchmark/), si existe.
// metaheuristics.json es el benchmark de metaheurísticas a gran escala y las cifras del paper
// (Outputs/BenchmarkErdogan2012/), si existen.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSolutions, readBenchmark, readHeuristics, readMetaheuristics, readSolution } from './scripts/solutions-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../Outputs');
const targetDir = path.join(__dirname, 'public', 'solutions');

if (!fs.existsSync(outputsDir)) {
  console.warn(`[bundle] No se encontró ${outputsDir}; se conservan las soluciones ya empaquetadas.`);
  process.exit(0);
}

const BENCHMARK_FILE = 'benchmark.json';
const METAHEURISTICS_FILE = 'metaheuristics.json';
const KEEP = new Set([BENCHMARK_FILE, METAHEURISTICS_FILE]);

fs.mkdirSync(targetDir, { recursive: true });
// benchmark.json y metaheuristics.json se tratan aparte (abajo): sin resultados nuevos se conserva el ya empaquetado.
for (const f of fs.readdirSync(targetDir)) if (!KEEP.has(f)) fs.rmSync(path.join(targetDir, f));

const meta = listSolutions(outputsDir).filter((m) => !m.error);
for (const m of meta) {
  const data = readSolution(outputsDir, m.filename);
  fs.writeFileSync(path.join(targetDir, `${m.filename}.json`), JSON.stringify(data), 'utf-8');
}
fs.writeFileSync(path.join(targetDir, 'index.json'), JSON.stringify({ count: meta.length, solutions: meta }), 'utf-8');
const heuristics = readHeuristics(outputsDir);
fs.writeFileSync(path.join(targetDir, 'heuristics.json'), JSON.stringify(heuristics), 'utf-8');
console.log(`[bundle] ${meta.length} soluciones empaquetadas en public/solutions/`);
console.log(`[bundle] Heurísticas Erdoğan 2012: ${heuristics.dp.length} evaluaciones DP y ${heuristics.ils.length} resultados ILS`);
const benchmark = readBenchmark(outputsDir);
if (benchmark) {
  fs.writeFileSync(path.join(targetDir, BENCHMARK_FILE), JSON.stringify(benchmark), 'utf-8');
  const origin = benchmark.meta ? 'benchmark_tiempos.json' : 'reconstruido desde registros.jsonl';
  console.log(`[bundle] Benchmark de tiempos: ${benchmark.count} registros (${origin}) → public/solutions/${BENCHMARK_FILE}`);
} else if (fs.existsSync(path.join(targetDir, BENCHMARK_FILE))) {
  // Misma política que con Outputs/ ausente: sin resultados nuevos no se borra la foto empaquetada.
  console.log(`[bundle] Benchmark de tiempos: sin resultados en Outputs/Benchmark/; se conserva public/solutions/${BENCHMARK_FILE}`);
} else {
  console.log(`[bundle] Benchmark de tiempos: sin resultados en Outputs/Benchmark/; no se genera ${BENCHMARK_FILE}`);
}
const metaheuristics = readMetaheuristics(outputsDir);
if (metaheuristics.data || metaheuristics.paper) {
  fs.writeFileSync(path.join(targetDir, METAHEURISTICS_FILE), JSON.stringify(metaheuristics), 'utf-8');
  const origin = metaheuristics.data?.meta ? 'benchmark_metaheuristicas.json' : metaheuristics.data ? 'reconstruido desde registros.jsonl' : 'sin ejecuciones aún';
  console.log(
    `[bundle] Metaheurísticas: ${metaheuristics.data?.count ?? 0} registros (${origin}) y ${metaheuristics.paper?.instances.length ?? 0} filas del paper → public/solutions/${METAHEURISTICS_FILE}`,
  );
} else if (fs.existsSync(path.join(targetDir, METAHEURISTICS_FILE))) {
  console.log(`[bundle] Metaheurísticas: sin resultados en Outputs/BenchmarkErdogan2012/; se conserva public/solutions/${METAHEURISTICS_FILE}`);
} else {
  console.log(`[bundle] Metaheurísticas: sin resultados en Outputs/BenchmarkErdogan2012/; no se genera ${METAHEURISTICS_FILE}`);
}
