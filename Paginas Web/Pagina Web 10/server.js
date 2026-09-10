import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3010;
const OUTPUTS_DIR = path.resolve(__dirname, '..', '..', 'Outputs');

app.use(cors());
app.use(express.json());

// API: Listar todas las soluciones de la carpeta Outputs
app.get('/api/solutions', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUTS_DIR)) {
      fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
    const files = fs.readdirSync(OUTPUTS_DIR).filter((f) => f.endsWith('.txt') || f.endsWith('.json'));
    const solutionsList = files.map((file) => {
      const filePath = path.join(OUTPUTS_DIR, file);
      const stat = fs.statSync(filePath);
      let meta = { filename: file, mtime: stat.mtimeMs };
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const content = JSON.parse(raw);
        const isH1 = (content.model === 'TSPPD-H_1') || file.includes('TSPPD_H1') || file.includes('_H1_');
        const isH2 = (content.model === 'TSPPD-H_2') || file.includes('TSPPD_H2') || file.includes('_H2_');
        const isH3 = (content.model === 'TSPPD-H_3') || file.includes('TSPPD_H3') || file.includes('_H3_');
        
        let modelType = 'TSPPD-H';
        let defaultName = 'TSPPD-H (General, Ecs. 1-16)';
        let policy = content.policy ?? 0;
        if (isH1) {
          modelType = 'TSPPD-H_1';
          defaultName = 'TSPPD-H_1 (Política 1, Ecs. 17-25)';
          policy = 1;
        } else if (isH2) {
          modelType = 'TSPPD-H_2';
          defaultName = 'TSPPD-H_2 (Política 2, Ecs. 26-27)';
          policy = 2;
        } else if (isH3) {
          modelType = 'TSPPD-H_3';
          defaultName = 'TSPPD-H_3 (Política 3, Ecs. 31-48)';
          policy = 3;
        }
        const modelName = content.modelName || defaultName;
        meta = {
          ...meta,
          model: modelType,
          modelName: modelName,
          policy: policy,
          instance: content.instance || file.replace(/\.[^/.]+$/, ''),
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
      } catch (e) {
        meta.error = 'Formato JSON no válido';
      }
      return meta;
    });

    solutionsList.sort((a, b) => (a.instanceId || 0) - (b.instanceId || 0) || a.filename.localeCompare(b.filename));
    res.json({ success: true, count: solutionsList.length, solutions: solutionsList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Obtener detalle completo de una solución específica
app.get('/api/solutions/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(OUTPUTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Solución no encontrada en Outputs/' });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const content = JSON.parse(raw);
    res.json({ success: true, filename, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir frontend en producción si existe build en dist
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` TSPPD-H Visualizer (Pagina Web 10)`);
  console.log(` Servidor Node.js activo en: http://localhost:${PORT}`);
  console.log(` Leyendo soluciones desde: ${OUTPUTS_DIR}`);
  console.log(`====================================================`);
});
