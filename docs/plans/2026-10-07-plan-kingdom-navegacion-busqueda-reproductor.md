# Plan de implementación · Foco fijo, búsqueda útil, episodios en español, reproductor por mando, nombres limpios, marca Kingdom

> **Para los agentes ejecutores:** SUB-SKILL OBLIGATORIO: `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`, tarea por tarea. Los pasos usan casillas (`- [ ]`). El proyecto **no es repo git**: donde un plan normal diría «commit», aquí el paso es «respaldo + `npm test` en verde» (respaldo de `src/` al scratchpad de la sesión antes de cada tarea).

**Objetivo:** que el TV se maneje como Netflix (foco fijo, búsqueda que siempre ofrece algo, episodios en español, reproductor sólo con flechas y botones, saltar intro, capítulos vistos), con nombres limpios y la marca Kingdom.

**Arquitectura:** cambios acotados sobre la app existente (React 19 + Vite, Tizen 10 / Chromium 130 en el TV, Electron en PC). Toda lógica nueva nace como función pura con prueba (`node --test`), y los componentes sólo la consumen. Las reglas de movimiento del plan de rendimiento se mantienen: sólo `transform`/`opacity` por tecla, sin lecturas de layout en el camino de la tecla, capa única por tarjeta.

**Stack:** React 19, Vite, `node:test`, TMDB API v3 (token ya configurado en Ajustes), Xtream Codes, Tizen AVPlay / hls.js, Orca + Codex para el logo (skill `orca-cli`).

**Spec:** `docs/specs/2026-10-07-tv-netflix-navegacion-busqueda-reproductor-design.md` (los ejecutores leen spec y plan).

## Restricciones globales

- Nada se instala en el TV sin indicación de Richard; medir con el inspector sí (procedimiento en `docs/PLAN-RENDIMIENTO-TV-2026-10-07.md` §4).
- Sin smokes de Playwright/Electron salvo `npm run test:tizen`; verificación = pruebas unitarias + fixture headless (sólo lecturas/capturas) + TV.
- Sin dependencias nuevas en `package.json`.
- Por tecla en TV: sólo `transform`/`opacity`; sin `getBoundingClientRect`/`scrollLeft` en el handler de tecla; una capa por tarjeta (`.card-open{will-change:transform}`), sin `will-change` en tracks ni celdas.
- Nombre visible: «Kingdom» en toda la interfaz; «Kingdom Player» sólo en metadatos del paquete, título de ventana y documentación. El id del paquete Tizen `Richiflix1.Richiflix` **no cambia**.
- Textos de interfaz en español de Chile/neutro, sin anglicismos de sistema («Siguiente episodio», no «Next»).
- Kids: sin canales; las novedades de episodios/reproductor aplican igual; la paleta Kids conserva un acento cálido propio.
- Estilo de código del repo: denso, una instrucción por línea larga, sin abstracciones de un solo uso.

## Enfoque de revisión

1. **Fila con menos tarjetas que la vista** (por ejemplo «Continuar viendo» con 3): el foco debe seguir en la columna fija y la fila no debe desplazarse ni dejar un hueco raro a la izquierda. → prueba en A1.
2. **Búsqueda con tildes, mayúsculas y signos** («Qué Pasó Ayer?», «Los Simpson 1x03»): debe encontrar el título y nunca tratar `?` o `(` como error. → prueba en B1.
3. **Serie cuyo proveedor numera episodios de forma absoluta** (temporada 2 empieza en el episodio 13) o con una temporada «0»/especiales: el cruce TMDB no debe mezclar títulos de otro episodio. → prueba en C1.
4. **Saltos acumulados que cruzan el final o el inicio del vídeo** (120 s a 40 s del final; retroceder al principio): el destino se acota y la tarjeta «Siguiente episodio» no se dispara por un salto. → prueba en D1.
5. **Nombres que ya están limpios** («Los Simpson», «ESPN», «Yankees vs. Rays»): el normalizador debe devolverlos idénticos; y siglas como «TV» o «MLB» no deben convertirse en «Tv»/«Mlb». → prueba en F1.

---

## Mapa de archivos

| Área | Crea | Modifica |
|---|---|---|
| A. Foco fijo | — | `src/virtualWindow.js` (+test), `src/VirtualCarousel.jsx`, `src/useCardExpansion.js`, `src/cardExpansion.js` (+test), `src/style.css` (`.tv-mode .rail-wrap`), `src/compositorMotion.css`, `docs/TARJETA-AMPLIADA.md` |
| B. Búsqueda y vacíos | `src/fuzzySearch.js` (+test), `src/searchSuggestions.js` (+test), `src/EmptyState.jsx`, `src/emptyState.css` | `src/catalogueWorker.js`, `src/catalogueWorkerProtocol.js`, `src/catalogueIndex.js`, `src/useCatalogueSearch.js`, `src/metadata.js` (`tmdbSearch`), `src/App.jsx` (bloque de resultados y vacíos), `src/LiveHub.jsx` |
| C. Episodios ES | `src/episodeMetadata.js` (+test), `src/useSeasonMetadata.js` | `src/metadata.js` (`tmdbSeason`), `src/persistentMetadataCache.js`, `src/SeriesEpisodes.jsx`, `src/EpisodeList.jsx` |
| D. Reproductor | `src/seekAccumulator.js` (+test), `src/playerKeys.js` (+test), `src/NextEpisodeCard.jsx`, `src/playerControls.css` | `src/Player.jsx`, `src/App.jsx` (`playEpisode`, `change`), `src/platform.js` (MediaRewind/FastForward repetición), `docs/DESIGN.md` |
| D1. Saltar intro | `src/introMarks.js` (+test), `src/useIntroSkip.js` | `src/libraryStorage.js` (+test), `src/useProfileLibrary.js`, `src/Player.jsx` |
| D2. Vistos | `src/watchProgress.js` (+test) | `src/libraryStorage.js` (+test), `src/useProfileLibrary.js`, `src/SeriesEpisodes.jsx`, `src/EpisodeList.jsx`, `src/interactions.jsx` (leyenda), `src/ExpandedCard.jsx`, `src/App.jsx` («Continuar viendo»), `src/seriesEpisodes.css` |
| E. Panel lateral | `src/PlaybackSidebar.jsx`, `src/playbackSidebar.css`, `src/trackNames.js` (+test) | `src/Player.jsx`, `src/avplay.js` (lista de pistas con idioma), `src/platform.js` |
| F. Nombres | `src/displayNames.js` (+test), `scripts/sample-names.mjs`, `artifacts/nombres-muestra.json` | `src/ContentIdentity.jsx` (`channelTitle`), `src/artwork.js` (`displayTitle`), `src/eventTime.js` (`eventDisplayTitle`), `src/xtream.js` (episodios), `src/channelPreparation.js`, `src/catalogueIndex.js` (índice doble) |
| G. Marca | `public/brand/kingdom*.svg|png|ico`, `docs/BRAND.md` (reescrito) | `src/Brand.jsx`, `src/style.css` (`:root` tokens), `tizen/config.xml` `<name>`, `index.html` `<title>`, `electron/main.cjs` (título), `package.json` `productName`, `scripts/export-brand.mjs`, `README.md`, `docs/DESIGN.md` |

