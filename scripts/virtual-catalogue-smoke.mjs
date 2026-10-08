import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';

const root=resolve(import.meta.dirname,'..'),server=await createServer({root,server:{port:0,host:'127.0.0.1',hmr:false}});
await server.listen();const port=server.httpServer.address().port,browser=await chromium.launch({headless:true,args:['--enable-precise-memory-info']});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:${port}/scripts/virtual-catalogue-fixture.html?diagnostics=1`);
 await page.locator('.catalog-grid .card-open').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
 const cdp=await context.newCDPSession(page),heap=async()=>{await cdp.send('HeapProfiler.collectGarbage');return page.evaluate(()=>performance.memory.usedJSHeapSize);};
 const index=()=>page.evaluate(()=>Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex??-1));
 const cards=()=>page.locator('.catalog-grid .virtual-grid-cell').count();
 await page.locator('.catalog-grid .card-open').first().focus();assert.equal(await index(),0);
 await page.evaluate(()=>{
  const rect=Element.prototype.getBoundingClientRect,stats={cardElementRects:0,imageBoxRects:0,otherCardRects:0,geometryRects:0,missingIntent:0,keys:0,lastGeometry:0,readSamples:[]};let keyActive=false,intent=false;
  Element.prototype.getBoundingClientRect=function(){
   if(keyActive){
    stats.geometryRects++;
    const card=this.matches('.card')||this.closest('.card');
    if(card){
     if(this.matches('.card'))stats.cardElementRects++;
     else if(this.matches('.quality-media'))stats.imageBoxRects++;
     else stats.otherCardRects++;
     if(stats.readSamples.length<4)stats.readSamples.push({className:this.getAttribute('class'),stack:new Error().stack.split('\n').slice(1,6).join('\n')});
    }
   }
   return rect.call(this);
  };
  window.addEventListener('keydown',event=>{if(!event.key.startsWith('Arrow'))return;keyActive=true;intent=false;stats.keys++;stats.lastGeometry=stats.geometryRects;},{capture:true});
  window.addEventListener('richiflix-catalog-navigation',()=>{intent=true;});
  window.addEventListener('focusin',event=>{if(keyActive&&event.target.matches('.card-open')&&!intent)stats.missingIntent++;});
  window.addEventListener('keydown',()=>{keyActive=false;});window.__navigationReads=stats;
 });
 await page.evaluate(()=>window.__richiflixPerformance.reset());await page.keyboard.press('ArrowRight');await page.waitForTimeout(50);
 assert.ok((await page.evaluate(()=>window.__richiflixPerformance.snapshot())).cardRenders<=2,'One focus move must update at most the previous and next mounted Card.');
 await page.keyboard.press('ArrowLeft');assert.equal(await index(),0);
 assert.equal(await page.evaluate(()=>window.__navigationReads.geometryRects-window.__navigationReads.lastGeometry),0,'A same-row remote movement must not remeasure layout.');
 await page.evaluate(()=>window.__richiflixPerformance.reset());
 const baselineHeap=await heap();let maxMounted=0,last=0;
 const columns=Number(await page.locator('.catalog-grid').getAttribute('data-virtual-columns'));assert.ok(columns>=7);
 for(let step=0;step<500;step++){
  const current=await index(),row=Math.floor(current/columns),column=current%columns,key=row%2===0?(column===columns-1?'ArrowDown':'ArrowRight'):(column===0?'ArrowDown':'ArrowLeft');
  await page.keyboard.press(key);const next=await index();assert.equal(next,current+(key==='ArrowDown'?columns:key==='ArrowRight'?1:-1),`Movement ${step} from ${current}, ${key}, grid ${await page.locator('.catalog-grid').getAttribute('data-virtual-columns')}, active ${await page.evaluate(()=>document.activeElement.outerHTML.slice(0,200))}`);last=next;
  if(step%10===0){const mounted=await cards();maxMounted=Math.max(maxMounted,mounted);assert.ok(mounted<=50,`Mounted ${mounted}`);}
 }
 assert.ok(last>=Math.floor(500/columns)*columns,`Serpentine traversal reached ${last} in ${columns} columns`);await page.waitForTimeout(100);
 await page.waitForTimeout(150);
 assert.ok(await page.evaluate(()=>{const target=document.activeElement.closest('.card').getBoundingClientRect();return target.height<=window.innerHeight*.52-100-16;}),'The enlarged card must fit the expanded list viewport.');
 const firstRoundHeap=await heap(),firstMetrics=await page.evaluate(()=>window.__richiflixPerformance.snapshot());
 const gridHeaps=[firstRoundHeap];
 for(let round=1;round<=2;round++){
  for(let step=0;step<500;step++){
   const current=await index(),row=Math.floor(current/columns),column=current%columns,key=row%2===0?(column===columns-1?'ArrowDown':'ArrowRight'):(column===0?'ArrowDown':'ArrowLeft');
   await page.keyboard.press(key);assert.notEqual(await index(),current);
   if(step%25===0){maxMounted=Math.max(maxMounted,await cards());assert.ok(await cards()<=50);}
  }
  await page.waitForTimeout(100);gridHeaps.push(await heap());
 }
 assert.ok(gridHeaps[2]<=gridHeaps[1]*1.1,`Grid heap did not stabilize: ${gridHeaps.join(', ')}`);last=await index();
 // A pointer scroll may move away from the focused row, but may not recycle its button.
 await page.evaluate(()=>document.querySelector('main').scrollTop=0);await page.waitForTimeout(80);
 assert.equal(await index(),last);assert.ok(await cards()<=50);
 await page.locator('.focus-actions .primary').focus();await page.keyboard.press('ArrowDown');assert.equal(await index(),last);await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>{const target=document.activeElement.getBoundingClientRect(),viewport=document.querySelector('main').getBoundingClientRect();return target.bottom>viewport.top&&target.top<viewport.bottom;}));
 await page.locator('.focus-actions .primary').focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(300);
 assert.equal(Number(await page.locator('.catalog-grid').getAttribute('data-virtual-columns')),columns,'Banner height must not reflow columns.');
 assert.ok(await page.evaluate(()=>{const target=document.activeElement.closest('.card').getBoundingClientRect(),viewport=document.querySelector('main').getBoundingClientRect();return target.top>=viewport.top+4&&target.bottom<=viewport.bottom-4;}),'The enlarged card and its focus outline must remain inside the expanded list.');
 const previousId=await page.evaluate(()=>document.activeElement.closest('.card').dataset.contentId);
 await page.evaluate(()=>window.__fixture.filter('without-focused'));await page.waitForTimeout(80);
 assert.ok(await index()>=0);assert.notEqual(await page.evaluate(()=>document.activeElement.closest('.card')?.dataset.contentId),previousId);
 await page.evaluate(()=>window.__fixture.filter('empty'));await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.activeElement.matches('.topbar nav button.active')),true);
 await page.evaluate(()=>window.__fixture.filter('all'));await page.waitForTimeout(80);
 await page.getByRole('button',{name:'Rails',exact:true}).click();await page.locator('.cards .card-open').first().focus();
 await page.waitForTimeout(100);assert.equal(await page.getByLabel('Drama',{exact:true}).locator('.virtual-rail-cell').count(),0,'Far rows must retain geometry without retaining card images.');
 for(let step=0;step<500;step++){await page.keyboard.press('ArrowRight');assert.equal(await index(),step+1);if(step%25===0)assert.ok(await page.locator('.virtual-rail-cell').count()<=30);}
 const firstRail=await page.evaluate(()=>document.activeElement.closest('.cards').getAttribute('aria-label'));assert.equal(firstRail,'Aventura');
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.closest('.cards').getAttribute('aria-label')),'Comedia');
 await page.keyboard.press('ArrowUp');assert.equal(await index(),500);
 assert.ok(await page.locator('.virtual-rail-cell').count()<=30);await page.waitForTimeout(100);
 // Both extreme jumps preserve the same DOM budget at 27,000 titles. The last
 // position is the reachable action; returning right removes the old window.
 await page.locator('.cards').first().evaluate(element=>element.scrollLeft=0);await page.waitForTimeout(50);await page.locator('.cards').first().locator('[data-virtual-index="0"] .card-open').focus();
 const firstRailCard=await page.locator('.cards').first().locator('[data-virtual-index="0"]').elementHandle();
 await page.keyboard.press('ArrowLeft');assert.equal(await index(),27000);assert.equal(await page.evaluate(()=>document.activeElement.matches('.rail-more-open')),true);
 assert.equal(await firstRailCard.evaluate(element=>element.isConnected),false);assert.ok(await page.locator('.virtual-rail-cell').count()<=30);
 await page.keyboard.press('ArrowLeft');assert.equal(await index(),26999);await page.keyboard.press('ArrowRight');assert.equal(await index(),27000);await page.keyboard.press('ArrowRight');assert.equal(await index(),0);
 assert.equal(await page.locator('.cards').first().locator('.rail-more-open').count(),0);assert.ok(await page.locator('.virtual-rail-cell').count()<=30);
 const finalHeap=await heap(),finalMetrics=await page.evaluate(()=>window.__richiflixPerformance.snapshot());assert.deepEqual(errors,[]);
 const navigationReads=await page.evaluate(()=>window.__navigationReads);
 // A virtual-window crossing can mount QualityImage during flushSync. Its
 // resolution guard legitimately measures a new image box. Keep that separate
 // from navigation measuring a Card while its focus scale is animating.
 assert.equal(navigationReads.cardElementRects,0,'Remote navigation must never measure a scaling Card.');
 assert.equal(navigationReads.otherCardRects,0,'Card geometry reads must be limited to the new image quality guard.');
 assert.equal(navigationReads.missingIntent,0,'Navigation intent must arrive before card focus.');
 const report={test:'Virtual window local headless Chromium, not Samsung hardware',catalogue:27000,gridSteps:1500,railSteps:500,maxMountedGrid:maxMounted,finalMountedRails:await page.locator('.virtual-rail-cell').count(),heapBytes:{baseline:baselineHeap,gridRounds:gridHeaps,final:finalHeap},grid:firstMetrics,final:finalMetrics,navigationReads,focusRestoration:true,focusedFilterRemoval:true,emptyFilterFocus:true,expandedCardFits:true};
 await mkdir(resolve(root,'artifacts'),{recursive:true});await writeFile(resolve(root,'artifacts/virtual-catalogue-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await server.close();}
