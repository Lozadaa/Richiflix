import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});
await server.listen();const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/scripts/virtual-catalogue-fixture.html`);await page.locator('.catalog-grid .card-open').first().waitFor();
 await page.evaluate(()=>window.__fixture.mode(false));await page.waitForTimeout(100);await page.evaluate(()=>window.scrollTo(0,12000));
 await page.waitForFunction(()=>Math.min(...[...document.querySelectorAll('.virtual-grid-cell')].map(node=>Number(node.dataset.virtualIndex)))>30);
 const first=await page.locator('.virtual-grid-cell').first().getAttribute('data-virtual-index');assert.ok(Number(first)>30);assert.ok(await page.locator('.virtual-grid-cell').count()<80);
 await page.evaluate(()=>window.__fixture.mode(true));await page.waitForTimeout(100);await page.evaluate(()=>document.querySelector('main').scrollTop=18000);
 await page.waitForFunction(()=>Math.min(...[...document.querySelectorAll('.virtual-grid-cell')].map(node=>Number(node.dataset.virtualIndex)))>100);assert.ok(await page.locator('.virtual-grid-cell').count()<80);
 await page.locator('.virtual-grid-cell .card-open').first().focus();const id=await page.evaluate(()=>document.activeElement.closest('.card').dataset.contentId);
 await page.evaluate(()=>window.__fixture.mode(false));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.activeElement.closest('.card')?.dataset.contentId),id);
 await page.keyboard.press('ArrowRight');assert.ok(await page.evaluate(()=>{const box=document.activeElement.closest('.card')?.getBoundingClientRect();return box&&box.bottom>0&&box.top<innerHeight;}));
 await page.getByRole('button',{name:'Rails',exact:true}).click();await page.waitForTimeout(100);await page.evaluate(()=>window.scrollTo(0,1800));
 await page.waitForFunction(()=>document.querySelector('[aria-label="Drama"] .virtual-rail-cell'));
 await page.evaluate(()=>window.__fixture.mode(true));await page.waitForTimeout(100);await page.evaluate(()=>document.querySelector('main').scrollTop=1700);
 await page.waitForFunction(()=>document.querySelector('[aria-label="Drama"] .virtual-rail-cell'));
 await page.getByLabel('Drama',{exact:true}).locator('.card-open').first().focus();await page.keyboard.press('ArrowRight');assert.ok(await page.evaluate(()=>document.activeElement.closest('[aria-label="Drama"]')));assert.deepEqual(errors,[]);
 console.log('Virtual mode switch OK: window/main listeners rebind, all visible grid cells load, the focused title survives, and far rails reactivate in either mode.');
}finally{await browser.close();await server.close();}
