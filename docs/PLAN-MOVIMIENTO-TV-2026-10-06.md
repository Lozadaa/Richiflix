# Plan: foco y movimiento rápidos en TV, sin tarjetas desalineadas

Fecha: 6 de octubre de 2026. Alcance: modo TV (Electron y Samsung Tizen) y, donde se indique, PC. Punto de partida: 219 pruebas unitarias en verde; respaldo de `src/` y `scripts/` previo a los cambios.

Objetivo: que cada pulsación del mando responda con una sola transición compuesta por GPU, que la tarjeta ampliada aparezca siempre donde está su tarjeta, y que la escena no cambie de tamaño mientras se navega. Las mediciones locales son proxies; la validación física en el Samsung queda pendiente de autorización, como hasta ahora.

## 1. Diagnóstico: por qué se ve lento y se desalinea

Los hallazgos salen de leer `useCardExpansion.js`, `cardExpansionSpace.js`, `cardExpansion.js`, `ExpandedCard.jsx`, `VirtualCarousel.jsx`, `VirtualCatalogue.jsx`, `interactions.jsx`, `useRemoteNavigation.js`, `App.jsx` y las cinco hojas CSS.

### 1.1 La tarjeta ampliada «se estira»

`expandedCard.css` abre el panel con `@keyframes expansion-open`, que anima desde `scale(var(--expansion-from-x), var(--expansion-from-y))`. Las dos escalas son distintas (por ejemplo 0,19 × 1,0), así que durante 220 ms el texto, el póster y los botones se dibujan deformados. En PC dura poco; en el TV el cuadro tarda más y la deformación se ve. Esto es literalmente «se estira donde no debería».

### 1.2 El panel aparece desplazado

`useCardExpansion.show()` mide `cell.getBoundingClientRect()`. Esa medida incluye transformaciones en curso:

- Las celdas vecinas tienen `transition: transform .22s` (`expandedCard.css`). Al navegar, `cleanup()` devuelve sus transformaciones y las celdas vuelven animándose. Si la siguiente tarjeta se amplía 250 ms después, la lectura puede coger una celda a medio camino, y el panel se coloca en una posición intermedia.
- En rail, `reserveCardExpansion` cambia `track.style.minWidth` y puede hacer `scrollTo` del rail; luego `show()` vuelve a medir y recoloca. Dos medidas, dos posiciones.
- `layout.height` del rail se mide una sola vez desde la primera tarjeta. Si otra tarjeta tiene título a dos líneas o su imagen aún no define altura, la celda sobresale del track y la siguiente fila la pisa.

Regla a aplicar: la geometría del panel sale del modelo (índice × paso + scroll), nunca de rects de elementos transformados.

### 1.3 Dos verdades para el foco

En modo TV la tarjeta escala por `:focus-within` y también por `.is-previewed` (store de selección). `style.css` necesita el parche `.tv-mode .card:focus-within:not(.is-previewed){transform:none}` para que no se vean dos tarjetas grandes. Cada tecla produce dos cambios de clase y dos transiciones encadenadas. Debe quedar una sola fuente: la selección.

### 1.4 Trabajo de pintura por tecla, en modo TV

Por cada movimiento se acumulan:

- Escala 1,08 de toda la tarjeta, incluido el texto de la leyenda. Chromium vuelve a rasterizar texto escalado salvo que la capa esté retenida con `will-change`. En Samsung ya se retiene; en Electron en modo TV no.
- `box-shadow: 0 0 0 4px #f5d58d, 0 16px 40px #0005` y `filter: brightness(1.06)` sobre el póster enfocado (sólo se anulan con `.samsung-tv`).
- Cambio de color del título de la leyenda al enfocar.
- Panel ampliado: `box-shadow: 0 22px 60px` sobre 1120 × 360 px, anillo, portal nuevo, dos animaciones, desplazamiento de vecinas con `will-change` prestado, cambio de `minWidth` del track (layout) y posible `scrollTo`.
- `backdrop-filter: blur(18px)` en la cabecera fija fuera de Inicio (`.app:not(.scenic)>.topbar`). Un desenfoque de fondo bajo una zona que se desplaza se recalcula en cada cuadro. En Samsung se anula; en Electron modo TV no.
- `.has-tv-stage` cambia `top` de `.page-scene`: relayout y repintado de toda la escena cada vez que empieza o termina un tráiler.
- El iframe de YouTube es, con diferencia, el proceso más caro que corre en el TV durante la navegación.

### 1.5 Lo que ya está bien y se conserva

Ventanas virtuales, worker de catálogo, selección por instancia (dos tarjetas re-renderizan), halo con opacidad propia, retención de capa en Samsung, 480 ms de reposo para el banner, diagnóstico `__richiflixPerformance` y los smokes de `scripts/`.

## 2. Reglas de movimiento para TV

1. Sólo `transform: translate` y `opacity` en transiciones frecuentes. Escalar únicamente capas de imagen ya retenidas; nunca texto.
2. Como máximo dos capas animan por pulsación: la tarjeta que entra y la que sale.
3. En `.tv-mode` (no sólo `.samsung-tv`): sin `backdrop-filter`, sin sombras desenfocadas, sin `filter`, sin cambios de color al enfocar.
4. Duraciones de 120–180 ms, interrumpibles. Una tecla nueva cancela la animación anterior sin esperar.
5. Ningún cambio de layout durante una ráfaga de teclas. Lo que cambia tamaño, cambia una vez al asentarse.
6. Geometría desde el modelo de layout; las lecturas del DOM se hacen sobre contenedores estables.
7. Reduced motion mantiene foco, tamaños y funciones.

## 3. Fases

Cada fase deja pruebas y se puede entregar sola.

### Fase A. Geometría estable de la tarjeta ampliada (JS)

Archivos: `useCardExpansion.js`, `cardExpansionSpace.js`, `cardExpansion.js`, `VirtualCarousel.jsx`, `VirtualCatalogue.jsx`, prueba nueva.

1. Calcular la caja del ancla desde el modelo: rect del contenedor estable (`.virtual-rail-track` o `.catalog-grid`) más `left/top` de la celda (`cell.style`/dataset) menos `scrollLeft`. No usar rects de celdas ni de `.card`.
2. Al ocultar por navegación, devolver las vecinas sin transición (clase `is-settling-off` o `transition:none` un cuadro) y cancelar la animación WAAPI pendiente. Ninguna ampliación nueva puede leer un estado intermedio.
3. Una sola colocación: decidir el desplazamiento del rail antes de colocar el panel y colocarlo una vez. Si en TV se adopta el panel superpuesto (Fase C), el rail no se desplaza ni cambia `minWidth`.
4. Altura del rail: medir con `ResizeObserver` sobre la primera celda montada y fijar la leyenda a dos líneas (`-webkit-line-clamp: 2` con altura fija en `.tv-mode .cards .card-caption`), de modo que todas las tarjetas de una fila midan igual.
5. Prueba: en `src/cardExpansion.test.js` o un smoke de `scripts/`, pulsar derecha durante la transición de las vecinas y comprobar que `left` del panel coincide con el modelo (±1 px). Añadir el caso de título a dos líneas.

