# Reglas de Componentes shadcn/ui

- **Ubicación estándar:** Todos los componentes UI reutilizables viven en `src/components/ui/` (ejemplo: `button.tsx`, `card.tsx`, `dialog.tsx`).
- **Función `cn()` obligatoria:** Usar siempre `cn(...)` de `@/lib/utils` (combinando `clsx` y `tailwind-merge`) para mezclar clases fijas con propiedades `className` externas.
- **Variantes con CVA:** Definir variantes visuales claras usando `class-variance-authority` (`cva`).
- **Primitivas accesibles:** Basar componentes complejos en Radix UI (`@radix-ui/react-*`) para garantizar navegación por teclado y soporte de lectores de pantalla (WAI-ARIA).
- **Consistencia de tema:** Utilizar variables CSS semánticas (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-primary`, `text-muted-foreground`) con soporte nativo para dark mode (paleta Zinc / Slate).
