# Informe · Loader con la corona saltando y cursor de salto con OK

Ejecución del plan `docs/plans/2026-10-08-plan-loader-animado-cursor-salto.md` (8 oct 2026), tareas 1 → 5, una por commit, con `npm test` en verde en cada una (368 pruebas al final).

## Antes de empezar

El worktree se creó sobre `7f1b4ad` (historia de `origin/main` en GitHub, sin el plan ni la marca Kingdom). Lo reapunté a `main` local (`8e8ddc9`) con `git reset --hard main`, sin cambios que perder. Base de la rama: `8e8ddc9`.

## Qué se hizo, por tarea

**1 · Frases del reino** (`src/loaderPhrases.js` y su prueba). Hay 15 frases de 44 caracteres como máximo, todas terminadas en «…», y `loaderPhrase(tick)` las recorre en ciclo.

**2 · `KingdomLoader` en el arranque** (`src/Brand.jsx`, `src/Boot.jsx`, `src/style.css`, `src/brandNames.test.js`).
- El componente lleva el glifo, una sombra elíptica, el estado real y la frase. La frase usa `key` para que el fundido se repita en cada cambio.
- Boot sustituye `.boot-orbit` y el `<p>` por el loader. Un intervalo de 2,5 s avanza la frase y sólo corre mientras no está `ready`.
- CSS: `kingdom-bounce` (aplastar, estirar, subir), `kingdom-shadow`, `kingdom-phrase` y `kingdom-pulse` para `prefers-reduced-motion`. Sólo animan `transform` y `opacity`. Se quitaron las dos reglas de `.boot-orbit`; `boot-spin` se queda porque lo usa `.focus-info-loader`.
- Comprobación visual en PC (`npm run build` + `npm run preview` + Playwright, sólo la captura): `artifacts/loader-boot-pc.png` muestra la corona en lo alto del salto con la sombra encogida; `artifacts/loader-boot-pc-reduced.png` la muestra quieta en el suelo con la sombra visible y el texto legible. La transformación medida con movimiento fue `matrix(0.99,0,0,1.02,0,14)` (en pleno salto) y con movimiento reducido `translateY(42px)` fijo. `artifacts/` está en `.gitignore`, así que las capturas no van en el commit.

**3 · El acumulador recuerda el último destino** (`src/seekAccumulator.js` y su prueba).
- Una ráfaga nueva parte de `lastTarget` (aplicado pero sin confirmar) en lugar de la posición que informa el vídeo.
- Se añaden `settle()`, que olvida el destino cuando llega `seeked`, y `pending()`, que expone el cursor mientras no se aplica.
- Las pruebas antiguas siguen en verde sin tocarlas.

**4 · OK confirma, Volver cancela** (`src/playerKeys.js` y su prueba). `playerKeyAction` acepta `pending`:
- Con el foco en el vídeo, `Enter` devuelve `commitSeek` y `Escape` devuelve `cancelSeek`.
- Con el foco en los botones, `Escape` devuelve `cancelSeek`.
- Sin cursor, todo sigue como antes.

**5 · Cursor en el reproductor y loader de la corona** (`src/Player.jsx`, `src/playerControls.css`, `src/style.css`).
- El acumulador se crea con `applyMs:2000` en TV y con 0,4 s en PC. La línea se movió debajo de la declaración de `tv`.
- `onApply` ya no vacía `scrub`: el reloj enseña el destino hasta `seeked`. `settled()` se llama desde el `seeked` de AVPlay y desde el `onSeeked` del `<video>`. `cancelSeek()` vacía el cursor.
- Las teclas pasan `pending:Boolean(pendingSeek)` y tratan `commitSeek` (llama a `flush`) y `cancelSeek`. Dialog sólo cierra con Escape si nadie hizo `preventDefault`, y `cancelSeek` sí lo hace, así que Volver no cierra el reproductor.
- `.seek-cursor` sobre la barra muestra la hora de destino en grande, el delta («+10 s», «+1:40») y «OK para saltar» en TV, con el arte del título al 18 % de fondo. Entra con `transform`/`opacity` en 0,12 s y no anima con `prefers-reduced-motion`.
- El loader del reproductor es `KingdomLoader`, con frase rotatoria cada 2,5 s mientras `loading`.
- Se borraron todas las reglas de `.cinema-loader` (ya no la usa nadie), `.player-loading svg` y las reglas muertas de `.player-loading span`. Se añadieron los tamaños de la etiqueta y de la frase dentro de `.player-loading`. También se borró `.seek-preview.seek-pending`.

## Desviaciones respecto al plan