### Fase B. Transiciones de foco y apertura compuestas por GPU (CSS)

Archivos: `style.css` (bloques `.tv-mode`), `expandedCard.css`, `compositorMotion.css`, `tvCardComposition.css`.

1. Una sola fuente de foco en TV: `.card.is-previewed` (o renombrar a `.is-selected`). Eliminar `transform`, `box-shadow`, `filter` y color por `:focus-within` dentro de `.tv-mode`. Quitar el parche `:focus-within:not(.is-previewed)`.
2. Foco de tarjeta en TV: halo por opacidad (ya existe `.card-open:after`) más `transform: translateY(-6px) scale(var(--tv-focus-scale, 1.06))` sólo sobre `.poster`, con `will-change: transform` sólo en la tarjeta seleccionada. `--tv-focus-scale` es la perilla de calibración: si el Samsung sigue justo, se baja a 1 sin tocar código. La leyenda no escala ni cambia de color.
3. Apertura del panel: sustituir `expansion-open` por `opacity 0→1` y `translateY(8px)→0` (uniforme, sin deformar). `expansion-copy` desaparece; el cuerpo entra con el panel. Duración 160 ms en TV.
4. Panel en TV: sin `box-shadow` desenfocada; borde de 2 px y fondo opaco. Mantener `contain: layout paint style`.
5. En `.tv-mode`: anular `backdrop-filter` (cabecera, `.secondary`, `.card-save`), `.reveal-ready`, `tile-arrive`, `cinema-in`, `virtual-enter` y la transición de `.rail-progress`. Las mismas reglas que hoy sólo cubren `.samsung-tv`.
6. Smoke: `scripts/compositor-motion-smoke.mjs` debe seguir en 0 Layout / 0 Paint en el tramo estable, y añadir conteo de Paint al abrir el panel (antes/después).

### Fase C. Panel superpuesto en TV y tráiler bajo control (App)

Aclaración de Richard (6 de octubre): en TV el banner ya está arriba, siempre visible, con una película o serie recomendada. No se rediseña. La interacción principal es la tarjeta agrandándose; ahí va el esfuerzo.

Archivos: `useCardExpansion.js`/`cardExpansionSpace.js` (rama TV), `App.jsx` (ajuste), `FocusStage.jsx`/`TrailerPreview.jsx` sólo si el retardo del tráiler lo exige.

1. Banner: comprobar en el código que su altura y el `top` de `.page-scene` no cambian al navegar ni al empezar o terminar un tráiler. Si todavía alternan con `.has-tv-stage`, reservar la altura siempre que el banner esté visible, con el cambio mínimo. No se cambia qué título muestra ni su temporización.
2. Prioridad: en TV, el panel ampliado se superpone a las vecinas (z-index) sin desplazarlas, sin cambiar el tamaño del track y sin mover el rail. Aparece exactamente sobre su tarjeta en 160 ms. En PC se conserva el desplazamiento actual.
3. Tráiler en TV: arrancar 1,5 s después de asentarse, no a los 480 ms, y añadir el ajuste «Tráilers automáticos» en Ajustes (`rf-auto-trailers`), desactivado por defecto en Tizen mientras persista el error 153 de YouTube. Se aplica donde el tráiler reproduce hoy; no se añade tráiler donde no lo hay.
4. Pruebas: `scripts/tv-navigation-smoke.mjs` y `banner-navigation-smoke.mjs`; comprobar que los commits del banner y las peticiones intermedias no cambian.

### Fase C2. Banner de TV como carrusel de recomendaciones

Pedido de Richard (6 de octubre): el banner superior cambia solo o con el mando, siempre con recomendaciones. Sustituye la regla anterior de «sin rotación automática» de `docs/DESIGN.md` para el modo TV.

Supuesto de diseño, ajustable: el banner deja de seguir a la tarjeta seleccionada. La información del título seleccionado vive en la tarjeta ampliada; el banner es una vitrina independiente.

Archivos: `App.jsx` (origen de recomendaciones y estado del carrusel), `FocusStage.jsx` (dos capas de arte para el fundido, indicador de posición), `BannerArtwork.jsx` si hace falta precargar, CSS del banner.

1. Origen: hasta 8 títulos con backdrop disponible, tomados de las selecciones TMDB mejor valoradas y recientes (`smartCollections` con `TMDB_BEST`/`TMDB_RECENT`), con «Continuar viendo» primero si existe. Kids usa sólo su catálogo filtrado. Sin duplicados con la primera fila visible cuando sea posible.
2. Rotación automática cada 9 s. Se pausa mientras el mando se mueve (`banner.moving`), mientras hay una tarjeta ampliada, mientras un tráiler reproduce, con un diálogo abierto y con la pestaña oculta. Se reanuda 2 s después del reposo.
3. Cambio manual: con el foco en el banner, Izquierda/Derecha cambian de recomendación y reinician el temporizador. Indicador de puntos (como el `hero-dots` de PC) con el activo en coral, sin animación de anchura en TV.
4. Transición: fundido cruzado sólo con `opacity`, 320 ms, entre dos capas de arte ya pintadas; el texto entra con `opacity` y `translateY(6px)`. Nada de escala, desenfoque ni cambio de altura. El siguiente backdrop se precarga y decodifica antes de girar; si no está listo, se salta el giro. Reduced motion: cambio sin fundido.
5. Pruebas: unidad para la lógica pura del carrusel (orden, pausa, reanudación, salto cuando el arte no está listo) y smoke que compruebe que un giro no produce Layout y que durante una ráfaga de teclas no gira.

