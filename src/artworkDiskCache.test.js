import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheableArtwork,createArtworkDiskCache,artworkCacheLimits} from './artworkDiskCache.js';
const url=id=>`https://image.tmdb.org/t/p/w780/${id}.jpg`;
function fixture(){const index=new Map(),payload=new Map();return {index,payload,store:{list:async()=>[...index.values()],get:async key=>payload.get(key),put:async(entry,blob)=>{index.set(entry.key,structuredClone(entry));payload.set(entry.key,blob);},remove:async keys=>{for(const key of keys){index.delete(key);payload.delete(key);}},touch:async entry=>index.set(entry.key,structuredClone(entry))}};}
const response=(size=16,type='image/jpeg')=>new Response(new Uint8Array(size),{headers:{'content-type':type}});
test('cached compressed artwork survives restart and reuses disk without network or bulk blob reads',async()=>{
 const {store}=fixture();let now=1000,calls=0;const options={store,now:()=>now,fetcher:async()=>{calls++;return response();}},first=createArtworkDiskCache(options);
 assert.equal(await first.get(url('a')),null);assert.equal(await first.remember(url('a')),true);const restarted=createArtworkDiskCache(options);assert.equal((await restarted.get(url('a'))).size,16);assert.equal(calls,1);assert.equal(restarted.stats().hits,1);now+=artworkCacheLimits.ttl+1;assert.equal(await restarted.get(url('a')),null);assert.equal(await restarted.remember(url('a')),true);assert.equal(calls,2);
});
test('LRU byte and entry budgets evict oldest artwork and expired records',async()=>{
 const {store,index}=fixture();let now=1000;const cache=createArtworkDiskCache({store,now:()=>now,limits:{...artworkCacheLimits,maxBytes:32,maxEntries:2},fetcher:async()=>response()});
 await cache.remember(url('a'));now++;await cache.remember(url('b'));now++;await cache.get(url('a'));now++;await cache.remember(url('c'));assert.deepEqual([...index.keys()].sort(),[url('a'),url('c')]);assert.equal(cache.stats().bytes,32);assert.equal(await cache.get(url('b')),null);
});
test('quota pressure shrinks the budget, retries once and then pauses writes while cached reads still work',async()=>{
 const {store}=fixture();let puts=0,now=1;const original=store.put;store.put=async(...args)=>{puts++;if(puts>2)throw new DOMException('Full','QuotaExceededError');return original(...args);};
 const cache=createArtworkDiskCache({store,now:()=>now,estimate:async()=>({quota:1000,usage:800}),fetcher:async()=>response()});assert.equal(await cache.remember(url('a')),true);assert.equal(cache.stats().budget,50);now++;assert.equal(await cache.remember(url('b')),true);now++;assert.equal(await cache.remember(url('c')),false);assert.equal(puts,4);assert.equal(cache.stats().writePaused,true);assert.equal((await cache.get(url('b'))).size,16);assert.equal(await cache.remember(url('d')),false);assert.equal(puts,4);
});
test('only immutable public TMDB images are persisted; HTML and oversized streamed images are rejected',async()=>{
 assert.equal(cacheableArtwork('http://image.tmdb.org/t/p/w780/a.jpg'),null);assert.equal(cacheableArtwork(url('a')+'?token=private'),null);assert.equal(cacheableArtwork('https://provider.test/a.jpg'),null);assert.equal(cacheableArtwork('https://api.themoviedb.org/3/movie/1'),null);
 const {store}=fixture();let type='text/html',size=16,calls=0;const cache=createArtworkDiskCache({store,limits:{...artworkCacheLimits,maxImageBytes:10},fetcher:async()=>{calls++;return response(size,type);}});assert.equal(await cache.remember(url('a')),false);type='image/jpeg';assert.equal(await cache.remember(url('a')),false);size=8;assert.equal(await cache.remember(url('a')),true);assert.equal(cache.stats().bytes,8);assert.equal(await cache.remember('https://provider.test/a.jpg'),false);assert.equal(calls,3);
});
test('concurrent requests share downloads, cap network concurrency and drop excessive background work',async()=>{
 const {store}=fixture(),releases=[];let running=0,max=0,calls=0;const cache=createArtworkDiskCache({store,queueLimit:2,fetcher:async()=>{calls++;running++;max=Math.max(max,running);await new Promise(resolve=>releases.push(()=>{running--;resolve();}));return response();}});
 const a=cache.remember(url('a'));assert.equal(cache.remember(url('a')),a);const b=cache.remember(url('b')),c=cache.remember(url('c')),d=cache.remember(url('d')),e=cache.remember(url('e'));assert.equal(await c,false);
 for(let i=0;i<100;i++)await Promise.resolve();assert.equal(calls,2);for(const release of releases.splice(0))release();await Promise.all([a,b]);for(let i=0;i<100;i++)await Promise.resolve();for(const release of releases.splice(0))release();await Promise.all([d,e]);assert.equal(max,2);assert.equal(cache.stats().queued,0);
});
test('unavailable storage does not prevent direct image rendering or trigger repeated downloads',async()=>{
 let calls=0;const cache=createArtworkDiskCache({store:{list:async()=>{throw Error('Unavailable');}},fetcher:async()=>{calls++;return response();}});assert.equal(await cache.get(url('a')),null);assert.equal(await cache.remember(url('a')),false);assert.equal(await cache.remember(url('b')),false);assert.equal(calls,0);assert.equal(cache.stats().disabled,true);
});
test('Fase G: 400 entries / 64 MB only when the quota allows it',async()=>{
 assert.equal(artworkCacheLimits.maxEntries,400);
 const roomy=createArtworkDiskCache({store:fixture().store,estimate:async()=>({quota:10*1024**3,usage:0}),fetcher:async()=>response()});await roomy.warm();assert.equal(roomy.stats().budget,64*1024*1024);
 const tight=createArtworkDiskCache({store:fixture().store,estimate:async()=>({quota:100*1024*1024,usage:0}),fetcher:async()=>response()});await tight.warm();assert.equal(tight.stats().budget,10*1024*1024);
});
test('R4.7: the TV banner size (w1280) is cacheable like posters',()=>{
 assert.equal(cacheableArtwork('https://image.tmdb.org/t/p/w1280/art.jpg'),'https://image.tmdb.org/t/p/w1280/art.jpg');
});
