# Plan de implementación · Loader con la corona saltando y salto del reproductor con cursor + OK

> **Para los agentes ejecutores:** SUB-SKILL OBLIGATORIO: `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`, tarea por tarea. Los pasos usan casillas (`- [ ]`). El proyecto es repo git (rama `main`, remoto `origin/kingdom-main`); cada tarea termina en un commit con `npm test` en verde. Nunca instalar en el TV sin indicación de Richard. Sin smokes de Playwright/Electron: sólo `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`.

**Objetivo:** que el loader de arranque y el de carga del reproductor sean la corona de Kingdom saltando con frases del reino debajo, y que en el TV Izquierda/Derecha muevan un cursor sobre la barra sin tocar el vídeo hasta OK (o 2 s de pausa), partiendo siempre del destino anterior.

**Arquitectura:** dos cambios acotados sobre la app existente (React 19 + Vite; Tizen 10 / Chromium 130 en el TV con AVPlay; Electron en PC). El loader es CSS puro (`transform`/`opacity`, sin GIF ni librerías) en un componente `KingdomLoader` que sustituye a `.boot-orbit` y a `.cinema-loader`. El salto reutiliza `createSeekAccumulator` (D1) con dos añadidos: recuerda el último destino hasta que el vídeo confirma `seeked` y, en TV, aplica a los 2 s en vez de a los 0,4 s; `playerKeyAction` (D2) gana `commitSeek`/`cancelSeek` con OK y Volver mientras hay cursor.

**Stack:** React 19, Vite, `node:test`, Tizen AVPlay (`src/avplay.js`), hls.js en PC.

**Diseño aprobado (8 oct 2026, en chat):** corona saltando con aplastamiento y estirado, sombra elíptica, texto de estado real + frase imaginativa rotando cada 2,5 s, `prefers-reduced-motion` → latido de opacidad; cursor en la barra con destino en grande, OK salta al instante, auto-salto a los 2 s, Volver cancela; la ráfaga parte del cursor, no del vídeo (arregla el «+10 → +7»). **Sin miniatura real:** los streams del proveedor no traen sprites y AVPlay pinta en un plano nativo (no se pueden capturar fotogramas ni abrir un segundo decodificador); el cursor lleva el arte del título atenuado con el tiempo encima.

## Restricciones globales

- Movimiento en TV: sólo `transform`/`opacity`; sin lecturas de layout en el camino de la tecla (`docs/PLAN-RENDIMIENTO-TV-2026-10-07.md`). Las capas del loader son transitorias (desaparecen con él).
- Tokens de color de `src/style.css` (`--accent`, `--surface`, `--text-2`, `rgba(var(--*-rgb),…)`); nada de literales nuevos. `cssTarget` chrome85: nada de `inset` sin sus cuatro lados ni sintaxis moderna.
- Nombres: la interfaz dice «Kingdom»; el id Tizen sigue siendo `Richiflix1.Richiflix`; los eventos `richiflix-*` y claves `rf-*` no se renombran.
- El foco del reproductor en TV nunca entra en la barra (D2): el cursor es sólo visual.
- Español en todo texto visible; frases sin marcas registradas ni nombres de películas.

## Enfoque de revisión

1. **Pulsar Derecha mientras el salto anterior aún no ha terminado** (AVPlay tarda 1–3 s): la nueva ráfaga debe partir del destino anterior, no de la posición vieja. Prueba en Tarea 3.
2. **OK con cursor activo** debe saltar y no abrir los botones ni pausar; **OK sin cursor** sigue siendo «ir a los botones». Prueba en Tarea 4.
3. **Volver con cursor activo** cancela el cursor y no cierra el reproductor. Prueba en Tarea 4.
4. **Cursor en los extremos:** nunca negativo ni más allá de `duration-1`; con `seekable=false` (directo sin DVR) no hay cursor. Cubierto por las pruebas existentes del acumulador y Tarea 4.
5. **Loader con `prefers-reduced-motion`** o en un navegador sin `@keyframes` compuestos: la corona sigue visible y el texto legible. Comprobación visual en Tarea 2 (PC con la preferencia activada) y en el TV en la verificación final.

