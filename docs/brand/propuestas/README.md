# Kingdom · propuestas G1

Abrir `index.html` directamente en un navegador. La página no usa recursos externos, JavaScript ni fuentes web. Compara Almena, Umbral y Corona abierta con muestras a 16, 48 y 512 px, sobre fondo y póster de degradado, cabeceras de 1920 px, lettering y variante para metadatos.

Cada carpeta contiene `simbolo.svg`, `kingdom.svg`, `kingdom-player.svg`, `paleta.json` y notas de uso. Los SVG se construyen con formas originales; las letras son contornos, sin dependencia de fuentes instaladas. Los nombres de archivos son de propuesta, pendientes de selección para G2.

## Reproducción y comprobación

Desde la raíz del repositorio, ejecutar `python docs/brand/propuestas/generar.py` para reconstruir la página y validar los nueve SVG y contrastes. Requiere solo la biblioteca estándar de Python, sin instalar paquetes. Los argumentos `1`, `2` y `3` reconstruyen los recursos de la propuesta correspondiente.

Comprobado: XML de los nueve SVG; ausencia de texto SVG, bitmaps, recursos externos y scripts en la página; contraste ≥ 4.5:1 de superficie, texto, texto secundario, acento, foco y Kids sobre fondo (antes de redondear); foco diferente del acento; comparación renderizada en Chromium. El token fondo contra sí mismo es 1:1 y no tiene criterio AA. Las superficies claras llevan tinta del token fondo. El halo usa una separación oscura para evitar perderse junto al acento o una superficie clara.

La versión entregada contiene solo documentos de propuesta. La selección, exportaciones PNG/ICO, actualización de BRAND/DESIGN e integración en aplicación y Tizen quedan para G2 según el alcance explícito de este worktree.
