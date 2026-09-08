# Directrices del Proyecto y Reglas del Agente

## 🚀 Directiva Obligatoria: Creación de HTML, Páginas Web y Componentes UI

Siempre que el usuario solicite crear, modificar, rediseñar o estilizar cualquier archivo HTML (`.html`), página web o componente de interfaz, el agente **DEBE APLICAR OBLIGATORIAMENTE** los siguientes cuatro pilares:

---

### 1. Tasteskill (Diseño Frontend Anti-Slop)
- **Cero Clichés de IA:** Prohibido generar el típico diseño de IA (gradientes morados genéricos sin propósito, 3 tarjetas idénticas alineadas, fuentes predeterminadas aburridas).
- **Tipografía de Alta Gama:** Usar tipografías modernas como **Geist**, **Inter Tight**, **Plus Jakarta Sans** o **Satoshi**. Encabezados con `tracking-tight` y proporciones de lectura balanceadas (`max-w-[65ch]`).
- **Respiración y Jerarquía:** Espaciado generoso entre secciones (`py-16` a `py-24`) y `gap-6` a `gap-8` en grids.
- **Diales de Calibración:** Por defecto calibrar a `DESIGN_VARIANCE: 7-8` (asimetría intencional), `MOTION_INTENSITY: 6` (micro-interacciones fluidas) y `VISUAL_DENSITY: 4` (aireado y limpio).

---

### 2. shadcn/ui (Estética y Sistema de Componentes)
- **Paleta Zinc Dark Mode (por defecto):**
  - Fondo (`background`): `bg-zinc-950` (`#09090b`)
  - Tarjetas (`card`): `bg-zinc-900/60` con borde `border-zinc-800`
  - Texto principal (`foreground`): `text-zinc-50` / `text-white`
  - Texto atenuado (`muted`): `text-zinc-400`
  - Acentos: Botón primario blanco (`bg-white text-zinc-950 hover:bg-zinc-200`) y botones secundarios en `bg-zinc-800`.
- **Radios Consistentes:** Usar uniformemente `rounded-xl` (12px) o `rounded-2xl` (16px).
- **Accesibilidad:** Contraste WCAG AA garantizado en textos y botones, estados `:focus-visible` con anillos nítidos.

---

### 3. Framer Motion / Motion (Animación Fluida y Físicas)
- **Físicas de Resorte (Springs):** Usar animaciones basadas en física (`stiffness: 300-400`, `damping: 25-35`) evitando transiciones mecánicas lineales.
- **Micro-interacciones Táctiles:**
  - Hover: Elevación sutil `y: -2px` y `scale: 1.01`.
  - Click/Tap: Compresión física `scale: 0.97` a `0.98`.
- **Apariciones Escalonadas (Stagger):** Entradas suaves de elementos (`opacity: [0, 1]`, `y: [20, 0]`) con retardo progresivo entre tarjetas.
- **En HTML Standalone:** Cargar la librería Motion vía CDN (`https://cdn.jsdelivr.net/npm/motion@latest/dist/motion.js`) o animaciones CSS Spring con micro-listeners.

---

### 4. 21st.dev (Patrones Prémium de Design Engineering)
- **Spotlight Cards:** Tarjetas con resplandor radial dinámico que reacciona a las coordenadas del ratón (`mousemove`).
- **Bento Grids Asimétricas:** Celdas combinadas de diferentes proporciones (ej. 2 columnas + 1 columna) con fondos tintados y jerarquía clara.
- **Fondos Aurora Ambientales:** Destellos sutiles de luz ambiental desenfocada (`blur-[120px]`) en puntos focales de la página.
- **Iconografía:** Usar iconos vectoriales refinados (Lucide Icons vía CDN `https://unpkg.com/lucide@latest` o paquete oficial).

---

## 📄 Plantilla Canónica para Archivos `.html` Independientes

Cuando se solicite generar un archivo HTML único, utilizar la siguiente estructura base garantizando la integración de los 4 pilares:

```html
<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página Web Prémium</title>
  
  <!-- Fuente Geist / Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Geist', 'sans-serif'],
            mono: ['Geist Mono', 'monospace']
          },
          colors: {
            background: '#09090b',
            card: '#18181b',
            border: '#27272a'
          }
        }
      }
    }
  </script>

  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>

  <!-- Motion for JavaScript (Framer Motion engine) -->
  <script src="https://cdn.jsdelivr.net/npm/motion@latest/dist/motion.js"></script>

  <style>
    body { font-family: 'Geist', sans-serif; }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen antialiased selection:bg-zinc-800 selection:text-white">
  
  <!-- Fondo Aurora 21st.dev -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden">
    <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-indigo-500/10 via-emerald-500/10 to-blue-500/10 blur-[130px] rounded-full"></div>
  </div>

  <div class="relative z-10 max-w-6xl mx-auto px-6 py-12">
    <!-- Contenido con clases shadcn, tipografía Tasteskill y micro-interacciones Motion -->
  </div>

  <script>
    // Inicializar iconos
    lucide.createIcons();

    // Animación de entrada escalonada (Motion)
    const { animate, spring, stagger } = Motion;
    animate(".motion-entry", 
      { opacity: [0, 1], y: [20, 0] }, 
      { delay: stagger(0.08), duration: 0.5, easing: spring({ stiffness: 280, damping: 25 }) }
    );

    // Efecto Spotlight 21st.dev
    document.querySelectorAll('.spotlight-card').forEach(card => {
      const glow = card.querySelector('.spotlight-glow');
      if (!glow) return;
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        glow.style.opacity = '1';
        glow.style.background = `radial-gradient(350px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.07), transparent 80%)`;
      });
      card.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
    });
  </script>
</body>
</html>
```