---

### Tarea 1: frases del reino

**Archivos:**
- Crear: `src/loaderPhrases.js`
- Prueba: `src/loaderPhrases.test.js`

**Interfaces:**
- Produce: `LOADER_PHRASES` (array de cadenas) y `loaderPhrase(tick)` → cadena; `tick` entero ≥ 0 (índice de rotación), cíclico. Se consume en Tareas 2 y 5.

- [ ] **Paso 1: prueba que falla**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {LOADER_PHRASES,loaderPhrase} from './loaderPhrases.js';

test('hay al menos 12 frases distintas, en español y sin puntos suspensivos duplicados',()=>{
 assert.ok(LOADER_PHRASES.length>=12);
 assert.equal(new Set(LOADER_PHRASES).size,LOADER_PHRASES.length);
 for(const phrase of LOADER_PHRASES){assert.match(phrase,/…$/);assert.ok(phrase.length<=44,phrase);}
});
test('loaderPhrase cicla y nunca devuelve vacío',()=>{
 assert.equal(loaderPhrase(0),LOADER_PHRASES[0]);
 assert.equal(loaderPhrase(LOADER_PHRASES.length),LOADER_PHRASES[0]);
 assert.equal(loaderPhrase(-1),LOADER_PHRASES[0]);
 assert.equal(loaderPhrase(3.7),LOADER_PHRASES[3]);
});
```

- [ ] **Paso 2:** `node --test src/loaderPhrases.test.js` → falla con «Cannot find module».

- [ ] **Paso 3: implementación**

```js
// Frases del reino para los loaders (arranque y reproductor). Máx. 44 caracteres: caben en una línea a 24 px en el TV.
export const LOADER_PHRASES=[
 'Puliendo la corona…',
 'Despertando a los heraldos…',
 'Encendiendo las antorchas de la sala…',
 'Desenrollando los pergaminos del catálogo…',
 'Afinando los laúdes…',
 'Convocando a los bufones…',
 'Abriendo las puertas del castillo…',
 'Colocando los tronos en primera fila…',
 'Avisando al cronista de palacio…',
 'Sacudiendo las alfombras rojas…',
 'Contando las joyas de la cámara…',
 'Izando los estandartes…',
 'Sirviendo el hidromiel de la función…',
 'Afilando las espadas de utilería…',
 'Buscando al dragón del proyector…',
];
export const loaderPhrase=tick=>LOADER_PHRASES[((Math.floor(Number(tick)||0)%LOADER_PHRASES.length)+LOADER_PHRASES.length)%LOADER_PHRASES.length];
```

- [ ] **Paso 4:** `node --test src/loaderPhrases.test.js` → PASS.
- [ ] **Paso 5:** `git add src/loaderPhrases.js src/loaderPhrases.test.js && git commit -m "feat(loader): frases del reino"`.

---

### Tarea 2: `KingdomLoader` (corona saltando) en el arranque

**Archivos:**
- Modificar: `src/Brand.jsx` (añadir `KingdomLoader`)
- Modificar: `src/Boot.jsx:36-37` (sustituir `.boot-orbit`, añadir la frase rotatoria)
- Modificar: `src/style.css:740-744` (`.boot-screen`, quitar `.boot-orbit`, añadir `.kingdom-loader`)
- Prueba: `src/brandNames.test.js` (se amplía) + comprobación visual

**Interfaces:**
- Produce: `KingdomLoader({phrase,label})` → `<div class="kingdom-loader" role="status" aria-label={label}>`: glifo `.kingdom-loader-glyph`, sombra `.kingdom-loader-shadow`, y debajo `<p class="kingdom-loader-label">{label}</p>` y `<small class="kingdom-loader-phrase" key={phrase}>{phrase}</small>` (ambos opcionales). Se consume en Tarea 5.
- Consume: `loaderPhrase` (Tarea 1).

- [ ] **Paso 1: prueba que falla** (en `src/brandNames.test.js`, al final)

```js
import {readFileSync} from 'node:fs';
test('KingdomLoader existe, usa el glifo y sólo anima transform/opacity',()=>{
 const brand=readFileSync(new URL('./Brand.jsx',import.meta.url),'utf8'),css=readFileSync(new URL('./style.css',import.meta.url),'utf8');
 assert.match(brand,/export function KingdomLoader/);
 assert.match(brand,/kingdom-loader-shadow/);
 const bounce=css.match(/@keyframes kingdom-bounce\{.*?\}\}/s)?.[0]||'';
 assert.ok(bounce,'falta @keyframes kingdom-bounce');
 assert.doesNotMatch(bounce,/\b(top|left|width|height|margin|padding|box-shadow):/);
 assert.match(css,/prefers-reduced-motion:reduce\)\{[^}]*kingdom-glyph\{animation:kingdom-pulse/);
});
```

- [ ] **Paso 2:** `node --test src/brandNames.test.js` → falla en `KingdomLoader`.

- [ ] **Paso 3: componente** (añadir a `src/Brand.jsx`)

```jsx
// Loader de la marca: la corona salta (CSS, sólo transform/opacity), estado real debajo y una frase del reino.
export function KingdomLoader({phrase,label,className=''}){
 return <div className={`kingdom-loader ${className}`} role="status" aria-label={label||'Cargando'}>
  <div className="kingdom-loader-stage"><BrandGlyph/><i className="kingdom-loader-shadow" aria-hidden="true"/></div>
  {label&&<p className="kingdom-loader-label">{label}</p>}
  {phrase&&<small className="kingdom-loader-phrase" key={phrase}>{phrase}</small>}
 </div>;
}
```

`BrandGlyph` ya renderiza `img.kingdom-glyph`; el CSS lo toma como `.kingdom-loader-stage .kingdom-glyph`.

- [ ] **Paso 4: estilos** (sustituir las líneas 741–744 de `src/style.css`; conservar `.boot-screen` de la 740 y `.boot-screen p/small` de la 743)

```css
.boot-screen .brand{font-size:56px}
.kingdom-loader{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
.kingdom-loader-stage{position:relative;width:112px;height:132px}
.kingdom-loader-stage .kingdom-glyph{position:absolute;left:24px;top:8px;width:64px;height:64px;transform-origin:50% 100%;animation:kingdom-bounce 1.2s cubic-bezier(.3,0,.2,1) infinite;will-change:transform}
.kingdom-loader-shadow{position:absolute;left:26px;bottom:14px;width:60px;height:14px;border-radius:50%;background:rgba(var(--accent-rgb),0.28);filter:blur(3px);transform-origin:50% 50%;animation:kingdom-shadow 1.2s cubic-bezier(.3,0,.2,1) infinite;will-change:transform,opacity}
.kingdom-loader-label{font-size:24px;margin:0;color:var(--text-2)}
.kingdom-loader-phrase{font-size:17px;color:rgba(var(--text-2-rgb),0.75);animation:kingdom-phrase .35s ease-out}
@keyframes kingdom-bounce{0%,100%{transform:translateY(42px) scale(1.18,.82)}18%{transform:translateY(30px) scale(.94,1.1)}50%{transform:translateY(0) scale(1,1)}82%{transform:translateY(30px) scale(.98,1.04)}}
@keyframes kingdom-shadow{0%,100%{transform:scale(1.15,1);opacity:.9}50%{transform:scale(.55,.7);opacity:.35}}
@keyframes kingdom-phrase{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes kingdom-pulse{0%,100%{opacity:1}50%{opacity:.45}}
@media(prefers-reduced-motion:reduce){.kingdom-loader-stage .kingdom-glyph{animation:kingdom-pulse 1.6s ease-in-out infinite;transform:translateY(42px)}.kingdom-loader-shadow{animation:none;opacity:.6}.kingdom-loader-phrase{animation:none}}
```

Las dos reglas de `.boot-orbit` desaparecen. `boot-spin` se queda: lo usa `.focus-info-loader`.

- [ ] **Paso 5: Boot** (`src/Boot.jsx`): junto a los estados, `const [tick,setTick]=useState(0);` y un efecto `useEffect(()=>{if(ready)return;const id=setInterval(()=>setTick(value=>value+1),2500);return()=>clearInterval(id);},[ready]);`. Importar `KingdomLoader` y `loaderPhrase`. Render:

```jsx
return ready?children(profiles):<div className="boot-screen" role="status" aria-label="Preparando Kingdom" data-boot-stage={stage}><div className="brand"><Brand/></div><KingdomLoader label={profileError?'Recuperando tus perfiles':stages[stage]||'Preparando Kingdom'} phrase={profileError?null:loaderPhrase(tick)}/>{profileError?<><small role="alert">{profileError}</small><button className="primary" onClick={()=>setAttempt(value=>value+1)} autoFocus>Reintentar</button></>:slow&&<small>La primera carga necesita más tiempo</small>}</div>;
```

El `<p>` anterior desaparece (lo pone `KingdomLoader`). `role="status"` se queda sólo en `.boot-screen`: quitar el de `KingdomLoader` cuando reciba `label` dentro de otro `role="status"` no hace falta (son anidados y legibles); se deja.

- [ ] **Paso 6:** `node --test src/brandNames.test.js` → PASS; `npm test` en verde; `npm run build`.
- [ ] **Paso 7: comprobación visual en PC** (`npm run dev`, abrir en Chrome con la red limitada a «Slow 3G» para ver el loader): la corona salta sin cortes, la sombra se encoge al subir, la frase cambia cada 2,5 s con un fundido; con «Emulate CSS prefers-reduced-motion: reduce» en DevTools la corona late sin saltar. Guardar `artifacts/loader-boot-pc.png`.
- [ ] **Paso 8:** `git commit -am "feat(loader): corona saltando con frases del reino en el arranque"`.

---

### Tarea 3: el acumulador recuerda el último destino

**Archivos:**
- Modificar: `src/seekAccumulator.js`
- Prueba: `src/seekAccumulator.test.js`

**Interfaces:**
- Produce: `createSeekAccumulator` gana `settle()` (el vídeo confirmó el salto: olvidar el destino) y `pending()` → `{target,delta,direction}|null` mientras hay ráfaga sin aplicar. `press` parte de `lastTarget` si existe (aplicado pero no confirmado) en vez de `position`.
- Consume: nada nuevo.

- [ ] **Paso 1: prueba que falla** (añadir a `src/seekAccumulator.test.js`)

```js
test('una ráfaga nueva parte del destino anterior hasta que el vídeo confirma el salto',()=>{
 let t=0;const applied=[];const acc=createSeekAccumulator({now:()=>t,schedule:()=>1,cancel:()=>{}});acc.onApply(target=>applied.push(target));
 acc.press(1,{position:100,duration:3600});acc.flush();          // salta a 110, el vídeo aún informa 100
 t+=1000;assert.equal(acc.press(1,{position:100,duration:3600}).target,120); // parte de 110, no de 100
 acc.flush();assert.deepEqual(applied,[110,120]);
 acc.settle();t+=1000;assert.equal(acc.press(1,{position:120,duration:3600}).target,130);
 acc.settle();t+=1000;assert.equal(acc.press(1,{position:117,duration:3600}).target,127); // tras confirmar, manda el vídeo (fotograma clave)
});
test('pending expone el cursor y se vacía al aplicar o cancelar',()=>{
 let t=0;const acc=createSeekAccumulator({now:()=>t,schedule:()=>1,cancel:()=>{}});
 assert.equal(acc.pending(),null);
 acc.press(-1,{position:100,duration:3600});assert.deepEqual(acc.pending(),{target:90,delta:10,direction:-1});
 acc.flush();assert.equal(acc.pending(),null);
 acc.press(1,{position:90,duration:3600});acc.cancel();assert.equal(acc.pending(),null);
});
```

- [ ] **Paso 2:** `node --test src/seekAccumulator.test.js` → falla (`acc.settle is not a function`, destino 110 en vez de 120).

- [ ] **Paso 3: implementación** (sustituir el cuerpo de `createSeekAccumulator`)

```js
export function createSeekAccumulator({steps=[10,30,60,120],windowMs=600,applyMs=400,repeatMs=250,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),now=()=>Date.now()}={}){
 let burst=null,timer=null,listener=()=>{},lastTarget=null;
 const apply=()=>{timer=null;if(burst&&!burst.applied){burst.applied=true;lastTarget=burst.target;listener(burst.target,burst);}};
 return {
  press(direction,{position,duration,repeat=false}){
   const at=now();
   if(repeat&&burst&&burst.direction===direction&&at-burst.at<repeatMs)return null;
   // The video reports the old position until AVPlay finishes the previous seek: a new burst starts from the last target.
   if(!burst||burst.direction!==direction||at-burst.at>windowMs)burst={direction,from:lastTarget??position,presses:0,delta:0};
   burst.delta+=steps[Math.min(burst.presses,steps.length-1)];burst.presses++;burst.at=at;burst.applied=false;
   burst.target=Math.max(0,Math.min(Math.max(0,duration-1),burst.from+direction*burst.delta));
   if(timer!==null)cancel(timer);timer=schedule(apply,applyMs);
   return {target:burst.target,delta:burst.delta,step:steps[Math.min(burst.presses-1,steps.length-1)]};
  },
  onApply(fn){listener=fn;},
  pending(){return burst&&!burst.applied?{target:burst.target,delta:burst.delta,direction:burst.direction}:null;},
  flush(){if(timer!==null){cancel(timer);apply();}},
  cancel(){if(timer!==null)cancel(timer);timer=null;burst=null;},
  settle(){lastTarget=null;},
 };
}
```

Nota: en la prueba existente «flush applies at once…» el segundo `press` llega a 200 ms (dentro de la ventana) y sigue acumulando desde `from=100`: no cambia. En «seek clamps… resets after the window» el tercer `press` llega tras 700 ms con `lastTarget=0` (del clamp a 0 del segundo press, nunca aplicado porque `schedule` es ficticio → `lastTarget` sigue `null`): comprobar que la prueba sigue en verde; si `lastTarget` fuera 0 por un `flush`, añadir `acc.settle()` en esa prueba y anotarlo.

- [ ] **Paso 4:** `node --test src/seekAccumulator.test.js` → PASS (todas, viejas y nuevas).
- [ ] **Paso 5:** `git commit -am "feat(player): el acumulador de saltos parte del último destino hasta seeked"`.

---

### Tarea 4: OK confirma, Volver cancela

**Archivos:**
- Modificar: `src/playerKeys.js`
- Prueba: `src/playerKeys.test.js`

**Interfaces:**
- Produce: `playerKeyAction` acepta `pending=false`; con `focus:'video'` y `pending:true`, `Enter` → `{type:'commitSeek'}` y `Escape` → `{type:'cancelSeek'}`; Izquierda/Derecha siguen siendo `seek`. Con `focus:'buttons'` y `pending:true`, `Enter` no cambia (el botón se pulsa) pero `Escape` → `{type:'cancelSeek'}`.

- [ ] **Paso 1: prueba que falla** (añadir a `src/playerKeys.test.js`)

```js
test('con cursor de salto activo, OK confirma y Volver cancela sin cerrar',()=>{
 assert.deepEqual(playerKeyAction({...video,key:'Enter',pending:true}),{type:'commitSeek'});
 assert.deepEqual(playerKeyAction({...video,key:'Enter',chromeVisible:true,pending:true}),{type:'commitSeek'});
 assert.deepEqual(playerKeyAction({...video,key:'Escape',pending:true}),{type:'cancelSeek'});
 assert.deepEqual(playerKeyAction({...video,key:'ArrowRight',pending:true}),{type:'seek',direction:1,repeat:false});
 assert.deepEqual(playerKeyAction({...buttons,key:'Escape',pending:true}),{type:'cancelSeek'});
 assert.deepEqual(playerKeyAction({...video,key:'Enter',pending:false}),{type:'focusButtons'});
 assert.deepEqual(playerKeyAction({...video,key:'Escape'}),{type:'close'});
});
```

- [ ] **Paso 2:** `node --test src/playerKeys.test.js` → falla (`focusButtons` en vez de `commitSeek`).

- [ ] **Paso 3: implementación** (en `playerKeyAction`, firma `{key,focus,repeat=false,seekable=false,chromeVisible=false,pending=false}`; en la rama `video`, antes de `ArrowDown`; en la rama `buttons`, antes del `return` final)

```js
 if(focus==='video'){
  if(SEEK[key])return seekable?{type:'seek',direction:SEEK[key],repeat}:null;
  // Cursor de salto activo: OK salta ya, Volver deja el vídeo donde estaba.
  if(pending&&key==='Enter')return {type:'commitSeek'};
  if(pending&&key==='Escape')return {type:'cancelSeek'};
  if(key==='ArrowDown')return {type:'focusButtons'};
  …
 }
 …
 if(focus==='buttons'){
  if(SEEK[key])return {type:'moveButton',direction:SEEK[key]};
  if(pending&&key==='Escape')return {type:'cancelSeek'};
  return key==='ArrowUp'||key==='Escape'?{type:'focusVideo'}:null;
 }
```

- [ ] **Paso 4:** `node --test src/playerKeys.test.js` → PASS.
- [ ] **Paso 5:** `git commit -am "feat(player): OK confirma y Volver cancela el cursor de salto"`.

---

### Tarea 5: cursor en el reproductor del TV y loader con la corona

**Archivos:**
- Modificar: `src/Player.jsx` (líneas 38, 90, 138–152, 195–199, 266–268, 282–285)
- Modificar: `src/playerControls.css` (estilos del cursor) y `src/style.css:167-169,314-318,420-423,698-700` (`.player-loading`)
- Prueba: `npm test`, `npm run build`, `npm run build:tizen`, `npm run test:tizen`; comprobación en el TV (sección final)

**Interfaces:**
- Consume: `settle()`/`pending()` (Tarea 3), `commitSeek`/`cancelSeek` (Tarea 4), `KingdomLoader` + `loaderPhrase` (Tareas 1–2).

- [ ] **Paso 1: acumulador por plataforma** (línea 38). En TV el salto espera 2 s; en PC sigue a 0,4 s:

```js
 const accumulator=useRef(null);accumulator.current??=createSeekAccumulator(tv?{applyMs:2000}:{});
```

`tv` ya existe en el componente (se usa en `seekBy` y `keyboard`); si se declara después de la línea 38, mover esta línea justo debajo de su declaración.

- [ ] **Paso 2: el reloj enseña el cursor hasta `seeked`.** En `onApply` (línea 143) **no** vaciar `scrub`: `accumulator.current.onApply((target,burst)=>{setPendingSeek(null);seek(from+target);intro.applied({from:burst.from,to:target});});`. Añadir junto a `seek`: `const settled=()=>{accumulator.current.settle();setScrub(null);};` y llamarla en los dos sitios donde se procesa `seeked`: línea 90 (`if(type==='seeked'){health.reposition();settled();…}`) y en `onSeeked` del `<video>` (línea 266, tras `seekingRef.current=false;`). `cancelSeek`: `const cancelSeek=()=>{accumulator.current.cancel();setPendingSeek(null);setScrub(null);};`.

- [ ] **Paso 3: teclas** (línea 195): pasar `pending:Boolean(pendingSeek)` a `playerKeyAction` y tratar las acciones nuevas:

```js
   if(action.type==='seek')seekBy(action);
   else if(action.type==='commitSeek')accumulator.current.flush();
   else if(action.type==='cancelSeek')cancelSeek();
   else if(action.type==='focusVideo')…
```

En el listener de `window` (línea 229) nada cambia: `MediaRewind`/`MediaFastForward` siguen con `now:true`.

- [ ] **Paso 4: cursor sobre la barra** (línea 284; sustituye el `output.seek-pending` actual). El cursor muestra el destino y el delta en grande y, si el título tiene arte, lo lleva atenuado de fondo:

```jsx
    {pendingSeek&&<output className="seek-cursor" style={{left:`${clamp((from+pendingSeek.target-from)/(to-from)*100,3,97)}%`}}>
     {item.image&&<img className="seek-cursor-art" src={artworkURL(item.image)} alt="" aria-hidden="true"/>}
     <strong>{time(from+pendingSeek.target)}</strong><span>{`${pendingSeek.direction>0?'+':'−'}${pendingSeek.delta<60?`${pendingSeek.delta} s`:time(pendingSeek.delta)}`}</span>
     {tv&&<em>OK para saltar</em>}
    </output>}
```

Importar `artworkURL` desde `./artwork.js` (ya se importa `displayTitle` de ahí). Comprobar con `grep -n "image" src/App.jsx | grep -i "player\|play("` que el `item` del reproductor lleva `image`; si llega como `poster`, usar `item.image||item.poster`. Si no hay ninguno, el cursor sale sin arte (válido).

- [ ] **Paso 5: estilos del cursor** (añadir a `src/playerControls.css`; sólo `transform`/`opacity` animan)

```css
.seek-cursor{position:absolute;bottom:55px;transform:translateX(-50%);display:grid;justify-items:center;gap:4px;min-width:200px;padding:14px 18px;border-radius:18px;overflow:hidden;background:rgba(var(--surface-rgb),0.92);border:1px solid rgba(var(--focus-rgb),0.35);box-shadow:0 10px 40px #0007;font-variant-numeric:tabular-nums;pointer-events:none;animation:seek-cursor-in .12s ease-out;will-change:transform}
.seek-cursor-art{position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;opacity:.18;z-index:0}
.seek-cursor>strong{position:relative;font-size:clamp(22px,1.6vw,36px);font-weight:800;color:var(--text)}
.seek-cursor>span{position:relative;font-size:clamp(14px,1vw,22px);color:var(--accent);font-weight:700}
.seek-cursor>em{position:relative;font-style:normal;font-size:clamp(12px,.8vw,17px);color:var(--text-2);letter-spacing:.4px;text-transform:uppercase}
@keyframes seek-cursor-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%)}}
```

Borrar `.seek-preview.seek-pending` de `playerControls.css:10` (ya no se usa).

- [ ] **Paso 6: loader del reproductor con la corona** (línea 268). Sustituir `.cinema-loader` por `KingdomLoader` con frase rotatoria (mismo `tick` de 2,5 s, sólo mientras `loading`):

```jsx
   {showLoader&&loading&&!error&&!ended&&<div className="player-loading"><KingdomLoader className="player-kingdom-loader" label={item.trying&&media.current===0?'Probando otra señal…':media.current>0?'Cargando…':title} phrase={loaderPhrase(tick)}/></div>}
