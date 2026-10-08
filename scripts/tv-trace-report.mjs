// Resume una traza del TV (artifacts/tv-trace-*.json) con nombres de función vía sourcemap.
// Uso: node scripts/tv-trace-report.mjs <trace.json> [measure.json] [richiflix.js.map]
import {readFileSync} from 'node:fs';
const [,,traceFile,measureFile,mapFile]=process.argv;
const t=JSON.parse(readFileSync(traceFile,'utf8'));const ev=t.traceEvents||t;
let look=()=>'';
if(mapFile){
 const map=JSON.parse(readFileSync(mapFile,'utf8'));const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const vlq=s=>{const o=[];let i=0;while(i<s.length){let r=0,sh=0,c;do{c=B64.indexOf(s[i++]);r+=(c&31)<<sh;sh+=5;}while(c&32);o.push(r&1?-(r>>1):r>>1);}return o;};
 const idx=[];let src=0,ol=0,oc=0,nm=0;
 for(const line of map.mappings.split(';')){let gc=0;const segs=[];for(const seg of line.split(',')){if(!seg)continue;const d=vlq(seg);gc+=d[0];if(d.length>1){src+=d[1];ol+=d[2];oc+=d[3];if(d.length>4)nm+=d[4];}segs.push({gc,src,ol,nm:d.length>4?nm:-1});}idx.push(segs);}
 look=(l,c)=>{let b=null;for(const s of idx[l-1]||[]){if(s.gc<=c)b=s;else break;}return b?`${(map.sources[b.src]||'?').replace(/^.*\/src\//,'src/').replace(/^.*node_modules\//,'nm/')}:${b.ol+1}${b.nm>=0?' '+map.names[b.nm]:''}`:'?';};
}
const tn={};for(const e of ev)if(e.name==='thread_name')tn[`${e.pid}:${e.tid}`]=e.args.name;
const th=e=>tn[`${e.pid}:${e.tid}`]||'?',main=e=>/Renderer/.test(th(e));
let lo=Infinity,hi=-Infinity;for(const e of ev)if(e.ts){if(e.ts<lo)lo=e.ts;if(e.ts>hi)hi=e.ts;}
console.log('ventana ms',Math.round((hi-lo)/1000));
const m=measureFile?JSON.parse(readFileSync(measureFile,'utf8')):null;
if(m){
 console.log('keys P50/P95',m.trace.keys.p50,m.trace.keys.p95,JSON.stringify(m.trace.keys.samples.map(s=>s.ms)));
 console.log('longTasks',m.trace.keys.longTasks.length,'max',Math.max(0,...m.trace.keys.longTasks),'| dom',JSON.stringify(m.environment.dom),'->',JSON.stringify(m.environmentAfter),'| tmdb',JSON.stringify(m.environment.tmdbResources));
 console.log('capas',m.layers.countBefore,'->',m.layers.countAfter,'~'+m.layers.estimatedMB+'MB; repaintsOnScroll:',JSON.stringify(m.layers.repaintsOnScrollLayers));
 console.log('capas mayores:',JSON.stringify(m.layers.largest.map(l=>[l.w,l.h,l.estMB,l.node,(l.reasons||[]).join('/')])));
 console.log('topPaintDelta:',JSON.stringify(m.layers.topByPaintDelta.slice(0,10).map(l=>[l.paintDelta,l.w,l.h,l.node,(l.reasons||[]).slice(0,2).join('/')])));
}
const lay={};if(m)for(const l of (m.layers.topByPaintDelta||[]).concat(m.layers.largest||[]))lay[String(l.id)]=l;
const r=ev.filter(e=>e.name==='RasterTask'&&e.dur);const byL={};let rt=0;
for(const e of r){rt+=e.dur;const id=String(e.args?.tileData?.layerId??'?');byL[id]=byL[id]||{tiles:0,ms:0,frames:new Set()};byL[id].tiles++;byL[id].ms+=e.dur/1000;byL[id].frames.add(e.args?.tileData?.sourceFrameNumber);}
console.log('\nRaster total ms',Math.round(rt/1000),'capas con raster',Object.keys(byL).length,'| en capas no catalogadas:',Math.round(Object.entries(byL).filter(([id])=>!lay[id]).reduce((s,[,v])=>s+v.ms,0)),'ms');
for(const [id,v] of Object.entries(byL).sort((a,b)=>b[1].ms-a[1].ms).slice(0,8)){const l=lay[id];console.log(' ',id.padStart(6),String(v.tiles).padStart(4),'tiles',String(Math.round(v.ms)).padStart(5),'ms',String(v.frames.size).padStart(3),'frames',l?`${l.w}x${l.h} ${l.node||''}`:'(no catalogada)');}
const dec=ev.filter(e=>e.name==='Decode Image'&&e.dur);let dt=0,dmax=0;for(const e of dec){dt+=e.dur;if(e.dur>dmax)dmax=e.dur;}
console.log('Decode Image',dec.length,'ms',Math.round(dt/1000),'max',Math.round(dmax/1000));
const pi={};for(const e of ev)if(e.name==='PaintImage'&&e.args?.data){const d=e.args.data,url=String(d.url||'');const key=(url.match(/\/t\/p\/([^/]+)\//)||[])[1]||(url.startsWith('blob')?'blob':url.startsWith('file')?'local':url.slice(0,20));const k=`${key} ${d.srcWidth}x${d.srcHeight}->${Math.round(d.width)}x${Math.round(d.height)}`;pi[k]=(pi[k]||0)+1;}
console.log('PaintImage:',Object.entries(pi).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`${v}x ${k}`).join(' | '));
const cat=n=>{let c=0,s=0,mx=0;for(const e of ev)if(e.name===n&&e.dur&&main(e)){c++;s+=e.dur;if(e.dur>mx)mx=e.dur;}return `${n}: ${c} / ${Math.round(s/1000)} ms (max ${Math.round(mx/1000)})`;};
console.log('\n'+['Layerize','UpdateLayoutTree','Layout','PrePaint','Paint','Commit','FunctionCall','TimerFire','EventDispatch','HitTest','IntersectionObserverController::computeIntersections'].map(cat).join('\n'));
const rtk=ev.filter(e=>e.name==='RunTask'&&e.dur>50000&&main(e)).map(e=>({wall:Math.round(e.dur/1000),cpu:Math.round((e.tdur||0)/1000)})).sort((a,b)=>b.wall-a.wall).slice(0,8);
console.log('RunTask >50ms wall/cpu:',JSON.stringify(rtk));
const longs=ev.filter(e=>e.name==='RunTask'&&e.dur>80000&&main(e)).sort((a,b)=>b.dur-a.dur).slice(0,4);
for(const L of longs){const inner={};for(const e of ev)if(e.dur&&main(e)&&e.ts>=L.ts&&e.ts+e.dur<=L.ts+L.dur&&e!==L&&e.name!=='RunTask'){const k=e.name==='FunctionCall'&&e.args?.data?`FunctionCall ${e.args.data.functionName||'?'}->${look(e.args.data.lineNumber,e.args.data.columnNumber)}`:e.name;inner[k]=inner[k]||{n:0,ms:0};inner[k].n++;inner[k].ms+=e.dur/1000;}
 console.log(` RunTask ${Math.round(L.dur/1000)}ms (cpu ${Math.round((L.tdur||0)/1000)}):`,Object.entries(inner).sort((a,b)=>b[1].ms-a[1].ms).slice(0,6).map(([k,v])=>`${k}=${Math.round(v.ms)}ms x${v.n}`).join(' ; '));}
const fc={};for(const e of ev)if(e.name==='FunctionCall'&&e.dur&&e.args?.data&&/richiflix\.js/.test(e.args.data.url||'')){const d=e.args.data,k=`${d.functionName||'?'} -> ${look(d.lineNumber,d.columnNumber)}`;fc[k]=fc[k]||{n:0,ms:0,max:0};fc[k].n++;fc[k].ms+=e.dur/1000;fc[k].max=Math.max(fc[k].max,e.dur/1000);}
console.log('\nFunctionCall top:');for(const [k,v] of Object.entries(fc).sort((a,b)=>b[1].ms-a[1].ms).slice(0,12))console.log(' ',String(Math.round(v.ms)).padStart(5),'ms',String(v.n).padStart(4),'x max',Math.round(v.max),' ',k);
const evs={};for(const e of ev)if(e.name==='EventDispatch'&&e.dur&&e.args?.data){const k=e.args.data.type;evs[k]=evs[k]||{n:0,ms:0};evs[k].n++;evs[k].ms+=e.dur/1000;}
console.log('Eventos:',Object.entries(evs).sort((a,b)=>b[1].n-a[1].n).slice(0,8).map(([k,v])=>`${k}:${v.n}/${Math.round(v.ms)}ms`).join(' '));
const inv={};for(const e of ev)if(/InvalidationTracking/.test(e.name)){const d=e.args?.data||{};const k=`${e.name.replace('InvalidationTracking','')}:${d.reason||''}:${d.nodeName||''}${d.selectorPart?'['+d.selectorPart+']':''}${d.changedClass?'.'+d.changedClass:''}${d.changedAttribute?'@'+d.changedAttribute:''}`;inv[k]=(inv[k]||0)+1;}
console.log('Invalidaciones top:',Object.entries(inv).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`${v} ${k}`).join(' | '));
