# Plan de rendimiento en el Samsung real · 7 de octubre de 2026

Objetivo: que una tecla del mando se vea respondida en ≤ 80 ms (P95) en el UN65M70HAGXZS, sin quitar nada de la interfaz actual: foco con elevación y halo, panel ampliado con vecinas que se apartan, carrusel del banner, filas virtuales, marcador MLB, guía de canales, tráilers opcionales. Este plan sale de medir el TV con su inspector, no del PC. Complementa `docs/AUDITORIA-RENDIMIENTO-TV-2026-10-07.md` (auditoría estática) y sustituye las prioridades de los planes anteriores en lo que se contradigan.

## 0. Lo que mide el TV hoy (línea base)

Dispositivo: Tizen 10.0, Chromium 130, 1920×1080, DPR 1, 3 hilos de trabajo para raster y decodificación. Escenario: Inicio, perfil Adulto, 20 teclas (Derecha/Abajo) cada 350 ms, ventana de 18,7 s. Datos en `artifacts/tv-measure-2026-10-07-baseline.json` y `artifacts/tv-trace-2026-10-07-baseline.json`; herramientas en `scripts/tv-measure.mjs`, `scripts/tv-scroll-ab.mjs`, `scripts/tv-enter.mjs` (apartado 4).

| Medida | Valor en el TV | Referencia PC (smokes) |
|---|---:|---:|
| Tecla → segundo RAF, P95 / P50 | **291 ms / ~205 ms** (muestras 87–435) | 33 ms |
| Tareas largas en 20 teclas | **~100**, máx. 259 ms | 0 |
| Hilo principal ocupado | 15,7 s de 18,7 s (84 %) | — |
| RasterTask | 1.690 tiles, **12,0 s de CPU** | — |
| Decode Image / ImageDecodeTask | 201 decodificaciones, **7,7 s** / 9,7 s | — |
| UpdateLayoutTree (recálculo de estilo) | 263 veces, **3,26 s**, máx. 127 ms | — |
| Layerize (árbol de capas) | 173 veces, **2,45 s** | — |
| FunctionCall / EventDispatch / TimerFire | 5,6 s / 2,4 s (1.115 eventos) / 3,3 s | — |
| Capas compuestas | 25 (~25 MB) | — |
| DOM durante la ráfaga | 497 → 840 nodos; 25 → 48 tarjetas; 19 → 45 imágenes | — |

Las tareas más largas del hilo principal esperan: `RunTask` de 410 ms de pared con 68 ms de CPU. Los tres hilos de trabajo están saturados: 12 s de raster más 7,7 s de decodificación en 18,7 s. El PC no reproduce nada de esto.

### Qué consume, con nombre (sourcemap sobre `richiflix.js`)

| Coste | Dónde | Veces / total | Por evento |
|---|---|---:|---:|
| Handler de teclado | `useRemoteNavigation.js` (`navigation`) | 16 / 1.285 ms | **80 ms**, máx. 132 |
| Apertura del panel | `useCardExpansion.js` (`show`) | 18 / 1.085 ms | **60 ms**, máx. 95 |
| React (scheduler + react-dom) | `performWorkUntilDeadline` + commits | 136 / 1.335 ms + 444 / 774 ms | 10 ms por tanda |
| Deslizamiento de scroll | `scrollGlide.js` (`tick`) | 12 / 362 ms | **30 ms por cuadro**, máx. 144 |
| `VirtualCarousel.focusIndex` | `VirtualCarousel.jsx` | 14 / 136 ms | 10 ms |
| Transiciones CSS | `transitionrun` 272 + `transitionstart` 272 + `transitionend` 244 | ≈ 14 transiciones por tecla | — |
| `load` de imágenes | 102 eventos | 5 por tecla | — |

### Invalidaciones de estilo (20 teclas)

| Cuenta | Qué |
|---:|---|
| 846 | StyleRecalc «Related style rule» en `DIV.virtual-rail-cell` (selector de hermanos `~` / propiedad `--expansion-shift` en el track) |
| 552 + 424 | StyleInvalidator sobre `.virtual-rail-cell` (clase cambiada en un hermano) |
| 407 | «Inline CSS style declaration was mutated» en `.virtual-rail-cell` (transform / transition / will-change por celda) |
| 296 / 257 | Layout: nodos de texto añadidos / quitados (celdas montadas y desmontadas) |
| 150 | Layout: `BUTTON.card-open` añadido |
| 147 | StyleRecalc «Animation» en `IMG` (fundido de pósters) |

### Capas y pintura

- `main.page-scene` (1920×527, motivo «Overlaps other composited content», no es un scroller acelerado) rasterizó 229 tiles / 1,06 s en 37 cuadros **sin scroll vertical**: su contenido cambia en cada tecla. La captura con bordes de capa (`artifacts/tv-layers-overlay-2026-10-07.png`) marca «main thread scroll repaint» en la escena, los rails y el banner, y «touch event listener: MANIPULATION» sobre cada botón (`touch-action:manipulation` global).
- `.focus-stage` es una capa de 1920×1080 (7,9 MB) aunque el banner mide 42 vh; `span.rail-edge` (degradado) es una capa de 349×309; diez `.virtual-rail-cell` de 340×259 tienen capa por el préstamo de `will-change`; el panel es otra capa de 1000×270.
- Imágenes montadas: banner con **dos fondos de 3840×2160** (33 MB decodificados cada uno) como `blob:`; pósters w342 correctos; en la sesión se pidieron 98 w342, 53 w500 (panel) y 17 `original` (banner y precarga de fondos que en TV nunca se muestra). Cada `blob:` nuevo vuelve a decodificar el mismo póster.
- Variantes CSS inyectadas en caliente (capas permanentes, scrollers opacos, sin recorte redondeado, sin transición de halo) no mueven el P95 fuera del ruido (205–330 ms): no hay una regla aislada culpable; es la suma de trabajo por tecla en el hilo principal más la saturación de los hilos de trabajo.

## 1. Diagnóstico, ordenado por milisegundos medidos

1. **La tecla es cara de forma síncrona (80–130 ms)**. En el mismo `keydown`: el cierre instantáneo del panel anterior fuerza un recálculo de estilo (`getComputedStyle` tras escribir transforms en las vecinas), `flushSync` de la ventana virtual al cruzar, lecturas de layout para revelar la fila, `focus()` que dispara 7 listeners del panel anterior y 7 del nuevo, `setSelectedCard` que re-renderiza tres tarjetas, `banner.move` que re-renderiza App en la primera tecla, y la animación de scroll que lee y escribe `scrollTop` cada cuadro (30 ms por cuadro en este TV).
2. **Tormenta de invalidación en `.virtual-rail-cell` (~2.400 en 20 teclas, 3,26 s de recálculo)**. La Fase F/F2 mueve vecinas con una propiedad en el track y un selector de hermanos, inline styles por celda, préstamos de `will-change` que se ponen y quitan, y clases `is-covered`/`is-expansion-anchor`. Cada uno invalida todas las celdas del rail. Además `data-focus-region` en `.app` e `is-browsing-rows` cambian atributos del contenedor raíz y vuelven a emparejar selectores en todas las tarjetas.
3. **Raster y decodificación saturan los tres hilos de trabajo**. La escena repinta pósters en cada tecla porque las tarjetas no son capas estables: las transiciones de `transform`/`opacity` crean y destruyen capas (Layerize 2,45 s) y cuando una tarjeta pierde su capa su póster vuelve a pintarse dentro de `page-scene`. La decodificación (7,7 s) viene de los fondos 4K del carrusel, de la precarga de fondos que en TV no se muestra, de los 53 pósters w500 del panel y de los `blob:` que se decodifican otra vez en cada montaje.
4. **La ventana virtual monta y desmonta en cada tecla** (25 → 48 tarjetas, 19 → 45 imágenes en 20 teclas): cada montaje añade texto, botón, imagen, `ResizeObserver`, un temporizador de 120 ms y una decodificación.
5. **Demasiados eventos y temporizadores por tecla**: ~55 eventos (transiciones, focus, scroll, load) y una docena de temporizadores (120, 150, 180, 240, 480, 600 ms) que mutan el DOM en momentos distintos, cada uno con su recálculo y su Layerize.

## 2. Objetivos de aceptación, medidos en el TV con `scripts/tv-measure.mjs`

| Medida | Hoy | Objetivo |
|---|---:|---:|
| P95 tecla → segundo RAF, cadencia 350 ms | 291 ms | **≤ 80 ms** (P50 ≤ 50) |
| Ídem, cadencia 120 ms (`--gap=120`) | sin medir | ≤ 120 ms |
| Tareas largas por tecla | ~5 | ≤ 1, ninguna > 100 ms |
| Raster por tecla (CPU) | ~600 ms | ≤ 150 ms |
| Decodificación en navegación horizontal dentro de la ventana | ~380 ms por tecla | ≤ 40 ms; 0 decodificaciones de `original` |
| UpdateLayoutTree por tecla | 160 ms | ≤ 10 ms; ≤ 20 invalidaciones de `.virtual-rail-cell` |
| Capas antes / después de 20 teclas | 19 → 25 | diferencia ≤ 2; sin capas transitorias por transición de tarjeta |
| Tarjetas montadas durante navegación horizontal | 25 → 48 | constante ± 2 |
| Memoria de imágenes decodificadas | 55–150 MB | ≤ 45 MB |

## 3. Fases

Las fases son acumulativas y cada una se mide en el TV antes de la siguiente. Ninguna quita funciones visibles; donde una técnica cambia la sensación, se dice.

### R1. La tecla deja de ser cara (JS del camino crítico)

Archivos: `useRemoteNavigation.js`, `useCardExpansion.js`, `cardExpansionSpace.js`, `cardExpansion.js`, `motionLayers.js`, `scrollGlide.js`, `virtualViewport.js`, `cardSelectionStore.js`, `useBannerMotion.js`, `interactions.jsx` (sólo clases de Card), `expandedCard.css`, `compositorMotion.css` (sólo reglas de celdas y del `.card-open`).

1. **Vecinas por Web Animations, no por estilos**: `reserveCardExpansion` desplaza cada vecina visible con `cell.animate([{transform:'none'},{transform:'translate3d(…)'}],{duration,fill:'forwards',easing})` y guarda las animaciones; el cierre instantáneo es `animation.cancel()` (sin transición, sin `getComputedStyle`, sin inline `transition`), el tranquilo es `animation.reverse()`. Se elimina `leaseTransformLayers` en TV (las animaciones de transform se componen solas), el selector `.is-expansion-anchor ~ .virtual-rail-cell`, `--expansion-shift`/`--expansion-shift-left` y `data-expansion-end` del track, y las clases por celda. Las vecinas fuera del viewport no se animan: se posicionan con `animate` de duración 0. Lo mismo para `is-covered` (opacidad por WAAPI).
2. **Cierre del panel sin trabajo síncrono en el `keydown`**: el evento `richiflix-catalog-navigation` sólo marca `hide` pendiente; la limpieza real corre en el siguiente `requestAnimationFrame` junto con la apertura del siguiente panel, en un solo lote de escrituras.
3. **Un único juego de listeners** (`focusin`, `pointermove`, `scroll`, `resize`, navegación, layout, visibilidad) registrado una vez en `useCardExpansion` a nivel de módulo, que delega en el controlador de la tarjeta seleccionada; hoy se añaden y quitan 14 listeners por tecla.
4. **Selección sin `leaving`**: `setSelectedCard` notifica a dos tarjetas, no a tres; la salida rápida de la tarjeta anterior se logra con la capa permanente de R3 (sin render extra a los 240 ms).
5. **Primera tecla sin render de App**: `banner.moving` deja de ser estado de React para la clase `is-browsing-rows`; el hook escribe el atributo en el nodo raíz directamente y sólo publica estado React en el reposo (480 ms). `data-focus-region` pasa de `.app` a un atributo en `document.body` y las reglas CSS que lo usan se acotan al elemento seleccionado (ver R2.3).
6. **Scroll de filas en el compositor**: `glideViewportBy` anima `transform: translate3d(0, -delta, 0)` del contenido de la escena con WAAPI (un solo cuadro de layout al terminar: `scrollTo` instantáneo + quitar el transform en el mismo cuadro). Sin lectura ni escritura de `scrollTop` por cuadro. Si el TV muestra costuras, alternativa: `scrollTo` instantáneo alineado a fila y fundido de 80 ms del contenido; la fila ya se alinea arriba, así que la posición final es la misma.
7. **`focusIndex` sin lecturas**: la geometría de la celda sale del modelo (ya existe); se elimina la lectura de `scrollLeft` cuando la celda está dentro de la ventana calculada; `revealRailCard` lee el rect del rail una vez por fila y lo cachea hasta que cambie el layout.

