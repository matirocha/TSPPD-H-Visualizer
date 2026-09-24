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
| `npm run dev` | Vite en el puerto 3012 + API `/api/solutions` sobre `../../Outputs` (abre el navegador; `npm run dev -- --no-open` lo evita) |
| `npm run build` | Empaqueta las soluciones en `public/solutions/`, hace el typecheck y el build en `dist/` |
| `npm run preview` | Sirve `dist/` con `vite preview` en el puerto 3012 (sin API: usa `public/solutions/`); requiere un `npm run build` previo |
| `npm start` / `npm run server` | Servidor Express (API + `dist/`) en el puerto 3012, o en `PORT` si está definido; sin un `npm run build` previo solo responde la API |
| `npm run bundle` | Solo regenera `public/solutions/` desde `Outputs/` |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Valida el motor LIFO y la máquina de reproducción sobre las 80 soluciones |
| `npm run test:engine` / `npm run test:playback` | Cada validación por separado |

Sin backend (con `vite preview` o en un hosting estático como Vercel; la demo de Vercel del repositorio corresponde a la Página 10), la app usa automáticamente las soluciones empaquetadas en `public/solutions/`: 80 archivos JSON más `index.json`, es decir, 4 modelos × 5 y 10 clientes × instancias 1 a 10, con h = 0,1.

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
  lib/overlay.ts               Bloqueo de scroll y pila de capas (Esc/Tab solo en la superior)
  lib/hash.ts · models.ts      URL compartible y metadatos de los cuatro modelos
  lib/policy.ts · sanitize.ts  Política aplicada por parada y limpieza de textos del solver
  state/playback.ts            Máquina de estados de reproducción (funciones puras)
  state/SimulationProvider.tsx Catálogo, selección, coreografía y reproducción
                               (useSim, useCatalog, useProgress, useLiveMetrics)
  state/UIProvider.tsx         Hover cruzado mapa ↔ compartimiento, diálogos, paneles en foco
  hooks/                       Atajos de teclado globales y foco confinado en pantalla completa
  components/                  Secciones de la página (map/, bay/, stop/, transport/, analysis/,
                               model/, data/, ui/…)
scripts/
  solutions-api.js             Lectura de Outputs/ compartida por Vite y Express
  validate-engine.ts           Pruebas del motor sobre las 80 soluciones
  validate-playback.ts         Pruebas de la reproducción sobre las 80 soluciones
public/solutions/              Soluciones empaquetadas (las genera bundle-solutions.js)
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
