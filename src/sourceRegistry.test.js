import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceRegistry} from './sourceRegistry.js';
import {accountKey} from './xtream.js';
import {fixtureResponse} from '../scripts/xtream-fixture.mjs';
const preset={name:'eterboxtv',host:'https://primary.test',username:'first',password:'one'};
test('persisted scores load in bulk without fetching details and stay isolated by login and metadata token',async()=>{
 const ratings=new Map();let token='x'.repeat(30),detailFetches=0;
 const state=setup(null,{metadataToken:async()=>token,readRatings:async keys=>Object.fromEntries(keys.filter(key=>ratings.has(key)).map(key=>[key,ratings.get(key)])),writeRating:async(key,data)=>{ratings.set(key,data);},fetcher:async address=>{
  const url=new URL(address);if(url.hostname==='api.themoviedb.org')return new Response(JSON.stringify({title:'Fixture Movie',vote_average:8.4,vote_count:750}));
  const data=fixtureResponse(address);if(url.searchParams.get('action')==='get_vod_info'){detailFetches++;data.info.tmdb_id=42;}return new Response(JSON.stringify(data));
 }});
 const first=state.create();await first.catalogue();await first.details('23');assert.equal(ratings.size,1);const resumed=state.create(),catalogue=await resumed.catalogue(),scores=await resumed.cachedRatings();assert.equal(scores[catalogue.movies[0].id].tmdbScore,8.4);assert.equal(detailFetches,1);
 token='z'.repeat(30);assert.deepEqual(await resumed.cachedRatings(),{});token='x'.repeat(30);await resumed.save({...preset,username:'changed'});assert.deepEqual(await resumed.cachedRatings(),{});assert.equal(detailFetches,1);
});
function setup(stored=null,overrides={}){let saved=stored;const cache=new Map(),calls=[];let offline=false;
 const options={preset,readAccounts:async()=>saved,writeAccounts:async list=>{saved=structuredClone(list);},readCache:async account=>cache.get(account.sourceId),writeCache:async(account,data)=>cache.set(account.sourceId,data),fetcher:async address=>{const url=new URL(address);calls.push(url);if(offline&&url.hostname==='secondary.test')throw Error('offline');const data=fixtureResponse(address);if(url.searchParams.get('action')==='get_vod_info')data.info.plot=url.hostname;return new Response(JSON.stringify(data));},...overrides};
 return {create:()=>createSourceRegistry(options),saved:()=>saved,calls,offline:()=>{offline=true;}};
}
test('a clean install seeds the principal without login or network and preserves saved edits',async()=>{
 const state=setup(),manager=state.create();const status=await manager.status();assert.equal(status.configured,true);assert.equal(status.sources[0].id,'eterboxtv');assert.equal(status.sources[0].pinned,true);assert.equal(state.calls.length,0);assert.equal(state.saved().length,1);assert.ok(!JSON.stringify(status).includes('password'));
 await manager.save({...preset,username:'edited'});assert.equal(state.saved()[0].username,'edited');await state.create().status();assert.equal(state.saved()[0].username,'edited');await manager.restore();assert.equal(state.saved()[0].username,'first');
});
test('additional sources coexist and overlapping stream IDs route metadata, episodes and playback correctly',async()=>{
 const state=setup(),manager=state.create();await manager.save({sourceId:'',name:'Otra fuente',host:'https://secondary.test',username:'second',password:'two'});
 const data=await manager.catalogue();assert.deepEqual([data.channels.length,data.movies.length,data.shows.length],[2,2,2]);assert.equal(data.sources.length,2);assert.notEqual(data.movies[0].id,data.movies[1].id);assert.equal(data.connection.sources[0].pinned,true);assert.ok(!JSON.stringify(data).includes('password='));
 const secondary=data.movies[1];assert.equal((await manager.details(secondary.streamId,'movie',secondary.sourceId)).description,'secondary.test');assert.equal((await manager.details(data.movies[0].streamId,'movie','eterboxtv')).description,'primary.test');
 assert.match(await manager.playback(secondary),/^https:\/\/secondary.test\/movie\/second\/two\/23.mp4$/);
 const episodes=await manager.episodes('34',secondary.sourceId);assert.equal(episodes[0].episodes[0].sourceId,secondary.sourceId);assert.match(await manager.playback(episodes[0].episodes[0]),/secondary.test\/series\/second\/two\/88.mp4$/);
 await assert.rejects(manager.playback({...secondary,sourceId:'eterboxtv'}),/no pertenece/);await assert.rejects(manager.remove('eterboxtv'),/principal/);await manager.remove(secondary.sourceId);assert.equal((await manager.status()).sources.length,1);await assert.rejects(manager.playback(secondary),/disponible/);
});
test('source failures keep the principal and cached titles, and duplicates are rejected',async()=>{
 const state=setup(),manager=state.create();await manager.save({sourceId:'',name:'Otra',host:'https://secondary.test',username:'second',password:'two'});await manager.catalogue();
 await assert.rejects(manager.save({...preset,sourceId:''}),/ya está agregada/);state.offline();const data=await manager.catalogue(true);assert.equal(data.movies.length,2);assert.equal(data.sources[0].error,undefined);assert.ok(data.sources[1].error);assert.equal(data.sources[0].pinned,true);assert.equal(data.movies[1].catalogueUpdatedAt,data.updatedAt);
});
test('restoring the principal cannot duplicate an existing additional connection',async()=>{
 const state=setup(),manager=state.create();await manager.save({...preset,username:'edited'});await manager.save({...preset,sourceId:''});await assert.rejects(manager.restore(),/ya está agregada/);assert.equal((await manager.catalogue()).movies.length,2);assert.equal(state.saved()[0].username,'edited');
});

