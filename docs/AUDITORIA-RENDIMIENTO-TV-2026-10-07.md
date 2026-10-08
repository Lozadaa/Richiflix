# Auditoría de rendimiento en TV — 7 de octubre de 2026

Alcance: sólo lectura. Revisé el código (`src/`), el paquete construido (`dist-tizen/`) y volví a analizar la traza real del Samsung (`artifacts/tv-trace-navigation.json`) con scripts propios. No toqué el TV, no ejecuté smokes y no modifiqué el proyecto, salvo este documento. El script de medición queda listo en el scratchpad (`perf-audit/tv-measure.mjs`, ver J), pero no lo ejecuté.

Etiquetas usadas: **[medido]** sale de la traza del TV; **[código]** se lee directamente en el fuente o en el bundle; **[hipótesis]** es una inferencia que hay que confirmar con J.

---

## Resumen ejecutivo

### Tres correcciones de diagnóstico

1. **El motor del TV no es Chromium 85.**
   - La traza contiene eventos `Layerize` y `PrePaint`. `Layerize` pertenece a CompositeAfterPaint, que llegó en M94; en M85 el equivalente era `UpdateLayerTree` / `CompositeLayers`.
   - `artifacts/tizen-deployment.json` registra Tizen 10.0. La tabla de Samsung asigna a Tizen 10 (2026) Chromium M130.
   - Consecuencias:
     - `inert`, `content-visibility`, `aspect-ratio` y `:has()` son nativos en el TV.
     - El polyfill `wicg-inert` se desactiva solo, porque comprueba `HTMLElement.prototype.hasOwnProperty('inert')`. **No es una causa** de la lentitud en este TV.
     - El objetivo `chrome85` del build sigue siendo correcto para los TV de 2022.
2. **La tarea larga de 192 ms no es GC ni JavaScript.** **[medido]**
   - Esa tarea dura 192,7 ms de pared y sólo 2,1 ms de CPU del hilo.
   - Las demás tareas largas siguen el mismo patrón: 99,4 ms de pared con 3,2 ms de CPU, 91,6/2,9 ms, 58,2/13,7 ms y 32,1/4,9 ms.
   - En total, el hilo principal pasa 671 ms dentro de tareas pero sólo usa 191 ms de CPU: **el 72 % del tiempo está esperando.**
   - Mientras espera, el pool de raster (3 hilos `ThreadPoolForegroundWorker`) está saturado: 866 ms de raster de pared y 768 ms de CPU en una ventana de 679 ms.
   - **Conclusión: la latencia por tecla es el raster.** El hilo principal no puede emitir el siguiente cuadro mientras el raster y la decodificación ocupan la CPU.
3. **El raster se hace por CPU.** **[medido + hipótesis]**
   - `RasterTask` usa CPU casi al 100 % de su duración: 768 de 866 ms.
   - No aparece ningún `ImageUploadTask`, que es la firma del raster por GPU.
   - El hilo GPU sólo suma 80 ms de `GPUTask`.
   - Las decodificaciones siguen la ruta `Decode LazyPixelRef` en los workers.
   - No hay documentación pública de Samsung sobre esto; `SystemInfo.getInfo` lo confirma en J.

### Las cinco causas más probables, por impacto esperado en el TV

| # | Causa | Evidencia | Impacto estimado |
|---|---|---|---|
| 1 | **Las capas de las tarjetas se crean y destruyen en cada tecla.** Se promueve la tarjeta nueva y se degrada la saliente; además, el halo `:after` anima opacidad y crea una capa transitoria durante 60 ms. Al terminar cada transición, la tarjeta se vuelve a rasterizar. | **[medido]** Tras la 2.ª tecla, las capas 700 y 709 (las dos tarjetas) se rasterizan 3 veces cada una (cuadros 8665, 8667 y 8668), a 20–42 ms por vez: unas 6 rasterizaciones por tecla (~200 ms de CPU). **[código]** `compositorMotion.css:7-8,56-60`, `cardSelectionStore.js:7-12`. | Alto. En el mismo TV, retener la capa de cada tarjeta bajó el P95 de 268,8 a 67,2 ms (PLAN-RENDIMIENTO, «Raster de tarjetas»). |
| 2 | **El scroll probablemente no está compuesto.** Los rails y `.page-scene` son scrollers transparentes con DPR 1. Cada paso horizontal en el borde del rail repinta la fila visible entera, y cada deslizamiento vertical (140–220 ms) repinta la escena en cada cuadro. | **[medido]** La capa 650 rasteriza 16 tiles en un solo cuadro (≈ 1920×420 px, la fila visible) en 230 ms, con el hilo principal bloqueado 99 ms. **[código]** Sin `background` en `.cards.virtual-rail` (`virtualCatalogue.css:12`) ni en `.page-scene` (`compositorMotion.css:47`). **[hipótesis]** Falta comprobar con `scrollRects: RepaintsOnScroll`. | Alto, en los bordes del rail y en cada Arriba/Abajo. |
| 3 | **El panel ampliado se abre en casi cada tecla al ritmo humano.** El retardo es de 180 ms, y la mayoría de la gente pulsa cada 300–600 ms. Cada apertura hace lecturas de layout, presta `will-change` a unas 7 vecinas durante 600 ms (7 capas nuevas que luego se vuelven a fusionar), monta un portal de ~1000×420 px, decodifica un póster w500 y anima la opacidad del póster y la leyenda de la tarjeta ancla. | **[código]** `cardExpansion.js:62` (`EXPANSION_DELAY_MS=180`), `useCardExpansion.js:40-50`, `cardExpansionSpace.js:16-30`, `motionLayers.js:4` (600 ms), `expandedCard.css:17`. Este coste **no aparece** en la traza actual porque las teclas iban cada ~250 ms. | Alto en uso real. Hay que medirlo con `--gap=350` frente a `--gap=120`. |
| 4 | **Las imágenes de fondo se piden en tamaño `original` y hay precargas que en TV nunca se muestran.** El banner usa `original` (a menudo 3840×2160, 33 MB decodificados), con 2 o 3 a la vez: la actual, la siguiente pintada por adelantado y la saliente. En cada reposo, `preloadPreviewArtwork` descarga y decodifica el fondo `original` de la tarjeta enfocada y de sus vecinas, pero en TV nunca se ve: el banner no sigue a la tarjeta y el panel de TV usa el póster. Esas decodificaciones compiten en el mismo pool que el raster y vacían la caché de decodificación. | **[código]** `artwork.js:4` y `metadata.js:43` (`original`); `App.jsx:158,174,329` (`warmArt`); `ExpandedCard.jsx:49` (TV: póster primero). **[medido]** 10 decodificaciones WebP completas de 11–14 ms en 0,68 s. | Medio-alto. Satura los workers y causa re-decodificaciones. |
| 5 | **Hay JavaScript por tecla y por reposo que se puede evitar.** El `keydown` cuesta 12–15 ms: 3 renders síncronos de Card, montar y desmontar `SelectedCardExpansion` y 14 listeners. Hay `TimerFire` de 17,7 y 20 ms, compatibles con el render de la tarjeta saliente a los 240 ms. En cada reposo hay entre 4 y 8 renders de App, y cada uno re-renderiza unos 9 `VirtualCarousel`, porque `metadata` y `resolvedMetadata` cambian de identidad en cada respuesta. | **[medido]** `EventDispatch keydown` de 14,7, 12,1 y 14,0 ms; `TimerFire` 267 y 271. **[código]** `App.jsx:111-118,150,258-259,307`; `cardSelectionStore.js:10`. | Medio: 20–40 ms de hilo principal por tecla en el TV. |

