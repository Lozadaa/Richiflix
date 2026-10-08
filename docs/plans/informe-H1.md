# Informe H1 · Banner y luz

Lote H1 de `docs/plans/2026-10-08-plan-inicio-con-vida.md`. Archivos tocados: `src/FocusStage.jsx`, `src/useBannerMotion.js`, `src/bannerFlow.js`, `src/bannerFlow.test.js`, `src/compositorMotion.css` y este informe. `npm test` 367/367, `npm run build` y `npm run build:tizen` en verde (el CSS Tizen sale con `top/right/bottom/left`, sin `inset`). No he ejecutado smokes ni he instalado nada en el TV.

Nota de base: el worktree se creó desde `7f1b4ad` (historia antigua, sin relación con `main`). Como la rama no tenía cambios ni commits, la moví a `main` (`8e8ddc9`, la que tiene el spec y el plan) antes de empezar. Los tres commits van encima de `main`.

## H1-T1 · Ken Burns con perilla y pausa

- `compositorMotion.css`: `.app.tv-mode{--tv-kenburns:1;--tv-ambient:1}` y `@keyframes stage-kenburns` (escala de 1 a 1,06, 9 s, `linear both`, `transform-origin:60% 40%`).
- La animación va sobre la propia capa del fundido, `.focus-stage-visual`, y no sobre la `img`. Así no aparece una segunda capa: la del fundido ya existe. Selector: `.carousel-stage[data-kenburns='true'] .focus-stage-visual[data-artwork-state='ready']:not(.is-next)`. Qué consigue:
  - Sólo se mueve arte ya decodificado. La siguiente diapositiva, montada sin pintar, nunca se mueve.
  - Cuando la capa pasa de `is-current` a `is-out`, la animación sigue (mismo nombre, no se reinicia). La saliente no salta a escala 1 durante el fundido.
  - Cada diapositiva nueva es una capa nueva (`key` = id), así que la animación empieza de cero.
  - Los canales en directo no tienen fondo en el banner (estado `missing`), así que sus escudos no se escalan.
- La perilla se lee una sola vez al montar. `FocusStage` hace `getComputedStyle(.app)` en un `useEffect` y escribe `data-kenburns`. La función pura `knobOn` decide: sólo un `0` explícito apaga. Tiene prueba.
- Pausa: `useBannerCarousel` devuelve ahora `paused` (incluye la pestaña oculta). `FocusStage` acepta `paused` y escribe `data-paused`. El CSS hace `animation-play-state:paused`; la regla tiene la misma especificidad que la del shorthand y va después.
- Con `prefers-reduced-motion` no hay animación.

## H1-T2 · Tinte ambiental

- Funciones puras en `bannerFlow.js`, con pruebas:
  - `hexToRgb`: acepta hex de 6 y de 3 cifras; un triplete `r,g,b` pasa tal cual; cualquier otra cosa da `null`.
  - `ambientSlots(previous, ink, ready=true)` devuelve `{a,b,active}`. Una tinta nueva se escribe en la capa libre y esa capa pasa a activa. La misma tinta devuelve el mismo objeto, así que no hay render ni fundido. Con `ready=false` el tinte se queda como está.
  - Pruebas: alternancia a/b, misma tinta, entrada inválida y el punto 1 del enfoque de revisión («el tinte no cambia antes que la imagen»).
