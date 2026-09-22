import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outputsDir = path.resolve(__dirname, '../../../Outputs')
const targetDir = path.resolve(__dirname, '../public/data')

// Crear directorio si no existe
fs.mkdirSync(targetDir, { recursive: true })

// Leer archivos .txt de Outputs
const files = fs.readdirSync(outputsDir).filter(f => f.endsWith('.txt'))

// Copiar cada archivo
for (const file of files) {
  const src = path.join(outputsDir, file)
  const dst = path.join(targetDir, file)
  fs.copyFileSync(src, dst)
  console.log(`Copiado: ${file}`)
}

// Generar index.json con la lista
const indexPath = path.join(targetDir, 'index.json')
fs.writeFileSync(indexPath, JSON.stringify(files, null, 2))
console.log(`Index generado con ${files.length} archivos`)
