import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogueIndex,primeCatalogueGroups} from './catalogueIndex.js';
import {createCatalogueWorkerClient} from './catalogueWorkerClient.js';
import {createCatalogueWorkerService} from './catalogueWorker.js';
import {prepareCatalogueGroups} from './channelPreparation.js';
const movies=Array.from({length:5000},(_,i)=>({id:String(i),title:`Película ${i}`,genre:i%2?'Comedia':'Drama',source:'Fuente'}));
test('batched search matches the indexed filter and reuses the cached result',async()=>{
 const index=createCatalogueIndex(movies),result=await index.search(movies,'película 42',{batchSize:500});
 assert.deepEqual(result,index.filter(movies,'película 42'));
 assert.equal(await index.search(movies,'película 42'),result);
});
test('discarding a query stops its remaining batches without caching partial results',async()=>{
 const index=createCatalogueIndex(movies),controller=new AbortController();
 const work=index.search(movies,'película',{batchSize:100,signal:controller.signal});controller.abort();
 await assert.rejects(work,{name:'AbortError'});
 assert.equal((await index.search(movies,'película')).length,5000);
});

function indexedClient({maxSearchGroups=8,beforeRequest=async()=>{}}={}){
 const calls=[],service=createCatalogueWorkerService({maxSearchGroups,backendFactory:()=>{throw Error('Searching must not open the source backend.');}});
 const client=createCatalogueWorkerClient({createWorker:()=>{throw Error('Test the cooperative worker API without a browser.');},fallbackFactory:()=>({async request(method,args,options){calls.push({method,args,signal:options.signal});await beforeRequest(method,args,options);return service.request(method,args,options);}})});
 return {client,calls};
}

test('injected worker client registers lean records once for concurrent and repeated queries',async()=>{
 const items=[{id:'one',title:'Película azul',genre:'Drama',source:'Fuente',image:'https://example.test/poster.jpg',description:'A large description outside the search index.',url:'https://example.test/video'},{id:'two',title:'Película roja',genre:'Comedia',genres:['Comedia','Drama'],source:'Otra'}];
 const {client,calls}=indexedClient();
 try{
  const index=createCatalogueIndex(items,{workerClient:client}),[blue,red]=await Promise.all([index.search(items,'AZUL'),index.search(items,'roja',{category:'Comedia'})]);
  assert.deepEqual(blue,[items[0]]);assert.deepEqual(red,[items[1]]);assert.equal(blue[0],items[0]);
  const registrations=calls.filter(call=>call.method==='indexSearch');assert.equal(registrations.length,1);
  assert.deepEqual(Object.keys(registrations[0].args[1][0]).sort(),['clean','genre','genres','id','source','title']);
  assert.notEqual(registrations[0].args[1][0],items[0]);
  assert.equal(await index.search(items,'azul'),blue);assert.equal(await index.search(items,'ROJA',{category:'Comedia'}),red);
  assert.deepEqual(await index.search(items,'fuente'),[items[0]]);assert.equal(calls.filter(call=>call.method==='indexSearch').length,1);assert.equal(calls.filter(call=>call.method==='search').length,3);
  assert.equal(client.diagnostics().pending,0);
 }finally{client.dispose();}
});

