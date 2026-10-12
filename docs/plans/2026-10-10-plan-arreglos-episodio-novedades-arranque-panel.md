# Plan de implementación · Siguiente episodio, recién llegados, aviso de arranque, panel persistente, visto/progreso y pantalla final

> **Para los agentes ejecutores (Opus, un worktree por lote):** sub-skill `superpowers:subagent-driven-development` o `superpowers:executing-plans`, tarea por tarea. Antes de empezar: `git merge-base main HEAD` debe ser `main` local (los worktrees del Agent tool nacen de `origin/main`, historia ajena: `git checkout -B <rama> main`). Cada tarea termina con `npm test` en verde y un commit. Sólo se tocan los archivos del lote; si hace falta otro, se anota en el informe y se para. Sin smokes de Playwright/Electron (sólo `npm run test:tizen`). Nunca instalar en el TV.

**Objetivo:** cuatro arreglos pedidos por Richard el 10 oct 2026: (A) al terminar un episodio, una cuenta atrás visible y cancelable que «te lleva» al siguiente; (B) una fila aparte con los títulos que no estaban antes en el catálogo; (C) que el aviso «La primera carga necesita más tiempo» deje de salir en cada arranque, y acortar el arranque en caliente; (D) que al moverse en horizontal dentro de una fila el panel ampliado no desaparezca y reaparezca, sino que se quede y cambie su contenido mientras la fila rueda.

**Arquitectura:** A y B son cambios acotados sobre piezas existentes (`NextEpisodeCard`, `sourceRegistry` + `tvHome`). C es un parche de una línea más una medición con un atajo probable (no re-sanear una caché ya saneada). D es el cambio grande: el panel pasa de pertenecer a cada tarjeta a pertenecer a la fila (un solo `section.card-expansion` por rail que cambia de ancla y de contenido); las cuadrículas siguen como hoy. Toda lógica nueva nace como función pura con prueba `node --test`.

**Stack:** React 19, Vite, `node:test`, IndexedDB vía `deviceStorage`, worker de catálogo, Tizen AVPlay.

**Diseño aprobado en chat (10 oct):** ver cada lote. Mapa del estado actual: informe del agente de exploración del 10 oct (resumido en cada lote).

## Restricciones globales

- Movimiento en TV: sólo `transform`/`opacity`; nada de lecturas de layout en el camino de la tecla; sin capas permanentes nuevas por tarjeta; sin `backdrop-filter`/`blur`/`color-mix()`; `cssTarget` chrome85 (no `inset` a secas). Perilla para cada animación nueva donde haya duda.
- Rendimiento es innegociable: `npm run measure:tv` ×3 en el 55" antes y después de D; no se integra si P95 (fase de traza, 350 ms, mismo índice de arranque) empeora más allá del ruido (referencia 8 oct: P50 109–113 / P95 143–212, capas tras 20 teclas 83–84) o si aparece `Layout` nuevo por tecla.
- Textos en español; «Kingdom» en la interfaz; id Tizen intacto; eventos `richiflix-*` y claves `rf-*` no se renombran.
- Credenciales sólo en `.env.local`; `artifacts/` fuera de git.

## Enfoque de revisión

1. **Episodio sin siguiente** (último de la temporada o serie sin más temporadas): al terminar no hay cuenta atrás; se muestra el estado terminado de siempre. Prueba en A1.
2. **Cancelar la cuenta atrás y dejar el reproductor abierto**: Volver cancela y no cierra el reproductor; un segundo Volver sí cierra. Prueba en A2 (mapa de teclas) y verificación en TV.
3. **Primera carga del catálogo** (sin registro previo): nada se marca como recién llegado; en la segunda carga, sólo los ids nuevos. Ids que desaparecen se olvidan. Prueba en B1.
4. **Caché saneada por una política anterior**: se vuelve a sanear (no se salta). Prueba en C3.
5. **Movimiento horizontal con ráfaga de 10 teclas**: el panel no se desmonta nunca, el contenido muestra el último título asentado, y al cambiar de fila (Abajo) el panel se cierra como hoy. Verificación en D4 con identidad del nodo DOM.

---

## Lote A · Siguiente episodio con cuenta atrás

**Hoy:** la tarjeta aparece a T−30 s y empieza una cuenta de 10 s, así que el siguiente episodio arranca a T−20 s (se come los créditos); no hay barra ni animación; una flecha devuelve el foco al vídeo pero la cuenta sigue; Volver la descarta.

**Diseño:** dos modos. `notice` a T−30 s: tarjeta compacta como la actual, **sin** cuenta atrás, botón «Ver ahora». `countdown` al terminar el episodio (`ended`): tarjeta grande centrada abajo con la imagen del episodio, «Siguiente episodio · T1 · E3», el título, la línea «Empieza en 8», una barra que se llena en 8 s (`scaleX`, compositor) y dos botones: «Ver ahora» (con foco) y «Cancelar». Entra deslizando (`translateY(24px)→0` + opacidad, `--tv-slow`). Volver o «Cancelar» → se queda el estado «Reproducción terminada» con «Ver siguiente episodio» y «Volver al catálogo». La regla de 3 reproducciones automáticas seguidas («¿Sigues ahí?») se mantiene.

**Archivos:** `src/nextEpisodeFlow.js` (nuevo, + test), `src/NextEpisodeCard.jsx`, `src/Player.jsx` (líneas ~162-170, 284-287), `src/playerControls.css` (`.next-episode-*`), `src/playerKeys.test.js` no cambia.

### Tarea A1: fase del siguiente episodio (pura)

**Interfaces:** `nextEpisodePhase({position,duration,previous,ended,hasNext,dismissed,lead=30})` → `'none'|'notice'|'countdown'`. `countdownStep(state,{now})` → `{secondsLeft,done}` para `COUNTDOWN_MS=8000`.

- [ ] **Paso 1: prueba que falla** (`src/nextEpisodeFlow.test.js`)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {nextEpisodePhase,countdownStep,COUNTDOWN_MS} from './nextEpisodeFlow.js';

