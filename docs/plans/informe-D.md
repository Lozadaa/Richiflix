# Informe · Bloque D (reproductor por mando, saltar intro y capítulos vistos)

Rama `Lozadaa/kingdom-D-reproductor`, 8 oct 2026. Base `11935a4` (main con A, C y F). Sin tocar el TV.

| Commit | Tarea |
|---|---|
| `42d3b3f` | D1 acumulador de saltos |
| `5f8ce67` | D2 teclas sin barra |
| `d61b37a` | D3 fila de botones y siguiente episodio |
| `8624991` | D4 saltar intro |
| `51dbdeb` | D5 capítulos vistos |
| `f49c0f7` | D2 smoke Tizen con Volver al vídeo (autorizado por Richard durante la sesión) |

## Por tarea

### D1 · acumulador de saltos
- `src/seekAccumulator.js`: `createSeekAccumulator({steps,windowMs,applyMs,repeatMs,schedule,cancel,now})`.
  - `press(direction,{position,duration,repeat})` → `{target,delta,step}`, acotado a `[0, duration−1]`.
  - Una ráfaga suma 10 → 30 → 60 → 120 s por pulsación seguida (< 600 ms). Si se mantiene la tecla, cuenta un `repeat` cada 250 ms; los demás devuelven `null`.
  - Cambiar de sentido o esperar más de 600 ms empieza una ráfaga nueva.
  - `onApply(fn)` llama una vez por ráfaga, 400 ms después de la última pulsación, con `(target, burst)`.
  - `flush()` aplica al instante y conserva la ráfaga, así que la siguiente pulsación sigue acelerando sin sumar dos veces. `cancel()` la descarta.
- `naturalCross({previous,position,duration})` cubre el enfoque de revisión 4: la tarjeta «Siguiente episodio» sólo aparece si la reproducción entra en los últimos 30 s. Un salto que aterriza ahí no cuenta.
- Cifras: 2 minutos cuestan **4 pulsaciones** (10+30+60+120 = 220 s) o **750 ms mantenido**; el spec pide ≤ 4 pulsaciones o ≤ 2 s.
- TDD: el módulo inexistente falló primero; 5 pruebas en verde.

### D2 · teclas sin barra
- `src/playerKeys.js`: `playerKeyAction({key,focus,repeat,seekable,chromeVisible})`, con una aserción por fila de la tabla del plan.
  - Desde el vídeo: Izquierda/Derecha → `seek` (si hay rango), Abajo → `focusButtons`, OK → `focusButtons` (más `togglePlay` si los controles ya se veían), Volver → `close`.
  - Desde los botones: Izquierda/Derecha → `moveButton`, Arriba/Volver → `focusVideo`.
  - Cualquier otro foco (por ejemplo la barra) → `focusVideo`.
  - MediaRewind/MediaFastForward → `seek` con `now`. En directo sin DVR, `null`.
- `src/Player.jsx` (sólo TV):
  - Nuevo camino de teclas; la fila se recorre en orden del DOM y no se lee `getBoundingClientRect` por tecla.
  - La barra tiene `tabIndex=-1` y `aria-hidden`. Si recibe el foco (por ejemplo con el puntero), lo devuelve al vídeo.
  - Mientras se acumula, la barra muestra el destino («+1:40 · 0:59») y el reloj el tiempo destino.
  - El camino de PC no cambia; quité las ramas `tv` que habían quedado muertas en él.
- `src/platform.js`: algunos firmwares no marcan `repeat` al mantener una tecla. Una segunda pulsación de la misma tecla en menos de 180 ms, sin `keyup` entre medias, se trata como `repeat`.
- **Fixture headless** (página temporal en el scratchpad con el `Player` real; sólo lecturas y capturas): **30 teclas aleatorias** de {Izq, Der, Arriba, Abajo, OK, Volver} en cada motor.
  - **video/hls.js** (Electron): **0** veces el foco en la barra, 0 errores. Destinos: vídeo 15, Play/Pausa 8, ±10 6, Siguiente 1.
  - **AVPlay simulado** (Tizen, con la normalización de `platform.js`): **0** veces el foco en la barra, 0 errores.
  - Volver sólo se pulsó con el foco en la fila, porque desde el vídeo cierra el reproductor y cortaría la serie.
  - 3 Derecha seguidas produjeron **1** `seeking` y la etiqueta «+1:40 · 0:59» (60 s de vídeo, destino acotado).

