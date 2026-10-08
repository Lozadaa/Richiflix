import test from 'node:test';
import assert from 'node:assert/strict';
import {parseShortEpg,currentGuide,guideNowLine,guideNextLine,createGuideQueue} from './channelGuide.js';
import {loadXtreamShortEpg,validateAccount} from './xtream.js';
const b64=value=>Buffer.from(value,'utf8').toString('base64'),at=Date.UTC(2026,9,6,23,0)/1000;
const listing=(title,start,stop,extra={})=>({title:b64(title),start:'2026-10-06 20:00:00',end:'2026-10-06 21:00:00',start_timestamp:String(start),stop_timestamp:String(stop),...extra});

test('parseShortEpg decodes base64 UTF-8 and uses UTC timestamps',()=>{
 const guide=parseShortEpg({epg_listings:[listing('Noticias de la mañana',at-1800,at+1800,{now_playing:1}),listing('Fútbol: Colo-Colo vs. U',at+1800,at+7200)]},at*1000);
 assert.equal(guide.now.title,'Noticias de la mañana');assert.equal(guide.now.progress,.5);assert.equal(guide.next.title,'Fútbol: Colo-Colo vs. U');
 assert.equal(guideNowLine(guide,at*1000),'Ahora · Noticias de la mañana');
 // 23:30 UTC is 20:30 in Santiago (UTC-3 in October).
 assert.equal(guideNextLine(guide,at*1000),'Después · Fútbol: Colo-Colo vs. U · 20:30');
});
test('parseShortEpg is tolerant and shows no time without timestamps',()=>{
 assert.equal(parseShortEpg({epg_listings:[]}),null);assert.equal(parseShortEpg(null),null);assert.equal(parseShortEpg({epg_listings:'x'}),null);
 const plain=parseShortEpg({epg_listings:[{title:'Plain title',start:'2026-10-06 20:00:00'},{title:b64('Después de hora')}]});
 assert.equal(plain.now.title,'Plain title');assert.equal(plain.now.progress,null);assert.equal(guideNextLine(plain),'Después · Después de hora');
 assert.equal(parseShortEpg({epg_listings:[{title:'@@@'},{title:''}]}).now.title,'@@@');
 // Stale timed listings (nothing on now) are not shown.
 assert.equal(parseShortEpg({epg_listings:[listing('Ayer',at-7200,at-3600)]},at*1000),null);
});
test('parseShortEpg hides the whole guide when a title is pornographic',()=>{
 assert.equal(parseShortEpg({epg_listings:[listing('Cine',at-60,at+60),listing('Brazzers night',at+60,at+600)]},at*1000),null);
});
test('currentGuide hands over to the next programme when the current one ends',()=>{
 const guide=parseShortEpg({epg_listings:[listing('A',at-60,at+60),listing('B',at+60,at+600)]},at*1000);
 assert.equal(currentGuide(guide,(at+90)*1000).now.title,'B');assert.equal(currentGuide(guide,(at+90)*1000).now.progress,null);
 assert.equal(currentGuide({now:{title:'A',start:1,end:2},next:null},3),null);
});
test('loadXtreamShortEpg trims the payload, uses a 6 s request and keeps credentials out of errors',async()=>{
 const account=validateAccount({host:'http://example.test',username:'user',password:'secret-pass'});let seen;
 const ok=await loadXtreamShortEpg(account,'12',async url=>{seen=new URL(url);return new Response(JSON.stringify({epg_listings:[{...listing('A',at,at+60),description:'long',id:'9'}]}));});
 assert.equal(seen.searchParams.get('action'),'get_short_epg');assert.equal(seen.searchParams.get('stream_id'),'12');assert.equal(seen.searchParams.get('limit'),'2');
 assert.deepEqual(Object.keys(ok.epg_listings[0]).sort(),['end','now_playing','start','start_timestamp','stop_timestamp','title']);
 await assert.rejects(loadXtreamShortEpg(account,'../x',async()=>{throw Error('no');}),/Canal no válido/);
 await assert.rejects(loadXtreamShortEpg(account,'12',async url=>{throw Error('failed '+url);}),error=>!error.message.includes('secret-pass'));
});
test('guide queue: concurrency 2, plan replaces queue, fresh entries are not asked again, pause and LRU',async()=>{
 let clock=0;const calls=[],waiting=[],flush=()=>new Promise(resolve=>setTimeout(resolve,0));
 const queue=createGuideQueue({load:item=>{calls.push(item.id);return new Promise(resolve=>waiting.push(()=>resolve({now:{title:item.id,start:null,end:null,progress:null},next:null})));},maxEntries:3,ttlMs:1000,now:()=>clock});
 const seen=[];queue.subscribe(id=>seen.push(id));
 queue.want([{id:'a'},{id:'b'},{id:'c'},{id:'d'}]);await flush();assert.deepEqual(calls,['a','b']);
 queue.want([{id:'e'},{id:'a'}]);// c and d left the window; a is running
 waiting.shift()();waiting.shift()();await flush();await flush();assert.deepEqual(calls,['a','b','e']);
 waiting.shift()();await flush();await flush();assert.deepEqual(seen,['a','b','e']);assert.equal(queue.get('a').now.title,'a');
 queue.want([{id:'a'},{id:'b'}]);await flush();assert.equal(calls.length,3,'fresh entries are not requested');
 queue.pause();queue.want([{id:'f'}]);await flush();assert.equal(calls.length,3,'paused');queue.resume();await flush();assert.equal(calls.at(-1),'f');waiting.shift()();await flush();await flush();
 assert.equal(queue.stats().entries,3);assert.equal(queue.get('a'),undefined,'LRU dropped the oldest');
 clock=2000;assert.equal(queue.get('f'),undefined,'TTL');assert.deepEqual(queue.snapshot(),{});
 const failing=createGuideQueue({load:()=>Promise.reject(Error('x'))});failing.want([{id:'z'}]);await flush();await flush();assert.equal(failing.get('z'),null,'failures are cached as empty');
});
