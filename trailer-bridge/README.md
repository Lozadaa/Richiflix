# Reproductor de tráilers Richiflix

`dist/index.html` es un documento estático propio que contiene el reproductor oficial de YouTube. Servido por HTTP(S), el navegador proporciona un origen y Referer reales. No contiene el catálogo, credenciales IPTV, clave TMDB, perfiles ni estado de la biblioteca.

El iframe de la app envía sólo el ID del vídeo y comandos de reproducción. Una sesión aleatoria de 32 bytes en el fragmento de URL, validación de emisor/origen y una generación por vídeo descartan mensajes ajenos y selecciones anteriores. El player y sus dos niveles de iframe se reutilizan; se mantienen el sonido y la pausa inmediata al navegar. Se muestra vídeo únicamente tras `PLAYING` del ID vigente. Fallos de autoplay y de vídeo no disponible conservan la portada.

## Servir desde el PC

Desde la carpeta de Richiflix:

```powershell
node scripts/serve-trailer-bridge.mjs
```

El servidor sólo ofrece el documento del reproductor. Permanece abierto mientras se usa el TV; el PC y el TV deben estar en la misma red. `RICHIFLIX_TRAILER_PORT` permite cambiar el puerto predeterminado 59338. Configura el build con la dirección real del PC:

```powershell
$env:VITE_TRAILER_BRIDGE_URL='http://IP-DEL-PC:59338/index.html'
npm run build:tizen
```

## Alojar una página HTTPS

Publica únicamente `dist/` en un alojamiento estático que permita iframe sin iniciar sesión. Configura `VITE_TRAILER_BRIDGE_URL` con la URL real de esa página antes de compilar. El widget y HTML incorporan automáticamente ese origen en `frame-src` y `allow-navigation`; no se abre acceso de frames a dominios arbitrarios.

La página del reproductor necesita acceso anónimo para que el TV la abra desde el widget. Elige un alojamiento propio y configura su URL antes de compilar el paquete; el repositorio no incluye un servicio de producción preconfigurado.

Sin una URL de puente configurada se conserva el reproductor directo anterior. Esto no resuelve el error 153 observado en el widget Samsung; la página debe servirse y configurarse para comprobarlo físicamente.

## Verificación

`node scripts/trailer-bridge-smoke.mjs` prueba transporte desde un padre `file://`, Referer HTTP real, reutilización, sonido, cancelación y errores. Simula YouTube y no certifica decodificación/autoplay en el Samsung.

Referencias: [YouTube: error 153](https://developers.google.com/youtube/iframe_api_reference#onError), [identidad y Referer](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity).
