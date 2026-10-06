import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error',plugins:[{name:'card-loading-harness',resolveId:id=>id==='card-harness'?'\0card-harness':null,load:id=>id==='\0card-harness'?`import React from 'react';import {createRoot} from 'react-dom/client';import {QualityImage} from '/src/QualityImage.jsx';import '/src/style.css';const root=createRoot(document.getElementById('root'));window.renderImage=(src,pending)=>root.render(React.createElement('div',{style:{width:240,height:360}},React.createElement(QualityImage,{src,pending,loader:true,eager:true,fallbackWhileLoading:false,fallback:React.createElement('span',{id:'confirmed-fallback'},'Sin imagen')})));`:null,configureServer(vite){vite.middlewares.use('/__card',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__card','<!doctype html><div id="root"></div><script type="module" src="/@id/__x00__card-harness"></script>'));});}}]});await server.listen();
const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),held=new Map();await page.route('**/fixture/**',route=>held.set(new URL(route.request().url()).pathname,route));await page.goto(new URL('/__card',origin).href);await page.waitForFunction(()=>window.renderImage);
 const render=(name,pending)=>page.evaluate(([src,pending])=>window.renderImage(src,pending),[name?new URL('/fixture/'+name+'.svg',origin).href:null,pending]);
 const waitRoute=async name=>{await expect.poll(()=>held.has('/fixture/'+name+'.svg')).toBe(true);return held.get('/fixture/'+name+'.svg');};
 const loading=async()=>{await expect(page.locator('.artwork-spinner')).toHaveCount(1);await expect(page.locator('#confirmed-fallback')).toHaveCount(0);};
 await render(null,true);await loading();await render('late',false);await waitRoute('late');await loading();await (await waitRoute('late')).fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1170"><path fill="#536283" d="M0 0h780v1170H0z"/></svg>'});await expect(page.locator('.quality-media')).toHaveAttribute('data-image-state','ready');await expect(page.locator('.artwork-spinner,#confirmed-fallback')).toHaveCount(0);
 await render(null,true);await loading();await render(null,false);await expect(page.locator('#confirmed-fallback')).toHaveCount(1);await expect(page.locator('.artwork-spinner')).toHaveCount(0);
 await render('bad',false);await loading();await (await waitRoute('bad')).abort();await expect(page.locator('#confirmed-fallback')).toHaveCount(1);await expect(page.locator('.artwork-spinner')).toHaveCount(0);
 console.log(JSON.stringify({passed:true,checks:['metadata pending spinner','download pending spinner','no fallback beneath real image','confirmed missing fallback','failed image fallback']}));
}finally{await browser.close();await server.close();}
