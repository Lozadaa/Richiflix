import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewCache} from './previewCache.js';
const item=id=>({mediaType:'movie',streamId:id});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('previews deduplicate pending requests, bound concurrency and prioritize selection',async()=>{
 const started=[],finish=new Map();let active=0,max=0;
 const cache=createPreviewCache(value=>{started.push(value.streamId);max=Math.max(max,++active);return new Promise(resolve=>finish.set(value.streamId,()=>{active--;resolve(value.streamId);}));},{concurrency:2,capacity:1});
 const first=cache.get(item(1)),second=cache.get(item(2)),third=cache.get(item(3)),fourth=cache.get(item(4));
 assert.equal(cache.get(item(1)),first);assert.equal(cache.get(item(4),true),fourth);
 await tick();assert.deepEqual(started,[1,2]);finish.get(1)();await first;await tick();assert.deepEqual(started,[1,2,4]);
 finish.get(2)();await second;await tick();finish.get(4)();finish.get(3)();await Promise.all([third,fourth]);assert.equal(max,2);cache.dispose();
});
test('previews keep recent completed data and retry failed requests',async()=>{
 let calls=0;const cache=createPreviewCache(async value=>{calls++;if(value.streamId===9&&calls===1)throw Error('offline');return value.streamId;},{capacity:2});
 await assert.rejects(cache.get(item(9)));assert.equal(await cache.get(item(9)),9);await tick();
 await cache.get(item(1));await tick();await cache.get(item(9));await cache.get(item(2));await tick();
 const before=calls;await cache.get(item(9));assert.equal(calls,before);await cache.get(item(1));assert.equal(calls,before+1);cache.dispose();
});
test('closing preview cache cancels queued work without starting more requests',async()=>{
 let finish,calls=0;const cache=createPreviewCache(()=>{calls++;return new Promise(resolve=>{finish=resolve;});},{concurrency:1});
 const first=cache.get(item(1)),queued=cache.get(item(2)),rejected=assert.rejects(queued,/Vista cerrada/);await tick();cache.dispose();await rejected;
 finish('done');await first;await tick();assert.equal(calls,1);assert.equal(cache.disposed,true);await assert.rejects(cache.get(item(3)),/Vista cerrada/);
});

test('rapid browsing drops old queued previews instead of downloading every skipped title',async()=>{
 const started=[],finished=new Map(),cache=createPreviewCache(value=>{started.push(value.streamId);return new Promise(resolve=>finished.set(value.streamId,resolve));},{concurrency:1,queueLimit:2});
 const first=cache.get(item(1));await tick();const skipped=cache.get(item(2));const gone=assert.rejects(skipped,/reemplazada/);const third=cache.get(item(3));const fourth=cache.get(item(4),true);await gone;
 finished.get(1)(1);await first;await tick();assert.deepEqual(started,[1,4]);finished.get(4)(4);await fourth;await tick();finished.get(3)(3);await third;cache.dispose();
});
