# Reglas de Animación con Motion (Framer Motion)

- **Importación estándar:** Siempre importar desde `motion/react` (`import { motion, AnimatePresence } from "motion/react"`).
- **Física de resortes (Springs):** Usar animaciones basadas en física con `type: "spring"`, `stiffness: 300-400`, `damping: 25-35` en lugar de transiciones mecánicas lineales.
- **Transiciones de Layout:** Usar `layout` o `layoutId` para transiciones fluidas entre pestañas (tabs), filtros, acordeones y expansión de tarjetas.
- **Microinteracciones táctiles:** Todo elemento clickeable o interactivo debe incluir `whileHover={{ scale: 1.01-1.02 }}` y `whileTap={{ scale: 0.97-0.98 }}`.
- **Desapariciones:** Usar siempre `<AnimatePresence>` cuando elementos condicionales se montan y desmontan del DOM para permitir animaciones de salida (`exit`).
- **Aislamiento de Cliente:** En entornos con Server Components (Next.js), marcar siempre los componentes animados con `"use client"` en la primera línea.