## Olas y propiedad de archivos (ejecución con agentes en paralelo)

- **Ola 1**: A (foco fijo) ∥ F (nombres) ∥ C (episodios ES). Sin archivos compartidos.
- **Ola 2**: D (reproductor + D1 + D2) ∥ B (búsqueda y vacíos). `App.jsx`: B toca sólo el bloque `query?…` y los vacíos; D sólo `playEpisode`/`change`/props de `Player`. `libraryStorage.js` es sólo de D.
- **Ola 3**: E (panel lateral; depende de D) ∥ G (marca; Codex vía Orca para el logo, agente Claude para integrarlo).
- **Medición en el TV** (yo) tras cada ola: `npm run measure:tv` sin empeorar P50/P95 de `docs/PLAN-RENDIMIENTO-TV-2026-10-07.md` §11, y capturas de verificación del spec.
- Builds serializados con flags en el scratchpad como en las olas anteriores (`<tarea>-done.flag`).

---

## A. Foco fijo tipo Netflix

### Tarea A1: columna fija en `anchoredRailOffset`

**Archivos:** Modificar `src/virtualWindow.js:46-55`, `src/virtualWindow.test.js`.

**Interfaces:**
- Produce: `anchoredRailOffset({index,count,itemWidth,gap,paddingLeft,viewport})` → desplazamiento del rail tal que la tarjeta `index` queda en `x = paddingLeft` (la columna del título). Sin `peek` dentro de la fila. `railTailSpace({itemWidth,gap,paddingLeft,viewport})` → cola para que la última tarjeta llegue a la columna: `viewport - paddingLeft - itemWidth`.
- Produce: `RAIL_PEEK_PX = 86` (lo que asoma de la tarjeta anterior en el margen de pantalla; A2 lo usa para el margen negativo).

- [ ] **Paso 1: prueba que falla** (`src/virtualWindow.test.js`, estilo `node:test` del archivo):

```js
test('anchoredRailOffset keeps every card at the fixed column',()=>{
 const layout={itemWidth:210,gap:30,paddingLeft:86,viewport:1920,count:40};
 assert.equal(anchoredRailOffset({index:0,...layout}),0);
 assert.equal(anchoredRailOffset({index:1,...layout}),240);
 assert.equal(anchoredRailOffset({index:7,...layout}),7*240);
 assert.equal(anchoredRailOffset({index:39,...layout}),39*240); // la cola permite llegar
 assert.equal(anchoredRailOffset({index:2,...layout,count:3}),2*240); // fila corta: también se ancla
 assert.equal(railTailSpace(layout),1920-86-210);
});
```

- [ ] **Paso 2:** `node --test src/virtualWindow.test.js` → FALLA (hoy devuelve `index*stride-gap-40`).
- [ ] **Paso 3: implementar**

```js
export const RAIL_PEEK_PX=86;
export function railTailSpace({itemWidth,paddingLeft=0,viewport}){return Math.max(0,viewport-paddingLeft-itemWidth);}
export function anchoredRailOffset({index,count,itemWidth,gap=0,paddingLeft=0,viewport}){
 const stride=itemWidth+gap,max=Math.max(0,count*stride-gap+paddingLeft+railTailSpace({itemWidth,paddingLeft,viewport})-viewport);
 return Math.max(0,Math.min(max,index*stride));
}
```

Revisa que `max` nunca impida `index*stride` para el último índice (la cola lo garantiza); elimina `RAIL_PEEK` y su uso.

- [ ] **Paso 4:** pruebas en verde; respaldo.

### Tarea A2: fila hasta el borde de pantalla, degradados y halo fijo

**Archivos:** Modificar `src/style.css` (bloque `.tv-mode .cards`, `.rail-wrap`), `src/compositorMotion.css`, `src/VirtualCarousel.jsx` (halo y `paddingLeft`), `src/virtualWindow.js` (`haloPlacement`).

**Interfaces:**
- Consume: `RAIL_PEEK_PX`, `anchoredRailOffset`.
- Produce: en TV, `.rail-wrap` ocupa el ancho de pantalla (`margin:0 -4.5%`), el rail tiene `padding-left: RAIL_PEEK_PX` como `layout.paddingLeft` (la fila lo lee con `getComputedStyle` una vez por layout, ya existe), y dos pseudo-elementos `.rail-wrap::before/::after` con el degradado `#101827 → transparent` (86 px izquierda, 120 px derecha), `pointer-events:none`, `z-index` por encima del track y por debajo del halo y del panel. El halo único (`.rail-halo`) queda **fijo** en `x = paddingLeft` y sólo cambia `opacity`; `haloPlacement` devuelve `{x: paddingLeft, y}` en rails.

