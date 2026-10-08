# Tarjeta ampliada: navegación lateral en TV

La tarjeta enfocada permanece en la primera posición de la fila, dejando un fragmento de la anterior visible. La ampliación abre hacia la derecha. Al avanzar o retroceder, incluida la última película y «Ver todo», el foco no cruza la mitad de la pantalla ni cambia de lado.

El fallo tenía dos causas: el desplazamiento se limitaba al ancho original del catálogo al llegar a sus últimos elementos y la ampliación elegía el lado izquierdo después de cruzar el centro. La reserva final fija de 960 px tampoco permitía que el último elemento alcanzase el ancla en una pantalla de 1920 px.

Ahora la reserva vacía sigue el ancho medido de la fila. No añade tarjetas, imágenes ni copias al DOM, ni cambia el tamaño al abrir una ampliación. El límite del desplazamiento, su caché y el indicador de avance usan la misma geometría. La navegación de TV conserva las animaciones de composición y la virtualización; la colocación para el ratón en PC mantiene su comportamiento.

Archivos de esta corrección:

- `src/virtualWindow.js`: reserva y desplazamiento anclado.
- `src/VirtualCarousel.jsx`: reserva del carrusel, límite e información de desplazamiento.
- `src/useCardExpansion.js`: dirección estable de apertura en TV.
- `src/expandedCard.css`: reserva vacía dependiente del viewport.
- `src/virtualWindow.test.js`: límites, filas cortas, vuelta circular y presupuesto del DOM.
- `scripts/rail-anchor-smoke.mjs`: regresión en navegador con catálogo ficticio, sin proveedor ni credenciales.
- `scripts/pc-experience-smoke.mjs`: expectativa de ampliación actualizada al ancla izquierda.

Verificación reproducible en PC:

```powershell
node --test src/virtualWindow.test.js src/cardExpansion.test.js
npx vite build --mode tizen --outDir artifacts/rail-fix-dist
node scripts/rail-anchor-smoke.mjs
npx vite build --outDir artifacts/rail-fix-pc-dist
```

La prueba de navegador comprueba las 241 posiciones de la fila larga, el último título, vuelta circular en ambos sentidos, ráfagas, cambio de dirección con una ampliación abierta, fila corta y liberación de animaciones al salir. Guarda la captura y las mediciones en `artifacts/rail-fix/`. Verifica que el desplazamiento real alcanza el valor esperado y que el foco continúa antes del centro.

La corrección se integra en el árbol privado actual, conservando los cambios de otros trabajos. Los directorios de compilación son independientes de los paquetes usados para instalar en TV. No se ha instalado ni comprobado físicamente en Samsung en este cambio.
