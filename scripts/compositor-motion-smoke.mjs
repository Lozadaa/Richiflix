import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),baseline=process.argv.includes('--baseline'),server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});await server.listen();const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.add('samsung-tv'),{once:true}));await page.goto(server.resolvedUrls.local[0]+'scripts/virtual-catalogue-fixture.html');await page.waitForFunction(()=>window.__fixture);await page.evaluate(()=>document.fonts.ready);await page.mouse.move(1,1);await page.waitForTimeout(650);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const trace=async(run)=>{const events=[];const receive=chunk=>events.push(...chunk.value);cdp.on('Tracing.dataCollected',receive);await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.animations',transferMode:'ReportEvents'});await run();const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await done;cdp.off('Tracing.dataCollected',receive);return events;};
 const stylesheet=await page.evaluate(()=>Boolean([...document.querySelectorAll('style')].find(element=>element.dataset.viteDevId?.endsWith('/src/compositorMotion.css'))));assert.equal(stylesheet,true);
 const toggleMotion=enabled=>page.evaluate(enabled=>{[...document.querySelectorAll('style')].find(element=>element.dataset.viteDevId?.endsWith('/src/compositorMotion.css')).sheet.disabled=!enabled;},enabled);
 await toggleMotion(false);await page.waitForTimeout(450);
 const controlTrace=await trace(async()=>{await page.getByRole('button',{name:'Rails',exact:true}).hover();await page.waitForTimeout(450);await page.mouse.move(1,1);await page.waitForTimeout(450);});
 if(!baseline)await toggleMotion(true);await page.waitForTimeout(450);
 const hovering=await trace(async()=>{await page.getByRole('button',{name:'Rails',exact:true}).hover();await page.waitForTimeout(450);await page.mouse.move(1,1);await page.waitForTimeout(450);});
 const paints=events=>events.filter(event=>event.name==='Paint'&&event.ph==='X');
 const hoverPaints=paints(hovering);
 await page.locator('.catalog-grid .card-open').first().focus();await page.locator('.card-expansion').waitFor();await page.waitForTimeout(450);
 const properties=await page.locator('.topbar nav button').last().evaluate(element=>getComputedStyle(element).transitionProperty);
 const animationTrace=await trace(async()=>{await page.evaluate(()=>{const element=document.querySelector('.card-expansion');window.__compositorAnimation=element.animate([{transform:'translate3d(0,0,0)',opacity:1},{transform:'translate3d(24px,-8px,0)',opacity:.85},{transform:'translate3d(0,0,0)',opacity:1}],{duration:600,easing:'ease-in-out'});});await page.waitForTimeout(700);});
 const animationPaints=paints(animationTrace),layoutCount=animationTrace.filter(event=>event.name==='Layout'&&event.ph==='X').length;
 // Initial layer creation/raster is allowed. Continuous repainting throughout
 // the middle of an already built, static preview is a regression.
 const animationStart=animationTrace.find(event=>event.name==='Animation'&&event.ph==='b')?.ts||animationPaints[0]?.ts;
 const motionPaints=animationStart?animationPaints.filter(event=>event.ts>animationStart+100000&&event.ts<animationStart+550000):[];
 await page.getByRole('button',{name:'Grid',exact:true}).focus();await page.waitForTimeout(650);
 const retained=await page.evaluate(()=>[...document.querySelectorAll('.virtual-grid-cell,.virtual-rail-cell,.card')].filter(element=>getComputedStyle(element).willChange!=='auto').length);
 const result={measurement:'Local headless Chromium DevTools timeline; static fixture, excludes video frame rendering and Samsung hardware',baseline,hoverPaintEvents:hoverPaints.length,previewPaintEvents:animationPaints.length,previewMidAnimationPaintEvents:motionPaints.length,previewAnimationLayoutEvents:layoutCount,buttonTransitionProperties:properties,retainedCatalogueLayerHints:retained,errors};
 await mkdir(resolve(root,'artifacts'),{recursive:true});await writeFile(resolve(root,'artifacts',baseline?'compositor-motion-before.json':'compositor-motion-after.json'),JSON.stringify(result,null,2));
 if(!baseline){const before={hoverPaintEvents:paints(controlTrace).length};assert.ok(result.hoverPaintEvents<before.hoverPaintEvents,`hover paint reduction: ${result.hoverPaintEvents} vs ${before.hoverPaintEvents}`);assert.equal(result.previewMidAnimationPaintEvents,0);assert.equal(result.previewAnimationLayoutEvents,0);assert.equal(result.retainedCatalogueLayerHints,0);assert.ok(!/(background|color|shadow|filter|width|height)/.test(properties));assert.deepEqual(errors,[]);result.beforeHoverPaintEvents=before.hoverPaintEvents;result.passed=true;}
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await server.close();}
