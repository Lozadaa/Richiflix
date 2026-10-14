# Recuperación de canales en vivo en PC

Fecha: 14 de octubre de 2026. Rama temporal: `Lozadaa/live-pc-fix`, basada en `main` (`f6a20de`). Sin push, merge ni instalación en TV.

## Causa raíz comprobada

La recuperación de escritorio dependía de errores **fatales** de HLS. `createHlsRecovery.error` descartaba todos los no fatales; después de cuatro reintentos de transporte no renovaba la sesión. El watchdog de salud necesitaba un `waiting`/error previo y su última acción era mostrar el error, no recuperar la fuente. Además, `FRAG_BUFFERED` reiniciaba los intentos aunque no hubiera imágenes nuevas. Por ello una playlist detenida, un transporte agotado o una sesión caducada podían dejar la reproducción sin una vía efectiva de recuperación.

Se comprobó otra condición con el corte real del servidor local: HLS mueve `currentTime` al intentar saltar huecos aunque no presente imágenes nuevas. Contar esos pequeños movimientos como recuperación aplazaba la renovación. El smoke registró buffer vacío, posición alrededor de 51,98 s, 34 errores de transporte, 13 fatales y ninguna recarga del master durante el bloqueo. La supervisión ahora exige avance neto de posición de más de 0,5 s y fotogramas presentados nuevos (`totalVideoFrames - droppedVideoFrames`), si esa métrica está disponible. Para señales sólo de audio o motores sin esa métrica utiliza el avance neto de posición. Oscilar dentro del mismo hueco no restablece el presupuesto.

Esto demuestra defectos de recuperación de la aplicación con fixtures. No demuestra cuál es el disparador concreto del proveedor de Richard: no se utilizaron credenciales reales ni se observó tráfico de producción.

| Hipótesis | Resultado |
| --- | --- |
| Errores no fatales/reintentos agotados sin recuperación superior | Confirmado por código, pruebas puras y fixture de transporte. |
| Playlist detenida / watchdog engañado | Fixture congelado 20 s; además se observó que los nudges de HLS engañaban la medición de posición. La pausa explícita suspende la supervisión; un seek no acredita imágenes nuevas. |
| Caducidad de URL/sesión | Reproducida con HTTP 403 hasta renovar el master; la caducidad del proveedor real permanece sin verificar. |
| Buffer atrasado | Se añade salto a `liveSyncPosition` cuando el bloqueo lleva al vídeo más de 10 s detrás; no se salta por un mero aviso si el vídeo avanza. No se atribuye el incidente real a un límite de buffer sin evidencia. |
| TS/PTS/decoder | Recuperación de errores de append/parsing y MEDIA_ERROR fatal, con fallback de codec, cubierta por node:test. No se reprodujo una discontinuidad real del proveedor. |

## Qué cambia

- `createLiveRecovery`, lógica con reloj y acciones inyectables, supervisa PC HLS cada segundo aunque no se emita un error. A los 10 s muestra el loader; a partir de 12 s reinicia cargas con backoff hasta 8 s; desde 24 s puede renovar la sesión (normalmente alrededor de 27 s, según el último intento).
- Máximo de tres renovaciones por episodio de fallo. Después se entrega el error a `createPlaybackHealth`, manteniendo los controles existentes de «Reintentar» y de señal alternativa cuando están disponibles. Diez segundos de avance sostenido restablecen el presupuesto. El plazo de buffering PC aumenta a 120 s para permitir esa escalada; una fuente inexistente al inicio sigue teniendo el plazo corto.
- MEDIA_ERROR de decoder/append/parsing recibe hasta dos recuperaciones con espera de 1 y 2 s; la segunda utiliza `swapAudioCodec`. Los avisos de buffer, gaps y nudges no reconstruyen el decoder.
- El evento `online` reinicia la carga. Pausa, ocultación y cierre impiden acciones de recuperación; se cancelan timers y se comprueba vigencia antes y después del IPC de renovación.
- `App.jsx` conserva el objeto original del catálogo como `playbackItem`: la URL local `richiflix://…` no cumple la validación del catálogo de Xtream. La recarga solicita otra URL mediante `xtream-playback`, que invalida la sesión anterior del gateway, y vuelve a cargar/adjuntar HLS sin cerrar el diálogo.
- Un único `KingdomLoader` dice «Reconectando…», también cuando la recarga devuelve la posición a cero.
- HLS PC en vivo usa `liveSyncDurationCount: 3`, `maxBufferLength: 20`, `backBufferLength: 30`, `lowLatencyMode: false`. `hlsLibrary.js` sólo importa la biblioteca; no contenía una configuración de reproducción. La versión instalada desde lockfile es 1.7.3: conserva sus políticas internas de retry de fragmentos, niveles y manifest, supervisadas por el nuevo mecanismo.
- Electron reconoce `.m3u8` con query string para pasarlo por el gateway. Las redirecciones 302 ya se seguían explícitamente y las rutas relativas se resolvían contra la URL final: las pruebas existentes y los smokes lo verifican. El listener de cabeceras no altera IPTV; no hay evidencia para cambiar User-Agent/Referer del proveedor.
- El gateway conserva recursos durante una sesión y tiene un límite de 20.000; una renovación limpia esa sesión. Su límite sigue siendo una restricción para emisiones muy largas, no una causa demostrada del incidente.

