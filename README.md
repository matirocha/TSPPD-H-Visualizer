# TSPPD-H Visualizer 🚚📦
### Visualización Interactiva del Problema del Viajante de Comercio con Recogidas, Entregas y Costos de Manipulación

[![Vercel Deployment](https://img.shields.io/badge/Demo_Online-tsppd--h--visualizer.vercel.app-000000?style=for-the-badge&logo=vercel)](https://tsppd-h-visualizer.vercel.app/)
[![Paper: Battarra et al. 2010](https://img.shields.io/badge/Paper-Battarra_et_al._2010-blue.svg)](papers/battarra2010.pdf)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React_19_+_Vite-61dafb.svg)](Paginas%20Web/Pagina%20Web%2010%20%28Gemini%203.8%20Flash%29)
[![Styling: Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-38bdf8.svg)](Paginas%20Web/Pagina%20Web%2012%20%28Opus%205.5%29)
[![Solver: Gurobi Optimizer](https://img.shields.io/badge/Solver-Gurobi_Python-red.svg)](notebooks)
[![Dataset: e_vigo](https://img.shields.io/badge/Dataset-e__vigo_(Gendreau_et_al._1999)-orange.svg)](e_vigo)

> 🚀 **Demo en Producción (Vercel):**  
> Puedes interactuar directamente con la visualización oficial (**Página Web 10**) sin necesidad de instalar dependencias locales ingresando a:  
> 👉 **[https://tsppd-h-visualizer.vercel.app/](https://tsppd-h-visualizer.vercel.app/)**

---

Este repositorio contiene la formulación matemática, resolución exacta y visualización interactiva paso a paso del **Problema del Viajante de Comercio con Recogidas, Entregas y Costos de Manipulación (TSPPD-H)** (*Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs*).

El proyecto se fundamenta directamente en el artículo que define el problema:
> **Battarra, M., Erdoğan, G., Laporte, G., & Vigo, D. (2010).**  
> *"The Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs."*  
> **Transportation Science**, 44(3), pp. 383–399. [doi:10.1287/trsc.1100.0316](https://doi.org/10.1287/trsc.1100.0316)  
> Documento PDF disponible en: [`papers/battarra2010.pdf`](papers/battarra2010.pdf).

---

## 📑 Tabla de Contenidos

1. [Demostración en Línea (Vercel)](#-demostración-en-línea-vercel)
2. [Descripción del Problema (TSPPD-H)](#-descripción-del-problema-tsppd-h)
3. [Modelos y Políticas Implementadas](#-modelos-y-políticas-implementadas)
4. [Instancias y Datos del Paper (`e_vigo`)](#-instancias-y-datos-del-paper-e_vigo)
5. [Solución con Gurobi y Generación de Datos (`notebooks`)](#-solución-con-gurobi-y-generación-de-datos-notebooks)
6. [Visualizador Oficial: Página Web 10](#-visualizador-oficial-página-web-10)
7. [Página Web 12 (Opus 5.5): Laboratorio LIFO](#-página-web-12-opus-55-laboratorio-lifo)
8. [Todas las Páginas Web (1 a 12)](#-todas-las-páginas-web-1-a-12)
9. [Guía de Instalación y Ejecución](#-guía-de-instalación-y-ejecución)
10. [Estructura del Proyecto](#-estructura-del-proyecto)
11. [Referencias](#-referencias)

---

## 🌐 Demostración en Línea (Vercel)

La Página Web 10 está desplegada en Vercel (la pestaña del navegador muestra «Página Web 9» porque el `<title>` de su `index.html` no se actualizó):

* **URL del Despliegue:** [https://tsppd-h-visualizer.vercel.app/](https://tsppd-h-visualizer.vercel.app/)
* **Contenido Incluido:** las 80 soluciones precalculadas de `Outputs/` empaquetadas en el cliente (10 instancias × 4 formulaciones × 5 y 10 clientes), selector de 5 o 10 clientes con las instancias ID 1 a 10, alternancia entre las cuatro variantes (Modelo General, Políticas 1, 2 y 3) desde la cabecera, compartimiento LIFO animado y mapa de ruta.

---

## 🧩 Descripción del Problema (TSPPD-H)

En el TSP con recogidas y entregas (TSPPD; en el paper, SVPDP–P&D *one-to-many-to-one*), un único vehículo con capacidad $Q$ parte del depósito, visita cada cliente exactamente una vez y regresa al depósito:
- Cada cliente $i$ requiere $\alpha_i$ unidades de la mercancía $a$ (entregas que salen del depósito).
- Cada cliente $i$ entrega $\beta_i$ unidades de la mercancía $b$ (recogidas que vuelven al depósito).

### El Desafío de la Carga LIFO y los Costos de Manipulación
El compartimiento del camión es unidimensional y se carga por la puerta trasera, siguiendo una política LIFO (lo último en entrar es lo primero en salir). Cuando un cliente necesita una entrega $\alpha_i$, pero las unidades requeridas están bloqueadas por mercancías $b$ ya recogidas, el conductor debe **descargar temporalmente** las mercancías que obstruyen, entregar el pedido y volver a cargar lo retirado.

El paper llama **operación adicional** a descargar y volver a cargar una unidad en un cliente; su costo es $h_a$ para la mercancía $a$ y $h_b$ para la $b$. La descarga de las $\alpha_i$ y la carga de las $\beta_i$ propias de cada cliente no se cobran. En los experimentos del paper (§5) y en este proyecto $h_a = h_b = h$, y todas las soluciones incluidas usan $h = 0{,}1$. El objetivo minimiza el costo de viaje más el de manipulación:
$$\min Z = \sum_{(i,j)} c_{ij}\,x_{ij} + \text{Costo de Manipulación}$$
donde $c_{ij}$ es el costo de viaje entre nodos (en las instancias, distancias euclidianas enteras y simétricas).

---

## 📐 Modelos y Políticas Implementadas

El proyecto implementa y visualiza el modelo general y las tres políticas operativas formuladas en Battarra et al. (2010). En los patrones, $F$ es el frente del camión (cabina) y $R$ la parte trasera (puerta):

| Modelo / Política | Ecuaciones del Paper | Descripción Operativa en la Bahía de Carga | Script Solver |
| :--- | :--- | :--- | :--- |
| **Modelo General** | Ecs. (1)–(16) | Modela la posición exacta (slot por slot) de cada ítem en el camión. Optimiza globalmente el orden de carga, descarga y reordenamiento. | [`notebooks/tsppd_h_gurobi.py`](notebooks/tsppd_h_gurobi.py) |
| **Política 1 (TSPPD-H₁)** | Ecs. (17)–(25) | **Patrón $[F, a, \dots, a, b, \dots, b, R]$**: las mercancías recogidas ($b$) se colocan siempre cerca de la puerta trasera. En cada cliente con entrega se descargan y recargan todas las $b$ que obstruyen el paso. | [`notebooks/tsppd_h_1_gurobi.py`](notebooks/tsppd_h_1_gurobi.py) |
| **Política 2 (TSPPD-H₂)** | Ecs. (26)–(27) | **Patrón $[F, b, \dots, b, a, \dots, a, R]$**: en cada cliente con recogida se descargan temporalmente todas las entregas $a$ a bordo para ubicar las nuevas $b$ al fondo del camión, y luego se recargan las $a$. Así no hay obstrucciones en las entregas posteriores. El modelo es el objetivo (26) con las restricciones (18)–(25). Las Ecs. (28)–(30) (Proposiciones 1 y 2) muestran que, con distancias simétricas, su óptimo se obtiene invirtiendo el tour óptimo de la Política 1 en la instancia con $\alpha_i \leftrightarrow \beta_i$ y $h_a \leftrightarrow h_b$ intercambiados. | [`notebooks/tsppd_h_2_gurobi.py`](notebooks/tsppd_h_2_gurobi.py) |
| **Política 3 (TSPPD-H₃)** | Ecs. (31)–(48) | **Patrón $[F, b, \dots, b, a, \dots, a, b, \dots, b, R]$**: política híbrida. En cada cliente $i$ el modelo elige, junto con la ruta, la Política 1 ($s_i = 1$: las $b$ quedan atrás) o la Política 2 ($s_i = 0$: las $b$ van al frente tras descargar todas las $a$). La carga puede formar hasta 3 bloques: $b$ al frente, $a$ al medio y $b$ atrás. | [`notebooks/tsppd_h_3_gurobi.py`](notebooks/tsppd_h_3_gurobi.py) |

> **Nota:** todas las formulaciones usan variables de ruta $x_{ij}$. El Modelo General usa además variables binarias de posición $a^k_{ij}$ y $b^k_{ij}$ (mercancía $a$ o $b$ en la posición $k$ al recorrer $(i,j)$), $r^k_i$ (la posición $k$ se manipula en $i$) y $v^k_i$ (costo de manipulación). Las políticas usan variables de flujo: $y_{ij}$ (unidades $a$ a bordo en el arco $(i,j)$), $z_{ij}$ (unidades $b$ a bordo; en la Política 3, las del bloque trasero) y, en la Política 3, $w_{ij}$ (unidades $b$ del bloque frontal), la decisión binaria $s_i$ y las variables de costo $p_i, q_i$. Los scripts de Gurobi reemplazan las restricciones de eliminación de subtours del paper por restricciones MTZ con variables de orden $u_i$. La **Página Web 12** presenta las formulaciones completas en notación KaTeX, en su sección «Modelo».

**Validación:** los valores objetivo de las 80 soluciones de `Outputs/` coinciden con la Tabla 2 del paper ($h = 0{,}1$, con 5 y 10 clientes):
- Las Políticas 1, 2 y 3 coinciden con la columna $z^*$ de cada política.
- El Modelo General coincide con la columna $z^*$ del enfoque *Two-phase*. Ese enfoque es una heurística: toma el tour de ruteo mínimo y le aplica la manipulación óptima de Aslidis. El paper no resuelve el modelo (1)–(16) de forma exacta.
- En 3 instancias de 5 clientes (ID 5, 8 y 10) el total coincide, pero la manipulación del Modelo General (1,3; 0,6; 1,7) es menor que el $z^*_H$ publicado (2,7; 0,9; 1,9).

---

## 📂 Instancias y Datos del Paper (`e_vigo`)

Como en el paper (§5), las instancias son una adaptación al TSPPD-H de las instancias euclidianas que **Gendreau, Laporte y Vigo (1999)** propusieron para el TSP con recogidas y entregas. Están disponibles en el sitio de H. Hernández-Pérez y se ubican en el directorio [`e_vigo/`](e_vigo):

- **[`e_vigo/edati.dat`](e_vigo/edati.dat)**: 300 bloques de demandas originales $p_i$ (5 variantes × $n \in \{25, 50, 75, 100, 150, 200\}$ × ID 1 a 10). Cada bloque tiene una cabecera `<variante> <n> <ID> <máx. suma>` (el cuarto número es la mayor de las sumas de los dos vectores) y dos vectores de $n$ enteros. **No contiene coordenadas.**
- **[`e_vigo/ecosti.dat`](e_vigo/ecosti.dat)**: 60 matrices de costos $c_{ij}$ enteras y simétricas de $(n+1) \times (n+1)$ (depósito más clientes), con 10000000 en la diagonal.
- **Derivación de α y β** (Ec. 79 del paper, aplicada igual en los cuatro solvers): se usan los 10 bloques de 50 clientes de la variante `0.` (ID 1 a 10; sus dos vectores son idénticos y se toma el primero como $p_i$) y sus primeros $n$ clientes, con $p'_i = \max\{1, p_i \bmod 20\}$, $\beta_i = \lfloor p'_i\,(i \bmod 5)/5 \rfloor$, $\alpha_i = p'_i - \beta_i$ y $Q = \max\{\sum \alpha_i, \sum \beta_i\}$.
- **[`Instancias/`](Instancias)**: 49 instancias en formato tipo TSPLIB (`.tsp`, `TYPE: TSPDC`, matriz explícita y `DEMAND_SECTION` con entrega y recogida), nombradas `2_<n>_<ID>.tsp`, con $n$ = 20, 40, 60 y 80 (ID 1 a 10) y $n$ = 100 (ID 1 a 9).
- **[`Instancias Generadas por IA/`](Instancias%20Generadas%20por%20IA)**: 14 instancias sintéticas (`IA_02_clientes.tsp` a `IA_15_clientes.tsp`, de 2 a 15 clientes) en el mismo formato, para verificación rápida.

---

## 🔧 Solución con Gurobi y Generación de Datos (`notebooks`)

Los cuatro solvers de [`notebooks/`](notebooks) leen las instancias de 50 clientes de [`e_vigo/`](e_vigo), usan los primeros $n$ clientes, resuelven el modelo entero mixto (MIP) con **Gurobi** y guardan la solución como JSON (con extensión `.txt`) en `Outputs/`. Solo se escribe el archivo si Gurobi encuentra el óptimo.

- **Ruta de salida:** [`Outputs/`](Outputs)
- **Contenido del repositorio:** **80 soluciones óptimas precalculadas**: 10 instancias (ID 1 a 10) × 4 formulaciones (General, $H_1$, $H_2$, $H_3$) × 2 tamaños ($n = 5$ y $n = 10$ clientes), todas con $h = 0{,}1$:
  - `Solucion_{5|10}_Clientes_ID[1-10]_H_01.txt` (Modelo General)
  - `Solucion_TSPPD_H1_{5|10}_Clientes_ID[1-10]_H_01.txt` (Política 1)
  - `Solucion_TSPPD_H2_{5|10}_Clientes_ID[1-10]_H_01.txt` (Política 2)
  - `Solucion_TSPPD_H3_{5|10}_Clientes_ID[1-10]_H_01.txt` (Política 3)

Cada solución almacena:
- Datos de la instancia: número de clientes, ID, $h$, capacidad $Q$, nodos con sus $\alpha_i$ y $\beta_i$, y la matriz de distancias (`distMatrix`).
- Secuencia del tour óptimo (por ejemplo `"tour": [0, 2, 1, 5, 3, 4, 0]` en `Solucion_5_Clientes_ID1_H_01.txt`).
- Valor objetivo, distancia total y costo de manipulación ($h \times$ unidades manipuladas).
- Por cada tramo y parada (`steps`): entregas, recogidas, carga a bordo, estado del compartimiento slot por slot al llegar (`slotsArrival`) y al salir (`slotsDeparture`), unidades reubicadas y una explicación en texto.
- En la Política 3, además, la decisión $s_i$ de cada cliente (`policyDecisions`).

`main.py` y `solve_for_html.py` son utilidades antiguas que resuelven el Modelo General sobre un archivo `.tsp`, y ninguna escribe en `Outputs/`:
- `main.py` busca las instancias en una ruta de macOS fija en el código y pide elegir una por consola.
- `solve_for_html.py` usa por defecto una ruta de macOS, pero acepta la ruta del `.tsp` como argumento (por ejemplo `python notebooks/solve_for_html.py Instancias/2_20_1.tsp`) e imprime el JSON por consola.

---

## 💻 Visualizador Oficial: Página Web 10

La visualización desplegada en Vercel es la **Página Web 10**, ubicada en:
[`Paginas Web/Pagina Web 10 (Gemini 3.8 Flash)`](Paginas%20Web/Pagina%20Web%2010%20%28Gemini%203.8%20Flash%29).

Construida con **React 19.2**, **TypeScript 5.7**, **Tailwind CSS v4.3**, **Motion 12** y **Vite 6.4**:

### Características Principales:
1. **Bahía de Carga LIFO Interactiva (`LifoCargoBay.tsx`)**:
   - Compartimiento esquemático de $Q$ slots, desde la Puerta trasera (slot 1) hasta la Cabina/Fondo (slot $Q$), en una grilla de 8 columnas.
   - Pallets individuales: $\alpha$ en rosa (entrega) y $\beta$ en cian (recogida). Se resaltan en ámbar las unidades evacuadas y en esmeralda las que reingresan, y un andén exterior muestra las unidades en espera.
   - Modo pantalla completa y detalle de texto de cada paso.
2. **Desglose de Sub-Pasos Operativos**:
   - Política 1 y Modelo General: `Evacuar β` → `Entrega α` → `Reingreso β` → `Carga β`.
   - Política 2: `Entrega α` → `Evacuar α` → `Carga β (fondo)` → `Reingreso α`. Si la parada tiene manipulación y ya hay β a bordo, la página marca esas β como obstructoras y muestra 5 sub-pasos: `Evacuar β` → `Entrega α` → `Evacuar α` → `Carga β Fondo` → `Reingreso α`.
   - Política 3: cada cliente usa la secuencia de la política elegida.
   - Depósito: carga inicial, y al volver, `Arribo` → `Descarga` → `Limpieza` → `Final`.
3. **Mapa de Ruta (`RouteCanvas.tsx`)**:
   - Mapa SVG con disposición circular: depósito al centro y clientes equiespaciados. No usa coordenadas reales.
   - Arcos curvos con distancia y flecha, camión animado en sincronía con el reproductor, zoom hasta 2×, pantalla completa y ficha del nodo al hacer clic (`NodeDetailsModal.tsx`).
   - En la Política 3, cada cliente muestra si aplica P1 o P2.
4. **Controles de Reproducción (`PlaybackControls.tsx`)**:
   - Reproducción automática a 0,5×, 1×, 1,5× o 2×, con modo Continuo activado o desactivado.
   - Reinicio, avance y retroceso, y una píldora por paso para saltar directamente.
5. **Selección de Modelo y Solución (`Header.tsx`, `SolutionSelectorModal.tsx`)**:
   - Botones General / Pol. 1 / Pol. 2 / Pol. 3 en la cabecera: cambian la variante manteniendo la instancia.
   - Botón «Explorar Soluciones» en la cabecera: abre el «Explorador de Soluciones», con selector de 5 o 10 clientes y tarjetas de las instancias ID 1 a 10 (Z*, distancia, manipulación, Q y h). Junto a él, otro botón recarga la lista desde `Outputs/`.
6. **Métricas (`MetricsOverview.tsx`)**: valor objetivo, distancia total y del tramo, costo de manipulación con el número de operaciones, carga a bordo (α, β y % de $Q$), demanda total (Σα, Σβ) con el paso actual y, en la Política 3, la decisión P1/P2 del cliente en curso.
7. **Despliegue y Portabilidad**:
   - **En Vercel (Producción):** [https://tsppd-h-visualizer.vercel.app/](https://tsppd-h-visualizer.vercel.app/)
   - **Local autónomo:** `bundle-solutions.js` empaqueta las 80 soluciones en `src/lib/defaultSolutions.ts`, así que la app funciona sin backend.
   - **Local dinámico:** `npm run dev` (Vite) y el servidor Express [`server.js`](Paginas%20Web/Pagina%20Web%2010%20%28Gemini%203.8%20Flash%29/server.js) (`npm start`) exponen `/api/solutions`, que lee `Outputs/` en vivo, en el puerto 3010. `server.js` sirve también la interfaz solo si antes se ejecutó `npm run build`.

---

## 🆕 Página Web 12 (Opus 5.5): Laboratorio LIFO

La **Página Web 12**, ubicada en [`Paginas Web/Pagina Web 12 (Opus 5.5)`](Paginas%20Web/Pagina%20Web%2012%20%28Opus%205.5%29), es la iteración más reciente. Toma el **funcionamiento** de la Página Web 10 (misma fuente de datos, mismos modelos y el mismo esquema de reproducción por tramos, paradas y sub-pasos, con las correcciones indicadas más abajo) con un diseño y una estructura nuevos, generados con Claude Opus 5.5.

Construida con **React 19.3**, **TypeScript 5.7**, **Vite 6.4**, **Tailwind CSS v4.3**, **Motion 12.43**, **KaTeX 0.16**, **Lucide** y la tipografía **Geist** (autoalojada). Corre en el puerto **3012**.

### Qué la diferencia
- **Compartimiento LIFO unidad por unidad:** cada pallet α/β tiene identidad propia y viaja entre su slot, el andén temporal y el cliente. El motor de coreografía está validado sobre las 80 soluciones (680 paradas): la salida coincide slot a slot con la del solver, las manipulaciones coinciden con `handlingCount` y ninguna unidad se duplica ni se pierde.
- **Mapa de ruta a escala:** las posiciones se reconstruyen por MDS desde la matriz $c_{ij}$, así que el largo de cada arco es aproximadamente proporcional a su costo. Hay además una disposición circular (tecla `G`), zoom de 100 a 400 %, paneo, seguimiento del camión y una ficha por nodo.
- **Mapa adaptado a cada pantalla:** en teléfonos y en pantalla completa vertical el mapa toma la proporción del lienzo, y ningún rótulo queda bajo los paneles flotantes.
- **Resaltado cruzado:** al pasar sobre una unidad se marca su cliente en el mapa, y al revés.
- **Secciones:**
  - Simulador: métricas en vivo, mapa, panel de parada con los sub-pasos, compartimiento y reproductor con línea de tiempo proporcional a la distancia.
  - Bitácora: perfil de carga, construcción de Z* y tabla del tour.
  - Comparativa de las cuatro variantes.
  - Modelo matemático: Ecs. (1)–(48) en KaTeX.
  - Datos: matriz $c_{ij}$ y tabla de nodos.
- **Navegación:** paleta de comandos (`Ctrl K`), atajos de teclado (`?`) y URL compartible con el formato `#/<modelo>/<clientes>/<instancia>` (por ejemplo `#/p3/10/7`).
- **Datos:** lee `Outputs/` en vivo por `/api/solutions` (Vite o Express). Sin backend (con `vite preview` o en un hosting estático como Vercel, donde hoy solo está desplegada la Página 10), usa las 80 soluciones empaquetadas en `public/solutions/`.
- **Corrige cuatro comportamientos de la Página 10:**
  - «Siguiente» desde el depósito saltaba al segundo cliente.
  - Con el modo continuo desactivado, «Reproducir» quedaba detenido en la parada.
  - Al pausar a mitad de tramo se mostraba una fase de parada inexistente.
  - En la Política 2, las β del fondo se marcaban como obstructoras.
  
  Además, protege `/api/solutions/:filename` contra *path traversal*.

Detalles de comandos, arquitectura y pruebas en su [README](Paginas%20Web/Pagina%20Web%2012%20%28Opus%205.5%29/README.md).

---

## 🧪 Todas las Páginas Web (1 a 12)

Dentro de [`Paginas Web/`](Paginas%20Web), el nombre de cada carpeta indica el modelo de IA que generó esa versión (las Páginas 1 a 3 comparten Gemini Flash 3.7, y la carpeta de la Página 11 no indica ninguno). Son bancos de prueba para contrastar cómo cada modelo resuelve la arquitectura frontend, el dibujo del mapa y la animación de la carga LIFO sobre los mismos archivos de `Outputs/`:

| Página | Carpeta | Modelo de IA | Stack principal | Puerto | Lanzador (en `Paginas Web/`) |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `Pagina Web 1 (Gemini Flash 3.7)` | Gemini Flash 3.7 | React 19.2 + Vite 6.4 + Tailwind v4.3 + Express | 3000 | `Iniciar_Pagina_1.bat` ⚠️ |
| 2 | `Pagina Web 2 (Gemini Flash 3.7)` | Gemini Flash 3.7 | React 19.2 + Vite 6.4 + Tailwind v4.3 + Express | 3001 | `Iniciar_Pagina_2.bat` |
| 3 | `Pagina Web 3 (Gemini Flash 3.7)` | Gemini Flash 3.7 | React 19.2 + Vite 6.4 + Tailwind v4.3 + Express | 3002 | `Iniciar_Pagina_3.bat` |
| 4 | `Pagina Web 4 (Gemini Pro 3.1)` | Gemini Pro 3.1 | React 19.2 + Vite 8 + Tailwind v4.3 | 5173 | `iniciar_pagina_web_4.bat` |
| 5 | `Pagina Web 5 (Claude Opus 4.6)` | Claude Opus 4.6 | React 19.2 + Vite 8 + Tailwind v4.3 | 5173 | `iniciar_pagina_web_5.bat` |
| 6 | `Pagina Web 6 (Nemotron 3 Ultra)` | Nemotron 3 Ultra | React 18 + Vite 5 + Tailwind v3 + Express | 3000 | `iniciar_pagina_web_6.bat` |
| 7 | `Pagina Web 7 (Muse Park 1.2)` | Muse Park 1.2 (su paquete npm se llama `tsppd-h-muse-spark-v7`) | React 18 + Vite 5 + Tailwind v3 + Express | 3006 | `iniciar_pagina_web_7.bat` |
| 8 | `Pagina Web 8 (Claude Sonnet)` | Claude Sonnet | React 18 + Vite 5 + Tailwind v3.4 + Express | 3008 | `Iniciar_Pagina_8.bat` |
| 9 | `Pagina Web 9 (Gemini 3.7 Flash)` | Gemini 3.7 Flash | React 19.2 + Vite 6.4 + Tailwind v4.3 + Express | 3009 | `Iniciar_Pagina_9.bat` o `iniciar_pagina_web_9.bat` |
| 10 | `Pagina Web 10 (Gemini 3.8 Flash)` | Gemini 3.8 Flash | React 19.2 + Vite 6.4 + Tailwind v4.3 + Express | 3010 | `Iniciar_Pagina_10.bat` / `.sh` / `.command` |
| 11 | `Pagina Web 11` | No indicado | React 18.3 + Vite 5.4 + Tailwind v3.4 + Radix UI | 3011 | `Iniciar_Pagina_11.bat` |
| 12 | `Pagina Web 12 (Opus 5.5)` | Claude Opus 5.5 | React 19.3 + Vite 6.4 + Tailwind v4.3 + KaTeX + Express | 3012 | `Iniciar_Pagina_12.bat` |

> ⚠️ La Página 1 no arranca en su estado actual: su `server.js` usa `PORT` sin definirlo, y `npm run dev` tampoco funciona porque su `vite.config.ts` tiene un error de sintaxis.

Cada página aportó lecciones en la representación de la bahía de carga, el manejo de sub-pasos y el acoplamiento con los archivos de salida. La **Página Web 10** es la versión desplegada en Vercel, y la **Página Web 12** es la iteración más reciente.

---

## 🚀 Guía de Instalación y Ejecución

### Opción 0: Acceso Directo en Línea (Recomendado)
Para explorar la aplicación inmediatamente sin instalar nada:  
👉 **[Abrir en Vercel: tsppd-h-visualizer.vercel.app](https://tsppd-h-visualizer.vercel.app/)**

---

### Opción A: Ejecución Local de la Visualización

#### Prerrequisitos
- **Node.js** v20 o superior, con npm (Tailwind CSS v4.3 lo exige). Las Páginas 4 y 5 (Vite 8) requieren Node.js 20.19 o superior. En la Página 12, `npm test` requiere Node.js v22.18 o superior, porque ejecuta TypeScript directamente.

#### Página Web 10
En macOS / Linux:
```bash
# Otorgar permisos de ejecución si es necesario
chmod +x "Paginas Web/Iniciar_Pagina_10.sh"

# Iniciar el script automático
./"Paginas Web/Iniciar_Pagina_10.sh"
```
O directamente desde la consola:
```bash
cd "Paginas Web/Pagina Web 10 (Gemini 3.8 Flash)"
npm install
npm run dev
```
La aplicación se abrirá en `http://localhost:3010`. En Windows: doble clic en [`Paginas Web/Iniciar_Pagina_10.bat`](Paginas%20Web/Iniciar_Pagina_10.bat).

#### Página Web 12
```bash
cd "Paginas Web/Pagina Web 12 (Opus 5.5)"
npm install
npm run dev
```
La aplicación se abrirá en `http://localhost:3012`. En Windows: doble clic en [`Paginas Web/Iniciar_Pagina_12.bat`](Paginas%20Web/Iniciar_Pagina_12.bat), que instala dependencias si faltan.

#### Otras páginas y lanzadores combinados
- Cada página tiene su lanzador en `Paginas Web/` (ver la [tabla de páginas](#-todas-las-páginas-web-1-a-12)):
  - Los de las Páginas 1, 2, 4 y 5 no ejecutan `npm install`, así que hay que instalar las dependencias antes.
  - Los de las Páginas 1 y 2 además necesitan `npm run build`, porque solo ejecutan `node server.js`, que sirve `dist/`.
- [`Iniciar_Paginas_Web.bat`](Iniciar_Paginas_Web.bat) (raíz) llama a `Paginas Web/Iniciar_Ambas_Paginas.bat`, que intenta iniciar las **Páginas 1 y 2** (puertos 3000 y 3001) con `node server.js`. La Página 1 falla (ver ⚠️ arriba). No inicia la Página 10 ni la 12.
- `Paginas Web/Iniciar_Todas_Las_Paginas.bat` hace lo mismo con las Páginas 1, 2 y 3 (puertos 3000 a 3002).
- Ninguno de estos lanzadores combinados ejecuta `npm install` ni `npm run build`.

---

### Opción B: Resolver Nuevas Instancias con Gurobi

#### Prerrequisitos
- **Python 3** (probado con Python 3.12) y **Gurobi Optimizer** (`gurobipy`; probado con 13.0.3).
- La licencia restringida que trae `pip install gurobipy` admite hasta 2000 variables. No alcanza para el Modelo General, que supera ese límite ya con 5 clientes, así que se necesita una licencia académica o completa.
- El repositorio no incluye `requirements.txt`.

1. Crea y activa un entorno virtual (opcional) e instala Gurobi:
   ```bash
   python -m venv .venv
   source .venv/bin/activate      # macOS/Linux
   # Windows (cmd): .venv\Scripts\activate · PowerShell: .venv\Scripts\Activate.ps1
   pip install gurobipy
   ```
2. Ejecuta cualquiera de los solvers. Aceptan `--customers N`, `--id K` (1 a 10), `--h VALOR`, `--all-ids` (resuelve las instancias 1 a 10) y `--gurobi-log`:
   ```bash
   # Resolver con Política 1 (TSPPD-H1), 10 clientes, instancias 1 a 10
   python notebooks/tsppd_h_1_gurobi.py --customers 10 --all-ids

   # Resolver con Política 2 (TSPPD-H2)
   python notebooks/tsppd_h_2_gurobi.py --customers 10 --all-ids

   # Resolver con Política 3 (TSPPD-H3)
   python notebooks/tsppd_h_3_gurobi.py --customers 10 --all-ids

   # Resolver Modelo General
   python notebooks/tsppd_h_gurobi.py --customers 10 --all-ids
   ```
   Sin argumentos, el Modelo General resuelve 10 clientes y las políticas 5 clientes, siempre con la instancia 1 y $h = 0{,}1$. El sufijo del archivo es $h$ sin el punto decimal (`H_01` para 0,1; `H_05` para 0,5; `H_10` para 1).

   > Los visualizadores identifican cada solución por modelo, clientes e instancia, sin distinguir $h$. Si en `Outputs/` conviven dos valores de $h$ para la misma instancia, el cambio de modelo (y en la Página 12 la URL y la Comparativa) toma la primera que encuentra.
3. Los resultados se guardarán automáticamente en `Outputs/`. Para actualizar las soluciones empaquetadas de cada visualizador:
   ```bash
   cd "Paginas Web/Pagina Web 10 (Gemini 3.8 Flash)"
   node bundle-solutions.js

   cd "../Pagina Web 12 (Opus 5.5)"
   npm run bundle          # también se ejecuta automáticamente en npm run build
   ```
   En modo desarrollo, ambas páginas leen `Outputs/` en vivo y no necesitan este paso.

---

## 📁 Estructura del Proyecto

```plaintext
TSPPD-H-Visualizer/
├── README.md                      # Documentación integral del proyecto
├── AGENTS.md                      # Reglas de diseño UI obligatorias para agentes de IA
├── .agents/                       # Plugins, reglas y skills para agentes de IA
├── .claude/launch.json            # Vista previa de la Página 12 (puerto 3012)
├── Iniciar_Paginas_Web.bat        # Llama a Paginas Web/Iniciar_Ambas_Paginas.bat (Páginas 1 y 2)
│
├── papers/                        # Artículos de investigación y marco teórico
│   ├── battarra2010.pdf           # Paper base (Battarra, Erdoğan, Laporte & Vigo, 2010)
│   └── Thesis_Rey.pdf             # Tesis doctoral de C. R. Rey Barra (U. de Bolonia, 2022)
│
├── e_vigo/                        # Instancias del paper (Gendreau, Laporte & Vigo, 1999)
│   ├── edati.dat                  # Demandas originales p_i (sin coordenadas)
│   └── ecosti.dat                 # Matrices de costos c_ij
│
├── Instancias/                    # 49 instancias tipo TSPLIB (.tsp), n = 20 a 100
├── Instancias Generadas por IA/   # 14 instancias sintéticas (2 a 15 clientes)
│
├── notebooks/                     # Solvers matemáticos en Python con Gurobi
│   ├── tsppd_h_gurobi.py          # Modelo General (Ecs. 1-16)
│   ├── tsppd_h_1_gurobi.py        # Política 1 (Ecs. 17-25)
│   ├── tsppd_h_2_gurobi.py        # Política 2 (Ecs. 26-27)
│   ├── tsppd_h_3_gurobi.py        # Política 3 (Ecs. 31-48)
│   ├── solve_for_html.py          # Utilidad antigua: Modelo General sobre un .tsp, JSON por consola
│   └── main.py                    # Menú interactivo antiguo sobre los .tsp (ruta base de macOS fija)
├── Outputs/                       # 80 soluciones (JSON en .txt): 4 modelos × ID 1-10 × n = 5 y 10
│   ├── Solucion_{5|10}_Clientes_ID1..10_H_01.txt            (Modelo General)
│   ├── Solucion_TSPPD_H1_{5|10}_Clientes_ID1..10_H_01.txt   (Política 1)
│   ├── Solucion_TSPPD_H2_{5|10}_Clientes_ID1..10_H_01.txt   (Política 2)
│   └── Solucion_TSPPD_H3_{5|10}_Clientes_ID1..10_H_01.txt   (Política 3)
│
├── Paginas Web/                   # Entornos de visualización web (12 páginas, generadas con distintos modelos de IA)
│   ├── Pagina Web 1 (Gemini Flash 3.7)/ … Pagina Web 9 (Gemini 3.7 Flash)/
│   ├── Pagina Web 10 (Gemini 3.8 Flash)/   # 🌟 VISUALIZADOR OFICIAL (desplegado en Vercel)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Header.tsx                # Cabecera y selector de modelo
│   │   │   │   ├── LifoCargoBay.tsx          # Bahía de carga del camión animada
│   │   │   │   ├── RouteCanvas.tsx           # Mapa y grafo del tour
│   │   │   │   ├── PlaybackControls.tsx      # Controles de reproducción paso a paso
│   │   │   │   ├── SolutionSelectorModal.tsx # Catálogo de soluciones
│   │   │   │   ├── NodeDetailsModal.tsx      # Ficha de un nodo
│   │   │   │   └── MetricsOverview.tsx       # Métricas: Z, distancia, manipulación y carga
│   │   │   │   # (ModelFormulaModal, StepExplanation y DistanceMatrixModal existen, pero no se usan)
│   │   │   ├── types/                        # Definiciones TypeScript de soluciones
│   │   │   └── lib/                          # Soluciones empaquetadas (defaultSolutions.ts) y utilidades
│   │   ├── server.js              # Servidor API Express (puerto 3010)
│   │   ├── bundle-solutions.js    # Empaquetador estático de Outputs
│   │   ├── vercel.json            # Configuración para despliegue en Vercel
│   │   └── vite.config.ts         # Configuración Vite con middleware API
│   ├── Pagina Web 11/
│   ├── Pagina Web 12 (Opus 5.5)/           # 🆕 Iteración más reciente (ver su README)
│   │   ├── src/                   # lib/ (motor LIFO, layout del mapa), state/, hooks/, components/
│   │   ├── scripts/               # API de Outputs compartida y pruebas del motor y la reproducción
│   │   ├── public/solutions/      # 80 soluciones empaquetadas + index.json
│   │   ├── server.js              # Servidor Express (puerto 3012)
│   │   └── bundle-solutions.js    # Regenera public/solutions desde Outputs
│   ├── Iniciar_Pagina_{1..12}.bat # Lanzadores individuales estandarizados para Windows
│   ├── Iniciar_Pagina_{10,12}.sh, Iniciar_Pagina_{10,12}.command # Lanzadores para macOS/Linux
│   └── Iniciar_Ambas_Paginas.bat, Iniciar_Todas_Las_Paginas.bat   # Lanzadores agrupados
│
└── Visualizaciones HTML/          # Páginas HTML independientes (políticas, solución óptima, plantilla)
```

---

## 📚 Referencias

- **Battarra, M., Erdoğan, G., Laporte, G., & Vigo, D. (2010).** *The Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs.* Transportation Science, 44(3), 383–399. [doi:10.1287/trsc.1100.0316](https://doi.org/10.1287/trsc.1100.0316)
- **Gendreau, M., Laporte, G., & Vigo, D. (1999).** *Heuristics for the traveling salesman problem with pickup and delivery.* Computers & Operations Research, 26(7), 699–714. [doi:10.1016/S0305-0548(98)00085-9](https://doi.org/10.1016/S0305-0548(98)00085-9) — origen de las instancias.
- **Carrabs, F., Cordeau, J.-F., & Laporte, G. (2007).** *Variable neighborhood search for the pickup and delivery traveling salesman problem with LIFO loading.* INFORMS Journal on Computing, 19(4), 618–632. [doi:10.1287/ijoc.1060.0202](https://doi.org/10.1287/ijoc.1060.0202)
- **Hernández-Pérez, H., & Salazar-González, J.-J. (2004).** *A branch-and-cut algorithm for a traveling salesman problem with pickup and delivery.* Discrete Applied Mathematics, 145(1), 126–139. [doi:10.1016/j.dam.2003.09.013](https://doi.org/10.1016/j.dam.2003.09.013) — lectura complementaria (Battarra et al. no la citan; H. Hernández-Pérez aloja las instancias en su sitio web).
- **Rey Barra, C. R. (2022).** *Formulations and Metaheuristics for Combinatorial Optimization Problems* [Tesis doctoral, Università di Bologna]. Disponible en [`papers/Thesis_Rey.pdf`](papers/Thesis_Rey.pdf).
