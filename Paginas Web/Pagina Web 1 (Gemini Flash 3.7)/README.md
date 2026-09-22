# Visualizador Interactivo TSPPD-H (Travelling Salesperson Problem with Pickup & Delivery with Handling Costs)

Aplicación Web interactiva construida con **Node.js, React, Vite, TypeScript, Tailwind CSS y Motion** para visualizar y analizar las soluciones óptimas generadas por **Gurobi** en Python.

---

## 🚀 Características Principales

1. **Selector Dinámico de Soluciones (`Outputs/`):**
   - Detecta y lista automáticamente todos los archivos `.txt` generados en la carpeta `Outputs/`.
   - Permite alternar instantáneamente entre instancias (ej: Instancias ID 1 a 10 con 5 clientes).
   - Soporte para arrastrar y soltar (*drag & drop*) o subir archivos `.txt` personalizados.

2. **Simulador y Animación de Ruta (Canvas):**
   - Grafo topológico con nodos diferenciados: **Depósito** (Ámbar) y **Clientes** (Azul/Cian con demandas $\alpha$ y $\beta$).
   - Animación fluida y precisa del camión (`🚛`) recorriendo los arcos óptimos con interpolación suave.
   - Indicadores de distancia por tramo, flechas de sentido de giro y partículas animadas de entrega ($\downarrow\alpha$) y recolección ($\uparrow\beta$).

3. **Compartimiento de Carga y Animación LIFO (Handling):**
   - Visualización espacial del compartimiento de carga (Frente $\leftrightarrow$ Puerta Trasera).
   - Muestra cada posición $k \in \{1 \dots Q\}$ con mercancías tipo $\alpha$ (entrega) y $\beta$ (recolección).
   - **Alerta e Inspección Dinámica de Handling:** Muestra cuándo y por qué las unidades $\beta$ obstruyen la salida de las unidades $\alpha$, calculando el costo de remoción y recarga temporal.

4. **Controles Multimedia y Reproductor Paso a Paso:**
   - Botones de Inicio, Anterior, Play/Pausa, Siguiente y Fin.
   - Selector de velocidad (0.5x, 1x, 1.5x, 2x, 3x).
   - **Atajos de teclado:**
     - `Espacio` o `K`: Play / Pausa
     - `→` o `L`: Siguiente paso
     - `←` o `J`: Paso anterior
     - `Home`: Inicio
     - `End`: Final

5. **Explicación Logística y Desglose Matemático:**
   - Explicación contextual de cada paso en lenguaje natural.
   - Desglose de la Función Objetivo: $z = z_R + z_H = \sum c_{ij}x_{ij} + (\sum v_i^k - \sum h_a \alpha_i)$ con barra de proporción Ruteo vs Manipulación.

---

## 🛠️ Cómo Ejecutar el Proyecto

### 1. Iniciar el Servidor de Desarrollo (Vite + API Integrada)
```bash
cd "Paginas Web"
npm run dev
```
Abre en tu navegador: **`http://localhost:5173`**

### 2. O Iniciar con Servidor Node.js Express (Producción)
```bash
cd "Paginas Web"
npm run build
node server.js
```
Abre en tu navegador: **`http://localhost:3000`**

---

## 🐍 Generación de Nuevas Soluciones en Python

Para resolver y guardar nuevas soluciones en `Outputs/`:
```bash
# Resolver todas las instancias de 1 a 10 para 5 clientes:
python "Testeando Modelo con Papers\tsppd_h_gurobi.py" --all-ids

# Resolver una instancia específica (ej: ID 3, 5 clientes, h=0.2):
python "Testeando Modelo con Papers\tsppd_h_gurobi.py" --id 3 --customers 5 --h 0.2
```
