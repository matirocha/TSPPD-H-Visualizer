import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function solutionsApiPlugin() {
  return {
    name: 'solutions-api-v8',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const rawUrl = req.url || ''
        const url = rawUrl.split('?')[0]
        if (!url.startsWith('/api/solutions')) return next()

        const outputsDir = path.resolve(__dirname, '../../Outputs')

        if (url === '/api/solutions' || url === '/api/solutions/') {
          try {
            if (!fs.existsSync(outputsDir)) {
              res.setHeader('Content-Type', 'application/json')
              return res.end(JSON.stringify([]))
            }
            const files = fs.readdirSync(outputsDir)
              .filter((f: string) => f.endsWith('.txt') || f.endsWith('.json'))
              .map((f: string) => {
                try {
                  const content = fs.readFileSync(path.join(outputsDir, f), 'utf-8')
                  const data = JSON.parse(content)
                  return {
                    filename: f,
                    instance: data.instance || f,
                    numCustomers: data.numCustomers || 0,
                    instanceId: data.instanceId || 0,
                    h: data.h ?? 0.1,
                    objectiveValue: data.objectiveValue || 0,
                    totalDistance: data.totalDistance || 0,
                    handlingCost: data.handlingCost || 0,
                    tour: data.tour || [],
                    capacity: data.capacity || 0
                  }
                } catch { return null }
              })
              .filter(Boolean)
              .sort((a: any, b: any) => (a.instanceId || 0) - (b.instanceId || 0))
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify(files))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: err.message }))
          }
        }

        const prefix = '/api/solutions/'
        if (url.startsWith(prefix)) {
          const filename = decodeURIComponent(url.slice(prefix.length))
          const filepath = path.join(outputsDir, filename)
          if (!fs.existsSync(filepath)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Solution not found' }))
          }
          try {
            const content = fs.readFileSync(filepath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            return res.end(content)
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: err.message }))
          }
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), solutionsApiPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 3008, open: true }
})
