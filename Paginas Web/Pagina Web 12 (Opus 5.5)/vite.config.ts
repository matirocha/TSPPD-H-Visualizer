import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSolutions, readBenchmark, readHeuristics, readMetaheuristics, readSolution } from './scripts/solutions-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = path.resolve(__dirname, '../../Outputs');

/**
 * Expone /api/solutions, /api/heuristics, /api/benchmark y /api/metaheuristics durante `npm run dev`, leyendo en vivo
 * la carpeta Outputs/.
 */
function solutionsApiPlugin(): Plugin {
  return {
    name: 'tsppd-solutions-api-p12',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/api/heuristics' || url === '/api/heuristics/') {
          res.setHeader('Content-Type', 'application/json');
          try {
            return res.end(JSON.stringify({ success: true, ...readHeuristics(OUTPUTS_DIR) }));
          } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: (err as Error).message }));
          }
        }
        if (url === '/api/benchmark' || url === '/api/benchmark/') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          try {
            return res.end(JSON.stringify({ success: true, data: readBenchmark(OUTPUTS_DIR) }));
          } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: (err as Error).message }));
          }
        }
        if (url === '/api/metaheuristics' || url === '/api/metaheuristics/') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          try {
            return res.end(JSON.stringify({ success: true, ...readMetaheuristics(OUTPUTS_DIR) }));
          } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: (err as Error).message }));
          }
        }
        if (!url.startsWith('/api/solutions')) return next();
        res.setHeader('Content-Type', 'application/json');
        try {
          if (url === '/api/solutions' || url === '/api/solutions/') {
            const solutions = listSolutions(OUTPUTS_DIR);
            return res.end(JSON.stringify({ success: true, count: solutions.length, solutions }));
          }
          const filename = decodeURIComponent(url.slice('/api/solutions/'.length));
          const data = readSolution(OUTPUTS_DIR, filename);
          if (!data) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ success: false, error: 'Solución no encontrada en Outputs/' }));
          }
          return res.end(JSON.stringify({ success: true, filename, data }));
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: (err as Error).message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), solutionsApiPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3012,
    // `--no-open` permite lanzarlo sin abrir el navegador (p. ej. desde herramientas).
    open: !process.argv.includes('--no-open'),
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
