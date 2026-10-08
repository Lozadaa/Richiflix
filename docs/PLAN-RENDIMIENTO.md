# Plan integral de rendimiento de Richiflix

Fecha: 5 de octubre de 2026. Destinos: Electron en Windows y Samsung Tizen. Prioridad: navegación con mando, imagen cuidada y movimiento fluido.

El objetivo es conservar el carácter de Richiflix: tarjetas que responden al foco, banner que se contrae y expande, transiciones entre pantallas y reproducción inmersiva. Cada mejora debe medirse; una animación que desaparece no cuenta como una optimización terminada. «Perfecto» se traduce en criterios verificables, porque el modelo del TV, su memoria, la red y el proveedor también influyen.

Las tarjetas conservan su imagen y título al seleccionarse. No vuelve la marca «En portada». Los canales diferentes de un mismo partido se mantienen separados. No se instala ni se prueba esta fase en el TV hasta que Richard lo indique.

## Implementación local terminada

Actualización del 5 de octubre de 2026. Las fases de instrumentación, aislamiento, movimiento, ventanas virtuales, arranque/persistencia y ciclo de reproducción están implementadas y verificadas localmente. La validación física de la fase 7 espera el aviso de Richard. El paquete nuevo no se ha instalado ni se ha contactado el TV durante esta fase.

- Selección inmediata por instancia: sólo las tarjetas anterior y siguiente reciben el cambio. El banner y las consultas esperan 150 ms de reposo. Copias de una misma señal se unifican; diferentes canales de un duelo conservan identidad propia.
- Banner de 260 ms: cambia geometría una vez y anima desplazamiento y recorte. Conserva texto, logos y vídeo sin deformarlos; puede interrumpirse. Se corrigieron el doble clic de Mi lista y la visibilidad completa de la tarjeta ampliada.
- Desplazamiento infinito con ventanas de cuadrícula/fila, sin Mostrar más. Las filas lejanas suspenden tarjetas e imágenes; se conserva un margen y el foco. Cambio TV/escritorio vuelve a enlazar el viewport y sus observadores.
- Normalización, deduplicación y búsqueda en lotes cancelables. Las cachés de vista previa, detalles y arte tienen límites; la precarga descarta trabajo abandonado.
- Loader con etapas reales, fuentes y arte local decodificado. Catálogo con TTL de dos horas y actualización en segundo plano, sin vaciar la escena, con presupuesto total de 18 segundos.
- Recuperación canónica de perfiles antes de abrir el selector. Local A + respaldo A/B tardando cinco segundos + perfil nuevo C conserva A/B/C. Lectura fallida muestra Reintentar; no interpreta el fallo como lista vacía. Favoritos e historial tienen respaldo versionado. Un formato futuro conserva su clave original.
- Portadas TMDB adaptan resolución al tamaño de layout y DPR, reservando escala de foco. Se verificaron tamaños contra `/configuration`. El selector mantiene el control de píxeles reales y `decode()`, sin volver a descargar al ampliar la tarjeta. Fondos grandes y SVG conservan original.
- HLS.js es una importación opcional en Windows y está excluido de Samsung. Una sola instancia de tráiler entre títulos; se destruye al suspender. Sonido siempre, sin botón para silenciar, identificación exacta y diagnóstico distinto para error 153, autoplay y disponibilidad. Se corrigió una carrera al volver del segundo plano.

### Evidencia del build final

El ensayo de app completa usa Chromium headless en este ordenador, 27.000 títulos y una demora artificial de red de 1.100 ms. No descarga todo el arte real del proveedor ni utiliza el decoder físico de Samsung.

