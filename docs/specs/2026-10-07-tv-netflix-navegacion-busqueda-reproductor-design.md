# Spec · Foco fijo, búsqueda útil, episodios en español, reproductor por mando y nombres limpios

Fecha: 7 de octubre de 2026. Pedido por Richard. Destino principal: Samsung UN65M70HAGXZS (Tizen 10 / Chromium 130, 1920×1080). PC con ratón conserva su comportamiento salvo donde se indique.

## Lo que pidió Richard (literal, resumido)

1. Las tarjetas no deben ir a la derecha: deben venir hacia la izquierda al pulsar Derecha, y al revés con Izquierda. «Literalmente como funciona Netflix.» Lo que sigue fallando: **el recuadro de foco se desplaza**.
2. Estados vacíos «un desastre». Si busca una serie que no está: coincidencias aproximadas, sugerir otros nombres y alternativas del mismo género.
3. Los episodios no traen nada en español: **títulos y sinopsis**.
4. Reproductor: pasar fácil al siguiente episodio; adelantar/retroceder más inteligente, **acelerando al mantener**; que sea sólo con Izquierda/Derecha estando en el reproductor; usar el espacio de los botones para cambiar episodio, reiniciar y similares. **Nunca quiere el foco en la barra**: sólo en el vídeo o en los botones.
5. Normalizar los nombres de episodios y eventos en vivo: sin signos raros ni formatos raros; nombres normales y serios.
6. El selector de idioma «está mal planteado» y al pulsarlo nunca agarra el desplegable. Sustituirlo por un **panel lateral derecho** con todos los idiomas, subtítulos y opciones.

Supuestos (no dichos por Richard, decididos para el diseño): sin cambios en el perfil Kids salvo lo que aplique a todos; nada se instala en el TV sin su indicación; reglas de movimiento del plan de TV (sólo `transform`/`opacity`, sin layout por tecla).

## Criterios de éxito

- En una fila, el recuadro de foco tiene la misma `x` en pantalla para todas las tarjetas, incluida la primera y la última; medido en el TV con capturas tras 0, 1, 6 y 20 Derecha y tras volver con Izquierda.
- Ninguna búsqueda termina en una pantalla vacía sin una acción útil.
- En una serie con `tmdbId`, ≥ 90 % de los episodios muestran título y sinopsis en español cuando TMDB los tiene.
- En el reproductor, ninguna combinación de teclas deja el foco en la barra de progreso; saltar 2 minutos cuesta ≤ 4 pulsaciones o un mantenido de ≤ 2 s.
- Ningún título visible de episodio, canal o evento contiene los símbolos o patrones de la tabla del apartado 5 (prueba sobre la muestra real).
- El panel de idioma abre con un OK, se recorre con Arriba/Abajo y cambia la pista con OK, en el TV y en PC.

## 1. Foco fijo tipo Netflix en las filas

**Diagnóstico.** `anchoredRailOffset` (`src/virtualWindow.js`) calcula `index*stride - gap - peek`, acotado a ≥ 0. La tarjeta 0 queda en el borde de la fila y desde la 1 la tarjeta enfocada queda `peek` (40 px) más a la derecha para dejar asomar la anterior dentro de la fila: el recuadro salta a la derecha en el primer toque. Además el halo único por fila se mueve con la tarjeta.

**Diseño.**
- Una **columna de foco** fija por fila: la `x` del título de la fila (padding de página, 4,5 % en TV). Todas las tarjetas enfocadas, incluida la 0, se colocan en esa columna.
- La fila (`.cards.virtual-rail`) se extiende hasta el borde físico izquierdo y derecho de la pantalla (margen negativo igual al padding de página y `paddingLeft` igual a ese padding), de modo que la tarjeta anterior asoma en el margen izquierdo (≈ 86 px), no dentro de la columna.
- Desplazamiento = `index * stride` exacto. Derecha: la fila se desliza una tarjeta a la izquierda; Izquierda: una a la derecha; el recuadro y el halo **no se mueven** (el halo queda fijo en la columna y sólo cambia de opacidad al entrar/salir de la fila).
- Final de la fila: el foco sigue en la columna y quedan huecos a la derecha (cola de espacio al final del track, ya existe `railTailSpace`, recalculada para que la última tarjeta pueda llegar a la columna). Vuelta circular final→inicio: reposiciona sin animación.
- El panel ampliado nace en la columna y crece hacia la derecha; las vecinas de la derecha se apartan como hoy. La regla F2 (abrir a la izquierda pasada la mitad) desaparece en filas de TV.
- **Degradado transparente a los lados** (pedido de Richard): en ambos bordes de la fila, un degradado del color de fondo (`#101827`) a transparente, ≈ 86 px a la izquierda (cubre la tarjeta que asoma) y ≈ 120 px a la derecha. Va en dos pseudo-elementos fijos sobre `.rail-wrap` (no dentro del track que se desliza), sin `mask-image` ni capa propia: se pintan una vez y no repintan al desplazarse. Sustituye al `span.rail-edge` que se retiró en TV (era una capa de 39×3975). El recuadro de foco y el panel ampliado quedan por encima del degradado izquierdo (la columna empieza justo donde termina el degradado). Se verifica en el TV que no aumenta el raster por tecla.
- Cuadrícula (Películas/Series/TV en vivo): fuera de este cambio; ya alinea filas arriba.
- Pruebas: `anchoredRailOffset` devuelve `index*stride` (acotado a la cola); unitarias para 0, 1, medio, último, fila corta, wrap. Capturas en el TV de la `x` del recuadro.