- `FocusStage` calcula `identityStyle(item)` una sola vez. Ese objeto es el `style` del banner y además la fuente de `--identity-ink`, sin recalcularlo. El tinte se resuelve en el mismo render que monta la capa `is-current`, con `ready = currentArrived || !out`. Mientras el arte nuevo no está decodificado, siguen el arte saliente y su tinte. Nunca se toca en `keyDown`. Sólo existe en el carrusel del TV (`carousel && tv`); en el resto de escenarios el banner sigue a la tarjeta y cambiaría con cada tecla.
- Se dibujan dos `<i class="ambient-wash" data-slot="a|b">` con `--wash-ink-rgb` en el `style`. Fondo: `radial-gradient(ellipse …, rgba(var(--wash-ink-rgb),.55), transparent 70%)`. Sólo anima la opacidad, con `--tv-slow`. El color se pinta una vez por cambio de diapositiva, en la capa que está a opacidad 0.
- Con `--tv-ambient:0` los elementos no se renderizan. Es más barato que `display:none`: ni nodo, ni capa.
- **Desviación del spec («60vh, detrás del banner y de la primera fila»):**
  - El banner recorta su contenido (`overflow:hidden; contain:paint`) y su arte es opaco. Un lavado detrás del arte no se vería, y uno de 60vh dentro del banner se corta a 1920×554.
  - Por eso el lavado está dentro del banner, encima del arte y del sombreado (z 2) y debajo del texto (z 3) y de los puntos (z 4).
  - Ocupa sólo la parte derecha (`left:47%`), para no solaparse con la caja del texto (≤ 46 % de ancho). Si se solapara, el texto pasaría a ser una capa propia. El centro del degradado queda donde pide el spec: el 70 % de la pantalla, que es el 43 % de esta caja.
  - Si se quiere que el tinte llegue detrás de la primera fila, hace falta tocar `App.jsx`/`style.css`: una capa hermana de `.page-scene` y la escena transparente. Eso queda fuera de mi lista; ver «Archivos ajenos».
- Se oculta (`visibility:hidden`) mientras suena un tráiler del banner o de una tarjeta.

## H1-T3 · Progreso del punto y entrada escalonada

- Función pura `dotCycle(previous, {slide, paused})`, con prueba. El contador `cycle` sube en cada cambio de diapositiva y en cada reanudación. Una pausa sola no lo cambia (congela el llenado en curso), y un render sin cambios devuelve el mismo objeto. `FocusStage` usa `cycle` como `key` del punto activo, así que el llenado se reinicia.
- Al reanudar, `createBannerCarousel` espera `resumeMs + intervalMs` (2 + 9 s). Por eso el llenado reanudado lleva `is-resumed`, que añade `animation-delay:2s`, y termina justo cuando cambia la diapositiva.
- CSS: `.banner-dots .active:before` es una línea de 32×3 px bajo el punto. Lleva `scaleX(0→1)`, 9 s `linear both`, `will-change:transform` y se pausa con `data-paused`. Uso `:before` y no `:after` porque el botón ya usa `:after` para su anillo de foco. Va ligado a la perilla `--tv-kenburns` (`[data-kenburns='true']`): es «movimiento ambiental» y el spec exige que cada animación nueva tenga perilla. Con `prefers-reduced-motion` no se dibuja.
- `stage-copy-in` con `animation-delay` de 0, 40, 80 y 120 ms en los hijos 1 a 4 del texto: cejilla, `h1` (o el logo), descripción y datos. La duración no cambia. Uso `nth-child`, así que el logo de H1-T4 hereda los 40 ms sin tocar nada.

## Capas nuevas y cómo apagarlas

Elementos **nuevos** con `will-change`, `animation` o `transition` de opacity/transform: **3**.

| Elemento | Qué lleva | Por qué | Tamaño aprox. (1920×1080) | Perilla |
|---|---|---|---|---|
| `.ambient-wash[data-slot=a]` | `will-change:opacity` + `transition:opacity` | Capa fija: el cambio de diapositiva sólo funde la opacidad, sin rasterizar ni crear capas transitorias | 1018×554 ≈ 2,3 MB | `--tv-ambient:0` (no se renderiza) |
| `.ambient-wash[data-slot=b]` | ídem | ídem (la otra mitad del fundido cruzado) | ≈ 2,3 MB | `--tv-ambient:0` |
| `.banner-dots .active:before` | `will-change:transform` + `animation` | Un solo `scaleX` en el compositor | 32×3 | `--tv-kenburns:0` |

Elementos **existentes** que ganan animación (no son elementos nuevos, pero hay que vigilarlos al medir):
- `.focus-stage-visual` (la capa del arte, actual o saliente) con la animación Ken Burns. Antes sólo era capa durante el fundido de 150–180 ms. Ahora es capa mientras dura la animación, que en el Inicio en reposo es casi siempre: 1920×554, ≈ 4,3 MB, y Chromium rasteriza a la escala máxima. **Puede llevar el recuento a 92 si el 55" no contaba ya esa capa en reposo.** Si `measure:tv` da más de 91, `--tv-kenburns:0` quita esta capa y la del punto.
- Hijos 2 a 4 de `.focus-stage-copy`: sólo ganan un `animation-delay`. Ya animaban (`stage-copy-in`), así que no hay capa nueva.

