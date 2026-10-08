import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

// Local fixture only: browser storage, provider responses and YouTube are
// isolated. CPU throttling is a regression stress test, not a Samsung claim.
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist-tizen'),calls=new Map(),movieInfoIds=new Set(),backdropRequests=new Set();
let origin;
const trailer=index=>'BNR'+String(index).padStart(8,'0');
function provider(address){
 const url=new URL(address),action=url.searchParams.get('action')||'login';calls.set(action,(calls.get(action)||0)+1);
 if(action==='login')return {user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8','ts']}};
 if(action.endsWith('_categories'))return Array.from({length:12},(_,index)=>({category_id:String(index+1),category_name:'Categoría '+(index+1)}));
 const type=action==='get_vod_streams'?'movie':action==='get_series'?'series':action==='get_live_streams'?'live':null;
 if(type)return Array.from({length:type==='movie'?3000:type==='series'?1000:2000},(_,index)=>({
  [type==='series'?'series_id':'stream_id']:index+1,name:(type==='movie'?'Película':type==='series'?'Serie':'Canal')+' '+String(index+1).padStart(5,'0'),
  category_id:String(index%12+1),tmdb_id:type==='movie'?index+1:type==='series'?20001+index:undefined,stream_icon:`${origin}/fixture/poster/${index+1}.svg`,container_extension:'mp4',
  plot:'Sinopsis de prueba para una portada legible desde el sofá.',youtube_trailer:type==='live'?undefined:trailer(index+1)
 }));
 const index=Number(url.searchParams.get('vod_id')||url.searchParams.get('series_id'))||1;
 if(action==='get_vod_info')movieInfoIds.add(index);
 return {info:{tmdb_id:(action==='get_series_info'?20000:0)+index,plot:'Sinopsis de prueba para una portada legible desde el sofá.',duration_secs:600,youtube_trailer:trailer(index),backdrop_path:[`${origin}/fixture/backdrop/${index}.svg`]}};
}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://local');
  if(url.pathname.includes('$WEBAPIS')){res.setHeader('Content-Type','text/javascript');res.end('/* Native API is not needed for banner navigation. */');return;}
  if(url.pathname.startsWith('/fixture/')){
   if(url.pathname.includes('/backdrop/'))backdropRequests.add(Number(url.pathname.split('/').at(-1).split('.')[0]));
   const wide=url.pathname.includes('/backdrop/'),width=wide?1920:780,height=wide?1080:1170;
   res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#425175"/><stop offset="1" stop-color="#101827"/></linearGradient></defs><path fill="url(#g)" d="M0 0h${width}v${height}H0z"/><circle cx="${width*.68}" cy="${height*.36}" r="${width*.22}" fill="#c1b0ee" opacity=".38"/><path d="M${width*.35} ${height*.67}L${width*.65} ${height*.3}L${width*.85} ${height*.7}" fill="none" stroke="#ff977f" stroke-width="${width*.04}"/></svg>`);return;
  }
  const path=resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(dist+sep))throw Error('Outside fixture');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 // BrowserContext interception also covers fetches issued by the worker.
 await context.route('**/*',async route=>{
  const address=route.request().url(),url=new URL(address);
  if(address.startsWith(origin))return route.continue();
  if(url.pathname.endsWith('/player_api.php')){const data=provider(address);if(url.searchParams.get('action')?.endsWith('_info'))await new Promise(resolve=>setTimeout(resolve,40));return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});}
  if(url.hostname==='api.themoviedb.org'){
   const tv=url.pathname.includes('/tv/'),genre=tv?'Drama':'Acción';let data;
   if(url.pathname.includes('/genre/'))data={genres:[{id:18,name:'Drama'},{id:28,name:'Acción'}]};
   else if(url.pathname.endsWith('/top_rated'))data={results:Number(url.searchParams.get('page'))===1?Array.from({length:4},(_,index)=>({id:(tv?20000:0)+index+1,[tv?'name':'title']:(tv?'Serie':'Película')+' '+String(index+1).padStart(5,'0'),vote_average:8.9-index*.1,vote_count:1500+index,genre_ids:index<2?[18,28]:[18]})):[]};
   else {const id=Number(url.pathname.split('/').at(-1)),index=tv?id-20000:id;data={[tv?'name':'title']:(tv?'Serie':'Película')+' '+String(index).padStart(5,'0'),vote_average:8.7,vote_count:1500,genres:[{id:18,name:'Drama'}]};}
   return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  }
  if(url.hostname==='www.youtube-nocookie.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#101827"></body></html>'});
  return route.abort();
 });
 await context.addInitScript(()=>{
  localStorage.setItem('rf-profiles',JSON.stringify([{id:'banner-fixture',name:'Adulto',kind:'adult'}]));
  // Tizen builds default «Tráilers automáticos» to off; this smoke measures the trailer lifecycle.
  localStorage.setItem('rf-auto-trailers','true');
  window.__bannerTrailerCalls=[];
  window.YT={Player:function(frame,options){
   let shown=options.videoId,destroyed=false;const record=(kind,value)=>window.__bannerTrailerCalls.push({kind,value,time:performance.now()});record('create',shown);
   this.getIframe=()=>frame;this.getVideoData=()=>({video_id:shown});
   this.cueVideoById=value=>{shown=value;record('cue',value);options.events.onStateChange({data:5});};
   this.pauseVideo=()=>{record('pause');options.events.onStateChange({data:2});};
   this.playVideo=()=>{record('play',shown);options.events.onStateChange({data:1});};
   this.setVolume=value=>record('volume',value);this.unMute=()=>record('unmute');this.mute=()=>record('mute');
   this.destroy=()=>{destroyed=true;record('destroy');frame.remove();};
   setTimeout(()=>{if(!destroyed)options.events.onReady({target:this});},25);
  }};
 });
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto(origin+'/?diagnostics=1');await page.getByRole('button',{name:'Adulto',exact:true}).waitFor({timeout:60000});await page.getByRole('button',{name:'Adulto',exact:true}).click();
 await page.locator('.catalog-row .card-open').first().waitFor();await page.waitForFunction(()=>document.activeElement.matches('.topbar nav button.active'));
 const workerMode=await page.evaluate(()=>window.__richiflixPerformance.snapshot().resources.catalogueWorker?.mode);assert.equal(workerMode,'worker','The built Tizen catalogue must actually run in its worker');
 const movies=page.getByLabel('Películas',{exact:true}),first=movies.locator('.card-open').first(),stage=page.locator('.focus-stage'),expansionTitle=page.locator('.card-expansion h3'),trailer=page.locator('.card-trailer-deck .trailer-preview');await first.focus();
 // The stage is reserved from the start (Fase C), so reveal the row with the remote once, as tv-navigation-smoke does, before measuring scroll stability.
 for(const key of ['ArrowRight','ArrowLeft']){await page.keyboard.press(key);await page.waitForTimeout(100);}
 const sceneBefore=await page.evaluate(()=>{const main=document.querySelector('main');return {top:main.getBoundingClientRect().top,height:main.clientHeight,trailer:document.querySelector('.card-trailer-deck .trailer-preview')?.dataset.trailerState||'none'};});
 await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(trailer).toHaveAttribute('data-trailer-state','playing');
 const sceneAfter=await page.evaluate(()=>{const main=document.querySelector('main');return {top:main.getBoundingClientRect().top,height:main.clientHeight};});assert.equal(sceneBefore.trailer==='playing',false);assert.deepEqual(sceneAfter,{top:sceneBefore.top,height:sceneBefore.height},'Starting a trailer never moves or resizes the scene');
 const actions=stage.locator('.focus-actions');
 // The card owns focus while its banner shows information. Hidden actions are
 // still mounted so the remote can enter them directly from the first row.
 await expect(actions).toHaveCSS('opacity','0');await expect(actions).toHaveCSS('pointer-events','none');await expect(actions).toHaveAttribute('aria-hidden','true');
 assert.deepEqual(await actions.locator('button').evaluateAll(buttons=>buttons.map(button=>button.tabIndex)),[-1,-1]);await expect(stage.locator('h1')).toBeVisible();
 await page.waitForFunction(()=>document.querySelector('.focus-stage .focus-backdrop')?.dataset.imageState==='ready');
 const immersiveHeader=await page.evaluate(()=>{const header=document.querySelector('.app>.topbar'),stage=document.querySelector('.focus-stage'),main=document.querySelector('main'),style=getComputedStyle(header);return {backgroundColor:style.backgroundColor,backdropFilter:style.backdropFilter||'none',webkitBackdropFilter:style.webkitBackdropFilter||'none',stageTop:stage.getBoundingClientRect().top,stageHeight:stage.getBoundingClientRect().height,mainTop:main.getBoundingClientRect().top,expectedStageHeight:100+innerHeight*.42};});
 assert.equal(immersiveHeader.backgroundColor,'rgba(0, 0, 0, 0)','TV navigation blends into the stage with a transparent header');assert.equal(immersiveHeader.backdropFilter,'none');assert.equal(immersiveHeader.webkitBackdropFilter,'none');assert.equal(immersiveHeader.stageTop,0);assert.ok(Math.abs(immersiveHeader.stageHeight-immersiveHeader.expectedStageHeight)<1);assert.ok(Math.abs(immersiveHeader.mainTop-immersiveHeader.stageHeight)<1,'The catalogue keeps its stable position below the stage');
 await page.waitForTimeout(550);const metadataBefore=calls.get('get_vod_info')||0;
 await page.evaluate(()=>{
  window.__bannerMutations=[];window.__bannerStarted=performance.now();window.__bannerFirstTrailerCount=window.__bannerTrailerCalls.length;
  const stage=document.querySelector('.focus-stage');window.__bannerObserver=new MutationObserver(records=>{for(const record of records)if(record.type==='attributes'&&record.attributeName==='data-content-id')window.__bannerMutations.push({id:stage.dataset.contentId,time:performance.now()});});
  window.__bannerObserver.observe(stage,{attributes:true,attributeFilter:['data-content-id']});window.__richiflixPerformance?.reset();
 });
 const burst=await page.evaluate(async()=>{
  const main=document.querySelector('main'),stage=document.querySelector('.focus-stage'),initial={top:main.offsetTop,height:main.clientHeight,scroll:main.scrollTop},beforeArt=[...stage.querySelectorAll('.focus-stage-visual img')].map(image=>image.getAttribute('src')),initialId=stage.dataset.contentId;
  const samples=[],nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  for(let index=0;index<30;index++){
   const sent=performance.now();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:index>0,bubbles:true,cancelable:true}));await nextPaint();
   samples.push({keyToSecondRAF:performance.now()-sent,index:Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex),stageId:stage.dataset.contentId,phase:stage.dataset.stageState,trailer:document.querySelector('.card-trailer-deck .trailer-preview')?.dataset.trailerState||'poster',top:main.offsetTop,height:main.clientHeight,scroll:main.scrollTop,art:[...stage.querySelectorAll('.focus-stage-visual img')].map(image=>image.getAttribute('src'))});
   await new Promise(resolve=>setTimeout(resolve,125));
  }
  return {initial,initialId,beforeArt,samples,lastMoveAt:performance.now()-125,focusLabel:document.activeElement.getAttribute('aria-label'),mutations:window.__bannerMutations.slice(),trailerCalls:window.__bannerTrailerCalls.slice(window.__bannerFirstTrailerCount)};
 });
 assert.equal(burst.samples.length,30);for(const [index,sample]of burst.samples.entries()){
  assert.equal(sample.index,index+1,'Every repeat moves focus immediately');assert.equal(sample.stageId,burst.initialId,'Moving cards never change the recommendation banner');assert.equal(sample.phase,'browsing');assert.equal(sample.trailer,'poster','Video must be hidden while moving');
  assert.equal(sample.top,burst.initial.top);assert.equal(sample.height,burst.initial.height);assert.equal(sample.scroll,burst.initial.scroll,'Horizontal navigation keeps the catalogue scroll stable');assert.deepEqual(sample.art,burst.beforeArt,'A moving banner never swaps artwork');
 }
 assert.deepEqual(burst.mutations,[]);assert.equal(burst.trailerCalls.filter(call=>['cue','create','play'].includes(call.kind)).length,0);assert.equal((calls.get('get_vod_info')||0)-metadataBefore,0,'Skipped cards do not start metadata requests');
 await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(expansionTitle).toHaveText(burst.focusLabel);await expect(trailer).toHaveAttribute('data-trailer-state','playing');
 const settled=await page.evaluate(()=>({mutations:window.__bannerMutations.slice(),calls:window.__bannerTrailerCalls.slice(window.__bannerFirstTrailerCount),iframes:document.querySelectorAll('.trailer-preview iframe').length,main:{top:document.querySelector('main').offsetTop,height:document.querySelector('main').clientHeight,scroll:document.querySelector('main').scrollTop},diagnostics:window.__richiflixPerformance?.snapshot(),visible:(()=>{const card=document.activeElement.closest('.card').getBoundingClientRect(),main=document.querySelector('main').getBoundingClientRect();return card.top>=main.top&&card.bottom<=main.bottom;})()}));
 assert.equal(settled.mutations.length,0,'Fase C2: the TV banner is a recommendation carousel and never follows the selected card');assert.equal(settled.calls.filter(call=>call.kind==='cue').length,1);assert.equal(settled.calls.filter(call=>call.kind==='create').length,0);assert.equal(settled.calls.filter(call=>call.kind==='destroy').length,0);assert.equal(settled.iframes,1);assert.deepEqual(settled.main,burst.initial);assert.equal(settled.visible,true);
 await expect(actions).toHaveCSS('opacity','0');await expect(actions).toHaveAttribute('aria-hidden','true');
 const allTrailerCalls=await page.evaluate(()=>window.__bannerTrailerCalls);assert.equal(allTrailerCalls.filter(call=>call.kind==='create').length,1);assert.equal(allTrailerCalls.filter(call=>call.kind==='mute').length,0);for(const[index,call]of allTrailerCalls.entries())if(call.kind==='play')assert.equal(allTrailerCalls[index-1]?.kind,'unmute','Sound is applied before each play');
 // Samsung cards expose one remote target. Mi lista belongs to the banner;
 // desktop pointer-specific Card-save interaction has separate coverage.
 const focused=movies.locator('[data-virtual-index="30"] .card-open');await expect(movies.locator('.card-save,.card-play')).toHaveCount(0);
 // Both future titles have metadata and decoded artwork before focus reaches
 // them. Reverse direction must warm the preceding two, rather than the next.
 await expect.poll(()=>[32,33].every(id=>movieInfoIds.has(id)&&backdropRequests.has(id))).toBe(true);
 await page.keyboard.press('ArrowLeft');await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(expansionTitle).toHaveText('Película 00030');
 await expect.poll(()=>[28,29].every(id=>movieInfoIds.has(id)&&backdropRequests.has(id))).toBe(true);
 await page.keyboard.press('ArrowRight');await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(expansionTitle).toHaveText(burst.focusLabel);
 await page.locator('main').dispatchEvent('wheel',{deltaY:0});await expect(stage).toHaveAttribute('data-stage-state','browsing');await expect(stage.locator('.trailer-preview')).toHaveAttribute('data-trailer-state','poster');await expect(stage).toHaveAttribute('data-stage-state','settled');
 // Banner actions are destinations themselves, so they must become usable
 // immediately. The quiet period only applies when moving between titles.
 const afterKey=key=>page.evaluate(async key=>{const started=performance.now();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const stage=document.querySelector('.focus-stage'),actions=stage.querySelector('.focus-actions'),style=getComputedStyle(actions);return {elapsed:performance.now()-started,phase:stage.dataset.stageState,primary:document.activeElement.matches('.focus-actions .primary'),favorite:document.activeElement.matches('.focus-actions .secondary'),card:document.activeElement.matches('.card-open'),index:Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex??-1),actions:{opacity:Number(style.opacity),pointerEvents:style.pointerEvents,accessible:actions.getAttribute('aria-hidden')!=='true',tabIndices:[...actions.querySelectorAll('button')].map(button=>button.tabIndex)},focusRegion:document.body.dataset.focusRegion,main:{top:document.querySelector('main').offsetTop,height:document.querySelector('main').clientHeight,scroll:document.querySelector('main').scrollTop}};},key);
 const expectActionZone=(sample,active)=>{assert.equal(sample.actions.pointerEvents,active?'auto':'none');assert.equal(sample.actions.accessible,active);assert.deepEqual(sample.actions.tabIndices,active?[0,0]:[-1,-1]);assert.equal(sample.focusRegion,active?'banner':'catalogue','The app exposes exactly one active focus zone');assert.deepEqual(sample.main,burst.initial,'Showing banner actions never changes catalogue geometry');};
 const expectCardHalo=active=>expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('.card.is-previewed .card-open')].filter(card=>Number(getComputedStyle(card,'::after').opacity)>.01).length)).toBe(active?1:0);
 await focused.focus();await expect(stage).toHaveAttribute('data-stage-state','settled');await page.locator('.topbar nav button.active').focus();await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(stage).toHaveAttribute('data-content-id',burst.initialId);await expect(actions).toHaveCSS('opacity','0');await expectCardHalo(false);
 const headerEntry=await afterKey('ArrowDown');assert.equal(headerEntry.primary,true);assert.equal(headerEntry.phase,'settled','Entering banner controls reveals them immediately');assert.ok(headerEntry.elapsed<480,'Banner controls never wait for the card quiet period');
 expectActionZone(headerEntry,true);await expect(actions).toHaveCSS('opacity','1');await expectCardHalo(false);
 const actionRight=await afterKey('ArrowRight');assert.equal(actionRight.favorite,true);assert.equal(actionRight.phase,'settled','Changing banner actions does not hide the banner');
 expectActionZone(actionRight,true);
 const favorite=actions.locator('.secondary');await favorite.press('Enter');await expect(favorite).toHaveAttribute('aria-pressed','true');await expect(favorite).toBeFocused();await expect(actions).toHaveCSS('opacity','1');await favorite.press('Enter');await expect(favorite).toHaveAttribute('aria-pressed','false');await expect(favorite).toBeFocused();
 const actionLeft=await afterKey('ArrowLeft');assert.equal(actionLeft.primary,true);assert.equal(actionLeft.phase,'settled');
 expectActionZone(actionLeft,true);
 // Fase C2: the dots are the only place where Left/Right change the slide.
 const slideOf=()=>page.evaluate(()=>({slide:Number(document.querySelector('.focus-stage').dataset.slide),id:document.querySelector('.focus-stage').dataset.contentId,dot:document.activeElement.matches('.banner-dots .active'),count:document.querySelectorAll('.banner-dots button').length}));
 const dotsBefore=await slideOf();await page.keyboard.press('ArrowUp');const dotsEntry=await slideOf();assert.equal(dotsEntry.dot,true,'Up from the banner actions reaches the carousel dots');assert.equal(dotsEntry.slide,dotsBefore.slide);
 await page.keyboard.press('ArrowRight');const dotsNext=await slideOf();assert.equal(dotsNext.slide,(dotsBefore.slide+1)%dotsBefore.count);assert.equal(dotsNext.dot,true);assert.notEqual(dotsNext.id,dotsBefore.id);
 await page.keyboard.press('ArrowLeft');const dotsBack=await slideOf();assert.equal(dotsBack.slide,dotsBefore.slide);assert.equal(dotsBack.id,dotsBefore.id);
 await page.keyboard.press('ArrowDown');await expect(actions.locator('.primary')).toBeFocused();
 const catalogueEntry=await afterKey('ArrowDown');assert.equal(catalogueEntry.card,true);assert.equal(catalogueEntry.index,30);assert.equal(catalogueEntry.phase,'browsing','Entering the catalogue marks the banner as browsing (it stays visible)');
 expectActionZone(catalogueEntry,false);await expect(actions).toHaveCSS('opacity','0');await expectCardHalo(true);
 const firstRowReturn=await afterKey('ArrowUp');assert.equal(firstRowReturn.primary,true);assert.equal(firstRowReturn.phase,'settled','Returning from the first row reveals banner actions immediately');assert.ok(firstRowReturn.elapsed<480);
 expectActionZone(firstRowReturn,true);await expect(actions).toHaveCSS('opacity','1');await expectCardHalo(false);
 await mkdir(join(root,'artifacts'),{recursive:true});await page.screenshot({path:join(root,'artifacts/banner-navigation-actions.png')});
 const finalCatalogueEntry=await afterKey('ArrowDown');assert.equal(finalCatalogueEntry.card,true);assert.equal(finalCatalogueEntry.phase,'browsing');
 // The halo yields to the expanded panel 250 ms later, so check it before the 1.5 s trailer wait.
 expectActionZone(finalCatalogueEntry,false);await expect(actions).toHaveCSS('opacity','0');await expectCardHalo(true);await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(trailer).toHaveAttribute('data-trailer-state','playing');await expect(expansionTitle).toHaveText(burst.focusLabel);
 await page.screenshot({path:join(root,'artifacts/banner-navigation-settled.png')});assert.equal(await movies.locator('.card-meta').count(),0,'Year and audio are absent from movie captions');assert.equal(await stage.locator('.focus-eyebrow').textContent(),'Drama');await expect(stage.locator('.title-facts')).toContainText('10 min');assert.ok(await stage.locator('.title-facts').evaluate(element=>element.previousElementSibling.classList.contains('focus-description')));
 // Enter on the card continues to open playback; no invisible banner button
 // captures activation. Closing returns focus to that same card.
 await focused.press('Enter');const player=page.getByRole('dialog',{name:'Reproduciendo '+burst.focusLabel});await expect(player).toBeVisible();await player.getByRole('button',{name:'Cerrar',exact:true}).focus();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.keyboard.press('Escape');await expect(player).toHaveCount(0);await expect(focused).toBeFocused();
 await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(actions).toHaveCSS('opacity','0');
 // Scoped category search uses the selected media section, with remote buttons.
 await page.getByRole('button',{name:'Películas',exact:true}).click();await page.getByRole('button',{name:'Filtrar Películas por categoría',exact:true}).waitFor();
 await page.getByRole('button',{name:'Filtrar Películas por categoría',exact:true}).click();const categoryDialog=page.getByRole('dialog',{name:'Categorías de Películas'});await expect(categoryDialog).toBeVisible();
 assert.equal(await categoryDialog.evaluate(element=>!!element.closest('[inert]')),false,'The category overlay must remain outside the inert catalogue');
 await categoryDialog.getByRole('button',{name:'Categoría 2',exact:true}).focus();await page.keyboard.press('Enter');await expect(categoryDialog).toHaveCount(0);
 await expect(page.locator('.catalog-count')).toHaveText('250 títulos');
 const searchField=page.getByLabel('Buscar títulos y canales');await searchField.focus();await searchField.fill('NO_RESULTS_FIXTURE');await expect(page.locator('.catalog-count')).toHaveText('0 resultados');await expect(stage).toHaveCount(0);await expect(page.locator('.trailer-preview iframe')).toHaveCount(0);
 await page.getByLabel('Buscar títulos y canales').fill('00002');await expect(page.locator('.catalog-count')).toHaveText('1 resultados');await expect(page.locator('.catalog-grid .card-open')).toHaveCount(1);await expect(page.locator('.catalog-grid .card-open').first()).toHaveAttribute('aria-label','Película 00002');
 await page.getByRole('button',{name:'Series',exact:true}).click();await page.getByLabel('Buscar títulos y canales').fill('00002');await expect(page.locator('.catalog-count')).toHaveText('1 resultados');await expect(page.locator('.catalog-grid .card-open').first()).toHaveAttribute('aria-label','Serie 00002');
 await page.getByRole('button',{name:'Películas',exact:true}).click();await page.getByRole('button',{name:'Filtrar Películas por categoría',exact:true}).click();
 const rankedDialog=page.getByRole('dialog',{name:'Categorías de Películas'});await rankedDialog.getByRole('button',{name:'Mejor valoradas · TMDB',exact:true}).waitFor();await rankedDialog.getByRole('button',{name:'Mejor valoradas · TMDB',exact:true}).click();await expect(page.locator('.catalog-count')).toHaveText('4 títulos');
 await page.locator('.catalog-grid .card-open').first().focus();await expect(stage).toHaveAttribute('data-stage-state','settled');await expect(stage.locator('.user-score')).toContainText('TMDB');await expect(stage.locator('.tmdb-rank')).toContainText('#1 TMDB');assert.equal(await page.locator('.catalog-grid .card-meta').count(),0);
 await page.getByRole('button',{name:'Filtrar Películas por categoría',exact:true}).click();await page.getByRole('dialog',{name:'Categorías de Películas'}).getByRole('button',{name:'Lo mejor de Acción · TMDB',exact:true}).click();await expect(page.locator('.catalog-count')).toHaveText('2 títulos');
 await page.getByLabel('Buscar títulos y canales').fill('00002');await expect(page.locator('.catalog-count')).toHaveText('1 resultados');
 await page.screenshot({path:join(root,'artifacts/tmdb-ranking-preview.png')});
 // A vertical grid move predicts the same column in the next two rows.
 await page.getByRole('button',{name:'Películas',exact:true}).click();await page.locator('.catalog-grid .card-open').first().focus();await page.keyboard.press('ArrowDown');await expect(stage).toHaveAttribute('data-stage-state','settled');
 const verticalFuture=await page.evaluate(()=>{const grid=document.querySelector('.catalog-grid'),index=Number(document.activeElement.closest('[data-virtual-index]').dataset.virtualIndex),columns=Number(grid.dataset.virtualColumns);return [index+columns+1,index+columns*2+1];});
 await expect.poll(()=>verticalFuture.every(id=>movieInfoIds.has(id)&&backdropRequests.has(id))).toBe(true);
 assert.ok(await page.evaluate(()=>Number(getComputedStyle(document.querySelector('.focus-stage')).zIndex)<Number(getComputedStyle(document.querySelector('main')).zIndex)),'Banner artwork stays behind catalogue content');
 // Fase C2 rotation: a fresh page without automatic trailers (Tizen default).
 // 30 card keys never rotate; after the rest (2 s) + one 9 s interval the
 // banner rotates exactly once, crossfading without Layout or scene resize.
 async function carouselCase(){
  const view=await context.newPage();view.on('pageerror',error=>errors.push(error.message));await view.addInitScript(()=>localStorage.setItem('rf-auto-trailers','false'));
  const tracer=await context.newCDPSession(view);
  const trace=async run=>{const events=[];const receive=chunk=>events.push(...chunk.value);tracer.on('Tracing.dataCollected',receive);await tracer.send('Tracing.start',{categories:'devtools.timeline',transferMode:'ReportEvents'});const value=await run();const done=new Promise(resolve=>tracer.once('Tracing.tracingComplete',resolve));await tracer.send('Tracing.end');await done;tracer.off('Tracing.dataCollected',receive);return {events,value};};
  await view.goto(origin+'/');await view.getByRole('button',{name:'Adulto',exact:true}).click();await view.locator('.catalog-row .card-open').first().waitFor();
  await expect(view.locator('.banner-dots button')).toHaveCount(8,{timeout:20000});
  const cards=view.getByLabel('Películas',{exact:true});await cards.locator('.card-open').first().focus();
  const keys=await view.evaluate(async()=>{
   const stage=document.querySelector('.focus-stage'),slides=[];
   for(let index=0;index<30;index++){document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:index>0,bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,125));slides.push(stage.dataset.slide);}
   return {slides,initial:slides[0]};
  });
  assert.ok(keys.slides.every(slide=>slide===keys.initial),'The banner never rotates during a key burst');
  await view.keyboard.press('Escape');await expect(view.locator('.topbar nav button.active')).toBeFocused();
  const rest=await view.evaluate(()=>{const stage=document.querySelector('.focus-stage');window.__rotations=[];window.__restAt=performance.now();new MutationObserver(()=>{console.timeStamp('richiflix-rotation');window.__rotations.push({slide:stage.dataset.slide,id:stage.dataset.contentId,at:performance.now()-window.__restAt});}).observe(stage,{attributes:true,attributeFilter:['data-slide']});const main=document.querySelector('main').getBoundingClientRect(),box=stage.getBoundingClientRect();return {slide:stage.dataset.slide,main:[main.top,main.height],stage:[box.top,box.height]};});
  await view.waitForTimeout(9500);assert.deepEqual(await view.evaluate(()=>window.__rotations),[],'No rotation before rest + interval');
  const {events,value:rotation}=await trace(async()=>{await view.waitForFunction(()=>window.__rotations.length>0,null,{timeout:6000});await view.waitForTimeout(450);return view.evaluate(()=>{const stage=document.querySelector('.focus-stage'),main=document.querySelector('main').getBoundingClientRect(),box=stage.getBoundingClientRect();return {rotations:window.__rotations.slice(),main:[main.top,main.height],stage:[box.top,box.height]};});});
  const stamp=events.find(event=>event.name==='TimeStamp'&&event.args?.data?.message==='richiflix-rotation')?.ts,layouts=events.filter(event=>event.name==='Layout'&&event.ph==='X'&&stamp!==undefined&&event.ts>=stamp).map(event=>Math.round((event.ts-stamp)/100)/10);
  // The commit swaps the copy text once (contained in the stage); the 320 ms fade itself must not lay out.
  const commitLayouts=layouts.filter(ms=>ms<50),fadeLayouts=layouts.filter(ms=>ms>=50&&ms<=320);
  await view.waitForTimeout(Math.max(0,13000-rotation.rotations[0].at-450));const rotations=await view.evaluate(()=>window.__rotations);await view.close();
  assert.ok(stamp!==undefined,'Rotation timestamp captured');assert.equal(rotations.length,1,'Exactly one rotation within 13 s of rest');assert.ok(rotations[0].at>=10500&&rotations[0].at<=12500,`Rotation at ${rotations[0].at} ms after rest`);assert.equal(rotations[0].slide,String((Number(rest.slide)+1)%8));
  assert.deepEqual(rotation.main,rest.main,'The scene keeps its geometry through a rotation');assert.deepEqual(rotation.stage,rest.stage);assert.equal(fadeLayouts.length,0,`Layout during the crossfade: ${fadeLayouts} (all: ${layouts})`);assert.ok(commitLayouts.length<=1,`Commit layouts: ${commitLayouts}`);
  return {burstKeys:30,rotationsDuringBurst:0,rotationAfterRestMs:Math.round(rotations[0].at),rotationsWithin13s:rotations.length,commitLayoutEvents:commitLayouts.length,fadeLayoutEvents:fadeLayouts.length,layoutOffsetsMs:layouts,sceneGeometryStable:true};
 }
 assert.deepEqual(errors,[]);const timings=burst.samples.map(sample=>sample.keyToSecondRAF).sort((a,b)=>a-b);
 const report={measurement:'Isolated headless Chromium, 1920×1080, 4× CPU throttling; simulated YouTube API, not Samsung hardware or real trailer decoding',catalogueWorkerMode:workerMode,fixtureTitles:6000,movementKeys:30,quietPeriodMs:480,tvTrailerDelayMs:1500,sceneStableAcrossTrailer:{before:sceneBefore,after:sceneAfter},keyIntervalWaitMs:125,keyToSecondRAFP95Ms:Math.round(timings[Math.ceil(timings.length*.95)-1]*10)/10,keyToSecondRAFMaxMs:Math.round(timings.at(-1)*10)/10,intermediateBannerCommits:0,intermediateArtworkChanges:0,intermediateVideoCues:0,intermediateMetadataRequests:0,finalBannerCommits:settled.mutations.length,bannerFollowsCard:false,dotsSlideChange:{slides:dotsBefore.count,from:dotsBefore.slide,to:dotsNext.slide},iframeCreations:1,iframeReused:true,unmuted:true,catalogueGeometryStable:true,selectedCardFullyVisible:true,listActionsStable:true,headerToBannerMs:Math.round(headerEntry.elapsed*10)/10,firstRowToBannerMs:Math.round(firstRowReturn.elapsed*10)/10,bannerActionsImmediate:true,bannerActionsOnlyWhileFocused:true,bannerActionNavigationStable:true,singleVisibleFocusZone:true,cardEnterPlaybackAndEscape:true,catalogueEntryMarksBrowsing:true,bannerIndependentOfCard:true,scopedCategorySearch:true,tmdbScoreAndCollections:true,factsBelowDescription:true,bannerBehindCatalogue:true,immersiveHeader,diagnostics:settled.diagnostics};
 report.intelligentPreload={forward:true,reverse:true,vertical:true,verticalFuture};
 report.carousel=await carouselCase();assert.deepEqual(errors,[]);
 await writeFile(join(root,'artifacts/banner-navigation-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
