# Richiflix en Samsung TV

La app tiene dos destinos: Electron para Windows y un widget Web de Samsung Tizen. Se comparten pantallas, fuentes, perfiles, catálogo y regla Kids. El TV reproduce a través de AVPlay, sin Electron ni un PC ejecutando la interfaz.

## Compatibilidad de esta versión

Objetivo inicial: **Tizen 6.5 o posterior**, Samsung TV de **2022 en adelante**. Samsung documenta Chromium M85 en 2022, M94 en 2023 y M108 en 2024: [motores por año](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html). Se probó físicamente en un Samsung **UN65M70HAGXZS con Tizen 10.0**, a 1920 × 1080. El manifiesto limita la instalación a 6.5+. No cambies solo `required_version` para modelos anteriores: necesitan revisar JavaScript, estilos, API y códecs.

El build transpila para Chromium 85 y usa un bundle clásico para evitar depender del soporte parcial de módulos. Incluye compatibilidad para `inert`, UUID, temporización de fetch, `inset`, `:has()`, alturas de pantalla y proporción de tarjetas. La interfaz de TV se presenta a 1920 × 1080 y Samsung la escala; el plano AVPlay siempre usa coordenadas 1920 × 1080, incluso en UHD: [resolución](https://developer.samsung.com/smarttv/develop/guides/fundamentals/managing-screen-resolution.html).

## Compilar y comprobar

```powershell
npm install
npm run build:tizen
npm test
npm run test:tizen
```

Salida: `dist-tizen/`, con `config.xml`, icono PNG 117 × 117, API Samsung declarada en el HTML, estilos y cliente Xtream con el login personal de eterboxtv preconfigurado. También se crea `artifacts/Richiflix-Tizen-unsigned.wgt`. **Ese archivo aún no se puede instalar: no tiene firma Samsung.** `npm run preview:tizen` sirve la interfaz para revisión en un navegador; AVPlay requiere el TV, y esa vista usa el player web.

`test:tizen` verifica el paquete y la interfaz con un decoder Samsung simulado: códigos físicos del mando, Enter, Volver, Play/Pause, avance, menús, un loader, transparencia del plano de vídeo, perfiles y filtro Kids. Los tests unitarios cubren estados de AVPlay, milisegundos/segundos, seek serializado, cierre durante preparación, suspensión/restauración y audio en pausa. No certifican decodificación ni compatibilidad de streams en un televisor real.

## Preparar el televisor una vez

1. Instala [Tizen Studio y Samsung TV Extension](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html), incluyendo Samsung Certificate Extension.
2. PC y TV deben estar en la misma red. En Apps/App Settings del TV introduce `12345`, activa Developer Mode, introduce la IP del **PC** y reinicia el TV. La ubicación del menú depende del firmware. [Guía de dispositivo Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html).
3. Conecta el TV mediante Remote Device Manager/SDB, usando la IP del **TV** y puerto 26101.
4. En Certificate Manager crea un perfil **Samsung TV**, certificado de autor y distribuidor con el **DUID de ese TV**. Este paso requiere tu cuenta Samsung de desarrollador; Richiflix sigue usando perfiles locales sin cuentas. Conserva el certificado de autor para poder actualizar la app. [Certificados Samsung](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).
5. En Device Manager usa **Permit to install applications** para ese TV cuando lo requiera el SDK.

## Firmar, instalar y abrir

Con el SDK y perfil ya creados:

```powershell
.\scripts\tizen-install.ps1 -TvIP 192.168.1.50 -CertificateProfile RichiflixTV
```

Sustituye la IP y nombre de perfil. El script detecta Tizen Studio clásico o el SDK instalado desde Visual Studio Code mediante `.tizen.path.config`. Para otra carpeta añade `-SdkPath`; con la CLI moderna `tz` puedes indicar también `-ProfilesPath`. Compila, conecta, firma, instala y abre; se detiene ante un error. Con el SDK moderno firma mediante `tz pack`, envía el paquete a la ruta de herramientas informada por el TV y usa `vd_appinstall` directamente sin desinstalar antes. Comprueba la confirmación «install completed», porque el daemon puede devolver código cero ante un fallo. Se verificó esta actualización sobre el widget existente en Tizen 10.0. `tz install` desinstala primero y no se usa en el script. La CLI moderna recibe el ID de paquete `Richiflix1` al abrir, mientras que la clásica recibe el ID de aplicación `Richiflix1.Richiflix`.

Equivalente manual, con `tizen` y `sdb` disponibles en PATH:

```powershell
npm run build:tizen
sdb connect 192.168.1.50:26101
tizen package -t wgt -s RichiflixTV -- .\dist-tizen
tizen install -s 192.168.1.50:26101 -n Richiflix.wgt -- .\dist-tizen
tizen run -s 192.168.1.50:26101 -p Richiflix1.Richiflix
```

[Comandos oficiales de Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html). El 5 de octubre de 2026 se firmó con el perfil Samsung `Richard`, se instaló en `192.168.1.12:26101` (Tizen 10.0) y el TV confirmó su lanzamiento. El paquete firmado está en `artifacts/Richiflix-Tizen.wgt`.

La actualización de rendimiento y recuperación de directos se instaló después con el mismo perfil y certificado de autor, manteniendo `Richiflix1.Richiflix` y sin desinstalar. Samsung confirmó `install completed` y el lanzamiento del proceso. Esto confirma el despliegue; no certifica todavía el buffering o los tráilers en una señal real del TV.

## Mando y reproducción

- Flechas: navegar por catálogo y controles; en selectores, izquierda/derecha cambia la opción y arriba/abajo cambia el foco. Enter: seleccionar o Play/Pause cuando el foco está en vídeo.
- En Samsung, la portada muestra información mientras el foco está en una tarjeta; sus botones permanecen ocultos. Enter en la tarjeta reproduce o abre episodios. Arriba recorre las filas anteriores y, desde el límite superior, entra en las acciones de portada: Reproducir y Mi lista. Abajo vuelve a la misma tarjeta. Al entrar en portada, menú o diálogo desaparecen el halo y la ampliación de la tarjeta, sin perder la selección ni su posición. En Windows se conservan las acciones al pasar el ratón.
- Play/Pause, Play, Pause, Stop, avance y retroceso: registrados si el mando los ofrece. Volumen y encendido quedan gestionados por Samsung.
- Volver: sale del teclado de un campo, cierra opciones, vuelve del player/detalle al catálogo, vuelve a Inicio y después al selector de perfiles. Desde perfiles pide confirmar la salida. [Teclas Samsung](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html).
- Player: controles grandes, Play central entre retroceso y avance, sin barra de volumen ni cambio de pantalla completa. Las opciones solo aparecen cuando hay pistas o ajustes seleccionables; los directos sin DVR ocultan los saltos y el regreso al directo. El player se oculta tras inactividad del mando. Un solo loader, apertura asíncrona, saltos VOD, progreso por perfil, cambio de audio ofrecido por la fuente, cierre del decoder y suspensión/restauración al cambiar de aplicación. Protector de pantalla habilitado al pausar o salir.
- Directos sin ventana DVR confirmada no ofrecen avance. Calidad adaptativa la gestiona AVPlay; esta versión no expone velocidad ni selección de subtítulos AVPlay. El volumen se controla con el mando. Esta limpieza también se aplica al activar Modo TV en Electron; el player de escritorio conserva sus controles y su preferencia de volumen. Verificación del mando y controles: `npm run test:tizen`.

[AVPlay](https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html) reproduce formatos admitidos por el modelo. Tener una URL no garantiza emisión activa, códec compatible, acceso regional, permisos ni ausencia de DRM. No hay integración DRM de proveedores.

## Login Xtream

eterboxtv está listo desde el primer arranque: al entrar a Adulto se carga el catálogo sin introducir credenciales. Es la fuente principal fija de Ajustes, donde puedes cambiar su login o restaurar el original. Puedes agregar más conexiones Xtream y quitar las adicionales. El login se valida con `player_api.php` y carga canales, películas, series y categorías. Las temporadas y episodios se consultan al abrir una serie; AVPlay recibe la URL del episodio de su proveedor correspondiente.

El WGT personal incluye el login de fábrica solicitado, pero no el catálogo: lo obtiene del IPTV. Los cambios de login y fuentes adicionales se guardan cifrados mediante AES-GCM y WebCrypto en IndexedDB local del TV. Se conservan las conexiones guardadas al actualizar. El PC usa almacenamiento independiente protegido por Windows. En el Samsung real se confirmó la carga del catálogo del proveedor mediante el worker y se conservaron los perfiles tras actualizar. El manifiesto declara acceso de red y privilegio de Internet; esto no sustituye las políticas del servidor.

También viene preconfigurada la API key personal de TMDB para metadatos en español, portadas y tráileres disponibles para el ID que entrega el IPTV. En Ajustes puedes reemplazarla, desconectar TMDB o restaurar tu clave original. Los cambios y la desconexión se conservan cifrados en el TV al reiniciar; la clave no se muestra en pantalla.

Kids oculta todo contenido sin evidencia específica de edad de hasta 10 años. No hay PIN para cambiar a Adulto.

## Medición física del banner

El inspector del Samsung confirmó el worker activo y la cabecera transparente integrada en el fondo. La navegación oculta el banner durante la ráfaga y cambia sólo al último título. La prueba inicial detectó un P95 de 215,2 ms hasta el segundo `requestAnimationFrame`; las trazas localizaron trabajo de raster y decodificación de imágenes, aunque los manejadores de teclado eran breves.

Una comparación en el mismo TV conservando las capas de las tarjetas redujo el P95 de 268,8 a 67,2 ms sin quitar la ampliación. `src/tvCardComposition.css` aplica esa composición sólo en Samsung y dibuja el halo de foco en una capa de opacidad independiente. El DOM virtual limita las tarjetas retenidas. Esta comparación aislada no certifica FPS ni sustituye la medición del paquete final.

En este widget, YouTube devolvió el error **153: identificación del cliente**. Las pruebas simuladas validan reutilización, sonido y cancelación del iframe, pero no demuestran que ese tráiler se reproduzca físicamente. Cuando falla, el banner conserva el arte del título. No se ha validado una solución de origen/referrer para el entorno `file://` de Tizen.

Se preparó `trailer-bridge/dist/index.html`, una página HTTP(S) propia con el reproductor oficial. El build admite `VITE_TRAILER_BRIDGE_URL` e incorpora su origen exacto en las dos políticas de frames y navegación del widget. El adaptador valida origen, emisor, sesión y generación y conserva un único player. `scripts/trailer-bridge-smoke.mjs` comprobó, desde un padre `file://`, que la solicitud interior incluye el Referer HTTP real y que se conservan sonido, reutilización, pausa, limpieza y errores antes de `ready`. Simula YouTube: **la página todavía no está servida/configurada en el TV ni se ha confirmado reproducción física**. La elección de alojamiento o PC en LAN está pendiente. Instrucciones en `trailer-bridge/README.md`.

También se amplió la consulta de vídeos TMDB a `es,en,null`, priorizando español, para obtener un tráiler en inglés si falta uno español, sin otra petición ni cambiar título/sinopsis. Los detalles incompletos del IPTV ya no borran un tráiler o imagen válidos del catálogo. Una nueva generación de caché de detalles renueva sólo esos metadatos; fuentes, catálogo y perfiles mantienen su almacenamiento.


Banner y navegación (octubre de 2026): el arte permanece detrás del catálogo y el header conserva el último título; al cargar metadatos o decodificar imágenes no se monta el fallback. El fallback aparece al confirmar ausencia o error. Las filas fuera del margen se desmontan, conservando únicamente geometría y el foco. El desplazamiento vertical usa una única interpolación escalar por viewport, cancelable, con destino actualizado y finalización en hasta 220 ms desde la última entrada (sin lecturas de geometría por frame ni estado React). Respeta movimiento reducido.

Las categorías se preparan junto al catálogo, incluyen géneros suministrados por la fuente y se reutilizan. El selector usa botones para el mando; búsqueda y categorías se limitan a Películas, Series, TV en vivo, MLB o Mi lista según la sección. La precarga al detenerse conserva hasta dos imágenes y 20 MiB estimados de memoria decodificada; nunca precarga los títulos atravesados durante el movimiento. Validaciones: `node scripts/banner-artwork-smoke.mjs`, `node scripts/vertical-navigation-smoke.mjs`, `node scripts/banner-navigation-smoke.mjs`. Las cifras de Chromium no son mediciones del hardware Samsung.