**Estimación conjunta.** Con las causas 1 y 2 resueltas, el raster por tecla bajaría de ~256 ms de CPU (768 ms / 3 teclas en la traza) a la rasterización inicial de cada tarjeta y la del borde que entra. Es razonable esperar un P95 tecla→2.º RAF de 60–80 ms; el experimento previo dio 67 ms sólo con la causa 1. La causa 3 elimina picos de 150–300 ms al ritmo humano, y la 4 libera los workers para el raster. Ninguna de las cinco quita funciones visibles.

---

## Hallazgos por área

### A. Raster y capas en el motor del TV

**A.1 Qué rasteriza la traza.** Ventana de 0,68 s con 3 teclas. Análisis propio de `artifacts/tv-trace-navigation.json`.

| Capa (id de cc) | Tiles | Ms de pared | Cuadros | Lectura |
|---|---|---|---|---|
| 650 | 21 | 245,6 | 8664, 8670, 8673 | Capa grande: contenido de la escena o del rail. 16 tiles en el cuadro 8670 (≈ fila visible) |
| 700 | 4 | 138,8 | 8664, 8665, 8667, 8668 | Tamaño de tarjeta, rasterizada en 4 cuadros |
| 709 | 5 | 135,2 | ídem | Tamaño de tarjeta, rasterizada en 4 cuadros |
| 704, 718 | 6 + 6 | 72,8 + 66,7 | 1 cuadro cada una | Tarjetas o celdas nuevas |
| Otras 10 | 1 cada una | 2–44 | 1 | Capas pequeñas |

- Un tile de tarjeta cuesta 20–42 ms y un tile de la capa 650 unos 14 ms. Es un rendimiento de CPU muy bajo (≈ 4,6 Mpx/s por hilo).
- El TV no puede permitirse más de 1–2 rasterizaciones de tarjeta por tecla.

**A.2 Mecanismo de las 6 rasterizaciones por tecla.** **[código + medido]**

- `.tv-mode .card.is-previewed .card-open` aplica `will-change:transform` y `scale(1.06)` (`compositorMotion.css:60`):
  - La tarjeta nueva **pasa a tener capa propia**, y eso es una rasterización.
  - Su hueco en la capa padre también se invalida.
- El halo `.card-open:after` anima su opacidad en 60 ms (`compositorMotion.css:7-8` y `:98`):
  - Una transición de opacidad compuesta saca el `:after` a una capa transitoria mientras dura.
  - Al terminar, lo devuelve a la capa de la tarjeta, que **se vuelve a rasterizar**.
  - Esto ocurre dos veces por tecla, una en la tarjeta que entra y otra en la que sale.
- Hay un posible ajuste de escala de raster al acabar la transición de `transform` de 1 a 1,06 **[hipótesis]**.
- `.is-leaving` mantiene `will-change` 240 ms (`compositorMotion.css:58`, `cardSelectionStore.js:10`). Al expirar, la tarjeta **pierde su capa** y se rasteriza otra vez dentro de la capa padre.
- Además, ese temporizador provoca un render React de la tarjeta, compatible con los `TimerFire` de 17,7 y 20 ms.

**A.3 Inventario de capas en Inicio (TV).** Estimación por código; J da el recuento exacto.

| Elemento | ¿Capa compuesta? | Por qué | Cuándo |
|---|---|---|---|
| Documento raíz (cabecera fija, banner fijo y fondo) | Sí | Raíz | Siempre. El banner (`.focus-stage`, `style.css:613`, `contain:paint` en `:712`) **no** es motivo de composición: se pinta en la raíz |
| `.page-scene` (fija, `overflow-y:auto`) | Sí, si el scroll está compuesto (2 capas) | Scroller | Siempre. **Transparente** (`compositorMotion.css:47`) |
| Cada rail `.cards.virtual-rail` (~9 en Inicio: 6 filas + Descubre) | Sí, si el scroll está compuesto | Scroller | Siempre. **Transparente** (`style.css:35`, `virtualCatalogue.css:12`) |
| `.card.is-previewed .card-open` | Sí | `will-change:transform` | En cada tecla |
| `.card.is-leaving .card-open` | Sí, 240 ms | `will-change` | En cada tecla |
| `.card-open:after` (halo) ×2 | Transitoria, 60 ms | Animación de opacidad | En cada tecla |
| `img` y velo `.richiflix-art` al revelarse | Transitoria, 180 ms | `transition:opacity .18s` (`style.css:806`) | Cada imagen que entra |
| Celdas vecinas al abrir el panel | Sí, 600 ms | `leaseTransformLayers` (`cardExpansionSpace.js:26`) | Cada apertura |
| Póster y leyenda de la tarjeta ancla | Transitoria, 120 ms | `transition:opacity .12s` (`expandedCard.css:17`) | Cada apertura y cierre |
| `.card-expansion` | Sí | Fijo, `animation: expansion-open` y opacidades de `backplate`/`:before` | Panel abierto |
| `.card-trailer-deck` e iframe de YouTube | Sí, si hay iframe | Fijo con iframe | Con tráiler o iframe reutilizado |
| Contenido pintado después de una capa con `will-change` en el mismo scroller | Sí | Solapamiento: CompositeAfterPaint parte el contenido en «antes» y «después» | Mientras haya una tarjeta promovida |