- [ ] **Paso 1: prueba** en `virtualWindow.test.js`: `haloPlacement({index:7,kind:'rail',width:210,gap:30,paddingLeft:86})` → `{x:86,y:0}` para cualquier `index`.
- [ ] **Paso 2:** falla (hoy devuelve `index*stride`).
- [ ] **Paso 3:** implementar `haloPlacement` (rail: `x=paddingLeft`); en `VirtualCarousel.jsx` el halo se coloca una vez por layout y en `focusin` sólo se enciende; quitar la animación de desplazamiento del halo en rails (`haloFrames` se conserva para la cuadrícula). CSS:

```css
/* A2: fila a sangre con columna fija y degradados pintados una vez (sin capa, sin mask). */
.tv-mode .rail-wrap{position:relative;margin:0 -4.5%;overflow:hidden}
.tv-mode .cards.virtual-rail{padding-left:86px;padding-right:0}
.tv-mode .rail-wrap::before,.tv-mode .rail-wrap::after{content:'';position:absolute;top:0;bottom:0;width:86px;pointer-events:none;z-index:3;background:linear-gradient(90deg,#101827,transparent)}
.tv-mode .rail-wrap::after{left:auto;right:0;width:120px;background:linear-gradient(270deg,#101827,transparent)}
.tv-mode .rail-halo{left:86px}
```

El título de la fila (`.row-heading`) conserva su `x` (no está dentro de `.rail-wrap`); comprueba en la fixture que `h2` y el borde izquierdo de la tarjeta enfocada coinciden ±1 px.

- [ ] **Paso 4:** fixture headless (`scripts/virtual-catalogue-fixture.html`, modo TV): tras 0, 1, 6 y 20 Derecha y 3 Izquierda, `getBoundingClientRect().left` del `.card-open` enfocado es constante y el `paintCount` de `main.page-scene` no crece por tecla (LayerTree). Guarda las cifras en el informe.

### Tarea A3: panel ampliado desde la columna, siempre hacia la derecha

**Archivos:** Modificar `src/useCardExpansion.js:55` (decisión de `align`), `src/cardExpansion.js` (`expansionAlignFor`), `src/cardExpansion.test.js`, `docs/TARJETA-AMPLIADA.md`.

- [ ] **Paso 1: prueba:** `expansionAlignFor({cellLeft:7*240,cellWidth:210,scrollLeft:7*240,viewportWidth:1920,previous:'end'})` → `'start'` en TV anclado (la tarjeta está en la columna); sólo devuelve `'end'` cuando `cellLeft - scrollLeft + panelWidth > viewportWidth` **y** no hay cola (caso inexistente con A1: documenta que la rama queda para PC).
- [ ] **Paso 2–3:** en TV, `align='start'` fijo cuando `tv&&rail`; las vecinas que se apartan son sólo las de la derecha (`neighbourShifts` ya lo hace con `align:'start'`). Actualiza el párrafo de TV en `docs/TARJETA-AMPLIADA.md`.
- [ ] **Paso 4:** `npm test`; fixture: abrir el panel en la tarjeta 7 → `panel.left === card.left ±1` y las vecinas derechas se desplazan `panel.width - card.width`.

---

## B. Búsqueda y estados vacíos

### Tarea B1: coincidencia aproximada en el worker

**Archivos:** Crear `src/fuzzySearch.js`, `src/fuzzySearch.test.js`; modificar `src/catalogueWorker.js`, `src/catalogueWorkerProtocol.js` (método `fuzzy`), `src/catalogueIndex.js` (`search` devuelve `{items, fuzzy, suggestions}`), `src/useCatalogueSearch.js`.

**Interfaces:**
- Produce: `normalizeQuery(text)` → minúsculas, sin tildes (NFD), sin signos, espacios simples; `scoreMatch(query, title)` → 0–1 (1 exacto; prefijo de palabra 0,8; todas las palabras presentes 0,7; Damerau-Levenshtein ≤ 2 por palabra 0,45–0,6; trigramas 0,3+); `fuzzyMatches(query, records, {limit=40, min=0.45})` → `[{id, score}]` ordenados; `suggestNames(query, records, {limit=5})` → títulos distintos con mejor puntuación.
- Consume: `records` del worker (`{id,title,genre,source}` ya existentes; se añade `clean` = título normalizado por F).

- [ ] **Paso 1: pruebas que fallan** (`src/fuzzySearch.test.js`):

```js
test('normalizeQuery strips accents, case and punctuation',()=>{assert.equal(normalizeQuery('¿Qué Pasó Ayer?'),'que paso ayer');assert.equal(normalizeQuery('Los Simpson 1x03'),'los simpson 1x03');});
test('fuzzyMatches finds misspelt and partial titles',()=>{
 const records=[{id:1,title:'Breaking Bad'},{id:2,title:'Better Call Saul'},{id:3,title:'Los Simpson'}];
 assert.deepEqual(fuzzyMatches('brekin bad',records).map(r=>r.id),[1]);
 assert.equal(fuzzyMatches('simson',records)[0].id,3);
 assert.deepEqual(fuzzyMatches('zzzz',records),[]);
});
test('suggestNames returns distinct best titles',()=>{assert.deepEqual(suggestNames('bad',[{id:1,title:'Breaking Bad'},{id:4,title:'Breaking Bad'},{id:2,title:'Bad Boys'}]),['Breaking Bad','Bad Boys']);});
```

- [ ] **Paso 2:** fallan (módulo inexistente).
- [ ] **Paso 3:** implementar (Damerau-Levenshtein con corte temprano a 3; trigramas con Dice; sin dependencias). En el worker, `search` calcula primero exactos (como hoy) y, si hay < 5 resultados, añade `fuzzy` y `suggestions`; respuesta `{items, fuzzy, suggestions}`; `useCatalogueSearch` expone `search.fuzzy` y `search.suggestions`. Presupuesto: ≤ 60 ms por consulta sobre 27.000 títulos en el worker (mide con la fixture de 27.000 y anótalo).
- [ ] **Paso 4:** `npm test`; medir.