**Implementado (6 de octubre).** En TV el banner ya no sigue a la tarjeta: `stageItem` sale del carrusel en Inicio y, en las demás secciones y en la búsqueda, del primer título de la lista, fijo. La ruta `preview → banner.select(commitPreview) → setPreviewItem` se conserva sólo por sus efectos laterales (metadatos prioritarios del seleccionado, vecinos, `banner.moving`, `is-browsing-rows`, precargas proactivas en pausa durante la ráfaga); en PC `pointer-stage` sigue al hover como antes. Como el banner muestra recomendaciones y no el título en movimiento, deja de ocultarse durante la ráfaga: se eliminó `stage-collapsed` (`data-stage-state` queda en `browsing`/`settled`). Origen: `recommendedBanner()` en `src/bannerRecommendations.js` toma el primer «Continuar viendo» de película o serie y después alterna película/serie entre las selecciones `TMDB_BEST` y `TMDB_RECENT` (hasta 8, sin duplicados, con backdrop o póster); sin selecciones TMDB (Kids o todavía cargando) usa `featuredBase`. Temporizador: `createBannerCarousel()` en `bannerFlow.js` y `useBannerCarousel()` en `useBannerMotion.js`; gira cada 9 s, se pausa con `banner.moving`, con el foco en una tarjeta o su panel ampliado (señal `cardFocus`, más fiable que el store de selección, que no se limpia al subir a la cabecera), con un tráiler reproduciendo (`usePreviewPlayback`), con detalles, reproductor o Ajustes abiertos y con `document.hidden`; al reanudar espera 2 s de reposo más un intervalo completo (primer giro ≈11 s después de soltar el mando). El índice se sigue por id, así que la llegada de las selecciones TMDB no hace saltar el slide visible. Mando: los puntos son el único sitio donde Izquierda/Derecha cambian de recomendación (circular, reinicia el temporizador); Arriba desde Reproducir/Mi lista va al punto activo, Arriba desde los puntos a la cabecera y Abajo a Reproducir; Abajo desde la cabecera sigue yendo directo a Reproducir. Entre Reproducir y Mi lista, Izquierda/Derecha funcionan como siempre. Los puntos van bajo la cabecera (franja de 100–120 px que el texto nunca ocupa), activo en coral `#ff977f`, sin transición ni cambio de anchura. Transición: la capa saliente queda opaca debajo y la entrante (ya montada y decodificada como capa «siguiente» a opacidad 0) pasa a 1 en 320 ms; la saliente se desmonta a los 360 ms y sólo entonces se monta la siguiente, para que su carga no relayoute durante el fundido. El texto entra con `opacity` + `translateY(6px)`; las acciones no se remontan, así que el foco no se pierde si gira con el foco en el banner. Si el arte siguiente sigue cargando al vencer el temporizador, se salta el giro. Los metadatos del slide actual y siguiente se piden 400 ms después de girar, porque su respuesta re-renderiza tarjetas. Tráiler: con `rf-auto-trailers` activo arranca 1,5 s después de llegar al slide (sólo sin foco en tarjetas) y su reproducción pausa la rotación; desactivado, el banner es arte y texto. Medición local (`banner-navigation-smoke`, Chromium sin GPU): 0 giros en 30 pulsaciones, un giro a los 11 001 ms del reposo, 1 Layout en el commit del texto (contenido en el escenario), 0 Layout durante el fundido, geometría de la escena idéntica. Fuera de alcance: carrusel también en Películas/Series y evitar duplicados con la primera fila visible.

### Fase D. Mejoras de UX y diseño (ligeras, tras A–C2)

Propuestas ordenadas por valor/coste. Cada una es un cambio pequeño y aislado.

1. **Leyenda de dos líneas fija** en rails y cuadrícula: filas siempre alineadas, sin saltos cuando llega el título real.
2. **Posición en la fila** dentro del panel ampliado («4 de 48»): orienta al navegar con el mando y sustituye la barra de progreso de 3 px, que apenas se ve desde el sofá.
3. **Pista «Mantén OK para opciones»** sólo las tres primeras veces por perfil (persistida); después desaparece y el panel gana aire.
4. **Barra de progreso de «Continuar viendo»** a 6 px y color coral en TV; hoy mide 3 px.
5. **Fila activa**: el título de la fila con el foco pasa a color nube y las demás a bruma. Un solo cambio de color por cambio de fila, fuera de la ráfaga de teclas.
6. **Inicio más corto en TV**: máximo seis filas antes de «Tu próximo mood»; las colecciones TMDB se agrupan en dos filas con alternancia por sesión. Menos filas montadas, menos trabajo por scroll.
7. **Volver** consistente: desde cualquier tarjeta, Volver sube a la cabecera; desde la cabecera, a Inicio; desde Inicio, al selector de perfil. Hoy depende de la pantalla.
8. **Estado vacío y error con acción**: «Sin títulos en esta categoría» ofrece «Ver todas»; el error de fuente ofrece «Reintentar» y «Ajustes».
9. **Kids**: el halo de foco usa mantequilla y el panel ampliado oculta la puntuación; refuerza la identidad del perfil sin nuevas animaciones.
10. **Tipografía desde el sofá**: leyenda de tarjeta en TV a 24 px y sinopsis del panel a 26 px con tres líneas; se validan a 43, 55 y 65 pulgadas en la prueba física.

### Fase E. Verificación y paquete

1. `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`.
2. Smokes: `compositor-motion`, `tv-navigation`, `vertical-navigation`, `virtual-catalogue`, `banner-navigation`, `card-loading`, `trailer-lifecycle`. Guardar los JSON en `artifacts/` junto a los anteriores para comparar.
3. Capturas de referencia de foco, panel abierto y escena en TV simulado.
4. Informe de cambios en este documento. No se instala en el Samsung sin indicación de Richard; la actualización se hace como actualización, nunca desinstalando.

## 4. Orden y responsables

- Ola 1, en paralelo y sin archivos compartidos: Fase A (JS) y Fase B (CSS).
- Ola 2: Fase C, que depende de A y B.
- Ola 3: Fase D en cambios pequeños, cada uno con su prueba.
- Ola 4: Fase E.

Criterio de aceptación local: p95 tecla→segundo RAF ≤ 33 ms con CPU 4× en los smokes existentes, 0 tareas largas al navegar, 0 eventos Layout al abrir el panel en TV, y el panel colocado sobre su tarjeta en todos los casos de la prueba nueva.

## 5. Resultado de la implementación (6 de octubre de 2026)

Fases A, B, C, C2, D y E aplicadas. 240 pruebas unitarias en verde (219 al empezar), `npm run build`, `npm run build:tizen` y `npm run test:tizen` correctos. El paquete `artifacts/Richiflix-Tizen-unsigned.wgt` queda generado **sin firmar y sin instalar**: no se ha tocado el Samsung; la instalación queda a la espera de Richard y se hará como actualización, nunca desinstalando.

### 5.1 Métricas antes/después

Todas son medidas de este PC (Chromium headless de Playwright, 1920×1080, sin GPU; CPU 4× donde el smoke lo indica). Son proxies de presentación: **no certifican el comportamiento del Samsung**. «Antes» es el JSON previo guardado en `artifacts/` (o en el respaldo de la fase correspondiente); «Después» es la ejecución final de la Fase E.