Medida de salida: `keydown` ≤ 8 ms en la traza; `show` ≤ 15 ms; 0 `getComputedStyle` forzados; `scrollGlide` sin `tick` en el hilo principal.

**Implementado (7 oct, sin medir aún en el TV).** 1: `cardExpansionSpace.js` mueve vecinas con `cell.animate(shiftFrames(x),{fill:'forwards'})` en TV y en PC (plan puro `neighbourMotions`/`neighbourDurations` en `cardExpansion.js`: TV 110/80 ms, Samsung 90/60, PC 220, reduced-motion 0; celdas no visibles antes ni después, duración 0; `is-covered` → opacidad WAAPI; las celdas que monta el scroll del rail reciben el desplazamiento con un `MutationObserver` del track). Cierre instantáneo = `cancel()`; tranquilo = `reverse()` y `cancel()` al llegar. Eliminados: `motionLayers.js` (+ prueba) y `leaseTransformLayers`, `--expansion-shift`, `--expansion-shift-left`, `data-expansion-end`, `.is-expansion-anchor`, `.is-covered`, el selector `~`, las transiciones de celda (`expandedCard.css`) y todo `style.transform/transition/willChange` por celda y el `getComputedStyle` de limpieza. 2–3: `createExpansionHub` (en `cardExpansion.js`) instala una vez 7 listeners (`focusin`, `pointermove`, `scroll`, `resize`, navegación, layout, visibilidad) y delega en los controladores registrados; por tecla se añaden/quitan **0** listeners (antes 14). La navegación y el foco que sale sólo marcan el cierre; el cierre y las reservas de la tarjeta abandonada (`retire`) corren en el siguiente `requestAnimationFrame`, o en el lote de la apertura siguiente (`flushRetired`). `show()` espera si la escena está deslizándose. 4: `cardSelectionStore` sin `leaving`/`leaveMs`/temporizador; `setSelectedCard` notifica a 2 tarjetas; `.is-leaving` fuera. 5: `useBannerMotion` escribe `.is-browsing-rows` en `.app` desde el flujo y sólo publica estado React al terminar la ráfaga; `moving`/`collapsed` se leen en vivo del flujo, así que los consumidores de App siguen viendo `moving=true` en cualquier render de la ráfaga. Límite: en TV la primera tecla sigue renderizando App por `setPreviewActive(false)` de `preview` (fuera de este alcance); ese render ya agrupa el cambio. `data-focus-region` pasa a `body` (reglas en `compositorMotion.css` acotadas a `.card.is-previewed`); `cardFocus` no cambia por tecla (sólo al entrar/salir de tarjetas) y se deja. 6: en `.tv-mode .page-scene`, `glideViewportBy` hace un único `scrollTo` instantáneo y, en la misma tarea, anima `.content` de `translate3d(0,destino−dibujado)` a 0 (`glideFrames`, `glideShiftAt`; `TV_GLIDE_MS` intacto); `viewportOffset` devuelve el desplazamiento dibujado, así que un cambio de destino a mitad parte de donde se ve. Desviación deliberada: el `scrollTo` va al principio y no en `finish`, para que filas y rejilla virtuales monten el destino antes de verse (con el `scrollTo` al final la fila entrante se veía vacía hasta acabar); el contrato es el mismo: una escritura de scroll por movimiento, ninguna por cuadro. `createScrollGlide` sigue para la ventana (PC) y otros scrollers. 7: `focusIndex` usa el desplazamiento del rail cacheado (último `refresh` o `scrollTo` propio; un evento `scroll` lo invalida) cuando la celda ya está montada; `revealRailCard` cachea la posición de la fila dentro del contenido hasta que un `ResizeObserver` del contenido avise. Comprobación local (Chromium de escritorio, fixture, sin smokes): 2 `transitionrun` por tecla (10 en 5 teclas), vecinas sin estilos en línea, panel y F2 correctos.

### R2. Estilo e invalidaciones acotadas

Archivos: `style.css` (bloques `.tv-mode`), `compositorMotion.css`, `virtualCatalogue.css`, `App.jsx` (atributos raíz), `useRemoteNavigation.js` (`remember`).

1. `contain: layout style paint` en `.virtual-rail-cell`, `.virtual-grid-cell` y `.card` en TV (tamaño fijo conocido): un cambio dentro de una celda no recalcula las demás. `contain: layout style` en `.catalog-row` y `.live-hub`.
2. `touch-action: manipulation` sólo fuera de `.tv-mode` (quita 50 regiones de hit-test).
3. Las reglas que dependen de atributos del contenedor (`[data-focus-region]`, `.is-browsing-rows`, `.has-tv-stage`, `.kids-space` sobre `.card-open:after`) se reescriben para depender de una clase en la propia tarjeta seleccionada o en el banner, no en un ancestro común a 40 tarjetas.
4. Una sola transición por tecla en la tarjeta: `transform` de `.card-open` (la entrada) y `opacity` del halo; la salida y todo lo demás sin transición. Objetivo: ≤ 3 `transitionrun` por tecla (hoy 14).
5. `.poster-title` sin `text-shadow` en TV (sombra plana de 1 px si hace falta contraste); `.tv-stage h1` sin `text-shadow`.

Medida de salida: UpdateLayoutTree ≤ 10 ms por tecla; invalidaciones de `.virtual-rail-cell` ≤ 20 por tecla.

**Implementado (7 oct).** 1: `contain:layout style` en `.tv-mode .virtual-rail-cell/.virtual-grid-cell` (`virtualCatalogue.css`) y en `.tv-mode .card/.catalog-row/.live-hub` (`style.css`; en Samsung `.card` y `.catalog-row` ya lo tenían). Sin `paint`: la elevación `translateY(-6px) scale(1.06)` y el halo sobresalen ~15 px de la celda y se recortarían (comprobado en la fixture: el botón elevado excede la celda). 2: `touch-action:auto` en `.tv-mode` y `.samsung-tv` para `button,a,input,textarea,select` (el reproductor conserva sus `none`). 3: las dos reglas de `[data-focus-region]` dependen ahora de `body[data-focus-region]` y sólo de `.card.is-previewed`; no quedan reglas de tarjeta colgadas de `.is-browsing-rows`, `.has-tv-stage` ni `.kids-space`. 4: en TV `.card-open` y su halo no tienen transición en reposo; sólo `.is-previewed` transiciona `transform` (`--tv-base`) y la opacidad del halo (`--tv-fast`): la salida es instantánea. Fuera también la transición de color del título de fila en TV y el fundido del póster al cerrar el panel (se conserva al abrirlo). Quedan **2 transiciones por tecla** (antes ~14). 5: `.tv-mode .poster-title` y `.tv-mode .tv-stage h1` sin `text-shadow`.

### R3. Capas estables y raster mínimo

Archivos: `compositorMotion.css`, `tvCardComposition.css`, `style.css`, `QualityImage.jsx` (fundido), `FocusStage.jsx`/`BannerArtwork.jsx` (tamaño de capa), `virtualCatalogue.css`.

1. **Capa permanente por tarjeta montada** en TV: `.card-open{will-change:transform}` y halo `:after{will-change:opacity}` para todas las celdas montadas (≤ 48 × 0,26 MB ≈ 12 MB). Sin promociones ni degradaciones por tecla: el raster de una tarjeta ocurre una vez al montarse. Si Chromium no vuelve a rasterizar a escala 1,06 el póster enfocado se verá un 6 % más suave: se comprueba a distancia de sofá; si molesta, el halo único por rail (una capa que se mueve con `translate3d`) y escala sólo en la imagen.
2. **Celdas sin capa propia** (`.virtual-rail-cell`) salvo durante una animación WAAPI (R1.1).
3. **Sin capas accidentales**: `span.rail-edge` fuera en TV (degradado al borde del rail: 349×309 de capa); el banner reserva exactamente 42 vh (capa 1920×454 en vez de 1920×1080); el fundido de pósters (`.18s`) sólo si se mostró el velo de identidad (carga lenta), y entonces dentro de la capa de la tarjeta.
4. **La escena no repinta por tecla**: con 1–3, `page-scene` sólo cambia al desplazarse; la medida es `paintDelta` de esa capa ≈ 0 en navegación horizontal.
5. Reglas `will-change` acotadas a `.tv-mode`; en PC se conserva el comportamiento actual.

Medida de salida: raster ≤ 150 ms por tecla; Layerize ≤ 20 ms por tecla; capas antes/después ±2.

**Implementado (7 oct, sin medir aún en el TV).** Desviación deliberada de R3.2 escrito arriba: las celdas TV **sí** son capas permanentes (`will-change:transform,opacity`), porque la vecina que R1.1 desplaza con WAAPI creaba y destruía una capa en cada apertura. 1 (`compositorMotion.css`): `.tv-mode .virtual-rail-cell/.virtual-grid-cell .card-open{will-change:transform}` y su `:after{will-change:opacity}`; fuera el `will-change` condicional de `.is-previewed` y el `will-change:auto` de `body[data-focus-region]`. El foco sólo cambia `transform` y la opacidad del halo, ya compuestos: la elevación es un escalado GPU de la trama 1× (≈ 6 % más blanda en el póster enfocado; perilla `--tv-focus-scale`, 1 = sin escala). Halo con capa propia frente a sin ella (fixture, 5 teclas): sin capa, o su transición crea una capa transitoria por tecla o, sin transición, re-rasteriza el `.card-open` al entrar y al salir (2 tramas de tarjeta por tecla, 20–42 ms cada una en el TV); con capa, 0 tramas por ≈ 0,22 MB por tarjeta. Elegido con capa; si la memoria aprieta, quitar esa regla del `:after` es la perilla. 2 (`virtualCatalogue.css`): celdas TV `will-change:transform,opacity`; el `opacity` mantiene fijo el nodo de efecto del fundido `is-covered` (WAAPI): crearlo en cada apertura re-rasterizaba las celdas tapadas (2 tramas por celda y tecla en la rejilla). 3: `.tv-mode .rail-edge{display:none}`. La «celda 1820×259» y el «`rail-edge` 39×3975» del TV no eran un elemento: eran capas de solape («Overlaps other composited content») que agrupaban todo lo pintado después de una celda compuesta (las celdas siguientes, o los bordes de todos los rails); con todas las celdas compuestas no existen (no aparecen en la fixture). El banner ya mide lo que debe: `top:0; height:calc(100px + 42vh)` = 1920×554 (incluye los 100 px bajo la cabecera transparente), `focus-stage-visual` con `inset:0` dentro de `overflow:hidden; contain:paint`, y la `is-next` a opacidad 0 no se pinta; la capa 1920×1080 que el harness atribuye a `section.hero.focus-stage` es la del *visual viewport* («Is for the visual viewport», raíz): el banner no está compuesto, se pinta en ella. Sin cambio en `FocusStage.jsx`/`BannerArtwork.jsx`. Hallazgo adicional (`expandedCard.css`): el fundido de opacidad .12 s del póster y la leyenda de la tarjeta ancla al abrir el panel creaba dos capas transitorias y, al cambiar la capización, **re-rasterizaba todas las celdas visibles** en cada apertura; en TV se ocultan ahora con `visibility:hidden` diferido `--tv-base` (cuando el panel ya es opaco; sin capa, sin trama de las vecinas). 4 (`style.css`): `.tv-mode .poster .quality-media>img{transition:none!important}`; con velo mostrado (QualityImage lo retiene 220 ms) el velo pasa encima (`z-index:1`) y se funde .18 s sobre el póster ya visible: la `img` nunca se anima (0 transiciones de IMG). El velo de carga en TV no muestra el PNG de categoría (1672×941, 1,6–1,9 MB, no hay variante pequeña en `public/artwork/categories`): degradado + glifo + título mientras el estado es `loading`/`pending`/`ready`; el PNG sigue en el aspecto final sin imagen (`empty`, `unavailable`, `low-resolution`). Límite: `display:none` evita su pintado y su raster escalado, no su decodificación (`QualityImage` llama a `decode()`); quitarla exige no montar `CategoryArtwork` en el velo (`ContentIdentity.jsx`, fuera de mi lista) o un PNG de 320×480 por categoría (trabajo de assets). Además, las imágenes del panel TV aparecen sin su propio fundido .25 s (`.expansion-tv .quality-media[data-image-state]>img{transition:none}`): ya entran con el fundido del panel y cada una creaba una capa transitoria por apertura. 5: medida en la fixture (`scripts/virtual-catalogue-fixture.html`, Chromium headless 1920×1080, 10 Derecha cada 350 ms tras enfocar la primera tarjeta; el panel se abre en cada tecla; lecturas de `LayerTree` y una traza, sin smokes; guion en el scratchpad de la sesión):

