import {fixtureResponse} from './xtream-fixture.mjs';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {defaultMetadataToken} from '../src/metadataDefaults.js';

const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist-tizen');
const zip=unzipSync(await readFile(join(root,'artifacts/Richiflix-Tizen-unsigned.wgt')));
assert.ok(zip['config.xml']&&zip['icon.png']&&zip['assets/richiflix.js']);
assert.equal(Object.keys(zip).filter(name=>/^assets\/catalogueWorker-.*\.js$/.test(name)).length,1);
assert.ok(new TextDecoder().decode(zip['config.xml']).includes('<tizen:allow-navigation>https://www.youtube.com https://www.youtube-nocookie.com</tizen:allow-navigation>'));
assert.ok(zip['fonts/manrope-latin.woff2']&&zip['fonts/bricolage-latin.woff2']);
assert.deepEqual(Buffer.from(zip['icon.png']),await readFile(join(root,'public/brand/kingdom-117.png')));
assert.equal(Buffer.from(zip['icon.png']).readUInt32BE(16),117);
assert.equal(Buffer.from(zip['icon.png']).readUInt32BE(20),117);
const html=new TextDecoder().decode(zip['index.html']);assert.ok(!html.includes('type="module"'));assert.ok(html.includes('$WEBAPIS/webapis/webapis.js'));assert.ok(html.includes('.css'));
const server=createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/player_api.php'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixtureResponse(url.href)));return;}if(url.pathname.includes('$WEBAPIS')){res.setHeader('Content-Type','text/javascript');res.end('/* Samsung API supplied by test fixture. */');return;}
  const path=resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(dist+sep))throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch{res.statusCode=404;res.end();}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.context().route('**/*',route=>{const address=route.request().url(),url=new URL(address);if(address.startsWith(origin))return route.continue();if(address.startsWith('http://ebxvip.xyz:8080/player_api.php')){const data=fixtureResponse(address);if(url.searchParams.get('action')==='get_vod_info')data.info.tmdb_id=999901;return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});}if(url.hostname==='api.themoviedb.org')return route.fulfill({status:url.searchParams.get('api_key')===defaultMetadataToken?200:401,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({title:'Fixture Movie',overview:'Sinopsis española de prueba'})});return route.abort();});
 await page.addInitScript(()=>{
  Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
  localStorage.setItem('rf-profiles',JSON.stringify([{id:'tv-adult',name:'Adulto',kind:'adult'},{id:'tv-kids',name:'Kids',kind:'kids'}]));
  let state='NONE',listener,current=0;window.__calls=[];window.__tracks=[{type:'AUDIO',index:1,extra_info:'{"language":"es"}'},{type:'AUDIO',index:2,extra_info:'{"language":"en"}'}];
  window.tizen={tvinputdevice:{getSupportedKeys:()=>['MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaRewind','MediaFastForward'].map(name=>({name})),registerKey:name=>window.__calls.push(['register',name])},application:{getCurrentApplication:()=>({exit:()=>window.__calls.push(['exit'])}),launchAppControl:(_control,_id,success)=>success()},ApplicationControl:function(operation,url){this.operation=operation;this.uri=url;}};
  window.webapis={appcommon:{AppCommonScreenSaverState:{SCREEN_SAVER_ON:1,SCREEN_SAVER_OFF:0},setScreenSaver(value,success){window.__calls.push(['screensaver',value]);success();}},avplay:{getState:()=>state,open(url){state='IDLE';current=0;window.__calls.push(['open',url]);},close(){state='NONE';window.__calls.push(['close']);},
   setDisplayRect(...args){window.__calls.push(['rect',...args]);},setDisplayMethod(){},setListener(value){listener=value;window.__time=ms=>listener.oncurrentplaytime(ms);window.__buffer=start=>start?listener.onbufferingstart():listener.onbufferingcomplete();},getDuration:()=>596000,
   prepareAsync(callback){window.__prepare=()=>{state='READY';callback();};},
   play(){state='PLAYING';window.__calls.push(['play']);},pause(){state='PAUSED';window.__calls.push(['pause']);},stop(){state='IDLE';},
   seekTo(ms,done){current=ms;window.__calls.push(['seek',ms]);done();listener.oncurrentplaytime(current);},getTotalTrackInfo:()=>window.__tracks,setSelectTrack(type,index){window.__calls.push(['track',type,index]);},
   suspend(){window.__calls.push(['suspend']);},restoreAsync(_url,_time,_prepare,done){done();},
  }};
 });
 const remote=code=>page.evaluate(code=>{const target=document.activeElement||document.body;target.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',keyCode:code,which:code,bubbles:true,cancelable:true}));if(code===13)document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{key:'Unidentified',keyCode:code,which:code,bubbles:true,cancelable:true}));},code);
 await page.goto(origin+'/?diagnostics=1');await page.getByRole('button',{name:'Adulto',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__richiflixPerformance.snapshot().resources.catalogueWorker.mode),'worker');
 await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Adulto');await remote(13);
 await page.getByRole('button',{name:'Ajustes',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Modo TV',exact:true}).count(),0);
 await page.locator('.catalog-row .card-open').first().waitFor(); // Principal is ready before profiles, with no login step.
 await page.waitForFunction(()=>document.activeElement.matches('.topbar nav button.active'));
 await page.locator('.catalog-row .card-open').first().focus();await page.locator('.hero .primary').waitFor();
 await page.locator('.focus-description').getByText('Sinopsis española de prueba',{exact:true}).waitFor({state:'attached'});
 // Initial TV focus is scheduled on the next frame; wait for it before
 // sending a settings selection so that startup cannot overwrite that focus.
 await page.locator('.topbar nav button.active').focus();
 await page.getByRole('button',{name:'Ajustes',exact:true}).focus();await remote(13);await page.getByRole('dialog',{name:'Ajustes',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).count(),0);
 await page.getByText('Tu clave de TMDB · Español preferido',{exact:true}).waitFor();assert.equal(await page.getByLabel('Token TMDB').inputValue(),'');
 const seededMetadata=await page.evaluate(async preset=>{const saved=await new Promise((resolve,reject)=>{const open=indexedDB.open('richiflix-xtream',1);open.onerror=reject;open.onsuccess=()=>{const db=open.result,tx=db.transaction('source'),request=tx.objectStore('source').get('metadata-token');tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onerror=reject;};});const token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv},saved.key,saved.data));return token===preset&&!(new TextDecoder().decode(saved.data)).includes(preset);},defaultMetadataToken);assert.equal(seededMetadata,true);
 await page.getByText('Principal',{exact:true}).waitFor();await page.getByText('1 canales · 1 películas · 1 series',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Contraseña Xtream').count(),0);assert.equal(await page.getByRole('button',{name:'Quitar fuente',exact:true}).count(),0);
 await page.getByRole('button',{name:'Cambiar login',exact:true}).click();
 await page.getByLabel('Servidor Xtream').fill(origin);
 await page.getByLabel('Usuario Xtream').fill('fixture-user');await page.getByLabel('Contraseña Xtream').fill('fixture-password');
 await page.getByRole('button',{name:'Conectar',exact:true}).focus();await remote(13);await page.getByLabel('Contraseña Xtream').waitFor({state:'detached'});await page.getByText('Principal',{exact:true}).waitFor();
 await page.getByText('1 canales · 1 películas · 1 series',{exact:true}).waitFor();
 await remote(10009);await page.getByRole('dialog').waitFor({state:'detached'});
 const movie=page.locator('.cards[aria-label="Películas"] .card-open').first();await movie.focus();await remote(13);await page.locator('.player-dialog').waitFor();
 await page.getByRole('status',{name:'Cargando vídeo'}).waitFor();assert.equal(await page.getByRole('status',{name:'Cargando vídeo'}).count(),1);
 assert.equal(await page.locator('.player-loading .kingdom-loader-shadow').evaluate(el=>getComputedStyle(el).borderRadius),'50%');
 assert.ok((await page.locator('.player-loading .kingdom-loader-stage img').getAttribute('src')).endsWith('kingdom-glyph.svg'));
 await page.waitForFunction(()=>document.querySelector('.player-loading .kingdom-loader-stage img')?.naturalWidth>0);
 // Chromium has no Samsung video plane. Use a black simulated plane rather
 // than the browser's unsupported-plugin placeholder in visual QA captures.
 await page.addStyleTag({content:'.avplay-surface{visibility:hidden}html,body{background:#03070d!important}'});
 await page.screenshot({path:join(root,'player-loader-preview.png')});
 assert.equal(await page.locator('object[type="application/avplayer"]').count(),1);assert.equal(await page.locator('video').getAttribute('src'),null);
 assert.equal(await page.locator('.player-dialog').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.evaluate(()=>window.__prepare());await page.getByRole('button',{name:'Pausar vídeo',exact:true}).waitFor();await page.evaluate(()=>window.__time(1000));await page.locator('.player-loading').waitFor({state:'detached'});
 assert.ok((await page.evaluate(()=>window.__calls)).some(call=>call[0]==='screensaver'&&call[1]===0));
 await remote(10252);await page.getByRole('button',{name:'Reproducir vídeo',exact:true}).waitFor();await remote(415);await page.getByRole('button',{name:'Pausar vídeo',exact:true}).waitFor();
 await remote(417);assert.ok((await page.evaluate(()=>window.__calls)).some(call=>call[0]==='seek'&&call[1]===11000));
 await remote(40);await page.waitForFunction(()=>document.activeElement.matches('.playback-toggle'));await remote(13);await page.getByRole('button',{name:'Reproducir vídeo',exact:true}).waitFor();
 // E2: «Idioma y subtítulos» opens the side panel (buttons, never <select>); Down walks, OK applies and keeps it open, Back/Left close it on the button.
 const languageButton=page.getByRole('button',{name:'Idioma y subtítulos',exact:true});await languageButton.focus();await remote(13);await page.locator('.playback-sidebar').waitFor();
 const audioGroup=page.getByRole('radiogroup',{name:'Audio',exact:true});assert.deepEqual(await audioGroup.getByRole('radio').allTextContents(),['Español','Inglés']);
 await page.waitForFunction(()=>document.activeElement.matches('.playback-sidebar [role="radio"][aria-checked="true"]')&&document.activeElement.textContent==='Español');
 assert.equal(await page.locator('.player-dialog select').count(),0);assert.equal(await page.getByRole('radiogroup',{name:'Velocidad'}).count(),0);assert.equal(await page.getByLabel('Volumen',{exact:true}).count(),0);
 assert.equal(await page.locator('.player-volume,.player-resume').count(),0);
 await remote(40);await page.waitForFunction(()=>document.activeElement.textContent==='Inglés');await remote(40);await page.waitForFunction(()=>document.activeElement.textContent==='Inglés'); // the last option holds
 await remote(13);await page.waitForFunction(()=>document.activeElement.getAttribute('aria-checked')==='true'&&document.activeElement.textContent==='Inglés');assert.equal(await page.locator('.playback-sidebar').count(),1);
 assert.equal(await page.evaluate(()=>document.activeElement.matches('.seek-track input')),false);
 await remote(38);await page.waitForFunction(()=>document.activeElement.textContent==='Español');assert.equal(await page.getByRole('radio',{name:'Español',exact:true}).getAttribute('aria-checked'),'false');
 await remote(37);await page.locator('.playback-sidebar').waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Idioma y subtítulos');
 await remote(13);await page.locator('.playback-sidebar').waitFor();await page.waitForFunction(()=>document.activeElement.textContent==='Inglés');
 await remote(10009);await page.locator('.playback-sidebar').waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Idioma y subtítulos');assert.equal(await page.locator('.player-dialog').count(),1);
 await remote(415);await page.getByRole('button',{name:'Pausar vídeo',exact:true}).waitFor();assert.ok((await page.evaluate(()=>window.__calls)).some(call=>call[0]==='track'&&call[1]==='AUDIO'&&call[2]===2)); // chosen while paused, applied on play
 await page.screenshot({path:join(root,'tizen-player-preview.png')});
 await remote(10009);await page.waitForFunction(()=>document.activeElement.matches('.player-dialog video'));await remote(10009);await page.locator('.player-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('native-playback')),false); // D2: Back from the button row returns to the video, Back from the video closes
 assert.deepEqual((await page.evaluate(()=>window.__calls)).filter(call=>call[0]==='screensaver').at(-1),['screensaver',1]);
 await page.getByRole('button',{name:'Series',exact:true}).click();await page.locator('.catalog-grid .card-open').first().focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.catalog-grid .card .poster')).visibility==='visible');assert.equal(await page.locator('.card.is-in-banner').count(),0);assert.ok(await page.locator('.catalog-grid .card-open').first().evaluate(button=>button===document.activeElement));await remote(13);
 await page.getByRole('button',{name:'Reproducir Fixture Episode 1',exact:true}).waitFor();assert.equal(await page.locator('.series-detail select,.season-tabs').count(),0);await page.getByRole('button',{name:'Reproducir Fixture Episode 1',exact:true}).focus();await remote(40);await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Reproducir Fixture Episode 2');await remote(38);await remote(13);
 await page.waitForFunction(()=>typeof window.__prepare==='function'&&window.__calls.at(-1)[0]!=='close');
 await page.locator('.player-dialog').waitFor();await page.evaluate(()=>window.__prepare());await page.getByRole('button',{name:'Pausar vídeo',exact:true}).waitFor();await page.evaluate(()=>window.__time(1000));await page.locator('.player-loading').waitFor({state:'detached'});
 assert.ok((await page.evaluate(()=>window.__calls)).some(call=>call[0]==='open'&&call[1].endsWith('/series/fixture-user/fixture-password/88.mp4')));
 await remote(10009);await page.locator('.player-dialog').waitFor({state:'detached'});
 await page.locator('.series-detail').waitFor();await page.getByRole('button',{name:'Reproducir Fixture Episode 1',exact:true}).waitFor();await remote(10009);await page.locator('.series-detail').waitFor({state:'detached'});
 await page.getByRole('button',{name:'TV en vivo',exact:true}).focus();await remote(13);await page.locator('.catalog-grid .card-open').first().focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.catalog-grid .card .poster')).visibility==='visible');assert.equal(await page.locator('.card.is-in-banner').count(),0);await remote(13);
 await page.evaluate(()=>window.__tracks=[{type:'AUDIO',index:1,extra_info:'{"language":"es"}'}]);
 await page.locator('.player-dialog').waitFor();await page.evaluate(()=>window.__prepare());await page.getByRole('button',{name:'Pausar vídeo',exact:true}).waitFor();await page.evaluate(()=>window.__time(1000));await page.locator('.player-loading').waitFor({state:'detached'});
 const liveSessionCalls=await page.evaluate(()=>window.__calls.filter(call=>['open','close','play','seek'].includes(call[0])).length);
 await page.evaluate(()=>window.__buffer(true));await page.getByRole('status',{name:'Cargando vídeo'}).waitFor();await page.evaluate(()=>{window.__buffer(false);window.__time(1000);});await page.waitForTimeout(400);
 assert.equal(await page.locator('.player-loading').count(),1,'AVPlay buffer completion without time advancement keeps the loader');assert.equal(await page.locator('.player-state').count(),0);
 assert.equal(await page.evaluate(()=>window.__calls.filter(call=>['open','close','play','seek'].includes(call[0])).length),liveSessionCalls,'AVPlay buffering preserves its decoder session');
 await page.evaluate(()=>window.__time(1500));await page.locator('.player-loading').waitFor({state:'detached'});
 assert.equal(await page.locator('.player-dialog .skip-tool,.player-dialog .seek-track,.player-dialog .live-edge,.player-dialog .playback-options,.player-dialog .player-volume').count(),0);
 await page.getByRole('button',{name:'Pausar vídeo',exact:true}).focus();
 await page.waitForFunction(()=>document.querySelector('.player-dialog').classList.contains('chrome-hidden'));
 await remote(40);await page.waitForFunction(()=>document.activeElement.matches('.playback-toggle'));await remote(13);
 await page.getByRole('button',{name:'Reproducir vídeo',exact:true}).waitFor();assert.equal(await page.locator('.player-resume').count(),0);
 await remote(10009);await page.waitForFunction(()=>document.activeElement.matches('.player-dialog video'));await remote(10009);await page.locator('.player-dialog').waitFor({state:'detached'});
 await page.getByRole('button',{name:'Cambiar perfil',exact:true}).focus();await remote(13);await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Adulto');await page.getByRole('button',{name:'Kids',exact:true}).focus();await remote(13);
 await page.getByRole('button',{name:'Ajustes',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'TV en vivo',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Añadir contenido',exact:true}).count(),0);
 await remote(10009);await page.getByRole('button',{name:'Adulto',exact:true}).waitFor();await remote(10009);await page.getByRole('dialog',{name:'Salir de Kingdom'}).waitFor();
 await page.getByRole('button',{name:'Seguir viendo',exact:true}).focus();await remote(13);await page.getByRole('dialog').waitFor({state:'detached'});
 assert.deepEqual(errors,[]);console.log('Tizen smoke OK: fuente principal lista desde cero sin login, edición Xtream, WGT, CSS, películas, episodios, perfiles, mando, loader, AVPlay, pausa/seek, audio, Volver, Kids y salida. Decoder simulado; falta prueba en TV real.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
