import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const OUTPUTS_DIR = path.resolve(__dirname, '..', '..', 'Outputs');
const BASE_DIR = path.resolve(__dirname, '..', '..');

app.use(cors());
app.use(express.json());

// API: Listar todas las soluciones disponibles en la carpeta Outputs
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
        meta = {
          ...meta,
          instance: content.instance || file.replace(/\.[^/.]+$/, ''),
          numCustomers: content.numCustomers || 0,
          instanceId: content.instanceId || 0,
          h: content.h || 0.1,
          capacity: content.capacity || 0,
          objectiveValue: content.objectiveValue || 0,
          totalDistance: content.totalDistance || 0,
          handlingCost: content.handlingCost || 0,
          tour: content.tour || [],
          stepCount: content.steps ? content.steps.length : 0,
        };
      } catch (e) {
        meta.error = 'Formato JSON no válido o archivo dañado';
      }
      return meta;
    });

    // Ordenar por ID de instancia y nombre
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
      return res.status(404).json({ success: false, error: `Solución no encontrada: ${filename}` });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const content = JSON.parse(raw);
    res.json({ success: true, filename, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Extra: Ejecutar optimizador Gurobi para generar o recalcular soluciones
app.post('/api/solve', (req, res) => {
  const { customers = 5, instanceId = 1, h = 0.1 } = req.body;
  const scriptPath = path.join(BASE_DIR, 'Testeando Modelo con Papers', 'tsppd_h_gurobi.py');

  if (!fs.existsSync(scriptPath)) {
    return res.status(400).json({ success: false, error: 'Script de Gurobi no encontrado' });
  }

  const pythonProcess = spawn('python', [
    scriptPath,
    '--customers', String(customers),
    '--id', String(instanceId),
    '--h', String(h)
  ]);

  let stdoutData = '';
  let stderrData = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      res.json({ success: true, message: 'Optimización completada', stdout: stdoutData });
    } else {
      res.status(500).json({ success: false, error: 'Error durante la optimización', stderr: stderrData });
    }
  });
});

// Servir frontend en producción si existe dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  TSPPD-H Visualizer (Página Web 3)`);
  console.log(`  Servidor activo en: http://localhost:${PORT}`);
  console.log(`  Leyendo soluciones desde: ${OUTPUTS_DIR}`);
  console.log(`====================================================`);
});
