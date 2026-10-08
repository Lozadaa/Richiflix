import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),image=await readFile(resolve(root,'public/artwork/categories/cinema.png'));
const builtWorker=(await readdir(resolve(root,'dist-tizen/assets'))).find(name=>/^artworkCacheWorker-.*\.js$/.test(name));assert.ok(builtWorker,'Tizen classic artwork worker exists');
const server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error',plugins:[{
 name:'artwork-cache-harness',resolveId:id=>id==='artwork-cache-harness'?'\0artwork-cache-harness':null,
 load:id=>id==='\0artwork-cache-harness'?`import React from 'react';import {createRoot} from 'react-dom/client';import {QualityImage} from '/src/QualityImage.jsx';import {artworkCacheClient,createArtworkCacheClient} from '/src/artworkCacheClient.js';const root=createRoot(document.getElementById('root'));window.cache=artworkCacheClient();window.builtCache=createArtworkCacheClient({createWorker:()=>new Worker('/__compiled-worker')});window.renderArt=src=>root.render(src?React.createElement('div',{style:{width:240,height:360}},React.createElement(QualityImage,{src,eager:true,loader:true,fallbackWhileLoading:false,fallback:React.createElement('span',{id:'fallback'},'Sin imagen')})):null);window.drop=()=>window.renderArt(null);`:null,
 configureServer(vite){vite.middlewares.use('/__compiled-worker',async(_req,res)=>{res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve(root,'dist-tizen/assets',builtWorker)));});vite.middlewares.use('/__cache',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__cache','<!doctype html><div id="root"></div><script type="module" src="/@id/__x00__artwork-cache-harness"></script>'));});}
}]});await server.listen();const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let offline=false,network=0;page.on('pageerror',error=>errors.push(error.message));
 await context.route('https://image.tmdb.org/**',route=>{network++;return offline?route.abort():route.fulfill({body:image,contentType:'image/png',headers:{'access-control-allow-origin':'*','cache-control':'public, max-age=3600'}});});
 const src='https://image.tmdb.org/t/p/w780/richiflix-cache-pc.jpg',cacheKey=src.replace('/w780/','/w342/'),render=()=>page.evaluate(src=>window.renderArt(src),src);
 await page.goto(new URL('/__cache',origin).href);await page.waitForFunction(()=>window.cache);assert.equal(await page.evaluate(()=>window.cache.warm()),true);await render();await expect(page.locator('.quality-media')).toHaveAttribute('data-image-state','ready');await page.evaluate(()=>window.cache.idle());
 let stats=await page.evaluate(()=>window.cache.diskStats());assert.equal(stats.entries,1);assert.ok(stats.bytes>0&&stats.bytes<=48*1024*1024);
 await page.evaluate(()=>window.drop());await expect.poll(()=>page.evaluate(()=>window.cache.diagnostics().activeImages)).toBe(0);
 // The standalone classic worker shipped in the TV package opens the same
 // persisted Blob database; no real device or source connection is involved.
 assert.equal(await page.evaluate(()=>window.builtCache.warm()),true);const classic=await page.evaluate(async src=>{const handle=window.builtCache.acquire(src),url=await handle.ready;handle.release();return {cached:Boolean(url?.startsWith('blob:')),active:window.builtCache.diagnostics().activeImages};},cacheKey);assert.deepEqual(classic,{cached:true,active:0});
 offline=true;network=0;await page.reload();await page.waitForFunction(()=>window.cache);assert.equal(await page.evaluate(()=>window.cache.warm()),true);await render();await expect(page.locator('.quality-media')).toHaveAttribute('data-image-state','ready');assert.match(await page.locator('img').getAttribute('src'),/^blob:/);assert.equal(network,0);assert.equal(await page.locator('#fallback').count(),0);
 await page.evaluate(()=>window.drop());await expect.poll(()=>page.evaluate(()=>window.cache.diagnostics().activeImages)).toBe(0);
 // A bad cached payload is discarded, then retried normally once. It cannot
 // remain a permanent unavailable fallback for the lifetime of the cache.
 await page.evaluate(async key=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('richiflix-artwork',1);request.onsuccess=()=>resolve(request.result);request.onerror=reject;});await new Promise((resolve,reject)=>{const tx=db.transaction(['index','payload'],'readwrite'),blob=new Blob(['broken image'],{type:'image/png'}),index=tx.objectStore('index'),entry=index.get(key);entry.onsuccess=()=>index.put({...entry.result,size:blob.size},key);tx.objectStore('payload').put(blob,key);tx.oncomplete=resolve;tx.onerror=reject;});db.close();},cacheKey);
 offline=false;await page.reload();await page.waitForFunction(()=>window.cache);await page.evaluate(()=>window.cache.warm());await render();await expect(page.locator('.quality-media')).toHaveAttribute('data-image-state','ready');assert.match(await page.locator('img').getAttribute('src'),/^https:/);await page.evaluate(()=>window.cache.idle());assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['compressed disk cache','offline reuse after reload without network','classic Tizen worker','DOM consumer releases Blob URL','cached decode failure retries original'],bytes:stats.bytes}));
}finally{await browser.close();await server.close();}
