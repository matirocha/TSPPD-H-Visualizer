import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function outputsApiPlugin(): Plugin {
  return {
    name: 'outputs-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const outputsDir = path.resolve(__dirname, '../../Outputs');

        if (req.url === '/api/solutions' && req.method === 'GET') {
          try {
            if (!fs.existsSync(outputsDir)) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            const files = fs.readdirSync(outputsDir).filter(f => f.endsWith('.txt') || f.endsWith('.json'));
            const list = files.map(file => {
              try {
                const raw = fs.readFileSync(path.join(outputsDir, file), 'utf-8');
                const data = JSON.parse(raw);
                return {
                  filename: file,
                  instance: data.instance || file,
                  numCustomers: data.numCustomers || 5,
                  instanceId: data.instanceId || 1,
                  h: data.h || 0.1,
                  objectiveValue: data.objectiveValue || 0,
                  totalDistance: data.totalDistance || 0,
                  handlingCost: data.handlingCost || 0
                };
              } catch {
                return { filename: file, instance: file };
              }
            });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(list));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.url.startsWith('/api/solutions/') && req.method === 'GET') {
          const filename = decodeURIComponent(req.url.replace('/api/solutions/', ''));
          const filePath = path.join(outputsDir, filename);
          try {
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf-8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(content);
              return;
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
              return;
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), outputsApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3011,
    host: true,
  },
});
