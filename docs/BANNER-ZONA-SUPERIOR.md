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

## «Destacado vivo» (11 oct 2026)

El banner de Inicio en TV deja de ser un carrusel con puntos. Conserva el arte grande, el logo del título, el tráiler, el Ken Burns y el tinte ambiental, y cambia la interacción:

- Botones con texto: **▶ Reproducir · + Mi lista · ⓘ Más info**, recorridos con Izquierda/Derecha. Ya no hace falta mantener OK para Mi lista.
- En lugar de los puntos, la tarjeta **«A continuación»** (esquina inferior derecha) muestra la siguiente recomendación con su miniatura y una línea que se llena mientras el banner rota solo. Es el último botón de la fila: OK salta a esa recomendación y el foco se queda ahí para seguir pasando.
- La recomendación rota sola **solo cuando nadie está en el banner**. Con el foco en sus botones se detiene, y una lista refrescada mientras tanto (metadatos, tops TMDB) espera a que el usuario salga: nada cambia bajo sus ojos.
- La placa de «A continuación» es sólida y translúcida, sin `backdrop-filter`: en Samsung un desenfoque a pantalla completa es la capa más cara.

Archivos: `src/FocusStage.jsx`, `src/App.jsx` (`stageFocused`, `heldSlides`), `src/compositorMotion.css`, `src/useRemoteNavigation.js`.