Cómo apagar: en `src/compositorMotion.css`, `.app.tv-mode{--tv-kenburns:0;--tv-ambient:0}` (una o las dos). Desde el inspector: `document.querySelector('.app').style.setProperty('--tv-kenburns','0')` y después volver a montar el banner (salir del Inicio y volver, o recargar), porque la perilla se lee al montar.

## H1-T4 · Logo en el banner (pendiente, depende de H3)

No está implementada. Receta para hacerla tras el merge de H3 (`item.logoImage` y `logoURL` exportada desde `./artwork.js`), todo en `src/FocusStage.jsx` más una regla CSS:

1. Importar: `import {displayTitle,logoURL} from './artwork.js';`.
2. Sitio: en `FocusStage.jsx`, dentro del `<React.Fragment key={item.id}>` de `.focus-stage-copy`, la línea `<h1>{live?channelTitle(item):displayTitle(item)}</h1>` se cambia por `<StageTitle item={item} live={live}/>`. Así queda en el mismo sitio del flujo (hijo 2 de la copia, con los 40 ms del escalonado y el mismo `stage-copy-in`).
3. Decodificar antes de pintar, sin cambiar el `h1` a mitad de diapositiva:
   ```jsx
   const decodedLogos=new Set();
   function decodeLogo(src){if(!src||decodedLogos.has(src))return Promise.resolve();const image=new Image();image.decoding='async';image.src=src;return image.decode().then(()=>{decodedLogos.add(src);});}
   function StageTitle({item,live}){
    const title=live?channelTitle(item):displayTitle(item),src=!live&&item.logoImage?logoURL(item.logoImage):'';
    const [ready,setReady]=useState(()=>decodedLogos.has(src));
    useEffect(()=>{if(!src||ready)return;let alive=true;decodeLogo(src).then(()=>{if(alive)setReady(true);},()=>{});return()=>{alive=false;};},[src,ready]);
    return src&&ready?<img className="title-logo" src={src} alt={title} decoding="sync"/>:<h1>{title}</h1>;
   }
   ```
   Además, en `FocusStage`, junto a la preparación de la siguiente diapositiva: `useEffect(()=>{if(next?.logoImage)decodeLogo(logoURL(next.logoImage)).catch(()=>{});},[next?.logoImage]);`. Con eso, el logo de la siguiente ya está decodificado cuando entra y no hay cambio de `h1` a `img`, que sería un Layout extra después del texto. Si la decodificación falla, el `h1` se queda.
4. CSS en `compositorMotion.css`, o en `titleLogo.css` si H3 ya define la base ahí: `.tv-stage .title-logo{display:block;width:auto;height:auto;max-height:120px;max-width:480px;margin-bottom:14px;flex-shrink:0}`. Sin animación propia.
5. Prueba: si se quiere una unitaria, `decodedLogos`/`decodeLogo` no son puras. Basta con `npm run build` y la captura de las diapositivas 0 y 1 en el TV que pide el spec.

## Archivos ajenos que habría necesitado

1. **`src/App.jsx`, línea ~382 (props de `StageWithMetadata`): añadir `paused={carousel.paused}`.** Una línea. Sin ella `paused` vale `false` y `data-paused` nunca se escribe. Efecto: el Ken Burns y el llenado del punto no se congelan cuando el carrusel se pausa (foco en las filas, ráfaga, diálogo, tráiler, pestaña oculta). El punto llega al final y se queda lleno hasta que cambia la diapositiva. Lo demás funciona igual. El resto del cableado ya está: el hook devuelve `paused`, `FocusStage` lo acepta y el CSS lo aplica.
2. **Opcional, `App.jsx` + `style.css`:** sólo si se quiere que el tinte llegue «detrás de la primera fila», como dice el spec literal (ver la desviación de H1-T2). Habría que poner el lavado fuera del banner recortado y dejar transparente esa zona de `.page-scene`.
3. **Pendiente al medir en el TV:** recuento de capas con el Ken Burns activo (ver la tabla) y `tv-trace-report.mjs` sin `Layout` en los cambios de diapositiva. El tinte sólo cambia la opacidad y la variable de una capa ya montada: es pintura, no Layout.
