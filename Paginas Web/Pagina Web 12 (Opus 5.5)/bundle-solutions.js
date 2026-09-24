// Empaqueta las soluciones de ../../Outputs como JSON estáticos en public/solutions/
// para que la app funcione sin backend (vite preview, Vercel, hosting estático).
// Cada solución se descarga bajo demanda; index.json contiene solo la metadata.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSolutions, readSolution } from './scripts/solutions-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.resolve(__dirname, '../../Outputs');
const targetDir = path.join(__dirname, 'public', 'solutions');

if (!fs.existsSync(outputsDir)) {
  console.warn(`[bundle] No se encontró ${outputsDir}; se conservan las soluciones ya empaquetadas.`);
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
for (const f of fs.readdirSync(targetDir)) fs.rmSync(path.join(targetDir, f));

const meta = listSolutions(outputsDir).filter((m) => !m.error);
for (const m of meta) {
  const data = readSolution(outputsDir, m.filename);
  fs.writeFileSync(path.join(targetDir, `${m.filename}.json`), JSON.stringify(data), 'utf-8');
}
fs.writeFileSync(path.join(targetDir, 'index.json'), JSON.stringify({ count: meta.length, solutions: meta }), 'utf-8');
console.log(`[bundle] ${meta.length} soluciones empaquetadas en public/solutions/`);
