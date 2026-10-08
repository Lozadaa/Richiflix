# Informe · Bloque A (foco fijo tipo Netflix)

Rama `kingdom-A-foco-fijo`, 7 oct 2026. Base `6b5ab09`. Commits:

| Commit | Tarea |
|---|---|
| `f867f34` | A1 columna fija en `anchoredRailOffset` |
| `ed9abbd` | A2 fila hasta el borde de pantalla, degradados y halo fijo |
| `06e4ade` | A3 panel ampliado desde la columna, siempre hacia la derecha |
| `4708269` | A2 (corrección de la revisión final) halo bajo el puntero en la tarjeta donde se dibuja |

## Qué hice por tarea

**A1.** `anchoredRailOffset` ahora devuelve `index*stride` (sin `−gap−40`), acotado al recorrido real. `railTailSpace = vista − relleno − ancho`, así el máximo es exactamente `(count−1)*stride` y la última tarjeta (y la de una fila corta) llega a la columna. Las vueltas circulares, los índices inválidos y `count:1` devuelven 0. Retiré `RAIL_PEEK` y su uso. TDD: la prueba del plan falló con `170 ≠ 240` y después pasó.

**A2.**
- `haloPlacement` en filas devuelve `{x: paddingLeft, y: paddingTop}`. TDD: falló con `{x:0}` y después pasó.
- En `VirtualCarousel.jsx`, el halo (`.rail-halo`) sale de la pista que se desliza y pasa a `.virtual-rail-wrap`. Su origen se mide una vez por layout (`offsetLeft+paddingLeft`, `offsetTop+paddingTop`) y no se mueve por tecla: la deduplicación existente (`haloAt`) hace que sólo cambie de opacidad.
- Las reglas `:has()` de opacidad apuntan ahora al wrap.
- CSS en `compositorMotion.css`:
  - `.tv-mode .virtual-rail-wrap{margin:0 calc(-4.5% / .91)}`.
  - El rail queda con `padding-left:4.5%`, sin márgenes laterales.
  - Degradados `::before` (4,5 %) y `::after` (120 px) de `#101827` a transparente, `z-index:3`; el halo va en `z-index:4`.
  - En filas lejanas los degradados quedan con `visibility:hidden`.

**A3.** `expansionAlignFor({…, tv:true})` devuelve siempre `'start'`: la regla F2 queda sólo para PC. En `useCardExpansion` el TV ya no la llamaba (`rail&&!tv`, desde la Ola 4). Se mantiene así para no leer `scrollLeft`, y actualicé el comentario. Actualicé el párrafo de TV en `docs/TARJETA-AMPLIADA.md` y en el de F2 dice ahora «carruseles de PC». TDD: la prueba de «pasada la mitad» con `tv` falló (`'end'`) y después pasó.

**Revisión final** (revisor independiente con contexto limpio):
- Sin hallazgos críticos.
- **Importante 1, corregido.** Con el puntero del Samsung, el halo marcaba la columna aunque la tarjeta señalada estuviera en otra posición. `haloPlacement` acepta ahora `offset`, por defecto el anclado; el `pointerover` pasa el desplazamiento real. Prueba nueva: falló con `{x:86}` en vez de `{x:1046}` y después pasó.
- **Importante 2, medido.** Ver «Desviaciones».

## Verificación

- `npm test`: 292/292. La base daba **292**, no 290 como decía el encargo: una prueba de A1 sustituyó a la antigua y las nuevas aserciones van dentro de pruebas existentes.
- `npm run build`, `npm run build:tizen` (`artifacts/Richiflix-Tizen-unsigned.wgt`) y `npm run test:tizen` («Tizen smoke OK»): en verde.
- `test:tizen` reescribe `tizen-player-preview.png` y `player-loader-preview.png`; los restauré con `git checkout`.

**Fixture headless** (`scripts/virtual-catalogue-fixture.html`, página Rails, modo TV, 1920×1080, sólo lecturas y capturas). La x de cada elemento, en px:

| Momento | Índice | Celda (borde de la tarjeta) | `h2` | `.card-open` (escalado 1,06) | Halo |
|---|---|---|---|---|---|
| 0 Derecha | 0 | 86,4 | 86,4 | 80,1 | 80,1 |
| 1 Derecha | 1 | 86,4 | 86,4 | 80,1 | 80,1 |
| 6 Derecha | 6 | 86,4 | 86,4 | 80,1 | 80,1 |
| 20 Derecha | 20 | 86,4 | 86,4 | 80,1 | 80,1 |
| 20 Derecha + 3 Izquierda | 17 | 86,4 | 86,4 | 80,1 | 80,1 |

