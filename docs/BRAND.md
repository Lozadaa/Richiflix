# Kingdom Player

En la interfaz la app se llama **Kingdom**: cabecera, perfiles, loader, reproductor y `<title>` de la página. «Kingdom Player» aparece solo en metadatos del paquete (`tizen/config.xml` `<name>`, `productName` de `package.json`), en el título de la ventana de Electron y en la documentación. El id del paquete Tizen `Richiflix1.Richiflix` no cambia: cambiarlo obligaría a desinstalar y se perderían perfiles y conexiones. La app instalada se actualiza como siempre.

## Solaria

La identidad elegida entre las propuestas de la ronda 2 (`docs/brand/propuestas/ronda-2/`, comparativa en `index.html`). Una corona de tres puntas elásticas, con hombros redondeados y una gema de rombo ancho tallada en negativo; un arco claro debajo le da el gesto de una joya. Sin ornamento pequeño: a 16 px la reconocen la silueta y el vacío de la gema.

- Un solo acento dorado más un neutro claro. Sin texto dentro del símbolo.
- Sobre fotografía o póster, siempre con placa del color de fondo y al menos 8 unidades de margen (cuadrícula de 64).
- No alterar el espaciado del lettering ni añadir detalles. Los SVG solo contienen `svg`/`g`/`path`/`rect`: sin bitmaps ni fuentes.

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg` | #0d172b | Fondo azul noche; tinta sobre botones de acento |
| `--surface` | #1d2d49 | Superficies elevadas |
| `--text` | #fff4e4 | Texto principal |
| `--text-2` | #bac8e0 | Texto secundario e iconos |
| `--accent` | #f2b84b | Marca, acción principal, selección |
| `--focus` | #fff1d2 | Halo y contorno de foco del mando |
| `--kids` | #ff9478 | Acento del perfil Kids (mismo foco) |

Contrastes WCAG medidos (de `docs/brand/propuestas/ronda-2/01-solaria/paleta.json`): texto/fondo 16,44; texto secundario/fondo 10,58; acento/fondo 9,99; foco/fondo 15,98; texto/superficie 12,67; texto secundario/superficie 8,15; foco/superficie 12,31; tinta de fondo sobre botón de acento 9,99; Kids/fondo 8,31. Texto normal ≥ 4,5:1 y foco ≥ 3:1 en todos los casos. La superficie es decorativa (1,30 sobre el fondo): nunca es el único indicador de foco; la selección siempre lleva halo.

Los tokens viven en `:root` de `src/style.css`, con sus canales `--*-rgb` para transparencias (`rgba(var(--focus-rgb),.3)`), porque el build de Tizen compila para Chromium 85 y no admite `color-mix()`. El halo de foco usa `--focus`; el perfil Kids usa `--kids`. Las reglas de rendimiento del TV no cambian con la paleta: ni sombras ni filtros nuevos.

## Archivos

- `public/brand/kingdom.svg`: icono maestro, la corona sobre una placa redondeada `--bg`. Fuente de todos los PNG y del ICO; también el favicon y la marca de la cabecera.
- `public/brand/kingdom-glyph.svg`: la corona sola, sin placa (loader de arranque y del reproductor).
- `public/brand/kingdom-wordmark-player.svg`: lettering «Kingdom Player», reservado para metadatos y documentación; nunca en la interfaz.
- `public/brand/kingdom.ico`: icono Windows con 16, 24, 32, 48, 64, 128 y 256, color de 32 bits y transparencia.
- `public/brand/kingdom-117.png` y `tizen/icon.png`: icono del lanzador Samsung (117 × 117). El empaquetado copia `tizen/icon.png` como `icon.png`, indicado en `config.xml`.
- PNG adicionales 16–1024 para otros usos. Todos se renderizan directamente desde el vector.

`npm run brand:export` regenera los PNG, el ICO y `tizen/icon.png` con Chromium de Playwright. `npm run windows:shortcut` genera `Richiflix.lnk` (nombre técnico conservado) en la carpeta del proyecto, con el icono propio y el directorio de inicio correcto. La ventana define su icono, identificador y datos de relanzamiento Windows. El acceso directo abre la compilación local de `dist/`; ejecuta `npm run build` después de editar código. No se ha creado un instalador ni modificado el ejecutable de Electron.

Samsung documenta [117 × 117 para el icono de pruebas en TV](https://developer.samsung.com/smarttv/design/smart-tv-application-design-qa.html). Los recursos de publicación en Samsung Apps son otro proceso; este proyecto se instala de forma privada y el WGT todavía necesita firma.

## Nombres técnicos que no cambian

Para no perder datos de los usuarios ni romper la instalación: id y paquete Tizen (`Richiflix1.Richiflix`, `Richiflix1`), `name` de `package.json`, eventos `richiflix-*`, `window.richiflix`, el protocolo `richiflix:` de Electron, el identificador de Windows `local.richiflix`, las claves `rf-*` de almacenamiento, la base IndexedDB `richiflix-artwork`, el bundle `assets/richiflix.js` y el nombre de `artifacts/Richiflix-Tizen-unsigned.wgt` que usa `scripts/tizen-install.ps1`.

## Imágenes

`QualityImage` se utiliza en portadas, destacados, detalles y avatares. Espera `load` y `decode()` antes de revelar una imagen, y comprueba el tamaño nativo frente al espacio que ocupará, su recorte y la densidad de pantalla. Al ampliar la ventana vuelve a comprobar la resolución. Un cambio de título descarta el resultado anterior, aunque termine de cargar tarde.

Las imágenes insuficientes o fallidas se sustituyen por el fondo vectorial de Kingdom; el catálogo conserva el título y la reproducción. Los logos de canales se muestran contenidos, sin ampliarlos más allá de su resolución nativa. Las imágenes aptas aparecen con un fundido; una imagen que deja de ser apta se oculta inmediatamente. El player no muestra un poster de resolución desconocida antes del vídeo y conserva un solo loader.

Los perfiles usan el fondo vectorial de Kingdom y conservan sus avatares propios. La política de imágenes se aplica al catálogo de eterboxtv; no restringe la resolución ni la disponibilidad de los streams.

`npm test` comprueba los cálculos de resolución y `node electron/images-smoke.cjs` verifica carga y decode pendientes, imágenes pequeñas, cambios de tamaño, errores y cambios rápidos de destacado en Electron. `npm run test:tizen` comprueba que el WGT incluye el PNG propio de 117 y la interfaz TV con APIs simuladas.
