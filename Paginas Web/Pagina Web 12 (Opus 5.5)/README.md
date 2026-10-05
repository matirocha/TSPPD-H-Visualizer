# Página Web 12 · TSPPD-H Laboratorio LIFO (Opus 5.5)

Visualizador interactivo de las soluciones óptimas del **TSPPD-H** (*Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs*; Battarra, Erdoğan, Laporte y Vigo, 2010, *Transportation Science* 44(3), 383–399, [doi:10.1287/trsc.1100.0316](https://doi.org/10.1287/trsc.1100.0316)).

Toma el **funcionamiento** de la Página Web 10 (misma fuente de datos, mismos modelos y el mismo esquema de reproducción por tramos, paradas y sub-pasos, con las correcciones listadas al final) con un diseño y una estructura nuevos, generados con Claude Opus 5.5.

**Stack:** React 19.3 · TypeScript 5.7 · Vite 6.4 · Tailwind CSS v4.3 · Motion 12.43 · KaTeX 0.16 · Lucide · Geist y Geist Mono (autoalojadas con `@fontsource-variable`) · Express 4 para el servidor opcional.

## Ejecutar

Requiere **Node.js 20 o superior**. `npm test` requiere Node.js 22.18 o superior, porque ejecuta TypeScript directamente.

```bash
npm install
npm run dev          # http://localhost:3012 (lee Outputs/ en vivo)
```

En Windows también sirve `Paginas Web/Iniciar_Pagina_12.bat`, que instala las dependencias si faltan.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Vite en el puerto 3012 + API `/api/solutions` sobre `../../Outputs`, `/api/heuristics` sobre `../../Outputs/Erdogan2012`, `/api/benchmark` sobre `../../Outputs/Benchmark` y `/api/metaheuristics` sobre `../../Outputs/BenchmarkErdogan2012` (abre el navegador; `npm run dev -- --no-open` lo evita) |
| `npm run build` | Empaqueta las soluciones, las heurísticas, el benchmark de tiempos y el de metaheurísticas en `public/solutions/`, hace el typecheck y el build en `dist/` |
| `npm run preview` | Sirve `dist/` con `vite preview` en el puerto 3012 (sin API: usa `public/solutions/`); requiere un `npm run build` previo |
| `npm start` / `npm run server` | Servidor Express (API + `dist/`) en el puerto 3012, o en `PORT` si está definido; sin un `npm run build` previo solo responde la API |
| `npm run bundle` | Solo regenera `public/solutions/` desde `Outputs/` (incluye `heuristics.json` desde `Outputs/Erdogan2012/` y, si existen, `benchmark.json` desde `Outputs/Benchmark/` y `metaheuristics.json` desde `Outputs/BenchmarkErdogan2012/`; sin resultados nuevos conserva los ya empaquetados) |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Valida el motor LIFO y la máquina de reproducción sobre las 80 soluciones, los resultados de las heurísticas contra Gurobi y la agregación y exportación de los benchmarks de tiempos y de metaheurísticas |
| `npm run test:engine` / `npm run test:playback` / `npm run test:heuristics` / `npm run test:benchmark` / `npm run test:metaheuristics` | Cada validación por separado |

Sin backend (con `vite preview` o en un hosting estático como Vercel; la demo de Vercel del repositorio corresponde a la Página 10), la app usa automáticamente las soluciones empaquetadas en `public/solutions/`: 80 archivos JSON más `index.json`, es decir, 4 modelos × 5 y 10 clientes × instancias 1 a 10, con h = 0,1, y `heuristics.json` con los 40 resultados de las heurísticas (20 del Algoritmo 2.1 + DP y 20 del ILS), además de `benchmark.json` (Tiempos) y `metaheuristics.json` (Metaheurísticas) cuando `npm run bundle` encontró esos resultados.

La fuente en uso se indica con un punto de color en el botón de recarga de la barra superior: verde con la API local y gris con el paquete estático. Su tooltip dice «Leyendo Outputs/ en vivo (API local)» o «Soluciones empaquetadas (sin backend)», y el pie de página muestra «API local · Outputs/ en vivo» o «Paquete estático (sin backend)».

## Qué hay en la página

- **Simulador**:
  - Métricas en vivo: Z* y su anatomía ruteo/manipulación, recorrido, manipulaciones y carga a bordo.
  - Mapa de ruta: geométrico por MDS desde c_ij o circular, con zoom, paneo, seguimiento del camión y ficha por nodo.
  - Panel de parada con la coreografía de sub-pasos.
  - **Compartimiento LIFO unidad por unidad**: cada pallet α/β tiene identidad propia y viaja entre su slot, el andén temporal y el cliente.
- **Dock de reproducción**: línea de tiempo proporcional a la distancia (arrastrable), velocidades 0,5×, 1×, 1,5× y 2×, y modo continuo. Al bajar por la página aparece un mini reproductor flotante (reproducir/pausar, posición actual y botón para volver al simulador).
- **Bitácora**: perfil de carga por tramo, construcción de Z* y tabla completa del tour.
- **Comparativa**: las cuatro variantes (General, P1, P2, P3) de la instancia actual y el panorama de brechas en las 10 instancias.
- **Heurísticas** (Erdoğan, Battarra, Laporte y Vigo, 2012, *Computers & Operations Research* 39, 1074–1086): compara la manipulación de Gurobi con el **Algoritmo 2.1 + DP** (manipulación óptima de la Política 3 sobre una ruta fija) y con el **ILS** (Algoritmo 4.2). Los resultados los generan `notebooks/tsppd_h_alg21_dp.py` y `notebooks/tsppd_h_alg42_ils.py` en `Outputs/Erdogan2012/`:
  - **Resumen** sobre todas las instancias (o las de un tamaño): en cuántas el Algoritmo 2.1 iguala la manipulación de Gurobi P3, en cuántas el ILS iguala su óptimo y el tiempo por corrida del ILS.
  - **Esta instancia**: tabla con la manipulación (en barras), la distancia y el costo total Z de los cuatro modelos Gurobi, del Algoritmo 2.1 (sobre la ruta de P3) y del ILS.
  - **La misma ruta, con la mejor carga**: la manipulación de Gurobi y la del Algoritmo 2.1 sobre la ruta de cada modelo, con su diferencia.
  - **Todas las instancias**: tabla de las 10 instancias de cada tamaño, en manipulación o en costo total Z, con promedios y la comparación del ILS con Gurobi P3. Pulsar una instancia la abre en toda la página.
  - **Qué se compara**: qué es cada método y los comandos para regenerar los resultados.
- **Tiempos de cómputo** (formato de Battarra et al., 2010, Tablas 2–4, y de Erdoğan et al., 2012, Tabla 2): tiempo de los cuatro modelos Gurobi (General, P1, P2, P3) frente a la heurística de **dos fases** (ruta TSP + Algoritmo 2.1 + DP, como la columna «Two-phase» de Battarra et al.; el Algoritmo 2.1 por sí solo solo calcula la manipulación de una ruta fija) y al **ILS-2dir**, en las instancias de 5 a 25 clientes (Id 1 a 10) con h = 0,1 · 0,5 · 1. Los datos los genera `notebooks/tsppd_h_benchmark.py` en `Outputs/Benchmark/` y, como el benchmark tarda horas, con la API local la sección se actualiza sola cada minuto mientras falten ejecuciones:
  - **Barra de control** (fija al bajar, en pantallas con alto suficiente): el valor de h que rige toda la sección, el avance del benchmark y el botón Actualizar.
  - **Tabla comparativa**: para el h elegido, un bloque por N (5 a 25) con una fila por Id (1 a 10) que muestra, en cada método, el valor objetivo z y los segundos que tardó. Cuando Gurobi no prueba el óptimo, z lleva «*» con el gap debajo y el tiempo dice «límite». Cada bloque cierra con una fila «Prom.»: óptimas k/10 y tiempo medio de cada modelo (todas las ejecuciones o solo las óptimas) y desviación media respecto de la Política 3 y tiempo medio de las heurísticas (° cuando P3 aún no prueba el óptimo). Al final, «Total» sobre las instancias que todos los métodos ya terminaron. El Modelo General solo se ejecuta hasta N = 10: con N ≥ 15 su formulación indexada por posiciones tiene decenas de miles de binarias y no cerraba el gap en 1.800 s, así que sus celdas quedan en blanco con la nota «No se ejecuta: alto costo computacional» (§), también en el gráfico, el detalle y el LaTeX. Se copia en LaTeX (longtable con N × Id, o el resumen por N con booktabs) o se descargan todos los registros en CSV.
  - **Tiempo medio frente a N**: gráfico en escala logarítmica con el límite de tiempo de Gurobi; una flecha ↑ marca los promedios que incluyen ejecuciones cortadas por el límite (≥) y el tramo discontinuo, los grupos con ejecuciones pendientes.
  - **Hallazgos**: hasta qué N resuelve cada modelo todas las instancias, en cuántas el ILS iguala el óptimo de P3, cuánto más rápido (o lento) es el ILS que P3 y lo que tarda una evaluación de la DP.
  - **Detalle de un tamaño**: para un N, una fila por Id con z, z^H y segundos de cada modelo (con «*» y el gap cuando no se probó el óptimo) y z, desviación y segundos de las heurísticas; también se copia en LaTeX.
  - **Cómo se midió**: equipo, Gurobi, hilos, procesos simultáneos, límite, parámetros del ILS, definiciones y referencias.
- **Metaheurísticas** (Erdoğan et al., 2012, Tablas 8–9 y 2–3): réplica a gran escala, con |V<sub>c</sub>| = 20, 40, …, 200 clientes (10 instancias por tamaño), de la función objetivo y el tiempo de cinco métodos: la solución inicial de **dos fases** (tour TSP + reubicación del depósito + Algoritmo 2.1 + DP), el **ILS** (Algoritmo 4.2) y el **ITS** (Algoritmo 4.3), estos dos con evaluación exacta (Algoritmo 2.1 + DP) o heurística lineal (§2.2) del vecindario. Más detalles en la subsección «Metaheurísticas» de abajo:
  - **Barra de control** (fija al bajar): la dirección que rige la sección, 1dir (corrida desde el tour TSP) o 2dir (la mejor de las corridas desde el tour y desde el tour invertido), el avance del benchmark y el botón Actualizar.
  - **Resumen por |V<sub>c</sub>|** al estilo de las Tablas 2–3: desviación media respecto del Best del paper y segundos medios de cada método, con la cifra del paper debajo; se copia en LaTeX o se descarga en CSV (resumen o una fila por instancia).
  - **Gráfico por tamaño** (tiempo en escala logarítmica o desviación, con el paper como referencia) y **hallazgos** calculados de los registros: menor desviación, razón de tiempos exacto/heurístico, cuándo mejora el ILS su solución inicial, efecto de 2dir, instancias bajo el Best y coincidencia de la solución inicial con la del paper.
  - **Detalle por instancia** como las Tablas 8–9 (columnas «1 dir.» y «2 dir.» de cada método, en las vistas Nuestro, Paper y Δ, con el tiempo medio al pie y copia en LaTeX) y, para la instancia elegida, la **convergencia** del ILS y del ITS iteración a iteración.
  - **Cómo se midió**: instancias, h por tamaño, tour TSP, regla de la búsqueda local del ILS, parámetros, equipo y validación de las cifras del paper.
- **Modelo matemático**: formulaciones del paper en KaTeX, Ecs. (1)–(48), con el patrón de carga de cada política. En la Política 2, el modelo son las Ecs. (26)–(27); las (28)–(30) muestran su equivalencia con la Política 1, y por eso la interfaz rotula esa política como «Ecs. 26–30».
- **Datos**: matriz c_ij con los arcos del tour, tabla de nodos y parámetros.
- **Navegación**: catálogo de soluciones, paleta de comandos (`Ctrl K`), atajos de teclado (`?`) y URL compartible con el formato `#/<modelo>/<clientes>/<instancia>`, donde el modelo es `general`, `p1`, `p2` o `p3`. Por ejemplo, `#/p3/10/7` es la Política 3 con 10 clientes, instancia 7.

### Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `Espacio` | Reproducir / pausar |
| `→` / `←` | Siguiente / anterior sub-paso |
| `Shift` + `→` / `←` | Siguiente / anterior parada |
| `R` · `C` | Reiniciar el tour · modo continuo on/off |
| `[` · `]` | Bajar · subir velocidad |
| `1` – `4` | General · Política 1 · Política 2 · Política 3 |
| `Ctrl K` (`⌘ K`) · `E` | Paleta de comandos · catálogo de soluciones |
| `M` · `B` · `G` | Mapa a pantalla completa · compartimiento a pantalla completa · mapa geométrico/circular |
| `?` · `Esc` | Mostrar atajos · cerrar diálogo, ficha o pantalla completa |

Con el mapa enfocado:
- `+` / `−` hacen zoom y `0` restablece la vista.
- Con zoom, las flechas desplazan el mapa (`Shift` da pasos largos).
- `Tab` recorre los nodos y `Enter` abre su ficha.

Con el puntero sobre el mapa, `Ctrl` (`⌘`) + rueda hace zoom; la rueda sola sigue desplazando la página.

Los atajos globales se ignoran mientras se escribe en un campo o hay un diálogo abierto, salvo `Ctrl K` (siempre activo) y `Esc` (también con un diálogo abierto).

## Arquitectura

```
src/
  lib/choreography.ts          Motor LIFO: convierte cada paso del solver en fases físicas
                               siguiendo la identidad de cada unidad durante todo el tour
  lib/layout.ts                MDS clásico + rotación + separación de nodos; disposición circular;
                               marco adaptativo del viewBox (frameFor) y paneles como obstáculos
  lib/api.ts                   API en vivo con respaldo estático, caché por archivo y precarga
                               (también /api/heuristics → solutions/heuristics.json,
                               /api/benchmark → solutions/benchmark.json y
                               /api/metaheuristics → solutions/metaheuristics.json)
  lib/overlay.ts               Bloqueo de scroll y pila de capas (Esc/Tab solo en la superior)
  lib/hash.ts · models.ts      URL compartible y metadatos de los cuatro modelos
  lib/policy.ts · sanitize.ts  Política aplicada por parada y limpieza de textos del solver
  state/playback.ts            Máquina de estados de reproducción (funciones puras)
  state/SimulationProvider.tsx Catálogo, selección, coreografía y reproducción
                               (useSim, useCatalog, useProgress, useLiveMetrics)
  state/UIProvider.tsx         Hover cruzado mapa ↔ compartimiento, diálogos, paneles en foco
  hooks/                       Atajos de teclado globales y foco confinado en pantalla completa
  components/                  Secciones de la página (map/, bay/, stop/, transport/, analysis/,
                               model/, data/, heuristics/, ui/…)
  components/heuristics/       Sección Heurísticas: carga y unión de los resultados (data.ts),
                               identidad de los métodos (methods.tsx) y sus tablas
  components/Benchmark.tsx     Sección Tiempos; en components/benchmark/: carga con sondeo
                               (useBenchmark.ts), agregación (aggregate.ts), formato y LaTeX/CSV
                               (format.ts, export.ts), tablas, gráfico y hallazgos
  components/Metaheuristics.tsx  Sección Metaheurísticas; en components/metaheuristics/: carga con
                               sondeo (useMetaheuristics.ts), agregación (aggregate.ts), identidad de
                               los métodos (labels.ts, shared.tsx), modelos y LaTeX/CSV (export.ts),
                               resumen, gráficos, hallazgos, detalle por instancia y nota de método
  types/heuristics.ts          Formato de los JSON de Outputs/Erdogan2012/
  types/benchmark.ts           Formato de Outputs/Benchmark/benchmark_tiempos.json
  types/metaheuristics.ts      Formato de Outputs/BenchmarkErdogan2012/ (registros y cifras del paper)
scripts/
  solutions-api.js             Lectura de Outputs/, Outputs/Erdogan2012/, Outputs/Benchmark/ y
                               Outputs/BenchmarkErdogan2012/, compartida por Vite y Express
  validate-engine.ts           Pruebas del motor sobre las 80 soluciones
  validate-playback.ts         Pruebas de la reproducción sobre las 80 soluciones
  validate-heuristics.ts       Recalcula los resultados de la DP y del ILS y los contrasta con Gurobi
  validate-benchmark.ts        Agregación, formato y LaTeX/CSV del benchmark (fixtures + datos reales)
  validate-metaheuristics.ts   Agregación y LaTeX/CSV del benchmark de metaheurísticas (fixtures,
                               Tablas 2–3 del paper y recálculo desde registros.jsonl)
public/solutions/              Soluciones empaquetadas, heuristics.json, benchmark.json y
                               metaheuristics.json
                               (los genera bundle-solutions.js)
server.js                      Servidor Express: API + dist/
vite.config.ts                 Plugin con la misma API para el modo desarrollo
vercel.json                    Reescrituras para el despliegue estático
```

### Motor de coreografía

Los archivos de `Outputs/` traen `slotsArrival`/`slotsDeparture` y arreglos auxiliares (`deliveredSlots`, `rehandledA/B`, `newBSlots`). Estos últimos se usan solo como **pistas**: en varias soluciones vienen incompletos, con índices desplazados, o (en el modelo General) `newBSlots` marca las primeras posiciones que pasan a tener β, que pueden corresponder a unidades reubicadas y no a las recién recogidas. El motor resuelve una asignación consistente con los conteos del solver, y `npm run test:engine` comprueba, en las 80 soluciones y sus 680 paradas (600 en clientes y 80 regresos al depósito), que:

- la salida calculada coincide slot a slot con la del solver;
- cada cliente recibe exactamente α_i unidades y entrega β_i;
- ninguna unidad se duplica ni se pierde en ninguna fase.

Además, informa cuántas paradas de cliente no coinciden con el `handlingCount` del solver (`handlingMismatch`, hoy 0); una discrepancia ahí no hace fallar la prueba.

La prueba de reproducción recorre las 80 soluciones:
- con el modo continuo activado y desactivado (una pausa por parada);
- avanzando con «Siguiente» y retrocediendo con «Anterior» desde el final;
- en casos límite: salto en la línea de tiempo, reinicio y parada anterior.

### Validación de las heurísticas

`npm run test:heuristics` lee `Outputs/Erdogan2012/` y, para cada archivo:

- **DP** (80 evaluaciones = 20 instancias × 4 tours Gurobi): el tour evaluado es el de Gurobi, la distancia coincide con `distMatrix`, Z = distancia + manipulación, la DP no supera a las Políticas 1 y 2 puras en su propia ruta, la Política 1 pura reproduce a Gurobi P1 y la Política 2 pura a Gurobi P2, y en el tour de la Política 3 la DP reproduce la manipulación de Gurobi.
- **Detalle por parada** (DP e ILS): la carga de llegada, las operaciones y el costo de cada parada se recalculan desde cero con las reglas de la Política 1 y 2, y su suma coincide con la manipulación total.
- **ILS**: el tour visita cada cliente una vez, `best` es el mínimo de las dos direcciones, la traza tiene `Niter` puntos y nunca empeora, y el Z nunca es menor que el óptimo de Gurobi para la Política 3 (lo que delataría un error).

Hoy: 20/20 rutas de la Política 3 reproducidas por la DP y 20/20 instancias en las que el ILS alcanza el óptimo de Gurobi.

### Tiempos de cómputo

La sección **Tiempos** (05) compara el tiempo de los cuatro modelos Gurobi (General, P1, P2, P3) con el de la heurística de dos fases (ruta TSP + Algoritmo 2.1 + DP) y el del ILS-2dir, con las tablas de los papers: una tabla comparativa con una fila por Id dentro de cada N (valor objetivo z y segundos de cada método, como Battarra et al. 2010, Tablas 2–4) y filas de promedio por N (óptimas, segundos y desviación, como Erdoğan et al. 2012, Tabla 2), el detalle de un tamaño con z^H y desviación, más un gráfico del tiempo frente a N en escala logarítmica.

- **Datos:** `Outputs/Benchmark/benchmark_tiempos.json` por `/api/benchmark`. Si ese archivo falta o está a medio escribir, se reconstruye desde `registros.jsonl`. Sin backend se usa `public/solutions/benchmark.json`, que copia `npm run bundle`.
- **Grilla:** N ∈ {5, 10, 15, 20, 25} × Id 1–10 × h ∈ {0,1; 0,5; 1} × 6 métodos = 900 ejecuciones. Lo que falta se muestra como «…», y con la API local la sección se vuelve a leer cada minuto mientras el benchmark esté incompleto y la pestaña visible.
- **Convenciones:**
  - Seg. de Gurobi = Runtime, sin construir el modelo.
  - Un modelo no resuelto dentro del límite muestra su mejor entera con «*» y el gap con la cota.
  - La desviación de las heurísticas se mide contra z*<sub>P3</sub>; si Gurobi no lo probó, contra el mejor Z conocido de la Política 3, marcado con «°».
- **Exportar:** «Copiar LaTeX» (booktabs) en ambas tablas y CSV con todos los registros.

```bash
python notebooks/tsppd_h_benchmark.py                 # desde la raíz del repositorio; se reanuda desde registros.jsonl
python notebooks/tsppd_h_benchmark.py --consolidate   # solo regenera benchmark_tiempos.json
npm run bundle                                        # copia el benchmark a public/solutions/benchmark.json
npm run test:benchmark                                # fixtures sintéticos + recálculo independiente desde registros.jsonl
```

### Metaheurísticas

La sección **Metaheurísticas** (06) replica las Tablas 8 y 9 de Erdoğan et al. (2012) y sus resúmenes de las Tablas 2–3: dos fases, ILS e ITS, heurísticos y exactos, en una y dos direcciones. Usa las 10 instancias euclidianas de 200 clientes de Gendreau, Laporte y Vigo (1999) (`e_vigo/`), recortadas a |V<sub>c</sub>| = 20, 40, …, 200 clientes y con la demanda escalada por la Ec. (15).

- **Datos:** `Outputs/BenchmarkErdogan2012/benchmark_metaheuristicas.json` (o, si falta, `registros.jsonl`) y `paper_erdogan2012.json`, por `/api/metaheuristics`. Sin backend se usa `public/solutions/metaheuristics.json`, que copia `npm run bundle`. Con solo las cifras del paper, la sección ya muestra la estructura con lo nuestro pendiente.
- **Grilla:** 10 tamaños × 10 instancias × 10 ejecuciones (tour TSP, dos fases y 4 metaheurísticas × 2 direcciones) = 1.000 ejecuciones. Lo que falta se muestra como «…», y con la API local la sección se vuelve a leer cada minuto mientras el benchmark esté incompleto.
- **Convenciones:**
  - 1dir = corrida desde el tour TSP; 2dir = la mejor de las corridas desde el tour y desde el tour invertido, con N<sub>iter</sub> = 200 iteraciones cada una. En las Tablas 8–9 la columna «2 dir.» es solo la corrida desde el tour invertido, y X-2dir = min(1 dir., 2 dir.).
  - Desviación = (Z − Best) / Best · 100, con Best la mejor solución conocida del paper.
  - Segundos de pared en Node.js: 1dir = tour TSP + solución inicial + metaheurística de la dirección 1; 2dir = tour TSP + ambas direcciones. Los del paper son de código C en un Core 2 Quad de 2,83 GHz: se comparan las razones, no los segundos.
  - h por tamaño: el que reproduce los números del paper (1 · 0,5 · 0,33 · 0,125 · 0,1 · 0,17 · 0,14 · 0,125 · 0,11 · 0,1), no el h·|V<sub>c</sub>| = 20 del texto.
- **Exportar:** «Copiar LaTeX» (booktabs) del resumen y del detalle por instancia (en la vista elegida), y CSV del resumen o por instancia.

```bash
node notebooks/erdogan2012/benchmark.mjs                 # desde la raíz del repositorio; se reanuda desde registros.jsonl
node notebooks/erdogan2012/benchmark.mjs --consolidate   # solo regenera benchmark_metaheuristicas.json
python notebooks/erdogan2012/paper_tables.py             # vuelve a extraer y validar las cifras del paper
npm run bundle                                           # copia ambos a public/solutions/metaheuristics.json
npm run test:metaheuristics                              # fixtures, Tablas 2–3, recálculo desde registros.jsonl y LaTeX/CSV
```

### Mapa de ruta: marco adaptativo

El lienzo del mapa no usa un viewBox fijo en todas las pantallas:

- **Escritorio** (lienzo apaisado): marco fijo de 720 × 440.
- **Teléfonos y pantalla completa en vertical**: el marco adopta la proporción del lienzo, sin franjas vacías, y busca una escala de al menos ~0,8. Así, en un teléfono de 375 px de ancho, los rótulos pasan de ~5 px a ~8–9 px. El layout MDS se recalcula para ese marco, y la escala baja de ~0,8 solo si no caben las pilas de etiquetas.
- **Paneles flotantes** (HUD, leyenda y controles de zoom): se tratan como obstáculos en la relajación. Ningún rótulo, demanda α/β ni distintivo P1/P2 queda debajo de ellos. Durante el desarrollo se comprobó sobre las 10 instancias con 5 y 10 clientes, en ambas disposiciones y en lienzos de teléfono, tableta y escritorio, en línea y a pantalla completa.
- **Leyenda en teléfonos** (menos de 768 px): versión compacta. En la Política 3 muestra la clave P1/P2. La barra de escala (solo en la disposición geométrica) aparece únicamente si el lienzo mide al menos 460 px de ancho, para no chocar con los controles de zoom. En los demás modelos, con un lienzo más angosto, no hay leyenda.
- **Disposición circular**: en marcos bajos o angostos el círculo se estira a elipse para que los 10 clientes no choquen.
- **Teclado**:
  - Con zoom, las flechas desplazan la vista cuando el lienzo tiene el foco (Shift para pasos largos).
  - Al recorrer los nodos con Tab, la cámara trae a la vista el nodo enfocado.

### Diferencias de comportamiento respecto de la Página 10

- **"Siguiente" desde el depósito.** Antes saltaba al segundo cliente; ahora llega al primero.
- **Modo continuo OFF.** Antes "Reproducir" se quedaba detenido en la parada. Ahora la reproducción se pausa al llegar a cada parada, y Reproducir continúa con los sub-pasos y el siguiente tramo.
- **Pausa a mitad de tramo.** El compartimiento ya no muestra una fase de parada inexistente.
- **Política 2.** Las β del fondo ya no se marcan como obstructoras.
- **Servidor.** Se agregó protección contra *path traversal* en `/api/solutions/:filename`.