| Medida local | Resultado |
|---|---|
| Arranque inicial | 1.374 ms, incluyendo la demora de red simulada |
| Arranque con caché | 143 ms |
| Recorrido de cuadrícula | 1.500 movimientos; máximo 56 tarjetas y 56 imágenes montadas |
| Tecla → segundo RAF, p95 | 30,9 ms; proxy de presentación, no pintado medido |
| Intervalo entre RAF, p95 | 16,8 ms; cuatro intervalos >32 ms en la ventana registrada |
| Tareas >50 ms al navegar | 0 en ese recorrido |
| Heap JavaScript, tres rondas | 18,81 → 18,93 → 19,00 MB; +0,34 % entre las dos últimas |
| Metadatos tras 24 títulos rápidos | Dos detalles solicitados |
| Catálogos descargados al cambiar perfiles | Uno por tipo; compartidos |
| JavaScript Tizen | 383,83 KB, frente a aproximadamente 946 KB iniciales |
| Windows | Principal 372,34 KB; HLS opcional 592,63 KB, sin precarga inicial |

Resultados regenerables: [performance-smoke.json](../artifacts/performance-smoke.json) y [virtual-catalogue-smoke.json](../artifacts/virtual-catalogue-smoke.json). El segundo ensayo añade 500 movimientos de fila, restauración de foco, eliminación del título enfocado por filtro y suspensión de filas lejanas. Heap JavaScript no incluye toda la memoria de imágenes, compositor, iframes o decoder.

Pruebas aprobadas: 111 unidades; builds Windows/Tizen; smoke Tizen con AVPlay simulado; foco de Electron con doble guardar/quitar y banner; imágenes de Electron con decode/resolución/error; reproducción HLS real generada por FFmpeg con recuperación de errores; tráiler simulado con suspensión/restauración; imágenes adaptativas en DPR 1 y 2; cambio de viewport TV/escritorio sin ventanas vacías; y recorrido de rendimiento del paquete final.

En la primera ejecución de reproducción se produjo un timeout en `locator('video').evaluate`, sin captura de estado que permita atribuirlo. Las ejecuciones posteriores decodificaron y pasaron la secuencia completa. La prueba ahora guarda el paso y una captura si vuelve a fallar; se mantiene documentado el incidente, sin atribuirlo al TV o a una causa no comprobada.

Capturas locales de referencia: `tv-banner-collapsed.png`, `tv-banner-expanded.png`, `tv-focus-preview.png`, `player-recovery-playing.png` y `player-recovery-failed.png`. Los nombres TV corresponden al diseño simulado en Electron, no a capturas del dispositivo.

Pendiente exclusivamente de prueba autorizada: arranque, fluidez, memoria total y lectura desde el sofá en Samsung real, con imágenes remotas y tráiler activo; reproducción real del iframe YouTube y posibles bloqueos de identidad/autoplay; y persistencia tras actualización física sin desinstalar. Estas mediciones locales no certifican 60 FPS ni reproducción de todos los vídeos del proveedor.

## Punto de partida comprobado

- 75 pruebas unitarias pasan.
- La prueba local del paquete Tizen pasa con AVPlay simulado; no valida el decoder físico.
- En la última prueba de Electron, el segundo clic sobre «Mi lista» encontró el botón moviéndose y luego oculto durante la interacción del banner. Se incorpora como fallo pendiente en la fase de movimiento; no se declara esa prueba aprobada.
- Ensayo local con 27.000 títulos: arranque inicial de 1.338 ms, incluyendo una demora artificial de red de 1.100 ms; arranque con caché de 116 ms. Son cifras del ordenador, no del Samsung.
- En ese ensayo, 24 movimientos rápidos solicitan metadatos de dos títulos; no se registran tareas largas durante la navegación. El tiempo p95 de envío de tecla es 6 ms: **no equivale al tiempo de pintado ni certifica 60 FPS**.
- El JavaScript Tizen pasó de aproximadamente 946 KB a 352 KB al usar AVPlay sin incluir HLS.js de escritorio. Sigue pendiente medir carga, parseo y memoria física.
- El catálogo y sus índices se comparten al cambiar de perfil. Tipografías y avatares son locales. Hay respaldo de perfiles en IndexedDB, caché de metadatos y límites en la cola de vistas previas.
- La auditoría del catálogo guardado encontró 285 IDs de canales repetidos, 158 deportivos. Se unifican las copias de una misma señal, conservando sus categorías, y el foco distingue cada tarjeta visible.
- El TV había dejado el iframe de YouTube en `about:blank`, generando errores repetidos de comunicación entre orígenes. Se añadió la declaración de navegación del embed y se mejoró su inicialización. **El resultado físico sigue pendiente**, por indicación del usuario.
- La animación continua de altura del banner se suspendió en Samsung como medida provisional. La fase de movimiento debe recuperar esa sensación con otra técnica.

