# Informe H3 · Metadatos y panel (logo del título)

Rama: `worktree-agent-a6880b450370ae119`, sobre `main` en 8e8ddc9 (ver la nota sobre la base al final).

## Endpoint final

```
GET https://api.themoviedb.org/3/{movie|tv}/{tmdbId}
    ?append_to_response=videos,images,{release_dates|content_ratings}
    &include_image_language=es,null
    &include_video_language=es,en,null
    &language=es-ES
```

Sigue siendo **una sola petición** por título (antes: `videos,{release_dates|content_ratings}`). `images` trae `backdrops`, `posters` y `logos`, pero `include_image_language=es,null` limita las tres listas a español y sin idioma, así que la respuesta crece poco. Sólo se usa `images.logos`; nada más de `images` llega al ítem ni a la caché.

## Cómo se elige el logo: `pickLogo(images)` (`src/metadata.js`)

1. Sólo cuentan los logos cuyo `file_path` es una ruta TMDB simple (`/^\/[\w.-]+\.(png|svg)$/i`).
2. Primero el grupo `iso_639_1 === 'es'`, después el grupo `iso_639_1 === null`. Los logos en inglés u otros idiomas no se usan nunca.
3. Dentro de cada grupo, el primer `.png`; si el grupo sólo tiene `.svg`, el primer `.svg`.
4. `undefined` si `images` falta, si no hay `logos` o si ninguno cumple.

El orden dentro del grupo es el que da TMDB (ya viene ordenado por votos). Pruebas en `src/metadata.test.js`: es antes que null, png antes que svg en el mismo idioma, sólo svg se acepta, vacío/ausente/sólo inglés/ruta inválida dan `undefined`, y `spanishMetadata` sólo guarda `logoImage` si existe.

## Dónde queda `logoImage`

- `spanishMetadata` devuelve `logoImage` (la **ruta** TMDB, p. ej. `/abc123.png`, no una URL), junto a `backdropImage`.
- `loadXtreamVideoDetails` (`src/xtream.js`) ya esparce todo el resultado de `spanishMetadata` en la respuesta de detalles, así que **no ha hecho falta tocar `xtream.js`**.
- La respuesta de detalles pasa por `sourceRegistry.details` → caché persistente (`preview-details.json` en Electron, IndexedDB/worker en el TV) → `publishMetadata` en `metadataStore.js`, que guarda el objeto tal cual. **`metadataStore.js` no ha cambiado**: acepta cualquier campo.
- El ítem que reciben Card, `ExpandedCard` y el banner tiene `item.logoImage` cuando ha llegado la respuesta de detalles.

### Caché y tiempo de refresco

La clave persistente lleva `metadata-v5` (`src/sourceRegistry.js`), y **no se ha subido**. Los títulos ya guardados no tendrán logo hasta que caduque su entrada (`previewMetadataCacheOptions.ttlForData`, `src/persistentMetadataCache.js`):

- con sinopsis en español (lo habitual cuando TMDB responde): **30 días**;
- con datos pero sin sinopsis en español: **7 días**;
- respuesta vacía: 5 minutos.

Además existe la caché en memoria de `sourceRegistry` (160 entradas), que dura lo que la sesión. En la práctica, casi todo lo ya visto se queda sin logo hasta 30 días, y todo lo nuevo lo trae enseguida. Si se quiere el logo ya en lo cacheado, basta con subir a `metadata-v6`, pero eso vuelve a pedir a TMDB todos los títulos según se enfocan. Decide Richard.

## `logoURL` (`src/artwork.js`)

```js
export const logoURL=path=>path?`https://image.tmdb.org/t/p/w300${path}`:'';
```

`artworkURL` no sirve aquí: sólo reescribe el tamaño de URLs TMDB **completas** en jpg/png/webp, y los fuerza a w780 o al tamaño del backdrop. Por eso `logoURL` arma la URL a partir de la ruta. `displayTitle` y `artworkURL` no han cambiado.

## Cómo lo consume el banner (H1)

```jsx
import {logoURL} from './artwork.js';
// item.logoImage → ruta TMDB o undefined
const logo=logoURL(item.logoImage);            // '' si no hay
// decodificar antes de pintar: new Image(); img.src=logo; img.decode().then(()=>setReady(logo))
{logo&&ready===logo?<img className="title-logo" src={logo} alt={title}/>:<h1>{title}</h1>}
```

- La clase base `.title-logo` ya está en `src/titleLogo.css` (alto máx. 120 px, ancho máx. 480 px, `display:block`), importado desde `src/main.jsx`. El banner no necesita importar CSS.
- El logo no tiene animación propia: entra con el `stage-copy-in` del bloque de texto.
- El patrón de referencia es el del panel (`src/ExpandedCard.jsx`): un estado con la URL decodificada, que se compara con la URL actual para que no aparezca el logo del título anterior.

## Panel ampliado (`src/ExpandedCard.jsx`)

- `logo=logoURL(item.logoImage)`. Un `useEffect` con dependencias `[logo, opened]` decodifica (`new Image()` + `decode()`) **sólo con el panel abierto** (regla 5: nada por tecla) y guarda la URL en `logoReady`.
- Se pinta `<img className="title-logo is-panel" alt={title}>` sólo si `logoReady===logo`. Mientras tanto, o si `decode()` falla, queda el `h3` de siempre.
- `.title-logo.is-panel{max-height:72px;max-width:360px}`. Sin `transition`, sin `will-change`, sin capas nuevas.
- Consecuencia visible: al abrir el panel de un título con logo, aparece primero el `h3` y se cambia por el logo en cuanto decodifica (un w300 suele tardar pocos ms si ya está en caché HTTP). Es una sustitución de pintura, no una animación.

## Cambios fuera de la lista de archivos

- `src/ageClassification.test.js`, **una línea**: comprobaba el `append_to_response` exacto (`videos,{release_dates|content_ratings}`) y pasa a `videos,images,…`. Sin este cambio `npm test` falla. No toca código de producción.
- `src/xtream.js`: **sin cambios**. No hace falta, porque `spanishMetadata` ya se esparce en los detalles.

## Verificación

- `npm test`: 363/363 en verde tras cada tarea.
- `npm run build` y `npm run build:tizen`: pasan (wgt sin firmar generado; no instalado).
- No se han ejecutado smokes ni peticiones reales a TMDB (todas las pruebas usan un `fetcher` inyectado).

## Pendientes

- **Tamaño medio de logo**: sin medir, porque no se hicieron peticiones reales. Debe medirse en la integración. Lo esperable para w300 PNG son decenas de KB.
- **SVG en w300**: TMDB sirve los `.svg` también bajo `/t/p/w300/`, pero no está comprobado en el TV. Si un SVG no decodifica en Tizen, `decode()` falla y queda el `h3`, así que no hay riesgo visual.
- **Logos oscuros sobre fondo oscuro**: algunos logos de TMDB son negros. No hay tratamiento (estaría fuera de alcance y no se puede usar `filter`/`mix-blend-mode` en el TV).
- **Títulos ya cacheados**: sin logo hasta 30 días (ver arriba), salvo que se suba la versión de la caché.
- **Banner (H1)**: consumir `item.logoImage` según el apartado anterior.

## Nota sobre la base

El worktree se creó apuntando a 7f1b4ad, una historia sin relación con `main` (sin ancestro común). Como el árbol estaba limpio, antes de empezar moví la rama a `main` (8e8ddc9, el mismo commit que los demás worktrees H). Los commits de H3 van encima de `main`.
