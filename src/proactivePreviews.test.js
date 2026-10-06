import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewCache} from './previewCache.js';
import {createProactivePreviews} from './proactivePreviews.js';
const item=streamId=>({streamId,mediaType:'movie'}),tick=()=>new Promise(resolve=>setImmediate(resolve));
test('two-row preparation shares selection cache, pauses during movement and discards departed scopes',async()=>{
 const started=[],finished=new Map(),published=[],timers=new Map();let sequence=0;
 const cache=createPreviewCache(value=>{started.push(value.streamId);return new Promise(resolve=>finished.set(value.streamId,resolve));});
 const warmer=createProactivePreviews({cache,publish:(item,data)=>published.push([item.streamId,data]),schedule:fn=>{timers.set(++sequence,fn);return sequence;},cancel:id=>timers.delete(id)});
 const run=()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}};
 const unwatch=warmer.watch('grid',Array.from({length:24},(_,index)=>item(index+1)));warmer.enable(true);run();await tick();assert.deepEqual(started,[1,2]);
 const selected=cache.get(item(1),true);warmer.enable(false);finished.get(1)({tmdbScore:8});await selected;await tick();run();assert.deepEqual(started,[1,2]);assert.deepEqual(published[0],[1,{tmdbScore:8}]);
 unwatch();warmer.watch('next', [item(50)]);finished.get(2)({});await tick();warmer.enable(true);run();await tick();assert.deepEqual(started,[1,2,50]);finished.get(50)({});await tick();warmer.dispose();cache.dispose();
});
