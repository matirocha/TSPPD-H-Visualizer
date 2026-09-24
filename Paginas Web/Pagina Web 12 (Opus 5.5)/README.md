# Página Web 12 · TSPPD-H Laboratorio LIFO (Opus 5.5)

Visualizador interactivo de las soluciones óptimas del **TSPPD-H** (*Traveling Salesman Problem with Pickups, Deliveries, and Handling Costs*; Battarra, Erdoğan, Laporte y Vigo, 2010, *Transportation Science* 44(3), 383–399, [doi:10.1287/trsc.1100.0316](https://doi.org/10.1287/trsc.1100.0316)).

Toma el **funcionamiento** de la Página Web 10 (misma fuente de datos, mismos modelos, misma lógica de reproducción) con un diseño y una estructura nuevos, generados con Claude Opus 5.5.

## Ejecutar

```bash
npm install
npm run dev          # http://localhost:3012 (lee Outputs/ en vivo)
```

En Windows también sirve `Paginas Web/Iniciar_Pagina_12.bat`.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Vite + API `/api/solutions` sobre `../../Outputs` |
| `npm run build` | Empaqueta las soluciones en `public/solutions/`, typecheck y build |
| `npm start` | Servidor Express (API + `dist/`) en el puerto 3012 |
| `npm run bundle` | Solo regenera `public/solutions/` desde `Outputs/` |
| `npm test` | Valida el motor LIFO y la máquina de reproducción sobre las 80 soluciones |

Sin backend (Vercel, `vite preview`), la app usa automáticamente las soluciones empaquetadas en `public/solutions/`.

## Qué hay en la página

- **Simulador**: métricas en vivo (Z* y su anatomía ruteo/manipulación, recorrido, manipulaciones, carga a bordo), mapa de ruta (geométrico por MDS desde c_ij o circular; zoom, paneo, seguimiento del camión, detalle por nodo), panel de parada con la coreografía de sub-pasos y el **compartimiento LIFO unidad por unidad**: cada pallet α/β tiene identidad propia y viaja entre su slot, el andén temporal y el cliente.
- **Dock de reproducción** con línea de tiempo proporcional a la distancia (arrastrable), velocidades 0,5×–2× y modo continuo; mini reproductor al bajar por la página.
- **Bitácora**: perfil de carga por tramo, construcción de Z* y tabla completa del tour.
- **Comparativa**: las cuatro variantes (General, P1, P2, P3) de la instancia actual y el panorama de brechas en las 10 instancias.
- **Modelo matemático**: formulaciones del paper en KaTeX (Ecs. 1–48) con el patrón de carga de cada política.
- **Datos**: matriz c_ij con los arcos del tour, tabla de nodos y parámetros.
- Catálogo de soluciones, paleta de comandos (`Ctrl K`), atajos de teclado (`?`) y URL compartible (`#/p3/10/7`).

## Arquitectura

```
src/
  lib/choreography.ts      Motor LIFO: convierte cada paso del solver en fases físicas
                           siguiendo la identidad de cada unidad durante todo el tour
  state/playback.ts        Máquina de estados de reproducción (funciones puras)
  state/SimulationProvider Datos, selección, reproducción y derivados (useSim, useProgress)
  state/UIProvider         Hover cruzado mapa ↔ compartimiento, diálogos, paneles en foco
  lib/layout.ts            MDS clásico + rotación + separación de nodos; disposición circular;
                           marco adaptativo del viewBox (frameFor) y paneles como obstáculos
  components/              Secciones de la página (map/, bay/, stop/, analysis/, model/, data/…)
scripts/
  solutions-api.js         Lectura de Outputs/ compartida por Vite y Express
  validate-engine.ts       Pruebas del motor sobre las 80 soluciones
  validate-playback.ts     Pruebas de la reproducción sobre las 80 soluciones
```

### Motor de coreografía

Los archivos de `Outputs/` traen `slotsArrival`/`slotsDeparture` y arreglos auxiliares (`deliveredSlots`, `rehandledA/B`, `newBSlots`). Estos últimos se usan solo como **pistas**: en varias soluciones vienen incompletos, con índices desplazados, o (en el modelo General) `newBSlots` indica posiciones nuevas y no recogidas. El motor resuelve una asignación consistente con los conteos del solver y valida, en las 80 soluciones y 680 paradas, que:

- la salida calculada coincide slot a slot con la del solver;
- las unidades manipuladas coinciden con `handlingCount` en cada parada;
- cada cliente recibe exactamente α_i unidades y entrega β_i;
- ninguna unidad se duplica ni se pierde en ninguna fase.

### Mapa de ruta: marco adaptativo

El lienzo del mapa no usa un viewBox fijo en todas las pantallas:

- **Escritorio** (lienzo apaisado): marco 720 × 440, igual que siempre.
- **Teléfonos y pantalla completa en vertical**: el marco adopta la proporción del lienzo, sin franjas vacías, y mantiene una escala mínima de ~0,8. Así los rótulos pasan de ~5 px a ~9 px en 375 px. El layout MDS se recalcula para ese marco y la escala baja solo si no caben las pilas de etiquetas.
- **Paneles flotantes** (HUD, leyenda y controles de zoom): se tratan como obstáculos en la relajación. Ningún rótulo, demanda α/β ni distintivo P1/P2 queda debajo de ellos. Esto se verificó en 15 instancias × 2 modelos, en 5 anchos, en línea y a pantalla completa, y en las disposiciones geométrica y circular.
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