```

con `const [tick,setTick]=useState(0);useEffect(()=>{if(!loading)return;const id=setInterval(()=>setTick(value=>value+1),2500);return()=>clearInterval(id);},[loading]);`. Importar `KingdomLoader` (sustituye a `BrandGlyph` si deja de usarse) y `loaderPhrase`. En `src/style.css` borrar las reglas de `.player-loading .cinema-loader` (líneas 316–318, 420–422, 442 parcial, 698–700) y `.player-loading svg` (168); añadir `.player-loading .kingdom-loader-label{color:var(--text);font-size:clamp(17px,1.3vw,30px)}.player-loading .kingdom-loader-phrase{font-size:clamp(14px,1vw,22px)}`. `.cinema-loader` sigue existiendo en otros sitios (`style.css:539` lo usa con `.kingdom-mark`): comprobar con `grep -rn cinema-loader src/*.jsx` y dejar las reglas que aún tengan uso.

- [ ] **Paso 7:** `npm test` → verde (incluye `brandNames`, `playerKeys`, `seekAccumulator`, `loaderPhrases`); `npm run build`; `npm run build:tizen`; `npm run test:tizen`.
- [ ] **Paso 8:** `git commit -am "feat(player): cursor de salto con OK y loader de la corona en el reproductor"`.

---

## Verificación final en el TV (cuando Richard autorice el install)

Instalar en el 55" (`scripts/tizen-install.ps1 -TvIP 192.168.1.25 -CertificateProfile Richard`), abrir el inspector según `docs/PLAN-RENDIMIENTO-TV-2026-10-07.md` §0 (`was_kill`, `debug`, `forward tcp:9227`).

1. **Loader de arranque:** relanzar en debug y capturar `Page.captureScreenshot` a los 1 s y 3 s → `artifacts/loader-boot-tv-{1,2}.png`: corona en dos fases distintas del salto, frase distinta de la anterior cada 2,5 s. Comprobar en la traza de 3 s que el loader no genera `Layout` por frame (sólo `Composite`): `node scripts/tv-trace-report.mjs` sobre una traza corta → `Layout` ≤ 3 en los 3 s.
2. **Cursor:** entrar al perfil (`node scripts/tv-enter.mjs`), abrir una película con OK, esperar `video`/AVPlay en `PLAYING`, y por el inspector enviar `ArrowRight` ×3 cada 300 ms al `document.activeElement` (el vídeo): el cursor muestra «+1:40» (10+30+60), el reloj del reproductor enseña el destino y AVPlay **no** ha recibido `seekTo` (envolver `webapis.avplay.seekTo` con un contador antes de pulsar). `Enter` → un solo `seekTo`; tras `seeked`, `pending()` es `null`.
3. **Ráfaga sobre salto en vuelo:** `ArrowRight`, esperar 2,2 s (auto-salto), y a los 300 ms otro `ArrowRight` → el destino del segundo es el primero + 10 s, nunca «posición vieja + 10». Reloj: nunca retrocede al valor viejo entre ambos.
4. **Volver con cursor:** `ArrowRight`, `Escape` → cursor fuera, reproductor sigue abierto, posición intacta.
5. **Latencia tecla → cursor:** 10 `ArrowRight` cada 350 ms midiendo tecla → 2.º RAF como `tv-measure.mjs`; objetivo P95 ≤ 120 ms (no hay salto de vídeo en el camino).
6. Anotar resultados en este plan (sección «Resultado») y subir a `origin/kingdom-main`.

## Autorrevisión del plan

- **Cobertura del diseño aprobado:** corona saltando + sombra + frases + reduced-motion → Tareas 1–2 (arranque) y 5 (reproductor); cursor con OK / auto 2 s / Volver → Tareas 3–5; arreglo del «+10 → +7» → Tarea 3 (`lastTarget`) y Tarea 5 (`settled` en `seeked`); sin miniatura (arte del título atenuado) → Tarea 5 paso 4.
- **Nombres consistentes:** `loaderPhrase`/`LOADER_PHRASES` (1→2,5); `KingdomLoader({phrase,label,className})` (2→5); `pending()`/`settle()` (3→5); `commitSeek`/`cancelSeek` + parámetro `pending` (4→5).
- **Enfoque de revisión:** los cinco casos tienen prueba o comprobación nombrada (3, 4, 4, acumulador existente + 4, 2 + verificación final).

## Resultado (8 oct 2026, 55")

Ejecutado por un Opus en worktree (`docs/plans/informe-loader-cursor.md`), integrado en `main`. Verificado por el inspector en el 55": loader de arranque con la corona saltando y frases rotando («Despertando a los heraldos…», «Desenrollando los pergaminos del catálogo…»; `artifacts/vida-55-boot-2.png`); en el reproductor, tres Derecha seguidas muestran el cursor «1:40 · +1:40 · OK para saltar» sin ningún `seekTo` hasta OK (contador sobre `webapis.avplay.seekTo`); a los 2 s sin pulsar salta solo; con los controles ocultos, Izquierda los despierta y muestra el cursor; Volver con cursor no cierra el reproductor. Pendiente de probar con el mando real la sensación del auto-salto de 2 s.
