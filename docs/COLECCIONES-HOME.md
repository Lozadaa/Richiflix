# Colecciones y categorías

La fuente de las puntuaciones sigue siendo TMDB. La aplicación no presenta esas notas como IMDb. Los TOP globales de películas y series permanecen en Inicio y, a continuación, aparecen las mejor valoradas estrenadas en los últimos 12 meses. Se consultan los endpoints oficiales `discover/movie` y `discover/tv`, ordenados por `vote_average.desc`, con al menos 200 votos en películas y 100 en series y un intervalo de estreno cerrado hasta hoy. La fila de series usa la fecha de estreno original, no el estreno de su última temporada. Sólo se muestran coincidencias con títulos reproducibles del catálogo.

Después de los TOP aparece «Tu próximo mood»: hasta cuatro colecciones escogidas entre novedades, acción, misterio, comedia, fantasía y ciencia ficción, animación, romance, terror, documentales, drama, clásicos, esta década, los 90 y películas de hasta 100 minutos. Cada receta necesita tres títulos con datos suficientes. La edad y clasificación de Kids no se deducen de estas categorías.

La selección es estable al navegar. Cambia con «Otra selección» o al regresar a Inicio desde otra sección; el perfil y la fecha de Santiago determinan el orden inicial. La elección se guarda localmente y se conserva al recargar. No hay un temporizador que reordene filas debajo del mando.

La portada recuerda la selección sólo dentro de su sección, categoría y búsqueda. Al entrar en una sección vacía, obtener cero resultados o quitar el último favorito, se limpia el banner junto con sus acciones y tráiler. Mover el foco al header dentro de una sección con contenido conserva el título seleccionado.

Películas y Series muestran los TOP, las colecciones y los géneros como chips: izquierda/derecha recorre los filtros, OK los aplica, abajo entra en los resultados y arriba devuelve a la portada. La búsqueda conserva la categoría seleccionada. Las categorías numerosas siguen disponibles en «Más categorías», sin selector nativo.

El catálogo genera las colecciones en el worker o backend de Electron, por lotes cooperativos, y transmite listas de hasta 80 IDs. Los TOP y géneros se guardan durante 24 horas; el nuevo formato conserva también las consultas recientes. La descarga usa dos solicitudes simultáneas, reutiliza el caché y no sustituye una copia completa por una respuesta parcial. La interfaz conserva la virtualización y la precarga de dos filas.

Comprobado en PC: 187 pruebas unitarias, chips con keycodes del mando, búsqueda filtrada, posición de los TOP y colecciones, rotación, recuperación tras recargar y foco del botón. Sin envío ni prueba física en TV.

Referencias: [TMDB Discover Movie](https://developer.themoviedb.org/reference/discover-movie), [TMDB Discover TV](https://developer.themoviedb.org/reference/discover-tv).