## Metas y cómo medirlas

Las siguientes cifras son objetivos iniciales. Se ajustan tras medir el modelo real, sin presentar pruebas de ordenador como resultados del TV.

| Área | Objetivo | Comprobación |
|---|---|---|
| Movimiento | Cerca de 60 FPS en navegación habitual; tiempo p95 de cuadro ≤20 ms | Cuadros con `requestAnimationFrame`, trazas y frames perdidos durante las transiciones |
| Mando | Respuesta visual p95 ≤80 ms; ningún movimiento perdido o foco doble | Medir desde keydown hasta el pintado siguiente, incluidas pulsaciones sostenidas |
| Hilo principal | Ninguna tarea >50 ms al recorrer tarjetas después del arranque | PerformanceObserver y perfil de CPU con imágenes/tráiler activos |
| Arranque con caché | Perfiles utilizables en ≤2 s en TV | Desde inicio del widget hasta perfiles pintados y recursos críticos preparados |
| Arranque inicial | Sin espera indefinida; avance por etapas y salida clara ante fallo | Red lenta, desconectada y fuente que no responde |
| Imágenes | Ninguna imagen borrosa ni dos fondos visibles durante el tráiler | Capturas de carga, error, cambio de tarjeta y reproducción |
| Memoria | Estabilización después de recorrer 500 títulos; crecimiento ≤10% entre las dos últimas rondas | Heap, imágenes, listeners, iframes y recursos liberados; límite absoluto definido con el TV |
| Perfiles | Persistencia tras cierre, reinicio y actualización, sin recrear cuentas | Mismos IDs, nombres, tipo, favoritos e historial |
| Peticiones | Recorrer tarjetas rápido no descarga un detalle por cada tarjeta | Contar peticiones, cancelaciones y respuestas descartadas |

## Fase 1. Instrumentación y escenarios reproducibles

1. Añadir un diagnóstico de desarrollo con duración de arranque, respuesta visual del foco, cuadros largos, peticiones activas, decodificaciones y tamaño de cachés. Sin credenciales ni URLs privadas en los registros.
2. Medir por separado: descargar, normalizar, indexar, renderizar, decodificar imágenes y reproducir. Un tiempo total no identifica qué hay que cambiar.
3. Crear recorridos iguales para comparar cada versión: Inicio → Películas → Series → Deportes → Mi lista; 50 movimientos sostenidos; diez cambios de fila; apertura/cierre de player; regreso desde segundo plano.
4. Probar catálogo pequeño, 27.000 títulos, datos reales guardados, muchas imágenes ausentes, varias señales del mismo partido y perfiles Kids.
5. Guardar una referencia visual de las animaciones antes de ajustar su implementación.

**Salida:** una línea base por plataforma y un informe que distingue tiempos de interacción, pintado, red y decoder. Sin conexión al TV durante esta fase local.

## Fase 2. Separar catálogo, foco y reproducción

1. Dividir el estado: catálogo e índices estables; navegación y filtros; selección de tarjeta; metadatos del banner; sesión de reproducción. Un cambio del banner no debe reconstruir las filas.
2. Aislar el banner y sus suscripciones. Solo la tarjeta anterior y la nueva necesitan actualizar su estado de selección. Los contadores de eventos actualizan sus pequeñas etiquetas.
3. Mantener callbacks, arrays y objetos estables. Evitar copiar metadatos sobre todas las tarjetas en cada render.
4. Usar índices para ID, fuente, categoría, búsqueda y posición de mando. Evitar recorrer todos los botones y medir todas sus cajas por cada tecla.
5. Normalizar, eliminar duplicados e indexar el catálogo fuera del recorrido interactivo. Evaluar un Worker clásico compatible con Tizen; si no está disponible, procesar en lotes pequeños que cedan el hilo principal.
6. Posponer búsqueda mientras se escribe y cancelar cálculos obsoletos. Mantener foco estable al cambiar los resultados.

