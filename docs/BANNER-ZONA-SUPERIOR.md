# Banner reservado a la zona superior en TV

El banner de recomendaciones aparece al navegar por la cabecera o por sus propias acciones. Al bajar al catálogo, filtros o tarjeta ampliada, se oculta y el catálogo aprovecha ese espacio. Permanece oculto aunque termine una carga, se amplíe una tarjeta o se deje de pulsar el control. Arriba vuelve a la misma recomendación.

La ocultación pausa el tráiler y la rotación de recomendaciones. El tráiler de una película seleccionada se dibuja dentro de su tarjeta ampliada cuando el banner está oculto, evitando cubrir filas del catálogo. Al regresar arriba se libera la selección de la tarjeta y puede reanudarse el tráiler del banner.

La transición combina opacidad y traslación. El viewport cambia de tamaño una sola vez al cruzar de zona; su contenido compensa ese salto con la misma animación usada por la navegación vertical. No se anima `top` ni `height` en cada fotograma, y un cambio de dirección cancela y recompone el movimiento existente. El modo de movimiento reducido evita las animaciones.

El control remoto determina la zona mediante el foco. El ratón solo la cambia si se mueve realmente: los eventos de entrada causados por un cambio de layout debajo de un cursor inmóvil no reabren ni ocultan el banner. Rueda y gesto sobre el catálogo también lo ocultan; los diálogos conservan la zona previa.

Archivos principales: `src/useTVBannerVisibility.js`, `src/App.jsx`, `src/FocusStage.jsx`, `src/compositorMotion.css`, `src/virtualViewport.js`, `src/useCardExpansion.js` y el comentario de navegación en `src/useRemoteNavigation.js`.

Verificación en PC:

```powershell
node --test src/virtualViewport.test.js src/bannerFlow.test.js src/virtualWindow.test.js
npx vite build --mode tizen --outDir artifacts/banner-zone-dist
node scripts/banner-zone-smoke.mjs
node --input-type=module -e "process.env.RF_RAIL_TEST_DIST='artifacts/banner-zone-dist'; await import('./scripts/rail-anchor-smoke.mjs');"
npx vite build --outDir artifacts/banner-zone-pc-dist
```

El test de zona usa contenido ficticio y un reproductor YouTube simulado, sin solicitudes externas ni credenciales. Comprueba aparición, ocultación persistente, retorno, cambios rápidos, pausa del reproductor, conservación de la recomendación, tráiler dentro de la tarjeta, rueda y movimiento reducido. También se repite la regresión del ancla lateral con este viewport.

Las compilaciones y capturas se guardan separadamente de los paquetes de instalación. Esta corrección no se ha instalado ni comprobado físicamente en Samsung.
