import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';


// Deterministic demonstration data. No provider login, video or private catalogue.
const root=resolve(import.meta.dirname,'..'),dist=join(root,process.env.RF_RAIL_TEST_DIST||'artifacts/rail-fix-dist'),shots=join(root,'artifacts/rail-fix');await mkdir(shots,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');if(url.pathname.includes('$WEBAPIS')){res.setHeader('Content-Type','text/javascript');res.end('/* PC simulation */');return;}const file=resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(dist+sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080}}),errors=[];let page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error('Demo runtime:',error.message);});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await context.addInitScript(()=>{
  if(window!==window.top)return;
  localStorage.setItem('rf-profiles',JSON.stringify([{id:'demo-adult',name:'Adulto',kind:'adult'},{id:'demo-kids',name:'Kids',kind:'kids'}]));
  // Tizen defaults «Tráilers automáticos» to off; the preview lifecycle below needs it on.
  if(localStorage.getItem('rf-auto-trailers')===null)localStorage.setItem('rf-auto-trailers','true');
  const art=category=>location.origin+'/artwork/categories/'+category+'.png',names=['Última órbita','La ciudad invisible','Después de la luz','Horizonte salvaje','Pequeños mundos','A otra galaxia','Sin vuelta atrás','Marea de medianoche','La isla de papel','Una nueva ruta','El otro lado','Fuego lento'],categories=['action','cinema','series','documentary','animation','cinema','action','horror','animation','documentary','horror','series'];
  const movies=Array.from({length:240},(_,index)=>({id:'demo-movie-'+index,streamId:String(index+1),sourceId:'demo',kind:'vod',mediaType:'movie',title:names[index%12]+(index<12?'':' '+(index+1)),genre:['Acción','Drama','Aventura'][index%3],year:2026,audioLanguage:'Español',image:art(categories[index%12]),url:'xtream://demo/movie/'+(index+1),description:'Historias que te llevan un poco más lejos. Un viaje inesperado donde cada decisión cambia el rumbo.'}));
  const shows=[{...movies[0],id:'demo-series',streamId:'500',mediaType:'series',title:'Bruma',genre:'Misterio',image:art('series'),description:'Una señal atraviesa la noche. Tres desconocidos siguen su rastro hasta una ciudad que ha aprendido a guardar secretos.'}];
  const connection={configured:true,sources:[{id:'demo',name:'Demostración',configured:true,pinned:true}]},catalogue={movies,shows,channels:[],sources:connection.sources,connection,updatedAt:new Date().toISOString()};
  window.__metadata=[];window.__episodeRequests=0;window.__playback=[];
  const details=async(id,type)=>{window.__metadata.push({id:Number(id),type});await new Promise(resolve=>setTimeout(resolve,40));return {ageClassification:{label:['14','TE','7','18','12','PG-13'][(Number(id)-1)%6]||'14',country:(Number(id)-1)%6===5?'US':'CL',source:'TMDB',tmdbId:String(id)},tmdbScore:8.6,tmdbVotes:2540,backdropImage:art(type==='series'?'series':categories[(Number(id)-1)%12]),description:type==='series'?shows[0].description:movies[Number(id)-1]?.description,duration:'1 h 48 min'};};
  const demoCollections=[{kind:'ranking',type:'movie',name:'Mejor valoradas · TMDB',label:'Top · TMDB',ids:movies.slice(0,8).map(item=>item.id)},{kind:'ranking',type:'series',name:'Mejor valoradas · TMDB',label:'Top · TMDB',ids:shows.map(item=>item.id)},{kind:'ranking',type:'movie',name:'Mejor valoradas de los últimos 12 meses · TMDB',label:'Top reciente · TMDB',ids:movies.slice(8,16).map(item=>item.id)},...['Adrenalina y grandes aventuras','Una noche de misterio','Modo buen humor','Viajes a otros mundos','Clásicos que siempre vuelven','Historias que enamoran'].map((name,index)=>({key:'discovery:movie:demo-'+index,kind:'discovery',type:'movie',name,label:['Adrenalina','Misterio','Buen humor','Otros mundos','Clásicos','Romance'][index],ids:movies.slice(index*12,index*12+12).map(item=>item.id)}))];
  window.richiflix={xtreamStatus:async()=>connection,xtreamCatalogue:async()=>catalogue,xtreamRecommendations:async()=>({collections:demoCollections,metadata:{}}),xtreamCachedRatings:async()=>({'demo-movie-0':{tmdbScore:8.6,tmdbVotes:2540}}),xtreamDetails:details,metadataStatus:async()=>({configured:false}),getFullscreen:async()=>true,setFullscreen:async()=>true,onFullscreenChange:()=>()=>{},
   xtreamEpisodes:async()=>{window.__episodeRequests++;return [1,2,3].map(season=>({season:String(season),episodes:Array.from({length:season===1?6:season===2?600:4},(_,index)=>({id:`demo-ep-${season}-${index}`,streamId:`${season}${index}`,sourceId:'demo',kind:'vod',mediaType:'episode',season:String(season),title:season===1?['La señal','Fuera del mapa','Sombras de ayer','La otra orilla','Punto de encuentro','Antes del amanecer'][index]:'Capítulo '+(index+1),episodeNumber:index+1,image:art('series'),description:'Cada pista abre un nuevo camino. El misterio se acerca y nada vuelve a ser como antes.',duration:'46 min',durationSeconds:2760,url:'xtream://demo/series/'+season+'/'+index}))}));},
   xtreamPlayback:async item=>{window.__playback.push(item.id);return location.origin+'/demo-video.mp4';}
  };
  let state='NONE',listener;window.tizen={application:{getCurrentApplication:()=>({exit(){}})},tvinputdevice:{getSupportedKeys:()=>[],registerKey(){}}};window.webapis={avplay:{getState:()=>state,open(){state='IDLE';},close(){state='NONE';},setDisplayRect(){},setDisplayMethod(){},setListener(value){listener=value;},getDuration:()=>2760000,getTotalTrackInfo:()=>[],prepareAsync(done){state='READY';done();},play(){state='PLAYING';setTimeout(()=>listener.oncurrentplaytime(1000),50);},pause(){state='PAUSED';},stop(){state='IDLE';}}};
 });

 let navigationKeys=0;
 const remote=code=>{navigationKeys++;return page.evaluate(code=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',keyCode:code,which:code,bubbles:true,cancelable:true}));},code);};
 await page.goto(origin);await page.getByRole('button',{name:'Adulto',exact:true}).click();await page.locator('.catalog-row .card-open').first().waitFor();
 const results=[];
 const index=()=>page.evaluate(()=>Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex));
 const settled=async(rail,expected,panel=true)=>{
  await expect.poll(index).toBe(expected);
  if(panel)await expect(page.locator('.card-expansion')).toHaveCount(1);else await expect(page.locator('.card-expansion')).toHaveCount(0);
  await page.waitForTimeout(260);
  const geometry=await rail.evaluate(element=>{const selected=document.activeElement.closest('[data-virtual-index]'),card=selected.getBoundingClientRect(),panel=document.querySelector('.card-expansion')?.getBoundingClientRect(),bounds=element.getBoundingClientRect();return {card:{x:card.x,width:card.width},panel:panel?{x:panel.x,width:panel.width}:null,rail:{x:bounds.x,width:bounds.width},scroll:element.scrollLeft,max:element.scrollWidth-element.clientWidth,cells:element.querySelectorAll('.virtual-rail-cell').length,index:Number(selected.dataset.virtualIndex)};});
  assert.ok(geometry.card.x+geometry.card.width/2<geometry.rail.x+geometry.rail.width/2,JSON.stringify(geometry));
  assert.ok(geometry.card.x>=geometry.rail.x-1,JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.scroll-Math.max(0,expected*240-30-40))<=1,'the actual scroll reaches its cached destination: '+JSON.stringify(geometry));
  if(panel){assert.ok(Math.abs(geometry.panel.x-geometry.card.x)<=2,'TV panel always opens right from its left anchor: '+JSON.stringify(geometry));assert.ok(geometry.panel.x+geometry.panel.width<=1920-15);}
  assert.ok(geometry.cells<=Math.ceil(geometry.rail.width/240)+7,'DOM remains bounded');
  results.push(geometry);return geometry;
 };
 const rail=page.locator('.cards[aria-label="Películas"]');await rail.locator('[data-virtual-index="0"] .card-open').focus();await settled(rail,0);
 const count=Number(await rail.getAttribute('data-virtual-count'));
 await remote(37);await settled(rail,count-1,false);await remote(37);const final=await settled(rail,count-2);await page.screenshot({path:join(shots,'ultimo-titulo.png'),animations:'disabled'});
 await remote(39);await settled(rail,count-1,false);await remote(39);await settled(rail,0);
 // Every key through the complete long rail: window crossings and the final items share the same anchor.
 for(let i=1;i<count;i++){await remote(39);await expect.poll(index).toBe(i);if(i%30===0||i>=count-8)await settled(rail,i,i<count-1);}
 await remote(39);await settled(rail,0);
 // A reversal while the panel is open and a burst while the track is still gliding must release old reservations.
 for(let i=0;i<15;i++)await remote(39);await settled(rail,15);await remote(37);await settled(rail,14);
 for(let i=0;i<12;i++)await remote(37);await settled(rail,2);
 // Short recommendations formerly hit their scroll limit before their last card and flipped at the midpoint.
 await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{if(window!==window.top)return;const original=window.richiflix.xtreamCatalogue;window.richiflix.xtreamCatalogue=async()=>({...await original(),movies:(await original()).movies.slice(0,8),shows:[]});window.richiflix.xtreamRecommendations=async()=>({collections:[],metadata:{}});});
 await page.goto(origin);await page.getByRole('button',{name:'Adulto',exact:true}).click();
 const short=page.locator('.cards[aria-label="Películas"]');await short.locator('[data-virtual-index="0"] .card-open').focus();await settled(short,0);
 const shortCount=Number(await short.getAttribute('data-virtual-count'));
 for(let i=1;i<shortCount;i++){await remote(39);await settled(short,i,i<shortCount-1);}
 await remote(39);await settled(short,0);await remote(37);await settled(short,shortCount-1,false);await remote(37);await settled(short,shortCount-2);
 // No global error and no orphaned panel after leaving a rail.
 await page.getByRole('button',{name:'Inicio',exact:true}).focus();await expect(page.locator('.card-expansion')).toHaveCount(0);await page.waitForTimeout(200);
 assert.equal(await short.locator('.virtual-rail-cell').evaluateAll(cells=>cells.some(cell=>cell.getAnimations().length>0)),false);
 assert.deepEqual(errors,[]);await writeFile(join(shots,'checks.json'),JSON.stringify({checks:results.length,navigationKeys,finalAnchor:final.card.x,results},null,2));
 console.log(JSON.stringify({passed:true,checks:results.length,navigationKeys,finalAnchor:final.card.x}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