## 2. Búsqueda y estados vacíos

**Búsqueda sin resultados exactos** (`useCatalogueSearch`, `catalogueIndex`/worker):
1. **Coincidencias aproximadas** en el worker: normalización (minúsculas, sin tildes, sin signos, sin etiquetas de calidad/idioma, ver apartado 5), coincidencia por palabras sueltas y por prefijo, y distancia de edición acotada (Damerau-Levenshtein ≤ 2 por palabra, o trigramas con umbral 0,45). Orden por puntuación; máximo 40. Se muestran bajo el título «Parecidos a "…"».
2. **¿Quisiste decir…?**: 3–5 nombres reales del catálogo con la mejor puntuación, como botones que lanzan esa búsqueda.
3. **TMDB**: si TMDB encuentra el título (`search/multi`, es-ES) y no está en el catálogo, se dice «"Breaking Bad" no está en tus fuentes» con su póster y, debajo, «Del mismo género en tu catálogo» (géneros TMDB del resultado cruzados con las colecciones de género que ya existen). Petición con debounce de 500 ms tras dejar de escribir, una a la vez, caché por consulta.
4. Siempre una salida: «Buscar en todo el catálogo» si se buscaba dentro de una sección o categoría, y «Limpiar búsqueda».

**Otros estados vacíos** (diseño común: ilustración propia de la categoría, una frase clara y una o dos acciones alcanzables con el mando):
- Filtro sin títulos: «Ver todas» y las 3 categorías con más títulos.
- Mi lista vacía: «Explorar películas» y la fila «Mejor valoradas» debajo.
- Continuar viendo vacío: la fila no aparece.
- Error de fuente: qué pasó en una frase, «Reintentar» y «Ajustes».
- TV en vivo / MLB sin eventos hoy: «Próximos» de mañana o la cuadrícula de canales.

## 3. Episodios en español

- Fuente: TMDB `tv/{tmdbId}/season/{n}` con `language=es-ES`; si un episodio no trae título o sinopsis, segunda petición `es-MX`; si tampoco, se conserva el del proveedor (normalizado, apartado 5). La sinopsis en inglés de TMDB sólo como último recurso y marcada como tal.
- Cruce por número de temporada y episodio (`episode_num` del proveedor ↔ `episode_number` de TMDB); si el proveedor numera de forma absoluta, cruce por orden dentro de la temporada.
- Cuándo: al abrir la serie se piden las temporadas visibles (la seleccionada primero), concurrencia 2, caché persistente por `tmdbId+season` 30 días (misma caché que los metadatos), generación nueva para invalidar.
- Sin `tmdbId`: se intenta resolver por título y año con la búsqueda de TMDB ya usada para películas.
- Las miniaturas no cambian (fuera de alcance).

## 4. Reproductor manejado sólo con Izquierda/Derecha y botones

**Foco.** La barra de progreso deja de ser foco (deja de ser `input` enfocable en TV; queda como indicador). El foco sólo puede estar en el **vídeo** o en la **fila de botones**. Desde el vídeo: Abajo o OK muestran los controles y enfocan Reproducir/Pausa; Arriba desde los botones vuelve al vídeo; Volver cierra el reproductor desde el vídeo y vuelve al vídeo desde los botones.

