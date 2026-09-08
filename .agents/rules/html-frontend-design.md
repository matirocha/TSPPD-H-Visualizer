# Guía y Reglas Detalladas: Generación de HTML con Tasteskill + shadcn/ui + Framer Motion + 21st.dev

Este documento establece el estándar de implementación técnica para cualquier archivo HTML generado en el proyecto.

## 1. Integración de Dependencias CDN Recomendadas
Para archivos `.html` autónomos, usar:
- **Tailwind CSS:** `https://cdn.tailwindcss.com`
- **Tipografía:** Geist o Inter desde Google Fonts (`family=Geist:wght@300;400;500;600;700`)
- **Lucide Icons:** `https://unpkg.com/lucide@latest`
- **Motion (Framer Motion Engine):** `https://cdn.jsdelivr.net/npm/motion@latest/dist/motion.js`

## 2. Check-list de Verificación Pre-Entrega (Pre-Flight Check)
- [ ] ¿El fondo principal es oscuro sobrio (`#09090b` / `bg-zinc-950`) o el tema solicitado, sin fondos grises opacos sin contraste?
- [ ] ¿Los botones tienen feedback táctil (`active:scale-[0.98]`) y contraste WCAG AA?
- [ ] ¿Las tarjetas usan bordes sutiles de 1px (`border-zinc-800`) y radios redondeados modernos (`rounded-xl` o `rounded-2xl`)?
- [ ] ¿Se evitó el diseño genérico de 3 tarjetas idénticas en favor de un layout con jerarquía o Bento Grid?
- [ ] ¿Hay animaciones suaves de entrada escalonada y microinteracciones en hover?
- [ ] ¿Se incluyen efectos prémium de 21st.dev como Spotlight o Aurora de fondo?
