import {createServer} from 'vite';
import {createServer as createHttpServer} from 'node:http';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {defaultSource} from '../src/sourceDefaults.js';
// Fase L4: «ahora y después» on «TV en vivo» (TV mode, headless Chromium 1920×1080, not Samsung hardware).
// The provider answers through a local proxy; get_short_epg returns base64 listings (guide) or an empty list (empty).
const root=resolve(import.meta.dirname,'..'),requests=[];let mode='guide';
const b64=value=>Buffer.from(value,'utf8').toString('base64');
const provider=address=>{
 const url=new URL(address),action=url.searchParams.get('action');
 if(!action)return {user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8','ts']}};
 if(action.endsWith('_categories'))return [{category_id:'1',category_name:'Noticias'},{category_id:'2',category_name:'Deportes'}];
 if(action==='get_live_streams')return Array.from({length:300},(_,index)=>({stream_id:index+1,name:'Canal '+String(index+1).padStart(3,'0'),category_id:String(index%2+1)}));
 if(action==='get_vod_streams'||action==='get_series')return [];
 if(action==='get_short_epg'){
  requests.push({at:Date.now(),id:url.searchParams.get('stream_id'),limit:url.searchParams.get('limit')});if(mode==='empty')return {epg_listings:[]};
  const now=Math.floor(Date.now()/1000),id=url.searchParams.get('stream_id');
  return {epg_listings:[{title:b64(`Programa ${id} · Edición ñandú`),description:b64('x'),start:'2026-10-06 20:00:00',end:'2026-10-06 21:00:00',start_timestamp:String(now-1200),stop_timestamp:String(now+2400),now_playing:1},{title:b64(`Siguiente ${id}`),start_timestamp:String(now+2400),stop_timestamp:String(now+6000),now_playing:0}]};
 }
 return {};
};
const proxy=createHttpServer((req,res)=>{let url;try{url=new URL(req.url);}catch{res.statusCode=400;res.end();return;}
 if(url.pathname.endsWith('/player_api.php')){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');setTimeout(()=>res.end(JSON.stringify(provider(url.href))),url.searchParams.get('action')==='get_short_epg'?80:0);return;}
 res.statusCode=404;res.end();});
proxy.on('connect',(_req,socket)=>socket.destroy());
await new Promise(done=>proxy.listen(0,'127.0.0.1',done));
const server=await createServer({root,configFile:resolve(root,'vite.config.js'),server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});await server.listen();
const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true,proxy:{server:`http://127.0.0.1:${proxy.address().port}`,bypass:'127.0.0.1'}});
const keys={R:'ArrowRight',L:'ArrowLeft',D:'ArrowDown',U:'ArrowUp'};
async function run(name){
 mode=name;const base=requests.length,context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block'}),page=await context.newPage(),errors=[],logs=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>logs.push(message.text()));
 await context.addInitScript(()=>{localStorage.setItem('rf-profiles',JSON.stringify([{id:'guide',name:'Adulto',kind:'adult'}]));localStorage.setItem('rf-auto-trailers','false');localStorage.setItem('rf-tv-mode','true');
  window.__guide={longTasks:[]};try{new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__guide.longTasks.push(Math.round(entry.duration));}).observe({type:'longtask'});}catch{}});
 await page.goto(origin+'/?diagnostics=1');await page.getByRole('button',{name:'Adulto',exact:true}).click({timeout:90000});
 await page.locator('.topbar nav button',{hasText:'Inicio'}).waitFor();await page.waitForTimeout(2500);
 const startup=requests.length-base;
 await page.getByRole('button',{name:'TV en vivo',exact:true}).click();const first=page.locator('.live-hub-channels .card-open').first();await first.waitFor({timeout:60000});await page.waitForTimeout(600);
 await first.focus();await page.waitForTimeout(1500);
 const focused=()=>page.locator('.live-hub-channels .card:focus-within');
 const result={startupRequests:startup,firstSettle:requests.length-base-startup};
 if(name==='guide'){
  await expect(focused().locator('.caption-guide')).toHaveText(/^Ahora · Programa \d+ · Edición ñandú$/);
  await expect(page.locator('.card-expansion .expansion-guide-now')).toHaveText(/^Ahora · Programa \d+/);await expect(page.locator('.card-expansion .expansion-guide-next')).toHaveText(/^Después · Siguiente \d+ · \d\d:\d\d$/);
  result.bar=await page.locator('.card-expansion .expansion-guide-bar>i').evaluate(node=>node.style.transform);
  await expect(page.locator('.focus-stage .focus-description')).toHaveText(/^Ahora · Programa 1 /);
  await mkdir(resolve(root,'artifacts'),{recursive:true});await page.screenshot({path:resolve(root,'artifacts/liveL4-guia-canal.png')});
 }else{
  await expect(page.locator('.card-expansion')).toHaveCount(1);
  assert.equal(await focused().locator('.has-guide,.caption-guide').count(),0);assert.equal(await page.locator('.expansion-guide').count(),0);
  assert.equal(await focused().locator('.card-meta').innerText(),'Noticias');assert.equal(await page.locator('text=/Sin programación|Ahora ·/').count(),0);
  result.emptyCaption=await focused().locator('.card-meta').innerText();result.panelHeight=await page.locator('.card-expansion').evaluate(node=>node.getBoundingClientRect().height);
  await page.screenshot({path:resolve(root,'artifacts/liveL4-sin-guia.png')});
 }
 // 60 moves: six bursts of ten keys (120 ms apart) with a 900 ms look between them.
 await page.evaluate(()=>{window.__guide.longTasks=[];});const walkStart=requests.length;
 for(let group=0;group<6;group++){for(const key of 'RRRRDLLLLD'){await page.keyboard.press(keys[key]);await page.waitForTimeout(120);}await page.waitForTimeout(900);}
 await page.waitForTimeout(800);result.walk={moves:60,requests:requests.length-walkStart,longTasks:await page.evaluate(()=>window.__guide.longTasks)};
 if(name==='guide')await expect(focused().locator('.caption-guide')).toHaveText(/^Ahora · Programa \d+/);
 await page.waitForTimeout(1500);const burstStart=Date.now();for(let index=0;index<10;index++){await page.keyboard.press(index%2?'ArrowLeft':'ArrowRight');await page.waitForTimeout(100);}
 const burstEnd=Date.now();await page.waitForTimeout(1200);result.burst={keys:10,requestsDuringBurst:requests.filter(request=>request.at>=burstStart&&request.at<=burstEnd).length,requestsAfterSettle:requests.filter(request=>request.at>burstEnd).length};
 result.diagnostics=await page.evaluate(()=>window.__richiflixPerformance?.snapshot?.().resources?.channelGuide||null);
 result.limits=[...new Set(requests.slice(base).map(request=>request.limit))];result.errors=errors;
 result.credentialsInLogs=logs.filter(text=>text.includes(defaultSource.password)||text.includes(defaultSource.username)).length;
 await context.close();return result;
}
try{
 const guide=await run('guide'),empty=await run('empty');
 const report={measurement:'Headless Chromium 1920×1080 TV mode, no CPU throttling, 300 channels, get_short_epg answered in 80 ms through a local proxy; not Samsung hardware',guide,empty};
 await writeFile(resolve(root,'artifacts/channel-guide-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,1));
 for(const result of [guide,empty]){assert.equal(result.startupRequests,0,'nothing at startup');assert.ok(result.walk.requests<=20,'≤ 20 requests in 60 moves');assert.equal(result.walk.longTasks.length,0,'no long tasks');assert.equal(result.burst.requestsDuringBurst,0,'none during a burst');assert.deepEqual(result.errors,[]);assert.equal(result.credentialsInLogs,0);assert.deepEqual(result.limits,['2']);}
}finally{await browser.close();await server.close();proxy.close();}
