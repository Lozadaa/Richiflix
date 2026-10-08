// Medición en el Samsung real (auditoría 2026-10-07). NO lo ejecuta la auditoría: lo lanza Richard.
// Requisitos: Node >= 22 (WebSocket global), inspector del TV reenviado a 127.0.0.1:9227 (como scripts/tv-cdp.mjs),
// Richiflix abierto en Inicio, perfil adulto, sin reproducción ni diálogos.
// Uso:
//   node tv-measure.mjs              -> entorno + capas (paintCount por tecla) + traza de 15 s con 20 teclas
//   node tv-measure.mjs --ab         -> además, variantes CSS inyectadas en caliente (sin tocar el código) con 12 teclas cada una
//   node tv-measure.mjs --overlay    -> además, captura con bordes de capa y regiones de scroll en hilo principal
//   node tv-measure.mjs --gap=120    -> espaciado entre teclas (por defecto 350 ms: deja abrir el panel ampliado, 180 ms)
// Salidas (en el proyecto): artifacts/tv-trace-2026-10-07.json (traza completa, abrir en DevTools > Performance)
//                           artifacts/tv-measure-2026-10-07.json (resumen)
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const PROJECT='C:/Users/richa/Documents/ChatGPT/Richiflix';
const {connectTV}=await import(pathToFileURL(resolve(PROJECT,'scripts/tv-cdp.mjs')).href);
const args=new Set(process.argv.slice(2));
const GAP=Number([...args].find(a=>a.startsWith('--gap='))?.split('=')[1]||350);
const TRACE_MS=15000;
// 20 teclas: 10 a la derecha (las últimas desplazan el rail), bajar, 4 derecha, bajar, 4 derecha.
const KEYS=[...Array(10).fill('ArrowRight'),'ArrowDown',...Array(4).fill('ArrowRight'),'ArrowDown',...Array(4).fill('ArrowRight')];
const CATEGORIES=['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.frame',
 'disabled-by-default-devtools.timeline.invalidationTracking','blink','cc','gpu','viz','v8','disabled-by-default-v8.gc','toplevel','loading'].join(',');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tv=await connectTV(9227);
const events=[];tv.onEvent(message=>events.push(message));
const out={measuredAt:new Date().toISOString(),gapMs:GAP,keys:KEYS};