| Fixture, 10 teclas | Rails antes → después | Rejilla antes → después |
|---|---:|---:|
| Capas antes / después de las teclas | 22 / 27 → **94 / 94** | 26 / 15 → **106 / 106** |
| Capas nuevas / desaparecidas | 18 / 13 → **1 / 1** (el panel) | 6 / 17 → **1 / 1** (el panel) |
| Capas transitorias vistas durante las teclas | 171 → **9** | 109 → **6** |
| `paintCount` de la escena (contenido de `main.page-scene`) | +54 → **+0** | +77 → **+0** |
| `transitionrun` (de ellas en IMG) | 64 (14) → **50 (0)** | 42 (7) → **35 (0)** |
| RasterTask en 5 teclas (tiles / ms CPU) | 508 / 177 → **114 / 52** | 609 / 251 → **104 / 40** |
| Memoria estimada de capas (w×h×4, recortado al viewport) | 27,3 → 40,7 MB (28 celdas) | 16,7 → 32,1 MB (32 celdas) |

Lo que queda por tecla en la fixture es el panel (un `section.card-expansion` nuevo por apertura, inevitable) y 5 transiciones: `transform` del `.card-open` y opacidad del halo (compuestas, sin capa nueva), y la `visibility` diferida del póster y la leyenda ancla (discreta, sin capa). Memoria: ≈ 0,48 MB por celda montada medida (celda + `.card-open` + halo, pósters 210×315); 48 celdas ≈ 23 MB en el peor caso, dentro del presupuesto de 38 MB. Fuera de alcance y visto: el giro del carrusel (por tiempo, no por tecla) crea capas transitorias para la `.focus-stage-visual` entrante (1920×554) y las cuatro líneas de `stage-copy-in`; hacerlas permanentes costaría ≈ 4 MB por capa.

### R4. Imágenes al tamaño de pantalla y decodificadas una sola vez

Archivos: `artwork.js`, `responsiveArtwork.js`, `artworkCacheClient.js`, `useCachedArtwork.js`, `artworkPrefetch.js`, `previewArtwork.js`, `App.jsx` (`warmArt`), `ExpandedCard.jsx` (tamaño de la media), `BannerArtwork.jsx`, `Boot.jsx`.

1. Fondos del banner en TV en **`w1280`** (0,9 MP, 3,7 MB) en lugar de `original` (hasta 33 MB); el 66 % izquierdo del banner queda bajo el degradado, así que la pérdida no se ve desde el sofá. Si en el TV el lado derecho se ve blando, `w1280` para la siguiente diapositiva y `original` sólo para la actual tras 2 s de reposo.
2. **No precargar fondos en TV** (`warmArt && !tv`): en TV el banner no sigue a la tarjeta y el panel usa el póster.
3. **Una URL `blob:` por recurso durante toda la sesión** (registro LRU de 96 entradas, revocación sólo al expulsar): el mismo póster no se vuelve a decodificar al volver a entrar en la ventana. Alternativa equivalente: usar la URL http cuando el póster ya se mostró en esta sesión (`shownArtwork`), porque está en la caché de memoria del navegador.
4. **Panel ampliado con el póster ya decodificado**: en TV la media del panel reutiliza el `w342` de la tarjeta (ampliado 1,34× por CSS) y pide `w500` sólo tras 600 ms de reposo con el panel abierto; hoy cada apertura decodifica un w500.
5. **Precarga direccional en TV**: sólo la siguiente fila (≤ 8 pósters), concurrencia 2, y nunca mientras haya decodificaciones pendientes de la ventana visible; se cancela al cambiar de fila.
6. Presupuesto de píxeles decodificados ≤ 45 MB por pantalla, comprobado con `decodedImagePixels` del harness.

Medida de salida: decodificación ≤ 40 ms por tecla; 0 peticiones `original` en TV; `images` del banner = 1280×720.

**Implementado (7-10-2026, sin medir aún en el TV).**
- R4.1 `artworkURL(v,true,tv=isTVBuild)` reescribe a `TV_BACKDROP_SIZE='w1280'` en el build Tizen (todos los fondos pasan por ahí: banner, siguiente diapositiva, detalle, precarga; `metadata.js` guarda `original` y no necesita cambio). PC conserva `original` (también en «Modo TV» del PC). Trampa evitada: `responsivePosterArtwork` adaptaba cualquier `/w\d+/` y habría convertido el `w1280` de un banner de 1920 px en `original`; ahora devuelve `null` para `w1280` (`isScreenBackdrop`). La guarda de calidad de `QualityImage` (nunca ampliar) ocultaba un `w1280` en 1920 px: los `w1280` y `fixedSrc` se aceptan ampliados.
- R4.2 `warmArt&&!tv` en `preparePreview`; `Boot` no precarga el fondo del primer título en TV (sí sus metadatos). La siguiente diapositiva del carrusel sigue pintándose por adelantado en `FocusStage` (`BannerArtwork` `is-next`), ahora en `w1280`.
- R4.3 Elegido el registro LRU de 96 URL `blob:` en `artworkCacheClient` (se revocan sólo al expulsar, `forget` o `dispose`) más `peek` síncrono en `useCachedArtwork`; y, si no hay Blob retenido pero `shownArtwork` tiene la URL http, se usa la http. Motivo: sólo la alternativa http dejaría la caché de disco sin efecto en la primera visita y cambiaría de URL (otra decodificación) al pasar de red a Blob; el registro conserva la misma URL toda la sesión. Sin revocación por perfil/conexión: son imágenes públicas de TMDB.
- R4.4 Panel en TV: `tvPanelPoster` da el `w342` de la tarjeta (`fixedSrc`, `object-fit:cover` ≈ 1,34×, misma clave → mismo Blob o misma URL http); tras `PANEL_SHARP_DELAY_MS=600` con el panel abierto se apila encima un `QualityImage` `w500` sin velo (temporizador cancelado al cerrar o cambiar de tarjeta). Sin CSS nuevo: `.expansion-media>.quality-media` ya es absoluta. PC sin cambios.
- R4.5 `tvPrefetchOptions` (`concurrency:2`, `queueLimit:8`, `ready`: ningún `.poster-art[data-image-state=loading]` montado; reintento cada 200 ms). En TV sólo la siguiente fila en la dirección (rail o rejilla), sin las 8 siguientes del rail actual; `prefetch.clear()` inmediato al cambiar de `.catalog-row`. PC conserva la Fase G.
- R4.6 `__richiflixPerformance.snapshot().resources.artworkCache` añade `blobUrls` y `decodedImagePixels` (presupuesto 45 MB ≈ 11,8 Mpx); el harness ya calcula `dom.decodedImagePixels`.
- R4.7 `cacheableArtwork` ya admite `w1280` (prueba añadida); `remember` lo guarda al mostrarse. Límites 400 / 64 MB sin cambios.
- Pendiente de medir en el TV: que el mismo `blob:` reutilizado no se re-decodifique (el harness cuenta `Decode Image`); si Blink lo decodificara igualmente, la perilla es usar siempre la http mostrada (`initialArtwork`).

### R5. Ventana virtual sin churn

Archivos: `virtualWindow.js`, `VirtualCarousel.jsx`, `VirtualCatalogue.jsx`.

1. **Histéresis**: la ventana del rail sólo se recalcula cuando el foco cruza un umbral de 2 celdas respecto a la última ventana; en navegación horizontal dentro del rail no se desmonta nada.
2. **Overscan fijo y simétrico** (3 por lado) ya al montar la fila, de modo que las primeras teclas no monten celdas.
3. **Reutilizar nodos**: las celdas que salen por un lado se reutilizan para las que entran por el otro (misma `key` por posición de slot, no por id) con la `Card` memoizada; cambia `item`, no el DOM. Esto elimina los 296/257 textos y 150 botones añadidos/quitados por ráfaga.
4. Las filas lejanas conservan su ventana montada mientras la fila esté a ≤ 1 pantalla; hoy entran y salen con el margen de 280 px.

Medida de salida: tarjetas montadas constantes ±2 en 20 teclas horizontales; `load` ≤ 1 por tecla.

**Implementado (7 oct, sin medir aún en el TV).** 1–2: `railWindow` tiene tamaño fijo ⌈viewport/paso⌉+2·overscan (14 a 1920 px), desplazado hacia dentro en los extremos (una fila recién montada ya trae sus 3 celdas de overscan: las primeras teclas no montan nada) y recibe `previous`: la ventana vigente se conserva mientras las celdas visibles guarden overscan−band (=1) celdas de margen; al salir se rehace por delante del movimiento (1 detrás, 5 delante), mismo tamaño. Prueba pura: 20 Derecha desde 0, 8 celdas visibles, overscan 3 → **2 cambios**. `rowWindow` igual en cuadrícula: ⌈viewport/fila⌉+2·overscan filas (overscan 1 en TV, 2 en PC, ≤ 40 tarjetas), y se conserva mientras la vista ±media fila quepa en ella; un cambio de columnas o de alto de fila la invalida. 3: `assignSlots(previous,keys,reuse)` (puro): cada clave (id del item) conserva su slot mientras siga en la ventana, las que entran toman los slots que liberan las que salen; las celdas usan `key=s<slot>`, `instanceId` sigue siendo `${id}:${item.id}`, `data-virtual-index` y `left` cambian con el item. La tarjeta enfocada y la del panel nunca cambian de nodo (siguen en la ventana, con `pinWindowFocus`). En TV las celdas se pintan en orden de slot (React no mueve nodos); en PC en orden de índice (Tab). La celda «Ver todo» lleva su propia `key`, fuera del grupo y la última: con ella dentro, un rail que montó antes de recibir sus títulos dejaba «Ver todo» en el slot 0, primero en el DOM, y `test:tizen` (que enfoca el primer `.card-open` de «Películas») abría la cuadrícula en vez del reproductor. Tras reciclar, el orden DOM de un rail deja de ser el de índice (la navegación usa índices y memorias, no el primer nodo). Desviación deliberada: asignador por id en vez de `slot=index%capacidad`, porque el foco fijado fuera de la ventana colisionaría con otro índice y un filtro (cuadrícula) cambia los índices; con id, el foco filtrado conserva su nodo. Límite con el panel: `cardExpansionSpace` (fuera de mi alcance) desplaza con su `MutationObserver` sólo las celdas añadidas, así que el `refresh` disparado por el scroll del propio rail (p. ej. el scroll de `makeRoom` al abrir el panel) no reutiliza (`reuse=false`: las entrantes son nodos nuevos); la ventana que decide la tecla sí reutiliza, y si quedaba un panel abierto su `cancel()` corre en el rAF siguiente, antes de pintar. 4: el `IntersectionObserver` de cercanía usa `rootMargin:'100% 0px'` (una pantalla; antes 280 px) y sólo actúa en cambios; `warmNear` conserva su margen. 5: `focusIndex` calcula la ventana del desplazamiento al que llega la tecla (`flushSync` sólo si la celda no existe), así que el `scroll` posterior del rail encuentra la ventana igual; `setIndices`/`setPosition`/`setNear` sólo se llaman si cambian (comparación por ref, sin actualizador que fuerce render). La escena hace un único `scrollTo` por movimiento (R1.6) → un `refresh` de la cuadrícula.