test('aviso al cruzar T-30 en reproducción normal, cuenta atrás sólo al terminar',()=>{
 const base={duration:1200,hasNext:true,dismissed:false,ended:false};
 assert.equal(nextEpisodePhase({...base,previous:1160,position:1171}),'notice');
 assert.equal(nextEpisodePhase({...base,previous:100,position:1171}),'none','un salto no cuenta');
 assert.equal(nextEpisodePhase({...base,previous:1171,position:1172}),'notice','sigue avisando dentro de los 30 s');
 assert.equal(nextEpisodePhase({...base,previous:1199,position:1200,ended:true}),'countdown');
 assert.equal(nextEpisodePhase({...base,previous:1199,position:1200,ended:true,hasNext:false}),'none');
 assert.equal(nextEpisodePhase({...base,previous:1199,position:1200,ended:true,dismissed:true}),'none');
});
test('la cuenta atrás dura 8 s y termina en 0',()=>{
 const start=countdownStep(null,{now:1000});assert.deepEqual(start,{startedAt:1000,secondsLeft:8,done:false});
 assert.equal(countdownStep(start,{now:1000+3500}).secondsLeft,5);
 assert.deepEqual(countdownStep(start,{now:1000+COUNTDOWN_MS}),{startedAt:1000,secondsLeft:0,done:true});
});
```

- [ ] **Paso 2:** `node --test src/nextEpisodeFlow.test.js` → falla (módulo inexistente).
- [ ] **Paso 3: implementación**

```js
// A1: la tarjeta compacta avisa en los últimos 30 s (sin reloj); la cuenta atrás de 8 s sólo empieza al terminar.
export const COUNTDOWN_MS=8000;
export function nextEpisodePhase({position,duration,previous,ended=false,hasNext=false,dismissed=false,lead=30}){
 if(!hasNext||dismissed)return 'none';
 if(ended)return 'countdown';
 if(!(duration>lead))return 'none';
 const inLead=position>=duration-lead,natural=position-previous<=2&&position>=previous;
 return inLead&&natural?'notice':'none';
}
export function countdownStep(state,{now}){
 const startedAt=state?.startedAt??now,elapsed=Math.max(0,now-startedAt);
 return {startedAt,secondsLeft:Math.max(0,Math.ceil((COUNTDOWN_MS-elapsed)/1000)),done:elapsed>=COUNTDOWN_MS};
}
```

Nota: hoy `naturalCross` (`seekAccumulator.js:27`) sólo es verdadero en el fotograma en que se cruza T−30; `nextEpisodePhase` devuelve `notice` mientras se esté dentro de los 30 s con avance natural, así que `Player` puede llamarla en cada `timeupdate` sin estado extra. `naturalCross` se queda para `intro`/otros usos si los hay; si nadie más la usa, se borra con su prueba.

- [ ] **Paso 4:** prueba en verde. **Paso 5:** `git commit -m "feat(A1): fase del siguiente episodio y cuenta atrás de 8 s"`.

### Tarea A2: `NextEpisodeCard` con dos modos

- [ ] **Paso 1:** `NextEpisodeCard({episode,mode,onPlay,onDismiss,onLeave})`. `mode='notice'`: estructura actual sin reloj, botón «Ver ahora», flechas → `onLeave`, Volver → `onDismiss`. `mode='countdown'`: `useEffect` con `setInterval` de 250 ms que aplica `countdownStep` y, al `done`, llama `onPlay(true)` una sola vez; render:

```jsx
<section className={`player-prompt next-episode-card is-${mode}`} aria-label="Siguiente episodio" onKeyDown={keys}>
 <div className="next-episode-art"><QualityImage src={episode.image} fallback={false}/></div>
 <div className="next-episode-copy">
  <span>Siguiente episodio{episodeLabel(episode)&&` · ${episodeLabel(episode)}`}</span>
  <strong>{displayText(episode.title)}</strong>
  {mode==='countdown'&&<em className="next-episode-count" aria-live="polite">{`Empieza en ${secondsLeft}`}</em>}
  {mode==='countdown'&&<i className="next-episode-bar" aria-hidden="true"/>}
 </div>
 <div className="next-episode-actions">
  <button ref={primary} className="primary" onClick={()=>onPlay(false)}><Play fill="currentColor" size={22}/> Ver ahora</button>
  {mode==='countdown'&&<button className="secondary" onClick={onDismiss}>Cancelar</button>}
 </div>
