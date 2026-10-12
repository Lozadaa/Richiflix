# Kingdom (Richiflix) · reglas del proyecto

## Git: todo en `main`

- **Una sola rama viva: `main`**, local y en GitHub (`origin/main`). No hay ramas de larga duración (`kingdom-main`, `dev`, `release`…): si existe una, se integra en `main` y se borra el mismo día.
- Los worktrees de agentes (Claude Code, Orca, Codex) son temporales: nacen de `main` local (`git merge-base main HEAD` debe ser `main`; los del Agent tool nacen de `origin/main` por defecto y hay que resetearlos con `git checkout -B <rama> main`), se integran en `main` con merge y se borran junto a su rama en cuanto se integran.
- Todo el mundo empuja a `origin/main` (Richard, Rubén y los agentes). Antes de empujar: `git fetch`, `git merge --ff-only origin/main` o rebase local, `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen` en verde.
- Nunca `push --force` sobre `origin/main` salvo decisión explícita de Richard. La historia antigua de Codex quedó en la etiqueta `legacy-codex-main`.
- Commits en español, en presente, con prefijo (`feat`, `fix`, `perf`, `docs`, `test`), mensaje que diga qué cambia para el usuario.

## Secretos y artefactos

- Las credenciales del proveedor viven **sólo** en `.env.local` (`VITE_DEFAULT_SOURCE`), nunca en el código ni en git. `artifacts/` (trazas, capturas, `.wgt`) está fuera de git.

## Rendimiento en el TV (innegociable)

- Sólo `transform`/`opacity` se animan; nada de lecturas de layout por tecla; cero capas permanentes nuevas por tarjeta; sin `backdrop-filter`/`blur`/`mix-blend-mode`/`color-mix()`; `cssTarget` chrome85.
- Todo cambio visible en el TV se mide antes y después con `npm run measure:tv` ×3 en el 55" (relanzando la app antes de cada corrida) y no se integra si empeora. Referencia: `docs/PLAN-RENDIMIENTO-TV-2026-10-07.md` y los `artifacts/tv-measure-*.json` más recientes.
- Nunca instalar en un TV sin que Richard lo pida.

## Pruebas

- `npm test` (node:test), `npm run build`, `npm run build:tizen`, `npm run test:tizen`. Sin smokes de Playwright/Electron salvo petición expresa.
- Toda lógica nueva nace como función pura con prueba.

## Nombres

- La interfaz dice «Kingdom»; el paquete y la ventana «Kingdom Player»; el id Tizen `Richiflix1.Richiflix`, los eventos `richiflix-*` y las claves `rf-*` no se renombran.
