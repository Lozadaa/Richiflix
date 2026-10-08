# Informe · Bloque B (búsqueda y estados vacíos)

Rama `kingdom-B-busqueda`, 8 oct 2026. Base `11935a4` (main con A, C y F). Sin tocar el TV.

| Commit | Tarea |
|---|---|
| `f7347c1` | B1 coincidencia aproximada en el worker |
| `ed8444e` | B2 TMDB para títulos ausentes y alternativas de género |
| `38401b3` | B3 componente EmptyState y sus usos |
| `8e459b1` | Correcciones de la revisión final |

## Por tarea

### B1 · coincidencia aproximada en el worker
- `src/fuzzySearch.js`, puro y sin dependencias:
  - **`normalizeQuery`**: NFD sin marcas, minúsculas, cualquier signo pasa a ser un espacio.
  - **`scoreMatch`**: 1 exacto; 0,8 prefijo de frase o de palabra; 0,7 todas las palabras por prefijo; 0,6 − 0,075·(ediciones), con mínimo 0,45, cuando cada palabra está a ≤ 2 ediciones de Damerau-Levenshtein (≤ 1 si la palabra tiene ≤ 4 letras; las de ≤ 2 sólo por prefijo); trigramas con Dice ≥ 0,3, con tope 0,55.
  - **`fuzzyMatches`** (40 como máximo, mínimo 0,45) y **`suggestNames`** (5 nombres distintos).
  - **`fuzzySearch`**: una sola pasada que da las coincidencias y las sugerencias a la vez.
- **Enfoque de revisión 2:** las palabras de consulta que son códigos de episodio (`1x03`, `S01E03`) o etiquetas de calidad o idioma (`HD`, `LAT`…) no cuentan al puntuar. «Los Simpson 1x03» encuentra «Los Simpson» con 1, y «¿Qué Pasó Ayer?» da `que paso ayer`. Ningún signo produce un error.
- **Índice:**
  - La distancia se calcula contra el **vocabulario** de palabras distintas del catálogo, no registro a registro.
  - Los trigramas van en un **índice invertido** (`gram → posiciones`).
  - Un solo cálculo de programación dinámica, con filas `Int32Array` reutilizadas, da la distancia completa y la distancia a un prefijo.
  - El índice se guarda en un `WeakMap` por array de registros. El worker lo construye con `setTimeout(0)` tras `indexSearch`, mientras el usuario todavía escribe.
- **Worker:**
  - Método nuevo `fuzzy` (`catalogueWorkerProtocol`); la categoría se aplica como predicado.
  - El registro ligero lleva `clean` = `displayTitle(item)`, el nombre limpio de F.
  - `catalogueIndex.fuzzy(items, query, {signal, category})` usa el worker y, sin worker, el mismo cálculo en el hilo.
  - `useCatalogueSearch` expone `fuzzy` y `suggestions` sólo cuando no hay exactos. El plan decía < 5; ver la revisión final.
- **Pruebas:**
  - `fuzzySearch.test.js` (5): las tres del plan más puntuaciones y el límite de 40.
  - `catalogueWorker.test.js` (+1): `fuzzy` con categoría y con el índice ausente.
  - `catalogueIndex.test.js` (+1): `fuzzy` con worker y sin él.
  - La prueba del plan falló primero por módulo inexistente.

**Presupuesto (≤ 60 ms por consulta en el worker sobre 27.000 títulos).**
- **Medición:** en PC (Node 25, el mismo `createCatalogueWorkerService` que corre en el worker), con los 27.000 títulos de `scripts/virtual-catalogue-fixture.jsx` (`Película de prueba N`: 27.000 palabras distintas en el vocabulario, el peor caso para la distancia). 7 consultas × 7 repeticiones:

| Consulta | Mediana | Máx. |
|---|---|---|
| `brekin bad` | 3,1 ms | 10,4 ms |
| `pelicula de prveba 123` | 8,4 ms | 28,2 ms |
| `prueva 99` | 2,4 ms | 2,6 ms |
| `simson` | 2,0 ms | 3,3 ms |
| `zzzz` | 1,6 ms | 2,0 ms |
| `la casa de papel` | 3,1 ms | 3,2 ms |
| `pelcula` | 2,3 ms | 2,4 ms |
| **Global** | **P50 2,6 ms** | **P95 10,4 ms · máx. 28,2 ms** |

