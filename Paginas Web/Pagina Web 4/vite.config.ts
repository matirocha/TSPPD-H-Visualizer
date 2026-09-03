import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Custom plugin to serve Outputs directory via API
function outputsApiPlugin() {
  return {
    name: 'outputs-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/outputs', (req, res) => {
        const outputsDir = path.resolve(__dirname, '../../Outputs')
        
        if (req.method === 'GET') {
          if (req.url === '/') {
            // List files
            try {
              const files = fs.readdirSync(outputsDir)
              const txtFiles = files.filter(f => f.endsWith('.txt'))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(txtFiles))
            } catch (err: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          } else {
            // Read specific file
            const fileName = decodeURIComponent(req.url!.slice(1)) // remove leading slash
            const filePath = path.join(outputsDir, fileName)
            
            // Basic security check to prevent path traversal
            if (!filePath.startsWith(outputsDir)) {
              res.statusCode = 403
              res.end(JSON.stringify({ error: 'Forbidden' }))
              return
            }
            
            try {
              const content = fs.readFileSync(filePath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(content)
            } catch (err) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'File not found' }))
            }
          }
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    outputsApiPlugin()
  ],
})
