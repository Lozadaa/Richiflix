import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkPrefetch} from './artworkPrefetch.js';
const poster=id=>`https://image.tmdb.org/t/p/w780/${id}.jpg`;
function harness(options={}){
 const started=[],cancelled=[],jobs=new Map();
 const load=url=>{let resolve;const done=new Promise(value=>{resolve=value;});started.push(url);jobs.set(url,resolve);return {done,cancel(){cancelled.push(url);resolve(false);}};};
 return {started,cancelled,finish:async(url,ok=true)=>{jobs.get(url)(ok);await new Promise(resolve=>setImmediate(resolve));},prefetch:createArtworkPrefetch({load,...options})};
}
test('nearest posters first, at the responsive card size, bounded by concurrency and queue',async()=>{
 const {started,finish,prefetch}=harness({concurrency:2,queueLimit:3});
 const planned=prefetch.plan([{src:poster('c'),distance:3},{src:poster('a'),distance:1},{src:poster('b'),distance:2},{src:poster('d'),distance:4},{src:poster('a'),distance:5},{src:undefined,distance:0}],{layoutWidth:210,dpr:1});
 assert.deepEqual(planned,['a','b','c'].map(id=>`https://image.tmdb.org/t/p/w342/${id}.jpg`));
 assert.equal(started.length,2);assert.match(started[0],/w342\/a/);
 await finish(started[0]);assert.equal(started.length,3);assert.match(started[2],/w342\/c/);
 assert.equal(prefetch.stats().done,1);
 // Loaded work is never requested again; unmeasured layouts plan nothing.
 assert.deepEqual(prefetch.plan([{src:poster('a'),distance:1}],{layoutWidth:210}),[]);
 assert.deepEqual(prefetch.plan([{src:poster('z'),distance:1}],{layoutWidth:0}),[]);
});
test('a new plan cancels abandoned loads; pause frees connections and resume restarts them',async()=>{
 const {started,cancelled,prefetch}=harness({concurrency:2});
 prefetch.plan([{src:poster('a'),distance:1},{src:poster('b'),distance:2}],{layoutWidth:210});
 prefetch.plan([{src:poster('b'),distance:1},{src:poster('c'),distance:2}],{layoutWidth:210});
 assert.deepEqual(cancelled,[started[0]]);assert.equal(started.length,3);
 prefetch.pause();assert.equal(prefetch.stats().running,0);assert.equal(prefetch.stats().queued,2);
 prefetch.plan([{src:poster('d'),distance:1}],{layoutWidth:210});assert.equal(started.length,3,'nothing starts while paused');
 prefetch.resume();assert.equal(started.length,4);assert.match(started[3],/w342\/d/);
 prefetch.clear();assert.deepEqual(prefetch.stats(),{running:0,queued:0,done:0,paused:false,started:4});
});
test('shown artwork and provider images: shared done map is respected, non-TMDB URLs pass unchanged',()=>{
 const done=new Map([['https://image.tmdb.org/t/p/w342/a.jpg',Date.now()]]),{started,prefetch}=harness({done});
 prefetch.plan([{src:poster('a'),distance:1},{src:'http://provider.test/p.png',distance:2}],{layoutWidth:210});
 assert.deepEqual(started,['http://provider.test/p.png']);
});
test('R4.5: TV budget plans at most 8 posters, 2 at a time, and waits while the visible window is still decoding',async()=>{
 let loading=true;const {started,finish,prefetch}=harness({concurrency:2,queueLimit:8,ready:()=>!loading,retryMs:5});
 const planned=prefetch.plan(Array.from({length:12},(_,index)=>({src:poster('r'+index),distance:index})),{layoutWidth:210});
 assert.equal(planned.length,8);assert.equal(started.length,0,'paused while a mounted poster loads');
 loading=false;await new Promise(resolve=>setTimeout(resolve,20));assert.equal(started.length,2);
 loading=true;await finish(started[0]);assert.equal(started.length,2,'the next job also waits for the window');
 prefetch.clear();loading=false;await new Promise(resolve=>setTimeout(resolve,20));assert.equal(started.length,2,'clear cancels the pending retry');
});
