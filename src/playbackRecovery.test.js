import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaybackHealth,createHlsRecovery} from './playbackRecovery.js';

function fixture(options={}){
 let clock=0,position=0,seeking=false,id=0;
 const timers=new Map(),failures=[],healthy=[],waiting=[];
 const schedule=(callback,ms)=>{const key=++id;timers.set(key,{callback,at:clock+ms});return key;};
 const cancel=key=>timers.delete(key);
 const advance=ms=>{const end=clock+ms;while(true){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].callback();}clock=end;};
 const health=createPlaybackHealth({readPosition:()=>position,readSeeking:()=>seeking,onFailure:error=>failures.push(error),onHealthy:()=>healthy.push(clock),onWaiting:()=>waiting.push(clock),now:()=>clock,schedule,cancel,...options});
 return {health,failures,healthy,waiting,schedule,cancel,advance,now:()=>clock,setPosition:value=>position=value,setSeeking:value=>seeking=value};
}
function recoveryFixture(){
 const f=fixture(),calls=[];let mediaError=null,hlsPosition=42;
 const hls={loadingEnabled:false,loadSource:url=>calls.push(['manifest',url]),startLoad:(position,skipSeek)=>{calls.push(['start',position,skipSeek]);hls.loadingEnabled=true;},recoverMediaError:()=>{calls.push(['decoder']);hlsPosition=0;}};
 const recovery=createHlsRecovery({hls,health:f.health,url:'http://fixture/live.m3u8',live:true,readPosition:()=>hlsPosition,readMediaError:()=>mediaError,networkType:'network',mediaType:'media',schedule:f.schedule,cancel:f.cancel});
 return {...f,hls,calls,recovery,setMediaError:value=>mediaError=value,fatal:(type='network',details)=>{hls.loadingEnabled=false;recovery.error(null,{fatal:true,type,details});}};
}

