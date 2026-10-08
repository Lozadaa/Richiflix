import {createServer} from 'vite';
import {createServer as createHttpServer} from 'node:http';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
// CARD_LOADING_ROOT measures another copy of the app (the pre-Fase G code) with
// the same fixture; CARD_LOADING_LABEL names artifacts/card-loading-<label>.json.
const root=resolve(process.env.CARD_LOADING_ROOT||resolve(import.meta.dirname,'..')),label=process.env.CARD_LOADING_LABEL||'after-faseG',component=!process.env.CARD_LOADING_ROOT;
const server=await createServer({root,configFile:resolve(root,'vite.config.js'),server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error',plugins:[{name:'card-loading-harness',resolveId:id=>id==='card-harness'?'\0card-harness':null,load:id=>id==='\0card-harness'?`import React from 'react';import {createRoot} from 'react-dom/client';import {QualityImage} from '/src/QualityImage.jsx';import '/src/style.css';const root=createRoot(document.getElementById('root'));window.renderImage=(src,pending)=>root.render(React.createElement('div',{style:{width:240,height:360}},React.createElement(QualityImage,{src,pending,loader:true,eager:true,fallbackWhileLoading:false,fallback:React.createElement('span',{id:'confirmed-fallback'},'Sin imagen')})));window.renderCard=src=>root.render(React.createElement('div',{className:'poster',style:{width:240,height:360,position:'relative'}},React.createElement(QualityImage,{src,eager:true,className:'poster-art',fallback:React.createElement('span',{id:'card-identity'},'Identidad')})));`:null,configureServer(vite){vite.middlewares.use('/__card',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__card','<!doctype html><div id="root"></div><script type="module" src="/@id/__x00__card-harness"></script>'));});}}]});await server.listen();
// Provider and posters arrive through a local HTTP proxy (no Playwright routing:
// routing disables the HTTP cache this phase relies on). Posters share one
// simulated link (spec: 4 Mbit/s, 100 ms RTT; stress: 1 Mbit/s, 300 ms RTT and a
// shorter look between groups); HTTPS hosts are refused.
const POSTER_BYTES=34000,requests=[],link={rtt:100,bits:4e6,free:0};
const poster=index=>`<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513"><path fill="hsl(${index*37%360} 35% 32%)" d="M0 0h342v513H0z"/><text x="30" y="260" font-size="60" fill="#fff">${index}</text></svg>`;
const provider=address=>{
 const url=new URL(address),action=url.searchParams.get('action');
 if(!action)return {user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8','ts']}};
 if(action.endsWith('_categories'))return Array.from({length:6},(_,index)=>({category_id:String(index+1),category_name:'Categoría '+(index+1)}));
 const type=action==='get_vod_streams'?'movie':action==='get_series'?'series':action==='get_live_streams'?'live':null;
 if(type)return Array.from({length:type==='movie'?600:type==='series'?300:20},(_,index)=>({[type==='series'?'series_id':'stream_id']:index+1,name:(type==='movie'?'Película':type==='series'?'Serie':'Canal')+' '+String(index+1).padStart(4,'0'),category_id:String(index%6+1),stream_icon:type==='live'?undefined:`http://posters.fixture/${type}/${index+1}.svg`,cover:type==='series'?`http://posters.fixture/series/${index+1}.svg`:undefined,container_extension:'mp4',plot:'Sinopsis de prueba.'}));
 if(action.endsWith('_info'))return {info:{plot:'Sinopsis de prueba.',duration_secs:600}};
 return {};
};
const proxy=createHttpServer((req,res)=>{
 let url;try{url=new URL(req.url);}catch{res.statusCode=400;res.end();return;}
 if(url.pathname.endsWith('/player_api.php')){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(provider(url.href)));return;}
 if(url.hostname==='posters.fixture'){
  const index=Number(url.pathname.split('/').at(-1).split('.')[0])||0,body=poster(index),padded=body.replace('</svg>',`<!--${'x'.repeat(Math.max(0,POSTER_BYTES-body.length-12))}--></svg>`);
  const now=Date.now(),begin=Math.max(now+link.rtt/2,link.free);link.free=begin+padded.length*8/link.bits*1000;requests.push({at:now,path:url.pathname});
  setTimeout(()=>{res.setHeader('Content-Type','image/svg+xml');res.setHeader('Cache-Control','public, max-age=86400');res.setHeader('Access-Control-Allow-Origin','*');res.end(padded);},link.free+link.rtt/2-now);return;
 }
 res.statusCode=404;res.end();
});
proxy.on('connect',(_req,socket)=>socket.destroy());
await new Promise(done=>proxy.listen(0,'127.0.0.1',done));
const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true,proxy:{server:`http://127.0.0.1:${proxy.address().port}`,bypass:'127.0.0.1'}});
try{
 const checks=[];
 if(component){
  const page=await browser.newPage(),held=new Map();await page.route('**/fixture/**',route=>held.set(new URL(route.request().url()).pathname,route));await page.goto(new URL('/__card',origin).href);await page.waitForFunction(()=>window.renderImage);
  const render=(name,pending)=>page.evaluate(([src,pending])=>window.renderImage(src,pending),[name?new URL('/fixture/'+name+'.svg',origin).href:null,pending]);
  const waitRoute=async name=>{await expect.poll(()=>held.has('/fixture/'+name+'.svg')).toBe(true);return held.get('/fixture/'+name+'.svg');};
  const loading=async()=>{await expect(page.locator('.artwork-spinner')).toHaveCount(1);await expect(page.locator('#confirmed-fallback')).toHaveCount(0);};
  const svg={contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1170"><path fill="#536283" d="M0 0h780v1170H0z"/></svg>'};
  await render(null,true);await loading();await render('late',false);await waitRoute('late');await loading();await (await waitRoute('late')).fulfill(svg);await expect(page.locator('.quality-media')).toHaveAttribute('data-image-state','ready');await expect(page.locator('.artwork-spinner,#confirmed-fallback')).toHaveCount(0);
  await render(null,true);await loading();await render(null,false);await expect(page.locator('#confirmed-fallback')).toHaveCount(1);await expect(page.locator('.artwork-spinner')).toHaveCount(0);
  await render('bad',false);await loading();await (await waitRoute('bad')).abort();await expect(page.locator('#confirmed-fallback')).toHaveCount(1);await expect(page.locator('.artwork-spinner')).toHaveCount(0);
  // Fase G card: no spinner; identity only after 120 ms; it fades out with the poster, then unmounts.
  await page.evaluate(src=>window.renderCard(src),new URL('/fixture/card.svg',origin).href);await waitRoute('card');
  assert.equal(await page.locator('#card-identity').count(),0,'A fast poster never flashes the identity');await expect(page.locator('#card-identity')).toHaveCount(1);assert.equal(await page.locator('.artwork-spinner').count(),0);
  await (await waitRoute('card')).fulfill(svg);await expect(page.locator('.quality-media')).toHaveAttribute('data-image-state','ready');
  assert.equal(await page.locator('#card-identity').count(),1,'The identity stays mounted during the fade');await expect(page.locator('#card-identity')).toHaveCount(0);
  checks.push('metadata pending spinner','download pending spinner','no fallback beneath real image','confirmed missing fallback','failed image fallback','card identity after placeholderDelay','identity fades then unmounts');
  await page.close();
 }
 // Full app, TV mode, throttled posters; each profile starts with empty caches.
 const profiles={};
 for(const [name,setup] of Object.entries({spec:{rtt:100,bits:4e6,look:900},stress:{rtt:300,bits:1e6,look:650}})){
 Object.assign(link,setup,{free:0});
 const context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(()=>{
  localStorage.setItem('rf-profiles',JSON.stringify([{id:'card-loading',name:'Adulto',kind:'adult'}]));localStorage.setItem('rf-auto-trailers','false');
  const stats=window.__cardLoading={entered:0,slow:0,longTasks:[],maxImages:0,maxCells:0},seen=new WeakSet();
  // A card counts once per mounted instance, when at least half of it is on screen;
  // slow = 150 ms later it is still loading (spinner or identity standing in).
  const io=new IntersectionObserver(entries=>{for(const entry of entries){const media=entry.target;if(!entry.isIntersecting||entry.intersectionRatio<.5||seen.has(media))continue;seen.add(media);setTimeout(()=>{if(!media.isConnected)return;stats.entered++;if(['loading','pending'].includes(media.dataset.imageState))stats.slow++;},150);}},{threshold:[0,.5]});
  const watched=new WeakSet();new MutationObserver(()=>{for(const media of document.querySelectorAll('.portrait-card .poster-art'))if(!watched.has(media)){watched.add(media);io.observe(media);}stats.maxImages=Math.max(stats.maxImages,document.querySelectorAll('.card .poster-art>img').length);stats.maxCells=Math.max(stats.maxCells,document.querySelectorAll('.virtual-rail-cell,.virtual-grid-cell').length);}).observe(document,{childList:true,subtree:true});
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries())stats.longTasks.push(Math.round(entry.duration));}).observe({type:'longtask'});}catch{}
 });
 await page.goto(origin+'/?diagnostics=1');await page.getByRole('button',{name:'Adulto',exact:true}).waitFor({timeout:90000});await page.getByRole('button',{name:'Adulto',exact:true}).click();
 await page.locator('.catalog-row .card-open').first().waitFor({timeout:60000});await page.waitForTimeout(2500);
 const reset=()=>page.evaluate(()=>Object.assign(window.__cardLoading,{entered:0,slow:0,longTasks:[],maxImages:0,maxCells:0}));
 const collect=()=>page.evaluate(()=>({...window.__cardLoading,longTasks:window.__cardLoading.longTasks.length}));
 const keys={R:'ArrowRight',L:'ArrowLeft',U:'ArrowUp',D:'ArrowDown'};
 // 30 moves: ten groups of three keys (120 ms apart) with a 900 ms look between groups.
 const walk=async groups=>{for(const group of groups){for(const key of group){await page.keyboard.press(keys[key]);await page.waitForTimeout(120);}await page.waitForTimeout(setup.look);}await page.waitForTimeout(600);};
 const home=['RRR','RRD','RRR','RRU','RRR','RRR','RRD','RRR','RRU','RRR'],grid=['RRD','RRD','LLD','RRD','LLD','RRD','RDD','LLD','RRD','DDR'];
 const enterHome=async()=>{await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.waitForTimeout(400);await page.getByLabel('Películas',{exact:true}).locator('.card-open').first().focus();await page.waitForTimeout(300);};
 const enterMovies=async()=>{await page.getByRole('button',{name:'Películas',exact:true}).click();await page.locator('.catalog-grid .card-open').first().waitFor();await page.waitForTimeout(400);await page.locator('.catalog-grid .card-open').first().focus();await page.waitForTimeout(300);};
 const pass=async(enter,groups)=>{await enter();await reset();const before=requests.length;await walk(groups);const result=await collect();return {...result,loaderVisibleOver150ms:result.entered?Math.round(result.slow/result.entered*1000)/10:0,posterRequests:requests.length-before};};
 const prefetched=()=>page.evaluate(()=>window.__richiflixPerformance?.snapshot?.().resources?.artworkPrefetch?.started||0);
 const cold={home:await pass(enterHome,home)};
 // Burst: ten held keys along the rail after a settled look.
 await page.waitForTimeout(1500);const burstStart=Date.now(),prefetchBefore=await prefetched();
 for(let index=0;index<10;index++){await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);}
 const burst={keys:10,imageRequestsDuringBurst:requests.filter(request=>request.at>=burstStart).length,prefetchRequestsDuringBurst:(await prefetched())-prefetchBefore};
 await page.waitForTimeout(1500);
 cold.movies=await pass(enterMovies,grid);
 const warm={home:await pass(enterHome,home),movies:await pass(enterMovies,grid)};
 const diagnostics=await page.evaluate(()=>{const resources=window.__richiflixPerformance?.snapshot?.().resources||{};return {artworkPrefetch:resources.artworkPrefetch||null,artworkCache:resources.artworkCache||null};});
 profiles[name]={link:setup,cold,warm,burst,diagnostics,errors};await context.close();
 }
 const errors=Object.values(profiles).flatMap(profile=>profile.errors);
 const report={label,root,measurement:'Headless Chromium 1920×1080 TV mode, no CPU throttling; posters (34 kB, HTTP-cacheable) through a local proxy sharing one simulated link per profile; not Samsung hardware',passed:true,checks,profiles,totalPosterRequests:requests.length};
 await mkdir(resolve(import.meta.dirname,'../artifacts'),{recursive:true});await writeFile(resolve(import.meta.dirname,`../artifacts/card-loading-${label}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.deepEqual(errors,[]);
}finally{await browser.close();await server.close();proxy.close();}
