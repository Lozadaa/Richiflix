import {createServer as createViteServer} from 'vite';
import {createServer as createHTTPServer} from 'node:http';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';

// All video IDs, API code and media documents below are isolated fixtures.
// The hosted bridge itself and the React adapter are production source.
const root=resolve(import.meta.dirname,'..'),artifacts=join(root,'artifacts');
const parentPath=join(artifacts,`trailer-bridge-parent-${process.pid}-${Date.now()}.html`);
const ids=['BRG00000001','BRG00000002','BRG00000003','BRG00000004'];
const bridgeHTML=await readFile(join(root,'trailer-bridge/dist/index.html'));
const bridgeRequests=[],bridgeServer=createHTTPServer((request,response)=>{
 if(request.url!=='/'){response.statusCode=404;response.end();return;}
 bridgeRequests.push({referer:request.headers.referer||''});
 response.setHeader('Content-Type','text/html; charset=utf-8');response.end(bridgeHTML);
});
let vite,browser,parentWritten=false;

function fakeAPI(){
 const calls=[];window.__fixtureYT={calls,created:0,ready:false};
 const record=(kind,value)=>{const call={kind,value,sequence:calls.length+1};calls.push(call);window.__recordBridgeFixture(call);};
 window.YT={Player:function(frame,options){
  let shown=options.videoId,closed=false;window.__fixtureYT.created++;record('create',shown);
  window.__fixtureYT.emit=state=>{if(!closed)options.events.onStateChange({data:state});};
  this.getIframe=()=>frame;this.getVideoData=()=>({video_id:shown});
  this.cueVideoById=id=>{shown=id;record('cue',id);window.__fixtureYT.emit(5);};
  this.pauseVideo=()=>{record('pause',shown);window.__fixtureYT.emit(2);};
  // Playing is requested now; a decoder's state=1 is deliberately deferred
  // so the host must wait for the current ID's actual playback signal.
  this.playVideo=()=>record('play',shown);
  this.setVolume=value=>record('volume',value);this.unMute=()=>record('unmute');this.mute=()=>record('mute');
  this.destroy=()=>{closed=true;record('destroy',shown);frame.remove();};
  setTimeout(()=>{if(!closed){window.__fixtureYT.ready=true;options.events.onReady({target:this});}},25);
 }};
 window.onYouTubeIframeAPIReady();
}

function listenerProbe(){
 const add=window.addEventListener,remove=window.removeEventListener,listeners=new Set();window.__fixtureMessageListeners=listeners;
 window.addEventListener=function(type,callback,...args){if(type==='message')listeners.add(callback);return add.call(this,type,callback,...args);};
 window.removeEventListener=function(type,callback,...args){if(type==='message')listeners.delete(callback);return remove.call(this,type,callback,...args);};
}