test('episode navigation shares concurrent requests, reuses a bounded cache, expires and invalidates after login edits',async()=>{
 let time=1000;const state=setup(null,{now:()=>time}),manager=state.create();
 const [first,second]=await Promise.all([manager.episodes('34','eterboxtv'),manager.episodes('34','eterboxtv')]);assert.equal(first,second);
 const count=()=>state.calls.filter(url=>url.searchParams.get('action')==='get_series_info').length;
 assert.equal(count(),1);await manager.episodes('34','eterboxtv');assert.equal(count(),1);
 time+=30*60*1000+1;await manager.episodes('34','eterboxtv');assert.equal(count(),2);
 for(let id=35;id<43;id++)await manager.episodes(String(id),'eterboxtv');await manager.episodes('34','eterboxtv');assert.equal(count(),11,'Evicted series can be loaded again');
 await manager.save({...preset,username:'edited'});await manager.episodes('34','eterboxtv');assert.equal(count(),12);assert.equal(state.calls.at(-1).searchParams.get('username'),'edited');
});

test('failed episode loads do not poison retry or a different source with the same series ID',async()=>{
 let attempts=0;const state=setup(null,{fetcher:async address=>{const url=new URL(address);if(url.searchParams.get('action')==='get_series_info'&&++attempts===1)throw Error('offline');return new Response(JSON.stringify(fixtureResponse(address)));}}),manager=state.create();
 await assert.rejects(manager.episodes('34','eterboxtv'),/conectar/);assert.equal((await manager.episodes('34','eterboxtv'))[0].episodes[0].sourceId,'eterboxtv');assert.equal(attempts,2);
 await manager.save({sourceId:'',name:'Otra',host:'https://secondary.test',username:'second',password:'two'});const secondary=(await manager.status()).sources[1];const data=await manager.episodes('34',secondary.id);assert.equal(attempts,3);assert.equal(data[0].episodes[0].sourceId,secondary.id);
});