**Salida:** una transición de selección actualiza dos tarjetas y el banner, con el catálogo intacto. No hay bloqueos largos al recorrer filas.

## Fase 3. Recuperar el movimiento del banner y pulir las transiciones

1. Sustituir la interpolación de `height`/`top` en cada cuadro por FLIP: medir una vez, aplicar el tamaño final y animar el desplazamiento visual con `transform`. Banner y lista se mueven coordinados.
2. Mantener expansión/contracción, cambio suave de imagen, aparición de texto, ampliación de tarjeta y transición al player. No convertir la app en pantallas estáticas.
3. Usar `transform` y `opacity` para la mayor parte del movimiento. Evitar animar filtros, grandes sombras, desenfoques y dimensiones de cientos de elementos.
4. Promover a una capa gráfica únicamente los elementos que están animando; retirar `will-change` al terminar. Muchas capas también consumen memoria.
5. Las animaciones deben poder interrumpirse: una nueva tecla cancela o redirige la transición actual desde su posición visible, sin acumular movimientos viejos.
6. Durante una pulsación sostenida, responder al foco inmediatamente; actualizar portada y precarga tras una pausa breve. Al soltar el mando, la escena termina de asentarse suavemente.
7. Corregir y repetir el caso de doble clic en «Mi lista»: guardar o quitar un título no debe desplazar el botón bajo el puntero ni reiniciar la expansión.
8. Conservar la legibilidad y el área de foco al expandir el banner. No cortar la tarjeta seleccionada ni mover el foco a una copia visual.

| Interacción | Duración inicial orientativa |
|---|---|
| Tarjeta enfocada | 140–180 ms |
| Cambio de portada y texto | 180–260 ms |
| Banner y desplazamiento de lista | 220–300 ms |
| Entrada/salida del player | 200–280 ms |
| Cambio de sección | 180–240 ms |

Las duraciones se ajustan con las mediciones y el tacto del mando. Se respeta la preferencia de movimiento reducido del sistema.

**Salida:** la app conserva sus transiciones; las trazas muestran que el movimiento no recalcula toda la lista en cada cuadro.

## Fase 4. Renderizar y cargar únicamente lo cercano

1. Virtualizar las cuadrículas y filas largas. Mantener visibles la ventana actual, el siguiente recorrido probable y un margen anterior. No montar miles de tarjetas al pulsar «Mostrar más» repetidamente.
2. Preservar tamaños, posiciones de scroll y memoria de foco. Una tarjeta enfocada nunca se recicla mientras sea necesaria; todos los títulos siguen siendo accesibles.
3. Precargar imágenes de la primera pantalla y del siguiente paso del mando. Usar prioridad alta para el banner seleccionado y baja para vecinos; eliminar trabajo de zonas abandonadas.
4. Elegir resolución según tamaño real, escala y densidad. Mantener el control de calidad: revelar solo después de `decode()` y de comprobar dimensiones suficientes.
5. Limitar imágenes decodificadas y fondos grandes. Favorecer caché HTTP/disco; guardar cientos de objetos `Image` no es una estrategia de memoria.
6. Mantener arte propio por categoría y logos locales como recursos rápidos. El cambio al arte real debe ser suave, sin mover la tarjeta ni mostrar dos capas incompatibles.

**Salida:** recorrer 500 títulos no multiplica el DOM, las descargas ni la memoria; todas las tarjetas mantienen diseño y foco.

## Fase 5. Arranque y datos persistentes