- Los `transform` 2D en reposo de `.card-open` y del `:after` (`compositorMotion.css:7` y `:56`, «D0») **no crean capas compuestas**. Sólo crean nodos de transformación: no evitan rasterizaciones.
- `layerize`: 11 llamadas, 65 ms en total, 15 ms como máximo. Coinciden con los cambios de estructura de capas de cada tecla.

**A.4 Propiedades caras para el raster por CPU en Inicio.**

| Propiedad | Dónde | Cuántas montadas | Comentario |
|---|---|---|---|
| `border-radius` + `overflow:hidden` sobre imagen | `.poster` (`style.css:35`; vertical 20 px, `:591`; directo 24 px, `:601`) y, dentro, `.quality-media{overflow:hidden;isolation:isolate}` (`:537`) | Una por tarjeta montada (24–40) | Recorte redondeado con antialias más un grupo de aislamiento, en cada rasterización de tarjeta |
| Borde redondeado del halo | `.card-open:after` 4 px, radio 15 (`compositorMotion.css:7`) | Una por tarjeta, pintado sólo con opacidad > 0 | Barato aislado, pero obliga a rasterizar por el mecanismo de A.2 |
| Gradientes | `.poster:after` (`style.css:35`/`:592`, uno por tarjeta); `.focus-stage-shade` 2× sobre 1920×553 (`:617`, `:648`, `compositorMotion.css:32`); `.rail-edge` (`:101`, uno por rail); `.mlb-color` radiales con `clip-path` (`:662-664`); `.expansion-media-shade` y `.expansion-body:before` | ~30–45 | Se repintan con cada tile invalidado |
| `filter` | `.mlb-mark>img{filter:drop-shadow(0 8px 16px)}` (`style.css:670`) | 2 por tarjeta MLB (fila «Ahora en vivo») | Desenfoque por CPU: lo más caro por tarjeta |
| `mask-image` | `.focus-stage .wide-illustration>img` radial (`:653`); `.mlb-wide` (`:678`) | Sólo en el banner de canal o MLB | Superficie de render más máscara |
| `text-shadow` | `.hero h1` 20 px (`style.css:35`; aplica al `h1` del banner porque `.focus-stage` tiene la clase `hero`); `.identity-title` (`:645`, sólo identidades de reserva). `.poster-title` está oculto en tarjetas verticales (`:592`) y sin sombra en directas (`:607`) | 1 grande más las de reserva | Sólo cuesta cuando gira el banner |
| `backdrop-filter`, `mix-blend-mode` | Anulados en TV (`style.css:713,730,788`) o inexistentes | 0 | Bien |
| `box-shadow` con desenfoque | `.rail-more-symbol` (`virtualCatalogue.css:20`), `.channel-identity .identity-glyph` (`style.css:605,643`), `.mlb-versus` (`:666`) | Pocas | Bajo |
| Transición de `color` | `.catalog-row h2` (`compositorMotion.css:84`) | 2 por cambio de fila | Repinta en cada cuadro de la transición (≈ 4 cuadros con 60 ms) |

**A.5 Qué dice la web sobre el raster en Tizen.**
- No hay documentación pública de Samsung sobre GPU o CPU, número de hilos de raster ni tamaño de tile.
- La guía de memoria de Samsung dice: «cada capa ocupa ancho × alto × 4 bytes» y recomienda evitar `will-change` y `translateZ(0)` por costumbre.
- En M85, el presupuesto por defecto de imágenes decodificadas es de 128 MB, o 256 MB con más de 4 GB de RAM. Samsung puede cambiarlo.
- La traza indica raster por CPU, como se explica en el resumen.

### B. Resolución real de render

- **[código]** `dist-tizen/index.html` fija `<meta name="viewport" content="width=1920, user-scalable=no">`.
- **[código]** `tizen/config.xml` declara `http://tizen.org/feature/screen.size.normal.1080.1920`. Es un filtro de tienda, no cambia el render.
- **[web]** Samsung documenta «Application Resolution: 1920x1080 (All models)». El vídeo sí puede ir a 4K u 8K. Los reportes de desarrolladores dan `devicePixelRatio` 1 en TV 4K, y no hay ninguna opción documentada de interfaz 4K. La única metadata de resolución, `base_screen_resolution=extensive`, es para paneles ultrapanorámicos (2560×1080).
- **[código]** `responsiveArtwork.js` multiplica por DPR:
  - Con DPR 1, una tarjeta de 210 px (`style.css:625`) pide 210 × 1,08 = 227 px, es decir, **w342**.
  - Con DPR 2 pediría 454 px, es decir, w500: 2,1 veces más píxeles.
  - `imageObserver.js` reacciona a cambios de DPR.
- **Conclusión:** casi seguro el raster es a 1080p y **no hay multiplicador ×4**. Confianza media-alta. J lee `devicePixelRatio`, `screen.*` y el tamaño natural de cada `<img>` para cerrarlo.

### C. Imágenes

**C.1 Qué se pide.**
- **Pósters de tarjeta:** w342 (342×513 = 175 kpx, 0,70 MB decodificado).
  - **[medido]** WebP en el TV: 11,2–13,9 ms por decodificación completa, unos 68 ns/px.
  - TMDB ya sirve WebP por negociación `Accept` sobre las URL `.jpg`. El agente lo verificó con curl: 26,5 KB en WebP frente a 37,9 KB en JPEG. La extensión `.webp` devuelve 404.
  - **No hay nada que ganar cambiando de formato.** WebP se decodifica más lento que JPEG en ARM, pero pesa un 30 % menos. No vale la pena forzar JPEG sin medirlo.
- **Panel ampliado (TV):** usa el póster (`ExpandedCard.jsx:49`) con `sizeHint` 0,46 (`:63`). La media ocupa el 46 % de 1000 px (`compositorMotion.css:33` gana sobre el 32 % de `expandedCard.css:13`): 459 × 1,08 = 496 px, es decir, **w500** (1,5 MB, ~26 ms estimados).
- **Fondo del banner:** `artworkURL(..., true)` reescribe a **`original`** (`artwork.js:4`; también `metadata.js:43`). `responsivePosterArtwork` sólo adapta rutas `/w\d+/` (`responsiveArtwork.js:6`), así que **los fondos nunca se adaptan**.
  - En TMDB, `original` es 1920×1080 (8,3 MB decodificado, ~140 ms) o, con frecuencia, 3840×2160 (33 MB, ~570 ms estimados a 68 ns/px).
  - El carrusel retiene la diapositiva actual, la siguiente pintada por adelantado y la saliente durante el fundido (`FocusStage.jsx:23-30`).
