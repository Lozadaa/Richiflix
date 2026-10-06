# Tarjeta ampliada

Al detener el mando durante 250 ms, la tarjeta seleccionada se amplía. En TV mide entre 1000 y 1120 píxeles de ancho, limitado por la pantalla. El cartel queda a la izquierda y la sinopsis, puntuación, año, duración e idioma a la derecha, con texto grande.

Las tarjetas de la misma fila se apartan mediante transformaciones animadas. La fila conserva sus índices y su ventana virtual; no se clona el catálogo ni se cambian las medidas de cada tarjeta. En la cuadrícula, las filas siguientes también dejan espacio cuando hace falta. Al navegar, se devuelve el espacio y se descarta la vista previa.

## Control remoto

- OK breve reproduce o abre los episodios.
- Mantener OK durante medio segundo entra en los botones de la tarjeta.
- Izquierda y derecha alternan entre reproducir y guardar en Mi lista.
- Volver, arriba o abajo recuperan el foco de la tarjeta.

En PC se puede entrar directamente con el ratón o con Tab.

## Tráiler

La tarjeta usa el tráiler obtenido con los metadatos del título. En TV el vídeo ocupa el banner completo, separado de la cabecera y del catálogo; la imagen y los datos quedan en la tarjeta ampliada. En PC el vídeo aparece como fondo de la tarjeta. Solo se muestra cuando el reproductor confirma que está reproduciendo. Si no hay tráiler, sigue cargando o el proveedor impide reproducirlo, se conserva la misma imagen y la descripción de la tarjeta. El banner no utiliza imágenes de categoría como sustituto.

Solo una previsualización tiene reproducción activa: el reproductor de la tarjeta pausa el reproductor anterior del banner. El reproductor de tarjetas conserva su iframe y su mismo padre entre títulos; mover un iframe entre elementos lo recarga en los navegadores del TV. Los cambios de tarjeta se aplican al detenerse; no se crean reproductores para cada elemento del catálogo.

La navegación descarta la tarjeta y pausa su vídeo. Abrir una película, un capítulo o un diálogo desmonta los reproductores de previsualización. Los vídeos conservan el comportamiento de audio de la aplicación.

## Validación local

Las pruebas de PC comprueban la expansión, el desplazamiento de las vecinas, el límite de pantalla en la última tarjeta, OK breve y mantenido, Mi lista, Volver y los carruseles circulares. También comprueban la conservación del iframe, un único vídeo activo y la vuelta a la imagen ante un error.

La prueba de catálogo virtual recorre 27.000 títulos y 2.000 movimientos, manteniendo un máximo de 40 tarjetas en la cuadrícula. Los tiempos medidos en Chromium local no certifican el rendimiento del Samsung ni que YouTube permita reproducir cada tráiler.