## Reproducción

Requisitos: `npm ci`, FFmpeg en PATH y Electron/Chromium de Playwright disponibles.

```powershell
npm run build
node electron/live-buffering-smoke.cjs
node electron/live-stall-smoke.cjs
```

Todo el contenido, el panel Xtream, sus datos ficticios y los perfiles de Electron son locales y temporales. El panel responde con 302 a la señal. El smoke nuevo congela la playlist durante 20 s, devuelve varios 404 de segmentos, retiene solicitudes hasta timeout, apaga y vuelve a levantar el servidor en el mismo puerto y caduca la playlist hasta otra petición al master. Exige renovación efectiva y avance posterior sin error terminal. El smoke anterior conserva sus comprobaciones de una sola MediaSource durante fallos cortos, loader único, pausa, cierre y señal permanentemente inexistente; se fija el foco en el vídeo antes de Escape para probar el cierre y no la navegación entre controles.

Antes de aplicar la corrección se ejecutó el smoke nuevo contra el código original compilado: falló con `page.waitForFunction: Timeout 25000ms exceeded` al esperar la reconexión tras caducar la sesión. Las iteraciones posteriores descubrieron el bloqueo causado por los nudges, documentado arriba.

## Verificación final

| Comando | Resultado |
| --- | --- |
| `npm test` | 429 pruebas, 0 fallos. |
| `npm run build` | OK; aviso de tamaño de chunks. |
| `node electron/live-buffering-smoke.cjs` | OK. |
| `node electron/live-stall-smoke.cjs` | OK: playlist congelada 20 s, 404 repetidos, timeout, parada/regreso real del servidor, 302 y renovación tras caducidad. |
| `npm run build:tizen` | OK; WGT sin firma, no instalado. |
| `npm run test:tizen` | OK con AVPlay simulado y preset de fixture. |

El worktree no tenía `.env.local`. El primer smoke Tizen no encontraba el catálogo inicial porque presupone un preset. Se compiló con un preset ficticio en `.env.local`, correspondiente al host que el propio smoke intercepta; después se eliminó ese archivo temporal. Los previews que regeneró la prueba se restauraron. No se guardaron credenciales reales ni se cambió el id `Richiflix1.Richiflix`.

Los smokes Electron se verifican secuencialmente. Sus ventanas se ocultan con throttling desactivado para aislar las pruebas del teclado del escritorio y conservar timers/renderizado. En producción ocultar el documento suspende la recuperación por diseño. La fixture también adelanta el timeout de playlist respecto al de fragmentos, sin retries internos de playlist, para que la carrera entre ambos no impida comprobar el error fatal de nivel requerido por el smoke anterior; la configuración de producción no utiliza esos timeouts de prueba.

## Riesgos y límites

Renovar MediaSource interrumpe brevemente el vídeo y vuelve al directo; sólo se hace tras un bloqueo persistente. Un proveedor que mantenga el token caducado incluso al repetir la URL de entrada seguirá fallando y terminará mostrando el error. El fallback `swapAudioCodec` depende de los codecs de la señal. Las pruebas de decoder son unitarias; falta observar el incidente concreto con una señal real de PC. No se midió ni instaló nada en un televisor: Tizen sigue entrando por `nativePlayback` y AVPlay, con sus plazos originales, y la verificación es simulada.
