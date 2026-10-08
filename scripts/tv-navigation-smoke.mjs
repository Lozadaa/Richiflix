import {connectTV} from './tv-cdp.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const tv=await connectTV(),root=resolve(import.meta.dirname,'..');
try{
 if(process.argv.includes('--apply-composition')){
  const css=await readFile(resolve(root,'src/tvCardComposition.css'),'utf8');
  await tv.evaluate(css=>{if(document.querySelector('[role="dialog"]')||!document.querySelector('.topbar nav button.active')?.textContent.includes('Inicio'))throw Error('Leave the TV in Inicio without playback before measuring.');let style=document.getElementById('richiflix-composition-measurement');if(!style){style=document.createElement('style');style.id='richiflix-composition-measurement';document.head.appendChild(style);}style.textContent=css;},css);
 }
 const report=await tv.evaluate(async()=>{
  const rail=document.querySelector('.cards[aria-label="Películas"]'),first=rail?.querySelector('.card-open');
  if(!first)throw Error('Enter the adult catalogue before measuring.');
  first.focus({preventScroll:true});
  // Reveal the real row using the remote controller. A restored Continue row
  // can otherwise put Movies below the viewport before the first movement.
  for(const key of ['ArrowRight','ArrowLeft']){document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,100));}
  await new Promise(resolve=>setTimeout(resolve,1000));
  const stage=document.querySelector('.focus-stage'),main=document.querySelector('main'),initial={top:main.offsetTop,height:main.clientHeight,scroll:main.scrollTop},firstId=stage.dataset.contentId;
  let commits=0;const observer=new MutationObserver(records=>{commits+=records.filter(record=>record.attributeName==='data-content-id').length;});observer.observe(stage,{attributes:true,attributeFilter:['data-content-id']});
  window.__richiflixPerformance.reset();const samples=[];
  for(let index=0;index<30;index++){
   const sent=performance.now();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:index>0,bubbles:true,cancelable:true}));
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   samples.push({ms:performance.now()-sent,index:Number(document.activeElement.closest('[data-virtual-index]')?.dataset.virtualIndex),moving:stage.dataset.stageState==='browsing',unchanged:stage.dataset.contentId===firstId,geometryStable:main.offsetTop===initial.top&&main.clientHeight===initial.height&&main.scrollTop===initial.scroll});
   await new Promise(resolve=>setTimeout(resolve,125));
  }
  const intermediateCommits=commits;await new Promise(resolve=>setTimeout(resolve,800));observer.disconnect();
  const diagnostics=window.__richiflixPerformance.snapshot(),card=document.activeElement.closest('.card').getBoundingClientRect(),viewport=main.getBoundingClientRect(),sorted=samples.map(sample=>sample.ms).sort((a,b)=>a-b);
  return {device:'Samsung UN65M70HAGXZS, Tizen 10.0',measuredAt:new Date().toISOString(),measurement:'Actual TV keydown to second RAF; presentation proxy, not measured GPU/compositor paint',viewport:[innerWidth,innerHeight],keys:30,keyToSecondRAFP95Ms:Math.round(sorted[Math.ceil(sorted.length*.95)-1]*10)/10,keyToSecondRAFMaxMs:Math.round(sorted.at(-1)*10)/10,allKeysMoved:samples.every((sample,index)=>sample.index===index+1),allMovingHidden:samples.every(sample=>sample.moving),intermediateBannerCommits:intermediateCommits,intermediateArtworkUnchanged:samples.every(sample=>sample.unchanged),catalogueGeometryStable:samples.every(sample=>sample.geometryStable),finalBannerCommits:commits,bannerSettled:stage.dataset.stageState==='settled',focusedCardVisible:card.top>=viewport.top&&card.bottom<=viewport.bottom,headerTransparent:getComputedStyle(document.querySelector('.topbar')).backgroundColor==='rgba(0, 0, 0, 0)',workerMode:diagnostics.resources.catalogueWorker.mode,cardCount:diagnostics.mountedCards,frameP95Ms:diagnostics.frameP95,longTaskCount:diagnostics.longTaskCount,longTaskMaxMs:diagnostics.longTaskMax,trailerState:document.querySelector('.trailer-preview')?.dataset.trailerState,trailerErrorKind:document.querySelector('.trailer-preview')?.dataset.trailerErrorKind||null};
 });
 await mkdir(resolve(root,'artifacts'),{recursive:true});await writeFile(resolve(root,'artifacts/tv-navigation-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 assert.equal(report.workerMode,'worker');assert.equal(report.allKeysMoved,true);assert.equal(report.allMovingHidden,true);assert.equal(report.intermediateBannerCommits,0);assert.equal(report.intermediateArtworkUnchanged,true);assert.equal(report.catalogueGeometryStable,true);assert.equal(report.finalBannerCommits,0,'Fase C2: the TV banner is a recommendation carousel and never follows the card');assert.equal(report.bannerSettled,true);assert.equal(report.focusedCardVisible,true);assert.equal(report.headerTransparent,true);
 const shot=await tv.send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'artifacts/tv-banner-actual.png'),Buffer.from(shot.data,'base64'));
}finally{tv.close();}