### D3 · fila de botones y siguiente episodio
- `adjacentEpisode(seasons, episodeId, direction)` en `src/episodeWindow.js` (+ prueba): cruza temporadas y devuelve `null` en los extremos. Los especiales (temporada 0) sólo avanzan entre ellos.
- Fila de TV en orden del DOM: anterior · reiniciar · −10 · Play · +10 · siguiente · opciones · señal (· ir al directo con DVR). Lo que no aplica no se pinta: en película no hay episodios; en directo no hay saltos ni reinicio.
  - `src/playerControls.css` anula las reglas `order` antiguas de `style.css`/`playerLive.css`; si no, Izquierda/Derecha no coincidirían con lo que se ve.
- `src/NextEpisodeCard.jsx`:
  - Aparece al entrar en los últimos 30 s o al terminar el episodio, y toma el foco.
  - Cuenta 10 s mientras el vídeo corre y al llegar a 0 lanza el episodio.
  - OK lo lanza, Volver la descarta y una flecha devuelve el foco al vídeo.
  - Tras **3** episodios seguidos lanzados por la cuenta atrás sin pulsar teclas, pausa y pregunta «¿Sigues ahí?» (Seguir viendo · Volver al catálogo).
- `App.jsx`:
  - `changeSource({episode})` reutiliza `setPlaying`, así que el diálogo no se cierra.
  - `episodeOrigin` guarda la temporada y el episodio actuales, para que Volver enfoque el último episodio visto.
  - `SeriesEpisodes` pasa las temporadas fusionadas al reproducir.
- **Fallo corregido de paso.** Al cambiar de episodio sin cerrar, la limpieza del efecto guardaba la posición del episodio anterior con el `save` del nuevo. Ahora `save(seconds, id, …)` lleva el id del episodio que se está cerrando. Además el nuevo episodio reanuda desde su propio historial.
- **Fixture:** con el episodio simulado en 27,5 s, la tarjeta no está antes de los 30 s y aparece con el foco en «Empieza en 10». OK cambia a `ep2` con `.player-dialog` todavía montado. Un salto a 50 s no la muestra. Captura `d3-siguiente.png` en el scratchpad.
- `docs/DESIGN.md`: párrafo nuevo en «Player en TV».

### D4 · saltar intro
- **Comprobación de base pública (WebSearch + petición real, 8 oct 2026): existe y se usa como primer nivel.**
  - **TheIntroDB**: `GET https://api.theintrodb.org/v2/media?tmdb_id=…&season=…&episode=…` → `{intro:[{start_ms,end_ms}], recap:[…], credits:[…]}`.
  - Lectura anónima y sin clave. CORS refleja el origen. Límite de 30 peticiones cada 10 s.
  - Ejemplos reales:
    - Breaking Bad T1E1: intro 228,7–246,1 s.
    - Game of Thrones T1E2: intro 0–107 s; `start_ms:null` significa 0.
  - Los plugins oficiales son GPL-3.0. **No encontré términos de uso publicados** para los datos: lo trato como uso personal gratuito y lo anoto como riesgo.
  - **IntroDB** (introdb.app) consulta por IMDb, no por TMDB, y el plugin Intro Skipper de Jellyfin trabaja sobre la biblioteca local. Los descarté.
- `src/introDatabase.js`: `fetchIntro({tmdbId,season,episode})`.
  - Timeout de 4 s; nunca lanza error.
  - Caché propia de 30 días en `localStorage` (`rf-intro-db-v1`, 300 entradas); un 404 también se guarda como «sin datos».
  - `seasonEpisodeNumber` convierte la numeración absoluta del proveedor en la posición dentro de la temporada, igual que C1.