1. Loader único antes de perfiles con etapas reales: configuración guardada, catálogo, índices y recursos visuales esenciales. No inventar un porcentaje que no corresponda a trabajo medido.
2. Leer primero la caché válida. Preparar fuentes tipográficas, avatares, arte necesario de la primera escena y metadatos iniciales; no descargar todo el catálogo de imágenes antes de permitir entrar.
3. Definir vencimiento del catálogo y actualización en segundo plano. Conservar el catálogo anterior hasta disponer de una versión completa, sin vaciar la interfaz durante la actualización.
4. Aplicar límites de tiempo por trabajo completo y cancelar solicitudes abandonadas. La red lenta no debe impedir navegar por datos ya disponibles.
5. Versionar y migrar almacenamiento de perfiles, favoritos e historial. Mantener respaldo, recuperar fallos y no cambiar IDs durante una actualización.
6. Reducir aperturas de IndexedDB y agrupar escrituras de caché. Guardar perfiles de forma confirmada; las escrituras de metadatos pueden agruparse sin frenar el mando.
7. Separar dependencias de Windows y Samsung, y cargar módulos opcionales cuando realmente sean necesarios.

**Salida:** entrar o cambiar de perfil no vuelve a descargar el catálogo; reiniciar conserva la biblioteca personal y la interfaz responde aun con fallos de red.

## Fase 6. Tráilers y reproducción sin competir con la navegación

1. Separar fallos de permiso de navegación, identificación del embed, conexión, autoplay, vídeo no disponible e inicialización. No tratar todos como «tráiler lento».
2. Preparar la API y el siguiente candidato antes de necesitarlo; conservar una sola instancia del iframe entre títulos y pausar/cancelar candidatos anteriores.
3. Mantener sonido por defecto y no añadir botón de silencio. No resolver bloqueos de autoplay reproduciendo en silencio contra la preferencia del usuario.
4. Mostrar el vídeo únicamente cuando se confirme reproducción del título correcto. En ese momento, ocultar por completo imágenes y fallback del banner; recuperarlos al fallar o pausar.
5. Priorizar la navegación frente a precargas. Un tráiler no debe saturar la red ni mantener trabajo de títulos descartados.
6. Suspender correctamente al ir a segundo plano, al abrir el player o al cambiar perfil. Evitar iframes, listeners, timers o decoder retenidos después del cierre.
7. Probar con vídeos reales disponibles. Un player simulado comprueba estados de interfaz, pero no certifica reproducción de YouTube ni AVPlay.

**Salida:** una sola vista previa, sin fondo duplicado, audio según la preferencia y errores concretos recuperables. Se declara resuelto en Samsung únicamente tras verificarlo allí.

## Fase 7. Validación y entrega

1. Pasar unidades, pruebas de mando, persistencia, duplicados, imagen, reproducción y rendimiento local sobre los builds finales.
2. Comparar las animaciones con la referencia visual. Revisar que cada mejora conserve el movimiento o lo sustituya por otro equivalente y más eficiente.
3. Preparar el paquete y un informe de cambios, métricas y puntos pendientes. Mantener una versión anterior recuperable.
4. Cuando Richard autorice las pruebas físicas, instalar como **actualización**, con la misma identidad y certificado; nunca desinstalar para probar.
5. Medir en el Samsung real, con red normal y lenta, tráiler activo, pulsación sostenida y sesión prolongada. Ajustar presupuestos a su modelo y memoria.
6. Validar desde distancia de sofá en 43, 55 y 65 pulgadas: foco, texto, botones, transiciones y ausencia de saltos. El tamaño de pantalla no sustituye la prueba de hardware.
7. Entregar solo cuando se cumplan los criterios acordados o se documenten claramente las limitaciones concretas restantes.

## Orden de implementación

Instrumentación → aislamiento de estado → animación del banner por composición → virtualización y precarga → arranque y persistencia → tráiler y ciclo de vida → comprobación final.

Cada fase termina con evidencia y una comparación visual. El usuario autorizó después enviar la actualización al TV al terminar; las instalaciones conservan app, paquete, certificado y datos.

## Corrección del banner y del hilo principal, 5 de octubre de 2026

