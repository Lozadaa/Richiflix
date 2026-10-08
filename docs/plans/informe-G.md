# Informe G2 · Integración de la marca Kingdom (Solaria)

Fecha: 8 de octubre de 2026. Rama `Lozadaa/kingdom-G2-integracion` (worktree de Orca), creada desde `main` en `e84f488`. Propuesta elegida por Richard: **Solaria** (`docs/brand/propuestas/ronda-2/01-solaria/`). No se tocó el TV.

## Commits (uno por paso)

| Paso | Commit | Qué |
|---|---|---|
| 1 | `fc2abf8` | SVG en `public/brand/`, `scripts/export-brand.mjs` con nombres `kingdom-*`, PNG 16–1024, `kingdom.ico` y `tizen/icon.png` 117×117 |
| 2 | `a0c399a` | `src/Brand.jsx`: corona y texto «Kingdom» |
| 3 | `c306968` | Paleta Solaria en `:root` y tokens en vez de colores literales en `src/*.css` |
| 4 | `3ed11ce` | Nombres: interfaz «Kingdom»; paquete, ventana y documentación «Kingdom Player» |
| 5 | `abae010` | Prueba `src/brandNames.test.js`: en `src/` e `index.html` solo quedan nombres técnicos `richiflix` |

## 1. Archivos de marca

- `public/brand/kingdom.svg`: **icono maestro**, la corona Solaria sobre una placa redondeada `#0d172b` (cuadrícula de 64, margen ≥ 8 unidades de la corona, como pide el README de Solaria). Ocupa el lugar del antiguo `richiflix.svg`, que también era el icono con placa: de él salen los PNG, el ICO, el favicon y la marca de la cabecera.
- `public/brand/kingdom-glyph.svg` = `simbolo.svg` de Solaria, sin cambios (loader de arranque y del reproductor).
- `public/brand/kingdom-wordmark-player.svg` = `kingdom-player.svg` de Solaria, sin cambios (solo metadatos y documentación).
- `scripts/export-brand.mjs`: mismo mecanismo (Chromium de Playwright, ya instalado); ahora lee `kingdom.svg`, escribe `kingdom-{16…1024}.png`, `kingdom.ico` (16–256) y además `tizen/icon.png`. `scripts/package-tizen.mjs` copia `tizen/icon.png` al WGT.
- Se borraron `public/brand/richiflix*`; se actualizaron las referencias en `electron/main.cjs` (icono de ventana), `electron/images-smoke.cjs`, `scripts/tizen-smoke.mjs`, `index.html` y `src/Boot.jsx` (precarga del glifo).

Desviación menor: el `kingdom.svg` de Solaria es el lettering «Kingdom», no un icono cuadrado. Como el plan reserva `public/brand/kingdom.svg` para el icono que alimenta los PNG, lo compuse con la corona sobre placa. El lettering de Solaria no se integró: la cabecera usa el texto «Kingdom» en Bricolage Grotesque, como pide la tarea y como indica el README de Solaria («los títulos mantienen Bricolage Grotesque/Manrope en G2»). Si Richard prefiere el lettering vectorial en la cabecera, basta con añadirlo como `public/brand/kingdom-wordmark.svg` y usarlo en `Brand`.

## 2. `Brand.jsx`

`BrandMark` → `kingdom.svg`, `BrandGlyph` → `kingdom-glyph.svg`, `Brand` → marca + `<span>Kingdom</span>`. Las clases CSS `richiflix-mark`, `richiflix-glyph` y `richiflix-art` pasaron a `kingdom-*` (en `style.css`, `QualityImage.jsx` y dos smokes que solo las usan como selectores).

## 3. Paleta

`:root` en `src/style.css`: `--bg #0d172b`, `--surface #1d2d49`, `--text #fff4e4`, `--text-2 #bac8e0`, `--accent #f2b84b`, `--focus #fff1d2`, `--kids #ff9478`, más los canales `--*-rgb` para transparencias. Desaparecen `--red`, `--coral`, `--lavender`, `--butter` e `--ink` (también en `CategoryMark.jsx`).

**Restricción encontrada:** el build de Tizen compila con `cssTarget: 'chrome85'`, que no admite `color-mix()`. Por eso las variantes con alfa (`#101827ed`, `#f5d58d1f`…) se escriben como `rgba(var(--bg-rgb),.93)`; está comprobado en `dist-tizen` que salen intactas y que no hay ningún `color-mix`.

Sustitución (script de un solo uso, 223 líneas en 13 CSS y `CategoryMark.jsx`, sin reglas ni propiedades nuevas, solo valores de color):

| Antes | Después |
|---|---|
| Noche `#101827` y derivados | `--bg` |
| Mantequilla `#f5d58d` | `--focus` en reglas de foco/halo; `--kids` en `.kids-space` (salvo foco); `--accent` en destacados (eyebrow, «pronto», guardado…) |
| Coral `#ff977f`, `#ffbba9`, `#ffb39c` | `--accent`; `--focus` en contornos y reglas de foco (incluido el `:focus-visible` global) |
| Hover claros `#ffb09d`, `#ffd3c9` | `--focus` |
| Lavanda `#c1b0ee` | `--text-2` (detalle frío); `--accent` en seleccionado/activo/guardado/botones de reproducir; `--focus` en foco |
| Nube `#f2f0f8` y blancos teñidos | `--text` |
| Bruma `#aeb8c9`, `#bdb5e9` | `--text-2` |
| Superficies `#182336`, `#253047` | `--surface` (como `color:` sobre relleno → `--bg`) |
| Tintas oscuras sobre rellenos (`color:` `#152239`, `#172135`…) | `--bg` |
| Avatares/tiles Kids `#eaa627`/`#efb333` | `--kids` con tinta `--bg` |