</section>
```

Teclas en `countdown`: Izquierda/Derecha alternan los dos botones (foco), OK pulsa, Volver → `onDismiss`, Arriba/Abajo nada. En `notice`: como hoy.

- [ ] **Paso 2: CSS** (`playerControls.css`, junto a `.next-episode-card`): `.next-episode-card.is-countdown{animation:next-episode-in var(--tv-slow,180ms) ease-out both}` con `@keyframes next-episode-in{from{opacity:0;transform:translateY(24px)}}`; `.next-episode-bar{display:block;height:4px;margin-top:10px;border-radius:2px;background:var(--accent);transform-origin:left;transform:scaleX(0);animation:next-episode-fill 8s linear forwards}` + `@keyframes next-episode-fill{to{transform:scaleX(1)}}`; `.next-episode-count{font-style:normal;color:var(--accent);font-weight:700}`; `.next-episode-actions{display:flex;gap:12px}`; `@media(prefers-reduced-motion:reduce)` sin la entrada deslizante (la barra sigue). TV: tarjeta 1040 px como hoy; en `is-countdown` la imagen 360 px y la tipografía un punto mayor.
- [ ] **Paso 3:** `npm test`, `npm run build`; commit `feat(A2): tarjeta de siguiente episodio con aviso y cuenta atrás`.

### Tarea A3: cableado en `Player`

- [ ] **Paso 1:** sustituir el `useEffect` de `naturalCross` (`Player.jsx:162-163`) por uno que calcule `const phase=nextEpisodePhase({position:media.current,duration:media.duration,previous:lastPosition.current,ended,hasNext:Boolean(nextEpisode),dismissed:nextDismissed.current})` y mantenga `setNextMode(phase)` (estado `'none'|'notice'|'countdown'`; `notice` no vuelve a `none` por pausa). `nextCard` desaparece.
- [ ] **Paso 2:** render (`:284`): `nextMode!=='none'&&nextEpisode&&!stillThere&&<NextEpisodeCard key={`${nextEpisode.id}:${nextMode}`} episode={nextEpisode} mode={nextMode} onPlay={auto=>toEpisode(nextEpisode,auto)} onDismiss={dismissNext} onLeave={…}/>`. `dismissNext` deja `nextMode='none'`; el estado «Reproducción terminada» (`:287`) añade `{nextEpisode&&<button className="primary" onClick={()=>toEpisode(nextEpisode)}>Ver siguiente episodio</button>}` antes de «Volver al catálogo».
- [ ] **Paso 3:** `toEpisode` sin cambios (cuenta de 3 automáticas). Comprobar que un `change` fallido («Episodio no disponible») vuelve a `none`.
- [ ] **Paso 4:** `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen` (el smoke de Tizen pulsa la cuenta atrás: si rompe por el texto «Empieza en», ajustar el smoke y anotarlo). Commit `feat(A3): cuenta atrás al terminar el episodio, aviso sin reloj a T-30`.

**Verificación en TV (yo):** episodio corto o salto al final con el cursor; al terminar: tarjeta grande, barra llenándose, «Empieza en 8…0», arranca el siguiente; repetir y pulsar Volver a mitad → se queda en «Reproducción terminada» con «Ver siguiente episodio»; Volver de nuevo cierra. Captura `artifacts/siguiente-episodio-55.png`.

---

## Lote B · Recién llegados (títulos que no estaban)

**Hoy:** sólo existe `addedAt` del proveedor (campo `added`, que las series casi nunca traen); cada actualización sobreescribe la caché; no hay diff ni «primera vez visto».

**Diseño:** un registro por fuente `first-seen-<sourceId>` en `deviceStorage`: `{baselineAt, seen:{[id]:ms}}`. En cada carga desde el proveedor (`sourceCatalogue` con `force`), los ids nuevos se sellan con `now`, los desaparecidos se olvidan; la primera vez (sin registro) todo entra con `baselineAt=now` y **nada** cuenta como nuevo. Cada ítem recibe `firstSeenAt` (sólo si es posterior al `baselineAt`). Fila nueva «Recién llegados» (cejilla «NOVEDADES») con lo visto por primera vez en 14 días, más reciente primero, máximo 40, oculta si vacía, separada de «Nuevo esta semana» (que sigue siendo la fecha del proveedor). La insignia NUEVO también sale en recién llegados.

**Archivos:** `src/firstSeen.js` (nuevo, + test), `src/sourceRegistry.js`, `src/tvHome.js` (+ test), `src/App.jsx` (sólo filas y memos junto a `fresh`), `docs/plans/informe-B-recien-llegados.md`.

### Tarea B1: registro puro

- [ ] **Paso 1: prueba** (`src/firstSeen.test.js`)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {stampFirstSeen,firstSeenAt,isArrival,ARRIVAL_DAYS} from './firstSeen.js';
const ids=list=>list.map(id=>({id}));
test('la primera carga es la línea base: nada es nuevo',()=>{
 const {record,changed}=stampFirstSeen(ids(['a','b']),null,1000);
 assert.equal(changed,true);assert.equal(record.baselineAt,1000);assert.deepEqual(Object.keys(record.seen).sort(),['a','b']);
 assert.equal(firstSeenAt(record,'a'),undefined);assert.equal(isArrival(record,'a',2000),false);
});
test('la segunda carga sella los nuevos y olvida los que ya no están',()=>{
 const first=stampFirstSeen(ids(['a','b']),null,1000).record;
 const {record,changed}=stampFirstSeen(ids(['b','c']),first,5000);
 assert.equal(changed,true);assert.deepEqual(Object.keys(record.seen).sort(),['b','c']);
 assert.equal(firstSeenAt(record,'c'),5000);assert.equal(firstSeenAt(record,'b'),undefined);
 assert.equal(isArrival(record,'c',5000+ARRIVAL_DAYS*864e5-1),true);assert.equal(isArrival(record,'c',5000+ARRIVAL_DAYS*864e5+1),false);
 assert.equal(stampFirstSeen(ids(['b','c']),record,9000).changed,false,'sin cambios: mismo registro');
});
```

- [ ] **Paso 2:** falla. **Paso 3: implementación**

```js
// B1: «visto por primera vez» por id. La primera carga es la línea base (nada es nuevo); después, sólo los ids que
// no estaban. ponytail: un objeto plano por fuente (≤ 30 000 ids ≈ 1 MB en IndexedDB); si pesa, mapa compacto.
export const ARRIVAL_DAYS=14;
export function stampFirstSeen(items,previous,now){
 if(!previous||!previous.seen){const seen={};for(const item of items)seen[item.id]=now;return {record:{baselineAt:now,seen},changed:true};}
 const seen={};let changed=false;
 for(const item of items){const at=previous.seen[item.id];if(at===undefined)changed=true;seen[item.id]=at??now;}
 if(Object.keys(previous.seen).length!==Object.keys(seen).length)changed=true;
 return {record:changed?{baselineAt:previous.baselineAt,seen}:previous,changed};
}
export const firstSeenAt=(record,id)=>{const at=record?.seen?.[id];return at!==undefined&&at>record.baselineAt?at:undefined;};
export const isArrival=(record,id,now,days=ARRIVAL_DAYS)=>{const at=firstSeenAt(record,id);return at!==undefined&&now-at<days*864e5;};
```

- [ ] **Paso 4:** verde; commit `feat(B1): registro de primera vez visto por fuente`.

### Tarea B2: persistencia en `sourceRegistry`

- [ ] **Paso 1:** comprobar que `deviceStorage` funciona dentro del worker de catálogo (ya lo usa `readCache`/`writeCache` en `browserXtreamBackend.js`): usar el mismo mecanismo (`readCache`/`writeCache` reciben `account`; añadir `readFirstSeen(account)`/`writeFirstSeen(account,record)` junto a ellos, clave `first-seen-<sourceId>`). En Electron (`electron/xtream-store.cjs`) añadir el mismo par con fichero JSON, o dejar `firstSeen` desactivado en Electron si el backend no lo expone (anotar).
- [ ] **Paso 2:** en `sourceCatalogue`, rama `force` tras `sanitize`: `const previous=await readFirstSeen(account).catch(()=>null);const {record,changed}=stampFirstSeen([...data.channels,...data.movies,...data.shows],previous,now());if(changed)writeFirstSeen(account,record).catch(()=>{});firstSeenRecords.set(sourceKey,record);`. En la rama de caché válida sin `force`: cargar el registro una vez (`firstSeenRecords` por `sourceKey`) sin sellar nada.
- [ ] **Paso 3:** en `catalogue()`, el `cooperativeMap` que añade `sourceId` y `catalogueUpdatedAt` añade `firstSeenAt:firstSeenAt(firstSeenRecords.get(sourceKey),item.id)` sólo cuando no es `undefined`.
- [ ] **Paso 4:** prueba en `sourceRegistry.test.js` (si existe; si no, crearla con el `fetcher` inyectado como hacen las demás): dos `catalogue(true)` seguidas con un ítem nuevo en la segunda → ese ítem lleva `firstSeenAt`, los demás no. Commit `feat(B2): firstSeenAt por ítem desde el registro de la fuente`.