- `src/introMarks.js` (nivel 2, aprendido):
  - `learnIntro` aprende de saltos que salen de los primeros 5 min y cubren entre 30 y 150 s; la marca es la media de las 3 últimas muestras.
  - También `introWindow`, `discardIntro`, `shouldOffer` (desde 15 s antes hasta 1 s antes del final, ≤ 10 s en pantalla, salvo descarte) e `introKey`.
- `src/useIntroSkip.js`: base pública primero; si no tiene nada, la marca aprendida. Si la ventana empieza en el minuto 0 se ofrece como «Saltar resumen»; si la base trae `recap`, también.
  - Cada salto hacia delante que aplica el acumulador enseña la marca.
  - Retroceder (en los primeros 7 min) después de pulsar «Saltar intro» descarta la marca de la temporada.
  - Nunca aparece en películas ni en directo.
- `libraryStorage.js`: campo `intros` (`seriesId:season → {start,end,samples}`) con validación, tope de 200 y el mismo respaldo versionado. Los sobres antiguos cargan `{}`. `useProfileLibrary` expone `setIntros`.
- El botón toma el foco al aparecer. OK salta al final de la ventana y devuelve el foco al vídeo; una flecha o Volver lo descartan.
- **Fixture:** 3 Derecha en el episodio 1 aprendieron `{start:0.8,end:59}`. En el episodio 2 apareció «Saltar resumen» con el foco; OK llevó a 59 s y el foco volvió al vídeo.
- Pruebas: 7 en `introMarks.test.js`, que cubren aprendizaje, media, descarte, `shouldOffer`, la base con `fetcher` simulado y caché, fallos y numeración absoluta.

### D5 · capítulos vistos
- `src/watchProgress.js`:
  - `episodeState` → visto / empezado / sin ver, con minutos restantes y fracción. Desde el **90 %** cuenta como visto sin marca; un «no visto» explícito (`false`) manda.
  - `seasonProgress`.
  - `nextToWatch`: el reciente si no está terminado; si no, el siguiente al último visto; si no, el primero. Los especiales se saltan.
  - `continueWatchingEntries`: una entrada por serie, con «T2 · E5 · Quedan 12 min» o «Siguiente: T2 · E6».
- `libraryStorage.js`: campos `watched` (true/false), `durations` (s), y un campo nuevo, `recent`: por serie, el último episodio con el siguiente. Validación, topes (5000 y 100) y respaldo versionado.
- `Player` guarda la duración y avisa del final. `App.savePlayback`:
  - marca visto al llegar al 90 % o al terminar;
  - guarda `recent` del episodio;
  - un episodio visto vuelve a empezar desde 0.
- `EpisodeList`:
  - Visto: check y título atenuado (0,55).
  - Empezado: barra y «Quedan N min».
  - Siguiente por ver: borde de acento, «Siguiente por ver» y foco inicial al abrir la serie.
  - Cabecera de temporada: «4 de 10 vistos» y check si está completa.
  - **Mantener OK** (`createCardPress`, 500 ms) abre «Marcar como visto/no visto» y «Marcar temporada como vista/no vista». Izquierda/Derecha alternan entre ellas; Volver o Arriba/Abajo cierran. Un OK corto sigue reproduciendo. «No visto» borra también la posición.
- «Continuar viendo» usa `continueWatchingEntries`. La tarjeta muestra la leyenda y su barra, y el panel ampliado la leyenda.
- **Fixture** (lista real con 7+3 episodios):
  - Estados correctos: 2 vistos, 1 empezado («Quedan 12 min»), siguiente «Cáncer» («Siguiente por ver · Quedan 32 min»).
  - Cabecera «2 de 7 vistos».
  - OK corto reproduce; OK mantenido abre el menú con el foco en «Marcar como visto». Marcar el episodio y luego la temporada dio «7 de 7 vistos».
  - Volver cierra el menú y devuelve el foco al episodio.
  - Capturas `d5-lista.png` y `d5-menu.png` en el scratchpad.