| Métrica (smoke) | Antes | Después |
|---|---|---|
| P95 tecla→segundo RAF, banner con CPU 4× (`banner-navigation`) | 33,1 ms (antes de Fase C) · 31,8 ms (tras D) | 33,4 ms (máx. 34,4) |
| P95 tecla→segundo RAF, cuadrícula de 27 000 títulos (`virtual-catalogue`) | 34,9 ms | 33,5 ms |
| Tareas largas durante la navegación (`banner-navigation`, `virtual-catalogue`) | 0 / 0 | 0 / 0 |
| Tarjetas montadas máximas: cuadrícula / rails (`virtual-catalogue`, `vertical-navigation`) | 40 / 22 | 40 / 22 |
| Commits intermedios del banner en 30 pulsaciones · commits finales | 0 · 1 (antes de C) | 0 · 0 (el banner ya no sigue a la tarjeta) |
| Peticiones de metadatos intermedias del banner | 0 | 0 |
| Giros del carrusel durante la ráfaga · primer giro tras el reposo | — | 0 · 11 009 ms |
| Layout / Paint al abrir el panel (`compositor-motion`) | 4 / 34 (antes de Fase B) · 1 / 21 (tras D) | 1 / 26 |
| Paint al pasar el cursor por tarjetas (`compositor-motion`) | 57 (original) | 9 |
| Heap JS de la cuadrícula, 3 rondas de 500 movimientos (`virtual-catalogue`) | 16,8 / 15,9 / 15,3 MB | 15,3 / 17,2 / 15,5 MB (estable, ≤ +10 %) |
| Geometría de la escena con tráiler (top/alto de `.page-scene`) | 553,6 / 526 px | 553,6 / 526 px, idéntica antes y después |

Los 5 Paint extra al abrir el panel respecto a la Fase D vienen del fundido de opacidad de las vecinas tapadas (E7); el Layout sigue en 1. `performance-smoke` no se pudo comparar: falla igual con el código original (ver 5.4).

### 5.2 Comportamiento nuevo en TV

- **Foco único**: la selección (`.is-previewed`) es la única fuente; la tarjeta sube 6 px y escala `--tv-focus-scale` (1,06) con `will-change` sólo en la seleccionada; sin sombras desenfocadas, filtros ni cambio de color.
- **Panel superpuesto** (sustituido por la Fase F: ahora las vecinas se apartan; ver 5.6): la tarjeta ampliada aparece sobre su tarjeta (geometría del modelo, ±1 px), con fundido + 8 px en 160 ms, sin deformar, sin mover vecinas, sin cambiar el track ni desplazar el rail. **Superpuesto limpio** (E7): las celdas que el panel tapa en parte (misma fila y, en cuadrícula, la siguiente si la pisa) se ocultan con opacidad en 120 ms (`.is-covered`, sin transición con movimiento reducido) y vuelven al cerrar, al instante si se cierra navegando.
- **Scroll vertical alineado** (E1): al subir o bajar, la fila enfocada (en Inicio, la sección completa con su título) se alinea con el borde superior de la lista menos 24 px; nunca queda una fila a medias bajo el banner. La primera fila vuelve a scroll 0 y la cuadrícula reserva espacio para que la última también se alinee, sin rebote. PC (scroll de `window`) mantiene el desplazamiento mínimo.
- **Banner como carrusel** de hasta 8 recomendaciones (Continuar viendo + TMDB), siempre visible y de altura fija; gira cada 9 s con fundido de opacidad, se pausa con el mando en movimiento, con foco en tarjetas, con tráiler, diálogos o pestaña oculta. **Mando**: los puntos son el único sitio donde Izquierda/Derecha cambian de recomendación; Arriba desde Reproducir llega a los puntos.
- **Tráilers automáticos**: ajuste «Tráilers automáticos» (`rf-auto-trailers`), desactivado por defecto en Tizen; activado, arranca 1,5 s después de asentarse.
- **Volver**: desde cualquier contenido sube a la cabecera; desde la cabecera limpia la búsqueda, va a Inicio y después al selector de perfil. Sin nada enfocado (justo tras elegir perfil) cuenta como cabecera.
- **Inicio corto**: como máximo seis filas antes de «Tu próximo mood», dos de ellas TMDB, alternando por día.
- **Pista «Mantén OK para opciones»** sólo las tres primeras veces por perfil.
- **Posición en la fila** dentro del panel («4 de 48») y **tiempo restante** («Te quedan 42 min») en «Continuar viendo».
- Kids: halo mantequilla y panel sin puntuación. Leyenda de tarjeta a dos líneas fijas.

### 5.3 Pendiente de prueba física en el Samsung

Fluidez real (FPS y tiempos de compositor) de foco, panel, fundido del carrusel y scroll alineado; legibilidad de leyenda y sinopsis a 43, 55 y 65 pulgadas; error 153 de YouTube con «Tráilers automáticos» activado; memoria de imágenes durante sesiones largas; mando físico (pulsación larga de OK, Volver 10009). Ninguna de estas medidas se ha hecho en el TV.

### 5.4 Verificación local y límites

- Smokes en verde: `compositor-motion`, `banner-navigation`, `pc-experience`, `virtual-catalogue`, `vertical-navigation`, `card-loading`, `trailer-lifecycle`, `virtual-mode`, `tizen-smoke`.
- `performance-smoke` falla en `scripts/performance-smoke.mjs:46` (`-1 !== 1499`): el script es del 5 de octubre y espera volver a la tarjeta recordada con Abajo desde Reproducir, pero desde entonces existe la entrada «Filtrar por categoría» (`CategoryChips`, ya en el código original) entre el banner y la cuadrícula, y más adelante busca un `<select>` «Categoría» que ya no existe. Falla igual sin los cambios de estas fases; actualizarlo queda fuera de alcance.
- `virtual-catalogue` (presupuesto de rails ≤ 30 celdas) vuelve a pasar sin tocar el umbral: con el desplazamiento mínimo, al bajar a la segunda fila entraba una tercera en la banda de precarga de 280 px del IntersectionObserver, y cada rail en reposo monta 11 celdas (8 visibles en 1920/240 px + 3 de overscan a la derecha), 33 en total. Con la fila alineada arriba (E1) sólo quedan la fila enfocada y la siguiente en la banda. Inicio real en TV: como máximo 3 rails y unas 24 celdas montadas. El límite de 30 es del smoke; los documentos sólo fijan presupuesto para la cuadrícula (40–56 tarjetas).
- Capturas: `artifacts/faseE-tv-home.png`, `faseE-tv-home-expandida.png`, `faseE-tv-peliculas.png` (= `faseE-peliculas-fila2.png`) y `faseE-pc-home.png`, con el montaje de demostración de `pc-experience`. El arte del banner de la demo no carga en headless; las tarjetas sí.

