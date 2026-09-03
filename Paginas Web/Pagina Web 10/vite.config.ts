import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function solutionsApiPlugin() {
  return {
    name: 'solutions-api-v9',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const rawUrl = req.url || '';
        const url = rawUrl.split('?')[0];
        if (!url.startsWith('/api/solutions')) return next();

        const outputsDir = path.resolve(__dirname, '../../Outputs');

        if (url === '/api/solutions' || url === '/api/solutions/') {
          try {
            if (!fs.existsSync(outputsDir)) {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, count: 0, solutions: [] }));
            }
            const files = fs.readdirSync(outputsDir)
              .filter((f: string) => f.endsWith('.txt') || f.endsWith('.json'))
              .map((f: string) => {
                const filePath = path.join(outputsDir, f);
                const stat = fs.statSync(filePath);
                let meta: any = { filename: f, mtime: stat.mtimeMs };
                try {
                  const content = fs.readFileSync(filePath, 'utf-8');
                  const data = JSON.parse(content);
                  meta = {
                    ...meta,
                    instance: data.instance || f.replace(/\.[^/.]+$/, ''),
                    numCustomers: data.numCustomers || 0,
                    instanceId: data.instanceId || 0,
                    h: data.h ?? 0.1,
                    capacity: data.capacity || 0,
                    objectiveValue: data.objectiveValue || 0,
                    totalDistance: data.totalDistance || 0,
                    handlingCost: data.handlingCost || 0,
                    tourLength: data.tour ? data.tour.length : 0,
                    stepCount: data.steps ? data.steps.length : 0,
                  };
                } catch {
                  meta.error = 'Formato JSON no válido';
                }
                return meta;
              })
              .filter(Boolean)
              .sort((a: any, b: any) => (a.instanceId || 0) - (b.instanceId || 0) || a.filename.localeCompare(b.filename));

            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, count: files.length, solutions: files }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        }

        const prefix = '/api/solutions/';
        if (url.startsWith(prefix)) {
          const filename = decodeURIComponent(url.slice(prefix.length));
          const filepath = path.join(outputsDir, filename);
          if (!fs.existsSync(filepath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: 'Solución no encontrada en Outputs/' }));
          }
          try {
            const raw = fs.readFileSync(filepath, 'utf-8');
            const data = JSON.parse(raw);
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, filename, data }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), solutionsApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3010,
    open: true,
  },
});
