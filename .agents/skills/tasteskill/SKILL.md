---
name: tasteskill
description: Directrices de diseño frontend de alta gama y anti-slop para landing pages, portfolios y páginas web en HTML o React. Infiere el lenguaje visual, evita clichés de IA y aplica rigor tipográfico y compositivo.
---

# Tasteskill: Directrices Frontend Anti-Slop

Tasteskill es el estándar de calidad visual para evitar interfaces genéricas ("AI slop") al crear páginas web, landing pages, componentes o archivos HTML.

## 1. Principios Fundamentales (Anti-Defaults)

- **Prohibido el cliché de IA:** No utilizar gradientes morados/púrpuras genéricos sobre fondo oscuro sin intención, ni layouts repetitivos de 3 tarjetas idénticas, ni fuentes estándar sin personalidad.
- **Tipografía Refinada:** 
  - Usar fuentes modernas de calidad como **Geist**, **Inter Tight**, **Plus Jakarta Sans** o **Satoshi**.
  - Títulos con `tracking-tight` o `tracking-tighter` y `leading-none` o `leading-tight`.
  - Párrafos legibles con `max-w-[65ch]` y colores atenuados (`text-zinc-400` en modo oscuro).
- **Consistencia Visual:** Mantener una paleta armónica única (base Zinc / Slate neutra) con a lo sumo un color de acento controlado (ej. esmeralda, azul eléctrico, ámbar o rosa profundo).
- **Espaciado y Respiración:** Dejar que los elementos respiren con `py-16` a `py-24` entre secciones principales y `gap-6` a `gap-8` en grids.
- **Botones y Acciones:** Botones con contraste accesible (mínimo WCAG AA), radios consistentes (`rounded-xl`) y micro-interacción táctil al hacer click (`active:scale-[0.98]`).

## 2. Los Tres Diales de Configuración

Al diseñar cualquier interfaz o HTML, calibrar mentalmente estos 3 parámetros:
- **`DESIGN_VARIANCE` (1 a 10):** Grado de asimetría y originalidad del layout. (Por defecto: 7-8).
- **`MOTION_INTENSITY` (1 a 10):** Nivel de fluidez y micro-animaciones presentes. (Por defecto: 6).
- **`VISUAL_DENSITY` (1 a 10):** Densidad de información vs. espacio en blanco. (Por defecto: 4).

## 3. Composición de Layouts
- **Evitar el Hero centrado genérico:** Preferir héroes con composición asimétrica (split 50/50, texto a la izquierda con vista previa de producto interactiva a la derecha).
- **Grids Bento:** Si se muestran características, estructurarlas como una Bento Grid con jerarquía (una celda ancha de 2 columnas combinada con celdas cuadradas).
- **Documentación Completa:** Para detalles exhaustivos de fuentes, sistemas de diseño y pre-flight check, consultar [design-taste-frontend](../design-taste-frontend/SKILL.md).
