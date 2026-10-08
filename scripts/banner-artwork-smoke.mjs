import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error',plugins:[{
 name:'banner-artwork-harness',resolveId:id=>id==='banner-harness'?'\0banner-harness':null,
 load:id=>id==='\0banner-harness'?`import React from 'react';import {createRoot} from 'react-dom/client';import {BannerArtwork} from '/src/BannerArtwork.jsx';import '/src/style.css';const root=createRoot(document.getElementById('root'));window.renderArt=(item,metadataPending)=>root.render(React.createElement('section',{className:'hero focus-stage',style:{height:'540px'}},React.createElement(BannerArtwork,{item,metadataPending})));`:null,
 configureServer(vite){vite.middlewares.use('/__artwork',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__artwork','<!doctype html><div id="root"></div><script type="module" src="/@id/__x00__banner-harness"></script>'));});}
}]});
await server.listen();const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],held=new Map();
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/fixture/**',route=>{held.set(new URL(route.request().url()).pathname,route);});
 await page.route('**/*',route=>route.request().url().startsWith(origin)?route.fallback():route.abort());
 await page.goto(new URL('/__artwork',origin).href);await page.waitForFunction(()=>window.renderArt);
 const base={id:'art-fixture',kind:'vod',mediaType:'movie',title:'Película',genre:'Aventura'};
 const state=page.locator('[data-artwork-state]');
 const render=async(item,pending)=>{await page.evaluate(([item,pending])=>window.renderArt(item,pending),[item,pending]);};
 const blank=async()=>{await expect(state).toHaveAttribute('data-artwork-state','loading');assert.equal(await page.locator('.content-identity').count(),0);};
 const waitRoute=async(path)=>{for(let i=0;i<100&&!held.has(path);i++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(held.has(path),path);return held.get(path);};
 const good=path=>new URL('/fixture/'+path+'.svg',origin).href;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path fill="#36465f" d="M0 0h1920v1080H0z"/></svg>';
 await render(base,true);await blank();assert.equal(await page.locator('.focus-stage-visual img').count(),0);
 await render({...base,backdropImage:good('late')},false);await waitRoute('/fixture/late.svg');await blank();
 await (await waitRoute('/fixture/late.svg')).fulfill({contentType:'image/svg+xml',body:svg});await expect(state).toHaveAttribute('data-artwork-state','ready');assert.equal(await page.locator('.content-identity').count(),0);
 await render({...base,id:'missing'},true);await blank();await render({...base,id:'missing'},false);await expect(state).toHaveAttribute('data-artwork-state','missing');assert.equal(await page.locator('.content-identity').count(),0,'missing banners remain empty; the selected card owns its image');
 await render({...base,id:'poster',image:good('poster')},true);await blank();assert.equal(await page.locator('.focus-poster').count(),0);assert.equal(held.has('/fixture/poster.svg'),false);await render({...base,id:'poster',image:good('poster')},false);await expect(state).toHaveAttribute('data-artwork-state','missing');
 await render({...base,id:'failed',backdropImage:good('failed')},false);await waitRoute('/fixture/failed.svg');await blank();await (await waitRoute('/fixture/failed.svg')).abort();await expect(state).toHaveAttribute('data-artwork-state','missing');
 // Hold an old source's decode, replace it, then complete the old decode late.
 await page.evaluate(()=>{const original=HTMLImageElement.prototype.decode;window.releaseOld=null;HTMLImageElement.prototype.decode=function(){if(this.src.includes('/fixture/old.svg'))return new Promise(resolve=>window.releaseOld=resolve);return original.call(this);};});
 await render({...base,id:'changing',backdropImage:good('old')},false);await (await waitRoute('/fixture/old.svg')).fulfill({contentType:'image/svg+xml',body:svg});await page.waitForFunction(()=>window.releaseOld);await blank();
 await render({...base,id:'changing',backdropImage:good('new')},false);await waitRoute('/fixture/new.svg');await page.evaluate(()=>window.releaseOld());await blank();assert.equal(await page.locator('img[src*="/old.svg"]').count(),0);
 await (await waitRoute('/fixture/new.svg')).fulfill({contentType:'image/svg+xml',body:svg});await expect(state).toHaveAttribute('data-artwork-state','ready');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['metadata pending','download pending','missing metadata without category fallback','no vertical poster in banner','terminal image error','late decode after replacement']}));
}finally{await browser.close();await server.close();}