Halo de foco = `--focus` (`.rail-halo`, `.card-open:after`, contornos de botones). Kids = `--kids`, con el mismo foco (como define Solaria). Reglas de rendimiento del TV intactas: ni sombras ni filtros ni `will-change` nuevos. Siguen literales los blancos/negros genéricos (`#fff`, `#0005`…) y algunos grises de detalle que no pertenecían a la paleta anterior.

## 4. Nombres

- Interfaz: `<title>Kingdom</title>`, favicons `kingdom.svg`/`kingdom-32.png`/`kingdom-256.png`, `theme-color` y fondo del arranque inline en `#0d172b`; loader «Preparando Kingdom»; cabecera y perfiles con `Brand`; «Salir de Kingdom»; etiqueta por defecto de `Dialog`; «TU KINGDOM» en Ajustes; mensaje «Este contenido está bloqueado en Kingdom.».
- Metadatos: `tizen/config.xml` `<name>Kingdom Player</name>` (id `Richiflix1.Richiflix` y package `Richiflix1` **sin cambios**); `package.json` `"productName": "Kingdom Player"` (`name` sigue siendo `richiflix`); Electron `title`, `relaunchDisplayName` y `backgroundColor` actualizados, más `page-title-updated` con `preventDefault` para que la ventana no pase a mostrar el `<title>` «Kingdom».
- `scripts/tv-cdp.mjs` encontraba la página del inspector del TV por `title === 'Richiflix'`; ahora acepta «Kingdom» o «Richiflix», así que `measure:tv` sigue funcionando antes y después de instalar.
- Smokes actualizados a los nuevos textos (`performance-smoke`, `tizen-smoke`).
- Documentación: `README.md` (nombre y lista de nombres técnicos conservados), `docs/BRAND.md` reescrito con Solaria, `docs/DESIGN.md` (tokens y foco blanco cálido). El prompt histórico de una ilustración en `DESIGN.md` conserva «Richiflix» porque es el texto literal que se usó.

## 5. Comprobación de nombres

`src/brandNames.test.js` (dentro de `npm test`) quita los patrones técnicos permitidos y falla si queda cualquier `richiflix` en `src/` o `index.html`; lo comprobé reintroduciendo «Richiflix» en `Brand.jsx` (falla) y deshaciendo el cambio. Lo que queda: eventos `richiflix-*`, `window.richiflix`/`globalThis.richiflix`, propiedades internas `richiflixRemote`/`richiflixPointerMoved`/`__richiflixPerformance`, bases IndexedDB `richiflix-xtream`/`richiflix-library`/`richiflix-artwork`, nombres de worker, el protocolo `richiflix:` y `richiflix.local`. Las claves `rf-*` no se tocaron.

No se renombraron (técnicos, documentados en `docs/BRAND.md`): `artifacts/Richiflix-Tizen-unsigned.wgt` y `assets/richiflix.js` (los usa `scripts/tizen-install.ps1`), `Richiflix.lnk`, `local.richiflix`.

## Verificación

- `npm test`: **356/356** (355 previas + la nueva).
- `npm run build`: OK.
- `npm run build:tizen` y después `npm run test:tizen`: **OK** («Tizen smoke OK: … Kids y salida»).
- WGT: `<tizen:application id="Richiflix1.Richiflix" package="Richiflix1" …/>`, `<name>Kingdom Player</name>`, `icon.png` idéntico a `tizen/icon.png` (117×117), `<title>Kingdom</title>`.
- Capturas de la fixture headless (solo lecturas), en `artifacts/` (ignorado por git): `kingdom-loader.png`, `kingdom-perfiles.png`, `kingdom-cabecera.png`, `kingdom-fila-foco.png`. Además el smoke regeneró las capturas versionadas `player-loader-preview.png` y `tizen-player-preview.png` con la marca nueva.

**Hallazgo sobre `test:tizen`:** falla también en `main`/`e84f488`, antes de G2 (comprobado en un worktree temporal). La causa es que el smoke espera el login de fábrica (`VITE_DEFAULT_SOURCE`, en `.env.local`, ignorado por git) y los worktrees de Orca no lo tienen. Copié el `.env.local` del checkout principal a este worktree (sigue ignorado por git; el smoke desvía la API del proveedor a la fixture, así que no sale nada a la red) y con él pasa. Los demás agentes van a encontrar el mismo fallo en sus worktrees. Ojo: con ese archivo, el `.wgt` generado lleva el login de fábrica, igual que los builds del checkout principal.

## Pendiente (Richard)

- Paso 4 del plan, en el TV y cuando Richard lo indique: icono en el lanzador de Samsung, cabecera, perfiles, loader, fila con foco y reproductor.
- Al integrar con el bloque E (otro agente, en paralelo): `PlaybackSidebar`/`playbackSidebar.css` nacen fuera de esta rama. Si traen literales de la paleta anterior (el plan sugiere `rgba(16,24,39,.55)`), hay que pasarlos a `rgba(var(--bg-rgb),.55)`. No toqué `Player.jsx`, `avplay.js` ni `platform.js`.
