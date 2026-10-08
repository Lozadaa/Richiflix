# Plan de implementación · Inicio con vida

> **Para los agentes ejecutores (Opus, un worktree por agente):** leer primero `docs/specs/2026-10-08-inicio-con-vida-design.md` (reglas duras) y `docs/PLAN-RENDIMIENTO-TV-2026-10-07.md` §0–§2 (reglas de movimiento). Cada tarea termina con `npm test` en verde y un commit. Sólo se tocan los archivos de la propia lista; si hace falta otro, se anota en el informe y se para. Sin smokes de Playwright/Electron. Nunca instalar en el TV.

**Objetivo:** dar vida al Inicio del TV sin costar latencia: banner que respira y tiñe la escena, filas con jerarquía y dos filas nuevas (Top 10, Nuevo esta semana), tarjetas con datos, insignias, títulos limpios y logos.

**Arquitectura:** tres lotes paralelos con archivos disjuntos. H1 = banner y luz (FocusStage + compositorMotion). H2 = filas y tarjetas (App/row, Card, xtream, displayNames, style.css). H3 = metadatos (TMDB images → `logoImage`, panel ampliado). Contratos entre lotes: campos `addedAt`, `languages`, `displayTitle`, `logoImage` y la función `logoURL`. H1 consume `item.logoImage` si existe (H3 lo produce); hasta que llegue, el banner muestra el `h1` como hoy.

**Stack:** React 19, Vite, `node:test`, TMDB v3, Xtream, Tizen 10 / Chromium 130.

## Restricciones globales (copiadas del spec)

- Sólo `transform`/`opacity` animan; nada por tecla; cero capas nuevas por tarjeta; tope 91 capas; sin `backdrop-filter`/`blur`/`mix-blend-mode`/`color-mix`; `cssTarget` chrome85.
- Perillas `--tv-kenburns` y `--tv-ambient` en `.tv-mode` (valor 1 por defecto).
- Nada aparece ni desaparece al enfocar.
- La columna fija (`anchoredRailOffset`, paso por fila) no se toca.

## Enfoque de revisión

1. Diapositiva cuyo arte aún no está decodificado: el tinte no cambia antes que la imagen (se cambia en el mismo `choose`, con la capa `is-current`). Prueba en H1-T2.
2. Título sin año, sin género y sin duración: `card-facts` no se renderiza (ni un «·» suelto). Prueba en H2-T4.
3. Nombre que es sólo idiomas, p. ej. «(LAT/ENG)»: `cleanName` devuelve el título original, no vacío. Prueba en H2-T1.
4. `added` ausente o no numérico: sin `addedAt`, sin insignia, la fila Nuevo esta semana se oculta si queda vacía. Prueba en H2-T2.
5. Respuesta `images` sin logos o con sólo SVG: `logoImage` ausente y el `h1` se mantiene. Prueba en H3-T1.

---

## Lote H1 · Banner y luz

**Archivos (sólo estos):** `src/FocusStage.jsx`, `src/useBannerMotion.js`, `src/bannerFlow.js` (+ `bannerFlow.test.js`), `src/compositorMotion.css`.

### H1-T1 · Ken Burns con perilla
- En `.tv-mode` (compositorMotion.css) añadir `--tv-kenburns:1;--tv-ambient:1`.
- `.carousel-stage .focus-stage-visual.is-current img` (o el nodo que pinta el backdrop; comprobar en `FocusStage.jsx` qué elemento es la capa del fundido): `animation:stage-kenburns 9s linear both;animation-play-state:var(--kenburns-state,running);transform-origin:60% 40%`. `@keyframes stage-kenburns{from{transform:scale(1)}to{transform:scale(1.06)}}`. Con `--tv-kenburns:0` → `animation:none` (usar un selector `.tv-mode[style*="--tv-kenburns:0"]` NO; en su lugar la perilla se lee en JS: `FocusStage` pone `data-kenburns={getComputedStyle(root).getPropertyValue('--tv-kenburns').trim()!=='0'}` una vez al montar, y el CSS anima sólo con `[data-kenburns='true']`). `@media(prefers-reduced-motion:reduce)` → sin animación.
- La animación se reinicia por cambio de `key` de la capa (ya cambia por diapositiva). Si el carrusel está pausado, `animation-play-state:paused` vía `data-paused` en `.tv-stage` (el estado `paused` ya existe en `useBannerCarousel`: exponerlo si no lo está).
- Prueba: ninguna unitaria; comprobar en `npm run build`.