### Tarea B2: TMDB para títulos ausentes y alternativas de género

**Archivos:** Crear `src/searchSuggestions.js` (+test); modificar `src/metadata.js` (`tmdbSearch(query, token, fetcher)` → `[{tmdbId, type, title, year, genreIds, poster}]`, `search/multi`, `language=es-ES`), `src/App.jsx` (hook con debounce 500 ms, una petición en vuelo, caché `Map` por consulta normalizada, máx. 50).

**Interfaces:** `genreAlternatives({tmdbResult, collections, limit=12})` → items del catálogo de las colecciones TMDB cuyo nombre coincide con los `genreIds` del resultado (mapa id→nombre ya existe en `tmdbSelections.js`: reutilizarlo).

- [ ] **Paso 1: prueba:** `genreAlternatives` con un resultado de géneros `[18,80]` y colecciones «Drama» y «Crimen» devuelve items de ambas, sin duplicados, ≤ 12; con géneros desconocidos devuelve `[]`.
- [ ] **Paso 2–3:** implementar; en App sólo se consulta TMDB cuando `searchResults.length===0 && fuzzy.length<3` y `query.length>=3`.
- [ ] **Paso 4:** `npm test`; prueba de `tmdbSearch` con `fetcher` simulado (no se llama a la red en tests).

### Tarea B3: componente `EmptyState` y sus usos

**Archivos:** Crear `src/EmptyState.jsx`, `src/emptyState.css`; modificar `src/App.jsx` (resultados vacíos, filtro vacío, Mi lista, error de fuente), `src/LiveHub.jsx` (sin eventos hoy).

**Interfaces:** `<EmptyState art={categoryKey} title text actions=[{label,onClick,primary}] >children</EmptyState>`; los botones son `button` normales (alcanzables por el mando con la navegación direccional existente); el primero recibe el foco al montarse en TV.

- [ ] **Paso 1:** escribir el componente y el CSS (ilustración de categoría ya existente en `public/artwork/categories`, 240 px; título 32 px TV; texto 22 px; sin animaciones nuevas).
- [ ] **Paso 2:** búsqueda sin exactos: bloque «Parecidos a "…"» (cuadrícula con `fuzzy`), botones «¿Quisiste decir…?» (`suggestions`, lanzan `setQuery`), tarjeta TMDB «"X" no está en tus fuentes» con póster y debajo «Del mismo género en tu catálogo» (`genreAlternatives`), y siempre «Buscar en todo el catálogo» (si había sección/categoría) y «Limpiar búsqueda».
- [ ] **Paso 3:** filtro vacío → «Ver todas» + 3 categorías con más títulos (`index.categories` + conteo); Mi lista vacía → «Explorar películas» + fila «Mejor valoradas» (ya existe `smartCollections`); error de fuente → frase + «Reintentar» (`catalogue.refresh(true)`) + «Ajustes»; LiveHub sin eventos → «Próximos» de mañana o cuadrícula de canales.
- [ ] **Paso 4:** fixture: capturas de los cinco estados; `npm test`; comprobar con el mando (fixture, teclas sintéticas) que Abajo desde los chips llega al primer botón del vacío y Volver sube.

---

## C. Episodios en español

### Tarea C1: cruce proveedor ↔ TMDB

**Archivos:** Crear `src/episodeMetadata.js`, `src/episodeMetadata.test.js`.

**Interfaces:** `mergeSeasonEpisodes(providerEpisodes, tmdbEpisodes, {season})` → episodios del proveedor con `title`, `description`, `airDate`, `runtime`, `stillPath` de TMDB cuando cruzan; `providerEpisodes[i].episodeNumber` ↔ `tmdbEpisodes[j].episode_number`; si los números del proveedor no caben en la temporada (absolutos), cruce por orden; temporada `0` sólo con `season_number === 0`; el título del proveedor se conserva (normalizado por F) si TMDB no trae `name` o trae «Episodio N».

- [ ] **Paso 1: pruebas:**

```js
test('mergeSeasonEpisodes matches by episode number and falls back by order for absolute numbering',()=>{
 const tmdb=[{episode_number:1,name:'Piloto',overview:'Walter…'},{episode_number:2,name:'El gato está en la bolsa',overview:'…'}];
 const byNumber=mergeSeasonEpisodes([{id:'a',episodeNumber:2,title:'Breaking Bad S01E02'}],tmdb,{season:1});
 assert.equal(byNumber[0].title,'El gato está en la bolsa');
 const absolute=mergeSeasonEpisodes([{id:'x',episodeNumber:13,title:'Ep 13'},{id:'y',episodeNumber:14,title:'Ep 14'}],tmdb,{season:2});
 assert.deepEqual(absolute.map(e=>e.title),['Piloto','El gato está en la bolsa']);
});
test('mergeSeasonEpisodes never mixes specials and keeps provider title when TMDB is generic',()=>{
 const out=mergeSeasonEpisodes([{id:'s',episodeNumber:1,title:'Detrás de cámaras'}],[{episode_number:1,name:'Episodio 1',overview:''}],{season:0});
 assert.equal(out[0].title,'Detrás de cámaras');
});
```

- [ ] **Paso 2–3:** fallan → implementar.
- [ ] **Paso 4:** `npm test`.

### Tarea C2: `tmdbSeason` con es-ES → es-MX y caché

**Archivos:** Modificar `src/metadata.js` (`tmdbSeason(tmdbId, season, token, fetcher)`: `tv/{id}/season/{n}?language=es-ES`; si algún episodio carece de `name` u `overview`, segunda llamada `es-MX` y fusión por `episode_number`), `src/persistentMetadataCache.js` (clave `season:<tmdbId>:<n>`, 30 días, misma generación), `src/metadata.test.js`.