Implementados worker de catálogo/búsqueda, categorías preparadas antes de perfiles, búsqueda cancelable sin resultados de una consulta anterior y loader discreto de información. El bundle clásico de Tizen resuelve la URL del worker desde `document.baseURI`; la prueba exige modo `worker` para no aceptar un fallback silencioso. Se conservan IndexedDB, cifrado, perfiles y fuentes existentes.

El mando anuncia movimiento antes de enfocar otra tarjeta; no mide su caja transformada. El banner oculta y pausa una vez durante una ráfaga, descarta títulos intermedios y compromete el último tras 480 ms. La lista conserva su viewport de 42vh para el banner y no modifica scroll o columnas durante la transición. Acciones del banner visibles inmediatamente y referidas al candidato actual, incluso al subir antes de completar la pausa. El vídeo conserva un fotograma pausado durante 140 ms de salida y sólo sustituye el arte cuando el ID correcto empieza a reproducirse. La precarga limita imágenes retenidas y las cajas de placeholders no fuerzan lecturas de layout.

Evidencia: 150 unidades; smoke Tizen con worker real, edición de la fuente y AVPlay simulado; imágenes Electron con decode retenido, error y baja resolución; ciclo del tráiler y ventanas virtuales. La prueba de 27.000 títulos navega 1.500 posiciones con hasta 48 tarjetas montadas, memoria estabilizada y cero tareas largas durante la navegación. `banner-navigation-smoke.mjs` usa CPU 4×, 30 pulsaciones y YouTube simulado: ningún commit, cambio de imagen, cue o petición de metadatos intermedio; un commit final y un iframe reutilizado. Estos resultados locales son proxies de presentación, no FPS ni decodificación medidos en Samsung.

Un build de medición opcional (`VITE_PERFORMANCE_DIAGNOSTICS=1`, `VITE_DIAGNOSTICS_ENDPOINT` a un receptor local temporal) envía hasta 60 muestras agregadas cada cinco segundos. No contiene títulos, perfiles, IDs ni URLs de fuentes. `scripts/tv-performance-sink.mjs` sólo recibe estadísticas, no controla el TV, y termina a los veinte minutos. Builds normales no configuran este receptor. Las mediciones físicas y limitaciones concretas se registran en `artifacts/tizen-deployment.json` y, si el TV llega al receptor, `artifacts/tv-performance-samples.json`.

### Raster de tarjetas en el Samsung real

El inspector del UN65M70HAGXZS (Tizen 10.0) confirmó worker activo y ausencia de commits intermedios del banner. Sin embargo, 30 movimientos dieron P95 de 215,2 ms, frame P95 de 166,7 ms y 44 tareas largas. La traza de 14 movimientos atribuyó 866 ms acumulados a 53 `RasterTask`, frente a 55 ms acumulados de `EventDispatch`. Son duraciones acumuladas de eventos que pueden solaparse, no tiempo de pared.

La comparación aislada de 10 movimientos en ese mismo TV dio P95 de 268,8 ms con el estilo original y 67,2 ms al retener la capa transformada de cada tarjeta, manteniendo la escala. La variante sin escala sólo fue un diagnóstico y no se incorpora. La corrección de producción conserva la ampliación, estabiliza el orden de capas y el color del título, elimina pintura de sombras sobre el póster y revela el halo mediante su propia opacidad. La ventana virtual limita cuántas imágenes se retienen en GPU.

El smoke local con CPU 4× y 6.000 títulos pasó sobre el estilo final: P95 de 36,9 ms, cero tareas largas, geometría fija y foco visible. El paquete final debe medirse físicamente con el TV en Inicio, sin una emisión abierta; la medición no cierra una reproducción del usuario. El error YouTube 153 detectado en el TV es una limitación de identificación del embed que permanece separada de esta corrección de raster.

### Acciones de portada y disponibilidad de tráilers

En Samsung las acciones de portada se revelan únicamente al entrar en ella con el mando. La región de foco cambia mediante un atributo al cruzar de tarjeta a portada, menú o diálogo, sin actualizar el catálogo React. Una sola zona conserva el halo; las tarjetas mantienen sus capas GPU y memoria de selección. La navegación jerárquica, Enter y retorno a la tarjeta se comprobaron con CPU 4×: P95 33,8 ms, cero tareas largas y cero commits intermedios del banner.

