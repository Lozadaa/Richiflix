# Informe · Bloque E (panel lateral de idioma, subtítulos y opciones)

Rama `Lozadaa/kingdom-E-panel`, 8 oct 2026. Base `e84f488` (main con A, B, C, D y F). Sin tocar el TV.

| Commit | Tarea |
|---|---|
| `2e7bb23` | E1 nombres de pista legibles |
| `3c1e63a` | E2 PlaybackSidebar |

## Por tarea

### E1 · nombres de pista legibles
- `src/trackNames.js`:
  - `trackName({language,label,index,kind})` usa `Intl.DisplayNames(['es'])`. Si el navegador no lo tiene, recurre a una tabla corta (es, en, pt, fr, de, it, ja y sus códigos de tres letras).
    - El idioma y la región se nombran por separado: `es-419` → «Español (Latinoamérica)», `pt-BR` → «Portugués (Brasil)».
    - `Intl` sola daría «español latinoamericano», que no es lo que pide el spec.
  - Códigos desconocidos (`und`, `qaa`, `mul`…) usan la etiqueta de la pista. Sin etiqueta: «Pista N» o «Subtítulos N».
  - `trackNames(tracks,kind)` separa los duplicados: con el códec si lo hay («Inglés (AC3)»), y si no con un número («Inglés», «Inglés (2)»).
- `src/avplay.js`: `onTracks(audio, subtitles)` entrega `{index, language, codec}` de las pistas `AUDIO` y `TEXT` (`extra_info.language`/`track_lang`/`fourCC`).
- `src/Player.jsx`: los nombres de hls.js (`lang`/`name`/`audioCodec`), de `textTracks` y de AVPlay pasan todos por `trackNames`.
- TDD: el módulo inexistente falló primero. Hay 4 pruebas nuevas en `trackNames.test.js`, incluida la tabla sin `Intl.DisplayNames`, y 1 nueva en `avplay.test.js`.

### E2 · PlaybackSidebar
- `src/PlaybackSidebar.jsx` + `src/playbackSidebar.css`:
  - Panel derecho de 520 px en TV y 420 px en PC.
  - Las secciones son `role="radiogroup"` y cada opción es un `<button role="radio">`. No queda ningún `<select>`.
  - La opción activa lleva marca y color de acento; la enfocada, fondo dorado.
  - Entra con `translateX(100%)→0` y opacidad en 180 ms, sobre una capa `rgba(16,24,39,.55)`.
  - Sin `backdrop-filter`. Con `prefers-reduced-motion` no hay animación.
- Teclas: `playerKeyAction` admite `focus:'sidebar'`.
  - Arriba/Abajo → `moveOption`; recorre todas las secciones y se detiene en los extremos.
  - Izquierda/Volver → `closeSidebar`.
  - Derecha → nada. OK lo gestiona la opción.
  - Las teclas Media siguen saltando.
  - `Player` aplica estas acciones antes de la ruta D2, igual en TV y en PC.
- Secciones:
  - **Audio**, con más de una pista.
  - **Subtítulos**: «Desactivados» y todas las pistas.
  - **Calidad**: «Automática» y los niveles de hls.js.
  - **Velocidad**, sólo en PC y VOD.
  - **Señal**, en eventos con varias señales.
  - Si no hay ninguna sección: «Esta señal usa su calidad original».
- Botones de la fila:
  - «Opciones de reproducción» pasa a llamarse **«Idioma y subtítulos»** (icono de bocadillo) y abre el panel en Audio.
  - «Señal» abre el mismo panel con el foco en la señal activa. El `.signal-menu` ya no existe.
  - Al cerrar, el foco vuelve al botón que abrió el panel.
- Cableado:
  - Audio: `selectAudio` (AVPlay) y `hls.audioTrack`.
  - Subtítulos: `textTracks[i].mode` en PC. En Tizen, `selectSubtitle(index)` (`setSelectTrack('TEXT')`), y la app dibuja el texto que llega por `onsubtitlechange` (`.player-subtitle`, sin etiquetas HTML) sólo mientras hay una pista elegida.
  - Calidad: `hls.currentLevel`.
