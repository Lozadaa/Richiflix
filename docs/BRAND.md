# Richiflix

La marca es una R coral con un play recortado y una diagonal lavanda sobre azul noche. El mismo vector se usa dentro de la app, en el navegador, en Windows y en el paquete Samsung Tizen. Es un recurso vectorial propio, sin fotografías de stock ni iconos de Electron en la ventana.

## Archivos

- `public/brand/richiflix.svg`: original editable.
- `public/brand/richiflix.ico`: icono Windows con tamaños 16, 24, 32, 48, 64, 128 y 256, color de 32 bits y transparencia.
- `public/brand/richiflix-117.png`: icono del launcher para instalación privada Tizen. El empaquetado lo copia como `icon.png`, indicado en `config.xml`.
- PNG adicionales hasta 1024 para otros usos. Todos se renderizan directamente desde el vector.

`npm run brand:export` regenera los recursos con Chromium de Playwright. `npm run windows:shortcut` genera `Richiflix.lnk` en la carpeta del proyecto, con el icono propio y el directorio de inicio correcto. La ventana define su icono, identificador y datos de relanzamiento Windows. El acceso directo abre la compilación local de `dist/`; ejecuta `npm run build` después de editar código. No se ha creado un instalador ni modificado el ejecutable de Electron.

Samsung documenta [117 × 117 para el icono de pruebas en TV](https://developer.samsung.com/smarttv/design/smart-tv-application-design-qa.html). Los recursos de publicación en Samsung Apps son otro proceso; este proyecto se instala de forma privada y el WGT todavía necesita firma.

## Imágenes

`QualityImage` se utiliza en portadas, destacados, detalles y avatares. Espera `load` y `decode()` antes de revelar una imagen, y comprueba el tamaño nativo frente al espacio que ocupará, su recorte y la densidad de pantalla. Al ampliar la ventana vuelve a comprobar la resolución. Un cambio de título descarta el resultado anterior, aunque termine de cargar tarde.

Las imágenes insuficientes o fallidas se sustituyen por el fondo vectorial de Richiflix; el catálogo conserva el título y la reproducción. Los logos de canales se muestran contenidos, sin ampliarlos más allá de su resolución nativa. Las imágenes aptas aparecen con un fundido; una imagen que deja de ser apta se oculta inmediatamente. El player no muestra un poster de resolución desconocida antes del vídeo y conserva un solo loader.

Los contenidos de muestra de Blender y NASA+ se retiraron del catálogo por selección del usuario, junto con la ilustración de Big Buck Bunny. Los perfiles usan ahora el fondo vectorial de Richiflix y conservan sus avatares propios. La política de imágenes se aplica al catálogo de eterboxtv; no restringe la resolución ni la disponibilidad de los streams.

`npm test` comprueba los cálculos de resolución y `node electron/images-smoke.cjs` verifica carga y decode pendientes, imágenes pequeñas, cambios de tamaño, errores y cambios rápidos de destacado en Electron. `npm run test:tizen` comprueba que el WGT incluye el PNG propio de 117 y la interfaz TV con APIs simuladas.
