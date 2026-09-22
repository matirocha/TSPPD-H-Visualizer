import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const OUTPUTS_DIR = fs.existsSync(path.resolve(__dirname, "..", "..", "Outputs"))
  ? path.resolve(__dirname, "..", "..", "Outputs")
  : path.resolve(__dirname, "..", "Outputs");

app.use(cors());
app.use(express.json());

// API: Listar soluciones
app.get("/api/solutions", (req, res) => {
  try {
    if (!fs.existsSync(OUTPUTS_DIR)) {
      fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
    const files = fs.readdirSync(OUTPUTS_DIR).filter((f) => f.endsWith(".txt") || f.endsWith(".json"));
    const solutionsList = files.map((file) => {
      const filePath = path.join(OUTPUTS_DIR, file);
      const stat = fs.statSync(filePath);
      let meta = { filename: file, mtime: stat.mtimeMs };
      try {
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        meta = {
          ...meta,
          instance: content.instance || file.replace(/\.[^/.]+$/, ""),
          numCustomers: content.numCustomers || 0,
          instanceId: content.instanceId || 0,
          h: content.h || 0.1,
          capacity: content.capacity || 0,
          objectiveValue: content.objectiveValue || 0,
          totalDistance: content.totalDistance || 0,
          handlingCost: content.handlingCost || 0,
          tourLength: content.tour ? content.tour.length : 0,
        };
      } catch (e) {
        meta.error = "Invalid JSON format";
      }
      return meta;
    });

    solutionsList.sort((a, b) => (a.instanceId || 0) - (b.instanceId || 0) || a.filename.localeCompare(b.filename));
    res.json({ success: true, solutions: solutionsList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Obtener contenido de una solución
app.get("/api/solutions/:filename", (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(OUTPUTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Solución no encontrada" });
    }

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ success: true, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir frontend compilado si existe en /dist
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Servidor TSPPD-H Activo en: http://localhost:${PORT}`);
  console.log(` Carpeta de Soluciones: ${OUTPUTS_DIR}`);
  console.log(`====================================================`);
});