- **Primera versión:** puntuaba registro a registro y daba 140–260 ms; por eso se reescribió con el vocabulario y el índice invertido.
- **Construcción del índice:** 106 ms una vez por catálogo, fuera de la consulta.
- **TV:** no medido (prohibido tocarlo). Si el Samsung es entre 4 y 6 veces más lento, la estimación es P95 de 40–60 ms y construcción de 0,4–0,6 s. **Hay que confirmarlo en el TV.**

### B2 · TMDB para títulos ausentes y alternativas de género
- **`tmdbSearch(query, token, fetcher)`** en `src/metadata.js`:
  - `search/multi`, `es-ES`, `include_adult=false`; sólo películas y series, sin adultos.
  - Devuelve `{tmdbId, type, title, originalTitle, year, genreIds, genres, poster}`, con el póster validado (`w342`).
  - Los nombres de género salen de `genre/movie|tv/list`, que se pide una vez por token y fetcher. Si falla, no se guarda en caché.
  - Nunca lanza: devuelve `[]`.
- **Camino del token**, igual que el `season` de C: el token sólo vive en el backend. Afecta a `browserXtreamBackend.js`, `catalogueWorkerProtocol.js`, `xtreamClient.js` y, en Electron, a `xtream-store.cjs`, `main.cjs` (`xtream-tmdb-search`) y `preload.cjs`.
- **`src/searchSuggestions.js`:**
  - **`genreAlternatives({tmdbResult, collections, limit=12})`:** toma por turnos las colecciones cuyo nombre o etiqueta coincide con un género TMDB (sin tildes, quitando «Lo mejor de … · TMDB»; «Action & Adventure» también cuenta como «Action» y «Adventure»), sin duplicados y con 12 como máximo. Acepta `items` como función, así las categorías sólo se filtran si su nombre coincide.
  - **`useTmdbSuggestion(query, enabled)`:** debounce de 500 ms, una petición en vuelo (las siguientes esperan), caché `Map` por consulta normalizada con 50 entradas como máximo.
- **App:** sólo se consulta cuando `!isKids && 0 exactos && fuzzy < 3 && consulta ≥ 3`. Las colecciones candidatas son las `smartCollections` del tipo del resultado más las categorías del proveedor (perezosas).
- **Pruebas:**
  - `tmdbSearch` con fetcher simulado: forma, idioma, consulta, filtros, una sola carga de géneros, sin token y con error.
  - Backend del worker con el token guardado.
  - `genreAlternatives`: el caso del plan [18, 80] con «Drama» y «Crimen», géneros desconocidos, sin nombres, `&`, `null` y la carga perezosa.

### B3 · `EmptyState` y sus usos
- **`src/EmptyState.jsx` y `src/emptyState.css`:**
  - Ilustración de `public/artwork/categories` (240 px en TV), título de 32 px y texto de 22 px en TV; botones normales, sin animaciones.
  - El primer botón toma el foco al montarse en TV **sólo si el foco estaba perdido** (`body`).
  - `role="alert"` opcional.
- **Usos:**
  - **Búsqueda sin exactos** («No encontramos "…"»):
    - Botones «¿Quisiste decir…?» con las `suggestions` (llaman a `setQuery`).
    - «Buscar en todo el catálogo» si había sección, categoría o colección.
    - «Limpiar búsqueda».
    - Debajo, la fila «Parecidos a "…"» (`fuzzy`) y la tarjeta TMDB «"X" no está en tus fuentes» (póster, tipo · año · géneros) con la fila «Del mismo género en tu catálogo».
    - Enter desde la caja de búsqueda enfoca la primera acción.
  - **Filtro sin títulos:** «Ver todas» y las 3 categorías con más títulos. Con «Todas» ya elegida (caso Kids), «Volver al inicio».
  - **Mi lista vacía:** «Explorar películas» y la fila «Mejor valoradas» (`TMDB_BEST` de películas).
  - **Error de fuente:** «No pudimos cargar tus fuentes», el mensaje, «Reintentar» (`catalogue.refresh(true)`) y «Ajustes», con `role="alert"`.
  - **LiveHub sin eventos en vivo ni próximos hoy:** «Ver los de mañana» (enfoca la fila Mañana) o «Ver canales» (enfoca la cuadrícula), y «Ver todo» si hay una categoría elegida. Sin filas ni canales: «Sin señales en esta categoría».
  - «Continuar viendo» vacío ya no aparecía (`row()` devuelve `null`).

