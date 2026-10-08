# Kingdom: cine con personalidad

## Dirección

Una sala de cine personal y juvenil que combina el detalle de una película animada con el cariño de sus mascotas. La ilustración es el elemento expresivo principal; la navegación permanece tranquila. Se conserva la densidad baja de texto pedida por el usuario. Sin tarjetas de marketing, separadores decorativos ni contadores ficticios.

## Tokens

Paleta Solaria (detalle, contrastes y archivos en [BRAND.md](BRAND.md)). En `src/style.css` viven en `:root`; ningún CSS de `src/` repite los valores literales.

- `--bg` #0d172b. Fondo azul noche; también tinta sobre botones de acento.
- `--surface` #1d2d49. Superficies elevadas (diálogos, cabecera activa, paneles).
- `--text` #fff4e4. Texto principal.
- `--text-2` #bac8e0. Texto secundario, iconos y detalles fríos.
- `--accent` #f2b84b. Marca, acción principal, selección y estados destacados.
- `--focus` #fff1d2. Halo y contorno de foco del mando; distinto del acento.
- `--kids` #ff9478. Acento propio del perfil Kids (el foco es el mismo).

Las transparencias usan los canales `--*-rgb` (`rgba(var(--bg-rgb),.6)`): el build de Tizen compila para Chromium 85 y no admite `color-mix()`.

Bricolage Grotesque para marca y títulos, Manrope para controles. Títulos en caja mixta, tamaño suficiente para TV. Marca: corona Solaria y la palabra «Kingdom» (nunca «Player» en la interfaz).

## Composición

Cabecera horizontal → ilustración de cine con título a la izquierda → filas de miniaturas → acceso a MLB. Controles con curvas suaves; los avatares tienen esquinas más redondeadas que las miniaturas. Kids utiliza la misma estructura con acentos cálidos. La navegación tiene continuidad: entrada suave de páginas y filas, destacado con selección manual, carruseles con avance por pantalla y estado en los extremos, respuesta de tarjetas y favoritos, perfiles expresivos y transiciones de entrada y salida de los diálogos. En PC no hay rotación automática que interrumpa la lectura. En modo TV el banner de Inicio es una vitrina de recomendaciones que gira sola cada 9 s, pero nunca mientras se lee o se navega: se detiene con el mando en movimiento, con una tarjeta ampliada, con un tráiler, con un diálogo o con la pantalla oculta, y sólo continúa tras 2 s de reposo y un intervalo completo. Mando en el banner: con el foco en Reproducir, Izquierda/Derecha cambian de recomendación al instante (el foco no se mueve, da la vuelta en los extremos y el intervalo de 9 s vuelve a empezar); el texto cambia en el acto y el arte funde por opacidad, o en cuanto llega si aún no estaba listo. OK breve reproduce (o abre los episodios); mantener OK revela Mi lista junto a Reproducir, como en las tarjetas («Mantén OK para Mi lista» aparece bajo los botones las tres primeras veces por perfil); dentro, Izquierda/Derecha alternan entre los dos botones y Volver, Arriba o Abajo regresan al modo carrusel (Arriba lleva a la cabecera, Abajo a la primera fila). Los puntos son sólo un indicador; en PC se siguen pulsando con el ratón. Se respeta reduced-motion en animaciones, desplazamientos y gestos visuales.

## Ver y volver

Una tarjeta abre el título en una escena de pantalla completa con arte grande, clasificación disponible y acciones principales. Reproducir mantiene la pantalla completa y pasa a un reproductor que ocupa la ventana; carga, reintento y final de reproducción tienen estados visibles. Volver o Escape cierra con una transición y devuelve el foco a la tarjeta original. El estado de pantalla completa que tenía el usuario se restaura al finalizar este flujo. Ajustes e importación conservan diálogos compactos, bloqueo del fondo, foco contenido y cierre con Escape.

Los controles usan botones nativos para Enter y espacio. Flechas navegan por posición y desplazan los carruseles al enfocar tarjetas; Ctrl/Cmd+K abre la búsqueda. Guardar en Mi lista funciona desde cada tarjeta y confirma el resultado visualmente. Las filas montan hasta 40 tarjetas y la grilla conserva bloques de 120: el catálogo completo no crea miles de nodos ni observadores. Ninguna interacción cambia la política de Kids: solo títulos con evidencia de edad verificada hasta 10 años, incluidos búsqueda, historial, favoritos y destacados.

Revisión del brief: se descartó cambiar únicamente el rojo por otro acento. La nueva identidad se apoya en la ilustración propia, tipografía redondeada, marca, avatares y tratamiento deportivo. El contenido sigue siendo lo primero.

## Skills consultadas

- Find Skills, instalada previamente.
- [Frontend Design de Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), consultada directamente; no instalada globalmente.
- Web Design Guidelines de Vercel, revisada como candidata; no aplicada como auditoría en esta tarea.

## Ilustración

Generada con la herramienta integrada image_gen. Archivo: public/art/bunny-woodland.png. Es arte ilustrativo para acompañar Big Buck Bunny, no un fotograma oficial.