- Robustez:
  - Si cambia la fuente (episodio, señal o tecla CH) con el panel abierto, el foco va al vídeo antes de cerrarlo, para que no caiga en `body`.
  - Con error o fin de reproducción el panel no se muestra.
- **D2 sigue cumpliéndose.** El panel es una zona de foco nueva y siempre devuelve el foco al botón. El smoke comprueba que, con el panel abierto, el foco nunca está en `.seek-track input`, y después recorre Volver → vídeo → Volver → cerrar como antes.
- **`scripts/tizen-smoke.mjs` actualizado sin relajarlo.** Antes elegía la pista con Derecha sobre el `select` y cerraba con Volver. Ahora, con el mando:
  1. OK abre el panel con el foco en «Español», la opción activa.
  2. Comprueba los nombres legibles `['Español','Inglés']`, que no haya `select` en el reproductor, ni sección Velocidad en TV, ni volumen.
  3. Abajo dos veces: el foco se queda en la última opción.
  4. OK: «Inglés» queda activa y el panel sigue abierto.
  5. Arriba: «Español» ya no está activa.
  6. Izquierda cierra con el foco en el botón. OK reabre con el foco en «Inglés». Volver cierra con el diálogo intacto.
  7. MediaPlay: AVPlay recibe `setSelectTrack('AUDIO',2)`. Se eligió en pausa y se aplica al reanudar; antes sólo se miraba el valor del `select`.
- Captura del panel abierto (fixture del smoke, sólo lectura): `e2-panel.png` en el scratchpad de la sesión. Se tomó con una línea temporal en el smoke, que retiré después.

## Verificación
- Base: `npm install` (0 vulnerabilidades), `npm test` **355/355**.
- Final:
  - `npm test` **361/361** (+6).
  - `npm run build` OK.
  - `npm run build:tizen` OK (`.wgt` sin firma).
  - `npm run test:tizen` «Tizen smoke OK».
  - `git diff --check` limpio.
- `test:tizen` reescribe `player-loader-preview.png` y `tizen-player-preview.png`; los restauré con `git checkout`.
- `.env.local` copiado desde la copia principal, igual que en D. Está ignorado por git; no lo leí ni lo versioné.

## Desviaciones
1. **`src/platform.js` sin cambios.** El plan pedía quitar el manejo de `SELECT`, pero `SourceManager.jsx` (Ajustes · «Tipo de fuente») todavía usa un `<select>` y lo necesita. En el reproductor ya no hay ninguno, así que ese código no se ejecuta allí.
2. **Elegir una señal cierra el panel.** Cambiar de señal recarga la fuente y rehace la lista de pistas, así que el panel no puede quedarse abierto con sentido. Se cierra con el foco en «Señal», como hacía el menú anterior. Las demás opciones aplican sin cerrar.
3. **Subtítulos en Tizen (añadido).** Antes AVPlay no ofrecía subtítulos. Ahora se listan las pistas `TEXT` y la app dibuja el texto. **Falta verificarlo en el TV real:** el fixture no emite `onsubtitlechange`, y algunos firmwares podrían necesitar `setSilentSubtitle(false)`.
4. **`playerKeyAction`** devuelve `moveOption`/`closeSidebar` como pide el plan. Derecha no hace nada, en lugar de abrir algo.

## Pendiente para quien integre
- **`scripts/pc-experience-smoke.mjs:171`** busca `.signal-menu .signal-option`, que ya no existe. Hay que cambiarlo a `.playback-sidebar [role="radiogroup"][aria-label="Señal"] [role="radio"]`. No lo edité ni lo ejecuté porque está fuera de mis archivos y es un smoke prohibido.
- **CSS sin uso:** `.playback-menu*` en `src/style.css` y `.signal-menu`/`.signal-option` en `src/playerLive.css`. No los borré porque esos archivos no son de E (G trabaja en `style.css`).
- **En el TV (Richard):** cambiar de pista de audio en un título con dos pistas, activar subtítulos en una película con pista `TEXT`, y `measure:tv` para confirmar que abrir el panel no empeora P95.
