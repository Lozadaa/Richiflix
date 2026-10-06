# Caché de sinopsis y portadas

Las sinopsis en español, los títulos traducidos y las URL de previews ya se guardaban localmente, con un límite anterior de 128 títulos. Ahora el caché conserva hasta **2.000 títulos y 6 MiB**. Las sinopsis confirmadas en español duran **30 días**; los detalles del proveedor sin traducción confirmada, siete días; una respuesta vacía, cinco minutos. El texto, el enlace al tráiler y las rutas de imágenes se conservan juntos. Las claves siguen separando fuente, título y configuración de TMDB: cambiar una conexión no mezcla información de proveedores.

Las imágenes públicas de TMDB tienen un caché de archivos comprimidos en IndexedDB: **48 MiB, 200 archivos, cuatro MiB por archivo y 14 días** como máximos. El presupuesto se reduce si la cuota o el espacio disponible estimado son menores. Se eliminan las entradas caducadas y las menos usadas; un fallo de cuota permite una sola limpieza y reintento, después pausa las escrituras durante 15 minutos. No se cambia la resolución ni se recomprimen las imágenes.

El caché usa un worker independiente. Sólo carga su pequeño índice al arrancar; los archivos se leen individualmente cuando hacen falta. La preparación comienza durante el loader inicial sin retrasar la entrada a los perfiles. Las lecturas tienen un margen máximo de 90 ms antes de seguir con la URL habitual. Una respuesta tardía no reemplaza una imagen que ya comenzó a cargar. Tras una descarga y decodificación correctas, se intenta guardar la imagen en segundo plano con hasta dos solicitudes y una cola limitada. La petición usa el caché HTTP disponible; según las cabeceras del servidor puede requerir otra petición.

Las URL Blob se comparten entre consumidores activos y se revocan cuando el último sale del DOM. Las dos portadas precargadas conservan su límite previo de 20 MiB de memoria decodificada. Si un archivo guardado no decodifica, se descarta y se intenta la imagen original. Los proveedores IPTV mantienen el caché normal del navegador; no se fuerza una petición CORS ni se guardan imágenes que incluyan credenciales. Los recursos de categorías y logos incluidos en el paquete ya son locales.

No se descargan películas, canales ni vídeos de tráilers. Se conserva únicamente el ID del tráiler para volver a abrirlo por streaming. El sistema puede recuperar las imágenes guardadas sin conexión; esto no convierte el catálogo o la reproducción en un servicio offline completo.

Comprobado en PC con 198 pruebas unitarias, recarga sin red con cero solicitudes de imagen, liberación de las URL Blob, recuperación de una imagen corrupta y el worker clásico incluido en el paquete Tizen. La navegación del banner conserva 33,4 ms en el percentil 95 de la medida de teclado al segundo frame con CPU simulada cuatro veces más lenta, sin tareas largas registradas. Son pruebas de Chromium, no medidas de un Samsung físico. No se conecta ni instala en el TV.

```powershell
npm test
npm run build:tizen
node scripts/artwork-cache-smoke.mjs
```

La elección de IndexedDB y el trabajo asíncrono sigue [la documentación de IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). La compatibilidad física debe verificarse en el modelo de Samsung mediante su [especificación de motor web](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html).