- **Precarga de fondos en el reposo** (`previewArtwork.js:11-17`, llamada desde `App.jsx:158`):
  - Se lanza en el commit de la tarjeta (`App.jsx:174`) y para 2 vecinas a los 240 ms (`App.jsx:329`), siempre con `warmArt=true`.
  - Llama a `image.decode()` sobre `original`.
  - El presupuesto (2 imágenes / 20 MB) se comprueba **después de descargar**: un 4K se descarta tras bajarlo.
  - **En TV estas imágenes no se muestran nunca.** El banner es un carrusel (Fase C2) y el panel usa el póster.
- **Precarga de pósters** (`artworkPrefetch.js`): `new Image()` sin pintar, sólo descarga. Está bien.

**C.2 Caché IndexedDB con blobs.**
- `artworkCacheClient.js:12-17` cuenta referencias: al desmontar una tarjeta revoca la URL `blob:`, y al volver a montarla crea otra.
- Una URL nueva es un recurso nuevo: **otra decodificación completa** de 12 ms por póster cada vez que una celda virtual vuelve a la ventana.
- Encima, un póster ya mostrado desde la red (decodificado y en la caché de memoria por URL http) pasa a servirse como `blob:` en el siguiente montaje, y se decodifica de nuevo.

**C.3 Recuento en Inicio.**
- Rails cercanos: 2–3, con 11 celdas en reposo o 14 a mitad de rail (3 + 8 + 3, `virtualWindow.js:10-15`). Son 24–40 pósters (17–28 MB).
- Banner: 2–3 `original` (17–100 MB).
- Panel: 1 w500 (1,5 MB).
- Precargas de fondo: hasta 2 `original` (hasta 20 MB retenidos, más los descartados).
- **Total: entre 55 y más de 150 MB decodificados** en el peor caso.

**C.4 Presupuesto propuesto: ≤ 45 MB decodificados por pantalla en TV.**

| Concepto | Cantidad | Tamaño | MB |
|---|---|---|---|
| Pósters | ≤ 40 | w342 | 28 |
| Banner (actual + siguiente) | 2 | w1280 (1280×720) | 7,4 |
| Panel | 1 | w500 | 1,5 |
| Precarga de fondos en TV | 0 | — | 0 |
| **Total** | | | **≈ 37** |

`decoding="async"` y `img.decode()` ya se usan (`QualityImage.jsx:54,65`) y no hay nada que corregir ahí.

### D. JavaScript por tecla

**D.1 Camino de una tecla Derecha dentro de un rail.** **[código]**

1. `platform.js:45-71` (Tizen) normaliza `keyCode` y vuelve a despachar un `KeyboardEvent` (1 `querySelector('[role="dialog"]')`).
2. `useRemoteNavigation.js:29-66`: `querySelector('.tv-mode')` y `[role=dialog]`, luego `virtualController(group)`. `announce()` (`:9`) despacha `richiflix-catalog-navigation`, que escuchan:
   - `QualityImage.jsx:10`;
   - `useBannerMotion.js` (`move()`; en la 1.ª tecla de la ráfaga hace `setState`, con su render de App);
   - el `useCardExpansion` de la tarjeta anterior (`hide()` → `setPlacement(null)`).
3. `VirtualCarousel.jsx:72-83` `focusIndex`:
   - lee `scrollLeft` (`:76`);
   - hace `scrollTo` si la tarjeta toca el borde (`:78`);
   - llama a `revealRailCard` sólo al cambiar de fila (`:79-80`);
   - hace `focus({preventScroll:true})`.
4. Eventos de foco:
   - `Card onFocus` → `preview` → `App.preview` (`App.jsx:176-180`):
     - `setSelectedCard` notifica a **3 tarjetas**: la nueva, la anterior (que pasa a `leaving`) y la que dejaba de estar `leaving`. Las tres se re-renderizan de forma síncrona en el evento discreto.
     - `setPreviewActive(false)` re-renderiza App sólo si venía de `true`, es decir, la 1.ª tecla tras un reposo.
     - `banner.select(commitPreview)`.
   - `onFocusCapture` de App (`App.jsx:333`): `setCardFocus(true)`, normalmente sin cambio.
   - Listeners de `focusin`: `remember` (atributo de región), `VirtualCarousel` (`:69`), `watchRows` (`:17`).
5. La tarjeta nueva monta `SelectedCardExpansion` y la anterior lo desmonta.
   - `useCardExpansion.js:58-59` añade y quita **7 listeners** de `window`/`document` en cada caso, es decir, 14 operaciones por tecla, y arma un temporizador de 180 ms.
6. A los +240 ms, el temporizador de `cardSelectionStore.js:10` causa **1 render de Card**, compatible con `TimerFire` de 17,7 y 20 ms.
7. A los +180 ms sin otra tecla, `show()` se ejecuta:
   - 5 `getBoundingClientRect`, más `scrollLeft` y `clientWidth`;
   - `reserveCardExpansion`: más lecturas, `scrollTo`, estilos y 7 `will-change` prestados;
   - `setPlacement` monta el portal: `QualityImage` w500, `UserScore`, `AgeBadge`, tráiler (`ExpandedCard.jsx`).
8. A los +480 ms (reposo del banner):
   - `commitPreview` → `setPreviewItem`, `setPreviewActive(true)`, `preparePreview` → `setPreviewPendingId`: 1–2 renders de App.
   - Cuando llegan los metadatos, `publishPreview` → `setFeatureDetails` → `cardMetadata` → `guidedMetadata` (objetos nuevos) → **todos los `VirtualCarousel` se re-renderizan** (unos 9 en Inicio), porque `metadata={guidedMetadata}` y `resolvedMetadata` (`App.jsx:150`) cambian.
   - A los +240 ms, las vecinas (`App.jsx:325-331`) y `proactive` (2 en paralelo, cada 180 ms, `proactivePreviews.js`) disparan más `publishPreview`: **4–8 renders de App en cada reposo**, cada uno con unos 9 carruseles y sus `.map` de 11–14 celdas.

**D.2 Props inestables concretas.**