**Verificación en la fixture headless** (build de Tizen, 1920×1080, Xtream simulado conectado desde Ajustes, TMDB simulado; sólo lecturas, teclas sintéticas del mando y capturas; script y capturas en el scratchpad, no versionados).

Contenido de los estados:

| Estado | Título | Acciones |
|---|---|---|
| Búsqueda «fixtre movi» (Películas) | No encontramos "fixtre movi" | Fixture Movie · Buscar en todo el catálogo · Limpiar búsqueda; fila «Parecidos a» con Fixture Movie |
| Búsqueda «Breaking Bad» (Series) | No encontramos "Breaking Bad" · "Breaking Bad" no está en tus fuentes | Buscar en todo el catálogo · Limpiar búsqueda; fila «Del mismo género» con Fixture Show |
| Filtro vacío (Kids, Películas) | No hay títulos para esta edad | Volver al inicio |
| Mi lista | Tu lista está vacía | Explorar películas |
| Error de fuente (Xtream 500 + Actualizar) | No pudimos cargar tus fuentes | Reintentar · Ajustes (`role=alert`) |
| TV en vivo sin eventos | Hoy no hay más eventos | Ver canales |

Navegación con el mando:
- **Búsqueda:** chips → Abajo → primer botón del vacío; Abajo → tarjeta de «Parecidos»; Arriba → vuelve al primer botón del vacío; Volver → cabecera (Películas). Enter en la caja → primera acción.
- **TV en vivo:** chip «Todo» → Abajo → «Ver canales»; OK → tarjeta del canal.
- **Kids:** cabecera → Abajo → «Filtrar» → Abajo → «Volver al inicio».
- **Errores de página:** 0.

## Verificación
- `npm test`: **332/332**. Base al empezar: 319/319; +13 pruebas.
- `npm run build` y `npm run build:tizen`: OK. Vite mantiene el aviso de chunks > 500 kB.
- `npm run test:tizen`: «Tizen smoke OK».
  - **Necesita una fuente de fábrica.** El smoke espera la fuente principal «sin login», que en este worktree no existe porque `.env.local` no está versionado.
  - **Fuente ficticia, sin credenciales reales.** No copié credenciales: lo ejecuté con `VITE_DEFAULT_SOURCE` apuntando a `http://ebxvip.xyz:8080` con `fixture-user`/`fixture-password`, que el smoke intercepta. Después recompilé Tizen sin esa variable.
  - Restauré los PNG versionados que reescribe el smoke.
- `node --check` de los `.cjs` de Electron: OK. Sin smoke de Electron.

## Desviaciones (decisiones tomadas)
1. **`search` sigue devolviendo un array y `fuzzy` es un método aparte.** El plan pedía que `search` devolviera `{items, fuzzy, suggestions}`. Separarlo no rompe a los consumidores ni las pruebas existentes, y el protocolo ya nombraba el método `fuzzy`. El hook expone `search.fuzzy` y `search.suggestions` como pedía el plan. Si se equivocara: unas líneas de adaptación.
2. **Los códigos de episodio y las etiquetas de calidad o idioma se ignoran al puntuar.** Es la forma de cumplir el enfoque de revisión 2: «Los Simpson 1x03» encuentra el título y no da error.
3. **La distancia también compara contra un prefijo** de la palabra del catálogo (es una errata a medio escribir: «brekin» ≈ «breaki»). Lo pide la prueba del plan («brekin bad» → Breaking Bad).
4. **Archivos fuera de la lista de B:**
   - Cableado de `tmdbSearch` (token sólo en el backend): `browserXtreamBackend.js` (+test), `xtreamClient.js` y Electron (`xtream-store.cjs`, `main.cjs`, `preload.cjs`), una línea en cada uno.
   - `src/useRemoteNavigation.js` y `src/CategoryChips.jsx`, dos selectores, sin los cuales Abajo desde los chips no llegaba nunca a un vacío sin filas (lo que el plan pide verificar):
     - Abajo desde los chips prefiere `.empty-state-actions button`.
     - Arriba desde una fila dentro del vacío vuelve a sus acciones.