- [ ] **Paso 1: prueba** con `fetcher` simulado: primera respuesta es-ES con un `overview` vacío → se pide es-MX y el resultado fusionado trae el `overview` de es-MX; segunda llamada no se repite si es-ES estaba completo.
- [ ] **Paso 2–4:** implementar; el worker/IPC expone `season` igual que `details` (añadir a `catalogueWorkerProtocol` y `electron/xtream-store.cjs` si el camino TMDB pasa por ahí; revisa cómo viaja `spanishMetadata`).

### Tarea C3: `useSeasonMetadata` y la lista

**Archivos:** Crear `src/useSeasonMetadata.js`; modificar `src/SeriesEpisodes.jsx`, `src/EpisodeList.jsx`.

**Interfaces:** `useSeasonMetadata(item, seasons, selectedSeason)` → `{bySeason: Map<season, episodes>, pending: Set<season>}`; pide la temporada seleccionada primero, luego las visibles, concurrencia 2, cancela al cerrar; si `item.tmdbId` falta, resuelve por título+año con `tmdbSearch` (B2) y guarda el id en el almacén de metadatos.

- [ ] **Paso 1–3:** implementar; `EpisodeList` muestra título y sinopsis TMDB (2 líneas, 22 px TV), «Sinopsis en inglés» como etiqueta pequeña cuando sea el último recurso; sin cambios de alto de fila.
- [ ] **Paso 4:** `npm test`; fixture con respuesta simulada: ≥ 90 % de episodios con título en español; captura.

---

## D. Reproductor por mando

### Tarea D1: acumulador de saltos

**Archivos:** Crear `src/seekAccumulator.js`, `src/seekAccumulator.test.js`.

**Interfaces:** `createSeekAccumulator({steps=[10,30,60,120], windowMs=600, applyMs=400, schedule, cancel, now})` con `press(direction, {position, duration})` → `{target, delta, step}` (acota a `[0, duration-1]`), `onApply(fn)` (una vez por ráfaga), `cancel()`; mantener (eventos `repeat`) cuenta como pulsaciones cada 250 ms.

- [ ] **Paso 1: pruebas:**

```js
test('seek accelerates within the window and applies once',()=>{
 let t=0,applied=[];const timers=[];const acc=createSeekAccumulator({now:()=>t,schedule:(fn,ms)=>{timers.push({fn,at:t+ms});return timers.length;},cancel:id=>{timers[id-1]=null;}});
 acc.onApply(v=>applied.push(v));
 assert.equal(acc.press(1,{position:100,duration:3600}).delta,10);t+=300;
 assert.equal(acc.press(1,{position:100,duration:3600}).delta,40);t+=300;
 assert.equal(acc.press(1,{position:100,duration:3600}).delta,100);
 t+=400;timers.filter(Boolean).forEach(x=>x.at<=t&&x.fn());assert.deepEqual(applied,[200]);
});
test('seek clamps at the ends and resets after the window',()=>{
 let t=0;const acc=createSeekAccumulator({now:()=>t,schedule:()=>1,cancel:()=>{}});
 assert.equal(acc.press(1,{position:3580,duration:3600}).target,3599);
 assert.equal(acc.press(-1,{position:5,duration:3600}).target,0);
 t+=700;assert.equal(acc.press(1,{position:100,duration:3600}).delta,10);
});
```

- [ ] **Paso 2–4:** fallan → implementar → verde.

### Tarea D2: mapa de teclas del reproductor sin barra

**Archivos:** Crear `src/playerKeys.js` (+test); modificar `src/Player.jsx` (handler de teclas, `tabIndex` de la barra en TV a `-1` y `aria-hidden` del input, foco inicial en el vídeo), `src/platform.js` (MediaRewind/FastForward con `repeat`).

**Interfaces:** `playerKeyAction({key, focus:'video'|'buttons', repeat, live, seekable, hasEpisodes})` → `{type:'seek',direction} | {type:'focusButtons'} | {type:'focusVideo'} | {type:'close'} | {type:'togglePlay'} | {type:'moveButton',direction} | null`. Reglas: en `video`: Izq/Der → `seek` (si `seekable`), Abajo/OK → `focusButtons` (OK además `togglePlay` si ya estaban visibles), Volver → `close`; en `buttons`: Izq/Der → `moveButton`, Arriba/Volver → `focusVideo`, OK lo gestiona el botón.

- [ ] **Paso 1: prueba** de la tabla anterior (una aserción por fila, incluidos `live && !seekable` → `null` en Izq/Der).
- [ ] **Paso 2–3:** implementar; la barra deja de ser foco en TV; `focus` nunca cae en `.seek-track input` (si el navegador lo intenta por Tab, `tabIndex=-1`).
- [ ] **Paso 4:** `npm test`; fixture: secuencia de 30 teclas aleatorias de {Izq,Der,Arriba,Abajo,OK,Volver} dentro del reproductor simulado → `document.activeElement` nunca es el input de la barra.

### Tarea D3: fila de botones y siguiente episodio

**Archivos:** Crear `src/NextEpisodeCard.jsx`, `src/playerControls.css`; modificar `src/Player.jsx` (fila: anterior · reiniciar · −10 · play/pausa · +10 · siguiente · idioma · señal), `src/App.jsx` (`change({episode})` reutiliza `setPlaying` como el cambio de señal; `episodeOrigin` conserva la serie), `src/SeriesEpisodes.jsx` (exportar `adjacentEpisode(seasons, current, direction)` puro o moverlo a `episodeWindow.js` con test).

**Interfaces:** `adjacentEpisode(seasons, episodeId, direction)` → episodio siguiente/anterior cruzando temporadas o `null`. `NextEpisodeCard({episode, secondsLeft, onPlay, onDismiss})`: aparece a 30 s del final (o en `ended`), cuenta atrás de 10 s, toma el foco al aparecer, OK reproduce, Volver descarta; al terminar sin interacción reproduce el siguiente; contador de autoplays consecutivos → a los 3, «¿Sigues ahí?» con botón «Seguir viendo».