| Componente | Prop | Por qué cambia | Efecto |
|---|---|---|---|
| `VirtualCarousel`, `VirtualCatalogue`, `LiveHub` | `metadata={guidedMetadata}` | Objeto nuevo con cada `featureDetails`, `selections`, `cachedScores` o `guide` (`App.jsx:81,307`) | Re-renderiza todos los rails en cada respuesta de metadatos |
| ídem | `resolvedMetadata` | `new Set(Object.keys(featureDetails))` en cada respuesta (`App.jsx:150`) | ídem |
| `FocusStage` (memo) | `moving`, `active`, `loading` | Cambian al empezar y al acabar la ráfaga | 2 renders por ráfaga (aceptable) |
| `DecodedImage` (no memo) | `fallback={<ContentIdentity…/>}` (elemento nuevo en cada render, `interactions.jsx:36`) y `priority={selected}` | Cada render de Card | Re-renderiza la imagen al seleccionar o deseleccionar, con 2 `new URL()` y una regex en `responsivePosterArtwork` |
| `Card` | `metadata?.[item.id]` | Estable si el id no cambió | Correcto: el memo de Card aguanta |

- `index.filter(items,'')` devuelve el mismo array (`catalogueIndex.js`, rama `!query&&category==='Todas'`), así que `items` es estable.
- `previewProps` se reparte con spread y sus funciones son estables (`useStableEvent`).
- `JSON.stringify(stageScope)` es trivial.

### E. Layout

- **[medido]** 13 `UpdateLayoutTree` suman 42 ms en 0,68 s, con un máximo de 5,4 ms. El layout es secundario frente al raster.
- Lecturas forzadas por tecla o apertura:
  - `VirtualCarousel.jsx:76` (`scrollLeft`).
  - `virtualViewport.js:38-43` (2 `getBoundingClientRect` al cambiar de fila).
  - `useCardExpansion.js:13,40-46` (4–5 rects).
  - `cardExpansionSpace.js:17-21`: `scrollTo` seguido de `scrollLeft`, layout forzado tras escribir.
  - `cardExpansionSpace.js:40`: `getComputedStyle(...).transform` en `cleanup`, estilo forzado.
  - `QualityImage.jsx:38`: un `getBoundingClientRect` por cada imagen que termina de decodificar, es decir, N layouts forzados al entrar celdas. El `ResizeObserver` ya tiene `contentRect`, así que se puede usar.
- **Scroll compuesto:**
  - En M85 y versiones posteriores, `ComputePreferCompositingToLCDText` sólo es verdadero con DPR ≥ 1,5, en Android/ChromeOS, con un flag, o cuando el texto LCD está desactivado.
  - Si es falso, un scroller **no opaco** con texto cae a scroll de hilo principal (`kNotOpaqueForTextAndLCDText` y razones afines) y repinta.
  - Un scroller con `background-color` opaco pintado en el contenido se compone «independientemente de la preferencia LCD» (crrev a0f3f2e).
  - `.page-scene` y los rails no tienen fondo propio.
  - Lo que también impediría la composición: `border-radius` en el scroller (no hay), `backdrop-filter` encima (anulado en TV) y `position:sticky` dentro (no hay).
  - Hay que verificarlo con J (`scrollRects` y `Overlay.setShowScrollBottleneckRects`).
- `scroll-padding` no interviene: todo usa `preventScroll` y alineación propia.

### F. Fuentes y texto

- **[código]** `dist-tizen/fonts`: Bricolage variable (77 KB latin + 31 KB latin-ext) y Manrope variable (25 + 15 KB). Total 147 KB, con `font-display:swap` y `unicode-range`.
- El coste es de arranque, más un reflow al cargar. Los glifos se cachean y no influyen por tecla.
- Sombras de texto en Inicio (TV):
  - el `h1` del banner, con desenfoque de 20 px (`style.css:35`, regla `.hero h1`);
  - las identidades de reserva (`.identity-title`, `:645`);
  - **ninguna** en las tarjetas con póster.
- El `letter-spacing` negativo y `-webkit-line-clamp:2` en `.card-title` (`virtualCatalogue.css:46`) sólo cuestan al montar celdas.
- Prioridad baja.

### G. Bundle y arranque

| Archivo | Bytes | gzip -9 |
|---|---|---|
| `assets/richiflix.js` (IIFE único) | 518 844 | 170 670 |
| `assets/style-*.css` (≈ 1911 reglas) | 148 318 | 28 830 |
| `catalogueWorker` | 45 059 | 17 181 |
| `artworkCacheWorker` | 6 092 | 2 716 |

- React está en producción: no hay textos de advertencia ni `react-dom.development`.
- `hls.js` está excluido (alias a `tizenHls.js`).
- `lucide-react` se reduce por tree-shaking: se importan 43 iconos y en el bundle hay unas 31 definiciones.
- `installFocusPaintDiagnostics` sólo se activa con `?diagnostics=1` o con la variable de entorno. En producción no hace nada, aunque se llama dos veces (`main.jsx:45`, `useRemoteNavigation.js:105`).
- `wicg-inert` (`main.jsx:16`) está en el bundle. En motores con `inert` nativo (≥ 102, como este TV) no instala nada.
  - En un TV de 2022 (M85) sí instalaría un `MutationObserver` sobre todo `body` con `subtree`, `attributes` y `childList`, sin `attributeFilter` (`node_modules/wicg-inert/src/inert.js:598`). Recibiría cada cambio de clase y de estilo de la app y haría un `querySelectorAll('[inert]')` por nodo añadido.
  - Sólo se usa en `Dialog.jsx:16-20`.
  - Recomendación: cargarlo de forma condicional; impacto bajo en el TV actual.

### H. Memoria y GC

- La tarea de 192 ms **no es GC**: tiene 2,1 ms de CPU. No hay eventos de GC en la traza, porque no se registró `disabled-by-default-v8.gc`; J lo añade.
- Asignaciones por tecla:
  - 14 operaciones de listeners (D.1-5);
  - 3–4 renders de Card;
  - `new URL()` ×2 por cada render de `DecodedImage`;
  - temporizadores de 180 ms y 240 ms.
  - Son pequeñas. La memoria que pesa es la **decodificada** (C.3), no el heap de JS: 15–17 MB estables en PC (PLAN-MOVIMIENTO 5.1).
- Observadores:
  - 2 `IntersectionObserver` por rail (~18): 44 `computeIntersections` que suman 3,3 ms. Bajo.
  - Un `ResizeObserver` compartido para todas las imágenes.
  - En el TV no hay `MutationObserver` de `inert`.
