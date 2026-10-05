import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { listSolutions, readBenchmark, readHeuristics, readMetaheuristics, readSolution } from './scripts/solutions-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3012;
const OUTPUTS_DIR = path.resolve(__dirname, '..', '..', 'Outputs');

app.use(cors());

app.get('/api/solutions', (_req, res) => {
  try {
    const solutions = listSolutions(OUTPUTS_DIR);
    res.json({ success: true, count: solutions.length, solutions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/solutions/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const data = readSolution(OUTPUTS_DIR, filename);
    if (!data) return res.status(404).json({ success: false, error: 'Solución no encontrada en Outputs/' });
    res.json({ success: true, filename, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resultados del Algoritmo 2.1 + DP y del ILS (Outputs/Erdogan2012/)
app.get('/api/heuristics', (_req, res) => {
  try {
    res.json({ success: true, ...readHeuristics(OUTPUTS_DIR) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Benchmark de tiempos Gurobi vs Alg. 2.1 + DP e ILS (Outputs/Benchmark/); data = null si aún no hay resultados
app.get('/api/benchmark', (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: readBenchmark(OUTPUTS_DIR) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Benchmark de metaheurísticas a gran escala (Outputs/BenchmarkErdogan2012/); data / paper = null si aún no existen
app.get('/api/metaheuristics', (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...readMetaheuristics(OUTPUTS_DIR) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sirve el build de producción si existe
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(' TSPPD-H Visualizer · Pagina Web 12 (Opus 5.5)');
  console.log(` Servidor activo en: http://localhost:${PORT}`);
  console.log(` Leyendo soluciones desde: ${OUTPUTS_DIR}`);
  console.log('====================================================');
});