La consulta TMDB obtiene alternativas españolas/inglesas en una petición y los campos ausentes del IPTV no reemplazan metadatos útiles. Se renueva únicamente la generación de detalles persistidos. Se preparó un reproductor HTTP(S) propio con un adaptador de sesión/generación que reutiliza el iframe, admite errores anteriores a `ready` y no envía cuentas ni URLs de fuentes. El test de transporte verificó el Referer real desde un padre `file://` y sonido/pausa/limpieza con YouTube simulado. 167 unidades, builds Windows/Tizen, smoke Tizen y ciclo de tráiler pasan. Alojamiento del puente, configuración del endpoint y reproducción física de YouTube siguen pendientes de la elección del usuario y una sesión de TV sin emisión abierta.

### Precarga direccional y selecciones TMDB, 6 de octubre de 2026

La cuadrícula y cada fila entregan al planificador su ventana de datos, índice y columnas mediante callbacks estables. Tras la pausa de navegación se anticipan hasta dos títulos hacia adelante o atrás; en cuadrícula vertical se sigue la misma columna. No se buscan tarjetas por geometría ni se montan títulos adicionales para prepararlos. Se mantienen concurrencia dos, prioridad de selección, cola acotada, 80 metadatos y dos imágenes/20 MiB estimados. El banner no solicita ni muestra un póster vertical: metadatos pendientes, descarga y decode mantienen el fondo vacío; ausencia o fallo confirmado habilitan la ilustración propia.

La puntuación y votos proceden del detalle TMDB; sólo notas válidas con votos se presentan. Las primeras tres páginas de `movie/top_rated` y `tv/top_rated`, junto a géneros oficiales en español, se descargan y cruzan en el worker/Electron. Caché diaria, dos solicitudes simultáneas y cruce por ID o título/año inequívoco. Las selecciones sólo incluyen contenido existente y ocultan duplicados de calidad en esas listas, sin modificar el catálogo original ni la clasificación Kids. Año, audio y duración se presentan debajo de la descripción; las tarjetas mantienen título e insignia de puntuación.

176 unidades pasan. Las pruebas de banner distinguen metadatos pendientes, imagen pendiente, ausencia, error y decode tardío, y verifican que un póster vertical no se solicite. La prueba integrada de mando con CPU 4× comprueba precarga efectiva de metadatos y backdrops en ambos sentidos y entre filas, puntuación, colecciones por género y búsqueda acotada. En 30 movimientos: cero solicitudes intermedias, un solo commit final y P95 de 33,1 ms al segundo RAF. La prueba vertical con 27.000 títulos libera nodos anteriores, monta como máximo 40 tarjetas y conserva desplazamiento suave. Son resultados del ordenador; reproducción real de tráilers y rendimiento físico del paquete final siguen pendientes.

## Referencias técnicas

- [Samsung: mejora de rendimiento](https://developer.samsung.com/smarttv/develop/guides/application-performance-improvement/application-performance-improvement.html).
- [Samsung: Web Inspector](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/web-inspector.html).
- [Samsung: aplicaciones, iframe, almacenamiento y ciclo de vida](https://developer.samsung.com/smarttv/develop/getting-started/quick-start-guide.html).
- [Tizen: configuración y navegación permitida](https://github.com/Samsung/tizen-docs/blob/master/docs/application/web/reference/config-xml.md).
- [YouTube: identificación del cliente del reproductor integrado](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity).
- [TMDB: imágenes y variantes válidas](https://developer.themoviedb.org/docs/image-basics) y [configuración](https://developer.themoviedb.org/reference/configuration-details).
- [TMDB: lista oficial de películas mejor valoradas](https://developer.themoviedb.org/reference/movie-top-rated-list), [géneros de películas](https://developer.themoviedb.org/reference/genre-movie-list) y [géneros de series](https://developer.themoviedb.org/reference/genre-tv-list).