### H1-T2 · Tinte ambiental
- `FocusStage` renderiza, como primeros hijos de `.tv-stage`, `<i className="ambient-wash" data-slot="a"/>` y `<i className="ambient-wash" data-slot="b"/>` con `style={{'--wash-ink':…}}`. Lógica pura en `bannerFlow.js`: `export function ambientSlots(previous,ink)` → `{a,b,active}`: escribe `ink` en la capa inactiva y la activa; prueba en `bannerFlow.test.js` (alternancia a/b, misma tinta no cambia de capa).
- El `--identity-ink` del título viene de `identityStyle` (`ContentIdentity.jsx`) que ya se aplica al `.focus-stage`; reutilizarlo sin recalcular.
- CSS: `.ambient-wash{position:absolute;left:0;right:0;top:0;height:60vh;pointer-events:none;opacity:0;transition:opacity var(--tv-slow) ease;background:radial-gradient(ellipse at 70% 0%,rgba(var(--wash-ink-rgb),.55),transparent 70%)}.ambient-wash.is-active{opacity:1}`. Si `--identity-ink` es hex y no rgb, `ambientSlots` lo convierte a `r,g,b` (función pura `hexToRgb`, con prueba). Con `--tv-ambient:0` (mismo mecanismo `data-ambient`) → `display:none`.
- Cambia sólo en `choose`/cambio de diapositiva, junto con la capa `is-current`; nunca en `onKeyDown`.

### H1-T3 · Progreso del punto y entrada escalonada
- `.banner-dots .is-active:after{content:'';position:absolute;left:-11px;right:-11px;bottom:-8px;height:3px;background:var(--accent);transform:scaleX(0);transform-origin:left;animation:dot-progress 9s linear both;will-change:transform}` + `@keyframes dot-progress{to{transform:scaleX(1)}}`; pausa con `data-paused`. Reinicio por `key` del punto activo (`key={`${slide}:${cycle}`}` si hace falta un contador de ciclo en `useBannerCarousel`).
- `stage-copy-in`: `animation-delay` 0/40/80/120 ms en cejilla, `h1`/logo, descripción y datos.

### H1-T4 · Logo en el banner (consume H3)
- Si `item.logoImage` existe: `<img className="title-logo" src={logoURL(item.logoImage)} alt={displayTitle}>` en lugar del `h1`, dentro de un contenedor con la misma `grid-area`. Decodificar antes de pintar: igual que el arte (`data-artwork-state`), o `useEffect` con `img.decode().then(()=>setLogoReady(true))`; si falla → `h1`. `logoURL` se importa de `./artwork.js` (H3 la exporta; hasta entonces, `import {logoURL} from './artwork.js'` con fallback local `value=>value` sólo si no existe: NO — esperar a H3; H1 deja esta tarea para el final y, si H3 no ha llegado, la documenta como pendiente).
- CSS: `.title-logo{max-height:120px;max-width:480px;width:auto;height:auto;display:block}`.

### H1 · Informe
`docs/plans/informe-H1.md`: qué capas nuevas (deben ser 3 como máximo: 2 wash + 1 progreso), perillas, cómo apagarlas, y pendientes.

---

## Lote H2 · Filas y tarjetas

**Archivos (sólo estos):** `src/App.jsx` (sólo la línea de filas del Inicio y `row()`), `src/tvHome.js` (+ test), `src/interactions.jsx` (Card), `src/VirtualCarousel.jsx` (ancho de celda por fila, sólo si hace falta prop), `src/xtream.js`, `src/displayNames.js` (+ test), `src/cardFacts.js` (nuevo, + test), `src/style.css` (secciones de tarjeta/fila), `src/liveEvents.js` (+ test, sólo recuento).

