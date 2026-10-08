import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogueWorkerService} from './catalogueWorker.js';
import {prepareChannels,prepareCatalogueGroups} from './channelPreparation.js';

test('search jobs keep only a lean index and never initialize the source backend',async()=>{
 const service=createCatalogueWorkerService({backendFactory:()=>{throw Error('Unexpected source access');}}),items=[{id:'one',title:'Película azul',genre:'Drama',source:'Fuente'},{id:'two',title:'Serie azul',genre:'Comedia',genres:['Comedia','Drama'],source:'Otra'},{id:'three',title:'Película roja',genre:'Drama',source:'Fuente'}];
 assert.deepEqual(await service.request('indexSearch',['movies',items]),{count:3});assert.deepEqual(await service.request('search',['movies','AZUL','Todas']),['one','two']);assert.deepEqual(await service.request('search',['movies','azul','Comedia']),['two']);assert.deepEqual(await service.request('search',['movies','fuente','Todas']),['one','three']);assert.deepEqual(await service.request('search',['movies','','Drama']),['one','two','three']);
});
test('search groups use bounded LRU storage and a replaced query does not cache partial results',async()=>{
 const service=createCatalogueWorkerService({maxSearchGroups:2}),items=Array.from({length:5000},(_,index)=>({id:String(index),title:'Título '+index,genre:'Drama'}));
 await service.request('indexSearch',['one',items]);await service.request('indexSearch',['two',items]);await service.request('search',['one','42']);await service.request('indexSearch',['three',items]);await assert.rejects(service.request('search',['two','42']),{code:'SEARCH_INDEX_MISSING'});
 const controller=new AbortController(),work=service.request('search',['one','Título'],{signal:controller.signal});controller.abort();await assert.rejects(work,{name:'AbortError'});assert.equal((await service.request('search',['one','Título'])).length,5000);
 await service.request('dropSearch',['one']);await assert.rejects(service.request('search',['one','42']),{code:'SEARCH_INDEX_MISSING'});
});
test('worker service delegates the original API and preserves backend errors',async()=>{
 const calls=[];const service=createCatalogueWorkerService({backendFactory:()=>({status:async()=>({configured:true}),details:async(...args)=>{calls.push(args);return {description:'Detalle'};},save:async()=>{throw Error('Revisa la dirección del servidor.');}})});
 assert.deepEqual(await service.request('status'),{configured:true});assert.deepEqual(await service.request('details',['123','movie','fixture']),{description:'Detalle'});assert.deepEqual(calls,[['123','movie','fixture']]);await assert.rejects(service.request('save',[{}]),/Revisa la dirección/);await assert.rejects(service.request('not-a-method'));
});
test('prepared channels detect generic art, retain stream IDs and resolve event instants once',async()=>{
 const startsAt=Date.UTC(2026,9,5,20),data={channels:Array.from({length:8},(_,index)=>({id:'channel-'+index,kind:'iptv',title:'Canal '+index,genre:'Deportes',image:'https://example.test/logo.png',eventStartsAt:startsAt})),sources:[],updatedAt:'2026-10-05T00:00:00Z'};
 const prepared=await prepareChannels(data);assert.equal(prepared.length,8);assert.ok(prepared.every((item,index)=>item.imageGeneric&&item.id===data.channels[index].id&&item.eventStartsAt===startsAt));assert.equal(data.channels[0].imageGeneric,undefined);
 const service=createCatalogueWorkerService();assert.deepEqual(await service.request('prepareChannels',[data]),prepared);
});
test('prepared category positions match catalogue order and handle hostile category names',async()=>{
 const movies=[{genre:'Drama'},{genre:'Comedia',genres:['Comedia','Drama','Drama']},{genre:'__proto__'},{genre:'constructor'}],channels=[{genre:'Deportes'}],groups=await prepareCatalogueGroups({movies,shows:[],channels},channels);
 assert.deepEqual(groups.movies.categories,['__proto__','Comedia','constructor','Drama'].sort((a,b)=>a.localeCompare(b,'es')));assert.deepEqual(groups.movies.categoryPositions.Drama,[0,1]);assert.deepEqual(groups.movies.categoryPositions.__proto__,[2]);assert.deepEqual(groups.movies.categoryPositions.constructor,[3]);assert.equal(Object.getPrototypeOf(groups.movies.categoryPositions),null);assert.deepEqual(groups.channels.categoryPositions.Deportes,[0]);assert.equal(groups.shows.categories.length,0);
});
