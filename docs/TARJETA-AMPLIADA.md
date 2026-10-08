# Tarjeta ampliada

Al detener el mando durante 180 ms en TV (250 ms con el ratón en PC), la tarjeta seleccionada se amplía. En TV mide entre 1000 y 1120 píxeles de ancho, limitado por la pantalla. La altura se alinea con las tarjetas vecinas. El cartel queda a la izquierda y la sinopsis, puntuación, año, duración e idioma a la derecha, con texto grande.

En PC, las tarjetas de la misma fila se apartan mediante transformaciones animadas. La fila conserva sus índices y su ventana virtual; no se clona el catálogo ni se cambian las medidas de cada tarjeta. En la cuadrícula, las filas siguientes también dejan espacio cuando hace falta. Al navegar, se devuelve el espacio y se descarta la vista previa.

En modo TV las vecinas también se apartan, sólo con `transform` (90–110 ms): el panel es fijo y empieza en el borde izquierdo de su tarjeta, en carrusel y en cuadrícula. En un carrusel todas las tarjetas a la derecha se desplazan como un bloque el ancho del panel menos el de la tarjeta, conservando el hueco; las de la izquierda no se mueven. Si el panel no cabe a la derecha, el carrusel se desplaza una sola vez antes de colocarlo (la pista lleva un margen final fijo para que también quepa la última tarjeta). En la cuadrícula sólo se mueve la fila de la tarjeta; las que saldrían por el borde se atenúan y las filas inferiores no se mueven (si el panel las alcanza, se atenúan). La pista nunca cambia de tamaño. Al navegar, todo vuelve al instante; al salir con calma, se desliza de vuelta. Con movimiento reducido, el desplazamiento ocurre sin animación.

En los carruseles (TV y PC), el panel abre hacia el lado que ya se recorrió: si el centro de la tarjeta pasa de la mitad del carrusel visible, el panel crece hacia la izquierda (su borde derecho coincide con el de la tarjeta), las tarjetas de la izquierda se apartan hacia la izquierda y las de la derecha no se mueven. Alrededor de la mitad hay un margen de media tarjeta: moverse una tarjeta adelante o atrás cerca del centro conserva el lado anterior de ese carrusel. Si no hay sitio a la izquierda, el carrusel se desplaza una sola vez hacia la izquierda antes de colocarlo; si ni así cabe (las primeras tarjetas), abre hacia la derecha como antes. La cuadrícula no cambia.

Ola 4 (7 oct), modo TV: en los carruseles el foco queda anclado a la izquierda (patrón Netflix/Samsung). Cada Derecha o Izquierda desplaza la fila exactamente una tarjeta (`anchoredRailOffset` en `virtualWindow.js`: desplazamiento = índice × (ancho + hueco) − hueco − 40, acotado a [0, máximo]); de la tarjeta anterior asoma el relleno izquierdo + 40 px y el lado derecho queda siempre lleno. La primera tarjeta, las filas más cortas que la vista y el final de la fila (desplazamiento acotado al máximo) no se anclan: ahí el foco recorre la vista. El desplazamiento es un único `scrollTo` al destino y, en la misma tarea, la pista se desliza por el compositor desde la posición dibujada (`translate3d` compensado, `--tv-base`: 110 ms, 90 en Samsung); una tecla a mitad de deslizamiento parte de donde se ve y la vuelta circular (final → inicio) salta sin animación. La ventana virtual se calcula para el destino en la misma tecla. Como la tarjeta enfocada está a la izquierda, el panel abre hacia la derecha y sólo se apartan las vecinas de la derecha; la regla «pasada la mitad abre a la izquierda» sólo actúa al final de la fila, donde la tarjeta deja de estar anclada. El halo único de la fila vive en la pista, así que acompaña a la tarjeta anclada. Las vecinas que no se ven ni antes ni después de apartarse no se animan (no quedan con `fill:forwards` ni capa). PC con ratón no cambia.

## Control remoto

- OK breve reproduce o abre los episodios.
- Mantener OK durante medio segundo entra en los botones de la tarjeta.
- Izquierda y derecha alternan entre reproducir y guardar en Mi lista.
- Volver, arriba o abajo recuperan el foco de la tarjeta.

En PC se puede entrar directamente con el ratón o con Tab.

## Tráiler

La tarjeta usa el tráiler obtenido con los metadatos del título. En TV el vídeo ocupa el banner completo, separado de la cabecera y del catálogo; la imagen y los datos quedan en la tarjeta ampliada. En PC el vídeo aparece como fondo de la tarjeta. Solo se muestra y reserva espacio cuando el reproductor confirma que está reproduciendo. Durante la espera o cuando no hay vídeo, el catálogo sube y las siguientes filas aprovechan la pantalla. El panel seleccionado acompaña el cambio con una transición de posición; los botones ocultos del banner quedan fuera de la navegación del mando. Si no hay tráiler, sigue cargando o el proveedor impide reproducirlo, se conserva la misma imagen y la descripción de la tarjeta. El banner no utiliza imágenes de categoría como sustituto.

Solo una previsualización tiene reproducción activa: el reproductor de la tarjeta pausa el reproductor anterior del banner. El reproductor de tarjetas conserva su iframe y su mismo padre entre títulos; mover un iframe entre elementos lo recarga en los navegadores del TV. Los cambios de tarjeta se aplican al detenerse; no se crean reproductores para cada elemento del catálogo.

La navegación descarta la tarjeta y pausa su vídeo. Abrir una película, un capítulo o un diálogo desmonta los reproductores de previsualización. Los vídeos conservan el comportamiento de audio de la aplicación.

## Validación local

Las pruebas de PC comprueban la expansión, el desplazamiento de las vecinas, el límite de pantalla en la última tarjeta, OK breve y mantenido, Mi lista, Volver y los carruseles circulares. También comprueban la conservación del iframe, un único vídeo activo y la vuelta a la imagen ante un error.

La prueba de catálogo virtual recorre 27.000 títulos y 2.000 movimientos, manteniendo un máximo de 40 tarjetas en la cuadrícula. Los tiempos medidos en Chromium local no certifican el rendimiento del Samsung ni que YouTube permita reproducir cada tráiler.

## Clasificación por edades

Una etiqueta en la esquina superior derecha de la portada y de la tarjeta ampliada muestra el certificado real de TMDB. Se prioriza Chile, después España y Estados Unidos; los certificados extranjeros llevan su región. Se conserva el texto original: PG-13 o TV-14 no se convierten en una edad inventada. Cuando no hay certificado, no aparece una etiqueta. Esto no sustituye las reglas del perfil Kids.

Películas incluyen release_dates y series content_ratings en la misma consulta de sinopsis y vídeos. La clasificación, incluida su ausencia, se guarda en la caché persistente de metadatos (máximo 2000 entradas y 6 MB; 30 días con sinopsis española, 7 días para información parcial). La generación v5 renueva los detalles antiguos al precargarlos. Las próximas dos filas usan la precarga existente, sin una llamada independiente para cada etiqueta.

La etiqueta incorpora un escudo SVG propio: menta para certificados generales, azul para infantiles/familiares, ámbar para orientación y coral para adultos. El símbolo cambia entre marca de verificación, aviso y candado; las etiquetas desconocidas usan un tono neutro. Son colores de la interfaz, no certificaciones propias ni cambios en la selección del perfil Kids. Los certificados largos se sitúan abajo a la derecha para dejar libre la puntuación.

La sombra de unión del vídeo solo aparece durante la reproducción confirmada. Durante la espera, ausencia o error del tráiler no hay una capa de degradado delante de los títulos del catálogo.