5. **`useTmdbSuggestion` vive en `searchSuggestions.js`** y no en `App.jsx`, para no crear otro archivo ni engordar App. En App sólo hay tres líneas junto a la búsqueda.
6. **Sin TMDB en Kids.** No se muestra un póster de un título ausente que podría no ser apto.
7. **Los parecidos sólo se calculan y se muestran con 0 exactos.** El plan decía < 5. Mezclarlos con 1–4 exactos confundiría el recuento «N resultados», y calcularlos sin mostrarlos alargaba «Buscando…» (revisión final, Important 4).
8. **Autofoco de `EmptyState` sólo con el foco perdido.** El plan dice «el primero recibe el foco al montarse en TV»; robarlo desde la caja de búsqueda o un chip rompería la escritura y Abajo desde los chips.
9. **«Mejor valoradas» en Mi lista** es la colección TMDB de películas (`TMDB_BEST`). Sin token TMDB o en Kids, la fila no aparece y queda sólo «Explorar películas».
10. **Ilustración con `<img>` simple, no `QualityImage`.** `QualityImage` se posiciona en absoluto y tapaba el texto (visto en la primera captura).

## Revisión final

La hizo un revisor independiente con contexto limpio. No encontró nada crítico.
- **Enfoque de revisión 2:** lo comprobó ejecutando `fuzzySearch` directamente.
- **Distancia de edición:** la comparó con una implementación de referencia en 200.000 casos aleatorios y no hubo ninguna diferencia.
- **Seguridad del token y cola de TMDB:** correctas.

Corregí los cuatro Important en `8e459b1`. Cada uno fallaba en la fixture o en una prueba unitaria antes de la corrección y pasó después:
1. **Con un error de fuente sobre un catálogo en caché, Abajo desde los chips saltaba hacia arriba**, a «Reintentar». Ahora el vacío de error (`role=alert`) queda fuera de esos selectores. Fixture: antes «Reintentar»; después, la tarjeta de la cuadrícula.
2. **Tras «¿Quisiste decir…?» o «Buscar en todo el catálogo», el foco caía en `body`.** Ahora, en TV, el foco sigue a la nueva búsqueda: primera tarjeta o primera acción. Fixture: antes `BODY`; después, `card-open`.
3. **«"X" no está en tus fuentes» podía ser falso.** Ahora `catalogueMatch` busca el resultado TMDB en el catálogo por `tmdbId` o por título y título original. Si está, se muestra la fila «En tu catálogo: "X"». Prueba unitaria y fixture: antes «"Fixture Show" no está en tus fuentes»; después, «En tu catálogo: "Fixture Show"».
4. **El difuso se calculaba con 1–4 exactos sin mostrarse.** Ahora sólo con 0 (prueba unitaria `searchWithFuzzy`).

Menores aplazados (no corregidos):
- «No encontramos "Que paso ayer"» aunque debajo salga el título real con 0,8–1. Habría que subir a los resultados las coincidencias ≥ 0,8 o cambiar el encabezado.
- `useTmdbSuggestion` guarda en caché un fallo (red o sin token) toda la sesión.
- El respaldo sin worker construye y puntúa el índice difuso de forma síncrona en el hilo principal.
- `largestCategories` repite `index.filter` en cada render del filtro vacío.
- La distancia a prefijo con máx. 2 deja pasar coincidencias pobres de 0,45 («matrx» → «Matilda»). Subir `min` a 0,5 o exigir ≤ 1 contra prefijo.
- En Mi lista vacía con la fila «Mejor valoradas», Abajo desde la cabecera va a la fila y se salta «Explorar películas».

## Lo que dejé fuera
- **Resolver `tmdbId` por título y año en `useSeasonMetadata` (C3).** No es una línea: hay que compartir una promesa entre los dos trabajadores de la cola y guardar el id en el almacén de metadatos. `tmdbSearch` ya está disponible en `xtreamClient().tmdbSearch(title)`, con `type` y `year` para elegir el resultado.
- **Medición en el TV** del presupuesto de 60 ms y de la construcción del índice.
- **`scripts/pc-experience-smoke.mjs` queda desactualizado** (smoke prohibido; no está en mis archivos):
  - Espera el texto exacto «Sin resultados.».
  - Busca un único botón «Limpiar búsqueda», pero ahora hay dos: el de la cabecera y el del vacío.
- **Filtro vacío en adultos con acciones de categoría.** No se pudo capturar con la fixture: la app vuelve a «Todas» cuando la categoría elegida desaparece del catálogo. Se capturó el caso Kids.
- **Arriba desde la primera fila de un LiveHub** sigue yendo a los chips, sin pasar por el vacío; es el comportamiento previo de L3.