Fixture (`scripts/virtual-catalogue-fixture.jsx`, TV, Chromium headless 1920×1080, lecturas y capturas, sin smokes; antes → después):

| Medida | Antes | Después |
|---|---:|---:|
| Tarjetas montadas, 20 Derecha en un rail (página con 3 rails) | 25 → 29 | **31 constante** |
| Celdas añadidas / quitadas en esas 20 teclas | 14 / 10 (14 `.card-open` nuevos) | **0 / 0** (0 botones) |
| Renders de `VirtualCarousel` en esas 20 teclas | 14 (1 por tecla desde la 7.ª) | **4** (teclas 7, 12, 16 y 20: el primer desplazamiento del rail cambia `position.start` y los cambios de ventana; 0 en las otras 16) |
| Nodos de celda originales tras 40 teclas y el salto circular 0 → 26.999 | — | 14 de 14 |
| Cuadrícula, 12 teclas (6 Abajo + 6 Derecha) | 24 → 40; 40 celdas añadidas / 24 quitadas | **32 constante; 0 / 0**; 1 render por Abajo, 0 por Derecha |
| Vertical (6 teclas entre 3 rails) | 29↔40; 37 / 27 | 31↔45; 42 / 29 (más filas montadas por la banda de una pantalla; el vaivén es el rail que sale de esa banda) |

Comprobado tras reciclar: Enter abre exactamente el título enfocado (rail tras 20 teclas, tras el salto circular y cuadrícula; `data-content-id` del botón = item), foco, `is-previewed` único, panel con su dueño y vecinas desplazadas (rail, F2 y cuadrícula), favoritos (la fixture ahora tiene `toggle` con estado) sólo en su item, filtros de la cuadrícula conservando el foco, y PC sin regresiones (comparado con la copia previa: mismo comportamiento; en PC el scroll del rail no reutiliza, como antes). En el TV debería verse: «Added to layout #text», `BUTTON.card-open` y `DIV.poster` añadidos ≈ 0 en navegación horizontal, `load`/Decode sólo por pósters realmente nuevos (el `<img>` sí se cambia con el item: `QualityImage` usa `key={src}`), y menos `performWorkUntilDeadline`.

### R6. Menos React por tecla y por reposo

Archivos: nuevo `metadataStore.js`, `App.jsx`, `interactions.jsx`, `QualityImage.jsx`, `VirtualCarousel.jsx`, `VirtualCatalogue.jsx`, `LiveHub.jsx`.

1. **Metadatos por id con suscripción** (como `cardSelectionStore`): `publishPreview` escribe en el almacén y cada `Card` lee sólo su id. `VirtualCarousel`, `VirtualCatalogue` y `LiveHub` dejan de recibir `metadata`/`resolvedMetadata`; una respuesta re-renderiza una tarjeta, no nueve rails.
2. `DecodedImage` con `memo`; `fallback` creado con `useMemo` por `item.id`; `priority` sólo si cambia antes de la carga.
3. `setFeatureDetails` agrupado por tarea (acumular en ref y vaciar con `setTimeout(0)`).
4. App ≤ 2 renders por reposo y 0 por tecla (verificable con `?diagnostics=1` → `cardRenders` y un contador de renders de App en el harness).

### R7. Limpieza de costes menores (cada uno ≤ 1 h)

`wicg-inert` sólo si falta `inert` nativo; `filter: drop-shadow` de los escudos MLB → sombra en el PNG o pseudo-elemento sin desenfoque; iframe de YouTube destruido tras 10 s inactivo; `QualityImage` usando `contentRect` del `ResizeObserver` en lugar de `getBoundingClientRect` tras decodificar; `transition: color` del título de fila fuera en Samsung; `IntersectionObserver` por rail con `rootMargin` menor (383 cálculos en 20 teclas).

**Implementado (7 oct).** (a) `main.jsx`: `if(!('inert' in HTMLElement.prototype))import('wicg-inert')`; en Tizen (IIFE, `inlineDynamicImports`) el polyfill queda en el paquete pero no se ejecuta (Chromium 130 tiene `inert`); en PC es un chunk aparte. (b) `.tv-mode .mlb-mark>img,.expansion-tv .mlb-mark>img{filter:none}` (`style.css`): sin sombra en TV, opción «nada»; si se echa de menos, un `:before` elíptico con `radial-gradient` y `z-index:-1` dentro del `quality-media` (aislado) la imita sin desenfoque. (c) `TrailerPreview.jsx`: si `play` sigue falso `IDLE_MS`=10 s (foco recorriendo tarjetas, título sin tráiler, banner pausado) se llama a `destroy()` (iframe, reproductor y decodificador fuera); el efecto de creación lo rehace en el siguiente `play`, así que el ajuste «Tráilers automáticos» y la espera previa no cambian. (d) `imageObserver.js` entrega el `ResizeObserverEntry`; `QualityImage` guarda su `contentRect` y lo usa tras decodificar (y como ancho responsive) en lugar de `getBoundingClientRect()`/`clientWidth`; si la decodificación llega antes que la primera observación, sigue leyendo el rect. Efecto lateral: la caja medida es la de layout, sin la escala 1,06 del foco. (e) Ya hecho en R2 (`.app.tv-mode .catalog-row h2{transition:none}`, cubre Samsung); no queda `transition:color` de títulos de fila en TV. (f) No aplicado: `VirtualCarousel.jsx` es de R5, que fijó deliberadamente el `IntersectionObserver` de cercanía en `rootMargin:'100% 0px'` (R5.4, sólo actúa en cambios); reducirlo a 120 px contradiría su ventana conservada.

### R8. Medición continua y entrega

1. `npm run measure:tv` ejecuta `scripts/tv-measure.mjs --ab` (requiere el inspector en `127.0.0.1:9227`, apartado 4) y guarda `artifacts/tv-measure-<fecha>.json`; el informe de cada fase incluye su tabla contra la línea base.
2. Tras cada ola: `npm test`, builds, instalación como actualización en el 65", relanzamiento en depuración, tres corridas del harness, comparación. Sin smokes de Playwright/Electron en esta ronda (petición de Richard); las pruebas unitarias y el TV son la verificación.
3. Cierre: tabla final hoy/después, capturas del TV (`Page.captureScreenshot`) de Inicio, panel abierto y MLB, y actualización de este documento.

## 4. Cómo medir en el TV (procedimiento verificado hoy)

```
# 1. Detener la app y relanzarla en depuración (imprime el puerto del inspector)
sdb -s 192.168.1.12:26101 shell 0 was_kill Richiflix1.Richiflix
sdb -s 192.168.1.12:26101 shell 0 debug Richiflix1.Richiflix      # "... port: NNNNN" (tarda 10–40 s)
sdb -s 192.168.1.12:26101 forward tcp:9227 tcp:NNNNN
# 2. Entrar al perfil Adulto y comprobar entorno
node scripts/tv-enter.mjs
# 3. Medir (métricas, capas, traza de 20 teclas, variantes A/B inyectadas)
node scripts/tv-measure.mjs --ab            # --overlay añade la captura con bordes de capa; --gap=120 cadencia rápida
node scripts/tv-scroll-ab.mjs               # variantes para el scroll vertical
```

`sdb` está en `C:\Users\richa\.tizen-extension-platform\server\sdktools\data\tools\sdb.exe`. `shell 0 debug` sin detener antes la app no responde; `tz run -d` tampoco activa la depuración si la app ya corre. Las evaluaciones del inspector caducan a los 15 s: el harness envía las teclas en tandas de cinco. La traza llega por `Tracing.dataCollected` (el TV no admite `ReturnAsStream`).

## 5. Orden de ejecución y propiedad de archivos

- **Ola 1, en paralelo**: R1 + R2 (agente A: camino de la tecla, animaciones WAAPI, contención, atributos; archivos de R1 y R2) y R4 (agente B: imágenes; archivos de R4). Sin archivos compartidos: `App.jsx` sólo lo toca B en la línea de `warmArt`; A toca `App.jsx` sólo para los atributos raíz, en una función aislada; se coordinan por `SendMessage` si hace falta.
- **Medición 1** (yo): instalar, relanzar en depuración, tres corridas.
- **Ola 2, en paralelo**: R3 + R7 (agente C: CSS de capas y limpieza) y R5 (agente D: ventana virtual).
- **Medición 2**.
- **Ola 3**: R6 (agente E: almacén de metadatos y renders).
- **Medición 3 y cierre**.

Cada agente: `npm test` y builds en verde; sin smokes de Playwright/Electron; sin tocar el TV; informe con el coste que ataca, el cambio y cómo se verá en el harness.

## 6. Medición 1 · tras la ola 1 (R1, R2, R4) · 7 de octubre, 04:15

Mismo escenario que la línea base (Inicio, 20 teclas cada 350 ms). Archivos: `artifacts/tv-measure-2026-10-07-ola1-run1.json` y `-run2.json`.

| Medida | Línea base | Ola 1 (run 1 / run 2) |
|---|---:|---:|
| P95 tecla → segundo RAF | 291 ms | 246 / **183 ms** (P50 114) |
| Tareas largas en 20 teclas | ~100 (máx. 259) | 57 (máx. 189) |
| Raster | 12,0 s / 1.690 tiles | 11,0 / **10,5 s** / 1.540 tiles |
| Decode Image | 7,7 s / 201 | 4,3 / **3,1 s** / 107 (máx. 199 ms) |
| UpdateLayoutTree | 3,26 s | **1,24 s** (máx. 55) |
| Layerize | 2,45 s | 1,87 s |
| FunctionCall / EventDispatch / TimerFire | 5,6 / 2,4 / 3,3 s | 3,2 / 1,2 / 1,2 s |
| Handler `keydown` (`useRemoteNavigation`) | 80 ms por tecla | **31 ms** |
| `show` del panel | 60 ms | **15 ms** |
| Transiciones por tecla | ~14 | **7** (140 `transitionrun` en 20 teclas) |
| Fondos del banner | 3840×2160 ×2 | **1280×720 ×2** |
| Peticiones TMDB en la ráfaga | 98 w342 + 53 w500 + 17 original | 53 w342 + 4 w500 + 3 w1280 |