try{
 await mkdir(artifacts,{recursive:true});await new Promise(resolve=>bridgeServer.listen(0,'127.0.0.1',resolve));
 const bridgeOrigin=`http://127.0.0.1:${bridgeServer.address().port}`;
 const harness=`import React from 'react';import {createRoot} from 'react-dom/client';import {TrailerPreview} from '/src/TrailerPreview.jsx';let root=createRoot(document.getElementById('root'));window.__renderTrailer=(id,active)=>root.render(React.createElement(TrailerPreview,{id,active}));window.__closeTrailer=()=>{root.unmount();root=null;};`;
 vite=await createViteServer({root,configFile:false,mode:'tizen',envPrefix:'BRIDGE_FIXTURE_ONLY_',logLevel:'error',define:{'import.meta.env.VITE_TRAILER_BRIDGE_URL':JSON.stringify(bridgeOrigin+'/')},server:{host:'127.0.0.1',port:0,cors:true,hmr:false},plugins:[{name:'trailer-bridge-fixture',resolveId:id=>id==='bridge-fixture-harness'?'\0bridge-fixture-harness':null,load:id=>id==='\0bridge-fixture-harness'?harness:null}]});
 await vite.listen();const viteOrigin=`http://127.0.0.1:${vite.httpServer.address().port}`;
 await writeFile(parentPath,`<!doctype html><meta charset="utf-8"><title>Isolated widget fixture</title><style>html,body{margin:0;background:#101827}#root{width:960px;height:540px}.trailer-preview{width:100%;height:100%;opacity:0}.trailer-preview.is-playing{opacity:1}.trailer-preview iframe{width:100%;height:100%;border:0}</style><div id="root"></div><script type="module" crossorigin src="${viteOrigin}/@id/__x00__bridge-fixture-harness"></script>`);parentWritten=true;
 browser=await chromium.launch({headless:true});
 const contexts=[];
 const makeContext=async failScript=>{
  const context=await browser.newContext({viewport:{width:960,height:540},serviceWorkers:'block'});contexts.push(context);
  const recorded=[],innerRequests=[],scriptRequests=[],errors=[];
  await context.exposeBinding('__recordBridgeFixture',(_source,call)=>recorded.push(call));await context.addInitScript(listenerProbe);
  await context.route('**/*',async route=>{
   const request=route.request(),address=request.url();
   if(address.startsWith('file:')||address.startsWith(viteOrigin+'/')||address.startsWith(bridgeOrigin+'/'))return route.continue();
   const url=new URL(address);
   if(url.hostname==='www.youtube.com'&&url.pathname==='/iframe_api'){
    scriptRequests.push({referer:request.headers().referer||''});
    if(failScript)return route.abort('failed');
    return route.fulfill({contentType:'text/javascript',body:`(${fakeAPI.toString()})();`});
   }
   if(url.hostname==='www.youtube-nocookie.com'&&url.pathname.startsWith('/embed/')){
    innerRequests.push({referer:request.headers().referer||'',origin:url.searchParams.get('origin'),video:url.pathname.split('/').at(-1)});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#182336"></body></html>'});
   }
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(parentPath).href);await page.waitForFunction(()=>typeof window.__renderTrailer==='function');
  // Windows Chromium's location.origin serializes a file URL as "file://";
  // Window.origin reports the document's actual opaque security origin.
  assert.equal(await page.evaluate(()=>window.origin),'null','The parent widget must have an opaque file origin');assert.equal(await page.evaluate(()=>location.protocol),'file:');
  const render=(id,active)=>page.evaluate(async({id,active})=>{window.__renderTrailer(id,active);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{id,active});
  return {context,page,render,recorded,innerRequests,scriptRequests,errors};
 };
 const normal=await makeContext(false),{page,render}=normal,preview=page.locator('.trailer-preview');
 await render(ids[0],false);await expect(preview).toHaveAttribute('data-trailer-transport','bridge');await expect(preview.locator('iframe')).toHaveCount(0);assert.equal(bridgeRequests.length,0);
 await render(ids[0],true);await expect(preview.locator('iframe')).toHaveCount(1);
 await expect.poll(()=>normal.recorded.filter(call=>call.kind==='play').length).toBe(1);
 const outer=page.frames().find(frame=>frame.url().startsWith(bridgeOrigin+'/'));assert.ok(outer,'The outer frame is the actual hosted bridge');
 await expect.poll(()=>normal.innerRequests.length).toBe(1);assert.equal(normal.innerRequests[0].referer,bridgeOrigin+'/','YouTube receives the real HTTP bridge origin as its Referer');assert.equal(normal.innerRequests[0].origin,bridgeOrigin);assert.equal(normal.scriptRequests[0].referer,bridgeOrigin+'/');assert.equal(bridgeRequests[0].referer,'','The opaque parent supplies no fabricated HTTP Referer');
 await page.evaluate(()=>window.__savedOuter=document.querySelector('.trailer-preview iframe'));
 await outer.evaluate(()=>window.__savedInner=document.querySelector('iframe'));
 await expect(preview).toHaveAttribute('data-trailer-state','poster');await expect(preview).toHaveCSS('opacity','0');
 await outer.evaluate(()=>window.__fixtureYT.emit(1));await expect(preview).toHaveAttribute('data-trailer-state','playing');await expect(preview).toHaveCSS('opacity','1');
 const pauseBefore=normal.recorded.filter(call=>call.kind==='pause').length;
 await render(ids[0],false);await expect(preview).toHaveAttribute('data-trailer-state','poster');await expect.poll(()=>normal.recorded.filter(call=>call.kind==='pause').length).toBeGreaterThan(pauseBefore);
 // Every candidate remains inactive while the remote moves. Only the explicit
 // stable activation below is allowed to reach the bridge's cue command.
 const cueBefore=normal.recorded.filter(call=>call.kind==='cue').length,playBefore=normal.recorded.filter(call=>call.kind==='play').length;
 for(const id of ids.slice(1)){await render(id,false);await page.waitForTimeout(80);}
 await page.waitForTimeout(240);assert.equal(normal.recorded.filter(call=>call.kind==='cue').length,cueBefore);assert.equal(normal.recorded.filter(call=>call.kind==='play').length,playBefore);assert.equal(normal.innerRequests.length,1);assert.equal(bridgeRequests.length,1);await expect(preview).toHaveCSS('opacity','0');
 await render(ids[3],true);await expect.poll(()=>normal.recorded.filter(call=>call.kind==='cue').length).toBe(cueBefore+1);await expect.poll(()=>normal.recorded.filter(call=>call.kind==='play').length).toBe(playBefore+1);assert.equal(normal.recorded.find(call=>call.kind==='cue').value,ids[3]);await expect(preview).toHaveAttribute('data-trailer-state','poster');await expect(preview).toHaveCSS('opacity','0');
 await outer.evaluate(()=>window.__fixtureYT.emit(1));await expect(preview).toHaveAttribute('data-trailer-state','playing');await expect(preview).toHaveCSS('opacity','1');
 assert.equal(await page.evaluate(()=>window.__savedOuter===document.querySelector('.trailer-preview iframe')),true);assert.equal(await outer.evaluate(()=>window.__savedInner===document.querySelector('iframe')),true);assert.equal(normal.recorded.filter(call=>call.kind==='create').length,1);assert.equal(normal.innerRequests.length,1);
 const audioCalls=await outer.evaluate(()=>window.__fixtureYT.calls);assert.equal(audioCalls.filter(call=>call.kind==='mute').length,0);
 for(const[index,call]of audioCalls.entries())if(call.kind==='play'){assert.equal(audioCalls[index-1].kind,'unmute');assert.deepEqual({kind:audioCalls[index-2].kind,value:audioCalls[index-2].value},{kind:'volume',value:100});}
 assert.equal(await page.evaluate(()=>window.__fixtureMessageListeners.size),1,'Exactly one bridge adapter listener is installed');
 await page.evaluate(()=>window.__closeTrailer());await expect(preview).toHaveCount(0);assert.equal(await page.evaluate(()=>window.__fixtureMessageListeners.size),0,'Unmount removes its bridge message listener');assert.equal(page.frames().length,1,'Unmount removes both frame contexts');assert.deepEqual(normal.errors,[]);
 const failure=await makeContext(true),started=Date.now();await failure.render(ids[0],true);const failedPreview=failure.page.locator('.trailer-preview');
 await expect(failedPreview).toHaveAttribute('data-trailer-error','api-unavailable');await expect(failedPreview).toHaveAttribute('data-trailer-error-kind','api-unavailable');await expect(failedPreview).toHaveAttribute('data-trailer-state','poster');await expect(failedPreview).toHaveCSS('opacity','0');assert.equal(failure.innerRequests.length,0);assert.equal(failure.recorded.length,0);assert.ok(Date.now()-started<3000,'A script load failure is reported before the player readiness timeout');
 await failure.page.evaluate(()=>window.__closeTrailer());await expect(failedPreview).toHaveCount(0);assert.equal(await failure.page.evaluate(()=>window.__fixtureMessageListeners.size),0);assert.equal(failure.page.frames().length,1);assert.deepEqual(failure.errors,[]);
 const report={measurement:'Isolated Chromium file widget + local HTTP bridge; simulated YouTube API/media, no Samsung hardware or real decoding',opaqueParentOrigin:true,transport:'bridge',realBridgeHTTPReferer:true,scriptHTTPReferer:true,noFabricatedParentReferer:true,inactiveCreatesNoFrame:true,inactiveCandidatesCueNothing:true,outerFramesCreated:1,innerPlayersCreated:1,innerRequests:1,outerAndInnerReused:true,stableIDCueCount:1,playingRequiresCurrentState1:true,volume100BeforeEveryPlay:true,unmutedBeforeEveryPlay:true,pauseOnInactive:true,unmountRemovesFramesAndListener:true,preReadyScriptFailureKind:'api-unavailable',preReadyFailureShowsNoVideo:true};
 await writeFile(join(artifacts,'trailer-bridge-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 for(const context of contexts)await context.close();
}finally{
 await browser?.close();await vite?.close();await new Promise(resolve=>bridgeServer.close(resolve));if(parentWritten)await unlink(parentPath);
}
