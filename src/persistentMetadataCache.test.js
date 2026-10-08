import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersistentMetadataCache,previewMetadataCacheOptions} from './persistentMetadataCache.js';
test('bulk scores survive restart and expire without issuing network requests',async()=>{
 let saved,now=1000,reads=0;const options={read:async()=>{reads++;return saved;},write:async data=>{saved=structuredClone(data);},capacity:5000,ttl:100,now:()=>now};
 const first=createPersistentMetadataCache(options);for(let i=0;i<150;i++)await first.put('score-'+i,{tmdbScore:8.2,tmdbVotes:200+i});await first.flush();
 const restarted=createPersistentMetadataCache(options);const keys=Array.from({length:150},(_,i)=>'score-'+i);assert.equal(Object.keys(await restarted.getMany(keys)).length,150);assert.equal(reads,2);assert.equal((await restarted.getMany(['score-149','missing']))['score-149'].tmdbVotes,349);assert.equal(reads,2);
 now+=101;assert.deepEqual(await restarted.getMany(keys),{});
});
test('Spanish synopses, translated titles and preview URLs survive restart for thirty days, with a bounded byte budget',async()=>{
 let saved,now=1000;const options={...previewMetadataCacheOptions,read:async()=>saved,write:async value=>saved=structuredClone(value),now:()=>now};const cache=createPersistentMetadataCache(options),data={description:'Sinopsis en español',descriptionLanguage:'es',localizedTitle:'Título traducido',backdropImage:'https://image.tmdb.org/t/p/original/a.jpg',trailerId:'abcdefghijk'};
 for(let i=0;i<200;i++)await cache.put('title-'+i,data);await cache.flush();now+=8*86400000;const restarted=createPersistentMetadataCache(options);assert.deepEqual(await restarted.get('title-0'),data);assert.equal(restarted.stats().entries,200);now+=23*86400000;assert.equal(await restarted.get('title-0'),null);
 const bounded=createPersistentMetadataCache({...options,maxBytes:500});await bounded.put('a',data);await bounded.put('b',data);await bounded.get('a');await bounded.put('c',data);assert.equal(await bounded.get('b'),null);assert.ok(bounded.stats().bytes<=500);await bounded.flush();
});
test('missing translations and transient empty responses use shorter cache lifetimes',async()=>{
 let now=1000;const cache=createPersistentMetadataCache({...previewMetadataCacheOptions,read:async()=>null,write:async()=>{},now:()=>now});await cache.put('empty',{});await cache.put('provider',{description:'Provider synopsis'});now+=6*60000;assert.equal(await cache.get('empty'),null);assert.equal((await cache.get('provider')).description,'Provider synopsis');now+=8*86400000;assert.equal(await cache.get('provider'),null);await cache.flush();
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
test('TMDB seasons stay 30 days in the preview cache',async()=>{
 let now=1000;const cache=createPersistentMetadataCache({...previewMetadataCacheOptions,read:async()=>null,write:async()=>{},now:()=>now});
 await cache.put('season:1396:1',{seasonEpisodes:[{episode_number:1,name:'Piloto'}]});now+=29*86400000;
 assert.equal((await cache.get('season:1396:1')).seasonEpisodes[0].name,'Piloto');now+=2*86400000;assert.equal(await cache.get('season:1396:1'),null);
});
