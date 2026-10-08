import test from 'node:test';
import assert from 'node:assert/strict';
import {cooperativeMap} from './cooperativeWork.js';
import {deduplicateItems,deduplicateItemsAsync} from './catalogueIdentity.js';
test('cooperative catalogue work gives pending events a turn without changing its result',async()=>{
 let event=false,observed=false;const items=Array.from({length:4000},(_,index)=>index);
 setTimeout(()=>{event=true;},0);const values=await cooperativeMap(items,(item,index)=>{if(index>1000&&event)observed=true;return item*2;},{batchSize:100,budget:100});
 assert.equal(observed,true);assert.deepEqual(values,items.map(item=>item*2));
});
test('an abandoned normalization exits before processing the rest of the catalogue',async()=>{
 let count=0,cancelled=false;const work=cooperativeMap(Array.from({length:3000},(_,index)=>index),item=>{count++;if(item===25)cancelled=true;return item;},{cancelled:()=>cancelled});await assert.rejects(work,/cancelado/);assert.equal(count,26);
});
test('asynchronous identity normalization preserves genres and distinct channel signals across batches',async()=>{
 const items=Array.from({length:2000},(_,index)=>({id:'shared-'+index%500,streamId:String(index%700),sourceId:'one',mediaType:'live',url:'xtream://one/'+index%700,title:'Same match',genre:'group-'+index%5}));
 assert.deepEqual(await deduplicateItemsAsync(items,{batchSize:100}),deduplicateItems(items));
});
