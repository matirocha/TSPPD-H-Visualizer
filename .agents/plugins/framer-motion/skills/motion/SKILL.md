---
name: motion
description: Directrices maestras para implementar microinteracciones, físicas de resorte, animaciones de layout y transiciones fluidas con Motion / Framer Motion.
---

# Guía Maestra de Motion (Framer Motion)

Motion es el estándar de animación interactiva para React. Proporciona animaciones declarativas impulsadas por la física del movimiento.

## 1. Patrones de Entrada y Aparición Suave
```tsx
import { motion } from "motion/react"

export function FadeInCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
```

## 2. Transición Mágica de Pestañas con `layoutId`
```tsx
{tabs.map((tab) => (
  <button key={tab.id} onClick={() => setActive(tab.id)} className="relative px-4 py-2">
    {active === tab.id && (
      <motion.div
        layoutId="activeTabIndicator"
        className="absolute inset-0 bg-white/10 rounded-xl"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
    <span className="relative z-10">{tab.label}</span>
  </button>
))}
```

## 3. Gestos Interactivos (Hover y Tap Físico)
- **Hover:** `whileHover={{ scale: 1.02, y: -2 }}`
- **Tap / Click:** `whileTap={{ scale: 0.98 }}`
- **Focus:** `whileFocus={{ scale: 1.01 }}`

## 4. Animaciones de Salida con `AnimatePresence`
```tsx
import { AnimatePresence, motion } from "motion/react"

<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      Contenido Modal
    </motion.div>
  )}
</AnimatePresence>
```