### Tarea B3: fila «Recién llegados»

- [ ] **Paso 1:** `tvHome.js`: `export function recentArrivals(items,now=Date.now(),days=ARRIVAL_DAYS,limit=40)` (filtra `firstSeenAt` dentro de `days`, ordena desc, corta); `rowEyebrow('Recién llegados')==='NOVEDADES'`. Prueba en `tvHome.test.js` (orden, límite, sin `firstSeenAt`).
- [ ] **Paso 2:** `App.jsx`: memo `{arrivals,arrivalIds}` sobre `[movies,shows]` junto a `fresh`; fila `row('Recién llegados',arrivals)` justo después de «Nuevo esta semana»; `rowActions` la incluye; la insignia NUEVO usa `freshIds ∪ arrivalIds` (pasar un único `Set` a los rails).
- [ ] **Paso 3:** `npm test`, builds; commit `feat(B3): fila Recién llegados con firstSeenAt`.

---

## Lote C · Aviso de «primera carga» y arranque en caliente

**Hoy:** `Boot.jsx:24` arma un temporizador de 6 s incondicional; el arranque en caliente del TV tarda 8–12 s en la fase `catalogue` (sin red: arranque del worker ≤ 3 s, lectura IndexedDB + clon, **re-saneado completo** de la caché en cada arranque porque `sanitizedData` es un `WeakSet` que no sobrevive a la lectura, `prepare*`, clon de vuelta). No hay tiempos por paso.

### Tarea C1: el aviso sólo en la primera carga real

- [ ] **Paso 1:** `Boot.jsx`: el temporizador de 6 s sólo arma el aviso si `!localStorage.getItem('rf-booted')` (lectura síncrona, en `try/catch`); al llegar a `ready` se escribe `localStorage.setItem('rf-booted','1')`. Texto del aviso sin cambios. (El aviso vuelve a aparecer sólo tras borrar datos de la app, que es cuando es verdad.)
- [ ] **Paso 2:** `npm test`, build; commit `fix(C1): el aviso de primera carga sólo en la primera carga`.

### Tarea C2: tiempos por paso del arranque