### H2-T1 · `cleanName` para VOD
- `cleanName(title,{kind:'vod'})` → `{title,languages:[],quality,year}`: quita grupos `(LAT/ENG/CAST)`, `[LAT]`, `- Latino`, `DUAL`, `SUB`, `4K/1080p/HD` del final; `languages` en mayúsculas en orden original (`LAT`, `ENG`, `CAST`, `SUB`); conserva un año `(2024)`; idempotente; si queda vacío devuelve el original. Tabla de pruebas en `displayNames.test.js` con al menos 8 casos reales (sacar de `scripts/sample-names.mjs` si hay caché; si no, incluir «Michael (LAT/ENG/CAST)», «Dune: Parte Dos [4K] LAT», «Shrek - Latino», «(LAT/ENG)»).
- `normaliseItem` (xtream.js) aplica para `movie`/`series`: `displayTitle`, `originalTitle`, `languages`. `displayTitle` ya es la función que usan tarjetas y banner (`artwork.js:displayTitle`): comprobar que lee `item.displayTitle` antes que `title`; si no, ajustarlo ahí (archivo compartido: anotar en el informe y hacer el cambio mínimo).

### H2-T2 · `addedAt` y «Nuevo esta semana»
- `normaliseItem`: `addedAt:Number(raw.added)*1000` sólo si es finito y > 0.
- `tvHome.js`: `export function recentlyAdded(items,now=Date.now(),days=7,limit=40)` y `export function isNew(item,now)`. Pruebas: límite, orden, ausencia de `addedAt`.
- `App.jsx`: fila «Nuevo esta semana» tras Top 10 con `recentlyAdded([...movies,...shows])`; oculta si vacía. `rowActions` incluye la fila.
- Card: `<span className="card-badge is-new">NUEVO</span>` si `isNew(item)` (prop `badgeNew` calculada en el padre o en Card con `Date.now()` memorizado por render de fila: nunca por tecla).

### H2-T3 · Top 10 en Kingdom
- `tvHome.js`: `export function topTen(collections)` → 10 ítems de `TMDB_BEST` (película y serie intercalados por `tmdbRank`, película primero en empate), cada uno con `rank` 1..10; `[]` si la colección no existe.
- `App.jsx`: fila «Top 10 en Kingdom» tras «Series» (antes de Ahora en vivo), con `row(...)` y una prop `variant="ranked"` que llega a `VirtualCarousel` → clase `.virtual-rail.is-ranked` y celda más ancha (póster + 90 px). El paso del carrusel es por fila: comprobar que `VirtualCarousel` lee el ancho de celda por rail (si está en CSS por clase, basta la clase).
- Card: `rank` → `<b className="card-rank" aria-hidden="true">{rank}</b>` antes del póster. CSS: Bricolage 120 px, `-webkit-text-stroke:2px var(--text-2)`, `color:transparent`, `line-height:1`, sin transición.

### H2-T4 · Cejillas, línea de datos, oro y recuento en vivo
- `row()` acepta `eyebrow`; `.row-eyebrow` sobre el `h2` (`--accent`, 13 px, mayúsculas, `letter-spacing:.12em`). Mapa de cejillas en `tvHome.js`: `export function rowEyebrow(title)` con prueba.
- `cardFacts.js`: `export function cardFacts(item)` → `'2026 · Drama · 1 h 49 min'` o `''` (sin separadores sueltos). Card: `<span className="card-facts">` bajo `.card-title`, salvo si hay `card-resume`.
- Píldora de nota ≥ 8,0: clase `.is-gold` en `UserScore` compacto → `background:var(--accent);color:var(--bg)` (si `UserScore.jsx` no está en la lista, aplicar vía clase en el contenedor `.poster.is-gold .user-score` desde Card).
- Insignia de audio: `<span className="card-badge is-audio">LAT · ENG</span>` (máximo 3) bajo NUEVO. Las insignias van dentro de `.poster`, posicionadas, sin transición.
- `liveEvents.js`: `export function liveNowCount(items)` (fase `live`); `App.jsx`: título «Ahora en vivo · N en juego» cuando N > 0.

