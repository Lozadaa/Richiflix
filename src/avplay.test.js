import test from 'node:test';
import assert from 'node:assert/strict';
import {createAVPlayer} from './avplay.js';
import {registerRemote,remoteKeys,mediaKeyNames} from './platform.js';

function fixture(options={}){
 let state='NONE',listener,ready,seekDone,restored;
 const calls=[],events=[],tracks=[],subtitles=[];
 const api={getState:()=>state,close(){calls.push(['close']);state='NONE';},open(url){calls.push(['open',url]);state='IDLE';},
  setDisplayRect(...args){calls.push(['rect',...args]);},setDisplayMethod(value){calls.push(['display',value]);},setListener(value){listener=value;},
  prepareAsync(callback){calls.push(['prepare']);ready=()=>{state='READY';callback();};},getDuration:()=>120000,
  getTotalTrackInfo:()=>[{type:'AUDIO',index:2,extra_info:'{"language":"es","fourCC":"AAC"}'},{type:'VIDEO',index:0},{type:'TEXT',index:3,extra_info:'{"track_lang":"en"}'}],
  play(){assert.ok(['READY','PAUSED','PLAYING'].includes(state));state='PLAYING';calls.push(['play']);},
  pause(){assert.equal(state,'PLAYING');state='PAUSED';calls.push(['pause']);},
  seekTo(value,callback){calls.push(['seek',value]);seekDone=callback;},
  setSelectTrack(type,index){assert.equal(state,'PLAYING');calls.push(['track',type,index]);},
  suspend(){calls.push(['suspend']);},restoreAsync(url,time,prepare,callback){calls.push(['restore',url,time,prepare]);restored=callback;},stop(){calls.push(['stop']);state='IDLE';},
 };
 const driver=createAVPlayer(api,{url:'https://example.com/movie.m3u8',onEvent:(type,value)=>events.push(value===undefined?type:[type,value]),onTracks:(audio,text)=>{tracks.push(...audio);subtitles.push(...text);},...options});
 return {driver,calls,events,tracks,subtitles,ready:()=>ready(),seekDone:()=>seekDone(),restored:()=>restored(),listener:()=>listener};
}
test('AVPlay prepara antes de play, usa rectángulo Samsung y convierte ms a segundos',async()=>{
 const f=fixture({start:30});assert.equal(f.calls.some(c=>c[0]==='play'),false);f.ready();await Promise.resolve();
 assert.deepEqual(f.calls.find(c=>c[0]==='rect'),['rect',0,0,1920,1080]);assert.equal(f.driver.duration,120);
 assert.deepEqual(f.tracks,[{index:2,language:'es',codec:'AAC'}]);assert.deepEqual(f.subtitles,[{index:3,language:'en',codec:''}]);assert.deepEqual(f.calls.find(c=>c[0]==='seek'),['seek',30000]);
 f.seekDone();assert.equal(f.driver.currentTime,30);f.listener().oncurrentplaytime(35500);assert.equal(f.driver.currentTime,35.5);
});
test('seek serializado, acotado y sin inventar un buffer',async()=>{
 const f=fixture();f.ready();await Promise.resolve();f.driver.seek(50);f.driver.seek(500);
 assert.equal(f.calls.filter(c=>c[0]==='seek').length,1);f.seekDone();assert.equal(f.calls.filter(c=>c[0]==='seek').length,2);
 assert.deepEqual(f.calls.at(-1),['seek',119900]);f.seekDone();assert.equal(f.driver.currentTime,119.9);assert.equal(f.driver.buffered.length,0);
});
test('directo no expone avance sin ventana DVR conocida',async()=>{
 const f=fixture({live:true,start:60});f.ready();await Promise.resolve();f.driver.seek(20);
 assert.equal(f.driver.duration,Infinity);assert.equal(f.driver.seekable.length,0);assert.equal(f.calls.some(c=>c[0]==='seek'),false);
});
test('suspende/restaura y conserva pausa; no llama al decoder durante suspensión',async()=>{
 const f=fixture();f.ready();await Promise.resolve();f.driver.pause();f.driver.visibility(true);await f.driver.play();
 assert.equal(f.calls.filter(c=>c[0]==='play').length,1);f.driver.visibility(false);f.restored();assert.equal(f.driver.paused,true);
 await f.driver.play();assert.equal(f.driver.paused,false);assert.ok(f.events.includes('suspended'));
});
test('cierre durante preparación ignora callbacks tardíos y errores',async()=>{
 const f=fixture();f.driver.close();const count=f.events.length;f.ready();f.listener().onerror();await Promise.resolve();
 assert.equal(f.events.length,count);assert.equal(f.calls.some(c=>c[0]==='play'),false);f.driver.close();assert.equal(f.calls.filter(c=>c[0]==='close').length,1);
});
test('preparación oculta no reproduce en segundo plano y retoma historial/pistas al volver',async()=>{
 const f=fixture({start:30});f.driver.visibility(true);f.ready();await Promise.resolve();assert.equal(f.calls.some(c=>c[0]==='play'),false);
 f.driver.visibility(false);await Promise.resolve();assert.equal(f.driver.paused,false);assert.equal(f.tracks.length,1);assert.deepEqual(f.calls.find(c=>c[0]==='seek'),['seek',30000]);
});
test('selección de audio en pausa se aplica al reanudar en estado válido',async()=>{
 const f=fixture();f.ready();await Promise.resolve();f.driver.pause();f.driver.selectAudio(2);assert.equal(f.calls.some(c=>c[0]==='track'),false);
 await f.driver.play();assert.deepEqual(f.calls.find(c=>c[0]==='track'),['track','AUDIO',2]);
});
test('E1: subtítulos AVPlay: elegir pista y recibir el texto',async()=>{
 const f=fixture();f.ready();await Promise.resolve();f.driver.selectSubtitle(3);assert.deepEqual(f.calls.at(-1),['track','TEXT',3]);
 f.listener().onsubtitlechange(1500,'Hola');assert.deepEqual(f.events.at(-1),['subtitle',{text:'Hola',duration:1500}]);
});
test('un error transitorio no deja el decoder marcado como pausado si sigue reproduciendo',async()=>{
 const f=fixture();f.ready();await Promise.resolve();f.listener().oncurrentplaytime(1000);f.listener().onerror();assert.equal(f.driver.paused,true);f.listener().oncurrentplaytime(1500);assert.equal(f.driver.paused,false);f.driver.pause();assert.equal(f.driver.paused,true);assert.deepEqual(f.calls.at(-1),['pause']);
});
test('AVPlay live buffer callbacks preserve the decoder and pause intent',async()=>{
 const f=fixture({live:true});f.ready();await Promise.resolve();f.listener().oncurrentplaytime(1000);
 const baseline=f.calls.length;f.listener().onbufferingstart();f.listener().onbufferingcomplete();assert.deepEqual(f.events.slice(-2),['waiting','canplay']);assert.equal(f.driver.currentTime,1);assert.equal(f.calls.length,baseline);assert.equal(f.driver.paused,false);
 f.driver.pause();const pausedCalls=f.calls.length;f.listener().onbufferingstart();f.listener().onbufferingcomplete();f.listener().oncurrentplaytime(1000);assert.equal(f.calls.length,pausedCalls);assert.equal(f.driver.paused,true);
 await f.driver.play();f.listener().oncurrentplaytime(1500);assert.equal(f.driver.currentTime,1.5);assert.equal(f.driver.paused,false);assert.equal(f.calls.filter(call=>call[0]==='open').length,1);assert.equal(f.calls.filter(call=>call[0]==='prepare').length,1);assert.equal(f.calls.filter(call=>call[0]==='close').length,0);
});
test('mando registra solo teclas soportadas y conserva volumen de Samsung',()=>{
 const registered=[];registerRemote({getSupportedKeys:()=>[{name:'MediaPlayPause'},{name:'MediaPlay'},{name:'VolumeUp'}],registerKey:name=>registered.push(name)});
 assert.deepEqual(registered,['MediaPlay','MediaPlayPause']);assert.equal(remoteKeys[10009],'Escape');assert.equal(remoteKeys[10252],'MediaPlayPause');assert.equal(mediaKeyNames.some(k=>k.startsWith('Volume')),false);
});
