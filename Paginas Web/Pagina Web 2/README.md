# TSPPD-H Visualizer (Página Web 2)

Aplicación web moderna y reactiva construida con **Node.js, Express, React 19, Vite, TypeScript, Tailwind CSS v4, Motion y Lucide Icons** para visualizar, analizar y simular las soluciones óptimas del problema **TSPPD-H** (Traveling Salesman Problem with Pickup and Delivery and Handling Operations bajo política LIFO).

---

## 🚀 Características Principales

1. **Lectura Dinámica de Soluciones:**
   - Lee automáticamente todos los archivos `.txt` / `.json` generados por Gurobi en la carpeta `Outputs/`.
   - Selector interactivo en el encabezado con búsqueda rápida e información de cada instancia (ID, clientes, costo objetivo, etc.).

2. **Mapa Interactivo y Animación del Camión:**
   - Algoritmo de posicionamiento 2D basado en **Multidimensional Scaling (MDS)** para proyectar los nodos respetando las distancias reales de la matriz de costos ($c_{ij}$).
   - Alternancia instantánea entre modo MDS y modo Circular regular.
   - Camión animado con rotación vectorial continua en la dirección de desplazamiento y estela luminosa.
   - Resaltado de nodos visitados, nodo destino activo con anillo de pulso, arcos recorridos y distancias en cada tramo.

3. **Bahía de Carga y Simulación LIFO:**
   - Visualización esquemática del compartimento del camión con sus $Q$ slots numerados desde la puerta trasera (LIFO) hasta el fondo.
   - Código de colores:
     - **$\alpha$ (Rosa / Rojo):** Mercancía a entregar desde el depósito.
     - **$\beta$ (Cian / Azul):** Mercancía recolectada de los clientes para el depósito.
     - **Vacío (Zinc):** Slots disponibles.
   - **Animaciones automáticas al llegar al nodo:**
     - **Descarga de $\alpha$:** Los paquetes destinados al cliente salen del camión.
     - **Manipulación / Handling:** Si mercancías $\beta$ bloquean el acceso LIFO, se resalta el conflicto y se muestra la reubicación temporal con su costo $h \cdot \text{operaciones}$.
     - **Carga de $\beta$:** La mercancía recolectada ingresa a los slots disponibles.
   - Inspector de slots individuales al hacer clic en cualquier posición.

4. **Controles de Reproducción y Navegación:**
   - Botones Play/Pausa, Paso Anterior, Paso Siguiente y Reinicio.
   - Scrubber / línea de tiempo interactiva de pasos con indicadores de progreso porcentual del arco.
   - Selector de velocidad (0.5x, 1x, 1.5x, 2x, 3x).

5. **Explicaciones Paso a Paso y Métricas:**
   - Panel de narrativa en lenguaje natural para cada paso de la ruta.
   - Resumen Bento Grid con valor de la Función Objetivo ($Z^*$), costo de ruteo, costo de handling, utilización del camión y tour completo.
   - Modal de la **Matriz de Costos y Distancias** con arcos óptimos destacados.
   - Modal de la **Formulación Matemática del TSPPD-H** (Ecuaciones 1 a 16).
   - Modal de inspección de detalles de cada cliente al hacer clic en los nodos.

---

## 🛠️ Cómo Ejecutar la Aplicación

### Opción 1: Servidor Node.js Completo (Frontend + Backend)
```bash
cd "Paginas Web/Pagina Web 2"
node server.js
```
Abre en tu navegador: **`http://localhost:3001`**

### Opción 2: Modo Desarrollo con Vite (HMR)
En una terminal:
```bash
cd "Paginas Web/Pagina Web 2"
node server.js
```
En otra terminal:
```bash
cd "Paginas Web/Pagina Web 2"
npm run dev
```
Abre en tu navegador: **`http://localhost:5174`**
