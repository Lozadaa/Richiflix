import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersistentMetadataCache} from './persistentMetadataCache.js';
test('bulk scores survive restart and expire without issuing network requests',async()=>{
 let saved,now=1000,reads=0;const options={read:async()=>{reads++;return saved;},write:async data=>{saved=structuredClone(data);},capacity:5000,ttl:100,now:()=>now};
 const first=createPersistentMetadataCache(options);for(let i=0;i<150;i++)await first.put('score-'+i,{tmdbScore:8.2,tmdbVotes:200+i});await first.flush();
 const restarted=createPersistentMetadataCache(options);const keys=Array.from({length:150},(_,i)=>'score-'+i);assert.equal(Object.keys(await restarted.getMany(keys)).length,150);assert.equal(reads,2);assert.equal((await restarted.getMany(['score-149','missing']))['score-149'].tmdbVotes,349);assert.equal(reads,2);
 now+=101;assert.deepEqual(await restarted.getMany(keys),{});
});
test('persisted metadata validates entries, expires old details and obeys the LRU limit',async()=>{
 let now=100,saved;const cache=createPersistentMetadataCache({read:async()=>[['old',{data:0,updatedAt:1}],null,['valid',{data:1,updatedAt:90}],['future',{data:2,updatedAt:999999}]],write:async data=>{saved=data;},capacity:2,ttl:50,now:()=>now});
 assert.equal(await cache.get('old'),null);assert.equal(await cache.get('valid'),1);assert.equal(await cache.get('future'),null);await cache.put('a',3);await cache.get('valid');await cache.put('b',4);assert.equal(await cache.get('a'),null);await cache.flush();assert.equal(saved.length,2);now=151;assert.equal(await cache.get('valid'),null);
});
test('a flush includes changes that arrive while an earlier write is pending',async()=>{
 let release,first=true;const writes=[];const cache=createPersistentMetadataCache({read:async()=>null,write:async values=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}writes.push(values);},now:()=>100});
 await cache.put('a',1);const work=cache.flush();for(let i=0;i<10;i++)await Promise.resolve();await cache.put('b',2);const last=cache.flush();release();await Promise.all([work,last]);assert.deepEqual(writes.at(-1).map(([key])=>key),['a','b']);
});
test('an unavailable cache store does not keep retrying in the background',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});let writes=0;const cache=createPersistentMetadataCache({read:async()=>null,write:async()=>{writes++;throw Error('quota');}});await cache.put('a',1);await cache.flush();context.mock.timers.tick(10000);for(let i=0;i<10;i++)await Promise.resolve();assert.equal(writes,1);context.mock.timers.reset();
});