**Saltos con aceleración** (con el foco en el vídeo, controles visibles u ocultos):
- Toque: ±10 s. Pulsaciones seguidas en < 600 ms o mantener: la cantidad crece 10 → 30 → 60 → 120 s por paso.
- Mientras se acumula se muestra la posición destino (miniatura de tiempo sobre la barra, «+1:30 · 23:45») y el salto se aplica 400 ms después de la última pulsación: un solo `seek` por ráfaga.
- Sin DVR en directo: no hay saltos; Izquierda/Derecha no hacen nada.
- MediaRewind/MediaFastForward usan la misma aceleración.

**Fila de botones** (TV, por orden): episodio anterior · reiniciar · retroceder · reproducir/pausa · adelantar · episodio siguiente · idioma y subtítulos · señal (sólo eventos con varias señales). Los botones que no aplican no se muestran (película: sin episodios; directo: sin saltos ni reinicio). Izquierda/Derecha recorren la fila sin saltar al vídeo.

**Siguiente episodio.**
- Botón dedicado en la fila.
- Tarjeta «Siguiente episodio» con miniatura, título y cuenta atrás de 10 s cuando faltan 30 s o empiezan los créditos (si TMDB/proveedor no da marca de créditos, 30 s antes del final); OK la lanza, Volver la descarta.
- Al terminar un episodio sin interacción, se reproduce el siguiente (una vez); tras 3 episodios seguidos sin interacción, «¿Sigues ahí?».
- Al cambiar de episodio se conserva el reproductor (misma ruta `setPlaying` que el cambio de señal) y el historial se guarda por episodio.

### 4.1 Saltar intro (pedido de Richard: «¿se puede hacer? Inténtalo al menos»)

El proveedor IPTV no indica dónde está la intro, así que se deduce en tres niveles, del más fiable al menos:
1. **Base de datos pública de marcas de intro**, si existe una consultable por TMDB id + temporada + episodio. Al escribir el plan se verifica cuál está disponible hoy, su licencia y su cobertura; si no hay ninguna utilizable, este nivel se omite.
2. **Aprendido por serie** (funciona sin servicios externos): si en un episodio el usuario salta hacia delante desde los primeros 5 minutos con un salto acumulado de 30–150 s, se guarda `{inicio, fin}` para esa serie y temporada (por perfil, respaldado como el historial). En los siguientes episodios de esa temporada aparece «Saltar intro» en esa ventana (±15 s de tolerancia). Si el usuario vuelve a saltar a otra posición, se corrige con la media de las últimas marcas. Si pulsa «Saltar intro» y luego retrocede, la marca de esa serie se descarta.
3. **Repetición entre episodios** (opcional, solo si los niveles 1–2 no bastan y el coste en el TV es aceptable): comparar la huella de audio de los primeros minutos de dos episodios de la misma temporada no es viable en el navegador del TV; queda descartado salvo que exista un servicio que lo calcule.

Interfaz: botón «Saltar intro» abajo a la derecha, que **toma el foco** al aparecer (OK salta, cualquier flecha lo descarta y devuelve el foco al vídeo), visible durante la ventana de la intro y oculto a los 10 s si no se usa. «Saltar resumen» con la misma lógica si se aprende una marca en el minuto 0. Nunca aparece en películas ni en directo.

### 4.2 Capítulos vistos

- En la lista de episodios: episodio **visto** (≥ 90 % reproducido o terminado) con un check y el título atenuado; **empezado** con barra de progreso y «Quedan 12 min»; **siguiente por ver** resaltado y con el foco inicial al abrir la serie.
- En la tarjeta de la serie y su panel ampliado: «T2 · E5 · Quedan 12 min» o «Siguiente: T2 · E6»; en «Continuar viendo», la serie aparece una sola vez, con el episodio en curso.
- Selector de temporada: cada temporada muestra «4 de 10 vistos» y un check si está completa.
- Acción en la lista: mantener OK sobre un episodio → «Marcar como visto / no visto»; en la temporada → «Marcar temporada como vista».
- Los datos salen del historial por perfil que ya existe (posición por episodio); se añade la marca explícita de visto y la duración conocida, con el mismo respaldo versionado.

## 5. Nombres de episodios, canales y eventos

**Paso 0, muestra real.** Extraer del TV (inspector, IndexedDB del catálogo) o de la caché de Electron una muestra de ≥ 2.000 nombres de canales/eventos y ≥ 500 de episodios, sin credenciales, y guardar el informe de patrones en `artifacts/nombres-muestra.json` (sólo nombres, sin URLs).