Qué queda, por orden de coste medido:
1. **8,8 de los 10,5 s de raster están en 414 capas transitorias** (vecinas animadas por WAAPI, `.card-open` en transición, halo, `img` con fundido): nacen y mueren en cada tecla y se rasterizan cada vez. Además `main.page-scene` rasteriza 259 tiles / 1,65 s sin scroll porque las tarjetas sin capa se pintan dentro de la escena. → **R3** (capas permanentes).
2. **React 1,52 s / 135 tandas (máx. 186 ms)**: renders de `VirtualCarousel` por cambios de ventana y montaje de tarjetas (258/208 textos y 150 botones añadidos/quitados en 20 teclas) y respuestas de metadatos. → **R5** (sin churn) y **R6** (almacén por id).
3. Decode 3,1 s: 5 decodificaciones por tecla por las celdas que entran y salen; el velo de identidad pinta un PNG de 627×941 en 560×315 (19 veces). → R5 y R3.4.
4. Capas accidentales: `.focus-stage` 1920×1080 (7,9 MB para 42 vh), `span.rail-edge` 39×3975, una celda de 1820×259. → R3.3.

## 7. Medición 2 · tras la ola 2 (R3, R5, R7) · 7 de octubre, 04:45

Archivos: `artifacts/tv-measure-2026-10-07-ola2-run1.json`, `-run2.json`, `-gap120.json`; traza `tv-trace-2026-10-07-ola2-run2.json`.

| Medida | Línea base | Ola 1 | Ola 2 (run 1 / run 2 / cadencia 120 ms) |
|---|---:|---:|---:|
| P95 tecla → segundo RAF | 291 ms | 183 ms | **267 / 320 / 228 ms** (P50 117) |
| Raster | 12,0 s | 10,5 s | **5,1 / 5,2 / 3,3 s** |
| Decode Image | 7,7 s | 3,1 s | 2,1 / 2,7 / 1,9 s |
| Layerize | 2,45 s | 1,87 s | **4,25 s** (233 cuadros, 18 ms cada uno, máx. 75) |
| UpdateLayoutTree | 3,26 s | 1,24 s | 1,17 s |
| Capas en reposo | 25 | 26 | **124–166 (~50–56 MB)** |
| Handler `keydown` | 80 ms | 31 ms | 22 ms |
| `show` del panel | 60 ms | 15 ms | 15 ms |
| Tarjetas añadidas en 20 teclas | ~48 | ~46 | 117 botones (rails completos al bajar de fila) |

Lectura: el raster transitorio desapareció (objetivo de R3 cumplido), pero tres capas por tarjeta (celda, botón, halo) elevan el coste del árbol de capas por cuadro a 18 ms y eso domina el hilo principal; además, al bajar de fila se montan rails completos (14 tarjetas) con `flushSync` dentro del cuadro de la tecla. Ambas cosas van a la ola 3-F; el coste de React por respuesta de metadatos, a la ola 3-G.

## Ola 3-F · Implementado (7 oct, sin medir aún en el TV)

Archivos: `compositorMotion.css`, `virtualCatalogue.css`, `VirtualCarousel.jsx`, `VirtualCatalogue.jsx`, `virtualWindow.js` (+ prueba), `virtualNavigation.js`, `scripts/virtual-catalogue-fixture.jsx` (página «Home»: 10 rails de 40, para el censo de Inicio). Medida en la fixture: Chromium headless 1920×1080, TV, lecturas de `LayerTree` y traza; sin smokes; guion `f3/measure.mjs` en el scratchpad de la sesión. Horizontal = 5 Derecha; vertical = 4 Abajo + 4 Arriba; cadencia 350 ms; el panel se abre a los 180 ms de cada tecla.