- **YouTube en el mismo hilo:** **[medido]**
  - La traza muestra `base.js` del embed y `m=root,base` con `TimerFire` (id 17) cada ~30–50 ms.
  - El motor es de proceso único (`Chrome_InProcRendererThread`), así que el iframe comparte el hilo principal.
  - `TrailerPreview` reutiliza el reproductor y no lo destruye mientras está inactivo (`TrailerPreview.jsx`).
  - Impacto bajo-medio.

### I. Específico de Tizen

- **Samsung, mejora de rendimiento:**
  - «Change CSS classes instead of changing HTML element styles».
  - Usar `transform` (GPU) en vez de `top`/`left`.
  - Carga diferida de imágenes fuera de pantalla.
  - En «Launch Time Optimization»: `translateZ(0)`, `backface-visibility: hidden` y `perspective` contra el parpadeo.
- **Samsung, memoria:**
  - «Each layer takes width × height × 4 bytes».
  - «A single 1920×1080 image ≈ 8.3 MB of decode memory».
  - «Load images at the size you display».
  - Virtualizar listas de más de 100 elementos.
  - No poner `will-change` en todas partes.
- **Tasa de cuadros:** no hay ningún límite de 30 fps documentado para web apps. El rAF va a «~60 fps» según la documentación de Tizen. Los 166,7 ms de P95 de cuadro medidos son de bloqueo, no de vsync.
- **`config.xml`:** no tiene opciones de rendimiento. `background-support="disable"` y `hwkey-event="enable"` son correctos. `screen.size.normal.1080.1920` es un filtro de tienda. Sólo hay un fallo conocido con canvas acelerado (`accelerated-2d-canvas`), y la app no usa canvas.
- **Versiones de funciones** (MDN):

  | Función | Desde |
  |---|---|
  | `content-visibility` | 85 |
  | `contain-intrinsic-size` | 83 |
  | `aspect-ratio` | 88 |
  | `inert` | 102 |
  | `:has()` | 105 |

  Todas están disponibles en el TV (≥ M94).

### J. Medición propuesta

**Script listo, sin ejecutar:** `C:\Users\richa\AppData\Local\Temp\claude\C--Users-richa-Documents-ChatGPT-Richiflix\b56e053c-2f0a-473f-9bca-08b4952332fe\scratchpad\perf-audit\tv-measure.mjs`.

- Importa `scripts/tv-cdp.mjs` del proyecto por ruta absoluta.
- Necesita Node ≥ 22 y el inspector en `127.0.0.1:9227`.
- Pasó `node --check`, y su resumidor se probó sin conexión sobre la traza antigua, con resultados idénticos a los de este informe.

| Paso | Qué mide | Confirma o descarta |
|---|---|---|
| Entorno | `navigator.userAgent`, `devicePixelRatio`, `screen.*`, `inner*`, `visualViewport`, `hardwareConcurrency`, `inert` nativo, soporte de `content-visibility`/`aspect-ratio`/`:has`, nodos DOM, tarjetas, imágenes con tamaño natural frente a caja y origen, recursos TMDB por tamaño (w342, original…) con bytes, scrollers con su `background` | B (DPR); motor ≥ M94; C (backdrops `original`, píxeles decodificados) |
| `SystemInfo.getInfo` y `Browser.getVersion` | `gpu.featureStatus` (rasterization, gpu_compositing) | Raster por CPU o GPU |
| `LayerTree` antes y después de 20 teclas | Recuento de capas, MB estimados (ancho×alto×4), `compositingReasons`, nodo DOM, **`paintCount` por capa** (repintados durante las teclas) y `scrollRects: RepaintsOnScroll` | A.2 (qué capas repintan en cada tecla); E (scrollers no compuestos) |
| `Performance.getMetrics` antes y después | `Nodes`, `LayoutCount`, `RecalcStyleCount`, `JSHeapUsedSize`, duraciones | Coste de estilo y layout por tecla |
| Traza de 15 s con 20 teclas (10 Derecha, Abajo, 4 Derecha, Abajo, 4 Derecha) cada 350 ms | Categorías `devtools.timeline`, `disabled-by-default-devtools.timeline(.frame, .invalidationTracking)`, `blink`, `cc`, `gpu`, `viz`, `v8`, `disabled-by-default-v8.gc` y `toplevel`. Guarda `artifacts/tv-trace-2026-10-07.json` y un resumen con raster por capa, decodificaciones por tipo, `ImageUploadTask`, tareas bloqueadas (pared frente a CPU), GC y top de invalidaciones con su motivo | Todas las causas; atribuye los tiles grandes (¿scroll del rail?) |
| `--ab` | Las mismas 12 teclas con CSS inyectado en caliente: `baseline`, `permanentLayers`, `opaqueScrollers`, `noRoundClip` (sólo diagnóstico), `noHaloTransition` y `combined`. Para cada variante: P50/P95, raster en ms y tiles, decodificación, `layerize` y tarea bloqueada máxima | Cuantifica las causas 1 y 2 en el TV antes de tocar código |
| `--overlay` | Captura con bordes de capa, regiones de scroll en hilo principal y rectángulos de pintura | Recuento visual |
| `--gap=120` frente a 350 | Teclas antes o después de los 180 ms del panel | Causa 3 |

- Uso: `node tv-measure.mjs [--ab] [--overlay] [--gap=350]`.
- El resumen se guarda en `artifacts/tv-measure-2026-10-07.json`.
- Con `--gap` por encima de ~600 ms, la evaluación de 20 teclas supera el límite de 15 s de `connectTV`. En ese caso hay que bajar el número de teclas.
- Para comprobarlo a mano en el inspector: Rendering → *Paint flashing*, *Layer borders* y *Scrolling performance issues*, y el panel *Layers* (memoria por capa).

---

## Lista priorizada de cambios

Ninguno elimina funciones visibles.