// --- Código que corre en la página --------------------------------------------------------------
const pageEnv=()=>({
 userAgent:navigator.userAgent,devicePixelRatio:window.devicePixelRatio,screen:[screen.width,screen.height,screen.availWidth,screen.availHeight],
 inner:[innerWidth,innerHeight],client:[document.documentElement.clientWidth,document.documentElement.clientHeight],
 visualViewport:window.visualViewport?[visualViewport.width,visualViewport.height,visualViewport.scale]:null,
 hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,
 nativeInert:Object.prototype.hasOwnProperty.call(HTMLElement.prototype,'inert'),
 supports:{contentVisibility:CSS.supports('content-visibility','auto'),aspectRatio:CSS.supports('aspect-ratio','1'),has:CSS.supports('selector(:has(a))'),containIntrinsic:CSS.supports('contain-intrinsic-size','auto 300px')},
 appRenders:window.__richiflixPerformance?.snapshot?.()?.appRenders??null,
 page:document.querySelector('.topbar nav button.active')?.textContent||null,dialog:Boolean(document.querySelector('[role="dialog"]')),
 dom:{nodes:document.getElementsByTagName('*').length,cards:document.querySelectorAll('.card').length,images:document.querySelectorAll('img').length,iframes:document.querySelectorAll('iframe').length,
  rails:document.querySelectorAll('[data-virtual-kind="rail"]').length,
  decodedImagePixels:[...document.images].reduce((sum,img)=>sum+(img.complete?img.naturalWidth*img.naturalHeight:0),0)},
 images:[...document.images].filter(img=>img.complete&&img.naturalWidth).map(img=>({where:img.closest('.focus-stage')?'banner':img.closest('.card-expansion')?'panel':img.closest('.card')?'card':'other',natural:[img.naturalWidth,img.naturalHeight],box:[img.clientWidth,img.clientHeight],src:img.src.startsWith('blob:')?'blob':img.src.replace(/^https?:\/\/[^/]+/,'').replace(/\/[^/]+$/,'/…')})),
 tmdbResources:performance.getEntriesByType('resource').filter(e=>/image\.tmdb\.org/.test(e.name)).reduce((acc,e)=>{const size=(e.name.match(/\/t\/p\/([^/]+)\//)||[])[1]||'?';acc[size]=acc[size]||{count:0,bytes:0};acc[size].count++;acc[size].bytes+=e.transferSize||e.encodedBodySize||0;return acc;},{}),
 scrollers:[...document.querySelectorAll('main,.cards')].slice(0,12).map(el=>{const s=getComputedStyle(el);return {cls:el.className.slice(0,40),overflowX:s.overflowX,overflowY:s.overflowY,background:s.backgroundColor,willChange:s.willChange};}),
});
const pagePrepare=async()=>{
 if(document.querySelector('[role="dialog"]'))throw Error('Cierra diálogos/reproducción antes de medir.');
 if(!document.querySelector('.topbar nav button.active')?.textContent.includes('Inicio'))throw Error('Deja el TV en Inicio.');
 const main=document.querySelector('main');main.scrollTo({top:0,behavior:'instant'});
 const rail=document.querySelector('.cards[aria-label="Películas"]')||document.querySelector('.cards.virtual-rail');
 rail.scrollTo({left:0,behavior:'instant'});
 for(let i=0;i<40&&!rail.querySelector('.card-open');i++)await new Promise(r=>setTimeout(r,100));
 const first=rail.querySelector('[data-virtual-index="0"] .card-open')||rail.querySelector('.card-open');
 if(!first)throw Error('No hay tarjetas montadas.');
 // The app reveals a far row before focusing into it (revealRowFor); a hidden row's card cannot take focus.
 first.closest('.catalog-row')?.removeAttribute('data-row-far');first.focus({preventScroll:true});await new Promise(r=>setTimeout(r,1500));return true;
};
const pageKeys=async(keys,gap)=>{
 const raf2=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const samples=[];let longTasks=[];
 let po;try{po=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push(Math.round(e.duration));});po.observe({type:'longtask'});}catch{}
 for(const key of keys){
  const before=document.activeElement,t=performance.now();
  before.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  await raf2();
  samples.push({key,ms:Math.round((performance.now()-t)*10)/10,moved:document.activeElement!==before,index:Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex??-1)});
  await new Promise(r=>setTimeout(r,gap));
 }
 await new Promise(r=>setTimeout(r,1200));po?.disconnect();
 const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b),p=f=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*f)-1)];
 return {samples,p50:p(.5),p95:p(.95),max:sorted.at(-1),longTasks,panelOpenAtEnd:Boolean(document.querySelector('.card-expansion')),mountedCards:document.querySelectorAll('.card').length};
};

// Las evaluaciones del inspector caducan a los 15 s: las teclas van en tandas de 5.
const runKeys=async(keys,gap)=>{const parts=[];for(let i=0;i<keys.length;i+=5)parts.push(await tv.evaluate(pageKeys,keys.slice(i,i+5),gap));const samples=parts.flatMap(p=>p.samples),sorted=samples.map(s=>s.ms).sort((a,b)=>a-b),p=f=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*f)-1)];return {samples,p50:p(.5),p95:p(.95),max:sorted.at(-1),longTasks:parts.flatMap(p=>p.longTasks),panelOpenAtEnd:parts.at(-1).panelOpenAtEnd,mountedCards:parts.at(-1).mountedCards};};

// --- Utilidades CDP -----------------------------------------------------------------------------
const metrics=async()=>{try{await tv.send('Performance.enable');const {metrics}=await tv.send('Performance.getMetrics');return Object.fromEntries(metrics.filter(m=>/Nodes|Layout|RecalcStyle|JSHeap|Documents|Frames|LayoutObjects|ScriptDuration|TaskDuration|LayoutDuration|RecalcStyleDuration/.test(m.name)).map(m=>[m.name,Math.round(m.value*1000)/1000]));}catch(e){return {error:e.message};}};
let lastLayers=null;
const onLayers=message=>{if(message.method==='LayerTree.layerTreeDidChange'&&message.params.layers)lastLayers=message.params.layers;};
async function layerSnapshot(){
 lastLayers=null;await tv.send('LayerTree.enable');for(let i=0;i<40&&!lastLayers;i++)await sleep(100);
 return lastLayers||[];
}
async function describe(layer){
 const info={id:layer.layerId,w:Math.round(layer.width),h:Math.round(layer.height),draws:layer.drawsContent,paint:layer.paintCount||0,
  estMB:layer.drawsContent?Math.round(layer.width*layer.height*4/1048576*100)/100:0,repaintsOnScroll:(layer.scrollRects||[]).filter(r=>r.type==='RepaintsOnScroll').length};
 try{const {compositingReasons}=await tv.send('LayerTree.compositingReasons',{layerId:layer.layerId});info.reasons=compositingReasons;}catch{}
 if(layer.backendNodeId){try{const {node}=await tv.send('DOM.describeNode',{backendNodeId:layer.backendNodeId});info.node=`${node.localName||node.nodeName}${(node.attributes||[]).reduce((s,v,i,a)=>a[i-1]==='class'?s+'.'+v.trim().split(/\s+/).slice(0,3).join('.'):s,'')}`;}catch{}}
 return info;
}