- [ ] **Paso 1: prueba** de `adjacentEpisode` (dentro de la temporada, cruce a la siguiente, último → `null`, especiales excluidos).
- [ ] **Paso 2–3:** implementar; los botones que no aplican no se renderizan (película: sin episodios; directo: sin saltos ni reiniciar); «Reiniciar» = `seek(0)`.
- [ ] **Paso 4:** `npm test`; fixture: episodio simulado de 60 s → a los 30 s aparece la tarjeta con el foco; OK cambia de episodio sin cerrar el diálogo (`.player-dialog` persiste, `item.id` cambia); captura.

### Tarea D4: saltar intro aprendido (y base pública si existe)

**Archivos:** Crear `src/introMarks.js` (+test), `src/useIntroSkip.js`; modificar `src/libraryStorage.js` (clave `intros: {[seriesId:season]: {start,end,samples}}`, versión igual, respaldo), `src/useProfileLibrary.js` (`intros`, `setIntros`), `src/Player.jsx` (botón «Saltar intro»/«Saltar resumen»).

**Interfaces:** `learnIntro(marks, {seriesId, season, from, to})` → nuevas marcas si `from < 300 && 30 <= to-from <= 150` (media de las últimas 3 muestras); `introWindow(marks, {seriesId, season})` → `{start,end}|null`; `discardIntro(marks, key)`; `shouldOffer({position, window, dismissedAt})` → bool (dentro de `[start-15, end]`, no descartado, ≤ 10 s visible).

- [ ] **Paso 1: pruebas:** aprende con un salto de 85 s a los 40 s; ignora saltos de 10 s o a los 20 min; media de 3 muestras; `discardIntro` tras «Saltar intro» + retroceso; `shouldOffer` dentro/fuera de la ventana.
- [ ] **Paso 2–3:** implementar; en `Player`, cuando el acumulador aplica un salto hacia delante se llama a `learnIntro`; el botón toma el foco al aparecer (OK salta a `end`, cualquier flecha lo descarta y devuelve el foco al vídeo); nunca en películas ni directo.
- [ ] **Paso 4:** **comprobación de base pública**: buscar (WebSearch) una API de marcas de intro consultable por TMDB id (candidatas conocidas: Anime Skip API para anime; verificar licencia y cobertura). Si existe y es gratuita para uso personal, añadir `src/introDatabase.js` con `fetchIntro({tmdbId, season, episode})` con timeout 4 s y caché 30 días, y usarla como primer nivel; si no, dejar nota en el plan y seguir sólo con el aprendizaje. `npm test`.

### Tarea D5: capítulos vistos

**Archivos:** Crear `src/watchProgress.js` (+test); modificar `src/libraryStorage.js` (`watched: {[episodeId]: true}`, `durations: {[episodeId]: seconds}`), `src/useProfileLibrary.js`, `src/Player.jsx` (guarda duración; marca visto al ≥ 90 % o `ended`), `src/SeriesEpisodes.jsx`/`src/EpisodeList.jsx` (estado por episodio, selector de temporada con «4 de 10 vistos», foco inicial en el siguiente por ver, mantener OK → marcar), `src/interactions.jsx` y `src/ExpandedCard.jsx` (leyenda «T2 · E5 · Quedan 12 min» / «Siguiente: T2 · E6»), `src/App.jsx` («Continuar viendo»: una serie una vez, con el episodio en curso), `src/seriesEpisodes.css`.

**Interfaces:** `episodeState({episodeId, history, watched, durations})` → `'watched'|'started'|'unwatched'` con `remainingMinutes`; `seasonProgress(episodes, …)` → `{watched, total}`; `nextToWatch(seasons, …)` → episodio; `continueWatchingEntries(all, history, watched, durations)` → una entrada por serie con `episode` y `remainingMinutes`.

- [ ] **Paso 1: pruebas** de las cuatro funciones (incluye: episodio al 92 % cuenta como visto aunque no esté en `watched`; serie con dos episodios empezados aparece una vez con el más reciente).
- [ ] **Paso 2–3:** implementar; UI: check y título atenuado (opacity .55) en vistos; barra + «Quedan 12 min» en empezados; siguiente resaltado y con foco al abrir; «Marcar como visto/no visto» y «Marcar temporada como vista» con `createCardPress`.
- [ ] **Paso 4:** `npm test`; fixture: capturas de lista con los tres estados y del selector de temporadas.

---

## E. Panel lateral de idioma, subtítulos y opciones

### Tarea E1: nombres de pista legibles

**Archivos:** Crear `src/trackNames.js` (+test); modificar `src/avplay.js` (exponer `language`/`label` de cada pista de audio/subtítulo desde `getTotalTrackInfo`), `src/Player.jsx` (hls.js: `audioTracks[i].lang/name`).

**Interfaces:** `trackName({language, label, index, kind})` → «Español (Latinoamérica)», «Inglés», «Subtítulos 2»; usa `Intl.DisplayNames(['es'],{type:'language'})` con fallback a una tabla corta (`spa, es-419, eng, por, fra, deu, ita, jpn`); duplicados → añade códec o «(2)».

- [ ] **Paso 1: prueba:** `spa`→«Español», `es-419`→«Español (Latinoamérica)», `eng`→«Inglés», `{index:1,kind:'subtitle'}` sin idioma → «Subtítulos 2», dos `eng` → «Inglés», «Inglés (2)».
- [ ] **Paso 2–4:** implementar.

### Tarea E2: `PlaybackSidebar`

**Archivos:** Crear `src/PlaybackSidebar.jsx`, `src/playbackSidebar.css`; modificar `src/Player.jsx` (sustituye `.playback-menu` y `.signal-menu`; botón «Idioma y subtítulos» en la fila), `src/platform.js` (nada de `SELECT`: ya no hay selects en el reproductor).

