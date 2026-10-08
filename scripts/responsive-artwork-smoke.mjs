import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'responsive-artwork-harness',resolveId:id=>id==='artwork-harness'?'\0artwork-harness':null,load:id=>id==='\0artwork-harness'?`import React from 'react';import {createRoot} from 'react-dom/client';import {QualityImage} from '/src/QualityImage.jsx';import '/src/style.css';createRoot(document.getElementById('frame')).render(React.createElement(QualityImage,{src:'https://image.tmdb.org/t/p/w780/fixture.jpg',eager:true}));`:null,configureServer(vite){vite.middlewares.use('/__artwork_harness',async(_request,response)=>{response.setHeader('Content-Type','text/html');response.end(await vite.transformIndexHtml('/__artwork_harness','<!doctype html><style>#frame{position:relative;width:210px;height:315px;transform-origin:top left}#frame>.quality-media{width:100%;height:100%}</style><div id="frame"></div><script type="module" src="/@id/__x00__artwork-harness"></script>'));});}}]});
await server.listen();const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true}),results=[];
try{
 for(const dpr of [1,2]){
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:dpr}),page=await context.newPage(),requested=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   if(route.request().url().startsWith(origin))return route.continue();
   const url=new URL(route.request().url());if(url.hostname!=='image.tmdb.org')return route.abort();
   const width=Number(url.pathname.match(/\/w(\d+)\//)?.[1]||1600);requested.push(width);
   const pixels=await page.evaluate(width=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width*1.5;const ctx=canvas.getContext('2d');ctx.fillStyle='#f5d58d';ctx.fillRect(0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png').split(',')[1];},width);
   return route.fulfill({contentType:'image/png',body:Buffer.from(pixels,'base64')});
  });
  await page.goto(new URL('/__artwork_harness',origin).href);
  await page.waitForFunction(()=>document.querySelector('.quality-media')?.dataset.imageState==='ready');
  const initial=await page.locator('img').evaluate(image=>({src:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight}));
  assert.equal(initial.width,dpr===1?342:500);assert.deepEqual(requested,[initial.width],'Initial layout must not fetch a larger speculative image');
  await page.evaluate(()=>document.getElementById('frame').style.transform='scale(1.08)');await page.waitForTimeout(120);
  assert.deepEqual(requested,[initial.width],'Focus scale must reuse its prefetched resolution');assert.equal(await page.locator('.quality-media').getAttribute('data-image-state'),'ready');
  await page.evaluate(()=>{const frame=document.getElementById('frame');frame.style.width='450px';frame.style.height='675px';});
  await page.waitForFunction(expected=>{const image=document.querySelector('img');return document.querySelector('.quality-media').dataset.imageState==='ready'&&image.naturalWidth===expected;},dpr===1?500:1600);
  const resized=await page.locator('img').evaluate(image=>({src:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight}));
  assert.equal(resized.width,dpr===1?500:1600);assert.equal(await page.locator('.kingdom-art').count(),0);assert.deepEqual(errors,[]);
  results.push({dpr,initialWidth:initial.width,resizedWidth:resized.width,requests:requested,ready:true});await context.close();
 }
 console.log(JSON.stringify({responsiveArtwork:results,focusDoesNotRedownload:true,qualityGuardPreserved:true}));
}finally{await browser.close();await server.close();}
