# Escritura con mando Samsung

«Listo» del teclado confirma la edición: en el buscador abre los resultados, en el filtro enfoca una categoría y en formularios pasa al siguiente campo o al botón de guardar. No envía credenciales al terminar un campo. Hay acciones visibles «Ver resultados», «Siguiente campo» / «Listo» y «Terminar edición».

Atrás mientras hay un campo enfocado sale de la edición, conservando el texto y el diálogo. La repetición de esa misma pulsación y su liberación se consumen para que no se conviertan en otra orden de volver sobre la pantalla siguiente. Las letras, borrado, cursores y composición se dejan al teclado nativo; los sliders del reproductor quedan fuera de este manejo.

Samsung usa 65376 para IME Done y 65385 para Cancel, distintos del OK 13 y Return 10009 del mando. Fuente: https://developer.samsung.com/smarttv/develop/guides/user-interaction/keyboardime.html

## Integración acotada

TVTextInput es independiente de App, el catálogo, el reproductor y los formularios. main solo importa y monta el componente y registra su límite de teclas antes de la normalización del mando. No se ha reemplazado el código de esos apartados ni se han cambiado sus reglas de búsqueda. Las consultas conservan su propio flujo asíncrono existente. No se lee ni se replica el valor de las contraseñas para mostrar la ayuda.

## Pruebas

- node --test src/tvTextInput.test.js
- npx vite build --mode tizen --outDir artifacts/input-ux-dist
- node scripts/tv-input-smoke.mjs

La prueba de PC abre la app con un catálogo de demostración, sin emisiones ni credenciales reales. Comprueba Listo, Cancelar, repetición y liberación de Atrás, composición, resultados, filtros y avance en formularios sin guardado automático. El teclado Samsung y la presentación sobre el TV necesitan validación física. La compilación de prueba está separada de dist-tizen para no pisar paquetes de otro trabajo en curso.