**Interfaces:** `<PlaybackSidebar open sections=[{title, options:[{id,label,active,onSelect}]}] onClose/>`; ancho 520 px TV / 420 px PC; entra con `transform:translateX(100%)→0` y `opacity` en 180 ms; lista única de botones (`role="radio"` por sección); Arriba/Abajo recorren todas las secciones; Izquierda/Volver cierran y devuelven el foco al botón que abrió; OK aplica sin cerrar; el vídeo sigue. Secciones: Audio, Subtítulos (+«Desactivados»), Calidad (si hay niveles), Velocidad (sólo PC y VOD), Señal (eventos con varias señales).

- [ ] **Paso 1:** escribir componente + CSS (sin `backdrop-filter`; vídeo atenuado con una capa `rgba(16,24,39,.55)`).
- [ ] **Paso 2:** cablear a `setAudio`/`selectAudio` (Tizen) y `hls.audioTrack`/`textTracks` (Electron); eliminar los `<select>`.
- [ ] **Paso 3:** prueba de `playerKeyAction` ampliada: con `focus:'sidebar'` Arriba/Abajo → `moveOption`, Izq/Volver → `closeSidebar`.
- [ ] **Paso 4:** `npm test`; fixture: abrir con OK, recorrer, elegir, cerrar; captura. En el TV: cambiar de pista de audio en un título con dos pistas (verificación de Richard).

---

## F. Nombres limpios

### Tarea F1: muestra real y normalizador

**Archivos:** Crear `scripts/sample-names.mjs` (lee la caché del catálogo en Electron `%APPDATA%\richiflix` o por el inspector del TV; sólo nombres; escribe `artifacts/nombres-muestra.json` con conteo de patrones), `src/displayNames.js`, `src/displayNames.test.js`.

**Interfaces:** `cleanName(raw, {kind:'channel'|'event'|'episode'|'title', series?})` → `{title, language, quality, country, episodeNumber, season, time}`; `titleCase(text)` (artículos/preposiciones en minúscula salvo inicio; siglas respetadas: `TV, HD, MLB, NBA, NFL, UFC, ESPN, HBO, CNN, BBC, FOX, DAZN, UEFA, FIFA, USA, UK, EEUU, DC`); `normalizeSpacing`.

- [ ] **Paso 1: pruebas** (tabla del spec §5 + los casos del enfoque de revisión):

```js
const cases=[
 ['◘ MLB ◘ 19:00 Yankees vs Rays ◘ Spanish','event',{title:'Yankees vs. Rays',language:'es',time:'19:00'}],
 ['10/07 Soccer 7:30pm Barcelona vs Real Madrid','event',{title:'Barcelona vs. Real Madrid'}],
 ['Breaking Bad - S01E03 - Piloto','episode',{title:'Piloto',season:1,episodeNumber:3}],
 ['1x03 Piloto','episode',{title:'Piloto',season:1,episodeNumber:3}],
 ['US: ESPN HD [ENG]','channel',{title:'ESPN',language:'en',quality:'HD',country:'US'}],
 ['LOS SIMPSON (LAT)','title',{title:'Los Simpson',language:'es'}],
 ['Los Simpson','title',{title:'Los Simpson'}],
 ['Yankees vs. Rays','event',{title:'Yankees vs. Rays'}],
 ['Episode 3','episode',{title:'',episodeNumber:3}],
];
for(const [raw,kind,expected] of cases)test(`cleanName ${raw}`,()=>{const out=cleanName(raw,{kind,series:'Breaking Bad'});for(const k of Object.keys(expected))assert.equal(out[k],expected[k]);});
test('cleanName is idempotent on the sample',async()=>{const sample=JSON.parse(await readFile('artifacts/nombres-muestra.json','utf8'));for(const raw of sample.names)assert.equal(cleanName(cleanName(raw,{kind:'channel'}).title,{kind:'channel'}).title,cleanName(raw,{kind:'channel'}).title);});
```

- [ ] **Paso 2:** ejecutar `scripts/sample-names.mjs` (≥ 2.000 canales/eventos, ≥ 500 episodios) y revisar los patrones más frecuentes; añadir a `cases` los que falten.
- [ ] **Paso 3:** implementar `cleanName` (orden: extraer hora/fecha → país → idioma → calidad → códigos de episodio → nombre de serie repetido → símbolos → espacios → `titleCase` sólo si ≥ 80 % mayúsculas). Prueba sobre la muestra: 0 nombres con `[◘✪★▶|_]` ni `S\d\dE\d\d` ni `\d{1,2}:\d{2}` al inicio.
- [ ] **Paso 4:** `npm test`.

### Tarea F2: un solo punto de aplicación

**Archivos:** Modificar `src/channelPreparation.js` (worker: `cleanName` para canales/eventos, guarda `displayTitle`, `language`, `quality`, `country`), `src/xtream.js:75-79` (episodios), `src/ContentIdentity.jsx` (`channelTitle` usa `item.displayTitle`), `src/artwork.js` (`displayTitle`), `src/eventTime.js` (`eventDisplayTitle`), `src/liveEvents.js` (`feedLanguage` lee `item.language` antes de la regex), `src/catalogueIndex.js` (indexa `displayTitle` y `title`).

- [ ] **Paso 1:** prueba en `liveEvents.test.js`: una señal con `language:'es'` y título ya limpio se prefiere; `catalogueIndex` encuentra «ESPN» buscando «espn hd».
- [ ] **Paso 2–3:** implementar; las vistas no transforman nada.
- [ ] **Paso 4:** `npm test`; en el TV, captura de «TV en vivo» y de una serie: ningún símbolo raro.

---

## G. Marca Kingdom

### Tarea G1: logo y paleta con Codex (Orca)

**Archivos:** Crear `public/brand/kingdom.svg`, `kingdom-glyph.svg`, `kingdom-wordmark-player.svg`, PNG 16–1024 + `kingdom.ico` + `tizen/icon.png` (117 px) vía `scripts/export-brand.mjs` adaptado; `docs/BRAND.md` reescrito.