**F1 · una capa por tarjeta.** Fuera `will-change:transform,opacity` de `.virtual-rail-cell/.virtual-grid-cell` (se revierte R3.2) y el `will-change:opacity` del halo `:after`; `.card-open{will-change:transform}` se mantiene. Comprobado con la variante «sólo F1» (sin halo propio): una vecina animada por WAAPI crea una capa transitoria que rasteriza sólo su leyenda (el póster sigue en la capa del botón), pero el halo sin capa repinta el `.card-open` **3 veces por tarjeta en 5 teclas (≈ 2 tramas de 210×315 por tecla)** y las leyendas de celdas sin capa se pintan en la escena (`main.page-scene` +18 pinturas en 5 teclas; en vertical 401 tiles de escena y 1.283 tiles en total, frente a 530 antes). Por el umbral (≥ 2 repintados por tecla) se implementó el **halo único por fila**: un `<i class="rail-halo">` por rail/cuadrícula (dentro del track o del contenedor de la cuadrícula; sólo si hay celdas montadas), una capa `will-change:transform,opacity`, misma apariencia (borde 4 px #f5d58d, radio 15 px, mismo tamaño que el `.card-open`, alto medido en el `ResizeObserver` de la primera tarjeta). En `focusin` (y `pointerover` en Modo TV de PC) se coloca desde el modelo (`haloPlacement`: rail `index·(ancho+hueco)`; cuadrícula `paddingLeft + col·(ancho+hueco)`, `paddingTop + fila·rowHeight`) con una animación WAAPI compuesta `translate3d(x,y,0)` → `translate3d(x,y−6px,0) scale(--tv-focus-scale)` de `--tv-base` y la curva del `.card-open` (`haloFrames`; duración y escala leídas una vez al medir, 0 con movimiento reducido); sin React ni lecturas en la tecla. La opacidad sigue a la tarjeta previsualizada con `:has(.card.is-previewed:not(.is-expanded))` (fundido `--tv-fast` al entrar en la fila; dentro de la fila el halo salta sin parpadeo) y se apaga fuera de `data-focus-region='catalogue'`. El `:after` de las tarjetas virtuales en TV es `content:none` (las no virtuales conservan el suyo). Posición medida: halo y botón enfocado coinciden al píxel (rail 0/0/0/0; cuadrícula −0,2 px de alto por redondeo de `offsetHeight`). Además, el **track de un rail dentro de la banda** (`.virtual-rail-track.is-near`) es una capa: aísla las leyendas de la escena, así que montar celdas o una celda transitoria repinta sólo ese rail (variante medida: vertical raster 115 ms frente a 198 sin ella, Layerize 69 frente a 127). En la cuadrícula la capa de contenedor resultó neutra (sólo traslada el repintado de la escena a una capa de 1,37 M px): no se usa.

**F2 · capas en reposo (Inicio de la fixture, panel abierto).**

| Fixture | Antes (ola 2) | Ola 3-F |
|---|---:|---:|
| Capas en reposo / tarjetas montadas | 94 / 28 (3,0 por tarjeta) | **71 / 42** (con el rail pre-montado) |
| de ellas: `.card-open` / celda / halo `:after` | 28 / 28 / 28 | 42 / 13* / 0, + 3 tracks + 3 `rail-halo` |
| Memoria estimada de capas | 40,7 MB | 39,4 MB (con 14 tarjetas más) |
| Cuadrícula: capas en reposo (32 tarjetas) | 106 | **58** |

\* Las 13 celdas con capa en reposo son las vecinas que el panel abierto mantiene desplazadas (WAAPI `fill:forwards`, incluidas las de duración 0 fuera de pantalla), de `cardExpansionSpace.js`, fuera de esta ola. Proyección a Inicio con 50 tarjetas: 50 `.card-open` + ~10 de base (raíz, escena, cabecera, panel) + 4 tracks + 4 halos = **68 sin panel**; con el panel abierto, + las vecinas desplazadas (10–13) ≈ 80. Llegar a ≤ 70 con el panel abierto exige no animar (ni dejar con `fill`) las vecinas fuera de pantalla en `cardExpansionSpace.js`.

**F3 · montajes fuera del cuadro de la tecla.** (a) `focusIndex` sólo enfoca y desplaza: con la celda montada, el cambio de ventana por histéresis se publica con `startTransition`; en un cruce real, `flushSync` monta sólo la celda de destino (el foco va fijado en cualquier render: rail con un `useReducer` de fuerza, cuadrícula con `pinWindowFocus(shown,index)`) y el resto de la ventana llega en transición. El `refresh` por scroll (rail y cuadrícula), la banda de una pantalla (`IntersectionObserver` de `near` y `warmNear`) y el desmontaje de un rail que sale (c) también son transiciones. Guardia: si alguna celda del grupo lleva el desplazamiento WAAPI del panel (`cellsShifted`), una ventana diferida no recicla nodos (los nuevos reciben el desplazamiento por el `MutationObserver` del panel), para que un nodo desplazado nunca pase a otro item. (b) Pre-montaje: 300 ms después del último movimiento de foco en el catálogo (temporizador propio, compartido por todos los rails TV), el primer rail no montado a ≤ 3 filas en la dirección del último movimiento vertical (por defecto abajo) se monta en transición (`premountTarget`), si el total de tarjetas montadas + su ventana no supera **`PREMOUNT_BUDGET` = 64** (banda de una pantalla, ~50 en Inicio, + un rail de 14); un rail pre-montado que no llega a entrar en la banda se libera en el siguiente reposo.

| Fixture, vertical (8 teclas) | Antes | Ola 3-F |
|---|---:|---:|
| Botones añadidos por tecla: cuadro de la tecla / ≤ 250 ms / reposo | 0 / 14 / 0 | **0 / 0 / 14** (salvo el cambio de sentido: 0 / 14 / 14) |
| Raster (tiles / ms CPU) | 530 / 158 | 676 / 172 (incluye el rail pre-montado en cada reposo) |
| Layerize (cuadros / ms) | 193 / 134 (0,69 ms/cuadro) | 200 / **92** (0,46) |
| Paint | 898 / 121 ms | 711 / 116 ms |
| Ráfaga de 9 Abajo a 100 ms | — | cada tecla aterriza en el rail siguiente; 42 tarjetas constantes |

En el TV, «cuadro de la tecla» = los 14 botones que la traza de ola 2 atribuía al cruce; ahora el rail que la siguiente tecla necesita ya está montado desde el reposo anterior (con cadencia 350 ms el reposo de 300 ms cabe entre teclas; con la tecla mantenida no hay reposo y los rails entran por la banda, en transición).

| Fixture, horizontal (5 teclas, Inicio) | Antes | Ola 3-F |
|---|---:|---:|
| Raster (tiles / ms) | 112 / 47 | 175 / 50 (103 tiles en capas transitorias de leyenda) |
| Layerize (cuadros / ms) | 123 / 32 | 124 / **24** |
| Repintados de `.card-open` | 1 por tecla (+1 del halo `:after`) | 1 por tecla (el póster ancla que oculta el panel) y 0 del halo |
| Celdas añadidas | 0 | 0 |

Cuadrícula (5 Derecha + 6 verticales): raster horizontal 116 → 269 tiles (48 → 71 ms): las celdas tapadas/desplazadas por el panel vuelven a ser capas transitorias y su leyenda se repinta en la escena; Layerize 16 → 15 ms. Es el precio de 47 capas menos.

**F4 · estilo por animación.** Vecinas animadas por apertura en la fixture: 10–13 (rail), de ellas las de fuera de pantalla con duración 0; `StyleRecalc` de motivo `Animation`: 390 → 380 (horizontal) y 858 → 842 (vertical): sin cambio, porque las crea `cardExpansionSpace.js` (fuera de mi lista). Animar el track en dos bloques (antes/después del ancla) no es viable aquí: el ancla cambia en cada tecla y repartir las celdas entre dos bloques es mover nodos en cada apertura (el churn que R5 quitó) o reintroducir el selector de hermanos. Lo viable, en `cardExpansionSpace.js`: animar sólo las vecinas visibles (≤ 6) y posicionar las demás sin animación `fill` (un `left` desplazado por el modelo o un único `translate` en un contenedor de las celdas posteriores creado al abrir); además quitaría 7 capas en reposo con el panel abierto.

**F5 · pruebas.** `virtualWindow.test.js`: `haloPlacement`/`haloFrames` (rail, cuadrícula, índice inválido, fotogramas del levantamiento) y `premountTarget` (dirección, ya montados, hacia arriba, presupuesto 64 y 50, máximo 3 saltos, sin fila activa). `npm test` 284/284. Comprobado en la fixture: foco, `is-previewed` único, Enter abre el título enfocado (rail tras 13 teclas, cuadrícula, «Rails»), halo oculto con el panel (`is-expanded`) y fuera de la región catálogo, PC sin `rail-halo` ni cambios (todo bajo `.tv-mode`/`tv`).

En el TV debería verse: capas en reposo ≈ 1 por tarjeta (+ las vecinas del panel), Layerize por cuadro a la baja, `BUTTON.card-open` añadidos fuera del cuadro de la tecla (en el reposo previo) y ningún `flushSync` de rail completo.

## Ola 3-G · Implementado (7 oct, sin medir aún en el TV)

Archivos: nuevo `metadataStore.js` (+ prueba), `App.jsx`, `interactions.jsx` (`Card`, `Hero`), `QualityImage.jsx`, `ContentIdentity.jsx`, `focusPaintDiagnostics.js` (`appRenders`), `main.jsx` y `Boot.jsx` (sólo la ruta del avatar), `public/avatars/*-128.png` y `*-320.png`, `scripts/tv-measure.mjs` (una línea en `pageEnv`). Sin cambios en `LiveHub.jsx`/`ExpandedCard.jsx`: el hub sólo reenvía lo que App ya no le pasa y el panel recibe el `item` ya fusionado por su `Card`.

**G1 · almacén de metadatos por id.** `metadataStore.js` (patrón `cardSelectionStore`): capas `selection` (TMDB), `score` (`cachedRatings`) y `guide` (guía de canales) que App sustituye enteras con `setMetadataLayer`, y respuestas de vista previa con `publishMetadata(id,data)`. Precedencia idéntica a `cardMetadata`/`guidedMetadata`: base = selección, si no puntuación; la respuesta reemplaza la base si su `tmdbId` difiere y si no se fusiona encima; la guía se añade como `guide`. `useMetadataEntry(id)` (`useSyncExternalStore`) devuelve `{metadata,resolved,priority}` con identidad estable hasta que cambie ese id; `useCardMetadata(id)` sólo los datos. `resolved` = hay respuesta (el antiguo `resolvedMetadata`); `trackMetadataPending()` lo activa App al cargarse, así que en la fixture (sin App) nada queda pendiente. Límite de 80 respuestas como antes, pero se expulsan sólo ids sin suscriptor (sustituye la lista `keep`). `resetMetadata()` al cambiar `featureKey`/conexión/revisión (donde antes `setFeatureDetails({})`) y con capas al desmontar App (cambio de perfil). `Card` fusiona `{...original,...metadata}` como antes (la prop `metadata` queda como respaldo para quien la pase) y deriva `metadataPending`. App ya no calcula `featureDetails`/`cardMetadata`/`guidedMetadata`/`resolvedMetadata`/`stageItem`/`stageNext` ni guarda `cachedScores` en estado; deja de pasar `metadata`/`resolvedMetadata` a `VirtualCarousel`, `VirtualCatalogue` y `LiveHub` (siguen aceptándolas: falta que el dueño de esos archivos quite la prop). El banner pasa por `StageWithMetadata` (memo, en `App.jsx`), que se suscribe a la diapositiva actual y la siguiente; `Hero` (PC) se suscribe al destacado visible; `details`, la precarga de pósters y `preparePreview` leen con `getMetadata`/`getPreviewDetails` en el momento. El «título que el banner espera» (`previewPendingId`) también vive en el almacén (`setMetadataPriority`): su fin ya no renderiza App.

**G2 · `DecodedImage` memoizado.** `memo` con comparador propio: `priority` (fetchPriority) se ignora cuando ese render ya vio la imagen lista (`WeakSet` de props mostradas), así que seleccionar/deseleccionar una tarjeta con póster cargado no re-renderiza su imagen. El `fallback` de `Card` es `useMemo` por `[item,tv]` (cambia sólo si llegan metadatos, que es cuando el velo debe cambiar) y ahora puede ser una función `failed=>…`. Sin otros llamadores con `onReadyChange/onStateChange` inestables (sólo `BannerArtwork`, con `onState` estable).

**G3 · publicaciones agrupadas.** El almacén escribe al instante (las lecturas síncronas ven el dato) y agrupa las notificaciones por tarea (`setTimeout(0)`, ids sin repetir): varias respuestas en la misma tarea → un render por tarjeta afectada. `startTransition` no aplica: `useSyncExternalStore` siempre re-renderiza en síncrono (React desoptimiza las transiciones con almacenes externos); con la notificación por id el coste ya es una tarjeta, no nueve rails.

**G4 · App por tecla y por reposo.** La 1.ª tecla de la ráfaga ya no hace `setPreviewActive(false)`: `settlePreview` lo pone a `false` sólo si el compromiso del reposo falla. Lo que ese render pausaba (vistas previas proactivas, precarga de pósters, calentamiento de vecinas) se pausa ahora con un oyente de `richiflix-catalog-navigation` (sólo modo TV) y se reanuda en el render del reposo (`burstEpoch` en las dependencias). `cardFocus` no cambia por tecla. `window.__richiflixPerformance.snapshot().appRenders` cuenta renders de App (`?diagnostics=1`); `scripts/tv-measure.mjs` lo guarda en `environment.appRenders`.

Medido en el navegador (Vite dev, Chromium headless 1920×1080, «Modo TV» de PC, proveedor simulado con 300 películas/300 series/40 canales, `get_vod_info` a 250 ms, pósters a 700 ms; foco en el rail «Películas», 20 Derecha cada 350 ms y 3 s de reposo, luego 5 teclas + 3 s; lecturas, sin aserciones; mismo guion sobre la copia previa instrumentada con el mismo contador):

| Medida | Antes | Ola 3-G |
|---|---:|---:|
| Renders de App en 20 teclas (de ellos en la 1.ª tecla) | 1 (1) | **0 (0)** |
| Renders de App en el 1.er reposo (3 s, respuestas de la ventana nueva) | 15 | **1** |
| Renders de App: ráfaga de 5 / reposo siguiente | 1 / 4 | **0 / 2** |
| Renders de `Card`: 20 teclas / 1.er reposo | 52 / 12 | 52 / 13 |
| Velos con PNG de categoría montados tras la ráfaga (pósters cargando) | 4 | **0** |
| Ídem con los pósters fallando (fallo real) | — | 16 (correcto: el PNG queda para el fallo) |
| Avatar de cabecera decodificado | 1254×1254 | **128×128** |

Los 2 renders del segundo reposo son el compromiso del banner (estado de `useBannerMotion` + `previewItem`/`previewActive`, un lote) y un segundo render inmediato (~2 ms) que no viene de ningún `useState` de App ni del banner (comprobado envolviendo los setters); estaba antes y no lo persigo. Cada respuesta de metadatos re-renderiza sólo su tarjeta (y el banner si es su diapositiva). Límite: una respuesta de la guía de canales sigue renderizando App (el estado vive en `useChannelGuide.js`, fuera de esta ola); en ráfaga, ese render ya ve `moving` y pausa la cola.

**G5 · decodificación evitable.** (a) Avatares redimensionados con `nativeImage.resize({quality:'best'})` de Electron (sin dependencias): `-128.png` (29 KB) para la cabecera de 38–54 px y `-320.png` (160 KB) para las fichas de 140–160 px del selector (`main.jsx`; 128 px no pasa la guarda «nunca ampliar» de `QualityImage` a 160 px, ni en DPR 2). `Boot` precarga los cuatro pequeños. Los originales de 1254 px siguen en `public/avatars` (fuente), ya sin referencias en el código. (b) `ContentIdentity` admite `artwork={false}`: en modo TV el velo de una tarjeta es degradado + glifo + título mientras el póster carga o espera metadatos; `CategoryArtwork` se monta sólo si no hay imagen, falló o es de baja resolución (`failed`, que `DecodedImage` pasa a la función `fallback`). PC sin cambios (el PNG sigue en el velo de carga). El panel ya usaba `fallbackWhileLoading={false}`. (c) En la medida: 0 peticiones y 0 `img` de `artwork/categories` durante la ráfaga y el reposo con pósters cargando; en el TV debería desaparecer `PaintImage local 627x941` y el `Decode Image` de PNG salvo pósters que fallen.

**G6 · pruebas.** `metadataStore.test.js`: precedencia (selección/puntuación/respuesta/`tmdbId`/guía), identidad estable, suscripción por id con notificación agrupada, reinicio con y sin capas, expulsión de ids sin suscriptor y prioridad del banner. `npm test` 285/285, `npm run build`, `npm run build:tizen` y `npm run test:tizen` en verde.

En el TV debería verse: `appRenders` = 0 tras una ráfaga y ≤ 2 por reposo; `performWorkUntilDeadline` por respuesta de metadatos ≈ el de una tarjeta (antes ~9 rails); sin `Decode Image` de 1254×1254 ni de 627×941 en la ráfaga.

## 8. Medición 3 · tras la ola 3 (F y G) + dos correcciones propias · 7 de octubre, 05:40

Correcciones aplicadas tras medir la ola 3 tal cual llegó:
- **Track de fila como capa**: la ola 3-F promovía `.virtual-rail-track.is-near`, que mide el catálogo entero (2.772.010 × 259 px en Películas): ~4,4 GB estimados de capas. Regla eliminada (`compositorMotion.css`).
- **Lectura forzada en el scroll del rail**: el `requestAnimationFrame` del evento `scroll` (`VirtualCarousel.jsx`) leía `scrollLeft` tras escrituras de estilo: 212 ms en 11 cuadros. Ahora el scroll provocado por nuestro propio `scrollTo` conserva el desplazamiento conocido.
- **Clase `is-browsing-rows` en `.app`**: ninguna regla la usaba y se escribía justo antes de `focus()`, invalidando el estilo de toda la página (≈ 18 ms por tecla de recálculo forzado). Eliminada.

| Medida | Línea base | Ola 1 | Ola 2 | Ola 3 + correcciones (3 corridas / cadencia 120) |
|---|---:|---:|---:|---:|
| P50 tecla → segundo RAF | ~205 ms | 114 | 117 | **96–113** / 78 |
| P95 | 291 ms | 183 | 267–320 | 201–297 / 250 |
| Raster | 12,0 s | 10,5 | 5,2 | 5,7–6,0 s |
| Decode Image | 7,7 s | 3,1 | 2,7 | **1,0–1,2 s** (máx. 41 ms) |
| Capas / memoria | 25 / 25 MB | 26 / 27 | 163 / 56 | **76 / 38 MB** |
| Layerize | 2,45 s | 1,87 | 4,25 | 3,38 s |

Por tecla: en la primera fila 60–100 ms; después de bajar dos filas, 150–300 ms. Lo que domina ahora: React en segundo plano (`performWorkUntilDeadline` 1,43 s / 180 tandas, máx. 132 ms: montajes en transición y pre-montaje de filas), árbol de capas (13 ms por cuadro), repintado de `main.page-scene` (41 repintados en 20 teclas), 562 recálculos por animación en celdas vecinas, 416 invalidaciones de estilo en los `svg.lucide-star` de las puntuaciones (regla por etiqueta) y 222 cambios de estilo programados por la clase `is-near` del track.

## 10. Encolado tras la ola 4 · banner con cambio directo (pedido de Richard)

«En el banner, si estoy ahí y le doy a los lados, que cambie directamente.»
1. Con el foco en el banner (botón Reproducir), Izquierda/Derecha cambian de recomendación al instante (`createBannerCarousel.go`), el foco no se mueve y el temporizador de 9 s se reinicia.
2. Mi lista: «Mantén OK para opciones», como en las tarjetas. Mantener OK revela Reproducir y Mi lista; dentro, Izquierda/Derecha alternan entre ellos y Volver regresa al modo carrusel.
3. Los puntos dejan de ser foco; quedan como indicador.
4. Archivos: `useRemoteNavigation.js` (ramas `.focus-actions`/`.banner-dots`), `FocusStage.jsx`, `bannerFlow.js` (+ test), CSS del banner. Medir que el cambio de diapositiva por tecla no añade Layout (fundido por opacidad entre las dos capas ya pintadas).

## 9. Ola 4 · iteración en el TV · 7 de octubre, 12:20–16:30

Método. Cada ciclo: hipótesis → cambio (o CSS/JS inyectado por el inspector para A/B sin instalar) → `npm test` + `npm run test:tizen` → instalación como actualización → relanzar en depuración → 1 corrida de calentamiento + 2–3 corridas. Instrumento de iteración: `ab.mjs` (scratchpad de la sesión; mismo escenario y mismas 20 teclas que `tv-measure.mjs`, traza ligera sin `invalidationTracking`; mitad 1 = 11 primeras teclas en «Películas», mitad 2 = 9 teclas tras los dos Abajo), `steady.mjs` (8 Derecha en la 3.ª fila tras 4 s de reposo), perfil de CPU por `Profiler` con sourcemap y tareas por tecla. El instrumento oficial (`tv-measure.mjs`, traza con `invalidationTracking`) pesa más: sus P50 salen ~10–15 ms por encima de `ab.mjs` en el mismo build. El TV se apagaba solo cada 6–60 min (sin entrada del mando); se despertó con Wake-on-LAN y se relanzó la app.

**Aviso sobre los ciclos 4–11.** Desde el ciclo 4 la tecla dejó de leer `scrollTop` y la escena no se realineaba cuando el *harness* saltaba por programa a «Películas» con la escena en 0: en la mitad 1 la fila enfocada quedaba fuera de la vista y el panel no se abría (`expandedCardPlacement` → `null`). La mitad 1 de esos ciclos (~47 ms) es optimista; la mitad 2 (tras Abajo, realineada) sí vale. Corregido en el ciclo 12 (offset de la escena conocido por sus eventos `scroll`, `knownViewportTop`); las cifras finales son del ciclo 12. Marcados con *.

| Ciclo | Hipótesis | Cambio | P50 / P95 (`ab`, cálidas) | Raster | Layerize | React / JS | Resultado |
|---|---|---|---:|---:|---:|---|---|
| 0 | Línea base (build de la medición 3) | — | 105–112 / 186–236 (mitad 1 ≈ 85, mitad 2 ≈ 145) | 5,3–5,9 s | 3,4–4,0 s (8 → 27 ms/cuadro entre mitades) | sched 1,1–1,3 s | — |
| A/B | Layerize crece con las filas visitadas (pista 2) | Inyectado: halo y vecinas con `commitStyles` (sin `fill:forwards`); copia del banner sin `fill:both` | sin cambio (PaintArtifactCompositor 45 ms por actualización) | — | — | — | descartado |
| A/B | Coste por fila pintada: `PaintArtifactCompositor::Update` 7 → 45 ms con 60 tarjetas montadas | Inyectado: ocultar filas lejanas | estacionario 3.ª fila 130 → 80 ms; PAC 45 → 8–15 ms | — | −70 % estacionario | — | base del ciclo 1 |
| A/B | Capas por tarjeta (pista 7) | `will-change` sólo en la fila activa / ninguno | mitad 1 −35 ms en el build 0, nada en mitad 2; en el build final nada (P50 78–93 frente a 78–83) y raster ×2 | 5,3 → 10,3 s | −30 % | — | descartado |
| 1 | Filas lejanas sin pintar + foco anclado a la izquierda (tarea del usuario) + celdas fuera de vista sin WAAPI + reglas por etiqueta (`svg`, `img`) fuera de `:focus-within` + `is-near` fuera | `data-row-far` (±1 fila), `anchoredRailOffset` + glide de pista, `cardExpansionSpace` sin animar vecinas no vistas, `.card-play-icon`, sin `.card:focus-within .poster>img` | 97 / 208 | 6,8 s | 2,4 s | — | conservado (el anclaje añade un `scrollTo` por tecla) |
| 2 | Lecturas forzadas (perfil: `QualityImage.update` 688 ms, `scrollViewport` 176, `toLocaleString` 91) | Ancho del póster desde el `ResizeObserver` (sin `clientWidth`), `scrollViewport` cacheado, `Intl.NumberFormat` únicos, offset de la escena leído antes de escribir | 120 / 232 (2.ª corrida inválida: filas «pegadas» ocultas) | — | — | JS 3,5 → 2,8 s | conservado; bug de visibilidad abajo |
| 2b | `visibility` heredada de la fila se queda «pegada» en la pista (Chromium 130: pista y celdas `hidden` sin regla que lo diga) | Regla sobre pista, cabecera y pie, no sobre la fila | 0 filas pegadas en 6 corridas | — | — | — | conservado |
| 3 | `focus()` fuerza el estilo tras las escrituras del glide | `focus()` antes de `scrollTo`/`animate` | 107 / 200 | 6,5 s | 3,3 s | — | conservado (neutro) |
| A/B | El `scrollTo` del rail (no compuesto) repinta y re-layeriza en cada tecla | `will-change:scroll-position` en `.tv-mode .cards.virtual-rail` | 90–96 frente a 108–117 (alternado, 4 corridas) | — | −25 % | — | conservado (ciclo 4) |
| A/B | Escena compuesta / pista como capa fija | `will-change:scroll-position` en `.page-scene`; `will-change:transform` en la pista | ruido (±10 ms) | — | — | — | descartado |
| 4 | Ídem + sin leer `scrollTop` en la tecla | regla del rail; offset de escena no leído en TV | 89 / 219* | 4,6 s | 2,2 s | — | conservado |
| 5 | Render síncrono de la tarjeta abandonada (desmonta el panel: hasta 40 ms de `react-dom` en la tecla) | `cardSelectionStore`: la tarjeta que se deja cae al instante en el DOM (clases fuera, su panel oculto) y renderiza en reposo (`requestIdleCallback`, ≤ 120 ms) | 67 / 214* | 4,1 s | 1,8 s | — | conservado |
| 6 | `svg` en el conjunto de invalidación de `:has()` por `.playback-toggle:has(svg.lucide-play) svg`: cada cambio del `:has` del halo recalculaba todos los `svg` de la fila | `button.playback-toggle svg.lucide-play` (misma especificidad) | 75 / 203* | 4,8 s | 1,9 s | ULT 1,33 → 1,06 s | conservado |
| A/B | Coste de evaluar el `:has()` del halo | Reglas `:has` borradas por CSSOM + `:focus-within` | ULT −10 %, P95 igual | — | — | — | descartado (no compensa tocar PC) |
| 7 | Las filas sin foco montan 14 celdas aunque se ven 8–9 | Overscan 1 en filas sin foco (3 en la del foco); una ventana de otro tamaño se rehace | 56 / 177*; estacionario 3.ª fila 95 → 80 ms; 60 → 51 tarjetas | 4,1 s | 1,6 s | — | conservado |
| 8 | Ocultar una fila que aún se desliza (doble Abajo) | Mostrar al instante, ocultar 260 ms después (tras el glide) | 65 / 160* | 4,0 s | 1,6 s | — | conservado (seguridad visual) |
| 9 | React en segundo plano: `new URL` por render de póster (~200 ms), `getAnimations({subtree})` por render de rail (70 ms) | Memo de `responsivePosterArtwork`/`isScreenBackdrop`; contador de grupos desplazados en `cardExpansionSpace` | 57 / 179* | 4,1 s | 1,7 s | sched −15 % | conservado |
| 10 | Un rail entero montado en una sola transición (pista 1) | Filas que entran en la banda o se pre-montan: 4 celdas por tarea idle; la del foco, entera | 61 / 192* (picos 190–250 siguen) | 4,4 s | 1,8 s | — | conservado (neutro-positivo en mitad 2) |
| 11 | El velo de identidad montado entre teclas se paga en la siguiente (16–18 ms de estilo y layout de `svg`/glifo) | `quietMs` 700 ms en el build TV (250 en PC) | 63 / **133*** | 3,1 s | 1,7 s | ULT 0,88 s | conservado |
| 12 | Realinear la escena si se movió, sin leer `scrollTop` | `knownViewportTop` (eventos `scroll` + nuestro `scrollTo`) | **84 / 111** (mitad 1 75–82, mitad 2 86–91) | 4,7 s | 2,2 s | — | conservado (estado final) |

### Estado final instalado (ciclo 12), instrumento oficial

| Medida (`tv-measure.mjs`) | Medición 3 (ola 3b: 3 corridas / 120 ms) | Ola 4 final (3 corridas / 120 ms) |
|---|---:|---:|
| P50 tecla → 2.º RAF, fase de traza | 96–113 / 78 | 94–100 / 89 |
| P95, fase de traza | 201–297 / 250 | **148–161 / 134** |
| P50 / P95, fase de capas (mismas 20 teclas, sin traza) | 105–108 / 144–191 | **80–87 / 97–147** |
| `ab.mjs` (traza ligera, 3 corridas) | 105–112 / 186–236 | **84 / 111** |
| Tareas largas en 20 teclas (máx.) | 61–81 (148–852 ms) | **22–30 (87–103 ms)** |
| Raster | 5,7–6,0 s | 4,6–5,1 s |
| Layerize | 3,0–3,9 s | 1,9–2,4 s |
| UpdateLayoutTree | 1,55–1,93 s | 1,36–1,41 s |
| Decode | 1,0–1,2 s | 1,2–1,9 s (el anclaje recorre más títulos por tecla) |
| Capas tras 20 teclas | 52–76 | 67–71 |

Archivos: `artifacts/tv-measure-2026-10-07-ola4-final-run{1,2,3}.json`, `-final-gap120.json` y sus trazas `tv-trace-2026-10-07-ola4-final-*.json`; capturas `artifacts/ola4-rail-anclado-derecha.png` (6 Derecha), `-izquierda.png` (3 Izquierda) y `ola4-fila3-panel.png`. El «~4.400 MB» que el *harness* estima ahora para las capas es la capa de contenido de cada rail compuesto (w × h × 4 de una pista de 2,9 M px); el TV sólo rasteriza teselas visibles y de interés (el raster total bajó).

**Objetivo no alcanzado del todo.** P95 ≤ 120 se cumple con `ab.mjs` (111) y en la fase de capas de 2 de 3 corridas (97, 127, 147 → no en la 3.ª), no en la fase de traza pesada (148–161); P50 ≤ 70 no (75–100 según instrumento). Lo que queda, medido en `final-run1` con sourcemap:
1. **El anclaje cuesta**: cada Derecha desplaza el rail (antes, 4 de 10); la ventana avanza cada ~2 teclas y monta 1–2 celdas en transición; a cadencia 120 ms el P50 empeora (78 → 89) aunque el P95 mejora (250 → 134).
2. **Handler de la tecla 27 ms** (431 ms / 16): `focus()` fuerza un recálculo de ~25 elementos a 0,3–0,5 ms cada uno (emparejamiento caro de reglas en el TV: cadenas `.tv-mode … .card…`, `body[data-focus-region]…`, `:has()` del halo) más el render síncrono de la tarjeta nueva (`SelectedCardExpansion`).
3. **Layerize ~8 ms por cuadro** con 3 filas pintadas; cada tecla provoca 4–6 actualizaciones completas (cierre y apertura del panel, ocultación diferida del póster ancla, inicio/fin de animaciones de vecinas y del glide de la pista).
4. **React en segundo plano 1,09 s / 190 tandas, máx. 70 ms** (montajes en transición, apertura del panel: `show` 9 ms + render de `ExpandedCard`).
5. Picos en la 2.ª–3.ª tecla tras un Abajo (150–250 ms): llegan los pósters de la fila nueva (decode, `data-image-state`), montajes de la banda y el pre-montaje.

Ideas medibles no probadas: halo y estado expandido por clases JS en lugar de `:has()` sólo en el build Tizen; un único `section` de panel reutilizado (no desmontar/montar por tecla); fila activa con overscan 2.

Pistas del encargo: 1 (React troceado) ciclos 9–10; 2 (empeora tras bajar) = filas lejanas pintadas y tarjetas montadas (ciclos 1 y 7); 3 (`page-scene` repinta) ya no domina el `paintDelta` salvo por el panel; 4 (`svg.lucide-star`) ciclo 1 más el `:has` del ciclo 6 (0 invalidaciones por etiqueta `svg` en la traza final); 5 (`is-near`) ciclo 1 (los 222 `ScheduleStyle` eran del `:has` del halo: 214 en la final); 6 (vecinas) ciclo 1 (562 → 209 `StyleRecalc:Animation`); 7 (capas sólo en la fila activa) descartado con datos; 8 (> 100 ms) lecturas forzadas del ciclo 2.

Archivos tocados: `VirtualCarousel.jsx`, `virtualWindow.js` (+ prueba), `virtualViewport.js`, `virtualNavigation.js`, `cardExpansionSpace.js`, `cardExpansion.test.js`, `cardSelectionStore.js`, `QualityImage.jsx`, `UserScore.jsx`, `responsiveArtwork.js`, `interactions.jsx` (clase del icono), `style.css` (3 selectores), `compositorMotion.css` (filas lejanas, rail compuesto), `docs/TARJETA-AMPLIADA.md`. Copia previa en el scratchpad (`ola4-before/`). `npm test` 288/288 y `npm run test:tizen` en verde.

## 11. Banner directo y limpieza de focus · Implementado (7 oct, medido en el 65")

Copia previa en el scratchpad de la sesión (`banner-before/src`). Archivos: `FocusStage.jsx`, `bannerFlow.js` (+ prueba), `useRemoteNavigation.js`, `virtualNavigation.js`, `VirtualCarousel.jsx`, `VirtualCatalogue.jsx`, `Dialog.jsx`, `useCardExpansion.js`, `CategoryChips.jsx`, `App.jsx` (`profileId` al banner, dos focos con `revealRowFor`), `compositorMotion.css`, `scripts/tv-measure.mjs` (preparación), `docs/DESIGN.md`.

**A · Banner con cambio directo (sección 10).** Función pura `bannerKeyAction({key,mode})` en `bannerFlow.js`: modo `carousel` → Izquierda/Derecha = `previous`/`next`, OK = `press`, el resto (Arriba, Abajo, Volver) se deja a la navegación de la página; modo `actions` → Izquierda/Derecha = `toggle`, Volver = `exit`. `FocusStage` la aplica en `onKeyDown` de `.focus-actions` (sólo con `tv` y carrusel): `next`/`previous` llaman a `choose(slide±1)` = `createBannerCarousel.go`, que da la vuelta por módulo y rearma los 9 s; `preventDefault` hace que `useRemoteNavigation` no mueva el foco. OK usa `createCardPress` de las tarjetas (OK breve = Reproducir / Ver episodios; mantener 500 ms = modo `actions`, que revela Mi lista con `visibility`, sin Layout); en `actions`, Izquierda/Derecha alternan los dos botones y Volver regresa a Reproducir en modo carrusel; salir del banner (Arriba → cabecera, Abajo → primera fila, como antes) lo devuelve también a `carousel` (`onBlur`). Pista «Mantén OK para Mi lista» bajo los botones, fuera de flujo, con `okHint('banner:<perfil>')` (contador propio, 3 veces por perfil, se retira con una pulsación larga real). Los puntos quedan con `tabIndex=-1` (indicador; el clic de ratón sigue) y se quitó su rama de `useRemoteNavigation`; Arriba desde las acciones va a la cabecera. Fundido: la capa `is-current` cuyo arte aún no está decodificado queda a opacidad 0 (`data-artwork-state='loading'`) sobre la saliente, que `FocusStage` conserva hasta que el arte llega (el texto cambia en la misma tecla; la tecla nunca espera). La siguiente diapositiva se monta y decodifica por adelantado también durante un fundido, pero **sin pintar** (`.is-next{visibility:hidden}`): ver la medida. PC: el Hero con flechas de ratón no cambia. Pruebas: `bannerKeyAction` (todas las teclas en los dos modos) y la vuelta de `step(±1)` con el intervalo completo.

**B · Fuera el parche de `HTMLElement.prototype.focus`.** `markFarRows` pasa de `VirtualCarousel.jsx` a `virtualNavigation.js` junto a `revealRowFor(element)` (quita `data-row-far` alrededor de la fila del elemento si estaba lejana y devuelve el elemento). Llamadas: `focusIndex` de `VirtualCarousel` y `VirtualCatalogue` (cubre `restoreVirtualFocus` y `recalled`), `move()` de `useRemoteNavigation` (foco no virtual), restauración al cerrar diálogos y reproductor (`Dialog.jsx`: `restoreFocus` o el elemento previo), `restore` del panel (`useCardExpansion.js`) y los `.focus()` sobre `.card-open` de `CategoryChips.jsx` y `App.jsx` (búsqueda y «Ver todo»). Grep final: ningún `.focus(` sobre una tarjeta sin pasar por `revealRowFor` o `focusIndex`. Efecto lateral encontrado al medir: `tv-measure.mjs` (y `ab.mjs`/`steady.mjs`) enfocaban por programa la primera tarjeta de «Películas» con la fila oculta por la corrida anterior y dependían del parche; sin él el foco no entraba y la corrida empezaba en otra fila (P95 de la fase de capas 160–193 sólo por eso). Su preparación quita ahora `data-row-far` de esa fila antes de enfocar, como hace la app.

Comprobado en el TV (`Emulation.setFocusEmulationEnabled`, teclas por el camino de `platform.js`):

| Caso | Resultado |
|---|---|
| 5 Abajo desde la 1.ª fila, reposo, 5 Arriba | foco en `.card-open` de la fila 5 y luego de la 0, `visibility:visible`, en pantalla; filas lejanas `1111000111` → `0011111111` (`banner-directo-volver-arriba.png`) |
| Detalle (serie, fila 5): OK breve, se fuerza `data-row-far` en su fila con el diálogo abierto, Volver | foco en la misma tarjeta, visible, panel reabierto (`banner-directo-detalle-cerrado.png`) |
| Reproductor (canal, fila 3): ídem | foco en la misma tarjeta, visible (`banner-directo-reproductor-cerrado.png`) |
| Banner: Abajo desde la cabecera | foco en Reproducir, Mi lista oculta, pista visible (`banner-directo-foco.png`) |
| 10 Derecha | 10 diapositivas seguidas, el foco sigue en Reproducir; Izquierda en la 0 → 7 de 8 |
| Mantener OK | Mi lista visible, sin diálogo; Derecha → Mi lista (`banner-directo-mi-lista.png`), Izquierda → Reproducir; Volver → modo carrusel |
| Arriba / Abajo / Abajo | cabecera → Reproducir → primera fila |

**C · Medida en el TV (build final instalado).** Mismo escenario y mismos percentiles del *harness* que la ola 4 (`p50`/`p95` del JSON).

| `tv-measure.mjs` | Ola 4 final (3 corridas · 120 ms) | Banner directo (3 corridas · 120 ms) |
|---|---:|---:|
| P50 / P95, fase de capas (sin traza) | 80–87 / 97–147 · 71,5 / 124 | **77–86 / 123–126** · 71 / 111 |
| P50 / P95, fase de traza | 94–100 / 148–161 · 89 / 134 | **94–99 / 144–152** · 81 / 156 |
| Raster / Layerize / UpdateLayoutTree | 4,6–5,1 / 1,9–2,4 / 1,36–1,41 s | 4,4–5,3 / 1,9–2,1 / 1,32–1,38 s |
| Capas tras 20 teclas | 67–68 | 67 |

`ab.mjs` (traza ligera, 3 corridas): 84,8 / 158 en la primera sesión; en una sesión nueva, alternando el build con el parche antiguo re-inyectado (`--js`): build 82–89 / 121–133, parche antiguo 87 / 123 → sin diferencia atribuible (la ola 4 registró 84 / 111 en su mejor sesión y 104 / 152 «en caliente»); build final 81–86 / 122–151. `steady.mjs` (8 Derecha en la 3.ª fila): mediana 93 ms. Archivos: `artifacts/tv-measure-2026-10-07-banner-run{1,2,3}.json`, `-banner-gap120.json` y sus trazas `tv-trace-2026-10-07-banner-*.json`.

Banner (guion `banner.mjs` del scratchpad: foco en Reproducir, 10 Derecha cada 350 ms, latencia tecla → 2.º RAF, traza con marcas por tecla):

| Medida por cambio de diapositiva | Siguiente pintada a opacidad 0 (8 corridas, 80 teclas) | Final: siguiente decodificada sin pintar (3 corridas, 30 teclas) |
|---|---:|---:|
| P50 / P95 / máx. | 77 / 237 / 357 ms (10 de 80 > 150 ms) | **73 / 102 / 148 ms** |
| Layout por cambio | 2–3 (6–12 ms) | 2–3 (6–15 ms) |
| UpdateLayoutTree / Paint por cambio | 8 (≈ 25 ms) / 4 (≈ 5 ms) | 8 (20–26 ms) / 4 (≈ 5 ms) |
| Decode en el hilo principal | 0 | 0 |

El Layout por cambio es el del texto nuevo: uno de 35–48 objetos (rótulo, título, descripción, datos) y uno o dos de 2–5; el arte no añade Layout (sólo cambia `opacity`/`visibility` de capas ya montadas). Los picos de 200–350 ms del primer diseño eran tareas del hilo principal esperando al compositor (pocos ms de CPU) mientras se rasterizaba la capa de 1920×554 que se monta detrás en cada tecla; con `visibility:hidden` en la siguiente (A/B por CSS inyectado, 3 corridas: P50 64–68, máx. 78) desaparecen; esa capa se rasteriza en su primer cuadro como `is-current`, bajo el fundido. Coste visto: Layerize por ventana de tecla sube de ≈ 40 a ≈ 85 ms, repartido en los cuadros del fundido, fuera de la latencia.

Capturas: `artifacts/banner-directo-foco.png`, `-derecha.png`, `-mi-lista.png`, `-volver-arriba.png`, `-detalle-abierto.png`, `-detalle-cerrado.png`, `-reproductor-abierto.png`, `-reproductor-cerrado.png`.

**D.** `npm test` 290/290, `npm run build`, `npm run build:tizen` y `npm run test:tizen` en verde; build instalado como actualización en el 65" (192.168.1.12) y relanzado. Contador de la pista del banner puesto a 0 tras las pruebas.

Fuera de alcance / pendiente: Izquierda llega a una diapositiva no pre-montada (sólo se adelanta la siguiente): el texto cambia al instante y el arte funde al llegar (≈ 1 decodificación w1280); en modo `actions` el carrusel sigue girando a los 9 s y Mi lista actúa sobre la diapositiva visible; cada cambio por tecla sigue renderizando `App` (el índice vive en `useBannerCarousel`), ≈ 30 ms de JS por tecla; el «Modo TV» del PC también usa el banner directo con teclado (mismo código); el Hero de PC no cambia.
