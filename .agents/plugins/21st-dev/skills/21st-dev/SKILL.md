---
name: 21st-dev
description: Cómo buscar, descargar e integrar componentes de diseño avanzados y bloques prémium de 21st.dev en proyectos React.
---

# Catálogo y Patrones de 21st.dev

21st.dev es el registro de componentes avanzados de UI y Design Engineering para React, Tailwind CSS y Motion.

## 1. Instalación mediante CLI
```bash
# Buscar componentes visuales
npx @21st-dev/cli search "spotlight"
npx @21st-dev/cli search "bento grid"

# Instalar un componente directamente
npx @21st-dev/cli add aceternity/spotlight-card
```

## 2. Patrones Visuales Populares de 21st.dev
1. **Spotlight Card (Efecto Resplandor al Cursor):**
   Usa un gradiente radial posicionado dinámicamente con coordenadas del ratón en `onMouseMove`.
2. **Bento Grid con Asimetría:**
   Disposición en CSS Grid (`md:grid-cols-3`) con celdas de diferentes tamaños (`md:col-span-2`), fondos tintados y micro-animaciones al hover.
3. **Aurora / Mesh Gradients:**
   Fondos con manchas de color difuminadas (`blur-3xl`) y movimiento suave continuo con Motion.
4. **Kinetic Typography (Texto Animado):**
   Efectos de escritura automática, letras flotantes o texto con degradado reflectante.

## 3. Ejemplo: Tarjeta Spotlight de 21st.dev
```tsx
import React, { useState } from "react"
import { motion } from "motion/react"

export function SpotlightCard({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl"
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.06), transparent 80%)`
          }}
        />
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-zinc-400 mt-2">{description}</p>
      {children}
    </div>
  )
}
```