test('advancing buffered video clears a transport fault, which cannot reappear on a later pause',()=>{
 const f=fixture();f.health.playing();f.health.fault('Unavailable');
 for(let i=1;i<=12;i++){f.setPosition(i);f.health.progress();f.advance(1000);}
 f.advance(20000);assert.equal(f.failures.length,0);assert.equal(f.healthy.length,2);
 f.health.waiting();f.advance(8000);assert.equal(f.failures.length,0);
 f.setPosition(13);assert.equal(f.health.progress(),true);f.advance(40000);assert.equal(f.failures.length,0);
});
test('a genuine unavailable source reports failure after six seconds; a seek is not proof of playback',()=>{
 const f=fixture();f.health.fault('Unavailable');f.advance(5999);assert.equal(f.failures.length,0);
 f.setSeeking(true);f.setPosition(50);assert.equal(f.health.progress(),false);f.setSeeking(false);f.health.reposition();f.advance(1);assert.deepEqual(f.failures,['Unavailable']);
 f.advance(60000);assert.equal(f.failures.length,1);
});
test('buffer waiting lasts through a transient outage and network completion cannot hide a stalled decoder',()=>{
 const f=fixture();f.health.waiting();f.advance(8000);f.health.networkRestored();assert.equal(f.failures.length,0);assert.equal(f.healthy.length,0);
 f.advance(21999);assert.equal(f.failures.length,0);f.advance(1);assert.equal(f.failures.length,1);
 f.health.networkRestored();assert.equal(f.healthy.length,0);f.setPosition(1);f.health.progress();assert.equal(f.healthy.length,1);f.advance(60000);assert.equal(f.failures.length,1);
});
test('repeated network symptoms do not extend a stopped playback deadline indefinitely',()=>{
 const f=fixture();f.health.waiting();for(let i=0;i<5;i++){f.advance(5000);f.health.fault('Unavailable',{recoverable:true});}
 f.advance(5000);assert.deepEqual(f.failures,['Unavailable']);assert.equal(f.health.canRecover(),false);
});
test('explicit pause, background suspension and closing cannot create delayed errors',()=>{
 const f=fixture();f.health.fault('Unavailable');f.health.pause();f.advance(20000);assert.equal(f.failures.length,0);f.health.resume();f.health.visibility(true);f.advance(20000);assert.equal(f.failures.length,0);f.health.visibility(false);f.advance(5999);assert.equal(f.failures.length,0);f.health.dispose();f.advance(20000);f.health.fault('Late');f.setPosition(1);assert.equal(f.health.progress(),false);assert.equal(f.failures.length,0);
});
test('actual playing clears a stale error and each playback wait notifies the UI only once on recovery',()=>{
 const f=fixture();f.health.fault('Unavailable');f.health.playing();f.advance(7000);assert.equal(f.failures.length,0);assert.equal(f.healthy.length,1);
 f.health.waiting();assert.equal(f.waiting.length,1);f.health.playing();assert.equal(f.healthy.length,2);f.setPosition(1);f.health.progress();assert.equal(f.healthy.length,2);
});
test('parsed live HLS retries use backoff and the current position without recreating the media source',()=>{
 const f=recoveryFixture();f.recovery.manifestParsed();f.health.waiting();
 for(const delay of [1000,2000,4000,8000]){const before=f.calls.length;f.fatal();f.advance(delay-1);assert.equal(f.calls.length,before);f.advance(1);assert.deepEqual(f.calls.at(-1),['start',42,true]);}
 f.fatal();f.advance(14000);assert.equal(f.calls.length,4);assert.equal(f.failures.length,0);f.advance(1000);assert.equal(f.failures.length,1);
 assert.equal(f.calls.some(call=>call[0]==='manifest'||call[0]==='decoder'),false);
});
test('an initial fatal manifest failure may retry before parsing, while ordinary HLS retries remain untouched',()=>{
 const f=recoveryFixture();f.recovery.error(null,{fatal:false,type:'network'});f.advance(1000);assert.deepEqual(f.calls,[]);
 f.fatal();f.advance(999);assert.deepEqual(f.calls,[]);f.advance(1);assert.deepEqual(f.calls,[['manifest','http://fixture/live.m3u8']]);
 f.recovery.manifestParsed();f.fatal();f.advance(2000);assert.deepEqual(f.calls.at(-1),['start',42,true]);f.recovery.dispose();f.health.dispose();
});
test('fatal HLS stalls and gaps with no actual media error never rebuild the decoder',()=>{
 for(const details of ['bufferStalledError','bufferSeekOverHole']){
  const f=recoveryFixture();f.recovery.manifestParsed();f.fatal('media',details);f.advance(1000);assert.deepEqual(f.calls,[['start',42,true]]);f.advance(7000);assert.equal(f.failures.length,0);
  f.setPosition(1);f.health.progress();f.advance(40000);assert.equal(f.failures.length,0);f.recovery.dispose();
 }
});
test('only a persistent real decode error receives one deferred decoder recovery',()=>{
 const f=recoveryFixture();f.recovery.manifestParsed();f.setMediaError({code:3});f.fatal('media','bufferAppendError');f.advance(1999);assert.deepEqual(f.calls,[]);f.advance(1);assert.deepEqual(f.calls,[['decoder'],['start',42,undefined]]);
 f.fatal('media','bufferAppendError');f.advance(3000);assert.equal(f.calls.filter(call=>call[0]==='decoder').length,1);
 const transient=recoveryFixture();transient.setMediaError({code:3});transient.fatal('media');transient.setMediaError(null);transient.setPosition(1);transient.health.progress();transient.advance(3000);assert.deepEqual(transient.calls,[]);
 const unsupported=recoveryFixture();unsupported.setMediaError({code:4});unsupported.fatal('media');unsupported.advance(6000);assert.deepEqual(unsupported.calls,[]);assert.equal(unsupported.failures.length,1);
});
test('buffer arrival confirms transport recovery but waits for real playback to clear its loader',()=>{
 const f=recoveryFixture();f.recovery.manifestParsed();f.health.waiting();f.fatal();f.advance(1000);f.recovery.buffered();f.advance(8000);assert.equal(f.healthy.length,0);assert.equal(f.failures.length,0);
 f.setPosition(1);f.health.progress();assert.equal(f.healthy.length,1);f.fatal();f.advance(1000);assert.equal(f.calls.length,2,'Confirmed segment loading resets consecutive retry backoff');
});
test('a segment appended during a fatal stall cannot hide failure without actual playback, even without waiting',()=>{
 const f=recoveryFixture();f.recovery.manifestParsed();f.fatal('media','bufferStalledError');f.advance(1000);f.recovery.buffered();assert.equal(f.healthy.length,0);f.advance(29000);assert.equal(f.failures.length,1);
});
test('pause and background cancel scheduled retries, while resume recovers without autoplay',()=>{
 const f=recoveryFixture();f.recovery.manifestParsed();f.fatal();f.health.pause();f.advance(10000);assert.deepEqual(f.calls,[]);f.health.resume();f.advance(1000);assert.deepEqual(f.calls,[['start',42,true]]);
 f.fatal();f.health.visibility(true);f.advance(10000);assert.equal(f.calls.length,1);f.health.visibility(false);f.advance(2000);assert.equal(f.calls.length,2);f.fatal();f.recovery.dispose();f.health.dispose();f.advance(40000);assert.equal(f.calls.length,2);assert.equal(f.failures.length,0);
});
test('terminal failure cancels pending retries so later progress cannot fire a stale action',()=>{
 const f=recoveryFixture();f.recovery.manifestParsed();f.fatal();f.health.fault('Decoder unavailable');f.advance(1000);f.fatal();f.advance(2000);f.fatal();f.advance(3000);assert.equal(f.failures.length,1);
 f.setPosition(1);f.health.progress();f.advance(20000);assert.equal(f.calls.length,2);
});

