import test from 'node:test';
import assert from 'node:assert/strict';
import {episodePositions,episodeWindow,adjacentEpisode} from './episodeWindow.js';
test('season headings reserve their own space and long episode lists keep a bounded window and focused item',()=>{
 const episodes=Array.from({length:5000},(_,index)=>({groupStart:index%100===0})),offsets=episodePositions(episodes,174,76);
 assert.deepEqual(offsets.slice(0,3),[0,250,424]);assert.equal(offsets[101]-offsets[100],250);
 const indices=episodeWindow({offsets,offset:offsets[2000],height:700,focusedIndex:80});assert.ok(indices.length<=11);assert.ok(indices.includes(2000)&&indices.includes(80));assert.ok(!indices.includes(0));
 assert.deepEqual(episodeWindow({offsets:[0],height:700}),[]);assert.ok(episodeWindow({offsets,offset:offsets.at(-1),height:700}).includes(4999));
});
test('adjacentEpisode walks seasons in order, stops at the ends and keeps specials apart',()=>{
 const seasons=[{season:'0',episodes:[{id:'s1'},{id:'s2'}]},{season:'1',episodes:[{id:'a'},{id:'b'}]},{season:'2',episodes:[{id:'c'}]},{season:'3',episodes:[]}];
 assert.equal(adjacentEpisode(seasons,'a',1).id,'b');
 assert.equal(adjacentEpisode(seasons,'b',1).id,'c');
 assert.equal(adjacentEpisode(seasons,'c',-1).id,'b');
 assert.equal(adjacentEpisode(seasons,'c',1),null);
 assert.equal(adjacentEpisode(seasons,'a',-1),null);
 assert.equal(adjacentEpisode(seasons,'s2',1),null);
 assert.equal(adjacentEpisode(seasons,'s1',1).id,'s2');
 assert.equal(adjacentEpisode(seasons,'missing',1),null);
 assert.equal(adjacentEpisode(undefined,'a',1),null);
});