**Normalizador único** (`src/displayNames.js`, puro, con pruebas sobre la muestra):

| Patrón | Ejemplo | Resultado |
|---|---|---|
| Símbolos decorativos | `◘ MLB ◘ Spanish`, `✪ ESPN ✪`, `★`, emojis, `▶` | separadores normales o nada |
| Prefijos de hora/fecha del proveedor | `19:00 ◘ Yankees vs Rays`, `10/07 Soccer 7:30pm …` | hora pasa a `eventStartsAt` (ya existe) y se quita del título |
| Códigos de episodio | `S01E03 - Piloto`, `1x03 Piloto`, `Ep. 3 – Piloto`, `Breaking Bad - S01E03` | `Piloto`; número a `episodeNumber` |
| Nombre de la serie repetido | `Breaking Bad - Piloto` | `Piloto` |
| Etiquetas de calidad/códec | `HD`, `FHD`, `4K`, `HEVC`, `H265`, `SD`, `[HD]` | fuera del título; calidad a metadato |
| Idioma | `(LAT)`, `| ES`, `Spanish`, `[ENG]` | fuera del título; idioma a metadato (ya usado por las señales) |
| País/proveedor | `US:`, `ES|`, `|MX|` | fuera; país a metadato |
| MAYÚSCULAS completas | `LOS SIMPSON` | `Los Simpson` (tipo título en español: artículos y preposiciones en minúscula salvo al inicio; siglas conocidas como `ESPN`, `NBA`, `HBO`, `TV` se respetan) |
| Espacios y puntuación | `Yankees  vs.Rays`, `--`, `_` | `Yankees vs. Rays` |
| Episodio genérico | `Episodio 3`, `Episode 3` | sustituido por el título TMDB si existe |

- Un solo punto de aplicación: al preparar el catálogo (worker) para canales/eventos y al recibir episodios; las vistas sólo muestran. `channelTitle`/`displayTitle`/`eventDisplayTitle` pasan a usar el normalizador.
- La búsqueda indexa el nombre normalizado y el original.

## 6. Panel lateral de idioma, subtítulos y opciones

**Diagnóstico.** Hoy son `<select>` dentro de `.playback-menu`; en Tizen el `select` nativo no recibe el foco/apertura de forma fiable con el mando (`platform.js` intercepta las teclas del `SELECT`) y el usuario «nunca agarra el desplegable».

**Diseño.**
- Botón «Idioma y subtítulos» en la fila de botones (icono de bocadillo). OK abre un **panel lateral derecho** de ancho ~520 px (TV) que entra con `transform: translateX` y opacidad (≤ 180 ms), sobre el vídeo atenuado.
- Secciones en lista vertical de botones (nunca `select`): **Audio** (todas las pistas con su idioma legible: «Español (Latinoamérica)», «Inglés», códec si hay dos iguales), **Subtítulos** (Desactivados + todas las pistas), **Calidad** (si hay niveles), **Velocidad** (sólo PC y VOD). La opción activa lleva marca y color; OK la aplica al instante y deja el panel abierto.
- Mando: Arriba/Abajo recorren las opciones de todas las secciones en orden; Izquierda o Volver cierran el panel y devuelven el foco al botón; el vídeo sigue reproduciendo.
- Nombres de pista legibles desde códigos ISO (`spa`, `es-419`, `eng`) con `Intl.DisplayNames('es')`; si no hay idioma, «Pista 1».
- La señal de eventos usa el mismo panel (sección «Señal») en lugar de su menú propio.

## 7. Renovación de marca: Kingdom Player

Pedido de Richard: «darle un lavado de cara a la app y cambiar el nombre a Kingdom Player, pero el player no lo pongas en los títulos: usa solo Kingdom»; logo nuevo creado con Codex y colores nuevos.

