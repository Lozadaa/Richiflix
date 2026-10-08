# Colecciones y categorías

La fuente de las puntuaciones sigue siendo TMDB. La aplicación no presenta esas notas como IMDb. Los TOP globales de películas y series permanecen en Inicio y, a continuación, aparecen las mejor valoradas estrenadas en los últimos 12 meses. Se consultan los endpoints oficiales `discover/movie` y `discover/tv`, ordenados por `vote_average.desc`, con al menos 200 votos en películas y 100 en series y un intervalo de estreno cerrado hasta hoy. La fila de series usa la fecha de estreno original, no el estreno de su última temporada. Sólo se muestran coincidencias con títulos reproducibles del catálogo.

Después de los TOP aparece «Tu próximo mood»: hasta cuatro colecciones escogidas entre novedades, acción, misterio, comedia, fantasía y ciencia ficción, animación, romance, terror, documentales, drama, clásicos, esta década, los 90 y películas de hasta 100 minutos. Cada receta necesita tres títulos con datos suficientes. La edad y clasificación de Kids no se deducen de estas categorías.

La selección es estable al navegar. Cambia con «Otra selección» o al regresar a Inicio desde otra sección; el perfil y la fecha de Santiago determinan el orden inicial. La elección se guarda localmente y se conserva al recargar. No hay un temporizador que reordene filas debajo del mando.

La portada recuerda la selección sólo dentro de su sección, categoría y búsqueda. Al entrar en una sección vacía, obtener cero resultados o quitar el último favorito, se limpia el banner junto con sus acciones y tráiler. Mover el foco al header dentro de una sección con contenido conserva el título seleccionado.

Películas y Series muestran un botón «Filtrar» seguido de géneros, TOP y colecciones como chips. Desde las acciones de la portada, abajo entra en ese botón; abajo otra vez entra en los resultados. Izquierda/derecha recorre los filtros y OK los aplica. El panel permite buscar categorías sin distinguir acentos, elegir una con el mando y volver al botón. Arriba desde su primera fila entra en la búsqueda; OK o abajo desde el campo devuelve a las opciones. Volver con texto limpia el campo y un segundo Volver cierra el panel. La búsqueda de títulos conserva la categoría aplicada y «Todas» elimina el filtro.

Todas las filas de Inicio tienen una tarjeta «Ver todo» al final, aunque contengan un solo título. Izquierda desde el primero llega a esa tarjeta; derecha desde ella regresa al primero. Los TOP y moods abren su categoría exacta; «Continuar viendo» abre su propia colección, incluidas películas y series. El primer título del destino recibe el foco. La tarjeta final usa iconos SVG, presenta el número de títulos y tiene un formato compacto para canales.

El bucle trabaja con índices lógicos, sin clonar imágenes ni montar el catálogo entero. La tarjeta final participa en la navegación y queda fuera de las solicitudes de metadatos. Las ventanas se retiran al cambiar de extremo y conservan el botón enfocado al confirmar un scroll pendiente, incluso durante ráfagas del mando.

El catálogo genera las colecciones en el worker o backend de Electron, por lotes cooperativos, y transmite listas de hasta 80 IDs. Los TOP y géneros se guardan durante 24 horas; el nuevo formato conserva también las consultas recientes. La descarga usa dos solicitudes simultáneas, reutiliza el caché y no sustituye una copia completa por una respuesta parcial. La interfaz conserva la virtualización y la precarga de dos filas.

Comprobado en PC: 202 pruebas unitarias, chips y panel con keycodes del mando, búsqueda filtrada, bucle en ambos extremos, «Ver todo» de TOP/moods/series/canales y colección mixta. La prueba con 27.000 títulos recorre 1.500 movimientos de cuadrícula y 500 de carrusel, conserva un máximo de 40 tarjetas de cuadrícula y comprueba saltos hasta la acción final sin clones. Estas medidas locales no certifican el rendimiento del hardware Samsung.

Referencias: [TMDB Discover Movie](https://developer.themoviedb.org/reference/discover-movie), [TMDB Discover TV](https://developer.themoviedb.org/reference/discover-tv).