### 5.5 Perillas de calibración

- `--tv-focus-scale` (`src/compositorMotion.css`, por defecto 1,06): bajarlo a 1 elimina la escala del foco sin tocar código.
- `rf-auto-trailers` (localStorage / Ajustes): tráilers automáticos; `false` por defecto en Tizen. Retardo `TV_TRAILER_DELAY_MS` = 1500 en `src/trailerApi.js`.
- Carrusel: `createBannerCarousel({intervalMs:9000,resumeMs:2000})` en `src/bannerFlow.js` (intervalo y reposo antes de reanudar).
- Margen de alineación vertical: 24 px (`viewportAlignDelta` en `src/virtualViewport.js`).

### 5.6 Fases F, F2, G y pasada final

- **F**: el panel ya no tapa a las vecinas; en rails las de la derecha se desplazan el ancho que falta (`neighbourShifts`), en cuadrícula se apartan en su fila; transiciones más cortas con una sola perilla (F9: `--tv-fast/base/slow` 80/110/180 ms, 60/90/150 ms en `.samsung-tv`).
- **F2**: pasada la mitad del rail, el panel abre hacia la izquierda (tapa las ya vistas) con histéresis (`expansionAlignFor`, `align:'end'`); la cuadrícula no cambia.
- **G**: `preconnect` a TMDB y al proveedor, precarga direccional de pósters (`artworkPrefetch.js`, concurrencia 3, cola 24), carga inmediata de celdas montadas, identidad en vez de spinner, caché en disco ampliada y calentamiento en `Boot`.
- **Pasada final**: la etiqueta de edad larga (PG-13) del panel vuelve arriba a la derecha del arte (la regla de esquina inferior es para la tarjeta, que lleva puntuación arriba); en PC las flechas desde una tarjeta ya no caen en los botones del panel abierto.

| Comprobación (pasada final, 6 de octubre, noche) | Resultado |
|---|---|
| `npm test` | 269/269 |
| `npm run build`, `build:tizen`, `test:tizen` | OK |
| `pc-experience` | casos funcionales en verde; puerta de P95 no válida (56,3 ms, 1 tarea larga) porque el PC tenía un juego abierto (~3 núcleos); umbral sin tocar (34,4 ms) |
| `vertical-navigation`, `card-loading`, `channel-guide`, `trailer-lifecycle`, `virtual-mode` | OK |
| `virtual-catalogue` | 2 de 3 OK (la 1.ª: heap +11,5 %, GC) |
| `compositor-motion`, `banner-navigation` (×3), `performance-smoke` | no ejecutados: se pidió parar los smokes; la última referencia válida sigue siendo la de la Fase G (banner P95 33,2 ms) |

Paquete final: artifacts/Richiflix-Tizen-unsigned.wgt generado a las 21:05 del 6 de octubre de 2026; instalación pendiente del usuario.

## Fase F. Vecinas que se apartan en TV (pedido de Richard, 6 de octubre, tarde)

Sustituye la decisión «superpuesto limpio» de la Fase E7: al ampliar una tarjeta en TV, las vecinas se desplazan en vez de quedar tapadas. Se ejecuta después de L3 de eventos para no compartir archivos.

1. **Modelo de espacio** (`cardExpansion.js`, puro, con pruebas): dada la fila o cuadrícula, la tarjeta seleccionada y la caja del panel, devuelve el desplazamiento de cada vecina. Rail: las de la derecha se mueven el ancho del panel menos el ancho de tarjeta más el hueco; las de la izquierda no. Si el panel supera el borde derecho, un solo desplazamiento del rail calculado desde el modelo. Cuadrícula: sólo la misma fila; las que saldrían por el borde se atenúan; las filas inferiores no se mueven.
2. **`reserveCardExpansion` en TV**: usa la ruta de PC con esos desplazamientos, aplicados sólo al abrir tras los 250 ms de reposo. `transform: translate3d` únicamente, 160 ms, capas con `leaseTransformLayers`. `cleanup(true)` devuelve sin transición al navegar; la salida tranquila desliza de vuelta. `coverNeighbours` queda como respaldo cuando no hay sitio.
3. **Un solo transform de grupo**: las vecinas de la derecha se mueven como un bloque (wrapper o transform compartido) para no animar diez capas; máximo dos capas animadas por tecla. Sin cambios de layout durante ráfagas. Reduced motion: desplazamiento sin animación.
4. **Geometría**: `expandedCardPlacement` sigue colocando desde el modelo; en rail el panel alinea su borde izquierdo con la tarjeta; ninguna lectura del DOM durante la animación.
5. **Smokes**: `pc-experience` sustituye «las vecinas de TV nunca se mueven» por: la primera vecina queda íntegra a la derecha del panel sin solaparse y vuelve a `transform: none` tras Escape y tras una flecha; `compositor-motion` sin Layout nuevos al abrir y 0 Paint a mitad de la animación; `tv-navigation`/`banner-navigation` P95 ≤ 33 ms y 0 tareas largas.
6. **Capturas**: tarjeta ampliada en rail y en cuadrícula, TV, 1920×1080.

7. **Duraciones más cortas (F9, pedido de Richard: «las transiciones se sienten pesadas»)**: una sola perilla en `.app.tv-mode` (`--tv-fast` 80 ms, `--tv-base` 110 ms, `--tv-slow` 180 ms; más cortas en `.samsung-tv`) para elevación y halo del foco, apertura y recolocación del panel, vecinas, fundido del carrusel y del tráiler, color de fila activa y puntos; espera del panel 250 → 180 ms; deslizamiento de scroll 140–220 → 90–150 ms en TV; sin la entrada de arte de 500 ms del banner en TV. `settleMs` (480 ms) y el retardo del tráiler (1,5 s) no cambian.

Archivos: `cardExpansion.js` (+ test), `cardExpansionSpace.js`, `useCardExpansion.js`, `compositorMotion.css`/`virtualCatalogue.css`, `scripts/pc-experience-smoke.mjs`. No se instala en el TV sin indicación de Richard.

