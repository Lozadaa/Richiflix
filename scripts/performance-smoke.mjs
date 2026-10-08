import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist-tizen'),calls=new Map();
const fixture=address=>{const action=new URL(address).searchParams.get('action')||'login';calls.set(action,(calls.get(action)||0)+1);
 if(action==='login')return {user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8','ts']}};
 if(action.endsWith('_categories'))return Array.from({length:30},(_,n)=>({category_id:String(n+1),category_name:'Categoría '+(n+1)}));
 const type=action==='get_vod_streams'?'movie':action==='get_series'?'series':action==='get_live_streams'?'live':null;
 if(type){const items=Array.from({length:type==='movie'?14000:type==='live'?8500:4500},(_,n)=>({[type==='series'?'series_id':'stream_id']:n+1,name:(type==='movie'?'Película':type==='live'?'Canal':'Serie')+' '+String(n+1).padStart(5,'0'),category_id:String(n%30+1),container_extension:'mp4'}));if(type==='live'){items[0].name='New York Yankees vs Tampa Bay Rays · MLB';items[1].name=items[0].name;items.push({...items[0],category_id:'2'});}return items;}
 return {info:{plot:'Descripción en español para verificar la portada.',duration_secs:600}};
};
const server=createServer(async(req,res)=>{try{
 const path=resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));if(!path.startsWith(dist+sep))throw Error();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,args:['--enable-precise-memory-info']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname==='ebxvip.xyz'){const data=fixture(url.href);if(!url.searchParams.get('action'))await new Promise(r=>setTimeout(r,1100));return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});}if(route.request().url().startsWith(origin))return route.continue();return route.abort();});
 await page.addInitScript(()=>{if(!localStorage.getItem('rf-fixture-seeded')){localStorage.setItem('rf-fixture-seeded','1');localStorage.setItem('rf-profiles',JSON.stringify([{id:'owner',name:'Mi adulto',kind:'adult'},{id:'child',name:'Kids',kind:'kids'}]));}window.__longTasks=[];new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 await page.goto(origin+'/?diagnostics=1');await page.getByRole('status',{name:'Preparando Richiflix'}).waitFor();assert.equal(await page.locator('.profile-picker').count(),0);
 await page.getByRole('button',{name:'Mi adulto',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.fonts.check('600 24px Manrope')&&document.fonts.check('800 40px "Bricolage Grotesque"')));
 const coldBoot=await page.evaluate(()=>performance.getEntriesByName('richiflix-boot')[0].duration);
 assert.equal(await page.evaluate(()=>window.__richiflixPerformance.snapshot().resources.catalogueWorker.mode),'worker','Catalogue parsing must run in the actual worker');
 await page.getByRole('button',{name:'Mi adulto',exact:true}).click();await page.locator('.card-open').first().waitFor();assert.equal(await page.locator('.catalog-status').count(),0);
 await page.getByRole('button',{name:'Películas',exact:true}).click();await page.locator('.catalog-count').getByText('14.000 títulos',{exact:true}).waitFor();
 assert.equal(Number(await page.locator('.catalog-grid').getAttribute('data-virtual-count')),14000);assert.ok(await page.locator('.virtual-grid-cell').count()<=64);assert.equal(await page.getByRole('button',{name:'Mostrar más',exact:true}).count(),0);
 const cdp=await page.context().newCDPSession(page),heap=async()=>{await cdp.send('HeapProfiler.collectGarbage');return page.evaluate(()=>performance.memory.usedJSHeapSize);};
 const focusedIndex=()=>page.evaluate(()=>Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex??-1));
 await page.locator('.catalog-grid .card-open').first().focus();await page.waitForTimeout(700);await page.evaluate(()=>window.__richiflixPerformance.reset());
 const gridHeaps=[await heap()];let maxGridCards=0;
 for(let round=0;round<3;round++){
  for(let step=0;step<500;step++){
   const current=await focusedIndex(),columns=Number(await page.locator('.catalog-grid').getAttribute('data-virtual-columns')),row=Math.floor(current/columns),column=current%columns;
   const key=row%2===0?(column===columns-1?'ArrowDown':'ArrowRight'):(column===0?'ArrowDown':'ArrowLeft');
   await page.keyboard.press(key);assert.notEqual(await focusedIndex(),current,'Every key must move the virtual focus.');
   if(step%25===0){const mounted=await page.locator('.virtual-grid-cell').count();maxGridCards=Math.max(maxGridCards,mounted);assert.ok(mounted<=64);}
  }
  await page.waitForTimeout(150);gridHeaps.push(await heap());
 }
 assert.ok(gridHeaps.at(-1)<=gridHeaps.at(-2)*1.1,'Heap must stabilize between the last two 500-title rounds.');
 const virtualDiagnostics=await page.evaluate(()=>window.__richiflixPerformance.snapshot()),rememberedIndex=await focusedIndex();
 await page.locator('.topbar nav button.active').focus();await page.evaluate(()=>document.querySelector('main').scrollTop=0);await page.keyboard.press('ArrowDown');assert.ok(await page.locator('.focus-actions .primary').evaluate(button=>button===document.activeElement));
 await page.keyboard.press('ArrowDown');assert.equal(await focusedIndex(),rememberedIndex);await page.waitForTimeout(400);
 assert.ok(await page.evaluate(()=>{const card=document.activeElement.closest('.card').getBoundingClientRect(),viewport=document.querySelector('main').getBoundingClientRect();return card.bottom>viewport.top&&card.top<viewport.bottom;}));
 await page.getByLabel('Categoría',{exact:true}).selectOption('Categoría 2');await page.waitForTimeout(350);assert.ok(await focusedIndex()>=0);assert.ok(await page.locator('.virtual-grid-cell').count()<=64);
 await page.getByLabel('Categoría',{exact:true}).selectOption('Todas');await page.waitForTimeout(200);
 await page.getByRole('button',{name:'Inicio',exact:true}).click();await page.locator('.catalog-row .card-open').first().focus();await page.waitForTimeout(700);
 const metadataBefore=calls.get('get_vod_info')||0;const samples=[];await page.evaluate(()=>window.__longTasks=[]);
 for(let i=0;i<24;i++){const begin=performance.now();await page.keyboard.press('ArrowRight');samples.push(performance.now()-begin);}
 await page.waitForTimeout(700);assert.equal(await page.locator('.card.is-in-banner,.card-banner-position,.card-transfer').count(),0);assert.equal(await page.locator('.card.is-previewed .poster').evaluate(el=>getComputedStyle(el).visibility),'visible');
 const navigation=await page.evaluate(()=>({longTasks:window.__longTasks,focus:Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex),cards:document.querySelectorAll('.card').length}));assert.equal(navigation.focus,24);assert.ok((calls.get('get_vod_info')||0)-metadataBefore<=3,'Passing 24 cards rapidly must not download their metadata');
 const metadataFor24Cards=(calls.get('get_vod_info')||0)-metadataBefore;

 // Duplicate streams merge; two actual channels of the same game keep independent focus.
 await page.getByRole('button',{name:'TV en vivo',exact:true}).click();await page.locator('.catalog-count').getByText('8.500 títulos',{exact:true}).waitFor();
 const sports=page.locator('.catalog-grid .card').filter({has:page.locator('.mlb-duel')});assert.equal(await sports.count(),2);
 assert.notEqual(await sports.nth(0).getAttribute('data-content-id'),await sports.nth(1).getAttribute('data-content-id'));
 await sports.nth(0).locator('.card-open').focus();await page.waitForTimeout(200);assert.equal(await page.locator('.card.is-previewed').count(),1);
 await sports.nth(1).locator('.card-open').focus();await page.waitForTimeout(200);assert.equal(await page.locator('.card.is-previewed').count(),1);assert.ok(await sports.nth(1).evaluate(n=>n.classList.contains('is-previewed')));
 const ids=await page.locator('.catalog-grid .card').evaluateAll(nodes=>nodes.map(n=>n.dataset.contentId));assert.equal(new Set(ids).size,ids.length);
 await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();await page.getByRole('button',{name:'Kids',exact:true}).click();await page.getByText('No hay títulos verificados para Kids',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();await page.getByRole('button',{name:'Mi adulto',exact:true}).click();await page.locator('.card-open').first().waitFor();assert.equal(calls.get('get_vod_streams'),1);assert.equal(calls.get('get_live_streams'),1);assert.equal(calls.get('get_series'),1);
 // Backups must restore real profile identities if the smaller localStorage record disappears.
 await page.evaluate(()=>localStorage.removeItem('rf-profiles'));await page.reload();await page.getByRole('button',{name:'Mi adulto',exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('rf-profiles')).map(p=>p.id)),['owner','child']);
 assert.equal(calls.get('get_vod_streams'),1);const warmBoot=await page.evaluate(()=>performance.getEntriesByName('richiflix-boot')[0].duration);

 await page.evaluate(()=>{const open=indexedDB.open('richiflix-xtream',1);return new Promise(resolve=>{open.onsuccess=()=>{const db=open.result,tx=db.transaction('source'),get=tx.objectStore('source').get('catalogue-eterboxtv');get.onsuccess=()=>{const history={[get.result.movies[0].id]:100};localStorage.setItem('rf-history-owner',JSON.stringify(history));localStorage.setItem('rf-library-v1:owner',JSON.stringify({version:1,updatedAt:Date.now()+1,data:{favorites:[],history}}));db.close();resolve();};};});});
 await page.getByRole('button',{name:'Mi adulto',exact:true}).click();await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();await page.getByRole('button',{name:'Mi adulto',exact:true}).click();
 const continuingCard=page.getByLabel('Continuar viendo',{exact:true}).getByRole('button',{name:'Película 00001',exact:true});await continuingCard.waitFor();await continuingCard.focus();await page.waitForTimeout(200);assert.equal(await page.locator('.card.is-previewed').count(),1);
 const previousInstance=await page.evaluate(()=>document.activeElement.closest('.card').dataset.cardId);
 await page.keyboard.press('ArrowDown');await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>document.activeElement.closest('.cards').getAttribute('aria-label')),'Películas');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Película 00001');
 assert.notEqual(await page.evaluate(()=>document.activeElement.closest('.card').dataset.cardId),previousInstance);assert.equal(await page.locator('.card.is-previewed').count(),1);
 assert.deepEqual(errors,[]);samples.sort((a,b)=>a-b);const report={measurement:'Local headless Chromium; timing is not Samsung hardware or measured compositor paint',fixtureTitles:27000,coldBootMs:Math.round(coldBoot),warmBootMs:Math.round(warmBoot),keyMedianMs:Math.round(samples[Math.floor(samples.length/2)]),keyP95Ms:Math.round(samples[Math.floor(samples.length*.95)]),navigationLongTasks:navigation.longTasks.map(Math.round),metadataFor24Cards,virtualGrid:{steps:1500,maxMounted:maxGridCards,heapBytes:gridHeaps,diagnostics:virtualDiagnostics,focusRestored:true,filterFocusPreserved:true},catalogueDownloadsPerType:1,profilesRestored:true,visibleSelectedCard:true,independentSportsFocus:true,independentRepeatedRowFocus:true};
 await mkdir(join(root,'artifacts'),{recursive:true});await writeFile(join(root,'artifacts/performance-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