| # | Qué | Dónde / cómo | Cómo medir la mejora | Riesgo para la UI |
|---|---|---|---|---|
| 1 | **Capas permanentes en las tarjetas montadas y halo sólo compuesto** (causa 1) | (a) `compositorMotion.css:56-61`: `.tv-mode .virtual-rail-cell .card-open,.tv-mode .virtual-grid-cell .card-open{will-change:transform}` siempre; el foco sólo cambia `transform` (ya está) y se borra la regla `.is-leaving` (`:58`). (b) Halo: `.tv-mode .virtual-rail-cell .card-open:after,.tv-mode .virtual-grid-cell .card-open:after{will-change:opacity}`. Alternativa con menos memoria: un único halo por rail (`.virtual-rail-track > .rail-halo`, `will-change:transform,opacity`) movido con `translate3d(index·stride, −6px, 0) scale(1,06)` desde el `focusin` de `VirtualCarousel.jsx:69`, sin React. (c) `cardSelectionStore.js:7-12`: quitar el estado `leaving` (`leaveMs`) y `useCardLeaving` en `interactions.jsx:24`, lo que elimina un render de Card por tecla. (d) Memoria: ≤ 40 celdas × ~0,26 MB por capa de tarjeta (+0,26 MB si el halo es por tarjeta) ≈ 10–21 MB. Es menos que un solo fondo 4K decodificado (33 MB). | `--ab permanentLayers`: raster por tecla < 60 ms de CPU, `paintDelta` de las capas de tarjeta ≈ 0 por tecla, P95 ≤ 80 ms (referencia previa: 67,2 ms) | Ninguno visual. Si Chromium no vuelve a rasterizar a escala 1,06, el póster ampliado puede verse un 6 % más suave: hay que revisarlo en el TV. Si sí lo hace, será una vez por tarjeta y luego queda retenida. Si `layerize` crece de forma notable, usar el halo único por rail. |
| 2 | **Scroll compuesto en rails y escena** (causa 2) | (a) `background-color:#101827` (el mismo color que `:root`, `style.css`) en `.app.tv-mode .page-scene` (`compositorMotion.css:47`) y en `.tv-mode .cards.virtual-rail` (`virtualCatalogue.css:12`). (b) Si J sigue mostrando `RepaintsOnScroll`, mover el rail con `transform: translate3d(−offset,0,0)` en `.virtual-rail-track` (`will-change:transform`) en lugar de `scrollLeft`, en `VirtualCarousel.jsx:33,76-78` (la ventana ya usa un `offset` propio). Para la vertical, hacer lo mismo en el contenedor de filas, sustituyendo `scrollTo` en `virtualViewport.js:15`. | `scrollRects` = 0; `--ab opaqueScrollers` sin tiles de fila completa (los 16 tiles / 230 ms del cuadro 8670 desaparecen); rasterización en Abajo ≈ la franja nueva | Nulo con (a): mismo color. Con (b) hay que reescribir el scroll del rail; el foco, el panel y `reserveCardExpansion` leen `scrollLeft` (`cardExpansionSpace.js:17,21`) y habría que adaptarlos. |
| 3 | **Panel ampliado barato** (causa 3) | (a) Con #1 aplicado, las celdas ya son capas: en TV hay que quitar `leaseTransformLayers(animated)` y `leaseTransformLayers(all…)` (`cardExpansionSpace.js:26,33`) y el `getComputedStyle` de `:40`, de modo que el desplazamiento de las vecinas sea gratis. (b) Hacer permanente la capa de `.virtual-rail-cell` en TV (`will-change:transform`, junto con #1), para que `--expansion-shift` y `.is-covered` sean sólo de compositor. (c) Póster y leyenda de la ancla (`expandedCard.css:17`): en TV, ocultarlos sin transición (el panel los tapa al instante) o con `will-change:opacity` dentro de la capa de la tarjeta. (d) Opcional, como perilla de calibración: `EXPANSION_DELAY_MS` (`cardExpansion.js:62`) en 300 ms sólo en `.samsung-tv`, si tras (a)–(c) sigue habiendo picos. | Diferencia de raster entre `--gap=350` y `--gap=120` < 30 %; ninguna capa transitoria de celdas en `LayerTree` | (a)–(b) nulo. (c) el póster deja de fundirse 120 ms bajo un panel opaco: imperceptible. (d) el panel tarda algo más en aparecer, por eso es sólo una perilla. |
| 4 | **Imágenes según su tamaño en pantalla y sin precargas inútiles** (causa 4) | (a) `artwork.js:4`: con `isTVBuild`, usar **`w1280`** en lugar de `original` para los fondos (el banner mide 1920 × 553 y su 66 % izquierdo está bajo `.focus-stage-shade`). (b) `App.jsx:158`: `warmArt&&!tv`. En TV el fondo de la tarjeta nunca se muestra (banner C2; panel con póster, `ExpandedCard.jsx:49`); las diapositivas siguen precargándose con `BannerArtwork`. (c) Reutilizar URLs `blob:`: en `artworkCacheClient.js:12`, retrasar `revokeObjectURL` con un LRU de unas 64 entradas, o en `useCachedArtwork.js` usar la URL http si `shownArtwork.has(source)` (`artworkPrefetch.js:105`), porque ya está en caché de memoria. (d) Presupuesto ≤ 45 MB (C.4). | `environment.images` del banner = 1280×720; `tmdbResources` sin `original` en TV; decodificación en la traza < 60 ms por tecla; sin decodificaciones repetidas del mismo póster al volver en el rail | (a) el fondo es ~1,5× más suave en el 34 % derecho visible: comprobar a distancia de sofá; si no convence, `original` sólo para la diapositiva actual. (b)–(d) nulo. |
| 5 | **Menos React por tecla y por reposo** (causa 5) | (a) #1c elimina el render de la tarjeta saliente. (b) `QualityImage.jsx`: `DecodedImage` con `memo`; en `interactions.jsx:36`, crear el `fallback` con `useMemo([item.id])` y quitar `priority={selected}` (`fetchPriority` sólo importa antes de cargar). (c) Metadatos por id: un almacén con `subscribe(id)` como `cardSelectionStore`, al que `publishPreview` (`App.jsx:111`) escribe y del que `Card` lee por `item.id`. `VirtualCarousel`, `VirtualCatalogue` y `LiveHub` dejan de recibir `metadata` y `resolvedMetadata` (`App.jsx:258-259,355`), y las respuestas sólo re-renderizan la tarjeta afectada. (d) Agrupar `setFeatureDetails` en una actualización por tarea (acumular en un `ref` y vaciarlo con `setTimeout(0)`). (e) `useCardExpansion.js:58-59`: un único juego global de listeners que delega en el controlador seleccionado, en lugar de 7 + 7 por tecla. | `keydown` < 6 ms en la traza; sin `TimerFire` de unos 18 ms a los 240 ms; `cardRenders` (`?diagnostics=1`) ≤ 2 por tecla; reposo ≤ 2 renders de App | Nulo. |
| 6 | **Revelado de imágenes sin capa transitoria** | `style.css:806` (`.18s`): en TV, aplicar el fundido sólo cuando se mostró el velo de identidad (carga lenta) y revelar sin transición las imágenes que llegan en < 120 ms (caché). Alternativa: hacer el fundido dentro de la capa permanente de #1 con `will-change:opacity` en la `img`, a cambio de memoria. | `LayerTree` sin capas de `img` transitorias al entrar celdas | Mínimo: el fundido se conserva donde se ve. |
| 7 | **Color del título de fila** | `compositorMotion.css:84`: quitar `transition:color` en `.samsung-tv` (con 60 ms son ~4 repintados) o cruzar dos capas de texto por opacidad. | Sin repintados del `h2` en `paintCount` al cambiar de fila | Mínimo. |
| 8 | **Iframe de YouTube** | `TrailerPreview.jsx`: destruir el reproductor tras unos 10 s inactivo o mientras el foco recorre tarjetas sin tráiler. | Sin `TimerFire` de `base.js` en la traza durante la navegación | Nulo: el primer tráiler tarda algo más. |
| 9 | **MLB: sombra de escudos** | `style.css:670`: cambiar `filter: drop-shadow` por una sombra integrada en el PNG o un pseudo-elemento elíptico sin desenfoque. | Raster de tarjeta MLB comparable al de una tarjeta normal | Mínimo. |
| 10 | **Banner: sombra de 20 px en el título** | `.tv-stage h1{text-shadow:none}` (la sombra lateral ya da el contraste). | Raster del banner al girar | Mínimo. |
| 11 | **`wicg-inert` condicional** | `main.jsx:16`: importar sólo si `!('inert' in HTMLElement.prototype)`, de forma dinámica o con un pequeño cargador. | — | Nulo. Sólo protege a los TV de 2022. |
| 12 | **Lecturas de layout por imagen** | `QualityImage.jsx:38`: usar el `contentRect` del `ResizeObserver` (ya se recibe) en lugar de `getBoundingClientRect()` tras cada decodificación. | Menos `Layout` forzados al entrar celdas | Nulo. |