**Implementado (6 de octubre, tarde).** Modelo: `neighbourShifts({cells,anchorIndex,panel,kind,columns,viewportRight})` en `cardExpansion.js` (puro, con pruebas) devuelve `{shifts,faded,scroll}`: en rail, las celdas a la derecha del ancla se desplazan `panel.right − ancla.right` (= ancho del panel − ancho de tarjeta; el hueco se conserva), las de la izquierda no, y si el panel pasa del borde derecho visible (−16 px) `scroll` es el desplazamiento del rail que lo deja empezando en su tarjeta; en cuadrícula sólo se mueve la fila del ancla hacia la derecha, las que cruzarían el borde de la cuadrícula se atenúan y cualquier celda que el panel siga pisando (fila inferior si es más alto, izquierda si quedó recortado) también se atenúa. `coveredCells`/`coverNeighbours` desaparecen: su papel de respaldo lo cumple `faded` (`.is-covered`, sólo opacidad). En TV el panel empieza siempre en el borde izquierdo de su tarjeta (`alignStart` también en cuadrícula, para que las de la izquierda no queden tapadas). `reserveCardExpansion` (rama TV, `makeRoom`) lee una vez los rects de los contenedores estables, aplica el `scrollTo` del rail **antes** de cualquier escritura (sin layout forzado), y después escribe: en rail, **un solo transform compartido**: clase `is-expansion-anchor` en la celda ancla y `--expansion-shift` en la pista, con la regla `.is-expansion-anchor ~ .virtual-rail-cell{transform:translate3d(var(--expansion-shift),0,0)}`; así las celdas que monta la ventana virtual tras el scroll nacen ya desplazadas y sin transición. No se envolvió el rail en un wrapper porque exigiría cambiar el DOM de `VirtualCarousel`. En cuadrícula, `translate3d` en línea en las celdas de la fila. Las celdas que no se ven ni antes ni después del movimiento llevan `transition:none` mientras dura la apertura; las visibles reciben capa con `leaseTransformLayers`. Sin `minWidth`/`minHeight`: la pista de rail en TV lleva un margen final fijo (`.virtual-rail-track:after`, absoluto, 960 px) que existe desde el montaje, para que la última tarjeta pueda desplazar el rail. `cleanup(true)` (navegar) devuelve sin transición y la restituye en el cuadro siguiente; el cierre tranquilo desliza de vuelta; movimiento reducido: sin animación. PC sin cambios. Coste medido (`compositor-motion`, cuadrícula, Chromium headless): Layout al abrir 1 → 1, Paint al abrir 27 → 34 (raster inicial de las celdas que se mueven), 3 capas de vecinas con transición de transform por apertura (`panelOpenAnimatedNeighbourLayers`, nuevo); en rail son las visibles a la derecha (6 en la prueba unitaria a 1920 px), no las ≤ 2 del objetivo: con un solo transform de grupo sin wrapper cada celda sigue siendo su propia capa. `pc-experience` comprueba que la primera vecina queda íntegra a la derecha del panel (rail y cuadrícula), que vuelve a `transform: none` tras Escape y tras una flecha, que en una ráfaga de 8 teclas a `EXPANSION_DELAY_MS/3` no se mueve ninguna vecina ni se abre panel, y que las filas inferiores no se mueven. Capturas: `artifacts/faseF-rail-expandida.png`, `artifacts/faseF-grid-expandida.png`.

**F9, transiciones más cortas (pedido de Richard tras probar en el TV).** Una sola perilla en `compositorMotion.css`: `.app.tv-mode,.expansion-tv{--tv-fast:80ms;--tv-base:110ms;--tv-slow:180ms}` y en `.samsung-tv` 60/90/150 ms (el panel vive en un portal fuera de `.app`, por eso lleva la perilla también). Calibración: si el Samsung sigue pesado, bajar las tres. Usos: elevación de la tarjeta `--tv-base` al subir y `--tv-slow` al bajar la que se deja (así su capa sigue viva cuando llega la tecla siguiente; con 90 ms se degradaba y se volvía a rasterizar en cada tecla: P95 35,0 → 34,3 ms al separarlo); halo de la tarjeta `--tv-fast` al entrar y `--tv-base` al salir; apertura del panel, backplate y degradado del cuerpo `--tv-base`; recolocación WAAPI del panel 220 → 140 ms; espera antes de abrir 250 → 180 ms (`EXPANSION_DELAY_MS`, leída por el smoke); vecinas `--tv-base` y `.is-covered` `--tv-fast`; halos de cabecera, chips y botones del panel `--tv-fast`; todos los botones en TV `--tv-base`; carrusel: arte `--tv-slow`, texto `--tv-base`, puntos `--tv-fast`; título de fila `--tv-fast`; acciones del banner en Samsung `--tv-fast`; fundido del banner al reproducir tráiler de tarjeta `--tv-base`. `focus-art-enter` y el fundido del tráiler del banner ya estaban anulados en TV por `style.css`. Scroll: `createScrollGlide` acepta `{min,max}` y `virtualViewport.js` expone `TV_GLIDE_MS`, que queda en 140–220 ms: con 90–150 ms el P95 de `pc-experience` (TV en vivo, CPU 4×) subía 0,8–3 ms sobre su umbral de 34,4 ms; se baja cuando la prueba física lo pida. Sin cambios: `settleMs` 480 ms del banner y 1,5 s del tráiler. Verificación: 253 pruebas, `build`, `build:tizen`, `test:tizen`, `compositor-motion`, `banner-navigation` y `virtual-catalogue` en verde (este último con un fallo intermitente de heap, +10,4 %, que pasa al repetir). `pc-experience` pasa todas las comprobaciones de la Fase F; su puerta final de P95 (TV en vivo, CPU 4×, ≤ 34,4 ms) es inestable en este PC: con la máquina tranquila, antes 33,3–34,0 ms (n = 4) y después 33,4–35,2 ms (n = 8, mediana 34,3); con la máquina cargada, antes y después alternados dan 35–43 ms ambos. 0 tareas largas en todas las ejecuciones.

### F2. Dirección de apertura del panel en rails (pedido de Richard: «pasada la mitad, que tape las de la izquierda, que ya viste»)