test('replacing a query during shared registration cannot cancel the next query or cache partial results',async()=>{
 let notifyStarted,release;const started=new Promise(resolve=>{notifyStarted=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const items=Array.from({length:500},(_,position)=>({id:String(position),title:position%2?'Película roja':'Película azul',genre:'Drama'}));
 const {client,calls}=indexedClient({beforeRequest:async method=>{if(method==='indexSearch'){notifyStarted();await gate;}}}),controller=new AbortController();
 try{
  const index=createCatalogueIndex(items,{workerClient:client}),old=index.search(items,'azul',{signal:controller.signal}),rejected=assert.rejects(old,{name:'AbortError'});
  await started;controller.abort();const replacement=index.search(items,'roja');release();
  await rejected;assert.deepEqual(await replacement,items.filter((_item,position)=>position%2));
  const registrations=calls.filter(call=>call.method==='indexSearch');assert.equal(registrations.length,1);assert.equal(registrations[0].signal.aborted,false);
  assert.equal(calls.filter(call=>call.method==='search').length,1,'The cancelled query must never reach worker search.');
  assert.deepEqual(await index.search(items,'azul'),items.filter((_item,position)=>position%2===0));
  assert.equal(calls.filter(call=>call.method==='indexSearch').length,1);assert.equal(client.diagnostics().pending,0);
 }finally{release();client.dispose();}
});

test('a worker-evicted search group re-registers once and preserves catalogue object identity',async()=>{
 const groups=['a','b','c'].map(prefix=>['Alfa','Beta','Gamma'].map((title,position)=>({id:prefix+position,title,genre:'Drama'}))),{client,calls}=indexedClient({maxSearchGroups:2});
 try{
  const index=createCatalogueIndex(groups.flat(),{workerClient:client});
  for(const group of groups)assert.deepEqual(await index.search(group,'alfa'),[group[0]]);
  const firstKey=calls.find(call=>call.method==='indexSearch').args[0];
  assert.deepEqual(await index.search(groups[0],'beta'),[groups[0][1]]);
  assert.equal(calls.filter(call=>call.method==='indexSearch'&&call.args[0]===firstKey).length,2,'A missing worker group must cause one fresh registration.');
  const gamma=await index.search(groups[0],'gamma');assert.equal(gamma[0],groups[0][2]);assert.equal(await index.search(groups[0],'GAMMA'),gamma);
  assert.equal(calls.filter(call=>call.method==='indexSearch').length,4,'Later queries must retain the recovered registration.');
  assert.equal(calls.filter(call=>call.method==='search'&&call.args[0]===firstKey&&call.args[1]==='beta').length,2,'Only the missing-index query is retried.');
 }finally{client.dispose();}
});

test('primed category positions avoid rescanning titles and preserve hostile category names',async()=>{
 const items=[{id:'drama',genre:'Drama'},{id:'both',genre:'Comedia',genres:['Comedia','Drama','Drama']},{id:'proto',genre:'__proto__'},{id:'ctor',genre:'constructor'},{id:'string',genre:'toString'}],shows=[],rawChannels=[{id:'raw',genre:'Otra'}],preparedChannels=[{id:'channel',genre:'Deportes'}];
 const data={movies:items,shows,channels:rawChannels,preparedChannels};data.preparedGroups=await prepareCatalogueGroups(data,preparedChannels);primeCatalogueGroups(data);
 // Membership was already prepared. Any accidental fallback scan now fails.
 for(const item of [...items,...preparedChannels])for(const property of ['genre','genres'])Object.defineProperty(item,property,{get(){throw Error('Prepared categories must not rescan catalogue fields.');},configurable:true});
 const index=createCatalogueIndex([...items,...preparedChannels]);
 assert.equal(index.categories(items),data.preparedGroups.movies.categories);assert.equal(index.categories(preparedChannels),data.preparedGroups.channels.categories);
 assert.deepEqual(index.filter(items,'','Drama'),[items[0],items[1]]);
 assert.deepEqual(index.filter(items,'','__proto__'),[items[2]]);assert.deepEqual(index.filter(items,'','constructor'),[items[3]]);assert.deepEqual(index.filter(items,'','toString'),[items[4]]);
 assert.deepEqual(index.filter(preparedChannels,'','Deportes'),preparedChannels);assert.equal(index.filter(items),items);assert.deepEqual(index.categories(shows),[]);
});

test('fuzzy returns catalogue items and suggestions through the worker and without it',async()=>{
 const items=[{id:'bb',title:'Breaking Bad',genre:'Drama'},{id:'ls',title:'Los Simpson',genre:'Comedia'}];
 const {client,calls}=indexedClient();
 try{for(const workerClient of [client,null]){const index=createCatalogueIndex(items,{workerClient}),found=await index.fuzzy(items,'brekin bad');assert.deepEqual(found.items,[items[0]]);assert.deepEqual(found.suggestions,['Breaking Bad']);assert.deepEqual((await index.fuzzy(items,'zzzz')).items,[]);}
  assert.equal(calls.filter(call=>call.method==='fuzzy').length,2);}finally{client.dispose();}
});