1. **`loaderPhrase(-1)`**: la fórmula del plan devolvía la última frase, pero su propia prueba espera la primera. La interfaz dice que `tick` es ≥ 0, así que un valor negativo o inválido se trata como 0: `LOADER_PHRASES[Math.max(0,Math.floor(Number(tick)||0))%n]`.
2. **Sombra sin `filter:blur(3px)`**: las reglas del encargo prohíben `blur`. La sombra usa `radial-gradient(closest-side, rgba(var(--accent-rgb),.34), transparente)`, que da el mismo borde suave sin filtro. La prueba de la Tarea 2 no se tocó: el CSS final cumple las dos expresiones regulares.
3. **`accumulator.current.settle()` al cambiar de ítem**: se añadió en el efecto que reinicia el reproductor (junto al `cancel()` existente). Así un destino sin confirmar de un episodio no se arrastra al siguiente.
4. **`role="status" aria-label="Cargando vídeo"` se conserva en `.player-loading`**: el plan lo quitaba, pero `scripts/tizen-smoke.mjs` exige exactamente un `status` con ese nombre. `KingdomLoader` lleva su propio `role="status"` con el título, y no coincide.
5. **`scripts/tizen-smoke.mjs` (fuera de la lista de archivos permitidos)**: las líneas 69–71 comprobaban `.cinema-loader` (radio de 50 % y su `img`). Ahora comprueban la misma idea sobre el loader nuevo: `.player-loading .kingdom-loader-shadow` con radio de 50 % y `.player-loading .kingdom-loader-stage img` con `kingdom-glyph.svg` cargado. Sin este cambio `test:tizen` no podía pasar con la Tarea 5 tal como está escrita.
6. **Comprobación de `item.image`**: el `grep` indicado no devuelve nada, porque el ítem del reproductor se construye como `{...item,url,siblings}` en `App.jsx`. Los ítems del catálogo traen `image` (`xtream.js:58`) y `poster` no llega al reproductor, así que se usa `item.image` y el cursor sale sin arte si no hay imagen.
7. **Rotación de la frase en PC**: sin fuente configurada, el arranque en PC dura unos 2 s, así que la captura no puede mostrar dos frases distintas. La rotación cada 2,5 s queda para el TV (punto 1 de la verificación final).

## Pruebas y builds

- `npm test`: 368/368.
- `npm run build`: OK.
- `npm run build:tizen`: OK (WGT sin firmar en `artifacts/`).
- `npm run test:tizen`: **OK**, con una condición. El smoke necesita una fuente predefinida (`VITE_DEFAULT_SOURCE`, que vive en `.env.local`, ignorado por git y ausente del worktree). Sin ella falla en la línea 48 («Principal… sin login») también en `main` y en `8e8ddc9`: es un fallo previo, no de este trabajo. Se pasó con una fuente ficticia por variable de entorno del proceso (`{"host":"http://ebxvip.xyz:8080","username":"smoke","password":"smoke"}`; el smoke intercepta todo ese host), sin tocar `.env.local`. Después se reconstruyó el WGT sin esa variable. El smoke regenera `player-loader-preview.png` y `tizen-player-preview.png`; se restauraron para no mezclarlos en el commit.

## Pendiente de verificar en el TV

Lo de la sección «Verificación final en el TV» del plan, más:

- **Tamaño de la corona en el reproductor**: el plan fija el glifo en 64 px. En la captura del smoke (1920×1080) se ve bastante más pequeña que el círculo anterior (unos 140 px). Si en el 55" resulta corta, la opción barata es `.player-loading .kingdom-loader-stage{transform:scale(1.5)}` (sólo `transform`, sin relayout).
- **Dos saltos de AVPlay en cola** (anotado con `ponytail:` en `Player.jsx`): cualquier `seeked` confirma. Si se aplica un segundo destino mientras AVPlay aún resuelve el primero, `avplay.js` lo pone en cola y emite `seeked` al terminar el primero. Una pulsación en ese hueco parte del primer destino, no del encolado. Con el auto-salto a 2 s sólo ocurre si AVPlay tarda más de 2 s en un salto. Revisarlo en el punto 3 de la verificación final y, si aparece, exponer `seeking` desde `avplay.js` (archivo fuera de este encargo).
- **Primera pulsación con arte**: la `<img>` del cursor pide `artworkURL(item.image)`, normalmente ya en caché por la tarjeta. Comprobar en la traza del punto 5 que no aparece un `Decode Image` grande en la primera tecla. Si aparece, quitar el arte en TV.
- **Latencia tecla → cursor** (P95 ≤ 120 ms), **un solo `seekTo` con OK**, **Volver con cursor** y **loader sin `Layout` por cuadro**: puntos 2–5 del plan.
