import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});
await server.listen();const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.goto(new URL('/scripts/virtual-catalogue-fixture.html',origin).href);await page.locator('.catalog-grid .card-open').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
 await page.locator('.catalog-grid .card-open').first().focus();
 await page.evaluate(()=>{window.firstGridCard=document.activeElement;window.scrollCalls=[];const main=document.querySelector('main'),scroll=main.scrollTo.bind(main);main.scrollTo=options=>{window.scrollCalls.push({at:performance.now(),from:main.scrollTop,...options});scroll(options);};window.maxGridDOM=0;window.gridObserver=new MutationObserver(()=>window.maxGridDOM=Math.max(window.maxGridDOM,document.querySelectorAll('.virtual-grid-cell').length));window.gridObserver.observe(document.querySelector('.catalog-grid'),{childList:true});});
 const columns=Number(await page.locator('.catalog-grid').getAttribute('data-virtual-columns'));
 const smooth=await page.evaluate(async()=>{
  const main=document.querySelector('main'),start=main.scrollTop,samples=[];
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));const immediate=main.scrollTop;
  for(let i=0;i<45;i++){await new Promise(resolve=>requestAnimationFrame(resolve));samples.push(main.scrollTop);}
  return {start,immediate,samples,active:Number(document.activeElement.closest('[data-virtual-index]').dataset.virtualIndex)};
 });
 assert.equal(smooth.active,columns);assert.equal(smooth.immediate,smooth.start,'The focus updates immediately while scroll motion starts asynchronously');
 assert.ok(smooth.samples.at(-1)>smooth.start+50);assert.ok(new Set(smooth.samples.map(Math.round)).size>4,'Vertical movement must have intermediate positions');
 // Holding Down replaces the destination, without waiting for old motion.
 for(let i=0;i<35;i++){await page.keyboard.press('ArrowDown');await page.waitForTimeout(30);}
 await page.waitForTimeout(1200);
 const grid=await page.evaluate(()=>{const main=document.querySelector('main').getBoundingClientRect(),card=document.activeElement.closest('.card').getBoundingClientRect();return {active:Number(document.activeElement.closest('[data-virtual-index]').dataset.virtualIndex),scrollCalls:window.scrollCalls.slice(-3),cellTop:document.activeElement.closest('.virtual-grid-cell').style.top,gridRect:document.querySelector('.catalog-grid').getBoundingClientRect().top,bounds:{mainTop:main.top,mainBottom:main.bottom,cardTop:card.top,cardBottom:card.bottom,scroll:document.querySelector("main").scrollTop},oldNodeConnected:window.firstGridCard.isConnected,mounted:document.querySelectorAll('.virtual-grid-cell').length,maxMounted:window.maxGridDOM,visible:card.top>=main.top&&card.bottom<=main.bottom};});
 assert.equal(grid.active,36*columns);assert.equal(grid.oldNodeConnected,false,'Passed rows must unmount their buttons and image observers');assert.ok(grid.mounted<=50);assert.ok(grid.maxMounted<=50);assert.equal(grid.visible,true,'The final enlarged focus must settle inside the viewport');
 await page.getByRole('button',{name:'Rails',exact:true}).click();await page.getByLabel('Aventura',{exact:true}).locator('.card-open').first().focus();await page.waitForTimeout(600);
 await page.evaluate(()=>window.firstRailCard=document.activeElement);
 await page.keyboard.press('ArrowDown');await page.waitForTimeout(700);await page.keyboard.press('ArrowDown');await page.waitForTimeout(1000);
 const rails=await page.evaluate(()=>({active:document.activeElement.closest('.cards').getAttribute('aria-label'),oldNodeConnected:window.firstRailCard.isConnected,oldRowCards:document.querySelector('.cards[aria-label="Aventura"]').querySelectorAll('.virtual-rail-cell').length,mounted:document.querySelectorAll('.virtual-rail-cell').length}));
 assert.equal(rails.active,'Drama');assert.equal(rails.oldNodeConnected,false);assert.equal(rails.oldRowCards,0);assert.ok(rails.mounted<=30);
 await page.keyboard.press('ArrowUp');await page.waitForTimeout(750);assert.equal(await page.evaluate(()=>document.activeElement.closest('.cards').getAttribute('aria-label')),'Comedia');assert.deepEqual(errors,[]);
 const report={passed:true,grid,rails,smoothSamples:smooth.samples};await mkdir(resolve(root,'artifacts'),{recursive:true});await writeFile(resolve(root,'artifacts/vertical-navigation-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await server.close();}