// --- 1. Entorno -----------------------------------------------------------------------------------
out.environment=await tv.evaluate(pageEnv);
try{const info=await tv.send('SystemInfo.getInfo');out.gpu={featureStatus:info.gpu?.featureStatus,devices:info.gpu?.devices?.map(d=>`${d.vendorString} ${d.deviceString}`),driverBugWorkarounds:info.gpu?.driverBugWorkarounds?.length};}catch(e){out.gpu={error:e.message};}
try{out.browser=await tv.send('Browser.getVersion');}catch{}
console.log('Entorno:',JSON.stringify({ua:out.environment.userAgent,dpr:out.environment.devicePixelRatio,screen:out.environment.screen,gpu:out.gpu?.featureStatus},null,1));

// --- 2. Capas: recuento, tamaños, motivos y paintCount por tecla -----------------------------------
tv.onEvent(onLayers);
await tv.send('DOM.enable').catch(()=>{});await tv.send('DOM.getDocument',{depth:0}).catch(()=>{});
await tv.evaluate(pagePrepare);
const before=await layerSnapshot();
const layerKeys=await runKeys(KEYS,GAP);
await sleep(300);const after=lastLayers||before;
const paintBefore=new Map(before.map(l=>[l.layerId,l.paintCount||0]));
const described=[];for(const layer of after)described.push(await describe(layer));
for(const d of described)d.paintDelta=d.paint-(paintBefore.get(d.id)??0);
await tv.send('LayerTree.disable').catch(()=>{});
out.layers={countBefore:before.length,countAfter:after.length,drawing:described.filter(d=>d.draws).length,
 estimatedMB:Math.round(described.reduce((s,d)=>s+d.estMB,0)*10)/10,
 repaintsOnScrollLayers:described.filter(d=>d.repaintsOnScroll).map(d=>d.node||d.id),
 topByPaintDelta:[...described].sort((a,b)=>b.paintDelta-a.paintDelta).slice(0,25),
 largest:[...described].sort((a,b)=>b.estMB-a.estMB).slice(0,10),keys:layerKeys};
await mkdir(resolve(PROJECT,'artifacts'),{recursive:true});await writeFile(resolve(PROJECT,'artifacts/tv-measure-2026-10-07.json'),JSON.stringify(out,null,2)+'\n');
console.log(`Capas: ${before.length} antes, ${after.length} después; ~${out.layers.estimatedMB} MB; regiones RepaintsOnScroll: ${out.layers.repaintsOnScrollLayers.length}`);

if(args.has('--overlay')){
 await tv.evaluate(pagePrepare);
 await tv.send('Overlay.enable').catch(()=>{});
 for(const [m,p] of [['Overlay.setShowDebugBorders',{show:true}],['Overlay.setShowScrollBottleneckRects',{show:true}],['Overlay.setShowPaintRects',{result:true}]])await tv.send(m,p).catch(()=>{});
 await runKeys(KEYS.slice(0,6),GAP);
 const shot=await tv.send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(PROJECT,'artifacts/tv-layers-overlay-2026-10-07.png'),Buffer.from(shot.data,'base64'));
 for(const [m,p] of [['Overlay.setShowDebugBorders',{show:false}],['Overlay.setShowScrollBottleneckRects',{show:false}],['Overlay.setShowPaintRects',{result:false}]])await tv.send(m,p).catch(()=>{});
}

