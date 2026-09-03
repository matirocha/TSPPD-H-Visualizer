---
name: shadcn-ui
description: Guía y recetas de implementación de componentes shadcn/ui con Tailwind CSS, Radix UI y la utilidad cn.
---

# Guía de Arquitectura shadcn/ui

shadcn/ui es un sistema de componentes modular donde el código fuente vive dentro de tu propio proyecto en `src/components/ui/`.

## 1. Utilidad Base `src/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## 2. Estructura de Componente con `cva` (`src/components/ui/button.tsx`)
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-white text-zinc-950 shadow hover:bg-zinc-200",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-100",
        secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        ghost: "hover:bg-zinc-800 text-zinc-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
)
```

## 3. Catálogo de Componentes Clave
- `Button` (`@/components/ui/button`)
- `Card`, `CardHeader`, `CardTitle`, `CardContent` (`@/components/ui/card`)
- `Dialog`, `DialogContent`, `DialogHeader` (Modales)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (Pestañas)
- `Input`, `Label` (Formularios accesibles)
- `Sheet` (Paneles laterales deslizables)
- `Badge` (Etiquetas de estado)
