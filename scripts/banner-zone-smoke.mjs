import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';


// Deterministic demonstration data. No provider login, video or private catalogue.
const root=resolve(import.meta.dirname,'..'),dist=join(root,process.env.RF_BANNER_TEST_DIST||'artifacts/banner-zone-dist'),shots=join(root,'artifacts/banner-zone');await mkdir(shots,{recursive:true});
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


 await page.addInitScript(()=>{
  if(window!==window.top)return;
  const details=window.richiflix.xtreamDetails;window.richiflix.xtreamDetails=async(...args)=>({...await details(...args),trailerId:Number(args[0])===1?'M7lc1UVf-VE':'dQw4w9WgXcQ'});window.__previewPlayers=[];
  window.YT={Player:function(frame,options){let id=options.videoId;const self=this;this.pauses=0;this.plays=0;window.__previewPlayers.push(self);this.getIframe=()=>frame;this.getVideoData=()=>({video_id:id});this.setVolume=()=>{};this.unMute=()=>{};this.pauseVideo=()=>{this.pauses++;options.events.onStateChange({data:2});};this.cueVideoById=value=>{id=value;options.events.onStateChange({data:5});};this.playVideo=()=>{this.plays++;options.events.onStateChange({data:1});};this.destroy=()=>frame.remove();setTimeout(()=>options.events.onReady({target:self}),0);}};
 });
 const remote=code=>page.evaluate(code=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',keyCode:code,which:code,bubbles:true,cancelable:true}));},code);
 const stage=page.locator('.focus-stage'),main=page.locator('main.page-scene'),primary=stage.locator('.primary'),rail=page.locator('.cards[aria-label="Películas"]');let checks=0;
 const banner=async visible=>{await expect(stage).toHaveAttribute('data-stage-visible',String(visible));await expect.poll(()=>main.evaluate(el=>el.getBoundingClientRect().top)).toBe(visible?553.59375:100);await page.waitForTimeout(220);assert.equal(await stage.evaluate(el=>getComputedStyle(el).opacity),visible?'1':'0');checks++;};
 await page.goto(origin);await page.getByRole('button',{name:'Adulto',exact:true}).click();await rail.locator('.card-open').first().waitFor();await banner(true);
 await remote(40);await expect(primary).toBeFocused();await expect(stage.locator('.trailer-preview')).toHaveAttribute('data-trailer-state','playing');const headerPlayer=await page.evaluate(()=>window.__previewPlayers[0].pauses);checks++;
 await remote(39);const recommendation=await stage.getAttribute('data-content-id');await remote(40);await expect(rail.locator('[data-virtual-index="0"] .card-open')).toBeFocused();await banner(false);
 await expect.poll(()=>page.evaluate(()=>window.__previewPlayers[0].pauses)).toBeGreaterThan(headerPlayer);checks++;
 await expect(page.locator('.card-expansion')).toHaveCount(1);await expect(page.locator('.card-expansion')).toHaveAttribute('data-trailer-state','playing');assert.equal(await page.locator('.card-trailer-banner').count(),0,'the card trailer stays inside its card when the banner is hidden');
 const panel=await page.locator('.card-expansion').boundingBox(),deck=await page.locator('.card-trailer-deck').boundingBox();assert.ok(Math.abs(deck.y-panel.y)<1&&Math.abs(deck.width-panel.width)<1);checks++;
 await page.waitForTimeout(1300);await banner(false);assert.equal(await stage.getAttribute('data-content-id'),recommendation,'the hidden carousel is paused');checks++;
 for(let i=0;i<3;i++)await remote(39);await banner(false);await expect(rail.locator('[data-virtual-index="3"] .card-open')).toBeFocused();checks++;
 await page.screenshot({path:join(shots,'catalogo-sin-banner.png'),animations:'disabled'});
 await remote(38);await expect(primary).toBeFocused();await banner(true);assert.equal(await stage.getAttribute('data-content-id'),recommendation,'Up restores the same recommendation');await expect(stage.locator('.trailer-preview')).toHaveAttribute('data-trailer-state','playing');checks++;
 for(let i=0;i<8;i++){await remote(40);await expect.poll(()=>page.evaluate(()=>document.activeElement.matches('.card-open'))).toBe(true);await remote(38);await expect(primary).toBeFocused();}await banner(true);checks++;
 await remote(38);await expect(page.getByRole('button',{name:'Inicio',exact:true})).toBeFocused();await banner(true);
 await main.evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true})));await banner(false);await page.waitForTimeout(700);await banner(false);await primary.focus();await banner(true);
 await page.emulateMedia({reducedMotion:'reduce'});await remote(40);await banner(false);assert.equal(await main.locator(':scope > .content').evaluate(el=>el.getAnimations().length),0,'reduced motion does not animate geometry');checks++;
 await remote(38);await banner(true);await remote(38);await expect(page.getByRole('button',{name:'Inicio',exact:true})).toBeFocused();
 assert.deepEqual(errors,[]);await writeFile(join(shots,'checks.json'),JSON.stringify({passed:true,checks,physicalTVTested:false},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
