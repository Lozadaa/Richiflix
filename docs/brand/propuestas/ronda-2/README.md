# Kingdom · ronda 2

Abrir `index.html` en el navegador. Comparativa autónoma con coronas curvas, lettering de contornos propios, tres acentos cálidos y superficies azules elevadas. Cada propuesta incluye símbolo, Kingdom, Kingdom Player y paleta JSON.

- **Solaria:** oro #f2b84b, gema en negativo, foco blanco cálido #fff1d2.
- **Brasa:** coral #ff7a59, corte lateral asimétrico, foco mantequilla #f5d58d.
- **Aurora:** cobre #f5a66a, play redondeado integrado, foco azul claro #b9d8ff.

Los tres escenarios tienen cabecera de 1920 px con Inicio/Películas/Series/TV en vivo/MLB/Mi lista y el activo marcado, búsqueda y perfil, botón Reproducir y cuatro tarjetas con la segunda enfocada. La composición toma la estructura, espaciados, tarjetas y curvas de `src/style.css`; es una muestra de diseño con degradados y títulos ficticios, no una captura del catálogo. Si la ventana es menor, el lienzo permite desplazamiento horizontal sin reducir la escala. Los símbolos también se muestran a 16/48/512 px sobre fondo y póster con placa oscura.

Validación: los nueve SVG contienen únicamente svg/g/path, sin texto ni recursos externos. AA ≥4.5:1 para texto principal/secundario sobre fondo y superficie, acento y Kids sobre fondo y tinta sobre botones. Foco ≥3:1 sobre fondo/superficie y distinto del acento. La superficie oscura elevada es decorativa y no exige 3:1 sobre fondo; la selección siempre lleva halo. La separación oscura de 6 px protege el halo del arte. Se revisaron las tres propuestas renderizadas en Chromium.

Reproducción desde la raíz: `python docs/brand/propuestas/ronda-2/generar.py` reconstruye HTML y verifica SVG y ratios. Los argumentos `1`, `2` y `3` regeneran la carpeta correspondiente. Usa solo Python estándar y reutiliza los contornos y fórmula de `../generar.py`; la página final no depende de ese archivo ni de Python para abrirse. No se crean archivos de caché.

Esta ronda modifica únicamente `docs/brand/propuestas/ronda-2/`. Selección y exportación para aplicación/Tizen quedan en G2.