**Orden de ataque recomendado:**

1. Ejecutar `tv-measure.mjs --ab --overlay` para confirmar las causas 1 y 2 con cifras del TV.
2. Aplicar #1 y #2(a) (sólo CSS, dos líneas cada uno).
3. Aplicar #4(a)(b) (dos líneas).
4. Aplicar #3(a)–(c).
5. Aplicar #5.
6. Volver a medir.

#2(b) queda sólo si la medición muestra que el fondo opaco no basta.

**Descartado a propósito:** `translateZ(0)` o `will-change` globales (Samsung lo desaconseja: cada capa ocupa ancho × alto × 4); forzar JPEG en lugar de WebP (sin datos que lo apoyen); `content-visibility` en filas (ya están virtualizadas y las lejanas montan 0 celdas).

---

## Fuentes consultadas

**Samsung**
- Especificaciones de motor web por año: https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html
- Especificaciones generales (resolución de app 1920×1080): https://developer.samsung.com/smarttv/develop/overview.html
- Gestión de resolución: https://developer.samsung.com/tv/develop/guides/fundamentals/managing-screen-resolution/
- Resolución base extensiva: https://developer.samsung.com/smarttv/develop/guides/base_screen_resolution.html
- Mejora de rendimiento: https://developer.samsung.com/smarttv/develop/guides/application-performance-improvement.html
- Optimización del arranque: https://developer.samsung.com/smarttv/develop/guides/application-performance-improvement/launch-time-optimization.html
- Optimización de memoria: https://developer.samsung.com/smarttv/develop/guides/web-app-memory-optimization-guide.html

**Tizen**
- Control de temporización (rAF): https://docs.tizen.org/application/web/guides/w3c/perf-opt/timing-control

**Chromium (fuente M85)**
- `render_widget.cc`: `ComputePreferCompositingToLCDText` y presupuesto de decodificación: https://chromium.googlesource.com/chromium/src/+/refs/tags/85.0.4183.1/content/renderer/render_widget.cc
- `layer_tree_settings.h`: https://chromium.googlesource.com/chromium/src/+/refs/tags/85.0.4183.1/cc/trees/layer_tree_settings.h
- `paint_layer_scrollable_area.cc`: razones de scroll en hilo principal: https://chromium.googlesource.com/chromium/src/+/refs/tags/85.0.4183.1/third_party/blink/renderer/core/paint/paint_layer_scrollable_area.cc
- Scroller opaco compuesto sin depender de LCD: https://crrev.com/a0f3f2e7a62356e4c1a44b769e46be984366ecad y https://codereview.chromium.org/2758733003
- Umbral de DPR inclusivo: https://codereview.chromium.org/1293083003
- Raster por software o GPU (Intel): https://www.intel.com/content/www/us/en/developer/articles/technical/software-vs-gpu-rasterization-in-chromium.html

**Otras**
- Datos de compatibilidad MDN (`content-visibility`, `aspect-ratio`, `inert`, `:has`): https://github.com/mdn/browser-compat-data
- Notas sobre Tizen (DPR 1 en 4K, animaciones con canvas): https://samsungtizenos.com/knowledge-hub/display-4k-images-tizen-web-app-9148 y https://samsungtizenos.com/knowledge-hub/css-animations-freeze-tizen-tv-6931
- Consejos para TV de gama baja: https://www.oxagile.com/article/samsung-tizen-tv-apps-for-all-tips-for-low-end-tvs/
- Firefox, caché de decodificación por blob: https://bugzilla.mozilla.org/show_bug.cgi?id=1154974
- TMDB y WebP: comprobado con curl sobre `image.tmdb.org/t/p/w342/…jpg` con y sin `Accept: image/webp`. Respuesta `image/webp`, 26 482 bytes frente a 37 889 de JPEG; `.webp` devuelve 404; no envía cabecera `Vary`.

**Limitaciones de este informe**
- La traza disponible cubre sólo 0,68 s y 3 teclas a ~250 ms (el resumen anterior hablaba de 14 movimientos).
- No incluye el panel ampliado, ni el scroll vertical, ni GC.
- Las cifras por tecla de las causas 2, 3 y 4 son estimaciones a partir del código y de los costes unitarios medidos (12 ms por póster w342, 20–42 ms por tile de tarjeta, ~14 ms por tile de fila). J está diseñado para cerrarlas.