- **La x del `.card-open` enfocado es constante** (80,1 px con la escala de foco; 86,4 px sin ella).
- **El `h2` y el borde de la tarjeta coinciden** con una diferencia de 0,0 px.
- **Línea base `6b5ab09`:** la celda saltaba de 86,4 a 156,4 px desde la primera Derecha. Ese era el fallo descrito en el spec.

**`paintCount` de `main.page-scene`** (LayerTree, 33 teclas): no crece en 30 de las 33 y crece 1 en las teclas 7, 14 y 33. Son los cruces de la ventana virtual (montaje de celdas), y la base `6b5ab09` da **exactamente el mismo patrón** (`000000100000010000000000000000001`). A2 no añade ningún repintado de la escena. La suma de repintados de todas las capas en las 33 teclas es 131, frente a 140 en la base.

**Panel ampliado (A3), tarjeta 7:**
- `panel.left` = 86,39 = `card.left`.
- Ancho 1000; las vecinas de la derecha se desplazan 790 (= 1000 − 210) y las de la izquierda 0.
- Halo con opacidad 1 a los 90 ms de cada tecla, antes de que se abra el panel.

**Degradado:** píxeles muestreados en la captura: x=2 → `22,31,45` (≈ fondo), x=40 → mezcla, x≥60 → fondo de la página sobre el hueco.

Capturas y JSON en el scratchpad de la sesión (`a2-*.png`, `a3-panel-tarjeta-7.png`, `a-measure.json`). No se versionan.

## Decisiones y desviaciones

1. **Margen negativo `calc(-4.5% / .91)` en vez del `-4.5%` del plan.** El porcentaje de margen se calcula sobre el ancho de la fila (91 % de la escena), así que `-4.5%` daba 78,6 px y la columna quedaba a unos 8 px del título. Sustituí el `86px` fijo por `padding-left:4.5%` del wrap a sangre (86,4 px exactos a 1920). Si se equivocara: la columna se desalinearía si cambia el relleno de `.content`. Es el mismo 4,5 % repetido, ver «Lo que dejé fuera».
2. **Clase nueva `virtual-rail-wrap` en lugar de `.tv-mode .rail-wrap`.** El carrusel no virtual de `interactions.jsx` también usa `.rail-wrap`, y la sangría lo habría roto. Si se equivocara: nada; es sólo un selector.
3. **`RAIL_PEEK_PX = 86` no se exporta.** El CSS da el relleno y la fila ya lo lee con `getComputedStyle`; la constante habría quedado sin uso. Si se equivocara: añadir una línea.
4. **El halo vive en `.virtual-rail-wrap`, no en la pista.** El plan pedía `x = paddingLeft`, pero dentro de una pista que se desplaza esa x se habría movido con el scroll y el deslizamiento.
5. **Prueba de fila corta (enfoque de revisión 1).** El enfoque dice «la fila no debe desplazarse»; el spec y la prueba del plan exigen la columna fija también para la última tarjeta de una fila corta. Seguí el spec: con 3 tarjetas, la fila se desliza una tarjeta por tecla y la anterior asoma bajo el degradado.
6. **Capas nuevas (Importante 2 de la revisión).** En la página Home de la fixture, las capas pasan de 62 a 74:
   - Los degradados aportan 4 (70 sin ellos). Chromium los compone porque se pintan sobre el rail, que es un scroller compuesto.
   - El halo fuera de la pista añade capas de solapamiento sobre `section.catalog-row`.
   - Son capas estáticas: los repintados por tecla no aumentan (131 frente a 140).

   Las mantengo porque el spec pide el degradado, pero el spec decía «sin capa propia». **Hay que comprobarlo en el TV** con `npm run measure:tv` (P50/P95 y memoria) antes de dar el bloque por cerrado. Si se equivocara: unos MB de GPU y algo de composición por fila. La alternativa sería quitar los degradados.

## Lo que dejé fuera

- **Nada en el TV.** Sin instalar ni medir; quedan pendientes la medición del TV y las capturas del spec.
- **`scripts/rail-anchor-smoke.mjs` sigue esperando el anclaje antiguo** (asomar 40 px). Es un smoke de Playwright prohibido en este encargo y no está en mis archivos. Hay que actualizarlo o retirarlo antes de volver a usarlo.
- **No toqué `src/style.css`.** Todo el CSS de A2 está en `compositorMotion.css`, junto a las reglas del halo.

**Detalles menores que señaló la revisión, aplazados:**
- El 4,5 % del relleno de página está escrito en tres sitios; convendría una variable `--page-pad`.
- El halo de las filas lejanas no lleva `visibility:hidden` (queda con opacidad 0).
- El parámetro `tv` de `expansionAlignFor` sólo se usa en pruebas.
- `VirtualCarousel` sigue pasando `paddingRight`, que ahora se ignora.
- El halo puede quedar a una fracción de píxel de la tarjeta (`offsetLeft` entero + relleno fraccionario).