test('a stalled catalogue is cancelled as a whole before keeping the app in a loading state',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});let aborts=0;
 const manager=createSourceRegistry({preset,readAccounts:async()=>null,writeAccounts:async()=>{},readCache:async()=>null,writeCache:async()=>{},fetcher:async(_url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborts++;reject(Error('offline'));},{once:true});})});
 const work=manager.catalogue();for(let i=0;i<8;i++)await Promise.resolve();context.mock.timers.tick(18000);const catalogue=await work;assert.equal(aborts,1);assert.equal(catalogue.channels.length,0);assert.ok(catalogue.sources[0].error);context.mock.timers.reset();
});
test('an expired cache is returned immediately and explicitly marked for background refresh',async()=>{
 let now=Date.now();const state=setup(null,{catalogueTTL:1000,now:()=>now});const first=await state.create().catalogue();now=Date.parse(first.updatedAt)+1001;const calls=state.calls.length,manager=state.create(),cached=await manager.catalogue();
 assert.equal(state.calls.length,calls);assert.equal(cached.needsRefresh,true);assert.equal(cached.sources[0].stale,true);assert.equal(cached.movies[0].id,first.movies[0].id);
 const fresh=await manager.catalogue(true);assert.ok(state.calls.length>calls);assert.equal(fresh.needsRefresh,false);assert.equal(fresh.sources[0].stale,undefined);
});
test('a complete provider response stays available if saving its cache fails',async()=>{
 const state=setup(null,{writeCache:async()=>{throw Error('quota');}}),data=await state.create().catalogue();assert.equal(data.channels.length,1);assert.equal(data.movies.length,1);assert.equal(data.sources[0].error,undefined);
});
test('metadata-v4 ignores obsolete detail entries and reuses the new generation without changing sources or catalogues',async()=>{
 const token='x'.repeat(30),stored=[{...preset,sourceId:'eterboxtv'}],baseKey='eterboxtv:'+accountKey(preset)+':movie:23',tokenKey=accountKey({host:'metadata',username:token});
 const legacyKey=baseKey+':metadata-v3:'+tokenKey,currentKey=baseKey+':metadata-v4:'+tokenKey,cache=new Map([[legacyKey,{description:'Old Spanish-only cache'}]]);
 let fetches=0,accountWrites=0,catalogueReads=0,catalogueWrites=0;
 const state=setup(stored,{metadataToken:async()=>token,readDetails:async key=>cache.get(key),writeDetails:async(key,data)=>{cache.set(key,data);},
  writeAccounts:async()=>{accountWrites++;},readCache:async()=>{catalogueReads++;},writeCache:async()=>{catalogueWrites++;},
  fetcher:async address=>{fetches++;const url=new URL(address);return new Response(JSON.stringify(url.hostname==='api.themoviedb.org'?{title:'Título español',overview:'Sinopsis nueva',videos:{results:[{site:'YouTube',type:'Trailer',key:'ENtrailer01',official:true,iso_639_1:'en'}]}}:{info:{tmdb_id:123}}));},
 });
 const details=await state.create().details('23');assert.equal(details.trailerId,'ENtrailer01');assert.equal(details.description,'Sinopsis nueva');assert.equal(fetches,2);assert.deepEqual(cache.get(currentKey),details);
 assert.equal(cache.get(legacyKey).description,'Old Spanish-only cache');
 assert.deepEqual(await state.create().details('23'),details);assert.equal(fetches,2);
 assert.equal(accountWrites,0);assert.equal(catalogueReads,0);assert.equal(catalogueWrites,0);assert.deepEqual(state.saved(),stored);
});
test('multiple stalled sources share one catalogue time budget rather than waiting in series',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});let requests=0;
 const list=[{...preset,sourceId:'eterboxtv'},{...preset,host:'https://second.test',sourceId:'second'},{...preset,host:'https://third.test',sourceId:'third'}];
 const manager=createSourceRegistry({preset,readAccounts:async()=>list,writeAccounts:async()=>{},readCache:async()=>null,writeCache:async()=>{},fetcher:async()=>{requests++;return new Promise(()=>{});}});
 const work=manager.catalogue();for(let i=0;i<15;i++)await Promise.resolve();assert.equal(requests,2);context.mock.timers.tick(18000);const data=await work;assert.equal(requests,2);assert.equal(data.sources.length,3);assert.equal(data.sources.filter(source=>source.error).length,3);context.mock.timers.reset();
});