Prompt: Wide cinematic feature artwork for a youthful personal movie streaming app Richiflix, to accompany the open short film Big Buck Bunny, illustrative promotional art, not official film still. Wide 16:9 landscape full bleed. A lovable chubby white rabbit with long ears and soft fluffy fur, friendly expressive face, sits at the RIGHT THIRD on a moss-covered rock in a magical woodland clearing. Tiny orange butterflies and a few glowing fireflies. Rounded stylized 3D animated film illustration, polished but tactile playful soft shapes, evening blue woodland, lavender shadows, subtle coral flowers, warm butter-yellow shafts of light. Medium-wide composition, rabbit face readable. Entire LEFT HALF spacious dark blue forest shadow and softly defocused foliage for interface title overlay. No lettering, no text, no logo, no watermark, no border, no frame, no UI. Inviting joyful youthful cinematic mood, rich atmospheric lighting, restrained palette. Output one wide landscape image.


El reproductor usa controles propios: timeline con buffer real, saltos de 10 segundos, volumen, mute, velocidad y fullscreen. Las opciones de calidad, audio y subtítulos aparecen solo cuando existen en la fuente. Sin controles nativos: un solo indicador de carga, retrasado 250 ms para evitar parpadeos al buscar. Fuentes manuales en Ajustes por perfil Adulto, con caché local IndexedDB, edición, actualización de listas y eliminación.


Player para TV: controles principales de 84–168 px, controles secundarios de 64–128 px, etiquetas visibles, foco blanco cálido (`--focus`), rebote breve y superficies suaves con el acento dorado. Las flechas recorren los botones, Arriba lleva a la timeline y Abajo vuelve al vídeo. Enter sobre el vídeo pausa o reproduce. El control de volumen sigue disponible con mouse/Tab y el mando puede saltarlo para alcanzar opciones sin quedar atrapado. Escala compacta para móvil y movimiento reducido respetado.


## Samsung TV / Tizen

TV es Samsung Tizen. Build dedicado Chromium 85 / Tizen 6.5+, superficie AVPlay transparente y coordenadas nativas 1920 x 1080. Mando con foco visible, campos compatibles con IME Samsung, selectores recorribles y regreso por capas. Dock TV: iconos sin etiquetas, botones circulares de 96 px, Play de 128 px, foco blanco cálido y colores suaves. Flecha de regreso sin texto; saltos de 10 segundos integrados en el icono. Player nativo conserva un loader; volumen queda en el mando y opciones se limitan a capacidades expuestas. Certificados y validación en dispositivo: docs/TIZEN.md.


### Player en TV

Solo en TV: controles centrados con retroceso / Play / avance, volumen en el mando, sin control de fullscreen ni Play central duplicado. Las opciones dependen de pistas o ajustes disponibles. Los directos sin DVR no muestran acciones de avance inactivas. El foco sigue el orden visual; los controles se ocultan al dejar de usar el mando. Electron sin Modo TV conserva su player y el volumen guardado.

Mando (bloque D, oct 2026): el foco sólo está en el vídeo o en la fila de botones, nunca en la barra (queda como indicador, `tabIndex=-1`). Desde el vídeo, Izquierda/Derecha saltan con aceleración (10 → 30 → 60 → 120 s por pulsación seguida o cada 250 ms manteniendo); la barra muestra el destino («+1:40 · 23:45») y el salto se aplica una vez, 400 ms después de la última pulsación. MediaRewind/MediaFastForward usan la misma aceleración pero saltan al instante. Abajo u OK muestran los controles y enfocan Play/Pausa (OK también pausa si ya estaban visibles); Arriba o Volver desde la fila vuelven al vídeo. Fila, en orden: episodio anterior · reiniciar · −10 · Play · +10 · episodio siguiente · opciones · señal (· ir al directo con DVR); lo que no aplica no se pinta. La tarjeta «Siguiente episodio» aparece cuando la reproducción entra en los últimos 30 s (un salto no la dispara) o al terminar, toma el foco y cuenta 10 s; OK la lanza, Volver la descarta, una flecha devuelve el foco al vídeo. Tras tres episodios seguidos lanzados por la cuenta atrás sin tocar el mando aparece «¿Sigues ahí?». Cambiar de episodio no cierra el reproductor y el historial se guarda por episodio.

Directo (Fase L6): la cabecera dice la fase del evento («En juego · desde 19:00»), el título limpio y la señal activa («ES · eterbox»); un canal 24 h dice «En directo · categoría» y, si la guía lo aporta, «Ahora · programa». Textos de 22 px o más en TV, sin animación. Un evento con más de una señal muestra «Señal» a la derecha de Play (Arriba desde Play también lo alcanza cuando no hay línea de tiempo); abre un `.playback-menu` con las señales (idioma · fuente, calidad si el título la trae), la activa marcada; Arriba/Abajo recorren, OK cambia de señal sin cerrar el reproductor y Volver cierra el menú devolviendo el foco al botón. ChannelUp/ChannelDown del mando (PageUp/PageDown en PC y Electron) cambian de señal en un evento y de canal de la misma categoría en un canal 24 h, dentro de la lista desde la que se abrió; CH+ (PageUp) es el siguiente. Una pastilla con el destino aparece 1,5 s (sólo opacidad; sin animación con reduced motion). Si la señal falla, el error ofrece Reintentar, «Probar otra señal» (mientras queden señales sin probar) y Volver; el cargador dice «Probando otra señal…» cuando la señal actual es un respaldo.
