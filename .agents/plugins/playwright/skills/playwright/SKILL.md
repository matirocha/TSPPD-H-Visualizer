---
name: playwright
description: Automatiza navegadores web, toma capturas de pantalla, prueba responsividad móvil/escritorio y realiza pruebas E2E con Playwright CLI.
---

# Guía de Playwright CLI para Agentes de IA

Playwright CLI de Microsoft permite controlar navegadores reales para auditar y probar aplicaciones web desarrolladas localmente o en producción.

## 1. Comandos Principales de Playwright CLI

### A. Tomar Capturas de Pantalla de la Interfaz
```bash
# Captura de pantalla de la web en ejecución local
npx playwright screenshot http://localhost:5173 screenshot-desktop.png

# Captura en modo página completa
npx playwright screenshot --full-page http://localhost:5173 screenshot-full.png

# Emulación de pantalla móvil (iPhone 13 / Android)
npx playwright screenshot --device="iPhone 13" http://localhost:5173 screenshot-mobile.png
```

### B. Abrir y Navegar en la Web
```bash
# Abrir el navegador en una URL específica
npx playwright open http://localhost:5173
```

### C. Generar Código de Pruebas Automáticas (Codegen)
```bash
# Graba las interacciones del usuario en el navegador y genera el test en TypeScript
npx playwright codegen http://localhost:5173
```

## 2. Flujo de Auditoría Visual en Desarrollo
1. Iniciar el servidor local (`npm run dev`).
2. Ejecutar `npx playwright screenshot` para capturar el estado visual.
3. Analizar la captura para asegurar que no existan desbordamientos de texto, cortes en botones o problemas de contraste.
