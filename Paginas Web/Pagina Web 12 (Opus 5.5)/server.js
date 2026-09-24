import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { listSolutions, readSolution } from './scripts/solutions-api.js';

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