- [ ] **Paso 1:** con el skill `orca-cli`, abrir un worktree/contexto de Orca y lanzar Codex con este encargo literal: «Diseña la identidad de "Kingdom" (app de streaming personal para TV Samsung, fondo oscuro). Entrega: símbolo (corona o motivo de reino reducido a una forma geométrica simple, legible a 16 px y a 512 px, un color de acento + neutro, sin texto), logotipo "Kingdom" (sin "Player") y variante "Kingdom Player" para metadatos; todo en SVG limpio (sin bitmaps, sin fuentes externas: texto convertido a trazados), y una paleta de 6 tokens (fondo, superficie, texto, texto secundario, acento, foco) con contraste AA sobre el fondo y el color de foco distinto del acento; además un acento cálido alternativo para el perfil Kids. Tres propuestas en una página HTML de comparación con el símbolo a 16/48/512 px sobre el fondo y sobre un póster.» Guardar las propuestas en `artifacts/brand-propuestas/`.
- [ ] **Paso 2:** Richard elige una (si no está, se integra la propuesta 1 y se deja nota).
- [ ] **Paso 3:** exportar tamaños con `npm run brand:export` (actualizar el script a los nombres `kingdom-*`), `tizen/icon.png` 117×117.

### Tarea G2: integración

**Archivos:** Modificar `src/Brand.jsx` (símbolo + «Kingdom»), `src/style.css` (`:root` tokens → nueva paleta; revisar cada uso literal de `#ff977f`, `#c1b0ee`, `#f5d58d`, `#101827` en `src/*.css` y sustituir por tokens), `index.html` (`<title>Kingdom</title>`, favicons), `tizen/config.xml` (`<name>Kingdom Player</name>`; **no** cambiar `id` ni `package`), `electron/main.cjs` (título de ventana «Kingdom Player»), `package.json` (`productName` si existe; `name` se mantiene para no romper rutas), `src/Boot.jsx` (loader), `src/main.jsx` (perfiles), `README.md`, `docs/DESIGN.md`.

- [ ] **Paso 1:** script de comprobación: `grep -rn "Richiflix\|richiflix" src/ index.html | grep -v "richiflix-\(catalog\|preview\|remote\)"` → sólo deben quedar nombres técnicos (eventos personalizados `richiflix-*`, `window.richiflix`, claves `rf-*` de almacenamiento: **no se renombran**, para no perder datos).
- [ ] **Paso 2:** aplicar; el halo de foco usa el token de foco; Kids usa su acento.
- [ ] **Paso 3:** `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`; comprobar que el `.wgt` conserva `Richiflix1.Richiflix`.
- [ ] **Paso 4:** en el TV (cuando Richard lo indique): icono en el lanzador, cabecera, perfiles, loader, fila con foco y reproductor; capturas en `artifacts/kingdom-*.png`.

---

## Verificación final (por mí, tras la ola 3)

- `npm test` (todas las nuevas), `npm run build`, `npm run build:tizen`, `npm run test:tizen`.
- TV: `npm run measure:tv` ×3 → P50/P95 no peores que §11 del plan de rendimiento; capturas de los criterios de éxito del spec (columna fija en 0/1/6/20 Derecha y vuelta; búsqueda «brekin bad» y título ausente; serie con episodios en español; reproductor: foco nunca en la barra, saltos acumulados, siguiente episodio, saltar intro aprendido en el segundo episodio, panel de idioma; TV en vivo sin símbolos raros; marca Kingdom).
- Actualizar el spec con una sección «Resultado» y este plan con las desviaciones.

## Autorrevisión del plan

- **Cobertura del spec:** §1 → A1–A3 (incluye degradados); §2 → B1–B3; §3 → C1–C3; §4 → D1–D3; §4.1 → D4; §4.2 → D5; §5 → F1–F2; §6 → E1–E2; §7 → G1–G2. Sin huecos.
- **Nombres consistentes entre tareas:** `anchoredRailOffset`/`railTailSpace`/`RAIL_PEEK_PX` (A1→A2); `fuzzyMatches`/`suggestNames` (B1→B3); `tmdbSearch` (B2→C3); `mergeSeasonEpisodes`/`tmdbSeason`/`useSeasonMetadata` (C1→C3); `createSeekAccumulator`/`playerKeyAction`/`adjacentEpisode` (D1→D3, E2); `learnIntro`/`introWindow`/`shouldOffer` (D4); `episodeState`/`seasonProgress`/`nextToWatch`/`continueWatchingEntries` (D5); `trackName` (E1→E2); `cleanName`/`titleCase` (F1→F2).
- **Enfoque de revisión:** los cinco casos tienen prueba en A1, B1, C1, D1 y F1.

## Resultado y desviaciones (8 oct 2026)

- Olas 1–3 integradas en `main` (`2a3cfd5`): A, B, C, D, E, F, G; informes en `docs/plans/informe-{A..G}.md`. 362 pruebas; `build`, `build:tizen`, `test:tizen` en verde; subido a `origin/kingdom-main`.
- Verificación final en el **55"** (el 65" tiene IndexedDB colgado a nivel de dispositivo): columna fija confirmada (x=80 constante), TV en vivo con nombres limpios, marca Kingdom; `measure:tv` ×3 → P50 100–118 / P95 147–178 ms (fase de traza, 350 ms) frente a 94–99 / 144–152 de §11 en el 65"; capas 88 frente a 67. Detalle en la sección «Resultado» del spec.
- Desviaciones: G1 se hizo con Codex en Orca (ronda 2, Solaria); D4 usa marcas aprendidas por serie (no hay fuente de créditos); F1 se validó con 103 nombres de muestra y después con el catálogo real en Node (<40 ms para 8405 canales); C3 resuelve `tmdbId` con `tmdbSearch`; no se hicieron smokes de Playwright/Electron.
- Pendiente: capturas del reproductor y de la búsqueda en el TV; revisar las 21 capas nuevas de A si hay que recuperar la latencia de §11.
