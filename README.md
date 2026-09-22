# TSPPD-H Visualizer & Solver 🚚📦
### Visualización Interactiva del Problema del Viajante de Comercio con Recogidas, Entregas y Costos de Manipulación

[![Vercel Deployment](https://img.shields.io/badge/Demo_Online-tsppd--h--visualizer.vercel.app-000000?style=for-the-badge&logo=vercel)](https://tsppd-h-visualizer.vercel.app/)
[![Paper: Battarra et al. 2010](https://img.shields.io/badge/Paper-Battarra_et_al._2010-blue.svg)](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/papers/battarra2010.pdf)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React_19_+_Vite-61dafb.svg)](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Paginas%20Web/Pagina%20Web%2010)
[![Styling: Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-38bdf8.svg)](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Paginas%20Web/Pagina%20Web%2010)
[![Solver: Gurobi Optimizer](https://img.shields.io/badge/Solver-Gurobi_Python-red.svg)](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/notebooks)
[![Dataset: e__vigo Benchmark](https://img.shields.io/badge/Dataset-e__vigo_Benchmark-orange.svg)](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/e_vigo)

> 🚀 **Demo en Producción (Vercel):**  
> Puedes interactuar directamente con la visualización oficial (**Página Web 10**) sin necesidad de instalar dependencias locales ingresando a:  
> 👉 **[https://tsppd-h-visualizer.vercel.app/](https://tsppd-h-visualizer.vercel.app/)**

---

Este repositorio contiene la formulación matemática, resolución exacta y visualización interactiva paso a paso del **Problema del Viajante de Comercio con Recogidas, Entregas y Costos de Manipulación (TSPPD-H)** (*Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs*).

El proyecto se fundamenta directamente en el artículo seminal:
> **Battarra, R., Erdoğan, G., & Vigo, D. (2010).**  
> *"The Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs."*  
> **Transportation Science**, 44(3), pp. 383–399.  
> Documento PDF disponible en: [`papers/battarra2010.pdf`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/papers/battarra2010.pdf).

---

## 📑 Tabla de Contenidos

1. [Demostración en Línea (Vercel)](#-demostración-en-línea-vercel)
2. [Descripción del Problema (TSPPD-H)](#-descripción-del-problema-tsppd-h)
3. [Modelos y Políticas Implementadas](#-modelos-y-políticas-implementadas)
4. [Instancias y Datos del Paper (`e_vigo`)](#-instancias-y-datos-del-paper-e_vigo)
5. [Solución con Gurobi y Generación de Datos (`notebooks`)](#-solución-con-gurobi-y-generación-de-datos-notebooks)
6. [Visualizador Oficial: Página Web 10](#-visualizador-oficial-página-web-10)
7. [Páginas Web Experimentales (1 al 9 y 11)](#-páginas-web-experimentales-1-al-9-y-11)
8. [Guía de Instalación y Ejecución](#-guía-de-instalación-y-ejecución)
9. [Estructura del Proyecto](#-estructura-del-proyecto)
10. [Referencias](#-referencias)

---

## 🌐 Demostración en Línea (Vercel)

El visualizador está desplegado en Vercel con integración continua y acceso global:

* **URL del Despliegue:** [https://tsppd-h-visualizer.vercel.app/](https://tsppd-h-visualizer.vercel.app/)
* **Contenido Incluido:** Las 40 soluciones precalculadas de `Outputs/` empaquetadas en cliente, selector dinámico de instancias (ID 1 al 10), comparación entre las cuatro variantes (Modelo General, Políticas 1, 2 y 3), visualización LIFO animada y modal de fórmulas matemáticas.

---

## 🧩 Descripción del Problema (TSPPD-H)

En el TSP clásico con recogidas y entregas (TSPPD), un único vehículo con capacidad $Q$ parte del depósito, visita cada cliente exactamente una vez y regresa al depósito:
- Cada cliente $i$ requiere una cantidad $\alpha_i$ de mercancías entregadas desde el depósito (tipo $a$, palets azules).
- Cada cliente $i$ genera una cantidad $\beta_i$ de mercancías que deben ser recogidas y llevadas al depósito (tipo $b$, palets verdes).

### El Desafío de la Carga LIFO y los Costos de Manipulación
El compartimiento del camión es unidimensional (un único pasillo con acceso exclusivamente por la puerta trasera). Cuando un cliente necesita una entrega $\alpha_i$ pero los artículos requeridos están bloqueados al fondo por mercancías ya recogidas ($\beta$), el conductor debe **descargar temporalmente** las mercancías obstructivas, entregar el pedido del cliente y volver a cargar las mercancías retiradas.

Cada movimiento de descarga y recarga genera un **costo de manipulación adicional** ($h$), el cual se suma a la distancia euclidiana de transporte en la función objetivo:
$$\min Z = \text{Distancia Total Recorrida} + \text{Costos de Manipulación}$$

---

## 📐 Modelos y Políticas Implementadas

El proyecto implementa y visualiza con exactitud matemática el modelo general y las tres políticas operativas formuladas en Battarra et al. (2010):

| Modelo / Política | Ecuaciones del Paper | Descripción Operativa en la Bahía de Carga | Script Solver |
| :--- | :--- | :--- | :--- |
| **Modelo General** | Ecs. (1)–(16) | Modela la posición exacta (slot por slot) de cada ítem en el camión. Optimiza globalmente el orden de carga, descarga y reordenamiento. | [`notebooks/tsppd_h_gurobi.py`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/notebooks/tsppd_h_gurobi.py) |
| **Política 1 (TSPPD-H₁)** | Ecs. (17)–(25) | **Patrón $[F, a, \dots, a, b, \dots, b, R]$**: Las mercancías recogidas ($b$) se colocan siempre cerca de la puerta trasera. Al entregar $a$, se deben descargar y recargar todas las $b$ que obstruyen el paso. | [`notebooks/tsppd_h_1_gurobi.py`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/notebooks/tsppd_h_1_gurobi.py) |
| **Política 2 (TSPPD-H₂)** | Ecs. (26)–(30) | **Patrón $[F, b, \dots, b, a, \dots, a, R]$**: En cada cliente con recogida, se descargan temporalmente todas las entregas $a$ a bordo para ubicar las nuevas $b$ en el fondo del camión, volviendo a cargar las $a$. Elimina obstrucciones en entregas posteriores. | [`notebooks/tsppd_h_2_gurobi.py`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/notebooks/tsppd_h_2_gurobi.py) |
| **Política 3 (TSPPD-H₃)** | Ecs. (31)–(48) | **Patrón $[F, b, \dots, a, \dots, b, R]$**: Política híbrida y adaptativa. En cada cliente el conductor decide dinámicamente si aplicar la Política 1 o la Política 2, formando hasta 3 bloques de carga para minimizar manipulaciones innecesarias. | [`notebooks/tsppd_h_3_gurobi.py`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/notebooks/tsppd_h_3_gurobi.py) |

> **Nota:** La formulación matemática detallada de cada política con variables de flujo ($y_{ij}, z_{ij}$), variables de precedencia ($w_{ij}, u_i$) y restricciones de capacidad se encuentra documentada e interactiva dentro del visualizador web en el modal de fórmulas matemáticas.

---

## 📂 Instancias y Datos del Paper (`e_vigo`)

Las instancias de prueba utilizadas corresponden al benchmark estándar de Vigo / Hernández-Pérez & Salazar-González referenciadas en el paper, ubicadas en el directorio [`e_vigo/`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/e_vigo):

- **[`e_vigo/edati.dat`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/e_vigo/edati.dat)**: Contiene los datos nodales de las instancias (identificador, tamaño de clientes $n$, coordenadas cartesianas, demandas de entrega $\alpha_i$ y demandas de recogida $\beta_i$).
- **[`e_vigo/ecosti.dat`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/e_vigo/ecosti.dat)**: Matrices simétricas de costos y distancias euclidianas $c_{ij}$ precalculadas para cada par de nodos.
- **[`Instancias/`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Instancias)**: Instancias formateadas en estándar TSPLIB (`.tsp`) con tamaños de 20, 40, 60, 80 y 100 clientes.
- **[`Instancias Generadas por IA/`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Instancias%20Generadas%20por%20IA)**: Instancias sintéticas adicionales de 2 a 15 clientes para verificación rápida y pruebas de estrés de los modelos.

---

## ⚙️ Solución con Gurobi y Generación de Datos (`notebooks`)

Los scripts en [`notebooks/`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/notebooks) leen los datos de [`e_vigo`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/e_vigo), resuelven los modelos de optimización entera mixta (MIP) con el solver **Gurobi** y generan un archivo JSON estructurado con el desglose paso a paso de cada ruta:

- **Ruta de salida:** [`Outputs/`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Outputs)
- **Contenido del repositorio:** Contiene **40 soluciones óptimas precalculadas** (10 instancias $\times$ 4 formulaciones: General, $H_1$, $H_2$ y $H_3$ para $n=5$ clientes con costo unitario $h=0.1$):
  - `Solucion_5_Clientes_ID[1-10]_H_01.txt` (Modelo General)
  - `Solucion_TSPPD_H1_5_Clientes_ID[1-10]_H_01.txt` (Política 1)
  - `Solucion_TSPPD_H2_5_Clientes_ID[1-10]_H_01.txt` (Política 2)
  - `Solucion_TSPPD_H3_5_Clientes_ID[1-10]_H_01.txt` (Política 3)

Cada solución almacena:
- Secuencia del tour óptimo (`tour: [0, 2, 1, 5, 3, 4, 0]`).
- Distancia euclidiana total y costo acumulado de manipulación ($h \times \text{operaciones}$).
- Estado detallado del compartimiento del camión slot por slot en cada sub-etapa.
- Operaciones exactas de descarga por obstrucción, entrega de demanda, recarga y carga de recogida.

---

## 🖥️ Visualizador Oficial: Página Web 10

La visualización interactiva de referencia y bajo desarrollo activo continuo es **Página Web 10**, ubicada en:
[`Paginas Web/Pagina Web 10`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Paginas%20Web/Pagina%20Web%2010).

Construida con **React 19**, **TypeScript**, **Tailwind CSS v4**, **Motion (Framer Motion)** y **Vite**, ofrece una experiencia visual completa basada en física y diseño anti-slop:

### Características Principales:
1. **Bahía de Carga LIFO Interactiva (`LifoCargoBay.tsx`)**:
   - Visualización esquemática del camión orientada desde la Cabina/Fondo hacia la Puerta trasera.
   - Representación animada de palets individuales ($\alpha$: azul/entrega, $\beta$: esmeralda/recogida).
   - Animación de los movimientos de obstrucción física, retiro temporal al muelle de descarga y posterior recarga.
2. **Desglose de Sub-Pasos Operativos**:
   - Cada parada en un cliente se desglosa en sus eventos atómicos:  
     `Llegada` $\to$ `Descarga de Obstrucción` $\to$ `Entrega de Demanda α` $\to$ `Recarga de Obstrucción` $\to$ `Carga de Recogida β` $\to$ `Listo para Partir`.
3. **Grafo de Ruta Dinámico (`RouteCanvas.tsx`)**:
   - Canvas interactivo con coordenadas exactas de clientes y depósito.
   - Flechas dirigidas que representan los arcos activos del tour y camión animado que viaja de nodo a nodo en sincronía con el reproductor.
4. **Controles de Reproducción Multimedia (`PlaybackControls.tsx`)**:
   - Reproducción automática con velocidad graduable (0.5x, 1x, 2x, 5x).
   - Salto hacia adelante/atrás por cliente completo o por sub-paso unitario.
5. **Selector de Soluciones (`SolutionSelectorModal.tsx`)**:
   - Catálogo integrado para cambiar instantáneamente entre cualquiera de las 40 soluciones disponibles en `Outputs/`.
   - Filtros por ID de instancia y por política ($H_1$, $H_2$, $H_3$, General).
6. **Formulaciones Matemáticas en Notación KaTeX (`ModelFormulaModal.tsx`)**:
   - Modal interactivo con las fórmulas completas de cada modelo según el paper de Battarra (2010).
7. **Despliegue y Portabilidad**:
   - **En Vercel (Producción):** [https://tsppd-h-visualizer.vercel.app/](https://tsppd-h-visualizer.vercel.app/)
   - **Local Autónomo:** `bundle-solutions.js` pre-empaqueta las 40 soluciones en `defaultSolutions.ts`, permitiendo ejecutar la app sin backend activo.
   - **Local Dinámico:** Servidor Express [`server.js`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Paginas%20Web/Pagina%20Web%2010/server.js) para recargar dinámicamente nuevas ejecuciones de Gurobi.

---

## 🧪 Páginas Web Experimentales (1 al 9 y 11)

Dentro del directorio [`Paginas Web/`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Paginas%20Web) se encuentran diversas versiones anteriores (`Pagina Web 1` a `Pagina Web 9`, así como `Pagina Web 11`):

- **Propósito experimental:** Estas páginas fueron desarrolladas como bancos de prueba iterativos para contrastar las capacidades de diferentes modelos fundacionales de Inteligencia Artificial (tales como *Nemotron 3 Ultra*, *Muse Park 1.2*, familias *Claude* y *GPT*) en la generación de arquitecturas frontend, algoritmos de renderizado SVG/Canvas y modelado de animaciones LIFO.
- **Evolución del proyecto:** Cada página experimental aportó lecciones en la representación de la bahía de carga, el manejo de sub-pasos y el acoplamiento con los archivos de salida, culminando en la consolidación definitiva de todas las mejores prácticas en la **Página Web 10**.

---

## 🚀 Guía de Instalación y Ejecución

### Opción 0: Acceso Directo en Línea (Recomendado)
Para explorar la aplicación inmediatamente sin instalar nada:  
👉 **[Abrir en Vercel: tsppd-h-visualizer.vercel.app](https://tsppd-h-visualizer.vercel.app/)**

---

### Opción A: Ejecución Local de la Visualización (Página Web 10)

#### Prerrequisitos
- **Node.js** v18 o superior y **npm** v9+.

#### En macOS / Linux:
```bash
# Otorgar permisos de ejecución si es necesario
chmod +x "Paginas Web/Iniciar_Pagina_10.sh"

# Iniciar el script automático
./"Paginas Web/Iniciar_Pagina_10.sh"
```
O directamente desde la consola:
```bash
cd "Paginas Web/Pagina Web 10"
npm install
npm run dev
```
La aplicación se abrirá en `http://localhost:3010`.

#### En Windows:
1. Doble clic en [`Iniciar_Paginas_Web.bat`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Iniciar_Paginas_Web.bat) en la raíz, o bien:
2. Doble clic en [`Paginas Web/Iniciar_Pagina_10.bat`](file:///Users/carrascote/Documents/matirocha/TSPPD-H%20Visualizer/Paginas%20Web/Iniciar_Pagina_10.bat).

---

### Opción B: Resolver Nuevas Instancias con Gurobi

#### Prerrequisitos
- **Python 3.10+** y licencia de **Gurobi Optimizer** (`gurobipy`).

1. Activa tu entorno virtual con Gurobi:
   ```bash
   source .venv/bin/activate   # En macOS/Linux
   # o en Windows: .venv\Scripts\activate
   ```
2. Ejecuta cualquiera de los solvers:
   ```bash
   # Resolver con Política 1 (TSPPD-H1)
   python notebooks/tsppd_h_1_gurobi.py

   # Resolver con Política 2 (TSPPD-H2)
   python notebooks/tsppd_h_2_gurobi.py

   # Resolver con Política 3 (TSPPD-H3)
   python notebooks/tsppd_h_3_gurobi.py

   # Resolver Modelo General
   python notebooks/tsppd_h_gurobi.py
   ```
3. Los resultados se guardarán automáticamente en `Outputs/`. Para sincronizar las soluciones empaquetadas con el visualizador:
   ```bash
   cd "Paginas Web/Pagina Web 10"
   node bundle-solutions.js
   ```

---

## 📁 Estructura del Proyecto

```plaintext
TSPPD-H Visualizer/
├── README.md                      # Documentación integral del proyecto
├── AGENTS.md                      # Directrices de desarrollo y reglas de ingeniería UI
├── Iniciar_Paginas_Web.bat        # Lanzador rápido para Windows
│
├── papers/                        # Artículos de investigación y marco teórico
│   ├── battarra2010.pdf           # Paper base (Battarra, Erdoğan & Vigo, 2010)
│   └── Thesis_Rey.pdf             # Tesis complementaria de referencia
│
├── e_vigo/                        # Benchmark oficial del paper
│   ├── edati.dat                  # Demandas alpha/beta y coordenadas de clientes
│   └── ecosti.dat                 # Matriz de distancias y costos de transporte
│
├── Instancias/                    # Instancias del problema en formato TSPLIB (.tsp)
├── Instancias Generadas por IA/   # Instancias sintéticas complementarias (2 a 15 clientes)
│
├── notebooks/                     # Solvers matemáticos en Python con Gurobi
│   ├── tsppd_h_gurobi.py          # Formulación Modelo General (Ecs. 1-16)
│   ├── tsppd_h_1_gurobi.py        # Formulación Política 1 (Ecs. 17-25)
│   ├── tsppd_h_2_gurobi.py        # Formulación Política 2 (Ecs. 26-30)
│   ├── tsppd_h_3_gurobi.py        # Formulación Política 3 (Ecs. 31-48)
│   ├── solve_for_html.py          # Utilidad para exportar soluciones a formato JSON
│   └── main.py                    # Script general de pruebas de optimización
│
├── Outputs/                       # 40 Soluciones generadas (JSON/TXT) para visualización
│   ├── Solucion_5_Clientes_ID1_H_01.txt ... ID10 (General)
│   ├── Solucion_TSPPD_H1_5_Clientes_ID1_H_01.txt ... ID10 (Política 1)
│   ├── Solucion_TSPPD_H2_5_Clientes_ID1_H_01.txt ... ID10 (Política 2)
│   └── Solucion_TSPPD_H3_5_Clientes_ID1_H_01.txt ... ID10 (Política 3)
│
├── Paginas Web/                   # Entornos de visualización web
│   ├── Iniciar_Pagina_10.sh       # Script de lanzamiento para macOS/Linux
│   ├── Iniciar_Pagina_10.bat      # Script de lanzamiento para Windows
│   │
│   ├── Pagina Web 10/             # 🌟 VISUALIZADOR OFICIAL (Desplegado en Vercel)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── LifoCargoBay.tsx        # Bahía de carga del camión animada
│   │   │   │   ├── RouteCanvas.tsx         # Mapa y grafo del tour
│   │   │   │   ├── PlaybackControls.tsx    # Controles de reproducción paso a paso
│   │   │   │   ├── ModelFormulaModal.tsx   # Visualizador de ecuaciones matemáticas
│   │   │   │   ├── SolutionSelectorModal.tsx # Catálogo de soluciones
│   │   │   │   ├── MetricsOverview.tsx     # Métricas y costos Z, distancias y h
│   │   │   │   └── StepExplanation.tsx     # Explicación textual del evento actual
│   │   │   ├── types/                      # Definiciones TypeScript de soluciones
│   │   │   └── lib/                        # Soluciones empaquetadas y utilidades
│   │   ├── server.js              # Servidor API Express (puerto 3010)
│   │   ├── bundle-solutions.js    # Empaquetador estático de Outputs
│   │   ├── package.json           # Dependencias (React 19, Tailwind v4, Vite, Motion)
│   │   ├── vercel.json            # Configuración para despliegue en Vercel
│   │   └── vite.config.ts         # Configuración Vite con middleware API
│   │
│   └── Pagina Web [1-9, 11]/      # Prototipos experimentales previos con distintos modelos de IA
│
└── Visualizaciones HTML/          # Plantillas HTML standalone previas
```

---

## 📚 Referencias

- **Battarra, R., Erdoğan, G., & Vigo, D. (2010).** *The Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs.* Transportation Science, 44(3), 383–399. [doi:10.1287/trsc.1090.0305](https://doi.org/10.1287/trsc.1090.0305)
- **Hernández-Pérez, H., & Salazar-González, J. J. (2004).** *A branch-and-cut algorithm for a traveling salesman problem with pickup and delivery.* Discrete Applied Mathematics, 145(1), 126–139.
- **Carrabs, F., Cordeau, J. F., & Laporte, G. (2007).** *Variable neighborhood search for the pickup and delivery traveling salesman problem with LIFO loading.* INFORMS Journal on Computing, 19(4), 618–632.