- **Nombre.** Nombre completo «Kingdom Player» en metadatos del paquete (`tizen/config.xml` `<name>`, Electron `productName`, `package.json` `name` si no rompe rutas, título de ventana), README y docs. En la interfaz (cabecera, pantalla de perfiles, loader, reproductor, `<title>` de la página) solo «Kingdom». El identificador del paquete Tizen (`Richiflix1.Richiflix`) **no cambia**: cambiarlo obligaría a desinstalar y se perderían perfiles y conexiones; la app instalada se actualiza como siempre.
- **Logo con Codex vía Orca.** Encargo a Codex (skill `orca-cli`, en un worktree propio de Orca) para diseñar: símbolo (corona o motivo de reino reducido a una forma simple que funcione a 16 px y a 512 px), logotipo «Kingdom» y su variante con «Player» para metadatos. Entregables en SVG vectorial limpio (sin imágenes incrustadas), más PNG exportados para los tamaños que hoy produce `npm run brand:export` (16–1024, `.ico`, `icon.png` de Tizen 117 px). Restricciones: legible sobre fondo oscuro desde el sofá, sin texto pequeño en el icono, un solo color de acento más neutro, sin parecerse a marcas existentes. Se revisan 2–3 propuestas antes de integrar.
- **Paleta nueva.** Se plantea junto con el logo: 5–6 tokens (fondo, superficie, texto, texto secundario, acento principal, acento de foco) con contraste AA sobre el fondo y un color de foco distinto del acento para el halo del mando. Sustituye a Noche/Nube/Coral/Lavanda/Mantequilla en `:root` y en las reglas de TV; Kids conserva un acento cálido propio. Se documenta en `docs/BRAND.md` y `docs/DESIGN.md`.
- **Alcance visual.** Logo, colores, favicon/iconos, loader y pantalla de perfiles. Tipografías y composición se mantienen salvo que la paleta nueva lo exija; las reglas de movimiento y rendimiento de TV no cambian.
- **Verificación.** Capturas del TV de cabecera, perfiles, loader, una fila con foco y el reproductor con la marca nueva; icono correcto en el lanzador de Samsung tras actualizar.

## Fuera de alcance

Miniaturas de episodios, marcas reales de créditos (no hay fuente), cambios en la cuadrícula, perfil Kids salvo los nombres, instalación en el TV sin indicación de Richard.

## Pruebas y verificación

- Unitarias: `anchoredRailOffset` (columna fija), puntuación difusa y sugerencias, cruce de episodios TMDB↔proveedor, acumulador de saltos, normalizador (tabla + muestra real), nombres de pista ISO.
- En el TV (inspector): capturas de la columna de foco (0/1/6/20 Derecha y vuelta), búsqueda con errores de escritura y con un título ausente, serie con episodios en español, reproductor (foco nunca en la barra, saltos acumulados, siguiente episodio, panel de idioma con OK/Arriba/Abajo/Volver) y P50/P95 de navegación sin empeorar respecto a la sección 11 del plan de rendimiento.
- Sin smokes de Playwright/Electron salvo `npm run test:tizen`, mientras Richard mantenga esa preferencia.

## Resultado (8 oct 2026, medido en el 55")

Build integrado (`main` `2a3cfd5`, 362 pruebas, `build:tizen` y `test:tizen` en verde) instalado en el UN55M75 (192.168.1.25). Arranque hasta perfiles en 8 s. Comprobado por el inspector:

| Criterio | Resultado |
|---|---|
| Columna de foco fija (§1) | fila Películas: la tarjeta enfocada queda en x=80 en 0, 1 y 6 Derecha y tras 3 Izquierda; las vecinas llegan al foco y la anterior asoma bajo el degradado izquierdo (`artifacts/kingdom-55-foco-{0,1,6,3L}.png`) |
| Nombres limpios en TV en vivo (§5) | «Deportivo Moquegua vs. Cienciano Liga 1», «Vancouver Canucks vs. Carolina Hurricanes NHL», sin siglas sueltas ni símbolos (`kingdom-55-tv-en-vivo.png`) |
| Marca (§7) | corona + «Kingdom» en cabecera, paleta Solaria, icono en el lanzador |
| Latencia de navegación (`tv-measure.mjs`, 3 corridas, 350 ms, fase de traza) | P50 100–118 / P95 147–178 ms; sección 11 del plan de rendimiento en el 65": 94–99 / 144–152. Capas tras 20 teclas: 88 (antes 67) |

Pendiente de comprobar en el TV: búsqueda difusa, episodios en español, reproductor (saltos, siguiente episodio, saltar intro, panel lateral) — no se ejecutaron smokes de reproducción. Las 21 capas extra (degradados laterales y halos de A) son la primera candidata si la latencia debe volver a la de la sección 11. Los títulos VOD no pasan por `cleanName` (fuera de alcance: solo episodios y eventos), por eso «Michael (LAT/ENG/CAST)» sigue así en Continuar viendo.

El 65" (192.168.1.12) no arrancó este build: se queda en «Preparando tus fuentes» porque cualquier acceso a IndexedDB se cuelga incluso desde el inspector (proveedor accesible, workers vivos); es el almacenamiento del TV, no el código.