// --- 3. Traza de 15 s con 20 teclas ----------------------------------------------------------------
async function trace(run,categories=CATEGORIES,minMs=0){
 const started=Date.now();events.length=0;await tv.send('Tracing.end').catch(()=>{});await sleep(500);events.length=0;
 await tv.send('Tracing.start',{categories,transferMode:'ReportEvents'});
 const value=await run();
 const rest=minMs-(Date.now()-started);if(rest>0)await sleep(rest);
 await tv.send('Tracing.end');
 let complete;for(let i=0;i<600&&!(complete=events.find(e=>e.method==='Tracing.tracingComplete'));i++)await sleep(100);
 if(!complete)console.warn('tracingComplete no llegó en 60 s; se continúa con los eventos recibidos');
 let traceEvents=events.filter(e=>e.method==='Tracing.dataCollected').flatMap(e=>e.params.value||[]);
 if(complete?.params?.stream){let text='';for(;;){const chunk=await tv.send('IO.read',{handle:complete.params.stream,size:1<<20});text+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString('utf8'):chunk.data;if(chunk.eof)break;}await tv.send('IO.close',{handle:complete.params.stream}).catch(()=>{});const parsed=JSON.parse(text);traceEvents=Array.isArray(parsed)?parsed:parsed.traceEvents;}
 if(!traceEvents.length)throw Error('La traza no devolvió eventos');
 return {value,trace:{traceEvents}};
}
function summarize(traceEvents){
 const tn={};for(const e of traceEvents)if(e.name==='thread_name')tn[`${e.pid}:${e.tid}`]=e.args.name;
 const thread=e=>tn[`${e.pid}:${e.tid}`]||'?';
 const sum=filter=>{const list=traceEvents.filter(e=>e.dur&&filter(e));return {count:list.length,ms:Math.round(list.reduce((s,e)=>s+e.dur,0)/100)/10,cpuMs:Math.round(list.reduce((s,e)=>s+(e.tdur||0),0)/100)/10,maxMs:Math.round(Math.max(0,...list.map(e=>e.dur))/100)/10};};
 const main=e=>/Renderer|CrRendererMain/.test(thread(e));
 const raster=traceEvents.filter(e=>e.name==='RasterTask'&&e.dur),byLayer={};
 for(const e of raster){const id=e.args?.tileData?.layerId??'?';(byLayer[id]||={tiles:0,ms:0,frames:new Set()});byLayer[id].tiles++;byLayer[id].ms+=e.dur/1000;byLayer[id].frames.add(e.args?.tileData?.sourceFrameNumber);}
 const blocked=traceEvents.filter(e=>e.name==='RunTask'&&main(e)&&e.dur>30000).map(e=>({wallMs:Math.round(e.dur/1000),cpuMs:Math.round((e.tdur||0)/1000)})).sort((a,b)=>b.wallMs-a.wallMs).slice(0,15);
 const invalid={};for(const e of traceEvents)if(/Invalidation|Invalidate/.test(e.name)){const reason=e.args?.data?.reason||e.args?.data?.changedAttribute||e.args?.data?.nodeName||'';const k=`${e.name}:${reason}`;invalid[k]=(invalid[k]||0)+1;}
 const decodeTypes={};for(const e of traceEvents)if(e.name==='Decode Image')decodeTypes[e.args?.imageType||'?']=(decodeTypes[e.args?.imageType||'?']||0)+1;
 return {threads:[...new Set(Object.values(tn))],raster:sum(e=>e.name==='RasterTask'),rasterThreads:[...new Set(raster.map(e=>e.tid))].length,
  rasterByLayer:Object.entries(byLayer).map(([id,v])=>({layerId:id,tiles:v.tiles,ms:Math.round(v.ms),frames:v.frames.size})).sort((a,b)=>b.ms-a.ms).slice(0,20),
  imageDecodeTask:sum(e=>e.name==='ImageDecodeTask'),decodeImage:sum(e=>e.name==='Decode Image'),decodeTypes,imageUploadTask:sum(e=>e.name==='ImageUploadTask'),gpuTask:sum(e=>e.name==='GPUTask'),
  layerize:sum(e=>e.name==='Layerize'&&main(e)),updateLayoutTree:sum(e=>e.name==='UpdateLayoutTree'&&main(e)),layout:sum(e=>e.name==='Layout'&&main(e)),paint:sum(e=>e.name==='Paint'&&main(e)),prePaint:sum(e=>e.name==='PrePaint'&&main(e)),commit:sum(e=>e.name==='Commit'&&main(e)),
  functionCall:sum(e=>e.name==='FunctionCall'&&main(e)),timerFire:sum(e=>e.name==='TimerFire'&&main(e)),gc:sum(e=>/GC|Scavenge|MarkCompact/.test(e.name)),
  blockedMainTasks:blocked,invalidationsTop:Object.entries(invalid).sort((a,b)=>b[1]-a[1]).slice(0,25)};
}
await tv.evaluate(pagePrepare);
const metricsBefore=await metrics();
const main=await trace(()=>runKeys(KEYS,GAP),CATEGORIES,TRACE_MS);
const metricsAfter=await metrics();
await mkdir(resolve(PROJECT,'artifacts'),{recursive:true});
await writeFile(resolve(PROJECT,'artifacts/tv-trace-2026-10-07.json'),JSON.stringify(main.trace));
out.trace={file:'artifacts/tv-trace-2026-10-07.json',keys:main.value,summary:summarize(main.trace.traceEvents),metricsBefore,metricsAfter};
out.environmentAfter=(await tv.evaluate(pageEnv)).dom;await writeFile(resolve(PROJECT,'artifacts/tv-measure-2026-10-07.json'),JSON.stringify(out,null,2)+'\n');
console.log(`Traza: P95 ${main.value.p95} ms; raster ${out.trace.summary.raster.ms} ms en ${out.trace.summary.raster.count} tiles; decode ${out.trace.summary.decodeImage.ms} ms`);

