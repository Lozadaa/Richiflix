# Spec · Inicio con vida (TV)

Aprobado por Richard el 8 oct 2026 («enfoque 2, contenido vivo»). Restricción de partida, en sus palabras: «no podemos romper nada de performance».

## Objetivo

Que el Inicio del TV deje de verse plano: el banner respira, el color del título tiñe la escena, las filas tienen jerarquía y contenido nuevo (Top 10, Nuevo esta semana), y las tarjetas cuentan más sin moverse más. Todo bajo las reglas de movimiento del plan de rendimiento.

## Reglas duras (no negociables)

1. Sólo `transform` y `opacity` se animan. Fondos, sombras, bordes y degradados se pintan por estado, nunca se interpolan.
2. Cero capas permanentes nuevas por tarjeta. Presupuesto global: hoy 88 capas tras 20 teclas en el 55"; tope **91** (dos de tinte ambiental + una del progreso del punto).
3. Nada de `backdrop-filter`, `filter: blur`, `mix-blend-mode`, `color-mix()` en TV. `cssTarget` chrome85 (sin `inset` a secas).
4. Nada aparece ni desaparece al enfocar una tarjeta: la información es estática; al enfocar sólo sigue el levantamiento actual (`--tv-focus-scale`) y el halo único por fila.
5. Nada se calcula por tecla: tinte, logos y filas nuevas se resuelven en reposo o al cargar datos, y se guardan por id.
6. Cada animación nueva tiene perilla CSS: `--tv-kenburns` (0/1) y `--tv-ambient` (0/1) en `:root` del modo TV. A 0 no hay animación ni capa.
7. Medida: `npm run measure:tv` ×3 en el 55" antes y después. No se integra si P95 (fase de traza, 350 ms) supera 178 ms o las capas superan 91.

## 1 · Movimiento ambiental (banner)

- **Ken Burns.** La capa `.focus-stage-visual.is-current` (ya existe para el fundido) escala su imagen de 1,00 a 1,06 en 9 s (el intervalo de la diapositiva), `linear`, `transform-origin` 60% 40%. La animación se reinicia al cambiar de diapositiva (cambia la `key`). Con `--tv-kenburns:0` o `prefers-reduced-motion` no hay animación. Chromium rasteriza una vez a la escala máxima; después todo es compositor.
- **Progreso del punto.** Bajo el punto activo, una línea de 32×3 px (`.banner-dot-progress`) que se llena con `scaleX(0→1)` en 9 s y se reinicia en cada cambio; se pausa (`animation-play-state:paused`) cuando el carrusel está pausado (ya hay estado de pausa en `useBannerCarousel`). Es la única capa nueva de esta sección.
- **Entrada escalonada del texto.** `stage-copy-in` ya existe; cejilla, título, sinopsis y datos reciben `animation-delay` de 0 / 40 / 80 / 120 ms. Sin cambios de duración.

## 2 · Color y luz

- **Tinte ambiental.** Dos elementos fijos `.ambient-wash` (A y B) detrás del banner y la primera fila, `position:absolute` dentro de la escena del Inicio, altura 60vh, `pointer-events:none`, fondo `radial-gradient(ellipse at 70% 0%, rgba(identity-ink, .55), transparent 70%)`. La diapositiva actual escribe su `--identity-ink` en la capa libre y la activa (`opacity:1`) con transición `--tv-slow`; la otra se apaga. Sólo cambia con la diapositiva, nunca por tecla. `--tv-ambient:0` oculta ambas (`display:none`).
- **Cejillas de fila.** Encima del `h2` de cada fila, `<small class="row-eyebrow">` en `--accent`, 13 px, mayúsculas, `letter-spacing:.12em`: «TU CATÁLOGO» (Películas, Series), «SIGUE DONDE LO DEJASTE» (Continuar viendo), «EN DIRECTO» (Ahora en vivo), «SELECCIÓN TMDB» (filas TMDB), «TOP 10», «NOVEDADES», «PARA TI» (descubrimiento). Pintura estática.
- **Oro donde importa.** Píldora de nota ≥ 8,0 en `--accent` con tinta `--bg`; el resto como hoy. El degradado lateral de la columna fija no cambia.

## 3 · Contenido más rico

- **Top 10 en Kingdom.** Fila nueva tras «Series»: los 10 primeros de la colección `TMDB_BEST` (películas y series intercalados por `tmdbRank`, películas primero en empate). Cada tarjeta lleva el número a la izquierda del póster (`.card-rank`, contorno de 2 px en `--text-2`, relleno transparente, fuente Bricolage 120 px). La fila usa un ancho de celda mayor (póster + 90 px); el paso del carrusel es por fila, así que la columna fija (`anchoredRailOffset`) no cambia. Si `TMDB_BEST` aún no ha respondido, la fila no se muestra.
- **Nuevo esta semana.** `normaliseItem` conserva `added` del proveedor (segundos Unix → `addedAt` en ms; si no viene, ausente). Fila nueva tras Top 10 con lo añadido en los últimos 7 días (películas y series, más reciente primero, máximo 40). Insignia «NUEVO» (`.card-badge.is-new`) en cualquier tarjeta con `addedAt` < 7 días, esquina superior derecha, pintura estática. Sin Kids si el título no está verificado (misma regla que hoy).
- **Ahora en vivo con pulso.** El título de la fila incluye el recuento en juego: «Ahora en vivo · 3 en juego» (0 → sin sufijo). Las tarjetas en juego ya llevan `EventBadge`; si `eventScore` existe se muestra «3 – 2» en la leyenda. Sin refresco propio en el Inicio.

