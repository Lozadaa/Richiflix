# Informe F · Nombres limpios

Rama: `kingdom-F-nombres`. Fecha: 2026-10-07.

## F1 · Muestra y normalizador

- TDD: `displayNames.test.js` falló por módulo inexistente; después pasaron los casos de la tabla del spec y las pruebas de espacios, siglas e idempotencia sobre la muestra. Se añadió una regresión roja para conservar el título completo `Fixture Episode 1`, detectada por `test:tizen`, y se limitó el código genérico a prefijos o segmentos delimitados.
- `cleanName` extrae hora, país, idioma, calidad, temporada y episodio, elimina símbolos y prefijos redundantes, normaliza `vs.` y aplica mayúsculas de título español sólo con ≥ 80 % de letras mayúsculas. Respeta las siglas del plan, incluidas TV, MLB, ESPN y HBO.
- `sample-names.mjs` intenta leer exclusivamente `xtream-catalogue*.json` de `%APPDATA%/richiflix`; si no encuentra catálogo usa el fixture Xtream, JSON local y títulos de tests. Exporta sólo nombres y cifras, sin URLs ni credenciales.
- La caché Electron no existe en esta máquina. Muestra final: **103 nombres únicos**; conjuntos de origen: 10 canales/eventos, 7 episodios, 91 otros títulos (los conjuntos pueden solaparse). Patrones: decoración 7, hora 6, episodio 7, calidad 7, idioma 7, país 3. `playlist-checks.json` contiene cifras y URLs, no títulos aprovechables; no se exportaron sus URLs.
- **0 títulos con los símbolos/códigos/prefijos horarios prohibidos** al normalizar la muestra según su tipo; **0 diferencias de idempotencia**. 19 pruebas nuevas en F1.

## F2 · Aplicación e índice

- TDD: dos pruebas nuevas en `liveEvents.test.js` fallaron por ausencia de `displayTitle` y por episodio sin limpiar; después pasaron.
- El worker prepara canales/eventos una vez: conserva `title` original y añade `displayTitle`, `language`, `quality`, `country`; la hora de evento sigue usando el parser existente con fecha/zona horaria.
- Al recibir episodios, se conserva `originalTitle` y se entrega el título limpio; los números del proveedor y la temporada del grupo tienen prioridad para preservar numeración absoluta.
- `channelTitle`, `displayTitle` y `eventDisplayTitle` consumen los nombres preparados. Se conservan los fallbacks existentes para objetos sin preparar y títulos de películas fuera del bloque F.
- `feedLanguage` usa primero el metadato; la señal española con título limpio tiene prioridad. El índice busca tanto original como limpio, también mediante su servicio worker, conservando el formato de registros del protocolo.

## Verificación

- Inicio: `npm install` sin dependencias nuevas; auditoría 0 vulnerabilidades; `npm test`: **292/292**.
- Final: `npm test`: **313/313** (21 pruebas nuevas), `npm run build`, `npm run build:tizen` y `npm run test:tizen`: **verde**.
- Builds ejecutados en serie. Vite mantiene el aviso de chunks > 500 kB. Paquete Tizen local generado con 70 archivos; sin instalación.
- `git diff --check`: sin errores de espacios.

## Desviaciones y fuera de alcance

- No se alcanzan ≥ 2.000 canales/eventos y ≥ 500 episodios: falta la caché real y los fixtures disponibles no contienen esa cantidad. No se inventaron ni duplicaron nombres. El script queda listo para repetir la extracción con un catálogo real.
- Los skills `superpowers:executing-plans` / `superpowers:subagent-driven-development` indicados en el plan no están instalados en los directorios de skills disponibles. Se siguió TDD directamente, sin agentes ni dependencias adicionales.
- Se siguió la instrucción actual de un commit por tarea en el worktree Git, por encima de la nota antigua del plan que decía que el proyecto no era un repo Git.
- Sin acceso al TV, sdb, CLI Tizen ni instalación; quedan fuera las capturas de TV en vivo y serie en hardware real. Sólo se ejecutó el smoke autorizado `npm run test:tizen`, con decoder simulado. Sus PNG de salida versionados se restauraron para no incluir archivos ajenos al bloque.
- Sin cambios a TMDB, interfaz de episodios, reproductor, marca ni bloques A–E/G. Se usó el skill Orca CLI únicamente para el estado/comentario del worktree.
