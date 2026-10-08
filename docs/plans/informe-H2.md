# Informe H2 · Filas y tarjetas (Inicio con vida)

Rama del worktree: `worktree-agent-a15f531bf7053c7e7`, sobre `main` (`8e8ddc9`, «docs: spec y plan de Inicio con vida»). Hay un commit por tarea. `npm test` está en verde tras cada una (362 pruebas al empezar, 383 al terminar). `npm run build` y `npm run build:tizen` pasan. No ejecuté smokes, no instalé nada en ningún TV y no toqué `.env.local`.

> Nota de arranque: el worktree se creó sobre `7f1b4ad` (historia antigua de Richiflix, que sigue en `origin/main`), sin ancestro común con `main` y sin el spec ni el plan. Como no tenía cambios, apunté la rama a `main` (`git reset --hard main`) antes de empezar. No se perdió nada.

## H2-T1 · `cleanName` para VOD (`4c86507`)

- `cleanName(title,{kind:'vod'})` devuelve `{title,languages,quality,year}`. Quita del **final** grupos de etiquetas y repite mientras quede alguno:
  - entre paréntesis o corchetes: `(LAT/ENG/CAST)`, `[4K]`, `(2025)`, `(2024 LAT)`;
  - tras un separador: `- Latino`, `- Castellano`, `- Subtitulado`, `- Dual`, `| LAT`;
  - sueltos y en mayúsculas: `LAT`, `ENG`, `CAST`, `DUAL`, `SUB`, `4K`, `HD`, `1080p`.