**Implementado (6 de octubre, noche).** Sólo rails (TV y PC); la cuadrícula no cambia. Decisión desde el modelo, sin rects transformados: `expansionAlignFor({cellLeft,cellWidth,scrollLeft,viewportWidth,previous,panelWidth})` (puro, `cardExpansion.js`) toma el centro de la celda relativo al viewport del rail (`cell.left − rail.scrollLeft + cell.width/2`) frente a `rail.clientWidth/2`; pasada la mitad devuelve `'end'` (el panel abre hacia la izquierda: su borde derecho sobre el de la tarjeta). Histéresis de ±media tarjeta respecto a la última dirección del rail, guardada en `rail.dataset.expansionAlign` (sin lecturas extra: `scrollLeft`/`clientWidth` se leen tras el `getBoundingClientRect` del ancla, con el layout limpio). Si el panel no cabe a la izquierda ni con el rail en 0 (`cell.left + cell.width < panel.width`, primeras tarjetas) se queda en `'start'`. `expandedCardPlacement` acepta `align:'start'|'end'|'center'` (`alignStart:true` ≡ `'start'`), con el mismo clamp; en PC conserva su tamaño (≤ 620 px) y sólo cambia el lado. `neighbourShifts({…,viewportLeft,align:'end'})`: las celdas a la izquierda del ancla se desplazan `−(panel.width − cell.width)`, las de la derecha y el ancla no; si el panel pasa del borde izquierdo visible (+16 px), `scroll` < 0 es el único desplazamiento del rail hacia la izquierda, aplicado antes de colocar (`useCardExpansion` recoloca con `box.left − scroll`, sin medir otra vez); si aun así lo pisara, la celda se atenúa como en F. TV (`makeRoom`): Chromium 85 no tiene selector de hermanos anteriores, así que en vez de una clase por celda la pista recibe `data-expansion-end` y `--expansion-shift-left`; `.virtual-rail-track[data-expansion-end]>.virtual-rail-cell` toma el desplazamiento y `.is-expansion-anchor` y sus hermanos posteriores vuelven a `none` (`expandedCard.css`). Una escritura, sin recorrer celdas, y las celdas que la ventana virtual monte tras el scroll nacen ya desplazadas (con una clase `.is-before-anchor` nacerían sin ella). Se descartó desplazar la pista y compensar ancla + posteriores: animaría más capas y movería el rect de la pista del que sale `cellAnchorBox`. Capas animadas: sólo las celdas visibles del lado que se aparta (izquierda), con `leaseTransformLayers`; las que no se ven ni antes ni después llevan `transition:none`. Para la tarjeta 6 de 8 son 5 a la izquierda frente a las 2 de la derecha que movería abrir hacia la derecha; `panelOpenAnimatedNeighbourLayers` del smoke de compositor mide la cuadrícula y no cambia (3 → 3). PC: las de la izquierda se desplazan `−extra`, sin `minWidth` (no hace falta espacio al final) y con el mismo scroll izquierdo calculado. `cleanup(true)` instantáneo al navegar, cierre tranquilo con transición, movimiento reducido sin animación, como en F.

Pruebas: 264 unitarias (dos nuevas: decisión, histéresis, clamp y `align:'end'` de `expandedCardPlacement`; `neighbourShifts` hacia la izquierda con y sin scroll; `reserveCardExpansion` TV con `--expansion-shift-left`, capas sólo en las visibles de la izquierda y scroll izquierdo único). `pc-experience` añade: tarjeta 6 de 8 en el rail de Películas en TV → panel con borde derecho sobre la tarjeta (±1 px) y `panel.left < card.left`, vecina izquierda íntegra a la izquierda del panel, vecinas 7 y 8 con `transform: none`, todo a `none` tras Escape y tras una flecha; la tarjeta 1 sigue abriendo a la derecha (`panel.left ≈ card.left`). Capturas: `artifacts/faseF2-rail-izquierda.png`, `artifacts/faseF2-rail-derecha.png`. Medido: `compositor-motion` Layout al abrir 1, Paint al abrir 32 (antes 33), capas 3; `banner-navigation` P95 33,2 → 33,7 ms. `pc-experience` pasa todas las comprobaciones de F y F2; su puerta final de P95 (TV en vivo, CPU 4×, ≤ 34,4 ms) sigue inestable: 34,5–35,3 ms con F2 frente a 34,4–34,6 ms sin F2 en la misma máquina, y tras las ediciones paralelas de eventos/equipos seguidos (`ExpandedCard.jsx`, `App.jsx`, 20:24–20:25) falla antes, en el foco del primer chip de señal del evento, también con los archivos de F2 revertidos.

## Fase G. Imágenes que llegan antes (pedido de Richard, 6 de octubre, tarde)

Síntoma: al navegar, algunas tarjetas siguen mostrando el indicador de carga. Causas en el código: las imágenes de una fila sólo se piden cuando sus celdas se montan (ventana virtual de 11 celdas por rail y 1–2 filas de margen), con `loading="lazy"`; durante la carga la tarjeta muestra un spinner y nada más (`fallbackWhileLoading={false}`); el navegador abre como mucho seis conexiones a `image.tmdb.org`; la caché en disco (IndexedDB vía worker) guarda 200 entradas y sólo se llena con lo que ya se vio; no hay `preconnect`.

1. **Conexión anticipada**: `<link rel="preconnect">` a `https://image.tmdb.org` en `index.html` y, en tiempo de ejecución, al host del proveedor Xtream configurado (CSP ya lo permite).
2. **Precarga direccional de pósters** (lo principal): una cola acotada (`src/artworkPrefetch.js`, pura y testeable: concurrencia 3, cola 24, prioridad por distancia) que, 150 ms después de que la navegación se asiente, pide con `new Image()` y `fetchPriority='low'` los pósters de las 2 filas siguientes en el sentido del movimiento y de las 8 tarjetas siguientes del rail actual, al mismo tamaño responsivo que usará la tarjeta (`responsivePosterArtwork` con el ancho del layout), sin montar tarjetas. Las filas/rails ya entregan su ventana al planificador (`warmWindow`): reutilizar ese canal. Nada durante ráfagas de teclas (`banner.moving`). Cancelar lo abandonado al cambiar de dirección o de página.
3. **Celdas montadas = carga inmediata**: las imágenes de celdas dentro de la ventana virtual se piden con `loading="eager"` (están montadas porque están cerca); sólo las de la cuadrícula a más de una fila mantienen `lazy`. Las de la fila enfocada van con `fetchPriority="high"`.
4. **Identidad inmediata en vez de spinner**: durante la carga, la tarjeta muestra su identidad (fondo de categoría local ya decodicado + título) a partir de 120 ms, y el póster real aparece con fundido de opacidad al decodificarse. Sin spinner en tarjetas; el spinner queda para la tarjeta ampliada y el banner. Dos capas sólo mientras llega el póster; después la identidad se oculta (opacity 0), nunca se desmonta a mitad del fundido.
5. **Caché en disco más útil**: subir límites a 400 entradas / 64 MB cuando el `quota` lo permita; guardar también lo precargado (hoy sólo lo mostrado); al arrancar (`Boot`, etapa «artwork»), calentar los primeros 16 pósters de Inicio con un presupuesto de 1,5 s que no retrasa la entrada.
6. **Medición**: ampliar `scripts/card-loading-smoke.mjs` con red limitada (4 Mbit/s, 100 ms de RTT) y 30 movimientos en Inicio y en Películas: porcentaje de tarjetas que muestran indicador de carga más de 150 ms después de entrar en pantalla, antes/después. Objetivo: < 10 % con caché fría y 0 % con caché caliente; sin tareas largas; peticiones de imagen durante una ráfaga de 10 teclas: 0.

