import {pathToFileURL} from 'node:url';
const {connectTV}=await import(pathToFileURL('C:/Users/richa/Documents/ChatGPT/Richiflix/scripts/tv-cdp.mjs').href);
const tv=await connectTV(9227);const events=[];tv.onEvent(m=>events.push(m));const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VARIANTS={
 baseline:'',
 sceneWillChange:'.app.tv-mode .page-scene{will-change:transform}',
 sceneOpaque:'.app.tv-mode .page-scene{background-color:#101827}',
 sceneContainPaint:'.app.tv-mode .page-scene{contain:paint}',
 fixedLayers:'.app.tv-mode>.topbar,.app.tv-mode .focus-stage.hero{will-change:transform}',
 railsOpaque:'.tv-mode .cards.virtual-rail{background-color:#101827}.tv-mode .rail-edge{display:none}',
 all:'.app.tv-mode .page-scene{will-change:transform;background-color:#101827}.app.tv-mode>.topbar,.app.tv-mode .focus-stage.hero{will-change:transform}.tv-mode .cards.virtual-rail{background-color:#101827}.tv-mode .rail-edge{display:none}',
};
const prepare=async()=>{if(document.querySelector('[role="dialog"]'))throw Error('dialog');const main=document.querySelector('main');main.scrollTo({top:0,behavior:'instant'});const rail=document.querySelector('.cards.virtual-rail');rail.scrollTo({left:0,behavior:'instant'});for(let i=0;i<40&&!rail.querySelector('.card-open');i++)await new Promise(r=>setTimeout(r,100));rail.querySelector('[data-virtual-index="0"] .card-open,.card-open').focus({preventScroll:true});await new Promise(r=>setTimeout(r,1500));return true;};
const keys=async(list,gap)=>{const raf2=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const out=[];for(const key of list){const before=document.activeElement,t=performance.now();before.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await raf2();out.push(Math.round(performance.now()-t));await new Promise(r=>setTimeout(r,gap));}await new Promise(r=>setTimeout(r,800));return {ms:out,scrollTop:document.querySelector('main').scrollTop};};
async function layersOf(){let layers=null;const h=m=>{if(m.method==='LayerTree.layerTreeDidChange'&&m.params.layers)layers=m.params.layers;};const off=tv.onEvent(h);await tv.send('LayerTree.enable');for(let i=0;i<40&&!layers;i++)await sleep(100);await tv.send('LayerTree.disable').catch(()=>{});off();const out=[];for(const l of layers||[]){let node='';if(l.backendNodeId){try{const {node:n}=await tv.send('DOM.describeNode',{backendNodeId:l.backendNodeId});node=`${n.localName}${(n.attributes||[]).reduce((s,v,i,a)=>a[i-1]==='class'?s+'.'+v.trim().split(/\s+/).slice(0,2).join('.'):s,'')}`;}catch{}}let reasons=[];try{reasons=(await tv.send('LayerTree.compositingReasons',{layerId:l.layerId})).compositingReasons;}catch{}out.push({id:l.layerId,node,w:Math.round(l.width),h:Math.round(l.height),repaints:(l.scrollRects||[]).filter(r=>r.type==='RepaintsOnScroll').length,reasons});}return out;}
await tv.send('DOM.enable').catch(()=>{});await tv.send('DOM.getDocument',{depth:0}).catch(()=>{});
const list=['ArrowDown','ArrowDown','ArrowDown','ArrowUp','ArrowUp','ArrowUp'];
for(const [name,css] of Object.entries(VARIANTS)){
 await tv.evaluate(css=>{let s=document.getElementById('tv-scroll-ab');if(!s){s=document.createElement('style');s.id='tv-scroll-ab';document.head.append(s);}s.textContent=css;},css);
 await tv.evaluate(prepare);
 const layers=await layersOf();const scene=layers.find(l=>/page-scene/.test(l.node));
 events.length=0;await tv.send('Tracing.end').catch(()=>{});await sleep(300);events.length=0;
 await tv.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,cc',transferMode:'ReportEvents'});
 const k=await tv.evaluate(keys,list,600);
 await tv.send('Tracing.end');for(let i=0;i<300&&!events.find(e=>e.method==='Tracing.tracingComplete');i++)await sleep(100);
 const ev=events.filter(e=>e.method==='Tracing.dataCollected').flatMap(e=>e.params.value||[]);
 const tn={};for(const e of ev)if(e.name==='thread_name')tn[`${e.pid}:${e.tid}`]=e.args.name;
 const raster=ev.filter(e=>e.name==='RasterTask'&&e.dur);let total=0,sceneMs=0,sceneTiles=0;const byLayer={};for(const e of raster){total+=e.dur;const id=String(e.args?.tileData?.layerId);byLayer[id]=(byLayer[id]||0)+e.dur;if(scene&&id===String(scene.id)){sceneMs+=e.dur;sceneTiles++;}}
 const dec=ev.filter(e=>e.name==='Decode Image'&&e.dur).reduce((s,e)=>s+e.dur,0);
 const layerize=ev.filter(e=>e.name==='Layerize'&&e.dur).reduce((s,e)=>s+e.dur,0);
 const paintMain=ev.filter(e=>e.name==='Paint'&&e.dur&&/Renderer/.test(tn[`${e.pid}:${e.tid}`]||'')).reduce((s,e)=>s+e.dur,0);
 const top=Object.entries(byLayer).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,ms])=>`${(layers.find(l=>String(l.id)===id)||{}).node||id}:${Math.round(ms/1000)}`).join(' ');
 console.log(name.padEnd(18),JSON.stringify({keysMs:k.ms,scrollTop:k.scrollTop,layers:layers.length,sceneReasons:scene?.reasons,sceneRepaintRects:scene?.repaints,repaintLayers:layers.filter(l=>l.repaints).map(l=>l.node).join(','),rasterMs:Math.round(total/1000),sceneRasterMs:Math.round(sceneMs/1000),sceneTiles,decodeMs:Math.round(dec/1000),layerizeMs:Math.round(layerize/1000),paintMainMs:Math.round(paintMain/1000),topRaster:top}));
}
await tv.evaluate(()=>document.getElementById('tv-scroll-ab')?.remove());
tv.close();
