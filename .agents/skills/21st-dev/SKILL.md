---
name: 21st-dev
description: Catálogo de patrones de Design Engineering y componentes prémium inspirados en 21st.dev (Spotlight cards, Bento Grids asimétricas, Aurora mesh gradients y microinteracciones).
---

# Guía de Patrones 21st.dev (React & HTML)

21st.dev recopila los componentes de mayor calidad visual en la comunidad moderna de frontend.

---

## 1. Patrón 1: Spotlight Card (Resplandor al Cursor)

Una tarjeta que reacciona a la posición del puntero del ratón iluminando sutilmente el borde y la superficie con un gradiente radial.

### Implementación en HTML Standalone (Vanilla JS + Tailwind):
```html
<div class="spotlight-card relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-7 shadow-xl">
  <!-- Capa de resplandor (oculta por defecto, se ilumina al pasar el ratón) -->
  <div class="spotlight-glow pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"></div>

  <!-- Contenido -->
  <div class="relative z-10">
    <div class="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 mb-4 border border-zinc-700/60">
      <i data-lucide="sparkles" class="w-5 h-5"></i>
    </div>
    <h3 class="text-lg font-semibold text-white tracking-tight">Spotlight Elegante</h3>
    <p class="text-sm text-zinc-400 mt-2 leading-relaxed">
      Efecto de resplandor dinámico que sigue las coordenadas del cursor del usuario.
    </p>
  </div>
</div>

<script>
  document.querySelectorAll('.spotlight-card').forEach(card => {
    const glow = card.querySelector('.spotlight-glow');
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glow.style.opacity = '1';
      glow.style.background = `radial-gradient(400px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.08), transparent 70%)`;
    });
    card.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });
  });
</script>
```

---

## 2. Patrón 2: Bento Grid Asimétrica

Disposición de celdas con ritmos variados:
```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
  <!-- Celda Grande (2 Columnas) -->
  <div class="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 flex flex-col justify-between">
    <div>
      <span class="text-xs uppercase tracking-wider text-emerald-400 font-mono">Destacado</span>
      <h3 class="text-2xl font-bold text-white mt-2">Visibilidad Total del Sistema</h3>
      <p class="text-zinc-400 text-sm mt-2 max-w-md">Monitoreo y análisis en tiempo real con latencia inferior a 5ms.</p>
    </div>
    <div class="mt-6 h-32 rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-4 flex items-center justify-center text-zinc-500 text-xs font-mono">
      [Visualización Métrica / Gráfico]
    </div>
  </div>

  <!-- Celda Compacta (1 Columna) -->
  <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 flex flex-col justify-between">
    <div>
      <span class="text-xs uppercase tracking-wider text-blue-400 font-mono">Seguridad</span>
      <h3 class="text-xl font-bold text-white mt-2">Cifrado de Extremo a Extremo</h3>
      <p class="text-zinc-400 text-sm mt-2">Protección criptográfica nativa para cada instancia.</p>
    </div>
  </div>
</div>
```

---

## 3. Patrón 3: Fondo Aurora Mesh (Atmósfera Sutil)

```html
<div class="relative overflow-hidden bg-zinc-950">
  <!-- Manchas difuminadas de iluminación ambiental -->
  <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-emerald-500/10 blur-[120px] pointer-events-none rounded-full"></div>
  
  <!-- Contenido sobre el fondo -->
  <div class="relative z-10">...</div>
</div>
```