Archivos: `index.html`, `src/QualityImage.jsx`, `src/responsiveArtwork.js`, `src/previewArtwork.js`, nuevo `src/artworkPrefetch.js` (+ test), `src/artworkDiskCache.js`, `src/Boot.jsx`, `src/proactivePreviews.js`/`App.jsx` (sólo el enganche de `warmWindow`), `src/interactions.jsx` (props de QualityImage de la Card), CSS de `.richiflix-art`/`.artwork-spinner`, `scripts/card-loading-smoke.mjs`. No se instala en el TV sin indicación de Richard.
**Implementado (6 de octubre, Fase G).** G1: `index.html` abre `preconnect` a `https://image.tmdb.org` (con y sin `crossorigin`: las `<img>` usan el grupo con credenciales y el worker de caché el anónimo); `App` añade un `preconnect` por origen de proveedor configurado (`new URL(host).origin`, sin usuario ni contraseña), una sola vez por sesión. G2: `src/artworkPrefetch.js` (+ test) — `createArtworkPrefetch({load,concurrency:3,queueLimit:24,now,done})`, `plan(items,{layoutWidth,dpr})` ordena por distancia, calcula la URL con `responsivePosterArtwork`, salta lo ya mostrado (`shownArtwork`, que alimenta `QualityImage` al revelar) o en vuelo y cancela lo que sale del plan; `pause()` cancela lo que está en vuelo y lo devuelve a la cola, `resume()`, `clear()`. `loadPosterArtwork` usa `new Image()` con `decoding='async'`, `fetchPriority='low'` y `remember` del worker al terminar (≤ 3 `Image` vivas). `App`: 150 ms después de que se asienta la navegación (sin `banner.moving`, sin detalle/reproductor/modal) pide las 8 tarjetas siguientes del rail en el sentido de `lastDirection` y las ventanas de los 2 rails siguientes (`VirtualCarousel` entrega su ventana aunque esté lejos como tercer argumento de `warmWindow` y marca la fila con `data-warm-id`), o las 2 filas siguientes de la cuadrícula; se pausa en cada ráfaga y se vacía al cambiar de página, filtro, búsqueda o perfil. G3: la tarjeta enfocada pide su póster con `fetchPriority="high"` (`priority`, nueva prop de `QualityImage`; por defecto sigue a `eager`, así banner y tarjeta ampliada no cambian). **`eager` en todas las celdas se probó y se retiró**: subía el P95 de `banner-navigation-smoke` 1,5–1,7 ms (la petición nace dentro del commit de la tecla); `loading="lazy"` de Chromium ya pide las celdas montadas (su margen supera las 1–2 filas de overscan). Imágenes montadas máximas sin cambios: 40 cuadrícula / 22 rails. G4: `QualityImage` acepta `placeholderDelay` (120 ms): pasado ese tiempo sin póster muestra el `fallback` (ContentIdentity), nunca dentro de una ráfaga de teclas (espera 250 ms sin `richiflix-catalog-navigation`; montar la identidad en esos cuadros costaba ~4 ms de P95); al decodificar, póster e identidad cruzan sólo `opacity` en .18 s (bloque `/* Fase G */` de `style.css`) y la identidad se desmonta 220 ms después; con movimiento reducido, sin transición y desmontaje inmediato. La Card ya no pasa `loader` ni `fallbackWhileLoading={false}`; banner, episodios y tarjeta ampliada conservan su spinner. G5: caché en disco 400 entradas / 64 MB (la fórmula con `quota` sigue recortando: con 100 MB de cuota quedan 10 MB) y cola de `remember` 24; lo precargado también se guarda; `Boot` (etapa «artwork») calienta los 8 primeros pósters de Películas y de Series (ancho de rail 245 px; «Continuar viendo» depende del perfil y no se conoce aún) en paralelo con los metadatos del banner, con tope de 1,5 s (`bounded`); lo que no llega sigue en segundo plano.

Medición (`scripts/card-loading-smoke.mjs`, Chromium sin cabeza 1920×1080 en modo TV, sin limitar CPU; pósters de 34 kB servidos por un proxy local que comparte un enlace simulado; sin `page.route`, porque desactiva la caché HTTP; «antes» = copia de `src/` previa a la fase con el mismo script; 30 movimientos en Inicio y 30 en Películas, en grupos de 3 teclas):

| Métrica | Antes | Después |
|---|---|---|
| Tarjetas con indicador > 150 ms, 4 Mbit/s 100 ms, fría Inicio / Películas | 0 % / 0 % | 0 % / 0 % |
| Ídem, caliente (segunda pasada) | 0 % / 0 % | 0 % / 0 % |
| Estrés 1 Mbit/s 300 ms, fría Inicio / Películas | 4,8 % / 66,7 % | 0 % / 62,5 % |
| Estrés, caliente | 0 % / 0 % | 0 % / 0 % |
| Peticiones de imagen en ráfaga de 10 teclas (todas / del prefetch), 4 Mbit/s | 10 / 0 | 6 / 0 |
| Tareas largas | 0 | 0 |
| Imágenes montadas máximas (rails / cuadrícula) | 30 / 40 | 30 / 40 |
| `banner-navigation-smoke` P95 tecla→2.º rAF (media de 3 pares alternos) | 33,2 ms | 33,2 ms |

Lectura honesta: con el perfil pedido, el código anterior ya no dejaba indicadores > 150 ms en este proxy local, así que la mejora sólo se ve en el perfil de estrés y en las peticiones de la ráfaga; Películas con 1 Mbit/s está limitado por ancho de banda (40 pósters montados al entrar) y ninguna precarga lo arregla. Las peticiones de la ráfaga no llegan a 0: diez teclas superan las 8 tarjetas precargadas y montan celdas nuevas; el prefetch hace 0 durante la ráfaga. Falta validar en el Samsung. Perillas: `concurrency` 3 y `queueLimit` 24 (`artworkPrefetch.js`), retraso 150 ms tras asentarse (`App.jsx`), `placeholderDelay` 120 ms y silencio de teclas 250 ms (`QualityImage.jsx`), `artworkCacheLimits` 400 / 64 MB y cola de `remember` 24 (`artworkDiskCache.js`), presupuesto de arranque 1,5 s y ancho 245 px (`Boot.jsx`).

Paquete final: artifacts/Richiflix-Tizen-unsigned.wgt generado a las 21:05 del 6 de octubre de 2026; instalación pendiente del usuario.
