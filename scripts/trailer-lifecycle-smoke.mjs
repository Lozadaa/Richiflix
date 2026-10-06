import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

// Uses the actual component and an official-player-shaped fixture. It verifies
// state and cleanup locally; it does not certify YouTube or Samsung playback.
const root=resolve(import.meta.dirname,'..'),server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'trailer-test-harness',resolveId:id=>id==='trailer-harness'?'\0trailer-harness':null,load:id=>id==='\0trailer-harness'?`import React from 'react';import {createRoot} from 'react-dom/client';import {TrailerPreview} from '/src/TrailerPreview.jsx';import {CardTrailerPreview} from '/src/CardTrailerPreview.jsx';import {claimCardTrailer} from '/src/cardTrailerStore.js';const root=createRoot(document.getElementById('root'));window.__renderTrailer=(id,active=true)=>root.render(React.createElement(TrailerPreview,{id,active}));window.__closeTrailer=()=>root.unmount();window.__renderShared=()=>root.render(React.createElement(React.Fragment,null,React.createElement(TrailerPreview,{id:'M7lc1UVf-VE',active:true}),React.createElement(CardTrailerPreview)));let release;window.__claim=(id)=>{release?.();const target=document.getElementById('card-target');release=claimCardTrailer(target,id,{left:80,top:120,width:680,height:430});};window.__release=()=>{release?.();release=null;};`:null,configureServer(vite){vite.middlewares.use('/__trailer_harness',async(_request,response)=>{response.setHeader('Content-Type','text/html');response.end(await vite.transformIndexHtml('/__trailer_harness','<!doctype html><div id="root"></div><section class="card-expansion"><div id="card-target"></div></section><script type="module" src="/@id/__x00__trailer-harness"></script>'));});}}]});
await server.listen();const origin=server.resolvedUrls.local[0],browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const fakePlayer=()=>{
  const schedule=window.setTimeout.bind(window);window.__expiredExits=0;window.setTimeout=(callback,delay,...args)=>schedule(()=>{if(delay===140)window.__expiredExits++;callback(...args);},delay);
  window.__calls=[];window.__installYT=()=>{window.YT={Player:function(frame,options){
   let shown=options.videoId;const self=this;
   window.__calls.push(['create',frame.getAttribute('allow'),frame.referrerPolicy,frame.src]);
   this.getVideoData=()=>({video_id:shown});this.getIframe=()=>frame;
   this.cueVideoById=id=>{shown=id;window.__calls.push(['cue',id]);options.events.onStateChange({data:5});};
   this.pauseVideo=()=>{window.__calls.push(['pause']);options.events.onStateChange({data:2});};
   this.stopVideo=()=>window.__calls.push(['stop']);this.unMute=()=>window.__calls.push(['unmute']);this.setVolume=value=>window.__calls.push(['volume',value]);
   this.playVideo=()=>{window.__calls.push(['play',shown]);if(!window.__holdPlay)options.events.onStateChange({data:1});};
   this.destroy=()=>{window.__calls.push(['destroy']);frame.remove();};
   window.__emit=(id,state=1)=>{shown=id;options.events.onStateChange({data:state});};window.__fail=code=>options.events.onError({data:code});window.__blocked=()=>options.events.onAutoplayBlocked();
   window.__ready=()=>options.events.onReady({target:self});
   setTimeout(()=>{if(!window.__holdReady)options.events.onReady({target:self});},0);
  }};window.onYouTubeIframeAPIReady?.();};if(!window.__holdAPI)window.__installYT();
 };
 await page.addInitScript(fakePlayer);
 await page.goto(new URL('/__trailer_harness',origin).href);await page.waitForFunction(()=>typeof window.__renderTrailer==='function');
 await page.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE',false));await page.waitForFunction(()=>document.querySelector('.trailer-preview'));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('iframe').count(),0);assert.equal((await page.evaluate(()=>window.__calls)).length,0,'inactive initial selection does not create or load a player');
 await page.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE'));await page.waitForFunction(()=>document.querySelector('.trailer-preview')?.dataset.trailerState==='playing');
 const initial=await page.evaluate(()=>window.__calls);assert.equal(initial[0][1],'autoplay; encrypted-media');assert.equal(initial[0][2],'strict-origin-when-cross-origin');assert.ok(initial.findIndex(call=>call[0]==='unmute')<initial.findIndex(call=>call[0]==='play'));
 const beforeExit=await page.evaluate(()=>window.__calls.length);
 await page.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE',false));await page.waitForFunction(()=>document.querySelector('.trailer-preview').classList.contains('is-exiting'));
 assert.equal(await page.locator('.trailer-preview').getAttribute('data-trailer-state'),'poster','the held frame is paused rather than reported as playing');
 const exitCalls=(await page.evaluate(()=>window.__calls)).slice(beforeExit);assert.ok(exitCalls.some(call=>call[0]==='pause'));assert.equal(exitCalls.filter(call=>['cue','play'].includes(call[0])).length,0,'holding the exit frame does not run the decoder');
 await page.waitForFunction(()=>!document.querySelector('.trailer-preview').classList.contains('is-exiting'));assert.equal(await page.locator('iframe').count(),1,'expiry keeps the reusable decoder');
 await page.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 const loadedCalls=(await page.evaluate(()=>window.__calls)).filter(call=>['create','cue','play'].includes(call[0])).length;
 for(const id of ['TY1lWh20VSw','dQw4w9WgXcQ','M7lc1UVf-VE','TY1lWh20VSw']){
  await page.evaluate(id=>window.__renderTrailer(id,false),id);await page.waitForFunction(()=>document.querySelector('.trailer-preview')?.dataset.trailerState==='poster');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
 }
 assert.equal((await page.evaluate(()=>window.__calls)).filter(call=>['create','cue','play'].includes(call[0])).length,loadedCalls,'navigation candidates never cue or play');
 assert.equal(await page.locator('iframe').count(),1,'navigation retains the single iframe');
 await page.evaluate(()=>{window.__holdPlay=true;window.__renderTrailer('TY1lWh20VSw');});await page.waitForFunction(()=>window.__calls.some(call=>call[0]==='play'&&call[1]==='TY1lWh20VSw'));
 assert.equal(await page.locator('.trailer-preview').getAttribute('data-trailer-state'),'poster');assert.equal(await page.locator('.trailer-preview').evaluate(element=>element.classList.contains('is-exiting')),false,'a new active ID cannot reveal the previous frame');
 await page.evaluate(()=>window.__emit('TY1lWh20VSw',3));assert.equal(await page.locator('.trailer-preview').getAttribute('data-trailer-state'),'poster','buffering is not actual playback');
 await page.evaluate(()=>{window.__holdPlay=false;window.__emit('TY1lWh20VSw');});await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 assert.deepEqual((await page.evaluate(()=>window.__calls)).filter(call=>call[0]==='cue').map(call=>call[1]),['TY1lWh20VSw'],'only the final settled title is loaded');
 assert.equal((await page.evaluate(()=>window.__calls)).filter(call=>call[0]==='create').length,1);
 await page.evaluate(()=>window.__emit('M7lc1UVf-VE'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='poster');
 await page.evaluate(()=>window.__emit(undefined));assert.equal(await page.locator('.trailer-preview').getAttribute('data-trailer-state'),'poster');
 await page.evaluate(()=>window.__emit('TY1lWh20VSw'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 await page.evaluate(()=>window.__renderTrailer('TY1lWh20VSw',false));await page.waitForFunction(()=>document.querySelector('.trailer-preview').classList.contains('is-exiting'));
 await page.evaluate(()=>window.__renderTrailer(undefined));await page.waitForFunction(()=>!document.querySelector('.trailer-preview').classList.contains('is-exiting'));
 await page.evaluate(()=>window.__renderTrailer('TY1lWh20VSw'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 await page.evaluate(()=>window.__fail(153));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerErrorKind==='client-identification');
 await page.evaluate(()=>window.__renderTrailer('TY1lWh20VSw',false));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='poster');
 await page.evaluate(()=>window.__emit('TY1lWh20VSw'));assert.equal(await page.locator('.trailer-preview').getAttribute('data-trailer-state'),'poster');
 const failedPlays=(await page.evaluate(()=>window.__calls)).filter(call=>call[0]==='play').length;
 await page.evaluate(()=>window.__renderTrailer('TY1lWh20VSw'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal((await page.evaluate(()=>window.__calls)).filter(call=>call[0]==='play').length,failedPlays,'the same failed embed is not retried on every focus cycle');
 assert.equal(await page.locator('.trailer-preview').getAttribute('data-trailer-error-kind'),'client-identification');
 await page.evaluate(()=>window.__renderTrailer(undefined));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='poster');
 await page.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 await page.evaluate(()=>window.__blocked());await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerError==='autoplay-blocked');
 // Resume a different healthy ID before checking visibility teardown.
 await page.evaluate(()=>window.__renderTrailer('dQw4w9WgXcQ'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>window.__calls.some(call=>call[0]==='destroy'));assert.equal(await page.locator('iframe').count(),0);
 await page.evaluate(()=>{window.__holdReady=true;Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>document.querySelector('iframe'));assert.equal(await page.locator('iframe').count(),1);
 await page.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE',false));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='poster');
 const beforeLateReady=(await page.evaluate(()=>window.__calls)).filter(call=>['cue','play'].includes(call[0])).length;
 await page.evaluate(()=>window.__ready());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal((await page.evaluate(()=>window.__calls)).filter(call=>['cue','play'].includes(call[0])).length,beforeLateReady,'late ready does not load or play while moving');
 await page.evaluate(()=>window.__renderTrailer('dQw4w9WgXcQ'));await page.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 await page.evaluate(()=>window.__renderTrailer('dQw4w9WgXcQ',false));await page.waitForFunction(()=>document.querySelector('.trailer-preview').classList.contains('is-exiting'));const beforeClose=await page.evaluate(()=>window.__expiredExits);
 await page.evaluate(()=>{window.__lateReady=window.__ready;window.__closeTrailer();window.__lateReady();});await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>window.__expiredExits),beforeClose,'unmount cancels the pending exit callback');assert.equal(await page.locator('iframe').count(),0);assert.equal((await page.evaluate(()=>window.__calls)).filter(call=>call[0]==='destroy').length,2);assert.deepEqual(errors,[]);
 const deferred=await browser.newPage();deferred.on('pageerror',error=>errors.push(error.message));
 await deferred.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.request().url()==='https://www.youtube.com/iframe_api'?route.fulfill({contentType:'application/javascript',body:''}):route.abort());
 await deferred.addInitScript(()=>{window.__holdAPI=true;});await deferred.addInitScript(fakePlayer);
 await deferred.goto(new URL('/__trailer_harness',origin).href);await deferred.waitForFunction(()=>typeof window.__renderTrailer==='function');
 await deferred.evaluate(()=>window.__renderTrailer('M7lc1UVf-VE'));await deferred.waitForFunction(()=>typeof window.onYouTubeIframeAPIReady==='function');
 await deferred.evaluate(()=>window.__renderTrailer('TY1lWh20VSw',false));await deferred.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='poster');
 await deferred.evaluate(()=>window.__installYT());await deferred.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await deferred.locator('iframe').count(),0,'a late API response cannot create an iframe for a moving candidate');
 await deferred.evaluate(()=>window.__renderTrailer('dQw4w9WgXcQ'));await deferred.waitForFunction(()=>document.querySelector('.trailer-preview').dataset.trailerState==='playing');
 const deferredCalls=await deferred.evaluate(()=>window.__calls);assert.equal(deferredCalls.filter(call=>call[0]==='create').length,1);assert.ok(deferredCalls.find(call=>call[0]==='create')[3].includes('/dQw4w9WgXcQ?'),'the latest settled ID owns initial navigation');assert.deepEqual(deferredCalls.filter(call=>call[0]==='play').map(call=>call[1]),['dQw4w9WgXcQ']);
 await deferred.evaluate(()=>window.__closeTrailer());assert.equal(await deferred.locator('iframe').count(),0);assert.deepEqual(errors,[]);
 const shared=await browser.newPage();shared.on('pageerror',error=>errors.push(error.message));await shared.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());await shared.addInitScript(fakePlayer);await shared.goto(new URL('/__trailer_harness',origin).href);await shared.waitForFunction(()=>typeof window.__renderShared==='function');
 await shared.evaluate(()=>window.__renderShared());await shared.waitForFunction(()=>document.querySelector('#root .trailer-preview')?.dataset.trailerState==='playing');
 await shared.evaluate(()=>window.__claim('TY1lWh20VSw'));await shared.waitForFunction(()=>document.querySelector('.card-trailer-deck .trailer-preview')?.dataset.trailerState==='playing');assert.equal(await shared.locator('.trailer-preview[data-trailer-state="playing"]').count(),1,'only one preview sounds when the card owns playback');assert.equal(await shared.locator('.card-expansion').getAttribute('data-trailer-state'),'playing');
 const sharedFrame=await shared.locator('.card-trailer-deck iframe').elementHandle(),created=await shared.evaluate(()=>window.__calls.filter(call=>call[0]==='create').length);
 await shared.evaluate(()=>window.__release());await shared.waitForFunction(()=>document.querySelector('#root .trailer-preview')?.dataset.trailerState==='playing');assert.equal(await shared.locator('.trailer-preview[data-trailer-state="playing"]').count(),1);
 await shared.evaluate(()=>window.__claim('dQw4w9WgXcQ'));await shared.waitForFunction(()=>document.querySelector('.card-trailer-deck .trailer-preview')?.dataset.trailerState==='playing');assert.equal(await sharedFrame.evaluate(frame=>frame===document.querySelector('.card-trailer-deck iframe')),true,'card changes retain the same iframe and DOM parent');assert.equal(await shared.evaluate(()=>window.__calls.filter(call=>call[0]==='create').length),created);
 await shared.evaluate(()=>window.__fail(153));await shared.waitForFunction(()=>document.querySelector('.card-expansion').dataset.trailerState==='poster');assert.equal(await shared.locator('.trailer-preview[data-trailer-state="playing"]').count(),0,'a failed card preview does not revive the old banner');await shared.evaluate(()=>window.__release());await shared.waitForFunction(()=>document.querySelector('#root .trailer-preview')?.dataset.trailerState==='playing');await shared.evaluate(()=>window.__closeTrailer());assert.equal(await shared.locator('iframe').count(),0);assert.deepEqual(errors,[]);
 console.log('Trailer lifecycle OK: paused exit frame without poster flashes, actual playing required for new IDs, no loads while navigating, one iframe, latest settled title, always sound, classified errors without retry loops, timer cancellation and cleanup. Official player simulated; no TV tested.');
}finally{await browser.close();await server.close();}
