---
name: shadcn-ui
description: Guía de arquitectura, estilos y recetas de shadcn/ui para React y HTML nativo. Incluye tokens semánticos (Zinc dark), variantes con CVA y estructura de componentes accesibles.
---

# Guía Maestra de shadcn/ui (React & HTML)

shadcn/ui ofrece una estética limpia, minimalista y accesible basada en Tailwind CSS, Radix UI y tokens semánticos.

---

## 1. Paleta Semántica y Tokens (Modo Oscuro / Zinc)

Las variables base o clases equivalentes de Tailwind para la estética shadcn/ui son:

| Elemento | Clases Tailwind (Modo Oscuro) | Descripción |
| :--- | :--- | :--- |
| **Fondo (`background`)** | `bg-zinc-950` (`#09090b`) | Fondo principal profundo y sobrio |
| **Texto Principal (`foreground`)** | `text-zinc-50` (`#fafafa`) | Alto contraste y legibilidad |
| **Tarjetas / Contenedores (`card`)** | `bg-zinc-900/60` o `bg-zinc-900` | Superficies elevadas translúcidas o sólidas |
| **Bordes (`border`)** | `border-zinc-800` (`#27272a`) | Líneas sutiles de 1px |
| **Texto Secundario (`muted`)** | `text-zinc-400` | Etiquetas, descripciones y subtítulos |
| **Elemento Primario (`primary`)** | `bg-white text-zinc-950 hover:bg-zinc-200` | Botón principal de alto impacto |
| **Elemento Secundario (`secondary`)** | `bg-zinc-800 text-zinc-100 hover:bg-zinc-700` | Botones y chips secundarios |
| **Esquinas (`radius`)** | `rounded-xl` (12px) o `rounded-2xl` (16px) | Curvaturas uniformes en toda la UI |

---

## 2. Uso en HTML Standalone (Sin bundler)

Cuando crees un archivo `.html` independiente, incorpora la estética shadcn/ui mediante Tailwind CSS CDN y estilos semánticos:

```html
<!-- En el <head> -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          border: "#27272a",
          background: "#09090b",
          foreground: "#fafafa",
          card: "#18181b",
          muted: "#71717a",
          primary: "#fafafa"
        }
      }
    }
  }
</script>
<body class="bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white min-h-screen">
```

### Componente Card shadcn en HTML:
```html
<div class="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm shadow-sm transition-all hover:border-zinc-700">
  <div class="flex items-center justify-between pb-4">
    <h3 class="text-base font-semibold text-zinc-100 tracking-tight">Título de la Tarjeta</h3>
    <span class="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">Badge</span>
  </div>
  <p class="text-sm text-zinc-400 leading-relaxed">
    Descripción clara y concisa que utiliza los colores de texto secundario y tipografía legible.
  </p>
</div>
```

### Botones shadcn en HTML:
```html
<!-- Primario -->
<button class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 shadow transition-all hover:bg-zinc-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
  Empezar ahora
</button>

<!-- Secundario / Outline -->
<button class="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-transparent px-4 py-2 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-900 active:scale-[0.98]">
  Ver detalles
</button>
```

---

## 3. Uso en Proyectos React / Vite / Next.js

1. **Utilidad `cn()`:** `src/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

2. **Componentes Clave:** Ubicados en `@/components/ui/` (`button.tsx`, `card.tsx`, `dialog.tsx`, `tabs.tsx`, etc.).
3. **Manejo de Variantes:** Usar `class-variance-authority` (`cva`) para estados limpios y tipados.