## 4 · Tarjetas más expresivas

- **Línea de datos.** Bajo el título de la tarjeta (`.card-caption`), `<span class="card-facts">`: «2026 · Drama · 1 h 49 min» con lo que exista (`year`, primer `tmdbGenres` o `contentGenre`, `durationSeconds`). Siempre visible, `--text-2`, 15 px en TV. En Continuar viendo se mantiene `card-resume` y no se añade la línea.
- **Títulos limpios con audio.** `cleanName` admite `kind:'vod'`: quita sufijos de idioma/calidad «(LAT/ENG/CAST)», «[4K]», «- Latino», «DUAL», conserva el año si lo hay, y devuelve `languages:[...]` (códigos tal cual, en mayúsculas, orden original). `normaliseItem` lo aplica a película y serie: `displayTitle` limpio, `originalTitle` intacto, `languages`. Insignia «LAT · ENG» (`.card-badge.is-audio`, máximo 3 códigos) bajo la de NUEVO. El banner y el panel usan `displayTitle`.
- **Logo del título.** `spanishMetadata` añade `images` a `append_to_response` con `include_image_language=es,null`; se guarda `logoImage` (ruta TMDB del primer logo en español, si no el primero sin idioma; PNG/SVG, se prefiere PNG). `artworkURL` sirve logos en w300. Banner: si hay `logoImage`, el `h1` se sustituye por `<img class="title-logo">` (alto máx. 120 px, ancho máx. 480 px) con `alt` del título; se decodifica (`img.decode()`) antes de pintarse y, si falla, queda el `h1`. Panel ampliado: igual con el `h3` (alto máx. 72 px). Sin animación propia: entra con el `stage-copy-in` del texto.

## Fuera de alcance

Halo que respira, brillo tras la fila enfocada, marcador en vivo con refresco en el Inicio, extracción de color de imágenes, miniaturas, Kids más allá de lo que hereda.

## Pruebas y verificación

- Unitarias (`node --test`): `cleanName` kind `vod` (tabla + idempotencia); `addedAt` y filtro de 7 días; orden del Top 10; `logoImage` elegido de una respuesta `images` (es > null > ninguno); texto de `card-facts`; recuento «en juego».
- Build: `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`.
- TV (55", inspector): capturas del Inicio en las diapositivas 0 y 1 (tinte distinto, logo, puntos con progreso), fila Top 10, fila Nuevo esta semana, tarjeta con NUEVO y audio; `measure:tv` ×3; recuento de capas ≤ 91; `tv-trace-report.mjs` sin `Layout` en los cambios de diapositiva.
- Sin smokes de Playwright/Electron.

## Resultado (8 oct 2026, 55")

Integrado en `main` (lotes H1–H3 + ajustes de integración), instalado en el UN55M75 y verificado por el inspector.

| Criterio | Resultado |
|---|---|
| Ken Burns, tinte, punto con progreso, texto escalonado | Activos sólo mientras el foco está en el banner. Al bajar a las filas el Ken Burns se congela como `transform` estático y el punto deja de pintarse: en reposo en las filas no queda ninguna capa nueva del banner (`vida-55-banner-{0,1}.png`). |
| Tinte ambiental | Desviación respecto al diseño inicial: se pinta como `::after` dentro de la capa del arte de cada diapositiva (el fundido lo lleva solo), no como dos capas propias. Cero capas, cero transiciones. |
| Logo del título | En el panel ampliado (`vida-55-peliculas-insignias.png`, «Terror en Shelby Oaks»). En el banner aparece cuando el título tiene `logoImage` en caché; los títulos cacheados antes del cambio lo reciben al caducar su caché (30 d / 7 d). |
| Top 10 | Números en contorno, fila con celda de 300 px; el panel ampliado se ancla al póster y el número queda visible (número 77–144, panel desde 176; `vida-55-top10-foco-2.png`). El número vive dentro de la capa del botón: 0 capas extra (antes 10). |
| Nuevo esta semana, insignias | `addedAt` se guarda al normalizar; la fila e insignia NUEVO aparecen cuando el catálogo se recarga. Insignia de audio y NUEVO abajo a la derecha del póster (arriba chocaban con la nota). |
| Nombres limpios | «Michael (LAT/ENG/CAST)» → «Michael» + «LAT · ENG · CAST» en toda la app (tarjeta, banner, panel). |
| Columna de foco fija | Intacta: x=80 en índices 0–3 de Películas tras el cambio del Top 10. |
| Latencia (`measure:tv`, 350 ms, fase de traza) | Build de la mañana (sin Inicio con vida): P50 100–118 / P95 147–178. Final: P50 109–113 / P95 143–212 (3 corridas; la de 212 arranca a mitad de fila y decodifica más portadas). Mismo camino de teclas que por la mañana (Top 10 oculto): P95 157–188. Sin regresión atribuible fuera del ruido. |
| Capas tras 20 teclas | 83–84 (mañana 86–88) en las corridas comparables; 121 en la primera corrida tras arrancar (ventana de tarjetas más amplia). En reposo en las filas: 90. |

Correcciones durante la verificación: `z-index:-1` del número (10 capas), panel del Top 10 tapando el número (reporte de Richard), tinte y Ken Burns como capas permanentes (+8 capas y texto del banner compuesto mientras se navega), insignias sobre la nota.
