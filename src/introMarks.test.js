import test from 'node:test';
import assert from 'node:assert/strict';
import {learnIntro,introWindow,discardIntro,shouldOffer,introKey} from './introMarks.js';
import {fetchIntro,seasonEpisodeNumber} from './introDatabase.js';

const where={seriesId:'bb',season:'1'};
test('learnIntro learns an 85 s jump at 40 s and ignores short or late jumps',()=>{
 const marks=learnIntro({},{...where,from:40,to:125});
 assert.deepEqual(introWindow(marks,where),{start:40,end:125,kind:'recap'});
 assert.deepEqual(learnIntro({},{...where,from:40,to:50}),{});
 assert.deepEqual(learnIntro({},{...where,from:1200,to:1290}),{});
 assert.deepEqual(learnIntro({},{...where,from:100,to:300}),{},'more than 150 s is not an intro');
 assert.equal(introWindow(marks,{seriesId:'bb',season:'2'}),null);
});
test('learnIntro averages the last three samples',()=>{
 let marks={};for(const [from,to] of [[60,150],[90,180],[66,156],[63,153]])marks=learnIntro(marks,{...where,from,to});
 assert.deepEqual(introWindow(marks,where),{start:73,end:163,kind:'intro'});
 assert.equal(marks[introKey(where)].samples.length,3);
});
test('discardIntro forgets the season mark (skip then rewind)',()=>{
 const marks=learnIntro({},{...where,from:70,to:160});
 assert.deepEqual(discardIntro(marks,introKey(where)),{});
});
test('shouldOffer: inside the window with 15 s of slack, not dismissed, at most 10 s on screen',()=>{
 const window={start:70,end:160};
 assert.equal(shouldOffer({position:56,window,now:0}),true);
 assert.equal(shouldOffer({position:54,window,now:0}),false);
 assert.equal(shouldOffer({position:159.5,window,now:0}),false);
 assert.equal(shouldOffer({position:100,window,dismissed:true,now:0}),false);
 assert.equal(shouldOffer({position:100,window,shownAt:0,now:9000}),true);
 assert.equal(shouldOffer({position:100,window,shownAt:0,now:10001}),false);
 assert.equal(shouldOffer({position:100,window:null,now:0}),false);
});
test('fetchIntro reads TheIntroDB once, converts to seconds and caches 30 days',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};let calls=0,t=0;
 const fetcher=async url=>{calls++;assert.equal(url,'https://api.theintrodb.org/v2/media?tmdb_id=1396&season=1&episode=1');return {ok:true,json:async()=>({intro:[{start_ms:null,end_ms:107000}],recap:[{start_ms:0,end_ms:30500}],credits:[{start_ms:3431000,end_ms:null}]})};};
 const first=await fetchIntro({tmdbId:1396,season:'1',episode:1},{fetcher,storage,now:()=>t});
 assert.deepEqual(first,[{kind:'recap',start:0,end:30.5},{kind:'intro',start:0,end:107}]);
 assert.deepEqual(await fetchIntro({tmdbId:1396,season:'1',episode:1},{fetcher,storage,now:()=>t}),first);assert.equal(calls,1);
 t=31*86400000;await fetchIntro({tmdbId:1396,season:'1',episode:1},{fetcher,storage,now:()=>t});assert.equal(calls,2);
});
test('fetchIntro never throws and skips invalid ids or failed requests',async()=>{
 const storage={getItem:()=>null,setItem:()=>{}};
 assert.deepEqual(await fetchIntro({tmdbId:undefined,season:'1',episode:1},{fetcher:()=>{throw Error('no');},storage}),[]);
 assert.deepEqual(await fetchIntro({tmdbId:5,season:'1',episode:1},{fetcher:async()=>({ok:false,status:404}),storage}),[]);
 assert.deepEqual(await fetchIntro({tmdbId:5,season:'1',episode:1},{fetcher:async()=>{throw Error('offline');},storage}),[]);
 assert.deepEqual(await fetchIntro({tmdbId:5,season:'0',episode:1},{fetcher:async()=>{throw Error('specials are not looked up');},storage}),[]);
});
test('seasonEpisodeNumber turns absolute provider numbering into the TMDB episode number',()=>{
 const seasons=[{season:'2',episodes:[{id:'x',episodeNumber:13},{id:'y',episodeNumber:14}]},{season:'1',episodes:[{id:'a',episodeNumber:1},{id:'b',episodeNumber:2}]}];
 assert.equal(seasonEpisodeNumber(seasons,{id:'y',season:'2',episodeNumber:14}),2);
 assert.equal(seasonEpisodeNumber(seasons,{id:'b',season:'1',episodeNumber:2}),2);
 assert.equal(seasonEpisodeNumber(undefined,{id:'b',season:'1',episodeNumber:2}),2);
});