- Un grupo sólo se quita si **todas** sus palabras son etiquetas, así que «Rocky (Director's Cut)» queda igual. Las siglas sueltas tienen que ir en mayúsculas («Ella es» no pierde el «es»). El año se toma sólo si va entre paréntesis o corchetes, para no tocar «Blade Runner 2049».
- `languages` va en mayúsculas y en el orden original, sin duplicados. Normalizaciones: `LATINO`→`LAT`, `CASTELLANO`→`CAST`, `SUBS`/`SUBTITULADO`→`SUB`; `DUAL`, `ES`, `EN` y `VOSE` se dejan tal cual. El año sale en `year` y no se queda en el título, para que la línea de datos no lo repita.
- No uso `normalizeSpacing`, porque convierte «Spider-Man» en «Spider - Man». Los títulos con ≥ 80 % de letras en mayúscula pasan por `titleCase`, como en `kind:'title'`. Si al limpiar no queda nada, se devuelve el original.
- `normaliseItem` (xtream.js) aplica la limpieza a `movie` y `series`: `displayTitle` (limpio), `originalTitle` (lo que manda el proveedor) y `languages`. `year` cae al año del título si el proveedor no envía uno. Los canales y los episodios no cambian.
- `artwork.js:displayTitle` ya leía `item.displayTitle` antes de limpiar `title` con su regex. El orden es `eventDisplayTitle` > `localizedTitle` (TMDB es) > `displayTitle` > `title`. **No hizo falta cambiarlo.** El banner y el panel ya pasan por esa función.

### Casos de `cleanName` (en `src/displayNames.test.js`, todos con comprobación de idempotencia)

No hay caché real en `artifacts/`: no existe `%APPDATA%/richiflix` y `nombres-muestra.json` sale de fixtures. Por eso los casos son los del plan más los títulos VOD de la muestra.

| Entrada | `title` | `languages` | otros |
|---|---|---|---|
| Michael (LAT/ENG/CAST) | Michael | LAT, ENG, CAST | |
| Dune: Parte Dos [4K] LAT | Dune: Parte Dos | LAT | quality 4K |
| Shrek - Latino | Shrek | LAT | |
| (LAT/ENG) | (LAT/ENG) (original, no vacío) | LAT, ENG | |
| A Movie (LAT/ENG) (2025) | A Movie | LAT, ENG | year 2025 |
| 🎬 Película (LAT/ENG) (2026) | Película | LAT, ENG | year 2026 |
| LOS SIMPSON (LAT) | Los Simpson | LAT | |
| Película (1997) | Película | — | year 1997 |
| Spider-Man: No Way Home DUAL 1080p | Spider-Man: No Way Home | DUAL | quality 1080P |
| The Batman - Subtitulado [HD] | The Batman | SUB | quality HD |
| Avatar \| LAT | Avatar | LAT | |
| Blade Runner 2049 | Blade Runner 2049 | — | |
| Rocky (Director's Cut) | Rocky (Director's Cut) | — | |
| Ella es | Ella es | — | |

También hay una prueba de `normaliseItem`: película, serie y canal, este último sin campos nuevos.

## H2-T2 · `addedAt` y «Nuevo esta semana» (`08ecf77`)

- `normaliseItem` añade `addedAt = Number(raw.added)*1000` sólo si es finito y > 0. Si falta, viene vacío, no es numérico, es 0 o es negativo, el campo no existe (hay prueba).
- `tvHome.js` exporta `isNew(item,now,days=7)` y `recentlyAdded(items,now=Date.now(),days=7,limit=40)`: filtra, ordena del más reciente al más antiguo y corta en el límite. Hay pruebas del límite, del orden y de la ausencia o `NaN` de `addedAt`.
- `App.jsx` calcula `fresh` (la fila) y `freshIds` (un `Set` para la insignia) en **un solo `useMemo` sobre `[movies,shows]`**, con un único `Date.now()` por catálogo. Nada se calcula en un handler de tecla. Kids hereda `forProfile`: si un título no está verificado, no está en `movies`/`shows`.
- La fila «Nuevo esta semana» se oculta si queda vacía (`row()` devuelve `null`). Su «Ver todo» está en `rowActions` y abre una vista de colección en Inicio, como Continuar viendo, porque mezcla películas y series.
- La insignia es `<span class="card-badge is-new">NUEVO</span>` dentro de `.card-badges`, en la esquina superior derecha de `.poster` (capa de `.card-open`). La tarjeta la recibe por la prop `fresh`, que `VirtualCarousel` le pasa a partir de `freshIds`.

## H2-T3 · Top 10 en Kingdom (`d2cba72`)

- `tvHome.js` exporta `topTen(collections,metadata={})`. Toma las colecciones `TMDB_BEST` de películas y de series. Ordena por `tmdbRank` (de `selections.metadata`, si no del ítem, si no la posición en la lista); en empate va primero la película y el orden es estable. Devuelve 10 **copias** con `rank` 1..10, o `[]` si no hay colección. Hay pruebas del intercalado, del desempate, de las copias, de que la colección RECENT no cuenta y del caso de un solo tipo.
- `App.jsx` la calcula con `useMemo([smartCollections,selections.metadata])`. Mientras `TMDB_BEST` no responda, la fila no se muestra. Tampoco se muestra en Kids, porque allí las selecciones están apagadas. La fila no tiene «Ver todo»: son diez títulos.
- `row(title,items,{variant})` → `VirtualCarousel variant="ranked"` → `.virtual-rail.is-ranked`. Es el único cambio estructural en `VirtualCarousel` aparte de las props `freshIds` y `eyebrow`.
- Tarjeta: `<b class="card-rank" aria-hidden="true">` como primer hijo de `.card-open`, antes de `.poster`. Lee `original.rank`, no el ítem mezclado con metadatos, para que ningún metadato pueda pintar números en otras filas.
- CSS: las tarjetas de la fila llevan `padding-left:90px`. El número usa Bricolage 800 de 120 px con `-webkit-text-stroke:2px var(--text-2)`, `color:transparent` y `line-height:1`, en `left:-90px` y `z-index:-1`, así que queda debajo del póster dentro de la misma capa. No tiene transición.

**Cómo comprobé el paso por fila y la columna fija**

1. `VirtualCarousel.measure()` (`useLayoutEffect`, por rail) lee el `flex-basis` del sondeo `.virtual-rail-probe`, que es hijo de su propio `.virtual-rail`. Lo escribe como `width` y mide `offsetWidth`. Esa medida es `layout.width` **de ese rail**.
2. Con `.virtual-rail.is-ranked .virtual-rail-probe{box-sizing:content-box}` y el `padding-left:90px`, el sondeo mide `basis + 90` (210 + 90 = 300 px en TV a 1920). Las celdas reales siguen en `border-box` con `width:100%` de su celda de 300 px. Por eso el póster sigue midiendo 210 px y los 90 px son del número.
3. Todo lo de la fila usa ese `layout.width` por rail: `railWindow`, `anchoredRailOffset`, `railTailSpace`, el `left` de las celdas, el ancho de la pista y el halo. En `virtualWindow.js` el paso es `stride = itemWidth + gap`, y `anchoredRailOffset` devuelve `index*stride` acotado. La celda enfocada queda en `x = paddingLeft`, la misma columna que el resto de filas, y las demás filas no cambian porque su sondeo no lleva la clase. No toqué `virtualWindow.js` ni la fórmula de la columna.

Consecuencias visibles, que dejo para la revisión en el TV:

- En la fila Top 10 la columna fija coincide con el **borde izquierdo del número**; el póster empieza 90 px más a la derecha.
- El halo único de la fila (ancho = `layout.width`) y el panel ampliado (que se ancla a la celda) enmarcan el bloque número + póster como una sola pieza.

Si se prefiere el halo sólo sobre el póster, se puede leer el `padding-left` del sondeo en `measure()` y desplazar el halo. Serían unas pocas líneas en `VirtualCarousel`; no las hice porque el lote sólo permite añadir una prop o clase por fila.

## H2-T4 · Cejillas, línea de datos, oro, audio y recuento en vivo (`a9efa69`)

- **Cejillas.** `tvHome.js:rowEyebrow(title)` hace el mapa:

  | Fila | Cejilla |
  |---|---|
  | Películas, Series, Una gran aventura | TU CATÁLOGO |
  | Continuar viendo | SIGUE DONDE LO DEJASTE |
  | Ahora en vivo… | EN DIRECTO |
  | filas TMDB | SELECCIÓN TMDB |
  | Top 10 en Kingdom | TOP 10 |
  | Nuevo esta semana | NOVEDADES |
  | desconocida | `''` |

  `row()` acepta `{eyebrow}`, que por defecto es `rowEyebrow(title)`; las filas de descubrimiento pasan «PARA TI». `VirtualCarousel` pinta `<div class="row-title"><small class="row-eyebrow">…</small><h2>…</h2></div>` dentro de `.row-heading`, con `--accent`, 13 px, mayúsculas y `letter-spacing:.12em`. Cada fila con cejilla es unos 17 px más alta.
- **Línea de datos.** El nuevo `src/cardFacts.js:cardFacts(item)` devuelve, por ejemplo, «2026 · Drama · 1 h 49 min»: año de 4 dígitos, primer `tmdbGenres` o primer `contentGenre` y `durationSeconds`. Si no hay ningún dato devuelve `''`, nunca un «·» suelto (hay prueba).
  - En la tarjeta va en `<span class="card-facts">` bajo `.card-title`, memorizada por `item` con `useMemo`; una tecla sólo cambia `selected`.
  - No aparece en canales ni cuando hay `resumeLabel` (Continuar viendo).
  - Con la línea, `.card-caption.has-facts` pasa a columna y el título se recorta a 1 línea, así que el alto fijo del pie (82 px en TV) se mantiene. Usa `--text-2` y 15 px en TV.
- **Oro.** Las tarjetas con `tmdbScore ≥ 8` llevan `.poster.is-gold`, y `.poster.is-gold>.score-compact` se pinta con `background:var(--accent);color:var(--bg)`. **No toqué `UserScore.jsx`**: usé la alternativa del plan (clase en el contenedor desde Card). La clase depende de los datos (nota del almacén de metadatos), no del foco.
- **Audio.** Va en `<span class="card-badge is-audio">LAT · ENG</span>` (máximo 3 códigos), en `.card-badges` debajo de NUEVO. No tiene transición.
- **Recuento en vivo.** `liveEvents.js:liveNowCount(items,now)` cuenta los eventos (`isEvent`) en fase `live`; los canales 24 h no cuentan. Hay prueba con 2 en juego, sólo canal y lista vacía. `App.jsx` lo calcula con `useMemo([homeLive])`; `homeLive` ya sigue los cambios de fase. El título es «Ahora en vivo · N en juego», o «Ahora en vivo» si N = 0.

## Orden final de las filas del Inicio

1. Continuar viendo
2. Películas (Kids: «Una gran aventura»)
3. Series
4. **Top 10 en Kingdom** (sólo si `TMDB_BEST` ha respondido; nunca en Kids)
5. **Nuevo esta semana** (oculta si está vacía)
6. Ahora en vivo [· N en juego] (nunca en Kids)
7. Dos filas TMDB en TV (`homeRowsForTV`, alternan por día), o mejor valoradas y recientes en PC
8. «Tu próximo mood» (descubrimiento, cejilla PARA TI)

## Reglas de rendimiento: comprobación en el diff

- `git diff main -- src/style.css | grep "^+" | grep -cE "transition|animation|will-change|backdrop-filter|blur|mix-blend|color-mix|inset:"` da **0**.
- No hay capas nuevas por tarjeta: insignias y número son hijos de `.card-open`, que ya era capa. `.card-rank` y `.card-badges` no tienen `transform` ni `opacity` animados.
- Ninguna clase nueva depende de `selected` o del foco (`is-ranked`, `is-gold`, `has-facts`, `card-badges`). `isNew`/`recentlyAdded`, `topTen` y `liveNowCount` se calculan en `useMemo` del padre, y `cardFacts` en un `useMemo` por ítem.
- Comprobé en `dist-tizen/assets/*.css` que las reglas salen tal cual, sin `inset` a secas.

## Archivos de excepción

- `src/artwork.js`: **sin cambios**; ya leía `item.displayTitle` antes de `title`.
- `src/UserScore.jsx`: **sin cambios**; el oro va por `.poster.is-gold .score-compact` desde Card.
- `src/App.jsx`: además de `row()`, `rowActions` y la línea de filas, añadí tres líneas `useMemo` justo antes de `rowActions` (`top`, `liveNow`, `{fresh,freshIds}`) y amplié dos imports (`tvHome.js`, `liveEvents.js`). No hay otros cambios en App.
- `src/displayNames.test.js` y `src/tvHome.test.js` importan `normaliseItem` de `xtream.js` para probar `displayTitle`/`languages`/`addedAt`, porque `xtream.test.js` no estaba en la lista.

## Pendientes

1. **Medir en el 55"** (integración): `measure:tv` ×3, P95 ≤ 178 ms y capas ≤ 91. Capturas de las filas Top 10 y Nuevo esta semana y de una tarjeta con NUEVO y audio. Hay que vigilar especialmente el raster del contorno de 120 px del número (`-webkit-text-stroke`), que se pinta una vez dentro de la capa de `.card-open`.
2. **Marcador «3 – 2» en la leyenda de eventos en juego** (spec §3): no está hecho. El plan limita `liveEvents.js` al recuento y el cambio iría en `eventCaption`.
3. **NUEVO en rejillas**: `VirtualCatalogue` no estaba en la lista, así que las páginas de Películas y Series y las vistas de colección no reciben `freshIds`. La línea de datos, la nota dorada y la insignia de audio sí salen allí, porque viven en Card.
4. **Top 10 · halo y panel** sobre el bloque número + póster (ver T3). Si en el TV se prefiere el halo sólo en el póster, es un cambio pequeño en `VirtualCarousel.measure()` y en el estilo del halo.
5. Los catálogos guardados antes de este cambio no tienen `displayTitle`/`languages`/`addedAt` hasta que se recarguen. Mientras tanto, `displayTitle()` sigue usando su regex de siempre, la fila Nuevo queda oculta y no se ven insignias.
