import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkCacheClient} from './artworkCacheClient.js';
const src='https://image.tmdb.org/t/p/w780/test.jpg';
function fixture(){const listeners={},messages=[],created=[],revoked=[];const cache=createArtworkCacheClient({createWorker:()=>({addEventListener:(name,fn)=>listeners[name]=fn,postMessage:message=>messages.push(message),terminate(){}}),urls:{createObjectURL:()=>{const value='blob:fixture-'+created.length;created.push(value);return value;},revokeObjectURL:value=>revoked.push(value)}});return {cache,messages,created,revoked,respond:(id,value)=>listeners.message({data:{id,value}})};}
test('simultaneous image consumers share one blob URL that outlives the last DOM consumer (R4.3)',async()=>{
 const {cache,messages,created,revoked,respond}=fixture(),a=cache.acquire(src),b=cache.acquire(src);assert.equal(messages.length,1);respond(messages[0].id,new Blob(['image']));assert.equal(await a.ready,await b.ready);assert.equal(created.length,1);a.release();a.release();b.release();assert.equal(revoked.length,0);assert.deepEqual(cache.diagnostics(),{activeImages:0,blobUrls:1,pending:0,disabled:false});
 // Re-entering the window: same URL, synchronously, no storage read, no new blob.
 assert.equal(cache.peek(src),created[0]);const again=cache.acquire(src);assert.equal(await again.ready,created[0]);assert.equal(messages.length,1);assert.equal(created.length,1);again.release();
 cache.forget(src);assert.deepEqual(revoked,created);assert.equal(cache.peek(src),null);cache.dispose();
});
test('the blob registry keeps the most recently used URLs and never revokes one on screen',async()=>{
 const listeners={},messages=[],revoked=[];let n=0;const cache=createArtworkCacheClient({retain:2,createWorker:()=>({addEventListener:(name,fn)=>listeners[name]=fn,postMessage:message=>messages.push(message),terminate(){}}),urls:{createObjectURL:()=>'blob:'+n++,revokeObjectURL:value=>revoked.push(value)}});
 const open=async name=>{const handle=cache.acquire(`https://image.tmdb.org/t/p/w342/${name}.jpg`);listeners.message({data:{id:messages.at(-1).id,value:new Blob([name])}});await handle.ready;return handle;};
 const a=await open('a'),b=await open('b');a.release();b.release();
 cache.acquire('https://image.tmdb.org/t/p/w342/a.jpg').release();// a becomes most recent
 const c=await open('c');assert.deepEqual(revoked,['blob:1'],'b was least recently used');
 const d=await open('d');assert.deepEqual(revoked,['blob:1','blob:0'],'a evicted; c and d are on screen');
 assert.equal(cache.diagnostics().blobUrls,2);c.release();d.release();assert.equal(revoked.length,2);cache.dispose();
});
test('a poster this session already decoded starts from that URL on the first frame',async()=>{
 const {initialArtwork}=await import('./useCachedArtwork.js'),http='https://image.tmdb.org/t/p/w342/p.jpg';
 assert.equal(initialArtwork(http,{peek:()=>'blob:x'},new Map()),'blob:x');
 assert.equal(initialArtwork(http,{peek:()=>null},new Map([[http,1]])),http);
 assert.equal(initialArtwork(http,{peek:()=>null},new Map()),null);
});
test('late storage replies never allocate a blob URL after a component unmounts or falls back to network',async()=>{
 const {cache,messages,created,respond}=fixture(),image=cache.acquire(src);image.release();respond(messages[0].id,new Blob(['image']));assert.equal(await image.ready,null);assert.equal(created.length,0);cache.dispose();
});
test('missing worker support resolves to ordinary loading and does not retain image handles',async()=>{
 const cache=createArtworkCacheClient({createWorker:()=>{throw Error('Unsupported');}}),image=cache.acquire(src);assert.equal(await image.ready,null);image.release();assert.equal(cache.diagnostics().activeImages,0);assert.equal(cache.diagnostics().disabled,true);cache.dispose();
});
