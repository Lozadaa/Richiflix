# Instalar en Samsung TV

El widget apunta a Tizen 6.5+ y se compila para Chromium 85. El SDK y los certificados se mantienen fuera del repositorio.

1. Instala Tizen Studio o el SDK de Tizen para VS Code, junto con Samsung TV Extension y Samsung Certificate Extension.
2. En tu TV activa Developer Mode, indica la IP de tu PC y reinicia. PC y TV deben estar en la misma red.
3. En Certificate Manager crea un perfil Samsung TV con certificado de autor y distribuidor. Agrega el DUID de tu TV. Conserva el certificado de autor para actualizar la app sin cambiar su identidad.
4. Permite la instalación desde Device Manager cuando lo solicite el dispositivo.
5. Ejecuta el instalador con la IP y el nombre de tu perfil:

```powershell
.\scripts\tizen-install.ps1 -TvIP 192.168.1.50 -CertificateProfile MiPerfilSamsung
```

El script compila, conecta, firma, instala y abre el widget. Con el SDK moderno usa una actualización directa, sin desinstalar primero. No ejecutes el instalador si sólo quieres probar en PC; para eso usa `npm run test:pc`.

Las fuentes, TMDB y perfiles se configuran en el propio TV. El paquete público no contiene ningún login predeterminado. Las credenciales se guardan cifradas en IndexedDB; la biblioteca y los perfiles tienen respaldo versionado en el almacenamiento del widget.

Para tráilers configura `VITE_TRAILER_BRIDGE_URL` antes de compilar, siguiendo [la guía del puente](../trailer-bridge/README.md). La comprobación de códecs, autoplay y funcionamiento del mando físico corresponde al modelo de TV utilizado.

Referencias: [SDK Samsung](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html), [conectar un dispositivo](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html), [certificados](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).