- [ ] **Paso 1:** en el backend del worker (`browserXtreamBackend.js:27` y `sourceRegistry.sourceCatalogue`), medir con `performance.now()` `read` (IndexedDB), `sanitize`, `prepare` (`prepareChannels`+`prepareCatalogueGroups`), y en `contentStore` `post` (desde que el worker responde hasta `publish`). Devolverlos como `data.timings={read,sanitize,prepare}`; `contentStore` guarda `bootTimings.steps`. Exponer `window.richiflix.bootTimings` (comprobar que `window.richiflix` existe; si no, añadir ese único campo).
- [ ] **Paso 2:** `scripts/tv-enter.mjs` imprime `bootTimings` tras entrar. Commit `feat(C2): tiempos por paso del arranque`.
- [ ] **Paso 3 (yo, en el 55"):** 3 arranques en frío de app (`was_kill` + `debug`) → tabla de pasos. Si `sanitize` ≥ 1 s, C3.

### Tarea C3: no re-sanear una caché ya saneada

- [ ] **Paso 1: prueba** (`sourceRegistry.test.js`): con una caché cuyo `sanitizedPolicy===CONTENT_POLICY_VERSION`, `sanitize` (inyectada o espiada) no se llama; con `sanitizedPolicy` distinto o ausente, sí.
- [ ] **Paso 2:** `writeCache` escribe `sanitizedPolicy:CONTENT_POLICY_VERSION` junto a los datos; en `sourceCatalogue`, `valid = cached válida && (cached.sanitizedPolicy===CONTENT_POLICY_VERSION ? cached : await sanitize(...))`. La reescritura de caché por cambio de política se mantiene (y actualiza `sanitizedPolicy`).
- [ ] **Paso 3:** verde; builds; commit `perf(C3): la caché saneada no se vuelve a sanear en caliente`. Medir de nuevo (C2 paso 3) y anotar antes/después en el informe. Si la ganancia es < 0,5 s, revertir C3 y anotarlo.

---

## Lote D · Panel ampliado persistente al moverse en horizontal

**Hoy:** cada `Card` monta su propio `SelectedCardExpansion` (portal `section.card-expansion`) cuando está seleccionada; en Derecha: la tarjeta que se deja pierde las clases al instante y su panel se oculta, su desmontaje se difiere a `requestIdleCallback`; la nueva espera `EXPANSION_DELAY_MS=180` y monta un panel nuevo (nueva capa, nuevo layout de 1000 px). Las vecinas se apartan con WAAPI (`reserveCardExpansion`) y se cancelan/rehacen en cada tecla.

**Diseño:** en los rails de TV el panel pertenece a la **fila**: un único `RailExpansion` por `VirtualCarousel`, montado mientras haya una tarjeta seleccionada en esa fila. Al moverse en horizontal dentro de la fila: el panel **no se desmonta ni se oculta**; su ancla pasa a la nueva celda (en TV la columna de foco es fija, así que la posición del panel no cambia), las vecinas se re-apartan de forma incremental (sólo las 1–2 celdas cuyo desplazamiento cambia), y el contenido (texto e imagen) se cambia cuando el foco se asienta (`EXPANSION_SWAP_MS=120`); durante una ráfaga el panel muestra el último título asentado con opacidad 0,7 (`is-settling`). Abajo/Arriba o salir del rail: se cierra como hoy. Cuadrículas (`VirtualCatalogue`) y PC: sin cambios (la tarjeta sigue montando su panel). Resultado esperado: una sola capa de panel estable por fila en vez de montar/desmontar una por tecla (hoy «un `section.card-expansion` nuevo por apertura, inevitable» en el plan de rendimiento, ~40 ms de React al desmontar).

**Archivos:** `src/cardExpansion.js` (+ test: `shiftDiff`), `src/cardExpansionSpace.js` (`retarget`), `src/useCardExpansion.js` (`retarget(anchorEl)`), `src/cardSelectionStore.js` (registro `instanceId → {railId,item,index,cell}`; `useRailSelection`), `src/interactions.jsx` (`Card` registra su entrada y no monta el panel si `expansionOwner==='rail'`), `src/VirtualCarousel.jsx` (`<RailExpansion>`), `src/ExpandedCard.jsx` (`item` cambiante con `is-settling` y espera de cambio), `src/expandedCard.css`, `docs/plans/informe-D-panel.md`.

### Tarea D1: diferencia de desplazamientos (pura)

**Interfaces:** `shiftDiff(current:Map<cell,dx>, wanted:Map<cell,dx>)` → `[{cell,from,to}]` sólo para celdas cuyo `dx` cambia; `neighbourShifts` existente produce `wanted`.

- [ ] **Paso 1: prueba** (`cardExpansion.test.js`)

```js
test('shiftDiff sólo devuelve las celdas cuyo desplazamiento cambia',()=>{
 const a={},b={},c={};
 const current=new Map([[a,0],[b,300],[c,300]]),wanted=new Map([[b,0],[c,300]]);
 assert.deepEqual(shiftDiff(current,wanted),[{cell:a,from:0,to:0},{cell:b,from:300,to:0}].filter(x=>x.from!==x.to));
 assert.deepEqual(shiftDiff(new Map(),new Map([[c,300]])),[{cell:c,from:0,to:300}]);
});
```

- [ ] **Paso 2:** falla. **Paso 3:**

```js
export function shiftDiff(current,wanted){
 const out=[];
 for(const [cell,to] of wanted){const from=current.get(cell)??0;if(from!==to)out.push({cell,from,to});}
 for(const [cell,from] of current)if(!wanted.has(cell)&&from!==0)out.push({cell,from,to:0});
 return out;
}
```

- [ ] **Paso 4:** verde; commit `feat(D1): shiftDiff para re-apartar vecinas de forma incremental`.

### Tarea D2: `reserveCardExpansion(...).retarget(anchorBox)`

- [ ] **Paso 1:** `cardExpansionSpace.js` (rama TV `makeRoom`): guardar `applied:Map<cell,dx>` con lo animado; `retarget(anchorBox)` calcula `wanted` con `neighbourShifts` para la nueva ancla, aplica `shiftDiff` con WAAPI (mismas duraciones; `fill:'forwards'`; cancela la animación previa de esa celda) y actualiza `applied`; el `MutationObserver` de celdas nuevas usa la última ancla. `cleanup` sin cambios. Prueba unitaria: con un `animate` falso que registre llamadas, `retarget` a la celda siguiente llama a `animate` sólo en 1–2 celdas.
- [ ] **Paso 2:** `useCardExpansion.js`: nueva función `retarget(anchorEl)` en el controlador: cambia `anchor.current`-equivalente (el hook recibe un `anchorRef` cuyo `.current` actualiza el dueño), llama `space.retarget(insetAnchorBox(cellAnchorBox(cell),…))` **sin** cerrar, sin `queue`, sin tocar `placement` si el `left` resultante es el mismo (columna fija); si cambia (PC o fin de fila), `setPlacement` con el nuevo cálculo. Nada de lecturas de layout fuera de `cellAnchorBox` (modelo de layout, no `getBoundingClientRect` de la tarjeta).
- [ ] **Paso 3:** `npm test`; commit `feat(D2): el espacio reservado y el controlador aceptan un cambio de ancla sin cerrar`.

### Tarea D3: el panel pertenece a la fila

- [ ] **Paso 0:** el `instanceId` de una tarjeta ya es `${railId}:${item.id}` (`interactions.jsx:75`): `useRailSelection(railId)` puede resolverse por prefijo sin tabla extra; el registro sólo necesita `item`, `index` y la celda.
- [ ] **Paso 1:** `cardSelectionStore.js`: `registerCard(instanceId,{railId,item,index,cell})`/`unregisterCard`; `useRailSelection(railId)` → `instanceId|null` (selección actual si su `railId` coincide) con `useSyncExternalStore`; `dropLater` no oculta paneles con `data-rail-owner` (sólo `data-card-owner`), y cuando la nueva selección es de la misma fila que la anterior, no hay «drop» de panel (las clases `is-previewed`/`is-expanded` sí cambian como hoy).
- [ ] **Paso 2:** `interactions.jsx`: `Card` recibe `expansionOwner` (`'card'` por defecto, `'rail'` desde `VirtualCarousel` en TV); registra su entrada en un `useLayoutEffect` (ítem con metadatos ya fusionados, `index`, nodo de la celda) y sólo monta `SelectedCardExpansion` si `expansionOwner==='card'`. `SelectedCardExpansion` se extrae a `src/RailExpansion.jsx`-compatible: un componente `ExpansionFor({instanceId,…})` que recibe la entrada del registro.
- [ ] **Paso 3:** `VirtualCarousel.jsx` (TV): `const selectedId=useRailSelection(railId);{selectedId&&<RailExpansion instanceId={selectedId} railId={railId} …props comunes (open, toggle, favorites, tv, kids, profileId)/>}`. `RailExpansion` usa `useCardExpansion` con un `anchorRef` que apunta a la celda de la entrada; cuando `instanceId` cambia dentro de la misma fila: `controller.retarget(cell)` de inmediato y `setShown(entry)` tras `EXPANSION_SWAP_MS=120` (temporizador reiniciado por cada cambio; mientras tanto `is-settling`). Primera apertura: como hoy (180 ms). Cierre: cuando `selectedId` pasa a `null` (otra fila, diálogo, Volver) → desmontaje como hoy.
- [ ] **Paso 4:** `ExpandedCard.jsx`: acepta cambios de `item` sin remontar (sin `key` por ítem en el portal); el medio se cambia por `item.id` con la lógica w342 → nítida a 600 ms reiniciada; el logo (H3) se vuelve a resolver; `is-settling` → `.card-expansion.is-settling{opacity:.7;transition:opacity var(--tv-fast)}`. Posición «4 de 12.153» y «Te quedan N min» se actualizan con el ítem.
- [ ] **Paso 5:** cuadrículas: `VirtualCatalogue` no pasa `expansionOwner`, así que nada cambia; comprobar con `npm run build` y recorrer una cuadrícula en el smoke de Tizen.
- [ ] **Paso 6:** `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`; commit `feat(D3): panel ampliado por fila que cambia de ancla y contenido sin desmontarse`.

### Tarea D4: verificación en el 55" (yo, con autorización de Richard)

- Identidad: `const p=document.querySelector('.card-expansion');p.__k=1;` → 10 Derecha a 350 ms → `document.querySelector('.card-expansion').__k===1` y el título del panel = tarjeta enfocada.
- Vecinas: tras cada Derecha, sólo 1–2 `animate` nuevos (contador sobre `Element.prototype.animate` envuelto antes de las teclas).
- Abajo → el panel anterior se desmonta y el de la fila nueva se monta tras 180 ms (como hoy). Top 10 (celdas de 300 px) y «Ahora en vivo» (apaisadas) correctos.
- `measure:tv` ×3 (mismo índice de arranque; relanzar la app antes de cada corrida): P50/P95 y capas no peores que la referencia del 8 oct; `tv-trace-report.mjs`: ningún `Layout` por tecla que no existiera (comparar `Layout: n / ms` con la traza del 8 oct, `artifacts/tv-measure-2026-10-08-vida5-55-run3.json` y su traza).
- Capturas `artifacts/panel-persistente-{0,1,6}.png`.

**Si D empeora la medida** y no se corrige en una iteración: `expansionOwner='card'` vuelve a ser el valor en TV (una línea en `VirtualCarousel`), se deja el código y se anota.

---

## Lote E · Halo verde de «visto» y progreso lineal de «donde lo dejaste» (tras el merge de D)

**Pedido de Richard (10 oct):** «un halo verde en lo que ya has visto, y que te salga dónde dejaste los últimos con un progreso lineal».

**Hoy:** la biblioteca del perfil tiene `history[id]` (segundos), `watched[id]===true` y `durations[id]`; `episodeState` (`watchProgress.js:5`) ya clasifica `watched`/`started`/`none` con `WATCHED_FRACTION=.9`. La lista de episodios marca vistos con check y título atenuado y pinta una barra en los empezados. Las tarjetas de los rails pintan `.progress` (6 px, blanco al 19 %, relleno `--accent`) con `resumeFraction` o `history[id]/duration`, pero sólo reciben `history` (no `watched`/`durations`), y el panel ampliado dice «Te quedan N min» sin barra.

**Diseño:** un token `--seen` (verde Solaria: `#5fd38a`, `--seen-rgb:95,211,138`). **Visto** = película o episodio con `watched[id]===true` o fracción ≥ 0,9: el póster lleva un halo verde estático (`box-shadow: 0 0 0 3px var(--seen), 0 0 16px rgba(var(--seen-rgb),.4)`, pintado por estado, sin transición) y una insignia verde «✓ Visto» en la columna de insignias; en la lista de episodios el mismo halo en `.episode-art` además del check actual. **Empezado** = fracción entre 0,02 y 0,9: barra de progreso más visible en todos los rails (8 px, pista `rgba(var(--text-rgb),.18)`, relleno `--accent`, bordes redondeados) y, bajo el título, «Quedan 23 min» en lugar de la línea de datos (como ya hace Continuar viendo con `card-resume`); en el panel ampliado, una barra lineal `.expansion-progress` bajo los datos junto a «Te quedan N min». Series (tarjeta de serie): sin halo (no se conoce la temporada completa sin cargar episodios); su progreso lo muestra el episodio. Todo es pintura estática: sin `transition`, sin `animation`, sin capas.

**Archivos:** `src/watchProgress.js` (+ test), `src/interactions.jsx` (Card: clase `is-seen`, insignia, `card-resume` generalizado), `src/VirtualCarousel.jsx` y `src/VirtualCatalogue.jsx` (pasar `library`), `src/EpisodeList.jsx` + su CSS, `src/ExpandedCard.jsx` + `src/expandedCard.css`, `src/style.css` (token, `.poster.is-seen`, `.progress`, `.card-badge.is-seen`), `src/App.jsx` (una prop `library={{history,watched,durations}}` en `row()` y en las cuadrículas: **lo hago yo en la integración** para no chocar con B+C). Como D reescribe `interactions.jsx` y `ExpandedCard.jsx`, E se ejecuta **después** del merge de D (mismo agente de D al final, o uno nuevo sobre `main` ya integrado).

### Tarea E1: estado de visionado de un título (pura)

**Interfaces:** `titleProgress(item,{history={},watched={},durations={}})` → `{state:'watched'|'started'|'none',fraction:0..1,remainingMinutes:number|null}`; usa `episodeState` para `mediaType==='episode'` y la misma regla para películas (`duration = durations[id] || item.durationSeconds`). Series y canales → `none`.

- [ ] **Paso 1: prueba** (`src/watchProgress.test.js`)

```js
test('titleProgress: visto por marca o por fracción, empezado con minutos restantes, nada para series y canales',()=>{
 const lib={history:{m1:5400,m2:300},watched:{m3:true},durations:{m1:6000}};
 assert.deepEqual(titleProgress({id:'m1',mediaType:'movie'},lib),{state:'watched',fraction:0.9,remainingMinutes:10});
 assert.deepEqual(titleProgress({id:'m2',mediaType:'movie',durationSeconds:6000},lib),{state:'started',fraction:0.05,remainingMinutes:95});
 assert.equal(titleProgress({id:'m3',mediaType:'movie'},lib).state,'watched');
 assert.equal(titleProgress({id:'m4',mediaType:'movie',durationSeconds:6000},lib).state,'none');
 assert.equal(titleProgress({id:'s1',mediaType:'series'},lib).state,'none');
 assert.equal(titleProgress({id:'c1',kind:'iptv'},lib).state,'none');
 assert.equal(titleProgress({id:'m2',mediaType:'movie'},{history:{m2:30},durations:{m2:6000}}).state,'none','menos del 2 % no cuenta como empezado');
});
```

- [ ] **Paso 2:** falla. **Paso 3:** implementación en `watchProgress.js` reutilizando `episodeState` (si su firma encaja, `titleProgress` es un adaptador de 8 líneas: resolver duración, fracción = segundos/duración, `watched` si marca o fracción ≥ `WATCHED_FRACTION`, `started` si fracción ≥ 0,02, `remainingMinutes = Math.max(0, Math.round((duración − segundos)/60))`, `null` sin duración).
- [ ] **Paso 4:** verde; commit `feat(E1): titleProgress para películas y episodios`.

### Tarea E2: halo verde e insignia «Visto»

- [ ] **Paso 1:** `style.css` `:root`: `--seen:#5fd38a;--seen-rgb:95,211,138`. `.poster.is-seen{box-shadow:0 0 0 3px var(--seen),0 0 16px rgba(var(--seen-rgb),.4)}` (comprobar que el póster no tiene ya `box-shadow` por estado; si lo tiene, combinarlos). `.card-badge.is-seen{background:var(--seen);color:var(--bg)}`. Lista de episodios: `.episode-cell.is-watched .episode-art{box-shadow:0 0 0 3px var(--seen),0 0 14px rgba(var(--seen-rgb),.4)}` manteniendo el check.
- [ ] **Paso 2:** `Card`: recibe `library` (desde `VirtualCarousel`/`VirtualCatalogue`), calcula `const progress=useMemo(()=>titleProgress(item,library),[item,library])`; `.poster` añade `is-seen` cuando `progress.state==='watched'`; la columna de insignias añade `<span className="card-badge is-seen">✓ Visto</span>` primero. Nada cambia al enfocar.
- [ ] **Paso 3:** `npm test`, build; commit `feat(E2): halo verde e insignia Visto en tarjetas y episodios`.

### Tarea E3: progreso lineal visible

- [ ] **Paso 1:** `.tv-mode .progress{height:8px;border-radius:4px;overflow:hidden;background:rgba(var(--text-rgb),.18)}` (sustituye la regla de `compositorMotion.css:147`; mover a `style.css` junto a `.progress`), relleno `--accent`. La barra se pinta cuando `progress.state==='started'` con `width` = fracción (como hoy, estático) en **todos** los rails y cuadrículas, no sólo donde haya `resumeFraction`.
- [ ] **Paso 2:** bajo el título: si `progress.state==='started'` y hay `remainingMinutes`, `card-resume` con «Quedan N min» en lugar de `card-facts` (Continuar viendo mantiene su `resumeLabel`).
- [ ] **Paso 3:** panel ampliado: bajo los datos, un `div.expansion-progress` con un `i` cuyo `width` es el porcentaje redondeado de `fraction`, cuando `started`, junto al «Te quedan N min» existente; CSS en `expandedCard.css`: 6 px, misma pista y relleno, sin transición.
- [ ] **Paso 4:** `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`; commit `feat(E3): progreso lineal en rails, cuadrículas y panel`.

**Verificación en TV (yo):** una película vista (halo verde + «✓ Visto»), una empezada (barra + «Quedan N min», panel con barra), temporada con episodios vistos (halo en la lista). Capturas `artifacts/visto-progreso-55.png`. `measure:tv` ×1 para confirmar que no hay capas ni transiciones nuevas (inventario sin `transition`/`animation` en el diff de CSS).

---

## Lote F · Pantalla final de película con recomendaciones

**Pedido de Richard (12 oct):** «después de terminar una peli, que te salgan recomendaciones de otras pelis similares, bonito, y que se vaya haciendo autoslide SOLO si no lo mueves».

**Hoy:** al terminar una película (`ended`, `mediaType==='movie'`) el reproductor muestra «Reproducción terminada» con «Volver al catálogo». Las recomendaciones por título existen para el banner (`bannerRecommendations.js`, colecciones TMDB) y las colecciones por género (`tmdbSelections.js`: «Lo mejor de {género} · TMDB», `tmdbGenres` por ítem).

**Diseño:** sobre el último fotograma atenuado, una pantalla «Si te gustó *Título*» con un carrusel de hasta 8 títulos del catálogo parecidos, cada uno con backdrop, título, nota y «2026 · Drama · 1 h 49 min». La tarjeta activa ocupa el centro grande (backdrop ancho) y las demás asoman a los lados en pequeño; el cambio de activa es un fundido de opacidad entre dos capas (como el banner) y un desplazamiento `transform` de la tira de miniaturas. **Autoslide**: cada 6 s pasa a la siguiente **sólo mientras el usuario no haya tocado nada**; la primera tecla (cualquier flecha, OK, Volver) detiene el autoslide para siempre en esa pantalla y una barra bajo los puntos deja de llenarse. OK reproduce la activa; Izquierda/Derecha mueven; Abajo lleva a «Volver al catálogo»; Volver cierra el reproductor. Si no hay parecidos (catálogo pequeño), se muestra el estado actual.

**Parecidos** (función pura `similarTitles(item,catalogue,{limit=8})`): mismo tipo (película); puntuación = géneros TMDB compartidos ×3 + mismo género del proveedor ×1 + década igual ×1 + nota ≥ 7 ×1; excluye el propio título, los ya vistos (`watched`) y los de Kids si el perfil no lo es; desempate por `tmdbScore`; estable (sin aleatoriedad) para que la prueba sea determinista.

**Archivos:** `src/similarTitles.js` (nuevo, + test), `src/autoSlide.js` (nuevo, + test: `autoSlideStep(state,{now,touched})`), `src/EndScreen.jsx` (nuevo), `src/endScreen.css` (nuevo, importado desde `main.jsx`), `src/Player.jsx` (estado `ended` de película → `<EndScreen>`; recibe `catalogue`/`library` desde `App.jsx` a través de una prop nueva `similar={…}` calculada en App con `useMemo` sólo cuando `playing` cambia), `src/App.jsx` (una prop). Se ejecuta **después** de A (comparten `Player.jsx`).

### Tarea F1: parecidos y autoslide (puras)

- [ ] **Paso 1: pruebas** (`similarTitles.test.js`, `autoSlide.test.js`)

```js
test('similarTitles puntúa por géneros TMDB, década y nota, y excluye el propio título y los vistos',()=>{
 const base={id:'m0',mediaType:'movie',tmdbGenres:['Drama','Crimen'],year:'1994',tmdbScore:8.6,genre:'Cine'};
 const pool=[base,{id:'m1',mediaType:'movie',tmdbGenres:['Drama','Crimen'],year:'1995',tmdbScore:8.9},{id:'m2',mediaType:'movie',tmdbGenres:['Comedia'],year:'1994',tmdbScore:6},{id:'m3',mediaType:'movie',tmdbGenres:['Drama'],year:'2020',tmdbScore:7.5},{id:'s1',mediaType:'series',tmdbGenres:['Drama','Crimen']}];
 assert.deepEqual(similarTitles(base,pool,{watched:{}}).map(x=>x.id),['m1','m3','m2']);
 assert.deepEqual(similarTitles(base,pool,{watched:{m1:true}}).map(x=>x.id),['m3','m2']);
 assert.deepEqual(similarTitles(base,pool,{watched:{},limit:1}).map(x=>x.id),['m1']);
});
test('autoSlide avanza cada 6 s sólo mientras nadie toca',()=>{
 let s=autoSlideStep(null,{now:0});assert.deepEqual(s,{index:0,since:0,live:true});
 s=autoSlideStep(s,{now:5999});assert.equal(s.index,0);
 s=autoSlideStep(s,{now:6000,count:3});assert.deepEqual(s,{index:1,since:6000,live:true});
 s=autoSlideStep(s,{now:7000,touched:true});assert.equal(s.live,false);
 s=autoSlideStep(s,{now:20000,count:3});assert.equal(s.index,1,'tocado: nunca más avanza solo');
});
```

- [ ] **Paso 2:** fallan. **Paso 3:** implementar (`AUTO_SLIDE_MS=6000`; `autoSlideStep` devuelve el mismo objeto si nada cambia). **Paso 4:** verde; commit `feat(F1): parecidos y autoslide puros`.

### Tarea F2: `EndScreen`

- [ ] **Paso 1:** componente con `items`, `title`, `onPlay(item)`, `onClose`; estado `{index,since,live}` con un `setInterval` de 500 ms que aplica `autoSlideStep` mientras `live`; `onKeyDown` captura todas las teclas: marca `touched` y actúa (Izq/Der índice, OK `onPlay(items[index])`, Abajo foco a «Volver al catálogo», Volver `onClose`). Foco inicial en la tarjeta activa (`tabIndex=0`), nunca en la tira.
- [ ] **Paso 2:** render: dos capas de backdrop (actual/saliente, fundido `--tv-slow` por opacidad, la siguiente decodificada antes como en el banner), copia (título, nota, datos, «Si te gustó …»), tira de miniaturas con `transform:translateX(-index*paso)` (`--tv-base`), puntos con barra de autoslide (`scaleX` 6 s, `animation-play-state` según `live`). Sólo `transform`/`opacity`; las miniaturas son `img` w342 ya en caché de rail cuando existan.
- [ ] **Paso 3:** CSS en `endScreen.css` con tokens; `prefers-reduced-motion` sin fundidos. Commit `feat(F2): pantalla final con carrusel y autoslide`.

### Tarea F3: cableado

- [ ] **Paso 1:** `App.jsx`: `const similar=useMemo(()=>playing&&playing.mediaType==='movie'?similarTitles(playing,movies,{watched,limit:8}):[],[playing?.id])` y `<Player … similar={similar}/>`.
- [ ] **Paso 2:** `Player.jsx`: en `ended` de película, si `similar.length`, `<EndScreen items={similar} title={title} onPlay={target=>change?.({movie:target})||open?.(target)} onClose={close}/>` en lugar del estado «Reproducción terminada» (comprobar cómo `change` admite una película; si sólo admite `{episode}`/`{feed}`/`{channel}`, añadir `{movie}` en `changeSource` de App con `xtreamClient().playback`). «Volver al catálogo» se mantiene.
- [ ] **Paso 3:** `npm test`, builds, `test:tizen`; commit `feat(F3): pantalla final de película conectada al reproductor`.

**Verificación en TV (yo):** terminar una película (cursor hasta el final): pantalla con 8 parecidos, autoslide cada 6 s sin tocar; una flecha lo detiene y la barra se congela; OK reproduce; Volver cierra. `measure:tv` no aplica (fuera de la navegación); comprobar que no deja capas tras cerrar. Captura `artifacts/pantalla-final-55.png`.

---

## Medición: mismas pruebas, antes y después

Pedido de Richard: «deja los mismos tests que miden, o ajústalos, pero con eso comprobamos; si desmejora algo lo mejoramos, tratemos de que sea mejor».

- Las herramientas no cambian: `npm run measure:tv` (20 teclas, 350 ms, fase de traza y capas), `scripts/tv-trace-report.mjs` con sourcemap, el inventario de capas y las corridas del 8 oct como referencia (`artifacts/tv-measure-2026-10-08-vida5-55-run{1,2,3}.json`).
- Ajuste único al protocolo, para que las corridas sean comparables: antes de cada corrida se relanza la app (`was_kill` + `debug` + `tv-enter`) para que todas arranquen en el mismo índice de la fila (hoy 15 → 43 → 71 infla la P95 de las corridas 2 y 3 por decodificación de portadas). Se añade `--relaunch` a `scripts/tv-measure.mjs` que lo haga solo, y la referencia se vuelve a tomar con ese mismo protocolo sobre el build actual **antes** de integrar nada de este plan.
- Criterio: P50 y P95 (fase de traza), capas tras 20 teclas, raster total y `Layout` por tecla no peores que la referencia; objetivo declarado: **mejores**. D debería bajar Layerize y el trabajo de React por tecla (no hay montaje de panel por tecla); C3 debería bajar el arranque. Si una medida empeora, se corrige en una iteración más antes de integrar; si no se consigue, la perilla de ese lote vuelve al comportamiento anterior y queda anotado.

---

## Orden y reparto

- Tres Opus en paralelo, worktrees disjuntos: **A** (`nextEpisodeFlow`, `NextEpisodeCard`, `Player.jsx`, `playerControls.css`), **B+C** (`firstSeen`, `sourceRegistry`, `browserXtreamBackend`, `tvHome`, `App.jsx` filas, `Boot.jsx`, `contentStore`, `scripts/tv-enter.mjs`), **D** (`cardExpansion*`, `useCardExpansion`, `cardSelectionStore`, `interactions.jsx`, `VirtualCarousel.jsx`, `ExpandedCard.jsx`, `expandedCard.css`). B y C comparten `sourceRegistry.js`: un solo agente, B antes que C.
- **E** va después del merge de D (mismo agente de D al terminar, o uno nuevo sobre main); su cambio de App.jsx (prop library) lo hago yo al integrar.
- **F** va después de A (comparten Player.jsx): el agente de A la hace al terminar A3.
- Integración: merge A+F → B+C → D → E; `npm test`, builds, `test:tizen`; instalación en el 55" sólo con el «instala» de Richard; medición de D y C2/C3; sección «Resultado».

## Autorrevisión

- **Cobertura de lo pedido:** pantalla final con parecidos y autoslide sólo sin tocar → F1–F3; halo verde de visto y progreso lineal → E1–E3; medición con las mismas pruebas → sección «Medición»; cuenta atrás visible, con texto, animación y cancelación → A1–A3; títulos que no estaban antes en sección aparte → B1–B3; aviso de primera carga → C1 (y causa del arranque lento → C2/C3); panel que no desaparece al moverse en horizontal → D1–D4.
- **Nombres consistentes:** `nextEpisodePhase`/`countdownStep`/`COUNTDOWN_MS` (A1→A2→A3); `stampFirstSeen`/`firstSeenAt`/`isArrival`/`ARRIVAL_DAYS` (B1→B2→B3); `sanitizedPolicy` (C3); `shiftDiff` (D1→D2), `retarget` (D2→D3), `registerCard`/`useRailSelection`/`expansionOwner`/`EXPANSION_SWAP_MS`/`is-settling` (D3→D4).
- **Enfoque de revisión:** los cinco casos tienen prueba o verificación nombrada (A1, A2+TV, B1, C3, D4).