### H2 · Informe
`docs/plans/informe-H2.md`: campos nuevos, filas nuevas y su orden final, casos de `cleanName`, y si `VirtualCarousel`/`UserScore`/`artwork.js` necesitaron un cambio mínimo.

---

## Lote H3 · Metadatos y panel

**Archivos (sólo estos):** `src/metadata.js` (+ test), `src/metadataStore.js` (si hace falta campo), `src/artwork.js` (añadir `logoURL`; no tocar `displayTitle`), `src/ExpandedCard.jsx`, `src/titleLogo.css` (nuevo, importado desde `src/main.jsx`), `src/main.jsx` (sólo el import).

### H3-T1 · `logoImage` desde TMDB
- `spanishMetadata`: `append_to_response=videos,images,…&include_image_language=es,null&include_video_language=…`. Función pura `export function pickLogo(images)` → ruta del primer logo `iso_639_1==='es'`, si no el primero con `iso_639_1===null`, prefiriendo `.png` sobre `.svg`; `undefined` si no hay. Pruebas: es > null, sólo svg → se acepta svg sólo si no hay png, vacío → `undefined`.
- Guardar `logoImage` en la respuesta de detalles (mismo sitio que `backdropImage`). Comprobar que la caché de detalles (`metadataStore`/IndexedDB) acepta el campo nuevo sin migración; si la caché tiene versión, no subirla: los títulos ya cacheados simplemente no tendrán logo hasta que se refresquen.
- `artwork.js`: `export const logoURL=path=>path?`https://image.tmdb.org/t/p/w300${path}`:''` (seguir el patrón de `artworkURL` si construye las URL de otra forma).

### H3-T2 · Logo en el panel ampliado
- `ExpandedCard`: si `item.logoImage`, `<img className="title-logo is-panel" src={logoURL(item.logoImage)} alt={title}>` en lugar del `h3`, decodificado antes (`onLoad` + `decode`), con `h3` como respaldo si falla. CSS en `titleLogo.css`: `.title-logo.is-panel{max-height:72px;max-width:360px}`. Sin animación propia.
- Prueba: ninguna unitaria más allá de `pickLogo`; `npm run build`.

### H3 · Informe
`docs/plans/informe-H3.md`: endpoint final, tamaño medio de logo, cómo lo consume H1 (`item.logoImage` + `logoURL`).

---

## Integración y verificación (yo)

1. Merge H3 → H2 → H1 sobre `main`; resolver conflictos (no debería haber: archivos disjuntos); si H1 dejó T4 pendiente, hacerla tras el merge.
2. `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`.
3. Con autorización de Richard: instalar en el 55", `measure:tv` ×3 (tope P95 178 ms, capas ≤ 91), capturas de diapositivas 0 y 1, Top 10, Nuevo esta semana, insignias; `tv-trace-report.mjs` sin `Layout` en el cambio de diapositiva.
4. Sección «Resultado» aquí y en el spec; push a `origin/kingdom-main`.

## Resultado (8 oct 2026)

Lotes H1, H2, H3 ejecutados por tres Opus en worktrees (informes `informe-H1/H2/H3.md`), integrados en `main` sin conflictos; H1-T4 (logo en el banner) y `paused` del carrusel cerrados en la integración. Ajustes posteriores a la medición en el 55": tinte dentro de la capa del arte (sin `ambientSlots`), Ken Burns congelado sin capa al pausar, número del Top 10 dentro del botón y panel anclado al póster (`insetAnchorBox`), insignias abajo a la derecha. Cifras y capturas en la sección «Resultado» del spec. Los worktrees del Agent tool nacen de `origin/main` (historia pública): hay que resetearlos a `main` local antes de empezar (los cuatro agentes lo hicieron o se les indicó).
