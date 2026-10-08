import test from 'node:test';
import assert from 'node:assert/strict';
import {setMetadataPriority,getMetadataPriority,publishMetadata,setMetadataLayer,getMetadata,getMetadataEntry,isMetadataResolved,resetMetadata,subscribeMetadata,flushMetadata} from './metadataStore.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('metadata keeps App precedence: selection over score, reply merges unless its tmdbId differs, guide added',()=>{
 resetMetadata({layers:true});
 setMetadataLayer('score',{a:{rating:7},b:{rating:6}});setMetadataLayer('selection',{a:{tmdbId:1,title:'Sel'}});
 assert.deepEqual(getMetadata('a'),{tmdbId:1,title:'Sel'});assert.deepEqual(getMetadata('b'),{rating:6});assert.equal(getMetadata('z'),undefined);
 publishMetadata('a',{tmdbId:1,description:'d'});assert.deepEqual(getMetadata('a'),{tmdbId:1,title:'Sel',description:'d'});
 publishMetadata('a',{tmdbId:2,description:'other'});assert.deepEqual(getMetadata('a'),{tmdbId:2,description:'other'});
 publishMetadata('c',{});assert.deepEqual(getMetadata('c'),{});assert.equal(isMetadataResolved('c'),true);assert.equal(isMetadataResolved('b'),false);
 setMetadataLayer('guide',{b:{now:'x'},n:{now:'y'}});assert.deepEqual(getMetadata('b'),{rating:6,guide:{now:'x'}});assert.deepEqual(getMetadata('n'),{guide:{now:'y'}});
 assert.equal(getMetadataEntry('b'),getMetadataEntry('b'),'entry identity is stable until its id changes');
 assert.equal(getMetadata('constructor'),undefined);
});
test('subscriptions are per id and grouped per task',async()=>{
 resetMetadata({layers:true});flushMetadata();
 const calls={a:0,b:0};const stopA=subscribeMetadata('a',()=>calls.a++),stopB=subscribeMetadata('b',()=>calls.b++);
 const before=getMetadataEntry('a');
 publishMetadata('a',{x:1});publishMetadata('a',{x:2});assert.equal(calls.a,0,'notified after the task');
 assert.notEqual(getMetadataEntry('a'),before);await tick();assert.deepEqual(calls,{a:1,b:0});
 setMetadataLayer('score',{b:{rating:1}});setMetadataLayer('score',{b:{rating:1}});await tick();assert.deepEqual(calls,{a:1,b:1},'two writes in one task, one render');
 const same=getMetadataEntry('a');setMetadataLayer('selection',{c:{}});await tick();assert.equal(getMetadataEntry('a'),same);assert.deepEqual(calls,{a:1,b:1});
 resetMetadata();await tick();assert.equal(calls.a,2);assert.equal(isMetadataResolved('a'),false);assert.deepEqual(getMetadata('b'),{rating:1},'reset keeps owner layers');
 resetMetadata({layers:true});await tick();assert.equal(getMetadata('b'),undefined);stopA();stopB();
});
test('old replies of unsubscribed ids are dropped, subscribed ones kept',()=>{
 resetMetadata({layers:true});const stop=subscribeMetadata('keep',()=>{});publishMetadata('keep',{k:1});
 for(let index=0;index<120;index++)publishMetadata(`m${index}`,{index});
 assert.equal(isMetadataResolved('keep'),true);assert.equal(isMetadataResolved('m0'),false);assert.equal(isMetadataResolved('m119'),true);stop();flushMetadata();
});
test('the banner priority marks one id and notifies the old and new one',async()=>{
 resetMetadata({layers:true});flushMetadata();const calls={a:0,b:0};const stops=['a','b'].map(id=>subscribeMetadata(id,()=>calls[id]++));
 setMetadataPriority('a');assert.equal(getMetadataEntry('a').priority,true);setMetadataPriority('b');await tick();
 assert.deepEqual(calls,{a:1,b:1});assert.equal(getMetadataEntry('a').priority,false);assert.equal(getMetadataPriority(),'b');
 resetMetadata();assert.equal(getMetadataPriority(),null);stops.forEach(stop=>stop());flushMetadata();
});
