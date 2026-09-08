---
name: framer-motion
description: Directrices de animación fluida y físicas de resorte con Framer Motion (Motion) para React y HTML nativo. Incluye microinteracciones táctiles, transiciones de layout y efectos de aparición suave.
---

# Guía Maestra de Framer Motion & Motion (React & HTML)

Motion es el estándar de animación interactiva y fluida con físicas de resorte (`springs`), tanto en proyectos React como en páginas HTML nativas.

---

## 1. Principios de Animación de Calidad

- **Física sobre Duración Fija:** Usar `type: "spring"` con amortiguación natural (`stiffness: 300-400`, `damping: 25-35`) en lugar de animaciones lineales mecánicas.
- **Microinteracciones Táctiles:** Todo elemento interactivo (botones, tarjetas, chips) debe reaccionar al tacto:
  - Al pasar el cursor (Hover): elevación sutil `y: -2px` o escala `1.01` - `1.02`.
  - Al presionar (Active/Tap): compresión táctil física `scale: 0.97` - `0.98`.
- **Aparición Progresiva (Stagger):** Los elementos de una lista o grid deben aparecer secuencialmente con un desfase de 0.05s a 0.08s entre cada uno.

---

## 2. Uso en HTML Standalone (Motion via CDN)

En archivos `.html` independientes, se puede incluir la librería oficial de Motion:

```html
<!-- Cargar Motion for JavaScript -->
<script src="https://cdn.jsdelivr.net/npm/motion@latest/dist/motion.js"></script>

<script>
  const { animate, spring, stagger } = Motion;

  // 1. Animación de entrada suave escalonada al cargar
  document.addEventListener("DOMContentLoaded", () => {
    animate(
      ".animate-in",
      { opacity: [0, 1], y: [24, 0] },
      { delay: stagger(0.08), duration: 0.6, easing: spring({ stiffness: 260, damping: 20 }) }
    );

    // 2. Microinteracciones interactivas en botones y tarjetas
    document.querySelectorAll(".motion-hover").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        animate(el, { y: -3, scale: 1.01 }, { duration: 0.2, easing: "ease-out" });
      });
      el.addEventListener("mouseleave", () => {
        animate(el, { y: 0, scale: 1 }, { duration: 0.2, easing: "ease-out" });
      });
      el.addEventListener("mousedown", () => {
        animate(el, { scale: 0.97 }, { duration: 0.1 });
      });
      el.addEventListener("mouseup", () => {
        animate(el, { scale: 1.01 }, { duration: 0.15 });
      });
    });
  });
</script>
```

---

## 3. Uso en Proyectos React (`motion/react`)

```tsx
"use client";
import { motion, AnimatePresence } from "motion/react";

// Tarjeta con entrada suave y hover táctil
export function SmoothCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
    >
      <h4 className="font-semibold text-white">{title}</h4>
      <div className="mt-2 text-zinc-400">{children}</div>
    </motion.div>
  );
}

// Pestañas mágicas con layoutId
export function AnimatedTabs({ tabs, active, onSelect }: { tabs: string[]; active: string; onSelect: (t: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className="relative px-4 py-1.5 text-sm font-medium transition-colors text-zinc-300 hover:text-white"
        >
          {active === tab && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 rounded-lg bg-zinc-800 shadow"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}
```