## Verificación
- `npm install` (0 vulnerabilidades); base `npm test` **319/319**.
- Final:
  - `npm test` **342/342** (+23).
  - `npm run build` OK.
  - `npm run build:tizen` OK (70 archivos, `.wgt` sin firma).
  - `npm run test:tizen` «Tizen smoke OK».
  - `git diff --check` limpio.
- `test:tizen` reescribe dos PNG versionados; los restauré con `git checkout`.

## Desviaciones
1. **Prueba del plan D1 corregida.** `press(1,{position:3580})` esperaba 3599, pero 3580+10 = 3590 nunca llega al tope. La posición pasa a 3595, con un comentario en la prueba.
2. **MediaRewind/MediaFastForward** usan la misma aceleración, pero saltan al instante (`flush`) en lugar de esperar 400 ms. `test:tizen` comprueba el salto inmediato, y son teclas dedicadas a saltar. Las flechas sí esperan 400 ms.
3. **`scripts/tizen-smoke.mjs` editado** (fuera de mis archivos), **con autorización de Richard en la sesión**. Las líneas 88 y 110 esperaban que Volver desde un botón cerrara el reproductor; el spec §4 dice que vuelve al vídeo. Ahora pulsa Volver, comprueba que el foco está en el vídeo y vuelve a pulsar. El resto del smoke pasó sin cambios.
4. **`.env.local` copiado** desde la copia principal (ignorado por git, sin leerlo ni versionarlo). Sin él, `test:tizen` falla ya en la base `11935a4` («Conecta eterboxtv», sin fuente preconfigurada).
5. **Archivos fuera de lo permitido, sólo para cablear D5:**
   - `src/SeriesDetail.jsx`: reenvía la prop `progress`.
   - `App.jsx`, fuera de las zonas permitidas: la desestructuración de `useProfileLibrary` y la prop `progress` de `SeriesDetail`.
   - `src/interactions.jsx` y `src/ExpandedCard.jsx`: la leyenda, como pide el plan.
6. **`playerKeyAction`** recibe `chromeVisible` en lugar de `live/hasEpisodes`, que la tabla no necesitaba; `live` queda implícito en `seekable`.
7. **`NextEpisodeCard`** lleva la cuenta atrás internamente: `secondsLeft` es el valor inicial y la cuenta se pausa si el vídeo está en pausa.
8. **Campo `recent` en la biblioteca**, que el plan no nombraba. Sin él no hay forma de saber a qué serie pertenece un id de episodio para «Continuar viendo».
9. **«Selector de temporada»**: no existe selector, la lista es continua. El «4 de 10 vistos» va en la cabecera de cada temporada.
10. **Leyenda «T2 · E5 · …»** sólo en las entradas de «Continuar viendo» y su panel. En la fila «Series» harían falta los datos de la biblioteca en cada tarjeta, por contexto. Eso repintaría las tarjetas montadas en cada guardado (cada 5 s) mientras se reproduce.
11. **Caché de TheIntroDB** propia en `localStorage`, no en `persistentMetadataCache`, que no es de D.

## Lo que dejé fuera
- **Nada en el TV.** Faltan `measure:tv` (P50/P95), las capturas del spec en hardware y probar MediaRewind/FastForward mantenidos en el mando real; la regla de 180 ms es una suposición.
- **Créditos de TheIntroDB para la tarjeta.** La base trae `credits.start_ms`. Hoy la tarjeta sale siempre 30 s antes del final; usar esa marca es una línea en `useIntroSkip`/`Player` si se quiere.
- «¿Sigues ahí?» sólo cuenta como interacción las teclas, no el puntero.
- El botón «Idioma y subtítulos» y el panel lateral son del bloque E. La fila conserva «Opciones» con los `select`, y E los sustituirá.
- La fixture del reproductor vive en el scratchpad y no se versiona. Si se quiere reutilizar, conviene llevarla a `scripts/` como fixture de lectura.
- Velocidad, calidad y nombres de pista: sin cambios (bloque E).
