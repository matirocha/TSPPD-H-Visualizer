# Reglas de Componentes 21st.dev & Design Engineering

- **Uso de Bloques Prémium:** Cuando el usuario solicite interfaces de alto impacto visual, aprovechar los patrones de 21st.dev (tarjetas spotlight, fondos de aurora, textos cinéticos, grids bento interactivos).
- **Compatibilidad con shadcn:** Todos los componentes de 21st.dev deben integrarse armónicamente con los tokens de color y la estructura de `src/components/ui/`.
- **Micro-interacciones y Shaders:** Implementar efectos de seguimiento de cursor con `useMotionValue` y `useTransform` de Motion en lugar de listeners de mouse que re-rendericen todo el árbol de React.
- **Herramienta CLI:** Se puede buscar e instalar componentes mediante `@21st-dev/cli` (`npx @21st-dev/cli search "<query>"` o `npx @21st-dev/cli add <autor>/<slug>`).