// --- 4. Variantes A/B (CSS inyectado, se retira al terminar) ---------------------------------------
if(args.has('--ab')){
 const VARIANTS={
  baseline:'',
  // H1: capa permanente por tarjeta montada y halo sólo por opacidad compuesta.
  permanentLayers:'.tv-mode .virtual-rail-cell .card-open,.tv-mode .virtual-grid-cell .card-open{will-change:transform}.tv-mode .virtual-rail-cell .card-open:after,.tv-mode .virtual-grid-cell .card-open:after{will-change:opacity}',
  // H2: scrollers opacos (permite scroll compuesto aunque haya texto LCD).
  opaqueScrollers:'.app.tv-mode .page-scene,.tv-mode .cards.virtual-rail{background-color:#101827}',
  // H3: sin recorte redondeado antialias sobre la imagen (sólo diagnóstico, no es la propuesta visual).
  noRoundClip:'.tv-mode .card .poster,.tv-mode .card .quality-media{border-radius:0!important;overflow:visible!important}',
  // H4: sin transiciones del halo (diagnóstico de capas transitorias).
  noHaloTransition:'.tv-mode .card-open:after{transition:none!important}',
  combined:'',
 };
 VARIANTS.combined=VARIANTS.permanentLayers+VARIANTS.opaqueScrollers;
 const abKeys=[...Array(8).fill('ArrowRight'),'ArrowDown',...Array(3).fill('ArrowRight')];
 out.ab={};
 for(const [name,css] of Object.entries(VARIANTS)){
  await tv.evaluate(css=>{let s=document.getElementById('tv-measure-ab');if(!s){s=document.createElement('style');s.id='tv-measure-ab';document.head.append(s);}s.textContent=css;},css);
  await tv.evaluate(pagePrepare);
  const run=await trace(()=>runKeys(abKeys,GAP),'devtools.timeline,disabled-by-default-devtools.timeline,cc');
  const s=summarize(run.trace.traceEvents);
  out.ab[name]={p50:run.value.p50,p95:run.value.p95,max:run.value.max,longTasks:run.value.longTasks.length,rasterMs:s.raster.ms,rasterTiles:s.raster.count,decodeMs:s.decodeImage.ms,layerizeMs:s.layerize.ms,blockedMax:s.blockedMainTasks[0]||null};
  console.log(name.padEnd(18),JSON.stringify(out.ab[name]));
 }
 await tv.evaluate(()=>document.getElementById('tv-measure-ab')?.remove());
}

await writeFile(resolve(PROJECT,'artifacts/tv-measure-2026-10-07.json'),JSON.stringify(out,null,2)+'\n');
console.log('Resumen: artifacts/tv-measure-2026-10-07.json');
tv.close();
