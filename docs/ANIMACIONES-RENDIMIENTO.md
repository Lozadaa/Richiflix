# Movimiento sin redibujar cada fotograma

Las transiciones frecuentes usan `transform` y `opacity`: posición, escala, aparición y halos. Fondos, sombras, bordes y gradientes se pintan al cambiar de estado; sus valores no se interpolan durante cada fotograma. La transición al tráiler desvanece capas de fondo y degradado ya creadas.

La vista ampliada tiene sus dimensiones finales antes de empezar la animación. El tamaño no se anima. Las tarjetas vecinas se apartan mediante transformaciones y las lecturas de geometría del carrusel se hacen antes de escribir sus transformaciones. La tarjeta reserva 24 píxeles bajo el título de la fila.

Los vecinos reciben `will-change: transform` durante un máximo de 600 ms. Un arrendamiento renovado no puede ser eliminado por un temporizador anterior. Al finalizar el movimiento se recupera el estilo previo. Las tarjetas inactivas no conservan una sugerencia de capa por cada cartel. Solo el elemento seleccionado puede mantenerla mientras tiene el foco.

Las animaciones de entrada conservan su aspecto inicial durante el retraso y liberan su estado animado al finalizar. El modo de movimiento reducido conserva foco, funciones y tamaños sin estas transiciones.

## Medición local

La prueba `scripts/compositor-motion-smoke.mjs` utiliza la interfaz real, Chromium y la traza de DevTools. Compara en la misma ejecución el estilo anterior y el nuevo, con fuentes e imágenes ya estabilizadas. Desactiva temporalmente la hoja de optimización para medir el control; no modifica el código de la aplicación.

Resultado en PC, 1920 × 1080:

| Medición | Antes | Después |
| --- | ---: | ---: |
| Eventos Paint al entrar/salir del botón de navegación | 57 | 9 |
| Sugerencias permanentes de capa en el catálogo tras salir | 24 | 0 |
| Eventos Paint durante el tramo estable de la animación de la tarjeta | 0 | 0 |
| Eventos Layout durante esa animación | 0 | 0 |

El pintado inicial de capas, nuevas imágenes y texto sigue siendo necesario. Los fotogramas de un vídeo también cambian. Estas mediciones no significan cero trabajo de GPU ni certifican el rendimiento del Samsung: corresponden a Chromium local con un catálogo artificial y sin vídeo externo.

La prueba de ventana virtual mantiene un máximo de 40 tarjetas montadas al recorrer 27.000 títulos y 2.000 movimientos. El vídeo de la tarjeta conserva el mismo iframe y solo una previsualización puede estar reproduciendo a la vez.

Referencias: [animaciones eficientes](https://web.dev/articles/animations-guide), [repintados y capas en DevTools](https://developer.chrome.com/docs/devtools/rendering/performance), [uso de will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change).
