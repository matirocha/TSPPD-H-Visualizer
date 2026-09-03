import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const OUTPUTS_DIR = path.resolve(__dirname, '../../Outputs')

// Get list of available solutions
app.get('/api/solutions', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUTS_DIR)) {
      return res.json([])
    }
    const files = fs.readdirSync(OUTPUTS_DIR)
      .filter(f => f.endsWith('.txt') || f.endsWith('.json'))
      .map(f => {
        try {
          const content = fs.readFileSync(path.join(OUTPUTS_DIR, f), 'utf-8')
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
          }
        } catch (e) {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.instanceId || 0) - (b.instanceId || 0))
    res.json(files)
  } catch (err) {
    console.error('Error reading solutions:', err)
    res.status(500).json({ error: 'Failed to read solutions' })
  }
})

// Get specific solution
app.get('/api/solutions/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename)
    const filepath = path.join(OUTPUTS_DIR, filename)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Solution not found' })
    }
    const content = fs.readFileSync(filepath, 'utf-8')
    res.setHeader('Content-Type', 'application/json')
    res.send(content)
  } catch (err) {
    console.error('Error reading solution:', err)
    res.status(500).json({ error: 'Failed to read solution' })
  }
})

// Servir frontend si existe carpeta dist
const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`====================================================`)
  console.log(`  TSPPD-H Visualizer (Pagina Web 6 - Nemotron)`)
  console.log(`  Servidor activo en: http://localhost:${PORT}`)
  console.log(`====================================================`)
})