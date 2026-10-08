// Run after npm run build: node electron/live-buffering-smoke.cjs
// All playlists, segments, panel credentials, and the Electron profile are local fixtures.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {addTestSource}=require('./test-source.cjs');

const STALLED_OUTAGE_MS=8000;
const PAUSED_OBSERVATION_MS=7000;
const poll=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function createLiveFixture(directory){
 // Pre-encode a signal, then publish its segments against an advancing live clock.
 // The generated file is never served: the served media playlist moves its window
 // and MEDIA-SEQUENCE every second, and never contains ENDLIST or PLAYLIST-TYPE.
 await promisify(execFile)('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=10','-t','180','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','10','-keyint_min','10','-sc_threshold','0','-f','hls','-hls_time','1','-hls_list_size','0','-hls_segment_filename','segment-%03d.ts','encoded.m3u8'],{cwd:directory});
 const encoded=await fs.readFile(path.join(directory,'encoded.m3u8'),'utf8');
 const segments=[...encoded.matchAll(/#EXTINF:([\d.]+),\r?\n(segment-\d+\.ts)/g)].map(match=>({duration:Number(match[1]),name:match[2]}));
 assert.equal(segments.length,180,'FFmpeg must provide enough unique, continuous segments for the smoke test');
 assert.ok(segments.every(segment=>segment.duration===1),'Live fixture requires one-second segments');
 const pending=new Set();
 const stats={master:0,media:0,segments:0,blocked:0,blockedPlaylists:0,sequences:new Set(),servedLive:true};
 let startedAt,blocked=false;
 const deliverPlaylist=response=>{
  if(response.destroyed||response.writableEnded)return;
  startedAt??=Date.now();const last=24+Math.floor((Date.now()-startedAt)/1000),first=Math.max(0,last-19);
  if(last>=segments.length){response.writeHead(503);response.end();return;}
  const playlist=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-TARGETDURATION:1',`#EXT-X-MEDIA-SEQUENCE:${first}`];
  for(let index=first;index<=last;index++)playlist.push(`#EXTINF:${segments[index].duration.toFixed(6)},`,segments[index].name);
  const body=playlist.join('\n')+'\n';stats.media++;stats.sequences.add(first);
  stats.servedLive&&=!body.includes('#EXT-X-ENDLIST')&&!body.includes('#EXT-X-PLAYLIST-TYPE');
  response.setHeader('Content-Type','application/vnd.apple.mpegurl');response.end(body);
 };
 const deliver=async(response,index)=>{
  if(response.destroyed||response.writableEnded)return;
  try{response.writeHead(200,{'Content-Type':'video/mp2t','Cache-Control':'no-store'});response.end(await fs.readFile(path.join(directory,segments[index].name)));}
  catch{if(!response.headersSent)response.writeHead(404);response.end();}
 };
 const server=createServer(async(request,response)=>{
  const pathname=new URL(request.url,'http://fixture').pathname;
  response.setHeader('Cache-Control','no-store');response.setHeader('Access-Control-Allow-Origin','*');
  if(pathname==='/master.m3u8'){
   stats.master++;startedAt??=Date.now();response.setHeader('Content-Type','application/vnd.apple.mpegurl');
   response.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=450000,RESOLUTION=320x180\nlive.m3u8\n');return;
  }
  if(pathname==='/live.m3u8'){
   if(blocked){stats.blockedPlaylists++;const entry={response,playlist:true};pending.add(entry);response.once('close',()=>pending.delete(entry));return;}
   deliverPlaylist(response);return;
  }
  const match=/^\/segment-(\d+)\.ts$/.exec(pathname);
  if(match&&Number(match[1])<segments.length){
   const index=Number(match[1]);stats.segments++;
   if(blocked){
    stats.blocked++;const entry={response,index};pending.add(entry);
    response.once('close',()=>pending.delete(entry));return;
   }
   await deliver(response,index);return;
  }
  response.writeHead(404);response.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {
  host:`http://127.0.0.1:${server.address().port}`,stats,
  cut(){blocked=true;},
  async release(){blocked=false;const waiting=[...pending];pending.clear();await Promise.all(waiting.map(entry=>entry.playlist?deliverPlaylist(entry.response):deliver(entry.response,entry.index)));},
  async close(){blocked=false;for(const entry of pending)entry.response.destroy();pending.clear();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));},
 };
}

async function instrumentPlayer(page,root){
 const assets=await fs.readdir(path.join(root,'dist','assets'));
 const chunks=assets.filter(file=>/^player-[\w-]+\.js$/.test(file));
 assert.equal(chunks.length,1,'Build must contain the desktop Hls player chunk');
 await page.evaluate(async asset=>{
  const {default:Hls}=await import(new URL(`./assets/${asset}`,location.href).href);
  const sessions=[],byInstance=new WeakMap(),mediaSources=new WeakSet();
  const counters={src:0,load:0,mediaSource:0,play:0};let phase;
  const state=instance=>{
   let value=byInstance.get(instance);
   if(!value){
    value={instance,id:sessions.length,loadSource:0,attachMedia:0,recoverMediaError:0,startLoad:0,destroy:0,manifestParsed:0,liveUpdates:0,nonLiveUpdates:0,transportErrors:0,fatalTransportErrors:0,fatalPlaylistErrors:0,video:null,dialog:null};
    byInstance.set(instance,value);sessions.push(value);
    instance.on(Hls.Events.MANIFEST_PARSED,()=>value.manifestParsed++);
    instance.on(Hls.Events.LEVEL_LOADED,(_event,data)=>data.details.live?value.liveUpdates++:value.nonLiveUpdates++);
    instance.on(Hls.Events.ERROR,(_event,data)=>{if(data.type===Hls.ErrorTypes.NETWORK_ERROR){value.transportErrors++;if(data.fatal){value.fatalTransportErrors++;if(data.details===Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT||data.details===Hls.ErrorDetails.LEVEL_LOAD_ERROR)value.fatalPlaylistErrors++;}}});
   }
   return value;
  };
  for(const method of ['loadSource','attachMedia','recoverMediaError','startLoad','destroy']){
   const original=Hls.prototype[method];
   Hls.prototype[method]=function(...args){
    const value=state(this);value[method]++;
    if(method==='loadSource'&&value.loadSource===1){
     // Real delayed HTTP segments and level playlists now time out quickly,
     // exercising fatal network recovery without a two-minute segment timeout.
     // Hls 1.7 can skip non-final live fragment errors as gaps; withholding the
     // level playlist also makes its exhausted retry count deterministically fatal.
     // Playback, decoded media, and the playlist's live clock remain unmodified.
     const policy=this.config.fragLoadPolicy.default;
     this.config.fragLoadPolicy={default:{...policy,maxTimeToFirstByteMs:1000,maxLoadTimeMs:1200,timeoutRetry:{...policy.timeoutRetry,maxNumRetry:1,retryDelayMs:100,maxRetryDelayMs:200},errorRetry:{...policy.errorRetry,maxNumRetry:1,retryDelayMs:100,maxRetryDelayMs:200}}};
     const playlist=this.config.playlistLoadPolicy.default;
     this.config.playlistLoadPolicy={default:{...playlist,maxTimeToFirstByteMs:1000,maxLoadTimeMs:1200,timeoutRetry:{...playlist.timeoutRetry,maxNumRetry:1,retryDelayMs:100,maxRetryDelayMs:200},errorRetry:{...playlist.errorRetry,maxNumRetry:1,retryDelayMs:100,maxRetryDelayMs:200}}};
    }
    if(method==='attachMedia'){value.video=args[0]?.media||args[0];value.dialog=value.video.closest('.player-dialog');}
    return original.apply(this,args);
   };
  }
  const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
  Object.defineProperty(HTMLMediaElement.prototype,'src',{...descriptor,set(value){if(this.tagName==='VIDEO')counters.src++;return descriptor.set.call(this,value);}});
  const setAttribute=HTMLMediaElement.prototype.setAttribute;
  HTMLMediaElement.prototype.setAttribute=function(name,value){if(this.tagName==='VIDEO'&&name.toLowerCase()==='src')counters.src++;return setAttribute.call(this,name,value);};
  const load=HTMLMediaElement.prototype.load,play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.load=function(){if(this.tagName==='VIDEO')counters.load++;return load.apply(this,arguments);};
  HTMLMediaElement.prototype.play=function(){if(this.tagName==='VIDEO')counters.play++;return play.apply(this,arguments);};
  const createObjectURL=URL.createObjectURL;
  URL.createObjectURL=function(value){if((typeof MediaSource==='function'&&value instanceof MediaSource)||(typeof ManagedMediaSource==='function'&&value instanceof ManagedMediaSource)){if(!mediaSources.has(value)){mediaSources.add(value);counters.mediaSource++;}}return createObjectURL.call(this,value);};
  const snapshot=id=>{
   const value=sessions[id],video=document.querySelector('video');
   if(!value)return null;
   const ahead=video?.buffered.length?video.buffered.end(video.buffered.length-1)-video.currentTime:0;
   return {id,loadSource:value.loadSource,attachMedia:value.attachMedia,recoverMediaError:value.recoverMediaError,startLoad:value.startLoad,destroy:value.destroy,manifestParsed:value.manifestParsed,liveUpdates:value.liveUpdates,nonLiveUpdates:value.nonLiveUpdates,transportErrors:value.transportErrors,fatalTransportErrors:value.fatalTransportErrors,fatalPlaylistErrors:value.fatalPlaylistErrors,...counters,videoSame:video===value.video,dialogSame:document.querySelector('.player-dialog')===value.dialog,currentTime:video?.currentTime,paused:video?.paused,readyState:video?.readyState,mediaError:video?.error?.code||null,bufferedAhead:ahead,loader:document.querySelectorAll('.player-loading').length,terminal:document.querySelectorAll('.player-state').length};
  };
  setInterval(()=>{
   if(!phase)return;
   const current=snapshot(phase.id),video=sessions[phase.id].video;
   phase.samples++;
   if(current.currentTime>phase.position+.025){phase.lastAdvance=performance.now();phase.position=current.currentTime;}
   phase.maxLoader=Math.max(phase.maxLoader,current.loader);
   phase.sawTerminal||=current.terminal>0;
   phase.identityChanged||=!current.videoSame||!current.dialogSame||(video.currentSrc||video.src)!==phase.src;
   if(phase.waitingRequired&&current.loader!==1)phase.missingLoader++;
  },100);
  window.__liveBuffering={
   latest:()=>sessions.length-1,snapshot,
   begin(id){const value=sessions[id],video=value.video;phase={id,position:video.currentTime,lastAdvance:performance.now(),src:video.currentSrc||video.src,samples:0,maxLoader:0,sawTerminal:false,identityChanged:false,waitingRequired:false,missingLoader:0};},
   waiting(){phase.waitingRequired=true;phase.waitingAt=performance.now();},
   observation(){return phase?{...phase,src:undefined,stalledFor:performance.now()-phase.lastAdvance,waitingFor:phase.waitingAt?performance.now()-phase.waitingAt:0}:null;},
   end(){phase=null;},
   injectStall(id){const value=sessions[id];if(value.video.error)throw Error('Fixture must have no media decoder error');value.instance.trigger(Hls.Events.ERROR,{fatal:true,type:Hls.ErrorTypes.MEDIA_ERROR,details:Hls.ErrorDetails.BUFFER_STALLED_ERROR,error:new Error('Controlled buffer stall')});},
  };
 },chunks[0]);
}

const snapshot=(page,id)=>page.evaluate(id=>window.__liveBuffering.snapshot(id),id);
const observe=page=>page.evaluate(()=>window.__liveBuffering?.observation()||null);
function unchangedSession(before,after,label){
 for(const key of ['loadSource','attachMedia','recoverMediaError','manifestParsed','mediaSource','src','load'])assert.equal(after[key],before[key],`${label}: ${key} must not reset`);
 assert.ok(after.videoSame&&after.dialogSame,`${label}: preserve video and player elements`);
 assert.equal(after.mediaError,null,`${label}: this is a buffer wait, not a decoder failure`);
 assert.equal(after.nonLiveUpdates,0,`${label}: decoder must observe genuinely live playlists`);
}
async function openLive(page,name){
 await page.getByRole('button',{name:'TV en vivo',exact:true}).click();
 await page.getByRole('button',{name,exact:true}).click();
 await page.locator('.player-dialog').waitFor();
}
async function waitForAdvancement(page,id,position,timeout=15000){
 await page.waitForFunction(({id,position})=>{const value=window.__liveBuffering.snapshot(id);return value?.currentTime>position+.75&&!value.paused&&value.loader===0&&value.terminal===0;},{id,position},{timeout});
}
async function waitForEmptyBuffer(page,id){
 await page.waitForFunction(id=>{const value=window.__liveBuffering.snapshot(id),phase=window.__liveBuffering.observation();return value.loader===1&&!value.paused&&value.readyState<=2&&value.bufferedAhead<.3&&phase.stalledFor>1000;},id,{timeout:20000});
 assert.equal((await snapshot(page,id)).terminal,0,'Waiting for bytes must not become a terminal error');
}

(async()=>{
 const root=path.resolve(__dirname,'..'),prefix='richiflix-live-buffering-';
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),prefix));
 let app,page,fixture,checkpoint='create local live fixture';
 try{
  fixture=await createLiveFixture(directory);
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:path.join(directory,'profile')}});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.webContents.setBackgroundThrottling(false)));
  page=await app.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.emulateMedia({reducedMotion:'reduce'});
  await instrumentPlayer(page,root);
  await page.getByRole('button',{name:'Crear perfil',exact:true}).click();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await addTestSource(page,{name:'Directo local',url:fixture.host+'/master.m3u8',live:true});
  await openLive(page,'Directo local');
  await page.waitForFunction(()=>{const id=window.__liveBuffering.latest(),value=window.__liveBuffering.snapshot(id);return value?.currentTime>1&&value.liveUpdates>0&&!value.paused&&value.loader===0;},null,{timeout:20000});
  const id=await page.evaluate(()=>window.__liveBuffering.latest());
  await waitForAdvancement(page,id,(await snapshot(page,id)).currentTime);
  // Establish that Hls is actually polling a moving live window before the
  // controlled stall notification can interrupt its current load cycle.
  await page.waitForFunction(id=>window.__liveBuffering.snapshot(id).liveUpdates>=2,id,{timeout:15000});
  const sequenceDeadline=Date.now()+10000;
  while(fixture.stats.sequences.size<2&&Date.now()<sequenceDeadline)await poll(100);
  assert.ok(fixture.stats.sequences.size>=2,'Two different live MEDIA-SEQUENCE values must be served before fault injection');
  const initial=await snapshot(page,id);
  assert.equal(initial.loadSource,1);assert.equal(initial.attachMedia,1);assert.equal(initial.manifestParsed,1);assert.equal(initial.mediaSource,1);assert.equal(initial.nonLiveUpdates,0);
  const initialMasterRequests=fixture.stats.master;

  checkpoint='fatal buffer stall notification while video advances';
  await page.evaluate(id=>{window.__liveBuffering.begin(id);window.__liveBuffering.injectStall(id);},id);
  await waitForAdvancement(page,id,initial.currentTime);
  const afterNotification=await snapshot(page,id),notificationObservation=await observe(page);
  unchangedSession(initial,afterNotification,checkpoint);
  assert.ok(afterNotification.currentTime-initial.currentTime<3,'A stall notification must not seek forward or restart at the live edge');
  assert.equal(notificationObservation.identityChanged,false);assert.equal(notificationObservation.sawTerminal,false);

  checkpoint='real segment outage after the live buffer empties';
  await page.evaluate(id=>window.__liveBuffering.begin(id),id);fixture.cut();await waitForEmptyBuffer(page,id);
  const stalled=await snapshot(page,id);await page.evaluate(()=>window.__liveBuffering.waiting());
  // This observation starts only after decoded video has stopped advancing;
  // it deliberately exceeds the previous six-second terminal-error grace.
  await page.waitForFunction(milliseconds=>window.__liveBuffering.observation().waitingFor>=milliseconds,STALLED_OUTAGE_MS,{timeout:STALLED_OUTAGE_MS+5000});
  const duringOutage=await snapshot(page,id),outage=await observe(page);
  unchangedSession(initial,duringOutage,checkpoint);
  assert.ok(fixture.stats.blocked+fixture.stats.blockedPlaylists>0,'The fixture must delay real HTTP requests used by the live signal');
  assert.ok(fixture.stats.blockedPlaylists>0,'The same local network outage must delay live playlist refreshes');
  assert.ok(duringOutage.fatalTransportErrors>0,'Real HTTP timeouts must reach the fatal network recovery path');
  assert.ok(duringOutage.fatalPlaylistErrors>0,'Exhausted live playlist HTTP timeouts must become a real fatal transport error');
  assert.ok(duringOutage.currentTime-stalled.currentTime<.3,'Playback must really run out of buffered media');
  assert.equal(outage.maxLoader,1,'Only one loader may be mounted');assert.equal(outage.missingLoader,0,'Keep the loader visible throughout the buffer wait');
  assert.equal(outage.sawTerminal,false,'No terminal overlay during the recoverable live outage');assert.equal(outage.identityChanged,false,'Keep the same video, dialog, and MediaSource URL throughout the wait');
  assert.ok(fixture.stats.sequences.size>1,'The served live playlist must advance its MEDIA-SEQUENCE');
  assert.equal(fixture.stats.servedLive,true);assert.equal(fixture.stats.master,initialMasterRequests,'Playlist polling must not reload the initial manifest');
  await page.evaluate(()=>window.__liveBuffering.end());await fixture.release();await waitForAdvancement(page,id,stalled.currentTime,20000);
  const resumed=await snapshot(page,id);unchangedSession(initial,resumed,'resume after released HTTP segments');
  assert.equal(fixture.stats.master,initialMasterRequests);

  checkpoint='pause during another real buffer outage';
  await page.evaluate(id=>window.__liveBuffering.begin(id),id);fixture.cut();await waitForEmptyBuffer(page,id);
  await page.getByRole('button',{name:'Pausar vídeo',exact:true}).click();
  await page.waitForFunction(id=>window.__liveBuffering.snapshot(id).paused,id);
  const paused=await snapshot(page,id),pausedAt=Date.now();
  // Keep the cut in place past pending retry deadlines and the old error grace.
  while(Date.now()-pausedAt<PAUSED_OBSERVATION_MS){
   const current=await snapshot(page,id);
   unchangedSession(paused,current,'paused outage');assert.equal(current.startLoad,paused.startLoad,'A paused player must not run a delayed recovery action');
   assert.equal(current.play,paused.play,'A pending recovery must not call play after the user pauses');assert.equal(current.paused,true);assert.equal(current.terminal,0);
   await poll(200);
  }
  await fixture.release();
  // Let released HTTP responses reach the renderer before accepting that a
  // canceled recovery cannot resume playback behind the user's pause action.
  const releasedAt=Date.now();
  while(Date.now()-releasedAt<1000){
   const afterRelease=await snapshot(page,id);assert.equal(afterRelease.paused,true);assert.equal(afterRelease.play,paused.play);assert.ok(afterRelease.currentTime-paused.currentTime<.3);
   await poll(100);
  }
  await page.evaluate(()=>window.__liveBuffering.end());await page.getByRole('button',{name:'Reproducir vídeo',exact:true}).click();await waitForAdvancement(page,id,paused.currentTime,20000);

  checkpoint='close during buffer outage';
  await page.evaluate(id=>window.__liveBuffering.begin(id),id);fixture.cut();await waitForEmptyBuffer(page,id);
  await page.keyboard.press('Escape');await page.locator('.player-dialog').waitFor({state:'detached'});await page.evaluate(()=>window.__liveBuffering.end());
  const closed=await snapshot(page,id);assert.equal(closed.destroy,1,'Close must dispose the Hls session once');
  await fixture.release();

  checkpoint='permanently unavailable local signal';
  await addTestSource(page,{name:'Señal inexistente local',url:fixture.host+'/unavailable.m3u8',live:true});await openLive(page,'Señal inexistente local');
  await page.getByRole('heading',{name:'No se pudo reproducir',exact:true}).waitFor({timeout:70000});
  await expect(page.getByRole('alert')).toHaveText('Esta emisión no está disponible ahora.');await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toBeFocused();
  const afterClose=await snapshot(page,id);
  for(const key of ['loadSource','attachMedia','recoverMediaError','startLoad','destroy'])assert.equal(afterClose[key],closed[key],`Disposed session must not perform a late ${key}`);
  await page.keyboard.press('Escape');await page.locator('.player-dialog').waitFor({state:'detached'});assert.deepEqual(errors,[]);
  console.log('Live buffering OK: moving live HLS survives fatal stall notifications and an eight-second empty-buffer HTTP outage with one loader and the same video/Hls/MediaSource; pause and close cancel late recovery, and an absent signal still reports its error.');
 }catch(error){
  if(page){try{const id=await page.evaluate(()=>window.__liveBuffering?.latest());console.error(JSON.stringify({checkpoint,player:id>=0?await snapshot(page,id):null,observation:await observe(page),ui:await page.evaluate(()=>({headings:[...document.querySelectorAll('h1,h2')].map(node=>node.textContent),alerts:[...document.querySelectorAll('[role=alert]')].map(node=>node.textContent)}))}));await page.screenshot({path:path.join(root,'live-buffering-test-failure.png')});}catch{}}
  throw error;
 }finally{
  await app?.close();await fixture?.close();
  const target=path.resolve(directory),temporaryRoot=path.resolve(os.tmpdir());
  assert.ok(target.startsWith(temporaryRoot+path.sep)&&path.basename(target).startsWith(prefix),'Cleanup must remain inside the expected temporary fixture directory');
  await fs.rm(target,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error.name+' '+error.message.replace(/https?:\/\/\S+/g,'[address]'));process.exitCode=1;});
